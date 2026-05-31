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

export function applySwipe(taste: Taste, p: Pick, dir: SwipeDir): Taste {
  const delta = dir === 'save' ? 1.5 : dir === 'like' ? 1 : dir === 'nope' ? -1 : 0
  if (!delta) return taste
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
    .slice(0, n)
    .map(([k]) => k.replace(/^cat:|^area:|^src:|^wf:/, '').replace('outdoor', 'outdoor').replace('kid', 'kids'))
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
