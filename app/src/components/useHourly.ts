import { useEffect, useState } from 'react'
import { decodeHourly, weekendStops, windAt, type HourReading } from '../weather/hourly'
import type { Wind } from '../weather/air'

/** The weekend's hours for the active city — one request, two days back so a Sunday still has its
 *  Saturday — and the WIND of this hour (2026-10-26), which the pane moves with (weather/air.ts).
 *  Re-read on the hour, so the lean follows the forecast through the day. */
export function useHourly(lat: number, lon: number): { stops: HourReading[]; wind: Wind | null } {
  const [stops, setStops] = useState<HourReading[]>([])
  const [hours, setHours] = useState<ReturnType<typeof decodeHourly>>([])
  const [wind, setWind] = useState<Wind | null>(null)
  useEffect(() => {
    let alive = true
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weather_code,cloud_cover_low,cloud_cover_mid,wind_speed_10m,wind_direction_10m&timezone=auto&timeformat=unixtime&past_days=2&forecast_days=8`, { signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) { const h = decodeHourly(d); setHours(h); setStops(weekendStops(h)) } })
      .catch(() => { /* no scrubber without a forecast — the live sky is untouched */ })
    return () => { alive = false }
  }, [lat, lon])
  useEffect(() => {
    const read = () => setWind(windAt(hours))
    read()
    const id = window.setInterval(read, 60_000)
    return () => window.clearInterval(id)
  }, [hours])
  return { stops, wind }
}
