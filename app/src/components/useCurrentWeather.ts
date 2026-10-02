import { useEffect, useRef, useState } from 'react'
import { decodeModel, fuseSky, latestSunHour, parseMetar, type CurrentWeather } from '../lib/current-weather'

// THE SKY RIGHT NOW (lib/current-weather has the rules and the reason). Three readings, fetched together:
//   · the forecast model — temperature, day/night, and the fallback (required)
//   · Schiphol's report  — the observer's low cloud and weather (our own relay first: aviationweather.gov
//     sends no CORS header, so app/public/_worker.js fetches it for us and caches five minutes; a public
//     mirror second, for the dev server and the legacy host, which have no relay)
//   · the measured sun   — the satellite's last complete hour of radiation at this spot
// The two observations are optional and bounded at four seconds: without them the reading is the forecast's,
// and says so. They are waited for, though — painting the forecast first and correcting it a second later
// is the flip from grey to blue this whole change exists to remove.
const LAT = 52.3676, LON = 4.9041, STATION = 'EHAM'
const MODEL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day,cloud_cover_low,cloud_cover_mid&timeformat=unixtime`
const SUN = `https://satellite-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&hourly=shortwave_radiation,direct_radiation,terrestrial_radiation&models=satellite_radiation_seamless&past_days=1&forecast_days=1&timeformat=unixtime`
const REPORTS = ['/api/metar', `https://metar.vatsim.net/${STATION}`]

async function report(signal: AbortSignal): Promise<string | null> {
  for (const url of REPORTS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]) })
      if (!r.ok) continue
      const text = (await r.text()).slice(0, 2000)
      if (new RegExp(`\\b${STATION} \\d{6}Z\\b`).test(text)) return text   // a dev server answers with the app's own HTML
    } catch { /* next source */ }
  }
  return null
}

/** City estimate only: separate from the weekend forecast used for ranking. */
export function useCurrentWeather() {
  const [reading,setReading] = useState<CurrentWeather | null>(null)
  const [now,setNow] = useState(Date.now())
  const [loading,setLoading] = useState(true)
  const got = useRef(false)   // the FIRST reading is always fetched: embedded webviews report hidden while on screen (the Claude desktop pane), and the header read "Weather unavailable" there forever
  useEffect(() => {
    let alive = true
    let pending = false
    const controller = new AbortController()
    async function refresh() {
      if (pending || (document.hidden && got.current)) return
      pending = true
      try {
        const [response, metarText, sunData] = await Promise.all([
          fetch(MODEL, { signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]) }),
          report(controller.signal),
          fetch(SUN, { signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4000)]) }).then((r) => (r.ok ? r.json() as Promise<unknown> : null)).catch(() => null),
        ])
        if (!response.ok) throw new Error('Weather unavailable')
        const data: unknown = await response.json()
        if (alive) {
          const at = Date.now()
          const model = decodeModel(data, at)
          const r = model ? fuseSky(model, metarText ? parseMetar(metarText, at) : null, latestSunHour(sunData, at)) : null
          if (r) got.current = true
          setReading(r); setNow(at)
        }
      } catch { /* Keep a recent reading only until its timestamp expires. */ }
      finally { pending = false; if (alive) setLoading(false) }
    }
    void refresh()
    const poll = window.setInterval(refresh,15*60_000)
    const age = window.setInterval(()=>setNow(Date.now()),60_000)
    document.addEventListener('visibilitychange',refresh)
    return ()=> { alive=false; controller.abort(); clearInterval(poll); clearInterval(age); document.removeEventListener('visibilitychange',refresh) }
  },[])
  return { reading:reading && now-reading.time <= 45*60_000 ? reading : null, loading }
}
