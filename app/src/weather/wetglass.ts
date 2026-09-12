// WET GLASS — the recipe half of the weather-glass field (2026-09-12, picking up codex/weather-glass).
//
// The comps that sold this direction had one thing the first build did not: the WINDOW. Rain was
// water on the pane between you and the sky — beads that lens the sky behind them, trails where a
// drop ran, a milky condensation the drops cut through — not raindrops stuck onto a photograph.
// The first build drew 96 CSS ellipses on top of a filtered sky and it read as stickers.
//
// This file is the pure, testable half: which PLATE each scene shows and how WET the pane is. The
// rendering half (WetGlassPane.ts) is a WebGL2 fragment shader that draws the plate THROUGH the
// glass: two grids of beads (each refracts the plate), a trail grid, a condensation blur, a snow
// layer. Static by default — a still frame is a still photograph of wet glass — motion is opt-in.
//
// Honesty, unchanged from the branch: plates are illustrative skies, never a claim that THIS cloud
// is overhead; the live weather code picks the scene, the scene picks the plate and the wetness.
import type { GlassScene } from './glass'
import openSky from '../assets/atmosphere/open-sky.webp'
import overcast from '../assets/atmosphere/overcast.webp'
import passingFront from '../assets/atmosphere/passing-front.webp'
import rainSky from '../assets/atmosphere/rain.webp'
import stormSky from '../assets/atmosphere/storm.webp'
import fogSky from '../assets/atmosphere/fog.webp'
import snowSky from '../assets/atmosphere/snow.webp'
import eveningSky from '../assets/atmosphere/evening.webp'

export interface WetRecipe {
  /** the photographic plate behind the glass */
  plate: string
  /** 0..1 — how many beads sit on the pane (two grids: large + fine) */
  drops: number
  /** 0..1 — how many beads have RUN, leaving a streak of smaller beads above them */
  trails: number
  /** 0..1 — condensation: a blur of the plate + a milky cast the beads cut through */
  fog: number
  /** 0..1 — flakes in the air (drawn in front of the plate, never on the glass) */
  snow: number
  /** brightness multiplier on the plate — the scene's light, not a CSS filter */
  dim: number
  /** the cast the condensation takes (RGB 0..1) */
  tint: [number, number, number]
}

export const WET_RECIPES: Record<GlassScene, WetRecipe> = {
  sunny:    { plate: openSky,      drops: 0,    trails: 0,   fog: 0,    snow: 0, dim: 1,    tint: [.93, .96, 1] },
  overcast: { plate: overcast,     drops: 0,    trails: 0,   fog: .12,  snow: 0, dim: .96,  tint: [.9, .92, .93] },
  mist:     { plate: fogSky,       drops: .18,  trails: 0,   fog: .9,   snow: 0, dim: 1.02, tint: [.94, .95, .94] },
  rain:     { plate: rainSky,      drops: .72,  trails: .6,  fog: .38,  snow: 0, dim: .86,  tint: [.78, .84, .9] },
  storm:    { plate: stormSky,     drops: 1,    trails: .9,  fog: .32,  snow: 0, dim: .84,  tint: [.62, .7, .8] },
  mixed:    { plate: passingFront, drops: .3,   trails: .25, fog: .16,  snow: 0, dim: .95,  tint: [.86, .9, .95] },
  snow:     { plate: snowSky,      drops: .08,  trails: 0,   fog: .45,  snow: 1, dim: 1.02, tint: [.95, .96, .98] },
  evening:  { plate: eveningSky,   drops: 0,    trails: 0,   fog: .06,  snow: 0, dim: .92,  tint: [.5, .55, .7] },
}

/** Where the beads sit. Stable for a SESSION (no reshuffle on a swipe or a save) but different
 *  from one day to the next, so two rainy Saturdays are two different panes. Hour-grained: a
 *  reload within the hour shows the same glass — the field must never look random. */
export function seedForNow(now: Date = new Date()): number {
  const h = now.getFullYear() * 1e6 + (now.getMonth() + 1) * 1e4 + now.getDate() * 1e2 + now.getHours()
  let x = (h ^ 0x9e3779b9) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296 * 1000
}

/** Can this device draw the pane? WebGL2 is universal on anything that runs the app (iOS 15+);
 *  when it is missing the CSS field stays, exactly as the branch shipped it. */
export function wetGlassSupported(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch { return false }
}
