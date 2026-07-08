import type { Mode, Pick } from '../types'
import { tasteScore, type Taste } from '../taste'
import { upcomingWeekendEnd, whenActiveBy } from '../lib/when'

export const MODES: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']

export interface ModeMeta {
  label: string
  /** condition descriptor shown in the mono line */
  cond: string
  /** the emotional condition phrase (production: LLM narration) */
  phrase: string
  /** weather-field palette */
  field: { text: string; c1: string; c2: string; c3: string; glow: string }
}

// Palettes carried over from experiments/06-hybrid/02-weather-header-live.html
export const MODE_META: Record<Mode, ModeMeta> = {
  HOT: {
    label: 'Hot',
    cond: 'HOT · DRY · keep water close',
    phrase: 'It turns properly hot by two. Chase the shade, and keep water close.',
    field: { text: '#fbf7ef', c1: '#ff9a3d', c2: '#c2310e', c3: '#5a1606', glow: '#ffd166' },
  },
  WARM: {
    label: 'Warm',
    cond: 'WARM · DRY · gentle breeze',
    phrase: 'A soft, generous day — the kind that lets you choose your own adventure.',
    field: { text: '#fffdf6', c1: '#d8e08a', c2: '#6fa24a', c3: '#2c4a26', glow: '#fff0b0' },
  },
  COOL: {
    label: 'Cool',
    cond: 'COOL · CLEAR · crisp air',
    phrase: 'Crisp and clear. Layer up and the whole city is walkable.',
    field: { text: '#f4f8f7', c1: '#9fc0b8', c2: '#4a716b', c3: '#1e3433', glow: '#cfe6df' },
  },
  COLD_WET: {
    label: 'Cold & wet',
    cond: 'COLD · WET · an indoor day',
    phrase: 'Grey and wet through the afternoon. Today is an indoor day, well spent.',
    field: { text: '#eef2f7', c1: '#6c7e9c', c2: '#313f5e', c3: '#121a2e', glow: '#9fb2cc' },
  },
  VOLATILE: {
    label: 'Volatile',
    cond: 'VOLATILE · sun then storms',
    phrase: "It can't decide. Keep a backup plan and a rain layer in the bag.",
    field: { text: '#f6f1ee', c1: '#e08a4a', c2: '#7a5a7a', c3: '#2a3358', glow: '#ffcf8a' },
  },
}

/**
 * Rule-based classifier (thresholds from engine/weather-engine.ts).
 * Temperature gates the cold bucket — "wet" alone never means "cold". A warm rainy
 * day is changeable (VOLATILE: "keep a rain layer in the bag"), not COLD_WET.
 * HEAT leads the swing rule: hot climates swing 9–10° between night and day EVERY day
 * (New Orleans in June: 33°/23°), and that's just a hot day, not a volatile one —
 * the old swing-first rule painted a 33° header on a stormy purple field.
 */
export function classify(high: number, precipProb: number, swing: number): Mode {
  if (high < 10) return 'COLD_WET'                                  // genuinely cold
  if (precipProb > 65) return high < 16 ? 'COLD_WET' : 'VOLATILE'   // wet: cold→cold&wet, warm→changeable
  if (high >= 24) return 'HOT'                                      // heat leads — see note above
  if (swing >= 9) return 'VOLATILE'                                 // a true can't-decide day
  if (high >= 16) return 'WARM'
  if (high >= 10) return 'COOL'
  return 'WARM'
}

/** Push the mode palette into CSS custom properties on <html>. */
export function applyMode(mode: Mode) {
  const m = MODE_META[mode].field
  const r = document.documentElement
  r.setAttribute('data-mode', mode)
  r.style.setProperty('--field-text', m.text)
  r.style.setProperty('--field-1', m.c1)
  r.style.setProperty('--field-2', m.c2)
  r.style.setProperty('--field-3', m.c3)
  r.style.setProperty('--field-glow', m.glow)
}

/** Seeded shuffle (mulberry32) — deterministic per seed, for the Refresh action. */
export function shuffle<T>(arr: T[], seed: number): T[] {
  let s = seed >>> 0
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Weather × taste ranking. Ranks by weather-fit first (picks that peak in the current mode),
 * then nudges fresh / ending-soon up, plus the taste term.
 *
 * `seed` adds a deterministic per-pick jitter so "Show me more" genuinely reshuffles WHICH
 * picks lead — without it the same high-scorers always surfaced first ("same stuff comes
 * back"). The jitter (±~3.5) reorders within the weather-fit tier but never lifts a non-fit
 * pick above the fit ones (+10), so it stays weather-appropriate.
 */
function jitter(id: string, seed: number): number {
  let h = (seed * 2654435761) >>> 0
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0
  return (h >>> 8) / 16777216   // 0..1, stable per (id, seed)
}
// Editorial-quality weight: the build-time judge (scripts/adapters/editor.ts) scores live picks 0..10;
// scaled to ~0..5 here so a genuinely-better event leads WITHIN its weather tier. Like taste (also a
// sub-term, cap 6), a very high editor score can occasionally cross the +10 weather boundary — weather-fit
// is the strong default, NOT a hard lock. Undefined editorScore (canon, or no judge run) → 0 → today's
// behaviour. (If weather should ever be a HARD gate, make the +10 an outer tier — a deliberate change.)
const EDITOR_W = 0.5
// The evergreen FLOOR: how strongly an always-good canon pick competes with timely events. Was an inline
// 0.6 in freshBoost; named here as the single legible knob (raise → classics surface more on quiet weeks).
const EVERGREEN_FLOOR = 0.6
export function rankPicks(picks: Pick[], mode: Mode, taste?: Taste, seed = 0): Pick[] {
  const freshBoost = (p: Pick) =>
    p.freshness === 'new' ? 1.5 : p.freshness === 'ending' ? 1.2 : p.freshness === 'weekend' ? 1 : EVERGREEN_FLOOR
  // cross-source corroboration — an event INDEPENDENTLY surfaced by 2+ sources (I amsterdam AND web-search
  // AND an editorial guide…) is the "most talked about" signal; weight it steeply so those lead their tier:
  // 2 sources → +1.5, 3 → +3, 4+ → +4 (capped). Single-source picks are unaffected.
  const buzzBoost = (p: Pick) => Math.min(4, Math.max(0, (p.buzz ?? 0) - 1) * 1.5)
  // real-draw signal (e.g. RA "attending") on a log curve so 50 vs 500 separates but a mega-event can't run
  // away — a within-tier sub-term capped ~2.5, like buzz. Only picks that carry popularity get the bump.
  const popBoost = (p: Pick) => (p.popularity ? Math.min(2.5, Math.log10(p.popularity + 1)) : 0)
  const score = (p: Pick) =>
    (p.weatherFit.includes(mode) ? 10 : 0) + freshBoost(p) + buzzBoost(p) + popBoost(p)
    + (p.editorScore ?? 0) * EDITOR_W
    + (taste ? tasteScore(p, taste) : 0) + (seed ? jitter(p.id, seed) * 3.5 : 0)
  // Pure score order. De-clustering used to run HERE (diversify), but App.tsx re-segments the deck into
  // [live, canonSlice] afterward, which discarded it (→ category "waves"). diversify is now exported and
  // applied to the ACTUAL served sequence in App.tsx instead.
  return [...picks].sort((a, b) => score(b) - score(a))
}

/**
 * De-cluster by category so the feed never serves a run of the same thing (e.g. five
 * museums in a row). Greedy: always take the highest-ranked pick whose category differs
 * from the one just placed — keeps score order roughly intact while interleaving.
 */
export function diversify(ranked: Pick[]): Pick[] {
  const out: Pick[] = []
  const pool = [...ranked]
  while (pool.length) {
    const prev = out[out.length - 1]?.category
    let i = pool.findIndex((p) => p.category !== prev)
    if (i === -1) i = 0   // only the same category left — take it
    out.push(pool.splice(i, 1)[0])
  }
  return out
}

/**
 * THE PILE ORDER — Ness's curation tiers decide who opens the deck, everything else keeps its
 * diversified order: 👑 TOP (permanent escalation) → ▲ LEAD (this weekend's slate) → the ranked
 * middle → ▼ LATER (this weekend's "not now" — published, but at the back). Stable partition.
 *
 * The 👑 tier is TIME-GATED: a TOP only opens the deck once its event is active by the end of
 * the weekend being served ("Opens 8 Jul" / "Daily" lead now; a festival TOPped weeks ahead rides
 * the ranked middle — pill intact — until its own weekend). The deck must lead with THIS weekend.
 */
export function orderServed(arr: Pick[], end: Date = upcomingWeekendEnd()): Pick[] {
  const opens = (p: Pick) => !!p.top && whenActiveBy(p.when, end)
  return [
    ...arr.filter(opens),
    ...arr.filter((p) => !opens(p) && p.lead),
    ...arr.filter((p) => !opens(p) && !p.lead && !p.later),
    ...arr.filter((p) => !opens(p) && !p.lead && p.later),
  ]
}
