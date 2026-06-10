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
