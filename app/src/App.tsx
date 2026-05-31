import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mode, Pick, SwipeDir } from './types'
import { MODES, MODE_META, classify, applyMode, rankPicks, shuffle } from './weather/modes'
import { PICKS } from './data/picks'
import { WeatherField } from './weather/WeatherField'
import { SwipeStack } from './components/SwipeStack'
import { ListView } from './components/ListView'
import './App.css'

type View = 'stack' | 'list'
interface Wx { temp: number; hi: number; lo: number; city: string }

// Amsterdam — the product's home city. The app defaults to its live forecast.
const AMS = { lat: 52.37, lon: 4.89 }

// representative figures for the "preview a different forecast" what-if pills
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
  const [live, setLive] = useState(false)        // true once the real forecast loads
  const [swiped, setSwiped] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [showAdjust, setShowAdjust] = useState(false)
  const [toast, setToast] = useState('')
  const [seed, setSeed] = useState(0)            // 0 = forecast order; bumped by Refresh
  const [dealKey, setDealKey] = useState(0)      // bump → stack re-deals (refresh signal)

  useEffect(() => { applyMode(mode) }, [mode])

  // Default to the real Amsterdam forecast on load — weather is a fact, not a toggle.
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    goLive(AMS.lat, AMS.lon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // auto-clear the refresh toast
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 1900)
    return () => clearTimeout(id)
  }, [toast])

  // Refresh reshuffles the whole pool (within weather tiers) so BOTH views reorder,
  // then re-ranks. List + stack both change; the stack re-deals with a toast.
  const pool = useMemo(() => (seed === 0 ? PICKS : shuffle(PICKS, seed)), [seed])
  const rankedAll = useMemo(() => rankPicks(pool, mode), [pool, mode])
  const deck = useMemo(() => rankedAll.filter((p) => !swiped.has(p.id)), [rankedAll, swiped])

  function refresh() {
    setSwiped(new Set())
    setSeed((s) => s + 1)
    setDealKey((k) => k + 1)
    setToast(`Reshuffled · ${rankedAll.length} picks · re-ranked for ${MODE_META[mode].label.toLowerCase()}`)
  }

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

  // "preview a different forecast" — explicitly a what-if, not the real weather
  function previewMode(m: Mode) {
    setMode(m); setWx(DEMO[m]); setLive(false); setSwiped(new Set())
  }

  function locate() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => goLive(pos.coords.latitude, pos.coords.longitude),
      () => goLive(AMS.lat, AMS.lon),
      { timeout: 8000 },
    )
  }
  async function goLive(lat: number, lon: number) {
    try {
      const w = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=1`,
      ).then((r) => r.json())
      let city = 'Amsterdam'
      try {
        const g = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}`).then((r) => r.json())
        city = g.city || g.locality || g.principalSubdivision || 'Amsterdam'
      } catch { /* keep default */ }
      const hi = Math.round(w.daily.temperature_2m_max[0])
      const lo = Math.round(w.daily.temperature_2m_min[0])
      const pp = w.daily.precipitation_probability_max[0] ?? 0
      const m = classify(hi, pp, hi - lo)
      setMode(m)
      setWx({ temp: Math.round(w.current.temperature_2m), hi, lo, city })
      setLive(true)
    } catch { /* keep current */ }
  }

  return (
    <>
      <WeatherField mode={mode} />

      <div className="app">
        <header className="app-head">
          <div className="brand">WKNDR</div>
          <div className="head-right">
            <button className="refresh-btn" onClick={refresh} title="Refresh picks" aria-label="Refresh picks">↻</button>
            <span className="saved-count">★ {saved.size}</span>
            <div className="toggle" role="tablist">
              <button className={view === 'stack' ? 'on' : ''} onClick={() => setView('stack')}>Stack</button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
            </div>
          </div>
        </header>

        <section className="wx">
          <div className="wx-temp">{wx.temp}<span className="deg">°</span></div>
          <div className="wx-meta">
            <div className="wx-city">{wx.city}</div>
            <div className="wx-cond">
              {today} · {MODE_META[mode].cond} · H {wx.hi}° L {wx.lo}°
              <span className={`wx-src${live ? ' is-live' : ''}`}>{live ? 'live forecast' : 'preview'}</span>
            </div>
          </div>
        </section>
        <p className="wx-phrase">{MODE_META[mode].phrase}</p>

        <main className={`main main-${view}`}>
          {view === 'stack'
            ? <SwipeStack key={dealKey} picks={deck} onSwipe={handleStackSwipe} onRefresh={refresh} />
            : <ListView picks={rankedAll} savedIds={saved} onSwipe={handleListToggle} />}
        </main>

        <div className="controls">
          <button className={`adjust-toggle${showAdjust ? ' on' : ''}`} onClick={() => setShowAdjust((v) => !v)}>
            ⚙ Adjust weather
          </button>
          {showAdjust && (
            <div className="adjust-panel">
              <button className="locate" onClick={locate}>⌖ Use my location</button>
              <span className="adjust-label">Preview a different forecast</span>
              <div className="mode-pills">
                {MODES.map((m) => (
                  <button key={m} className={!live && m === mode ? 'on' : ''} onClick={() => previewMode(m)}>
                    {MODE_META[m].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast">↻ {toast}</div>}
    </>
  )
}
