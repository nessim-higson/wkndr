import type { Mode } from '../../types'

// A pluggable ambient-field renderer. Each look owns its OWN canvas (appended into
// the host), runs its own RAF loop, and can be torn down independently — this keeps
// 2D and WebGL contexts from fighting over a shared canvas.
export interface LookRenderer {
  /** create + append OWN canvas (position:absolute; inset:0; width/height:100%), start RAF loop */
  mount(host: HTMLElement, mode: Mode): void
  /** recolor/recompose to the new weather */
  setMode(mode: Mode): void
  /** refit to host size */
  resize(): void
  /** cancel RAF, remove canvas, free GL */
  destroy(): void
  /** re-seed the generative composition (seeded looks only; no-op/absent otherwise) */
  reroll?(): void
  /** current seed of the generative composition (seeded looks only) */
  getSeed?(): number
  /** restore a specific seed — recomposes deterministically (seeded looks only) */
  setSeed?(seed: number): void
  /** the look's tunable knobs, rendered as sliders in the dev panel */
  params?(): LookParam[]
  setParam?(key: string, value: number): void
  /** measured draw rate (frame-capped looks only) */
  fps?(): number
}

// a tunable knob the dev panel renders as a slider
export interface LookParam {
  key: string
  label: string
  min: number
  max: number
  step: number
  value: number
}

// ~30fps frame gate for the canvas-2D looks — the ambient layer must never outdraw
// the swipe deck (same budget as Silk's FieldEngine). Call tick() each RAF; draw
// only when it returns true.
export class FrameCap {
  private acc = 0
  private last = 0
  private ema = 33.4
  tick(now: number): boolean {
    if (!this.last) { this.last = now; return true }
    this.acc += now - this.last
    this.last = now
    if (this.acc < 33) return false
    this.ema = this.ema * 0.9 + this.acc * 0.1
    this.acc = 0
    return true
  }
  get fps() { return Math.round(1000 / this.ema) }
  reset() { this.acc = 0; this.last = 0 }
}

// shared WKNDR Mode → source weather-key mapping helper. Each source names its keys
// slightly differently, so callers pass their own key set; the ordering is fixed.
export type WeatherKeys<K extends string> = {
  sun: K       // HOT
  wind: K      // WARM
  cloud: K     // COOL
  rain: K      // COLD_WET
  storm: K     // VOLATILE
}
export function modeToKey<K extends string>(mode: Mode, keys: WeatherKeys<K>): K {
  switch (mode) {
    case 'HOT': return keys.sun
    case 'WARM': return keys.wind
    case 'COOL': return keys.cloud
    case 'COLD_WET': return keys.rain
    case 'VOLATILE': return keys.storm
  }
}
