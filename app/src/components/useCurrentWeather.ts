import { useEffect, useRef, useState } from 'react'
import { decodeCurrentWeather, type CurrentWeather } from '../lib/current-weather'

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
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.3676&longitude=4.9041&current=temperature_2m,weather_code,is_day&timeformat=unixtime', { signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]) })
        if (!response.ok) throw new Error('Weather unavailable')
        const data: unknown = await response.json()
        if (alive) { const r = decodeCurrentWeather(data); if (r) got.current = true; setReading(r); setNow(Date.now()) }
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
