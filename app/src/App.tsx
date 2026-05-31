import { useEffect, useMemo, useState } from 'react'
import type { Mode, Pick, SwipeDir } from './types'
import { MODES, MODE_META, classify, applyMode, rankPicks } from './weather/modes'
import { PICKS } from './data/picks'
import { WeatherField } from './weather/WeatherField'
import { SwipeStack } from './components/SwipeStack'
import { ListView } from './components/ListView'
import './App.css'

type View = 'stack' | 'list'
interface Wx { temp: number; hi: number; lo: number; city: string }

// representative figures per mode for the demo switcher (live path overrides)
const DEMO: Record<Mode, Wx> = {
  HOT: { temp: 27, hi: 31, lo: 19, city: 'Amsterdam' },
  WARM: { temp: 19, hi: 22, lo: 12, city: 'Amsterdam' },
  COOL: { temp: 11, hi: 13, lo: 6, city: 'Amsterdam' },
  COLD_WET: { temp: 7, hi: 9, lo: 4, city: 'Amsterdam' },
  VOLATILE: { temp: 21, hi: 24, lo: 15, city: 'Amsterdam' },
}

const today = new Date().toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'long',
}).toUpperCase()

export default function App() {
  const [mode, setMode] = useState<Mode>('HOT')
  const [view, setView] = useState<View>('stack')
  const [wx, setWx] = useState<Wx>(DEMO.HOT)
  const [swiped, setSwiped] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('')

  useEffect(() => { applyMode(mode) }, [mode])

  const rankedAll = useMemo(() => rankPicks(PICKS, mode), [mode])
  const deck = useMemo(() => rankedAll.filter((p) => !swiped.has(p.id)), [rankedAll, swiped])

  function handleStackSwipe(p: Pick, dir: SwipeDir) {
    setSwiped((s) => new Set(s).add(p.id))
    if (dir === 'like' || dir === 'save') setSaved((s) => new Set(s).add(p.id))
  }
  function handleListToggle(p: Pick, dir: SwipeDir) {
    setSaved((s) => {
      const next = new Set(s)
      if (dir === 'save') next.add(p.id); else next.delete(p.id)
      return next
    })
  }

  function setDemoMode(m: Mode) {
    setMode(m)
    setWx(DEMO[m])
    setSwiped(new Set())
    setStatus('')
  }

  async function locate() {
    if (!navigator.geolocation) { setStatus('no geolocation here'); return }
    setStatus('asking for location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => goLive(pos.coords.latitude, pos.coords.longitude),
      () => { setStatus('denied — using Amsterdam'); goLive(52.37, 4.89) },
      { timeout: 8000 },
    )
  }
  async function goLive(lat: number, lon: number) {
    try {
      setStatus('reading the sky…')
      const w = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=1`,
      ).then((r) => r.json())
      let city = 'Here'
      try {
        const g = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}`).then((r) => r.json())
        city = g.city || g.locality || g.principalSubdivision || 'Here'
      } catch { /* keep fallback */ }
      const hi = Math.round(w.daily.temperature_2m_max[0])
      const lo = Math.round(w.daily.temperature_2m_min[0])
      const pp = w.daily.precipitation_probability_max[0] ?? 0
      const m = classify(hi, pp, hi - lo)
      setMode(m); setWx({ temp: Math.round(w.current.temperature_2m), hi, lo, city }); setSwiped(new Set())
      setStatus(`live: ${city} ${Math.round(w.current.temperature_2m)}° → ${m}`)
    } catch { setStatus('weather fetch failed') }
  }

  return (
    <>
      <WeatherField mode={mode} />

      <div className="app">
        <header className="app-head">
          <div className="brand mono">● WKNDR</div>
          <div className="head-right">
            <span className="saved-count">★ {saved.size}</span>
            <div className="toggle" role="tablist">
              <button className={view === 'stack' ? 'on' : ''} onClick={() => setView('stack')}>Stack</button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
            </div>
          </div>
        </header>

        <section className="wx">
          <div className="wx-temp mono">{wx.temp}<span className="deg">°</span></div>
          <div className="wx-meta">
            <div className="wx-city">{wx.city}</div>
            <div className="wx-cond mono">{today} · {MODE_META[mode].cond} · H {wx.hi}° L {wx.lo}°</div>
          </div>
        </section>
        <p className="wx-phrase">{MODE_META[mode].phrase}</p>

        <main className={`main main-${view}`}>
          {view === 'stack'
            ? <SwipeStack picks={deck} onSwipe={handleStackSwipe} />
            : <ListView picks={rankedAll} savedIds={saved} onSwipe={handleListToggle} />}
        </main>

        <div className="controls">
          <div className="mode-pills mono">
            {MODES.map((m) => (
              <button key={m} className={m === mode ? 'on' : ''} onClick={() => setDemoMode(m)}>
                {MODE_META[m].label}
              </button>
            ))}
          </div>
          <button className="locate mono" onClick={locate}>⌖ use my weather</button>
          {status && <span className="status mono">{status}</span>}
        </div>
      </div>
    </>
  )
}
