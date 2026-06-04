import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Shuffle, Clock, ChevronDown, LayoutGrid, Star, ArrowUpRight, LocateFixed, Info, RotateCw, X } from 'lucide-react'

// subtle haptic on commit/save (Android/Chrome; iOS Safari ignores navigator.vibrate)
const haptic = (ms = 10) => { try { navigator.vibrate?.(ms) } catch { /* unsupported */ } }
import type { Mode, Pick, SwipeDir } from './types'
import { MODES, MODE_META, classify, applyMode, rankPicks, shuffle } from './weather/modes'
import { CITIES, DEFAULT_CITY, cityByKey, cityByName, nearestCity, type City } from './data/cities'
import { AmbientField } from './weather/AmbientField'
import type { Look } from './weather/ambientEngine'
import { APP_VERSION } from './version'
import { SwipeStack } from './components/SwipeStack'
import { ListView } from './components/ListView'
import { Itinerary } from './components/Itinerary'
import { FanView } from './components/FanView'
import { CardDetail } from './components/CardDetail'
import { Intro } from './components/Intro'
import { InputsSheet } from './components/InputsSheet'
import { FilterSheet } from './components/FilterSheet'
import { ShareSheet } from './components/ShareSheet'
import type { Freshness } from './types'

// a partner-shared weekend arrives as ?w=id,id,id&from=Name
const SHARED_IDS = (() => {
  const w = new URLSearchParams(window.location.search).get('w')
  return w ? new Set(w.split(',').filter(Boolean)) : null
})()
const SHARED_FROM = (() => {
  const f = new URLSearchParams(window.location.search).get('from')
  return f ? f.trim().slice(0, 24) : null
})()
import { CATEGORY_LABEL, type Category } from './types'
import {
  type Taste, applySwipe, hasTaste, loadSaved, loadTaste, persistSaved, persistTaste,
} from './taste'
import './App.css'

// filters available = 'all' + 'saved' + 'kids' (cross-cut) + the categories present
type Filter = 'all' | 'saved' | 'shared' | 'kids' | Category
type FilterOpt = { key: Filter; label: string; count: number }
// the WHEN axis — time-sensitivity, incl. the evergreen canon. Maps to freshness.
type When = 'all' | Freshness
type WhenOpt = { key: When; label: string; count: number }

// the city we boot into: ?city= override, else the default (Amsterdam). Live geolocation
// can switch it later (goLive) if it lands somewhere we have a feed for.
const INITIAL_CITY: City =
  cityByKey(new URLSearchParams(window.location.search).get('city')) ?? DEFAULT_CITY

type View = 'stack' | 'list' | 'fan'
interface Wx { temp: number; hi: number; lo: number; city: string }

// representative figures for the "preview a different forecast" what-if pills
const DEMO: Record<Mode, Wx> = {
  HOT: { temp: 27, hi: 31, lo: 19, city: 'Amsterdam' },
  WARM: { temp: 19, hi: 22, lo: 12, city: 'Amsterdam' },
  COOL: { temp: 11, hi: 13, lo: 6, city: 'Amsterdam' },
  COLD_WET: { temp: 7, hi: 9, lo: 4, city: 'Amsterdam' },
  VOLATILE: { temp: 21, hi: 24, lo: 15, city: 'Amsterdam' },
}

// the ambient field looks the user can switch between (persisted to localStorage).
// V2: a fresh set of five — flip through them to judge.
const FIELD_OPTS: { key: Look; label: string }[] = [
  { key: 'silk', label: 'Silk' },
  { key: 'dunes', label: 'Dunes' },
  { key: 'ink', label: 'Ink' },
  { key: 'rings', label: 'Rings' },
  { key: 'dots', label: 'Dots' },
  { key: 'off', label: 'Static' },
]

export default function App() {
  const [mode, setMode] = useState<Mode>('HOT')
  const [view, setView] = useState<View>('stack')   // a shared weekend lands on the Stack too (flip through their picks)
  const [wx, setWx] = useState<Wx>(DEMO.HOT)
  const [live, setLive] = useState(false)        // true once the real forecast loads
  const [swiped, setSwiped] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(() => loadSaved())   // persisted
  const [taste, setTaste] = useState<Taste>(() => loadTaste())         // persisted taste profile
  const [toast, setToast] = useState<{ text: string; save?: boolean } | null>(null)
  const [locating, setLocating] = useState(false)   // weather/location fetch in flight
  const [visits] = useState(() => {                  // for progressive-reduction of hints
    const v = Number(localStorage.getItem('wkndr.visits') || 0) + 1
    localStorage.setItem('wkndr.visits', String(v))
    return v
  })
  const flash = (text: string, save = false) => setToast({ text, save })
  const [seed, setSeed] = useState(0)            // 0 = forecast order; bumped by Refresh
  const [dealKey, setDealKey] = useState(0)      // bump → stack re-deals (refresh signal)
  const [detail, setDetail] = useState<Pick | null>(null)  // open card detail
  const [inputsOpen, setInputsOpen] = useState(false)      // "what's feeding this" sheet
  const [filter, setFilter] = useState<Filter>(SHARED_IDS ? 'shared' : 'all')  // What
  const [shareOpen, setShareOpen] = useState(false)        // "My Weekend" share sheet
  const [when, setWhen] = useState<When>('all')            // When: time-sensitivity / canon
  const [filterOpen, setFilterOpen] = useState(false)      // What sheet
  const [whenOpen, setWhenOpen] = useState(false)          // When sheet
  const [look, setLook] = useState<Look>(() => {       // ambient field (validated)
    const s = localStorage.getItem('wkndr.field') as Look
    return FIELD_OPTS.some((o) => o.key === s) ? s : 'silk'
  })
  const [barOpen, setBarOpen] = useState(false)            // command bar expanded?
  const [savesOpen, setSavesOpen] = useState(false)        // the persistent saves dock peek
  const [dockPop, setDockPop] = useState(false)            // brief pulse when a save lands in the counter
  const prevSavedCount = useRef(saved.size)
  const [intro, setIntro] = useState(true)                 // weather-aware intro (every load)
  const [listStyle, setListStyle] = useState<'wheel' | 'flux'>(() => {  // list motion language
    const s = localStorage.getItem('wkndr.liststyle')
    return s === 'flux' ? 'flux' : 'wheel'
  })
  const [city, setCity] = useState<City>(INITIAL_CITY)   // which city's feed is active
  const [feeds, setFeeds] = useState<Record<string, { picks: Pick[]; generatedAt: string }>>({})
  const fetchedFeeds = useRef<Set<string>>(new Set())

  // THE LIVE SEAM: prefer the generated feed (scripts/refresh.ts → public/data/picks.<city>.json)
  // when present, else the bundled snapshot. Lets refreshed content flow in with no rebuild.
  const cityPicks = feeds[city.key]?.picks ?? city.picks
  const feedAt = feeds[city.key]?.generatedAt ?? null

  // Everything that used to be derived from the single static PICKS set is now derived from
  // the ACTIVE city's pool — so switching city swaps the whole feed (filters, counts, deck).
  const present = useMemo<Category[]>(() => [...new Set(cityPicks.map((p) => p.category))], [cityPicks])
  const FILTERS = useMemo<FilterOpt[]>(() => [
    { key: 'all', label: 'Everything', count: cityPicks.length },
    ...(cityPicks.some((p) => p.kid) ? [{ key: 'kids' as Filter, label: 'Kids', count: cityPicks.filter((p) => p.kid).length }] : []),
    ...present.map((c) => ({ key: c as Filter, label: CATEGORY_LABEL[c], count: cityPicks.filter((p) => p.category === c).length })),
  ], [cityPicks, present])
  const WHEN_FILTERS = useMemo<WhenOpt[]>(() => ([
    { key: 'all', label: 'Any time', count: cityPicks.length },
    { key: 'weekend', label: 'This weekend', count: cityPicks.filter((p) => p.freshness === 'weekend').length },
    { key: 'new', label: 'New this week', count: cityPicks.filter((p) => p.freshness === 'new').length },
    { key: 'always', label: 'Evergreen canon', count: cityPicks.filter((p) => p.freshness === 'always').length },
    { key: 'ending', label: 'Ending soon', count: cityPicks.filter((p) => p.freshness === 'ending').length },
  ] as WhenOpt[]).filter((o) => o.count > 0), [cityPicks])
  const activeSources = useMemo(() => new Set(cityPicks.map((p) => p.source)).size, [cityPicks])
  const filterLabel = (f: Filter) =>
    f === 'saved' ? 'Saved' : f === 'shared' ? 'Shared with you' : (FILTERS.find((x) => x.key === f)?.label ?? 'Everything')
  const whenLabel = (w: When) => WHEN_FILTERS.find((x) => x.key === w)?.label ?? 'Any time'

  useEffect(() => { applyMode(mode) }, [mode])
  // pull the active city's live feed once (falls back silently to the bundled set)
  useEffect(() => {
    const key = city.key
    if (fetchedFeeds.current.has(key)) return
    fetchedFeeds.current.add(key)
    fetch(`${import.meta.env.BASE_URL}data/picks.${key}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !Array.isArray(j.picks) || !j.picks.length) return
        setFeeds((prev) => ({ ...prev, [key]: { picks: j.picks as Pick[], generatedAt: j.generatedAt } }))
      })
      .catch(() => { /* keep bundled */ })
  }, [city.key])
  useEffect(() => { persistSaved(saved) }, [saved])   // your list survives reloads
  useEffect(() => { persistTaste(taste) }, [taste])   // your taste accumulates over time
  useEffect(() => { localStorage.setItem('wkndr.field', look) }, [look])   // your ambient-field choice sticks
  useEffect(() => { localStorage.setItem('wkndr.liststyle', listStyle) }, [listStyle])   // list style sticks

  // Warm the image cache for the active city (during the intro) so a card's photo is
  // already loaded before it's revealed — no pop-in / flash as cards come forward.
  useEffect(() => {
    cityPicks.forEach((p) => { if (p.image) { const im = new Image(); im.src = p.image } })
  }, [cityPicks])

  // Load the active city's live forecast on boot — weather is a fact, not a toggle.
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    goLive(city.lat, city.lon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // auto-clear the refresh toast
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 1900)
    return () => clearTimeout(id)
  }, [toast])

  // pulse the persistent saves counter whenever a new save lands in it (the toast's
  // sibling moment — the saved item visibly "arrives" in the dock)
  useEffect(() => {
    if (saved.size > prevSavedCount.current) {
      setDockPop(true)
      const id = setTimeout(() => setDockPop(false), 620)
      prevSavedCount.current = saved.size
      return () => clearTimeout(id)
    }
    prevSavedCount.current = saved.size
  }, [saved.size])

  // taste is read via a ref when ranking so that swiping (which updates taste every card)
  // does NOT re-sort the live deck — otherwise the "next up" card could change identity
  // mid-toss and its image would swap. Taste re-applies on Refresh / weather change.
  const tasteRef = useRef(taste)
  useEffect(() => { tasteRef.current = taste }, [taste])

  // Refresh reshuffles the whole pool (within weather tiers) so BOTH views reorder,
  // then re-ranks. List + stack both change; the stack re-deals with a toast.
  const pool = useMemo(() => (seed === 0 ? cityPicks : shuffle(cityPicks, seed)), [cityPicks, seed])
  const rankedAll = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => rankPicks(pool, mode, hasTaste(tasteRef.current) ? tasteRef.current : undefined),
    [pool, mode],   // intentionally NOT [taste] — keeps the deck stable while swiping
  )
  const shown = useMemo(
    () => rankedAll.filter((p) => {
      const whatOk = filter === 'all' ? true
        : filter === 'saved' ? saved.has(p.id)
        : filter === 'shared' ? !!SHARED_IDS?.has(p.id)
        : filter === 'kids' ? p.kid
        : p.category === filter
      const whenOk = when === 'all' ? true : p.freshness === when
      return whatOk && whenOk
    }),
    [rankedAll, filter, when, saved],
  )
  const filterActive = filter !== 'all' || when !== 'all'
  const deck = useMemo(() => shown.filter((p) => !swiped.has(p.id)), [shown, swiped])
  // saved picks in rank order — fuels the saves-dock peek
  const savedPicks = useMemo(() => rankedAll.filter((p) => saved.has(p.id)), [rankedAll, saved])

  // Bottomless: in the unfiltered Stack, never dead-end — when you've swiped through the pool
  // it reshuffles and keeps serving. (Placeholder for the live pipeline that feeds new finds.)
  useEffect(() => {
    if (view !== 'stack' || filterActive || deck.length > 0 || shown.length === 0) return
    const t = setTimeout(() => {
      setSwiped(new Set()); setSeed((s) => s + 1); setDealKey((k) => k + 1)
      flash('More for you')
    }, 380)
    return () => clearTimeout(t)
  }, [view, filterActive, deck.length, shown.length])

  function refresh() {
    setSwiped(new Set())
    setSeed((s) => s + 1)
    setDealKey((k) => k + 1)
    flash(`Reshuffled · ${rankedAll.length} picks · re-ranked for ${MODE_META[mode].label.toLowerCase()}`)
  }

  function handleStackSwipe(p: Pick, dir: SwipeDir) {
    setSwiped((s) => new Set(s).add(p.id))
    if (dir === 'like' || dir === 'save') {
      setSaved((s) => new Set(s).add(p.id))   // the header counter turns orange + bumps — that's the confirmation
    }
    setTaste((t) => applySwipe(t, p, dir))   // every swipe teaches it
  }
  function handleListToggle(p: Pick, dir: SwipeDir) {
    setSaved((s) => {
      const next = new Set(s)
      if (dir === 'save') next.add(p.id); else next.delete(p.id)
      return next
    })
    if (dir === 'save') {
      haptic(14)
      setTaste((t) => applySwipe(t, p, 'save'))
    }
  }
  function toggleSave(p: Pick) {
    const wasSaved = saved.has(p.id)
    setSaved((s) => {
      const next = new Set(s)
      if (wasSaved) next.delete(p.id); else next.add(p.id)
      return next
    })
    if (!wasSaved) { haptic(14); setTaste((t) => applySwipe(t, p, 'save')) }
    else flash('Removed')
  }

  // hard reset — wipe saved list + learned taste (for testing the cold-start state)
  function resetData() {
    localStorage.removeItem('wkndr.saved.v1')
    localStorage.removeItem('wkndr.taste.v1')
    setSaved(new Set())
    setTaste(loadTaste())   // fresh/empty profile
    setSwiped(new Set())
    setSeed(0)
    setDealKey((k) => k + 1)
    setFilter('all'); setWhen('all')
    setBarOpen(false)
    flash('Reset · saved list + taste cleared')
  }

  // "preview a different forecast" — explicitly a what-if, not the real weather
  function previewMode(m: Mode) {
    setMode(m); setWx({ ...DEMO[m], city: city.name }); setLive(false); setSwiped(new Set())
  }

  // Switch the active city's whole feed (and load its weather). Resets the run so you
  // start fresh in the new city. `autoSwitch` = true means geolocation found it, not a tap.
  function selectCity(c: City, autoSwitch = false) {
    if (c.key === city.key) return
    setCity(c)
    setFilter('all'); setWhen('all')
    setSwiped(new Set()); setSeed(0); setDealKey((k) => k + 1)
    if (!autoSwitch) { setView('stack'); setBarOpen(false); goLive(c.lat, c.lon) }
  }

  function locate() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => goLive(pos.coords.latitude, pos.coords.longitude),
      () => goLive(city.lat, city.lon),
      { timeout: 8000 },
    )
  }
  async function goLive(lat: number, lon: number) {
    setLocating(true)
    try {
      const w = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=1`,
      ).then((r) => r.json())
      let placeName = city.name
      try {
        const g = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}`).then((r) => r.json())
        placeName = g.city || g.locality || g.principalSubdivision || placeName
      } catch { /* keep current */ }
      // if the live location is somewhere we actually have a feed for, swap to it
      const matched = cityByName(placeName) ?? nearestCity(lat, lon)
      if (matched && matched.key !== city.key) selectCity(matched, true)
      const hi = Math.round(w.daily.temperature_2m_max[0])
      const lo = Math.round(w.daily.temperature_2m_min[0])
      const pp = w.daily.precipitation_probability_max[0] ?? 0
      const m = classify(hi, pp, hi - lo)
      setMode(m)
      setWx({ temp: Math.round(w.current.temperature_2m), hi, lo, city: placeName })
      setLive(true)
    } catch { /* keep current */ }
    finally { setLocating(false) }
  }

  return (
    <>
      <AmbientField mode={mode} look={look} onLookChange={setLook} />

      <AnimatePresence>
        {intro && <Intro lead={SHARED_FROM ? `${SHARED_FROM} shared some picks.` : undefined} showHint={visits <= 3} onDone={() => setIntro(false)} />}
      </AnimatePresence>

      <motion.div
        className="app"
        initial={false}
        /* opacity only — NO transform: a transform here would make .app the containing block
           for position:fixed children (the fan stage, overlays), offsetting them by the
           safe-area padding on notched phones. Keep it transform-free so fixed = true viewport. */
        animate={intro ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: intro ? 0 : 0.2 }}
      >
        <header className="topbar">
          <AnimatePresence>
            {(barOpen || savesOpen) && (
              <motion.div
                className="topbar-scrim"
                onClick={() => { setBarOpen(false); setSavesOpen(false) }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>

          <div className={`topbar-module${barOpen ? ' open' : ''}${savesOpen ? ' peeking' : ''}`}>
            <div
              className="topbar-row"
              role="button"
              tabIndex={0}
              aria-label={barOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={barOpen}
              onClick={() => { setBarOpen((v) => !v); setSavesOpen(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBarOpen((v) => !v); setSavesOpen(false) } }}
            >
              <div className="tb-brandblock">
                <div className="tb-brand"><span className={`tb-dot${locating ? ' pulsing' : ''}`} aria-hidden />WKNDR</div>
                <span className="tb-divider" aria-hidden />
                <div className="tb-wx">
                  <span className="tb-temp">{wx.temp}°</span>
                  <span className="tb-city">{locating ? 'Locating…' : wx.city}</span>
                </div>
              </div>

              <div className="tb-actions">
                <button
                  type="button"
                  className={`tb-saves${saved.size > 0 ? ' has' : ''}${savesOpen ? ' on' : ''}${dockPop ? ' pop' : ''}`}
                  aria-label={`${saved.size} saved — ${savesOpen ? 'hide' : 'show'} your list`}
                  aria-expanded={savesOpen}
                  onClick={(e) => { e.stopPropagation(); setSavesOpen((v) => !v); setBarOpen(false) }}
                >
                  <Star size={16} strokeWidth={2.3} fill={saved.size > 0 ? 'currentColor' : 'none'} />
                  {saved.size > 0 && <span className="tb-saves-n" key={saved.size}>{saved.size}</span>}
                </button>

                <span
                  className={`tb-icon tb-menu${barOpen ? ' on' : ''}${!barOpen && filterActive ? ' dot' : ''}`}
                  aria-hidden
                >
                  {barOpen ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <line x1="3" y1="7" x2="17" y2="7" /><line x1="3" y1="13" x2="17" y2="13" />
                    </svg>
                  )}
                </span>
              </div>
            </div>

            <div className={`tb-panel${barOpen ? ' open' : ''}`} aria-hidden={!barOpen}>
              <div className="tb-panel-clip">
                <div className="tb-panel-inner">
                    <div className="bar-group">
                      <span className="bar-label">View</span>
                      <div className="bar-row">
                        <div className="toggle" role="tablist">
                          <button className={view === 'stack' ? 'on' : ''} onClick={() => setView('stack')}>Stack</button>
                          <button className={view === 'fan' ? 'on' : ''} onClick={() => setView('fan')}>Fan</button>
                          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
                        </div>
                        <button className="bar-pill" onClick={refresh}><Shuffle size={15} strokeWidth={2.2} /> Shuffle</button>
                      </div>
                      {view === 'list' && filter !== 'saved' && (
                        <div className="mode-pills list-style-pills" style={{ marginTop: 8 }}>
                          <button className={listStyle === 'wheel' ? 'on' : ''} onClick={() => setListStyle('wheel')}>Cylinder</button>
                          <button className={listStyle === 'flux' ? 'on' : ''} onClick={() => setListStyle('flux')}>Flux</button>
                        </div>
                      )}
                    </div>

                    <div className="bar-group">
                      <span className="bar-label">Filter</span>
                      <div className="bar-row">
                        <button className={`filter-trigger${when !== 'all' ? ' on' : ''}`} onClick={() => setWhenOpen(true)}>
                          <Clock className="ft-icon" size={14} strokeWidth={2.2} /> {whenLabel(when)}<ChevronDown className="ft-caret" size={14} strokeWidth={2.2} />
                        </button>
                        <button className={`filter-trigger${filter !== 'all' && filter !== 'saved' ? ' on' : ''}`} onClick={() => setFilterOpen(true)}>
                          <LayoutGrid className="ft-icon" size={14} strokeWidth={2.2} /> {filter === 'all' || filter === 'saved' ? 'Everything' : filterLabel(filter)}<ChevronDown className="ft-caret" size={14} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>

                    <div className="bar-group">
                      <span className="bar-label">Your list</span>
                      <div className="bar-row">
                        <button
                          className={`bar-pill${filter === 'saved' ? ' on' : ''}`}
                          onClick={() => { setFilter('saved'); setView('list'); setBarOpen(false) }}
                        ><Star size={14} strokeWidth={2.2} fill="currentColor" /> Saved · {saved.size}</button>
                        {saved.size > 0 && <button className="bar-pill" onClick={() => { setShareOpen(true); setBarOpen(false) }}>Share <ArrowUpRight size={14} strokeWidth={2.2} /></button>}
                        {(saved.size > 0 || hasTaste(taste)) && (
                          <button className="bar-pill bar-pill--danger" onClick={resetData}>↺ Reset</button>
                        )}
                      </div>
                    </div>

                    <div className="bar-group">
                      <span className="bar-label">City</span>
                      <div className="mode-pills">
                        {CITIES.map((c) => (
                          <button key={c.key} className={c.key === city.key ? 'on' : ''} onClick={() => selectCity(c)}>
                            {c.label}{c.seed ? ' ·seed' : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bar-group">
                      <span className="bar-label">Weather</span>
                      <div className="bar-row">
                        <button className="bar-pill" onClick={() => { locate(); setBarOpen(false) }}><LocateFixed size={15} strokeWidth={2.2} /> Use my location</button>
                      </div>
                      <span className="bar-sublabel">Preview a forecast</span>
                      <div className="mode-pills">
                        {MODES.map((m) => (
                          <button key={m} className={!live && m === mode ? 'on' : ''} onClick={() => previewMode(m)}>
                            {MODE_META[m].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bar-group">
                      <span className="bar-label">Ambient field</span>
                      <div className="mode-pills field-pills">
                        {FIELD_OPTS.map((o) => (
                          <button key={o.key} className={o.key === look ? 'on' : ''} onClick={() => setLook(o.key)}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button className="bar-foot" onClick={() => { setInputsOpen(true); setBarOpen(false) }}>
                      <Info size={13} strokeWidth={2.2} /> Built from {city.sourceCount} sources · weather × freshness{hasTaste(taste) ? ' × you' : ''}
                    </button>
                    <span className="bar-build">v{APP_VERSION}</span>
                  </div>
                </div>
              </div>
              {/* saved-picks peek — drops straight from the module, so it's flush-aligned */}
              <AnimatePresence>
                {savesOpen && (
                  <motion.div
                    className="saves-panel"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {saved.size === 0 ? (
                      <div className="sv-empty">
                        <Star size={22} strokeWidth={1.8} />
                        <b>Nothing saved yet</b>
                        <span>Swipe right, or tap ★ on a card, to start building your weekend.</span>
                      </div>
                    ) : (
                      <>
                        <div className="sv-head">
                          <div className="sv-head-txt">
                            <span className="sv-title">Your weekend</span>
                            <span className="sv-sub">{saved.size} saved</span>
                          </div>
                          <button className="sv-share" onClick={() => { setShareOpen(true); setSavesOpen(false) }}>
                            Share <ArrowUpRight size={14} strokeWidth={2.2} />
                          </button>
                        </div>
                        <div className="sv-list">
                          {savedPicks.map((p) => (
                            <div className="sv-row" key={p.id}>
                              <button className="sv-rowmain" onClick={() => { setDetail(p); setSavesOpen(false) }}>
                                <span className="sv-thumb" style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}>
                                  {!p.image && <span className="sv-thumb-cat">{CATEGORY_LABEL[p.category]}</span>}
                                </span>
                                <span className="sv-meta">
                                  <span className="sv-when">{p.when}</span>
                                  <span className="sv-name">{p.title}</span>
                                </span>
                              </button>
                              <button className="sv-remove" aria-label={`Remove ${p.title}`} onClick={() => toggleSave(p)}>
                                <X size={15} strokeWidth={2.4} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button className="sv-open" onClick={() => { setFilter('saved'); setView('list'); setSavesOpen(false) }}>
                          Open as list <ArrowUpRight size={14} strokeWidth={2.2} />
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
          </div>
        </header>

        {filter === 'saved' && saved.size > 0 && (
          <div className="ctx-bar">
            <span>Your weekend · {saved.size} saved</span>
            <button onClick={() => setShareOpen(true)}>Share <ArrowUpRight size={14} strokeWidth={2.2} /></button>
          </div>
        )}
        {filter === 'shared' && SHARED_IDS && (
          <div className="ctx-bar shared">
            <span>💌 {SHARED_FROM || 'A friend'} shared {SHARED_IDS.size} picks — swipe through</span>
            <button onClick={() => setSaved((s) => new Set([...s, ...SHARED_IDS]))}>Save all</button>
          </div>
        )}

        <main className={`main main-${view}`}>
          {view === 'stack' ? (
            <motion.div
              key="stack" className="view-pane"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <SwipeStack
                /* remount when the intro lifts so the deck deals in while it's actually visible
                   (mounting behind the intro would burn the fly-in before the app is revealed) */
                key={`${dealKey}-${filter}-${when}-${intro ? 'intro' : 'live'}`}
                picks={deck}
                onSwipe={handleStackSwipe}
                onRefresh={refresh}
                onOpen={setDetail}
                filterLabel={filterActive ? 'this filter' : null}
                onClearFilter={() => { setFilter('all'); setWhen('all') }}
                onSeeList={() => setView('list')}
              />
            </motion.div>
          ) : view === 'fan' ? (
            <motion.div
              key="fan" className="view-pane"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <FanView picks={shown} onOpen={setDetail} />
            </motion.div>
          ) : (
            <motion.div
              key="list" className="view-pane view-pane--scroll"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {filter === 'saved'
                ? <Itinerary picks={shown} onOpen={setDetail} onSwipe={handleListToggle} />
                : <ListView picks={shown} savedIds={saved} onSwipe={handleListToggle} onOpen={setDetail} listStyle={listStyle} />}
            </motion.div>
          )}
        </main>
      </motion.div>

      {toast && (
        <div className={`toast${toast.save ? ' toast--save' : ''}`}>
          {toast.save ? <Star size={14} strokeWidth={2.4} fill="currentColor" /> : <RotateCw size={14} strokeWidth={2.4} />}
          {toast.text}
        </div>
      )}

      <CardDetail
        pick={detail}
        saved={detail ? saved.has(detail.id) : false}
        onClose={() => setDetail(null)}
        onToggleSave={toggleSave}
      />
      <InputsSheet
        open={inputsOpen}
        onClose={() => setInputsOpen(false)}
        mode={mode}
        temp={wx.temp}
        hi={wx.hi}
        lo={wx.lo}
        live={live}
        activeCount={activeSources}
        roster={city.sources}
        rosterCount={city.sourceCount}
        cityLabel={city.label}
        seed={city.seed}
        feedAt={feedAt}
      />
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        picks={rankedAll.filter((p) => saved.has(p.id))}
        mode={mode}
        city={wx.city}
      />
      <FilterSheet
        open={whenOpen}
        onClose={() => setWhenOpen(false)}
        title="When"
        options={WHEN_FILTERS}
        active={when}
        onSelect={setWhen}
      />
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Show me"
        options={[FILTERS[0], { key: 'saved' as Filter, label: 'Saved', count: saved.size }, ...FILTERS.slice(1)]}
        active={filter}
        onSelect={setFilter}
      />
    </>
  )
}
