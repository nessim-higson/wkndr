// CURATE OVERRIDES — the app half of Track A (auto-compile fast-lane). The board POSTs your live
// curation (pile order, kills) to the wkndr-curate Worker; the app GETs it after loading the static
// picks.<city>.json and layers it on TOP — so a reorder / kill goes live in seconds, no human compile,
// no redeploy. The durable corpus compile still folds these in on the next refresh (this is the fast
// lane, corpus is the source of truth). See worker/curate/ for the storage contract.
import type { Pick } from '../types'

const CURATE_URL = 'https://wkndr-curate.ness-13b.workers.dev'

export type CurateOverrides = {
  generatedAt: string
  pile?: string[]
  killed?: { title: string; reason?: string }[]
  flags?: { title: string; reason?: string }[]
  at?: number
}

/** word-order-blind identity key — mirror of the board's tok() / pipeline tokKey so a pile title
 *  matches its feed pick even across small retitles (accents, "the", trailing years). */
const STOP = new Set(['the', 'a', 'an', 'de', 'het', 'een', 'at', 'in', 'on', 'of', 'and', 'en', 'bij', 'to', 'met', 'with', 'w', 'amsterdam', 'festival', 'back'])
export function tokKey(title: string): string {
  const x = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((y) => y && !STOP.has(y))
  return x.length >= 2 ? [...new Set(x)].sort().join(' ') : title.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Fetch this city's overrides (or null). Never throws — a dead worker just means "no overrides". */
export async function fetchOverrides(city: string): Promise<CurateOverrides | null> {
  try {
    const r = await fetch(`${CURATE_URL}/curate/${encodeURIComponent(city)}`, { cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json()) as CurateOverrides | null
  } catch {
    return null
  }
}

/** POST the board's live curation. Returns true on success. Never throws. */
export async function postOverrides(city: string, ov: CurateOverrides): Promise<boolean> {
  try {
    const r = await fetch(`${CURATE_URL}/curate/${encodeURIComponent(city)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ov),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Layer overrides onto the static feed. Pure + fail-soft: a null/stale override (feed rolled past
 *  the generatedAt it targets) returns the picks untouched. Mirrors restamp's taste layer:
 *   - killed  → dropped
 *   - pile    → those picks lead, in pile order (servePos re-stamped 1..N); the rest follow in their
 *               existing serve order, renumbered after the pile.
 *   - flags   → attached as `_flag` for the UI (not dropped). */
export function applyOverrides(picks: Pick[], ov: CurateOverrides | null, generatedAt: string): Pick[] {
  if (!ov || ov.generatedAt !== generatedAt) return picks

  const killed = new Set((ov.killed ?? []).map((k) => tokKey(k.title)))
  const flagOf = new Map((ov.flags ?? []).map((f) => [tokKey(f.title), f.reason ?? 'flagged'] as const))
  const pilePos = new Map((ov.pile ?? []).map((t, i) => [tokKey(t), i] as const))

  const kept = picks.filter((p) => !killed.has(tokKey(p.title)))

  // stable original order (by existing servePos, then untouched) — the tail after the pile
  const byServe = [...kept].sort((a, b) => (a.servePos ?? 1e9) - (b.servePos ?? 1e9))
  const pileLen = ov.pile?.length ?? 0
  let tailN = pileLen

  const stamped = byServe.map((p) => {
    const k = tokKey(p.title)
    const flag = flagOf.get(k)
    const inPile = pilePos.get(k)
    const servePos = inPile != null ? inPile + 1 : ++tailN
    return { ...p, servePos, ...(flag ? { _flag: flag } : {}) } as Pick
  })

  return stamped.sort((a, b) => (a.servePos ?? 1e9) - (b.servePos ?? 1e9))
}
