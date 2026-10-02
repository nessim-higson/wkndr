// THE SKY RIGHT NOW — observed, not forecast (2026-10-02).
//
// Ness, under a blue sky, looking at the app's grey one: "Why is this returning a cloudy sky?" Because the
// header read Open-Meteo's `current`, which is not an observation: it is a 15-minute slice of a forecast
// MODEL (KNMI Harmonie for the Netherlands), and that afternoon the model had an 87% low-cloud deck over
// Amsterdam that was not there. Schiphol reported FEW029; the satellite measured full sun.
//
// Measured over 22 days of dry daytime hours against satellite-observed sunshine, the old rule ("code 3 =
// Cloudy") picked the right sky 66% of the time and showed grey in 12 of 33 genuinely sunny hours. Two
// causes: the model misplaces low cloud, and WMO code 3 is derived from TOTAL cover, so high cloud the sun
// shines through reads as a blanket. The rule below was scored on the same hours: 86% right, grey in 2 of
// the 33 sunny hours.
//
//   1. WEATHER (rain, snow, fog, thunder) is what Schiphol's observer reports, when a report is at hand.
//   2. LOW CLOUD is what Schiphol reports: broken or overcast below ~5,000 ft is a grey sky. (In three weeks
//      a BKN report never once coincided with a sunny hour.)
//   3. Otherwise the SUN decides: the last complete hour of satellite-measured radiation at this spot.
//      Strong direct sun → open sky. Dim, diffuse light → grey (the mid and high decks a METAR cannot see).
//   4. Only when that hour was in-between does the FORECAST get a say, and then on its low and mid layers,
//      not on total cover.
//   5. At night, or with no observation at all, it is rule 2 and then the forecast's layers.
//
// Everything here is pure; the fetching lives in components/useCurrentWeather.
export type Sky = 'clear' | 'night' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm'
export interface CurrentWeather {
  sky: Sky; temperature: number; time: number; label: string
  /** the forecast model's WMO code (kept for the record; the sky no longer follows it alone) */
  code: number
  /** 'observed' when a station report or the satellite decided the sky; 'forecast' when only the model did */
  basis: 'observed' | 'forecast'
  /** one line for the header's tooltip: what the reading stands on */
  note: string
}

// ─── the forecast model (Open-Meteo `current`) ────────────────────────────────
export interface ModelNow { time: number; temperature: number; code: number; isDay: boolean; low: number | null; mid: number | null }
const STORM = [95, 96, 99], SNOW = [71, 73, 75, 77, 85, 86], RAIN = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], FOG = [45, 48]
const KNOWN = [0, 1, 2, 3, ...STORM, ...SNOW, ...RAIN, ...FOG]

export function decodeModel(data: unknown, now = Date.now()): ModelNow | null {
  const c = (data as { current?: Record<string, unknown> } | null)?.current
  if (!c || typeof c.time !== 'number' || typeof c.temperature_2m !== 'number' || typeof c.weather_code !== 'number' || ![0, 1].includes(c.is_day as number)) return null
  if (![c.time, c.temperature_2m, c.weather_code].every(Number.isFinite)) return null
  const time = c.time * 1000
  if (now - time > 45 * 60_000 || time - now > 5 * 60_000) return null
  if (!KNOWN.includes(c.weather_code)) return null
  const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return { time, temperature: c.temperature_2m, code: c.weather_code, isDay: c.is_day === 1, low: pct(c.cloud_cover_low), mid: pct(c.cloud_cover_mid) }
}

/** Does the FORECAST call it grey? Code 3 alone when the layers are unknown; with them, code 3 must be
 *  backed by a real deck low or mid in the sky (≥ 70%) — high cloud alone does not grey the day. */
export function modelGrey(m: ModelNow): boolean {
  if (m.code !== 3) return false
  if (m.low == null && m.mid == null) return true
  return Math.max(m.low ?? 0, m.mid ?? 0) >= 70
}

// ─── Schiphol's routine report (METAR) ────────────────────────────────────────
export interface Metar {
  station: string; time: number
  /** the heaviest layer reported: 0 none (CAVOK, NSC, NCD) · 1 FEW · 2 SCT · 3 BKN · 4 OVC or sky obscured */
  cover: 0 | 1 | 2 | 3 | 4
  wx: 'storm' | 'snow' | 'rain' | 'fog' | null
  raw: string
}
const COVER: Record<string, 1 | 2 | 3 | 4> = { FEW: 1, SCT: 2, BKN: 3, OVC: 4, VV: 4 }

/** The newest report in a block of METAR text ("METAR EHAM 021455Z …", newest first, or a bare
 *  "EHAM 021455Z …"). Reads the OBSERVATION only: the trend that follows it (TEMPO, BECMG) is a forecast,
 *  and recent weather (RERA) is over. Null on anything that is not a report, or one older than 75 minutes —
 *  a dev server answers /api/metar with the app's own HTML. Pure. */
export function parseMetar(text: string, now = Date.now()): Metar | null {
  if (typeof text !== 'string') return null
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/\b([A-Z]{4}) (\d{2})(\d{2})(\d{2})Z\b(.*)$/)
    if (!m) continue
    const [, station, dd, hh, mm, rest] = m
    const n = new Date(now)
    let time = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), Number(dd), Number(hh), Number(mm))
    if (time - now > 36 * 3600_000) time = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, Number(dd), Number(hh), Number(mm))   // the 30th, read on the 1st
    if (now - time > 75 * 60_000 || time - now > 10 * 60_000) return null
    const body = rest.split(/\s(?:TEMPO|BECMG|NOSIG|RMK)\b/)[0].trim().split(/\s+/)
    let cover: Metar['cover'] = 0
    let wx: Metar['wx'] = null
    const rank = { storm: 4, snow: 3, rain: 2, fog: 1 } as const
    const say = (w: NonNullable<Metar['wx']>) => { if (!wx || rank[w] > rank[wx]) wx = w }
    for (const t of body) {
      const c = t.match(/^(FEW|SCT|BKN|OVC|VV)(?:\d{3}|\/\/\/)/)
      if (c) { cover = Math.max(cover, COVER[c[1]]) as Metar['cover']; continue }
      // present weather: [intensity][descriptor][phenomena] — at the station, not "in the vicinity" (VC…)
      const w = t.match(/^[+-]?(MI|BC|PR|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP)+|FG)?$/)
      if (!w || (!w[1] && !w[2])) continue
      if (w[1] === 'TS') say('storm')
      if (w[2] === 'FG') { if (!w[1] || w[1] === 'FZ') say('fog') }   // fog, not patches or a shallow layer of it
      else if (w[2]) say(/SN|SG|IC|PL/.test(w[2]) && !/RA|DZ/.test(w[2]) ? 'snow' : 'rain')   // sleet and hail fall as rain here
    }
    return { station, time, cover, wx, raw: line.trim() }
  }
  return null
}

// ─── the sun, measured (Open-Meteo satellite radiation) ───────────────────────
export type SunClass = 'sunny' | 'mixed' | 'overcast'
export interface SunHour { time: number; cls: SunClass }

/** One hour of measured radiation → what the sky was doing. `kt` is the share of the sunlight arriving at
 *  the top of the atmosphere that reached the ground; `direct` the share of that which came straight from
 *  the sun's disc.
 *
 *  A LOW SUN changes the reading (checked against cloudless days, 2026-10-02 evening). Below about 13° of
 *  elevation (under 330 W/m² at the top of the atmosphere) the retrieval is not to be trusted: a CAVOK
 *  evening measured a direct share of 0.2, and one clear dusk measured none at all, which would have
 *  painted a blanket over a clear sky. Null there — and that is every hour of a December day at this
 *  latitude, when the report and the forecast's layers carry the reading alone. Between that and about 20°
 *  even a cloudless sky passes less light and less of it direct (0.57 and 0.50 under FEW030 that evening),
 *  so the sunny line is lower. */
export function sunClass(global: number, direct: number, topOfAtmosphere: number): SunClass | null {
  if (![global, direct, topOfAtmosphere].every(Number.isFinite) || topOfAtmosphere < 330 || global < 0) return null
  const kt = global / topOfAtmosphere, df = global > 0 ? direct / global : 0
  const lowSun = topOfAtmosphere < 476
  if (lowSun ? kt >= 0.45 && df >= 0.38 : kt >= 0.55 && df >= 0.5) return 'sunny'
  if (kt < 0.30 || df < 0.12) return 'overcast'
  return 'mixed'
}

/** The last COMPLETE hour the satellite has measured (rows are labelled with the END of their hour), if it
 *  ended within the last 2h10 — older than that it describes another sky. Pure. */
export function latestSunHour(data: unknown, now = Date.now()): SunHour | null {
  const h = (data as { hourly?: Record<string, unknown> } | null)?.hourly
  const t = h?.time, g = h?.shortwave_radiation, d = h?.direct_radiation, a = h?.terrestrial_radiation
  if (!Array.isArray(t) || !Array.isArray(g) || !Array.isArray(d) || !Array.isArray(a)) return null
  for (let i = t.length - 1; i >= 0; i--) {
    if (typeof t[i] !== 'number' || typeof g[i] !== 'number' || typeof d[i] !== 'number' || typeof a[i] !== 'number') continue
    const time = t[i] * 1000
    if (time > now + 5 * 60_000) continue
    if (now - time > 130 * 60_000) return null
    const cls = sunClass(g[i], d[i], a[i])
    return cls ? { time, cls } : null
  }
  return null
}

// ─── the reading ──────────────────────────────────────────────────────────────
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })

/** The forecast, the station report and the measured sun → one reading. See the rules at the top. Pure. */
export function fuseSky(model: ModelNow, metar: Metar | null, sun: SunHour | null): CurrentWeather {
  const base = { temperature: model.temperature, time: model.time, code: model.code }
  const seen = [metar ? `Schiphol ${hhmm(metar.time)}` : '', sun ? `satellite sunshine to ${hhmm(sun.time)}` : ''].filter(Boolean).join(' · ')
  const observed = (sky: Sky, label: string): CurrentWeather => ({ ...base, sky, label, basis: 'observed', note: `Observed: ${seen}` })
  const forecast = (sky: Sky, label: string): CurrentWeather => ({ ...base, sky, label, basis: 'forecast', note: 'Forecast estimate' })

  // 1 · weather: the observer's when there is a report; the model's only when there is none
  const WX_LABEL = { storm: 'Thunderstorms', snow: 'Snow', rain: 'Rain', fog: 'Fog' } as const
  if (metar?.wx) return observed(metar.wx, WX_LABEL[metar.wx])
  if (!metar) {
    const wx = STORM.includes(model.code) ? 'storm' : SNOW.includes(model.code) ? 'snow' : RAIN.includes(model.code) ? 'rain' : FOG.includes(model.code) ? 'fog' : null
    if (wx) return forecast(wx, WX_LABEL[wx])
  }

  // 2–5 · grey or open
  const grey = metar && metar.cover >= 3 ? true
    : sun ? (sun.cls === 'overcast' ? true : sun.cls === 'sunny' ? false : modelGrey(model))
    : modelGrey(model)
  const made = metar || sun ? observed : forecast
  if (grey) return made('cloud', 'Cloudy')
  const partly = metar?.cover === 2 || sun?.cls === 'mixed' || (!metar && !sun && model.code >= 2)
  if (!model.isDay) return made('night', partly ? 'Partly cloudy' : 'Clear night')
  // short on purpose: the header gives this label one line beside the temperature on a phone
  return made('clear', partly ? 'Partly cloudy' : metar?.cover === 1 ? 'Sunny' : 'Clear skies')
}

/** The forecast-only reading (no station report, no satellite): what the header shows when both are out. */
export function decodeCurrentWeather(data: unknown, now = Date.now()): CurrentWeather | null {
  const model = decodeModel(data, now)
  return model ? fuseSky(model, null, null) : null
}
