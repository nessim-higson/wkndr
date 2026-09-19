// DAYLIGHT — where the sun is, for a place and a moment, and what that does to the pane.
//
// Ness (2026-09-18): "the condition of the weather is relative to the time of day… If it's raining
// during the day it's a bit brighter. If it's raining at night it's darker. BUT it's still raining.
// If it's a clear day and it's sunset, it should be golden hour."
//
// So: the WEATHER picks the plate (wetglass.ts) and the SUN grades it — exposure, the warmth of a
// low sun, the blue of night — and rain at 22:00 is dark rain, never a moon. Only a clear sky swaps
// plates with the hour (day → golden → dusk → night), because those really are different skies.
// Everything keys off the sun's ALTITUDE, not the clock: Amsterdam is light at 22:00 in June and
// dark at 17:00 in December, and the same code serves New Orleans.

export type Phase = 'night' | 'dawn' | 'golden' | 'day' | 'dusk'

export interface Daylight {
  /** the sun's altitude above the horizon, in degrees (negative = below it) */
  alt: number
  phase: Phase
  /** the sun is climbing — the morning side of the day */
  rising: boolean
  /** exposure on the plate: 1 by day, down to a night floor */
  light: number
  /** golden-hour warmth, 0..1 — peaks with the sun just above the horizon */
  gold: number
  /** civil twilight, 0..1 — a rose afterglow low in the frame, blue above */
  dusk: number
  /** the blue of night, 0..1 */
  night: number
}

/** The sun's altitude (degrees) at `date` for a place — the USNO approximate solar position, good
 *  to a fraction of a degree, which is all a sky grade needs. Longitude east-positive. */
export function sunAltitude(date: Date, lat: number, lon: number): number {
  const D = date.getTime() / 86400000 - 10957.5              // days since J2000.0
  const rad = Math.PI / 180
  const g = (357.529 + .98560028 * D) * rad                  // mean anomaly
  const q = 280.459 + .98564736 * D                          // mean longitude
  const L = (q + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * rad   // ecliptic longitude
  const e = (23.439 - .00000036 * D) * rad                   // obliquity of the ecliptic
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))       // right ascension
  const dec = Math.asin(Math.sin(e) * Math.sin(L))           // declination
  const gmst = 18.697374558 + 24.06570982441908 * D          // Greenwich sidereal time, hours
  const lst = ((gmst + lon / 15) % 24 + 24) % 24             // local sidereal time
  const ha = lst * 15 * rad - ra                             // hour angle
  const la = lat * rad
  return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) / rad
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/** The grade for a sun altitude. The curves overlap on purpose: the hour before sunset is warm and
 *  a little dim, the half hour after is rose low and blue high, and night settles in by −12°. */
export function gradeFor(alt: number, rising = false): Daylight {
  const phase: Phase = alt >= 8 ? 'day' : alt >= 0 ? 'golden' : alt >= -8 ? (rising ? 'dawn' : 'dusk') : 'night'
  const light = .26 + .24 * smooth(-12, -6, alt) + .3 * smooth(-6, 0, alt) + .2 * smooth(0, 12, alt)
  const gold = smooth(-4, 2, alt) * (1 - smooth(4, 12, alt)) * (rising ? .85 : 1)   // dawn runs cooler
  const dusk = smooth(-11, -5, alt) * (1 - smooth(-2, 3, alt))
  const night = 1 - smooth(-14, -5, alt)
  return { alt, phase, rising, light, gold, dusk, night }
}

export function daylightAt(date: Date, lat: number, lon: number): Daylight {
  const alt = sunAltitude(date, lat, lon)
  const later = sunAltitude(new Date(date.getTime() + 600_000), lat, lon)
  return gradeFor(alt, later > alt)
}

/** Fixed altitudes for the previews (Prototype settings, ?sun=). */
export const PHASE_ALT: Record<Phase, number> = { day: 35, golden: 2, dusk: -4, dawn: -4, night: -20 }
export const PHASES: Phase[] = ['day', 'golden', 'dusk', 'night', 'dawn']
export const PHASE_LABELS: Record<Phase, string> = { day: 'Day', golden: 'Golden hour', dusk: 'Dusk', dawn: 'Dawn', night: 'Night' }

/** `?at=19:40` — today, at that local time; anything unparseable is ignored. */
export function dateAtClock(at: string | null, now: Date = new Date()): Date | null {
  const m = at?.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const d = new Date(now)
  d.setHours(Math.min(23, +m[1]), Math.min(59, +m[2]), 0, 0)
  return d
}
