// CURATE OVERRIDES — the app half of Track A (auto-compile fast-lane). The board POSTs your live
// curation (pile order, kills) to the wkndr-curate Worker; the app GETs it after loading the static
// picks.<city>.json and layers it on TOP — so a reorder / kill goes live in seconds, no human compile,
// no redeploy. The durable corpus compile still folds these in on the next refresh (this is the fast
// lane, corpus is the source of truth). See worker/curate/ for the storage contract.
import type { Pick } from '../types'

const CATEGORIES = new Set(['out','eat','drink','art','live','stage','daytrip','market','shop'])

const CURATE_URL = 'https://wkndr-curate.ness-13b.workers.dev'

/** A pick Ness pasted into the board's DROP box (Instagram/TikTok/X link → extracted server-side).
 *  Thin by design — the worker sends what a post actually carries, and buildAdded fills the rest. */
export type AddedPick = {
  title: string
  link: string
  image?: string
  blurb?: string
  venue?: string
  when?: string
  category?: string
  source?: string
}

export type CurateOverrides = {
  generatedAt: string
  pile?: string[]
  killed?: { title: string; reason?: string }[]
  flags?: { title: string; reason?: string }[]
  added?: AddedPick[]
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

/** Inflate a pasted pick into a full Pick.
 *  The `drop-` id prefix is deliberate: the airlock audits `web-`/`llm-`/`rss-`/`sk-` ids, because
 *  those come from crawls and need a board approval to go live. A drop IS the approval — Ness
 *  pasted it by hand — so it sits outside that check rather than sneaking past it.
 *  `when` is left empty: a social post rarely states its own date, and when.ts treats an empty
 *  string as evergreen (neither past nor broken), so the pick survives the runtime date guard. */
function buildAdded(a: AddedPick, i: number): Pick {
  return {
    id: `drop-${i}-${tokKey(a.title).replace(/\s+/g, '-').slice(0, 40)}`,
    title: a.title,
    venue: a.venue ?? '',
    area: '',
    when: a.when ?? '',
    // The roundup reader classifies each listing; honour it. Hardcoding 'out' made every dropped
    // pick share one poster treatment and defeated the deck's category de-clustering.
    category: (CATEGORIES.has(a.category ?? '') ? a.category : 'out') as Pick['category'],
    freshness: 'new',
    outdoor: false,
    kid: false,
    price: '',
    image: a.image,
    blurb: a.blurb ?? '',
    why: 'You dropped this in.',
    source: a.source ?? 'Dropped in',
    link: a.link,
    // No forecast data on a pasted post, so it fits every mode rather than being ranked down in
    // one. It leads on pilePos anyway — the board puts a fresh drop at the top of the pile.
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  }
}

/** Layer overrides onto the static feed. Pure + fail-soft: a null/stale override (feed rolled past
 *  the generatedAt it targets) returns the picks untouched. Mirrors restamp's taste layer:
 *   - killed  → dropped
 *   - added   → pasted picks injected (deduped against the feed, and skipped if also killed)
 *   - pile    → those picks lead, in pile order — stamped onto `pilePos`, the app's hand-drag override
 *               (weather/modes.ts orderServed deals pilePos-first, above every tier). The override's
 *               pile REPLACES any pilePos the last restamp left, so it fully controls the opening.
 *   - flags   → attached as `_flag` for the UI (not dropped).
 *  The app re-orders by pilePos itself, so this only re-stamps — no sort needed. */
export function applyOverrides(picks: Pick[], ov: CurateOverrides | null, generatedAt: string): Pick[] {
  if (!ov || ov.generatedAt !== generatedAt) return picks

  const killed = new Set((ov.killed ?? []).map((k) => tokKey(k.title)))
  const flagOf = new Map((ov.flags ?? []).map((f) => [tokKey(f.title), f.reason ?? 'flagged'] as const))
  const pilePos = new Map((ov.pile ?? []).map((t, i) => [tokKey(t), i] as const))
  const hasPile = pilePos.size > 0

  const kept = picks.filter((p) => !killed.has(tokKey(p.title)))

  // Drops the feed doesn't already carry. A drop that duplicates a real pick loses to the real one
  // (it has dates, a venue and a judged score); a drop that was also cancelled this round stays out.
  const seen = new Set(kept.map((p) => tokKey(p.title)))
  const extra: Pick[] = []
  for (const a of ov.added ?? []) {
    const k = tokKey(a.title)
    if (!a.title || !a.link || killed.has(k) || seen.has(k)) continue
    seen.add(k)
    extra.push(buildAdded(a, extra.length))
  }

  return [...kept, ...extra].map((p) => {
    const k = tokKey(p.title)
    const flag = flagOf.get(k)
    const pp = pilePos.get(k)
    // when a pile is present it OWNS the hand order: matched picks get their new slot, everyone else
    // clears (so a prior restamp's pilePos can't linger). No pile → leave pilePos untouched.
    const next: Pick = { ...p }
    if (hasPile) next.pilePos = pp != null ? pp + 1 : undefined
    if (flag) (next as Pick & { _flag?: string })._flag = flag
    return next
  })
}
