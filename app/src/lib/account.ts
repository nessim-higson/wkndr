// THE ACCOUNT (V.12.2) — the client half of WKNDR's first account layer (`worker/account/`).
// Ness, 2026-10-26: "I want to look at having an account that I can log into and then have
// saved events and things to do for the future." Free, no passwords: a magic link on the
// person's email. Signed OUT the app is exactly what it was — saves and taste in this
// browser's localStorage. Signed IN those same things are MERGED with the account on load and
// written through (debounced) on change, so a save on the phone is on the laptop by the time
// you open it. The account is additive; nothing here writes to the deck
// (docs/curation-surfaces.md §2 — the taste profile stays per person).
//
// Two things ride along that work signed out too, from the same local mirror:
//   THE LATER SHELF — a save whose date is after this weekend (or an "Until …" run) is a thing
//   to do for the future, not a plan for Saturday. It gets its own tab, sorted by date, and
//   comes back as a quiet pill in the week its date arrives.
//   DID YOU GO? — a past save asks once, yes or no. The first outcome data (moat.md §6 item 1).
//
// LIVE from V.12.2 — set ACCOUNT_URL to '' to turn the whole account path off (the menu row
// disappears; the shelf and the question keep working locally).
import type { Pick } from '../types'
import { firstDateOf, latestDateOf, upcomingWeekendEnd } from './when'

/** The live worker. Overridable for a local proof — `VITE_ACCOUNT_URL` at build time, or in dev
 *  `localStorage['wkndr.account.url'] = 'http://localhost:8788'` against `wrangler dev`. */
export const ACCOUNT_URL: string = (import.meta.env.VITE_ACCOUNT_URL as string | undefined)
  ?? (import.meta.env.DEV ? (() => { try { return localStorage.getItem('wkndr.account.url') ?? undefined } catch { return undefined } })() : undefined)
  ?? 'https://wkndr-account.ness-13b.workers.dev'
export const accountOn = () => ACCOUNT_URL !== ''

/* ───────────────────────────── the contract (mirrors worker/account) ───────────────────────────── */

/** A save, snapshotted at save time so it outlives the weekly feed — the shelf and the question
 *  both need a title and a date for a card that has since rotated out. */
export interface SaveEntry {
  id: string
  title: string
  when: string
  at: number            // when it was saved (ms)
  start?: string        // ISO date (YYYY-MM-DD) of its first concrete day
  end?: string          // ISO date of its latest concrete day
  link?: string         // the organiser's page, so a rotated-out save still goes somewhere
}
export interface AccountState {
  version: number       // server-owned: the version this mirror was last reconciled with
  updatedAt: number
  saves: SaveEntry[]
  declines: { w: number; ids: string[] }
  taste: Record<string, number>
  later: Record<string, { seen?: number }>
  went: Record<string, { went: boolean; at: number }>
}
export const emptyState = (): AccountState =>
  ({ version: 0, updatedAt: 0, saves: [], declines: { w: 0, ids: [] }, taste: {}, later: {}, went: {} })

export type Session = { session: string; email: string; since: number }

/** The week number the taste module scopes declines by (floor of ms / 7 days). */
export const weekOf = (ms: number) => Math.floor(ms / 6.048e8)

const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined)
const dayStart = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate())
const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12) }

/* ───────────────────────────────── pure rules (tested) ───────────────────────────────── */

/** Keep the mirror's saves in step with the app's saved set. An id still saved keeps its
 *  snapshot (its `at` is the save moment, never re-stamped); a newly saved id gets one from the
 *  pick if the pick is in the pool; an id with neither a snapshot nor a pick (a save from before
 *  this feature whose card has rotated out) is skipped — there is nothing honest to show for it. */
export function snapshotSaves(prev: SaveEntry[], saved: Set<string>, picks: Pick[], now: Date = new Date()): SaveEntry[] {
  const have = new Map(prev.map((e) => [e.id, e]))
  const byId = new Map(picks.map((p) => [p.id, p]))
  const out: SaveEntry[] = []
  for (const id of saved) {
    const old = have.get(id)
    const p = byId.get(id)
    if (old) {
      // a snapshot taken before the pick's dates were readable (or a bare one) fills in from the pick
      if (p && (!old.start && !old.end)) out.push({ ...old, title: old.title || p.title, when: old.when || p.when, start: iso(firstDateOf(p.when, now)), end: iso(latestDateOf(p.when, now)), link: old.link ?? p.link })
      else out.push(old)
    } else if (p) {
      const e: SaveEntry = { id, title: p.title, when: p.when, at: now.getTime() }
      const start = iso(firstDateOf(p.when, now)), end = iso(latestDateOf(p.when, now))
      if (start) e.start = start
      if (end) e.end = end
      if (p.link) e.link = p.link
      out.push(e)
    }
  }
  return out
}

const OPEN_RUN = /\b(until|through|thru|till|t\/m)\b/i

/** Which shelf a save sits on. LATER = its first day is after the weekend being served, or it
 *  is an open run ("Until 15 Jan") whose end is past that weekend — a thing you can do any week,
 *  so a thing for the future. Everything else — this weekend, undated, recurring — is the plan. */
export function shelfOf(e: SaveEntry, now: Date = new Date()): 'weekend' | 'later' {
  const end = upcomingWeekendEnd(now)
  if (e.start && fromIso(e.start).getTime() > end.getTime()) return 'later'
  if (OPEN_RUN.test(e.when) && e.end && fromIso(e.end).getTime() > end.getTime()) return 'later'
  return 'weekend'
}

/** The Later shelf: later saves, soonest first (a run sorts by its end — the deadline). */
export function laterShelf(saves: SaveEntry[], now: Date = new Date()): SaveEntry[] {
  const key = (e: SaveEntry) => (e.start && !OPEN_RUN.test(e.when) ? e.start : (e.end ?? e.start ?? '9999'))
  return saves.filter((e) => shelfOf(e, now) === 'later').sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.at - b.at))
}

/** The saves whose week has come: saved in an EARLIER week for a first day that now falls between
 *  today and the end of the served weekend, and not yet acknowledged this week. The quiet pill. */
export function arriving(state: { saves: SaveEntry[]; later: AccountState['later'] }, now: Date = new Date()): SaveEntry[] {
  const wk = weekOf(now.getTime())
  const end = upcomingWeekendEnd(now).getTime()
  const today = dayStart(now).getTime()
  return state.saves.filter((e) => {
    if (!e.start) return false
    const t = fromIso(e.start).getTime()
    if (t < today || t > end) return false
    if (weekOf(e.at) >= wk) return false              // saved this week — you already know
    return (state.later[e.id]?.seen ?? -1) < wk
  })
}

/** Past saves still waiting for their answer: ended before today, within the last three weeks
 *  (after that nobody remembers honestly), most recent first. */
export function lookBack(state: { saves: SaveEntry[]; went: AccountState['went'] }, now: Date = new Date()): SaveEntry[] {
  const today = dayStart(now).getTime()
  const floor = today - 21 * 864e5
  return state.saves
    .filter((e) => {
      const last = e.end ?? e.start
      if (!last || state.went[e.id]) return false
      const t = fromIso(last).getTime()
      return t < today && t >= floor
    })
    .sort((a, b) => ((b.end ?? b.start)! < (a.end ?? a.start)! ? -1 : 1))
}

/** THE MERGE — what two devices agree on when they have both written. Never loses a save (union;
 *  the earlier save moment wins); declines union within a week, else the newer week's; taste is the
 *  more recently updated document's, plus any token only the other one knows (two histories that
 *  grew apart each keep what they learned alone — a token both hold is not summed, so re-merging the
 *  same two documents is a no-op); an answer (went / seen) is deliberate, so the later one wins. */
export function mergeState(a: AccountState, b: AccountState): AccountState {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a]
  const saves = new Map<string, SaveEntry>()
  for (const e of [...newer.saves, ...older.saves]) {
    const prev = saves.get(e.id)
    if (!prev) saves.set(e.id, { ...e })
    else saves.set(e.id, { ...prev, ...(e.at < prev.at ? e : {}), start: prev.start ?? e.start, end: prev.end ?? e.end, link: prev.link ?? e.link, title: prev.title || e.title, when: prev.when || e.when })
  }
  const declines = a.declines.w === b.declines.w
    ? { w: a.declines.w, ids: [...new Set([...a.declines.ids, ...b.declines.ids])] }
    : (a.declines.w > b.declines.w ? a : b).declines
  const taste = { ...older.taste, ...newer.taste }
  const later: AccountState['later'] = {}
  for (const id of new Set([...Object.keys(a.later), ...Object.keys(b.later)])) {
    const sa = a.later[id]?.seen, sb = b.later[id]?.seen
    const seen = Math.max(sa ?? -1, sb ?? -1)
    later[id] = seen >= 0 ? { seen } : {}
  }
  const went: AccountState['went'] = {}
  for (const id of new Set([...Object.keys(a.went), ...Object.keys(b.went)])) {
    const wa = a.went[id], wb = b.went[id]
    went[id] = wa && wb ? (wb.at > wa.at ? wb : wa) : (wa ?? wb)
  }
  return {
    version: Math.max(a.version, b.version),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    saves: [...saves.values()].sort((x, y) => x.at - y.at),
    declines: { w: declines.w, ids: [...declines.ids] },
    taste, later, went,
  }
}

/** What a write compares: the content, never the server's stamps. */
export const fingerprint = (s: AccountState) =>
  JSON.stringify([s.saves, s.declines, s.taste, s.later, s.went])

/* ───────────────────────────────── the wire ───────────────────────────────── */

export type LoginResult = 'sent' | 'off' | 'bad' | 'slow' | 'error'

export async function requestLink(email: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${ACCOUNT_URL}/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, return: location.origin + location.pathname }),
    })
    if (res.status === 400) return 'bad'
    if (res.status === 429) return 'slow'
    if (!res.ok) return 'error'
    const j = (await res.json()) as { ok: boolean; delivery?: string }
    return j.delivery === 'off' ? 'off' : 'sent'
  } catch { return 'error' }
}

export async function exchangeCode(code: string): Promise<Session | null> {
  try {
    const res = await fetch(`${ACCOUNT_URL}/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    if (!res.ok) return null
    return (await res.json()) as Session
  } catch { return null }
}

const bearer = (s: Session) => ({ authorization: `Bearer ${s.session}` })

/** null = the session is dead (401) — sign out locally; undefined = network trouble, keep going. */
export async function fetchState(s: Session): Promise<AccountState | null | undefined> {
  try {
    const res = await fetch(`${ACCOUNT_URL}/state`, { headers: bearer(s) })
    if (res.status === 401) return null
    if (!res.ok) return undefined
    return { ...emptyState(), ...((await res.json()) as AccountState) }
  } catch { return undefined }
}

export type PutResult =
  | { ok: true; version: number; updatedAt: number }
  | { ok: false; conflict: true; version: number; state: AccountState }
  | { ok: false; conflict?: false; dead?: boolean }

export async function putState(s: Session, state: AccountState): Promise<PutResult> {
  try {
    const res = await fetch(`${ACCOUNT_URL}/state`, {
      method: 'PUT', headers: { 'content-type': 'application/json', ...bearer(s) },
      body: JSON.stringify({ version: state.version, state }),
    })
    if (res.status === 409) {
      const j = (await res.json()) as { version: number; state: AccountState }
      return { ok: false, conflict: true, version: j.version, state: { ...emptyState(), ...j.state } }
    }
    if (res.status === 401) return { ok: false, dead: true }
    if (!res.ok) return { ok: false }
    const j = (await res.json()) as { version: number; updatedAt: number }
    return { ok: true, version: j.version, updatedAt: j.updatedAt }
  } catch { return { ok: false } }
}

export async function logout(s: Session): Promise<void> {
  try { await fetch(`${ACCOUNT_URL}/logout`, { method: 'POST', headers: bearer(s) }) } catch { /* the local sign-out is the one that matters */ }
}

/* ───────────────────────────────── local persistence ───────────────────────────────── */

const KEY_SESSION = 'wkndr.account.v1'
const KEY_MIRROR = 'wkndr.account.state.v1'

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_SESSION) || 'null') as Session | null
    return s && typeof s.session === 'string' && typeof s.email === 'string' ? s : null
  } catch { return null }
}
export function persistSession(s: Session | null) {
  try { if (s) localStorage.setItem(KEY_SESSION, JSON.stringify(s)); else localStorage.removeItem(KEY_SESSION) } catch { /* private mode */ }
}
export function loadMirror(): AccountState {
  try {
    const m = JSON.parse(localStorage.getItem(KEY_MIRROR) || 'null') as Partial<AccountState> | null
    return m && typeof m === 'object' ? { ...emptyState(), ...m } : emptyState()
  } catch { return emptyState() }
}
export function persistMirror(m: AccountState) {
  try { localStorage.setItem(KEY_MIRROR, JSON.stringify(m)) } catch { /* ignore */ }
}
export function clearMirror() {
  try { localStorage.removeItem(KEY_MIRROR) } catch { /* ignore */ }
}

/** The magic link lands on the app with `#signin=<code>`. Read it once and scrub it from the
 *  bar, so a reload or a copied URL never replays it (it is one-time anyway). */
export function takeSigninCode(): string | null {
  const m = location.hash.match(/^#signin=([a-f0-9]{32})$/)
  if (!m) return null
  history.replaceState(null, '', location.pathname + location.search)
  return m[1]
}
