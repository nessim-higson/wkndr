import type { Pick, SwipeDir } from './types'

// A light, interpretable taste model: weights over the tags your swipes touch.
// like/save = positive signal, nope = negative, skip = neutral. The ranker adds
// a pick's summed tag-weight as a "taste" term (see rankPicks). This is the seed
// of the Phase-4 learning loop — readable on purpose (no black box).
export type Taste = Record<string, number>

const KEY_SAVED = 'wkndr.saved.v1'
const KEY_TASTE = 'wkndr.taste.v1'

/** The tags a pick contributes to / is judged on. */
export function tokensFor(p: Pick): string[] {
  const t = [`cat:${p.category}`, `area:${p.area}`, `src:${p.source}`]
  if (p.outdoor) t.push('outdoor')
  if (p.kid) t.push('kid')
  for (const w of p.weatherFit) t.push(`wf:${w}`)
  return t
}

const deltaFor = (dir: SwipeDir): number =>
  dir === 'save' ? 1.5 : dir === 'like' ? 1 : dir === 'nope' ? -1 : 0

export function applySwipe(taste: Taste, p: Pick, dir: SwipeDir): Taste {
  const delta = deltaFor(dir)
  if (!delta) return taste
  const next = { ...taste }
  for (const tok of tokensFor(p)) next[tok] = (next[tok] || 0) + delta
  return next
}

/** Exact inverse of applySwipe — Undo calls this so a mis-swipe doesn't bias the
 *  model forever. Tokens that land back on 0 are dropped, so undoing your only
 *  swipe leaves the profile genuinely empty (hasTaste stays honest). All deltas
 *  are multiples of 0.5 (exact in floats), so the ===0 check is safe. */
export function revertSwipe(taste: Taste, p: Pick, dir: SwipeDir): Taste {
  const delta = deltaFor(dir)
  if (!delta) return taste
  const next = { ...taste }
  for (const tok of tokensFor(p)) {
    const v = (next[tok] || 0) - delta
    if (v === 0) delete next[tok]
    else next[tok] = v
  }
  return next
}

// "MORE LIKE THIS" (V.9.3) — the detail sheet's explicit ask, the strongest positive
// signal the app can receive: 2× a save, per token. Kept a multiple of 0.5 so the
// revert's ===0 drop stays float-exact (same contract as revertSwipe).
const MORE_LIKE_DELTA = 3

export function applyMoreLikeThis(taste: Taste, p: Pick): Taste {
  const next = { ...taste }
  for (const tok of tokensFor(p)) next[tok] = (next[tok] || 0) + MORE_LIKE_DELTA
  return next
}

/** Exact inverse of applyMoreLikeThis — the same undo-symmetry contract as revertSwipe:
 *  tokens that land back on 0 are dropped, so reverting against a fresh profile leaves it
 *  genuinely empty (hasTaste stays honest). */
export function revertMoreLikeThis(taste: Taste, p: Pick): Taste {
  const next = { ...taste }
  for (const tok of tokensFor(p)) {
    const v = (next[tok] || 0) - MORE_LIKE_DELTA
    if (v === 0) delete next[tok]
    else next[tok] = v
  }
  return next
}

// CALIBRATION (the "Tune WKNDR" dev prototype) — the micro-deck's per-card write.
// Deliberately heavy: eight cards must visibly bend the deck. A yes counts like an
// explicit "more like this" (+3/token); a no is 2× a nope (−2/token). Multiples of
// 0.5, keeping the float-exact ===0 contract shared with the revert helpers.
export function applyCalibration(taste: Taste, p: Pick, liked: boolean): Taste {
  const delta = liked ? 3 : -2
  const next = { ...taste }
  for (const tok of tokensFor(p)) next[tok] = (next[tok] || 0) + delta
  return next
}

/** Summed tag-weight for a pick, clamped so taste reorders within — but rarely
 *  overpowers — the weather term (10). */
export function tasteScore(p: Pick, taste: Taste): number {
  let s = 0
  for (const tok of tokensFor(p)) s += taste[tok] || 0
  return Math.max(-5, Math.min(6, s))
}

export const hasTaste = (t: Taste): boolean => Object.keys(t).length > 0

/** A human-readable read of what it's learned (for a "why" / debug surface). */
export function topTastes(taste: Taste, n = 3): string[] {
  return Object.entries(taste)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k.replace(/^cat:|^area:|^src:|^wf:/, ''))
    .filter((label) => label)   // inert empty tags (e.g. calibration's blank area/src) never render
    .slice(0, n)
    .map((l) => (l === 'kid' ? 'kids' : l))
}

// ── persistence (localStorage; device-local, no backend) ──
export function loadSaved(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY_SAVED) || '[]')) } catch { return new Set() }
}
export function persistSaved(s: Set<string>) {
  try { localStorage.setItem(KEY_SAVED, JSON.stringify([...s])) } catch { /* ignore */ }
}
export function loadTaste(): Taste {
  try { return JSON.parse(localStorage.getItem(KEY_TASTE) || '{}') } catch { return {} }
}
export function persistTaste(t: Taste) {
  try { localStorage.setItem(KEY_TASTE, JSON.stringify(t)) } catch { /* ignore */ }
}
