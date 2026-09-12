import type { Mode } from '../types'
import type { WeekendWx } from './modes'

export const GLASS_SCENES = ['sunny', 'overcast', 'rain', 'mist', 'snow', 'storm', 'mixed', 'evening'] as const
export type GlassScene = typeof GLASS_SCENES[number]
export const GLASS_LABELS: Record<GlassScene, string> = {
  sunny: 'Open sky', overcast: 'Overcast', rain: 'Rain', mist: 'Soft fog',
  snow: 'Snow', storm: 'Storm', mixed: 'Passing front', evening: 'Evening',
}

/** 2026-09: this is a material study, not a new classifier. A cold, dry day also
 *  classifies COLD_WET; don't paint rain when the actual probability says dry.
 *  The daily contract cannot establish fog, snow, lightning or time of day. Those
 *  remain explicitly labelled appearance previews, never inferred live weather. */
export function glassScene(mode: Mode, pop?: number): GlassScene {
  if (pop != null && Number.isFinite(pop) && pop >= 80) return 'rain'
  if (mode === 'COLD_WET') return pop != null && pop < 40 ? 'overcast' : 'rain'
  if (mode === 'VOLATILE' || (pop != null && Number.isFinite(pop) && pop >= 40)) return 'mixed'
  return mode === 'COOL' ? 'overcast' : 'sunny'
}

export function glassSummary(mode: Mode, weekend: WeekendWx | null, live: boolean, pop?: number): string {
  if (!live) return 'Waiting for the weekend forecast.'
  if (weekend?.split) return weekend.days.map(d => `${d.label} ${d.hi}° · ${d.pop}% rain chance`).join(' / ')
  if (pop != null && Number.isFinite(pop) && pop >= 40) return 'Keep an indoor idea for the weekend.'
  if (mode === 'COLD_WET' || mode === 'COOL') return 'A cooler weekend. Bring a layer.'
  if (mode === 'HOT') return 'A hot weekend. Leave room for shade.'
  if (mode === 'VOLATILE') return 'A changeable weekend. Keep your plans flexible.'
  return 'A little time outside this weekend.'
}
