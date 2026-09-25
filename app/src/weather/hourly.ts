// THE HOURS OF THE WEEKEND — what the time scrubber reads (2026-09-20).
//
// Ness: "it would be very interesting to have a slider for time of the day, and see the weather
// change and the cards associated with that weather recommendation come forward."
//
// Open-Meteo's hourly forecast gives each hour a temperature, a rain chance and a weather code.
// This file turns that into the STOPS of the weekend being served — Sat 06:00 → Sun 23:00 in the
// city's own clock — and gives each stop the two things the app runs on: the SCENE the pane
// paints (the same code table the live reading uses) and the ranking MODE the deck is scored
// against (`modeForHour`: the hour's own rain gates, then modes.ts `classify` for the temperature). The sun is not here: daylight.ts grades the sky from the
// stop's timestamp, so Saturday 21:00 is dusk because of where the sun is, not because a table says so.
//
// Honesty: a stop is a FORECAST for that hour, labelled as one in the header while scrubbed. The
// hand pile still ignores the weather by design; the scrub deck shows the weather's own order.
import { classify } from './modes'
import type { Mode } from '../types'
import type { GlassScene } from './glass'

export interface HourWx {
  /** epoch ms of the start of the hour */
  time: number
  /** the CITY's wall clock for that hour: day of week (0 Sun … 6 Sat) and hour of day */
  dow: number
  hour: number
  temp: number
  /** precipitation probability, % */
  pop: number
  /** WMO weather code */
  code: number
}
export interface HourReading extends HourWx { scene: GlassScene; sky: string; mode: Mode; clock: string }

export function decodeHourly(data: unknown): HourWx[] {
  const d = data as { utc_offset_seconds?: number; hourly?: { time?: number[]; temperature_2m?: number[]; precipitation_probability?: (number | null)[]; weather_code?: number[] } } | null
  const h = d?.hourly
  if (!h || !Array.isArray(h.time) || !Array.isArray(h.temperature_2m) || !Array.isArray(h.weather_code)) return []
  const off = typeof d?.utc_offset_seconds === 'number' && Number.isFinite(d.utc_offset_seconds) ? d.utc_offset_seconds : 0
  const out: HourWx[] = []
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i], temp = h.temperature_2m[i], code = h.weather_code[i]
    if (![t, temp, code].every((x) => typeof x === 'number' && Number.isFinite(x))) continue
    const local = new Date((t + off) * 1000)   // read with the UTC getters = the city's wall clock
    const pop = h.precipitation_probability?.[i]
    out.push({ time: t * 1000, dow: local.getUTCDay(), hour: local.getUTCHours(), temp, pop: Math.round(typeof pop === 'number' ? pop : 0), code })
  }
  return out
}

/** The scene a weather code paints. A clear or partly-cloudy hour is the open sky (its scattered
 *  cumulus IS partly cloudy); partly cloudy with a real chance of a shower is the passing front. */
export function skyForCode(code: number, pop = 0): { scene: GlassScene; sky: string } {
  if ([95, 96, 99].includes(code)) return { scene: 'storm', sky: 'Thunderstorms' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { scene: 'snow', sky: 'Snow' }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { scene: 'rain', sky: 'Rain' }
  if ([45, 48].includes(code)) return { scene: 'mist', sky: 'Fog' }
  if (code === 3) return { scene: 'overcast', sky: 'Cloudy' }
  if (code === 2) return { scene: pop >= 35 ? 'mixed' : 'sunny', sky: 'Partly cloudy' }
  return { scene: 'sunny', sky: 'Clear' }
}

/** The ranking mode for ONE hour. classify() reads a DAY: its rain gates (65 / 80) are for a day's
 *  MAXIMUM chance, and an hour's chance runs far lower for the same weather — a 55% hour is a wet
 *  hour. The first cut fed hours through the day's gates and a whole mild, showery weekend ranked
 *  "warm" at every stop: the sky moved and the cards never did. So the hour gets its own rain gates
 *  (and a code that says it is raining settles it); classify keeps the temperature bands. */
const WET_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]
export function modeForHour(h: { temp: number; pop: number; code?: number }): Mode {
  if (h.pop >= 60 || (h.code != null && WET_CODES.includes(h.code))) return 'COLD_WET'
  if (h.pop >= 35) return h.temp < 16 ? 'COLD_WET' : 'VOLATILE'
  return classify(Math.round(h.temp), 0, 0)
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const read = (h: HourWx): HourReading => ({ ...h, ...skyForCode(h.code, h.pop), mode: modeForHour(h), clock: `${DOW[h.dow]} ${String(h.hour).padStart(2, '0')}:00` })

/** Every hour of the weekend being served, Sat 06:00 → Sun 23:00 (42 stops). On a weekday that is
 *  the coming weekend; on Saturday or Sunday it is THIS one, the hours already gone included. */
export const WEEKEND_STOPS = 42
export function weekendStops(hours: HourWx[], now: number = Date.now()): HourReading[] {
  for (let i = 0; i < hours.length; i++) {
    if (hours[i].dow !== 6 || hours[i].hour !== 6) continue
    const run = hours.slice(i, i + WEEKEND_STOPS)
    if (run.length < 12) continue
    if (run[run.length - 1].time + 3_600_000 >= now) return run.map(read)   // this weekend is not over yet
  }
  return []
}

/** the stop that contains `now`, or -1 when now is outside the weekend */
export function nowStop(stops: HourWx[], now: number = Date.now()): number {
  return stops.findIndex((s) => now >= s.time && now < s.time + 3_600_000)
}
