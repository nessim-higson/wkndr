// THE RELAY — the client half of WKNDR's first backend (/relay: a tiny Cloudflare Worker +
// KV). It exists for ONE moment: the boomerang's return leg. Field failure 2026-07-11 — the
// partner finished her match round and never pasted the link back, so the round-trip died on
// a manual step. Now the invite link carries a round id (`&r=`), the recipient's matches POST
// to the relay under it as they swipe, and the sender's app polls GET until they land — then
// jumps to the exact `?w=…&m=1` confirm the manual link-back produces. One greeting path.
// Privacy-light: the relay stores ONLY short pick-codes + a first name, under an unguessable
// id, for 14 days. The manual "Send your matches" button stays as the fallback throughout.
// LIVE since V.9.7 (worker deployed 2026-07-12) — set to '' to turn the whole relay path off
// (links drop `&r=`, nothing posts or polls; the manual boomerang is all that remains).
const RELAY_URL: string = 'https://wkndr-relay.nessimhigson.workers.dev'

export const relayOn = () => RELAY_URL !== ''

/** what GET /r/<id> returns once the partner's matches have landed */
export type RoundReturn = { codes: string[]; name: string; done?: boolean; at?: number }
/** a sent-round breadcrumb the sender's app polls for (localStorage `wkndr.rounds`) */
export type SentRound = { r: string; at: number }

export const ROUND_TTL_MS = 14 * 86_400_000   // stop polling when the worker's KV TTL has passed
export const ROUND_STALE_MS = 10 * 60_000     // partial matches count once the round looks abandoned

/** unguessable 10-char base36 round id — the id IS the secret (the relay is account-less) */
export function newRoundId(): string {
  const b = new Uint8Array(10)
  crypto.getRandomValues(b)
  return [...b].map((x) => (x % 36).toString(36)).join('')
}

// ————— pure bookkeeping (tested in tests/relay.test.ts; the storage wrappers below stay thin)

export function addRound(list: SentRound[], r: string, now: number): SentRound[] {
  return list.some((s) => s.r === r) ? list : [...list, { r, at: now }]
}
export function dropRound(list: SentRound[], r: string): SentRound[] {
  return list.filter((s) => s.r !== r)
}
export function pruneRounds(list: SentRound[], now: number): SentRound[] {
  return list.filter((s) => now - s.at < ROUND_TTL_MS)
}
/** surface the match moment when the round is DONE — or has matches but looks abandoned
 *  (no write for 10min: the exact field-failure this relay was built for) */
export function roundReady(res: RoundReturn, now: number): boolean {
  return res.codes.length > 0 && (!!res.done || now - (res.at ?? now) > ROUND_STALE_MS)
}

// ————— sent-round persistence (sender side)

const KEY = 'wkndr.rounds'
function read(): SentRound[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown
    return Array.isArray(raw)
      ? (raw as SentRound[]).filter((s) => s && typeof s.r === 'string' && typeof s.at === 'number')
      : []
  } catch { return [] }
}
function write(list: SentRound[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* private mode */ }
}

/** the rounds still worth polling (client-side prune mirrors the KV TTL) */
export function sentRounds(): SentRound[] { return pruneRounds(read(), Date.now()) }
/** the link left the building (copy/share resolved) — start polling for its return */
export function rememberSentRound(r: string) { write(addRound(sentRounds(), r, Date.now())) }
/** round-tripped (or finished empty) — stop polling it */
export function resolveSentRound(r: string) { write(dropRound(read(), r)) }

// ————— the wire (both fire-and-forget: relay unreachable ⇒ the manual link-back still works)

/** recipient side: post the running match set (done:true when the round completes) */
export async function postRound(r: string | undefined, codes: string[], name: string, done: boolean): Promise<void> {
  if (!relayOn() || !r) return
  try {
    await fetch(`${RELAY_URL}/r/${r}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codes, name, done }),
    })
  } catch { /* offline / relay down — nothing lost, the button fallback remains */ }
}

/** sender side: has the boomerang come back? */
export async function fetchRound(r: string): Promise<RoundReturn | null> {
  if (!relayOn()) return null
  try {
    const res = await fetch(`${RELAY_URL}/r/${r}`)
    if (!res.ok) return null
    const j = (await res.json()) as RoundReturn
    return j && Array.isArray(j.codes) ? j : null
  } catch { return null }
}
