import { useEffect, useMemo, useState } from 'react'
import { daylightAt, dateAtClock, gradeFor, PHASE_ALT, type Daylight, type Phase } from '../weather/daylight'

/** The sun over the active city, re-read every minute — or a preview phase (?sun=, Prototype
 *  settings) / a clock time (?at=19:40) held still for judging. */
export function useDaylight(lat: number, lon: number, preview: Phase | null, at: string | null): Daylight {
  const [tick, setTick] = useState(0)
  useEffect(() => { const id = window.setInterval(() => setTick((t) => t + 1), 60_000); return () => clearInterval(id) }, [])
  return useMemo(() => {
    if (preview) return gradeFor(PHASE_ALT[preview], preview === 'dawn')
    return daylightAt(dateAtClock(at) ?? new Date(), lat, lon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, preview, at, tick])
}
