import { useEffect, useState } from 'react'
import { decodeHourly, weekendStops, type HourReading } from '../weather/hourly'

/** The weekend's hours for the active city — one request, two days back so a Sunday still has its Saturday. */
export function useHourly(lat: number, lon: number): HourReading[] {
  const [stops, setStops] = useState<HourReading[]>([])
  useEffect(() => {
    let alive = true
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,weather_code&timezone=auto&timeformat=unixtime&past_days=2&forecast_days=8`, { signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setStops(weekendStops(decodeHourly(d))) })
      .catch(() => { /* no scrubber without a forecast — the live sky is untouched */ })
    return () => { alive = false }
  }, [lat, lon])
  return stops
}
