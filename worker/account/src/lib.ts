// The account worker's PURE half — constants, the state contract, the rules — kept apart from
// the handler because workerd refuses an entry module whose named exports are not handlers
// (an exported number fails the start: "Incorrect type for map entry"). Tests import from here.

export const TOKEN_TTL_S = 15 * 60
export const CODE_TTL_S = 2 * 60
export const SESSION_TTL_S = 90 * 86_400
export const RATE_WINDOW_S = 10 * 60
export const LOGIN_PER_IP = 10          // a shared office NAT still gets ten tries in ten minutes
export const LOGIN_PER_EMAIL = 3        // three links in ten minutes is a person; thirty is a script
export const MAX_LOGIN_BODY = 2048
export const MAX_STATE_BYTES = 256 * 1024      // a thousand saves with snapshots is ~150 KB; this is headroom
const MAX_SAVES = 1000
const MAX_IDS = 4000
const MAX_TASTE = 4000

/* ─────────────────────────────── the state contract ─────────────────────────────── */

/** A save, snapshotted at save time so it outlives the weekly feed: the Later shelf and the
 *  "did you go?" question both need a title and a date for a card that has since rotated out. */
export interface SaveEntry {
  id: string
  title: string
  when: string
  at: number            // when it was saved (ms)
  start?: string        // ISO date (YYYY-MM-DD) of its first concrete day, if it has one
  end?: string          // ISO date of its latest concrete day, if it has one
  link?: string         // the organiser's page, so a rotated-out save still goes somewhere
}

export interface AccountState {
  version: number       // server-owned: 0 until the first accepted PUT, then +1 per write
  updatedAt: number     // ms, server-stamped on accept
  saves: SaveEntry[]
  declines: { w: number; ids: string[] }      // this week's swiped-past ids (week = floor(ms / 7d))
  taste: Record<string, number>
  later: Record<string, { seen?: number }>    // the Later shelf's per-save notes (seen = the week its arrival pill was dismissed)
  went: Record<string, { went: boolean; at: number }>   // the first OUTCOME data (moat.md §6 item 1)
}

export const emptyState = (): AccountState =>
  ({ version: 0, updatedAt: 0, saves: [], declines: { w: 0, ids: [] }, taste: {}, later: {}, went: {} })

export interface AccountRecord { email: string; at: number; lastLoginAt?: number; logins: number }

export interface KV {
  get(key: string, type: 'json'): Promise<unknown>
  get(key: string, type: 'text'): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface Env {
  ACCOUNT: KV
  MAIL_PROVIDER?: string   // 'resend' (default) | 'none' — 'none' logs the link instead of sending it (local proof)
  MAIL_API_KEY?: string    // the SAME Resend key the Friday brief needs (list/README.md § Status, step 1)
  MAIL_FROM?: string       // e.g. 'WKNDR <hello@wkndr.xyz>'
  APP_ORIGIN?: string      // where /auth sends people back to, unless /login carried an allowed `return`
}

/* ─────────────────────────── pure logic (unit-testable, no I/O) ─────────────────────────── */

/** Same deliberately boring check as the list's: the click is the proof the mailbox exists. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (email.length < 6 || email.length > 254) return null
  if (!/^[^\s@,;:<>()[\]\\]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return null
  return email
}

/** Unguessable, URL-safe, dependency-free: 128 bits as hex. */
export function newToken(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('')
}

export function tokenOf(pathname: string, prefix: 'auth'): string | null {
  const m = pathname.match(new RegExp(`^/${prefix}/([a-f0-9]{32})$`))
  return m ? m[1] : null
}

/** `authorization: Bearer <32 hex>` → the session id, or null. Anything else is anonymous. */
export function bearerOf(header: string | null): string | null {
  const m = (header || '').match(/^Bearer ([a-f0-9]{32})$/)
  return m ? m[1] : null
}

export async function sha256(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')
}

/** The KV key for an address — hashed, so a key listing never spills addresses. */
export const accountKey = async (email: string) => 'a:' + (await sha256(email))

export const ALLOWED_ORIGINS = ['https://wkndr.xyz', 'https://www.wkndr.xyz', 'https://app.wkndr.xyz', 'https://nessim-higson.github.io']

export const originOk = (origin: string): boolean =>
  ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)

/** Where the magic link lands AFTER it is clicked. A `return` the app sent along is honoured
 *  only when its origin is one of ours — an open redirect on an auth endpoint is a phishing kit —
 *  and only its origin + path survive (no query, no fragment: the fragment is ours to write). */
export function returnTarget(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') {
    try {
      const u = new URL(raw)
      if (originOk(u.origin)) return u.origin + u.pathname
    } catch { /* not a URL */ }
  }
  return fallback
}

/** The write rule. `prev` is what KV holds (null = never written); `version` is the one the
 *  client last saw. Equal → the client built on the latest and may overwrite (last write wins).
 *  Anything else → another device wrote in between; refuse, hand back the stored document, and
 *  let the client merge. A fresh account accepts version 0 only. */
export function putDecision(prev: AccountState | null, version: unknown): 'accept' | 'conflict' {
  const have = prev?.version ?? 0
  return typeof version === 'number' && version === have ? 'accept' : 'conflict'
}

/** Shape guard for a client-sent state. Returns a clean copy or null. Caps every list so one
 *  bad client cannot bloat KV; drops anything that isn't the contract. version/updatedAt are
 *  NOT read from here — the server owns them. */
export function sanitizeState(raw: unknown): Omit<AccountState, 'version' | 'updatedAt'> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '')
  const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  const saves: SaveEntry[] = []
  const seen = new Set<string>()
  if (Array.isArray(r.saves)) {
    for (const s of r.saves) {
      if (!s || typeof s !== 'object') continue
      const e = s as Record<string, unknown>
      const id = str(e.id, 120)
      if (!id || seen.has(id)) continue
      seen.add(id)
      const entry: SaveEntry = { id, title: str(e.title, 200), when: str(e.when, 120), at: typeof e.at === 'number' ? e.at : 0 }
      const start = isoDate(e.start), end = isoDate(e.end)
      if (start) entry.start = start
      if (end) entry.end = end
      const link = str(e.link, 400)
      if (/^https?:\/\//.test(link)) entry.link = link   // a URL or nothing — never a javascript: for a row to open
      saves.push(entry)
      if (saves.length >= MAX_SAVES) break
    }
  }
  const d = (r.declines && typeof r.declines === 'object' ? r.declines : {}) as Record<string, unknown>
  const declines = {
    w: typeof d.w === 'number' ? d.w : 0,
    ids: Array.isArray(d.ids) ? d.ids.filter((x): x is string => typeof x === 'string').slice(0, MAX_IDS) : [],
  }
  const taste: Record<string, number> = {}
  if (r.taste && typeof r.taste === 'object') {
    for (const [k, v] of Object.entries(r.taste as Record<string, unknown>).slice(0, MAX_TASTE))
      if (typeof v === 'number' && Number.isFinite(v) && v !== 0) taste[k.slice(0, 80)] = v
  }
  const later: AccountState['later'] = {}
  if (r.later && typeof r.later === 'object') {
    for (const [k, v] of Object.entries(r.later as Record<string, unknown>).slice(0, MAX_IDS)) {
      const n = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
      later[k.slice(0, 120)] = typeof n.seen === 'number' ? { seen: n.seen } : {}
    }
  }
  const went: AccountState['went'] = {}
  if (r.went && typeof r.went === 'object') {
    for (const [k, v] of Object.entries(r.went as Record<string, unknown>).slice(0, MAX_IDS)) {
      const n = (v && typeof v === 'object' ? v : null) as Record<string, unknown> | null
      if (n && typeof n.went === 'boolean') went[k.slice(0, 120)] = { went: n.went, at: typeof n.at === 'number' ? n.at : 0 }
    }
  }
  return { saves, declines, taste, later, went }
}

/** Where a `MAIL_PROVIDER=none` deploy puts the link it would have mailed — the test harness
 *  and the local proof read it here; `wrangler dev` also prints it to the terminal. */
export const mailSink: { last: { to: string; link: string } | null } = { last: null }

