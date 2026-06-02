import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Mode, Pick, SwipeDir } from './types'
import { MODES, MODE_META, classify, applyMode, rankPicks, shuffle } from './weather/modes'
import { PICKS } from './data/picks'
import { AmbientField } from './weather/AmbientField'
import type { Look } from './weather/ambientEngine'
import { APP_VERSION } from './version'
import { SwipeStack } from './components/SwipeStack'
import { ListView } from './components/ListView'
import { CardDetail } from './components/CardDetail'
import { Intro } from './components/Intro'
import { InputsSheet } from './components/InputsSheet'
import { FilterSheet } from './components/FilterSheet'
import { ShareSheet } from './components/ShareSheet'
import type { Freshness } from './types'

// a partner-shared weekend arrives as ?w=id,id,id
const SHARED_IDS = (() => {
  const w = new URLSearchParams(window.location.search).get('w')
  return w ? new Set(w.split(',').filter(Boolean)) : null
})()
import { SOURCE_COUNT } from './data/sources'
import { CATEGORY_LABEL, type Category } from './types'
import {
  type Taste, applySwipe, hasTaste, loadSaved, loadTaste, persistSaved, persistTaste,
} from './taste'
import './App.css'

// sources actually used in the current snapshot (vs the full roster)
const ACTIVE_SOURCES = new Set(PICKS.map((p) => p.source)).size

// filters available = 'all' + 'saved' + 'kids' (cross-cut) + the categories present
type Filter = 'all' | 'saved' | 'shared' | 'kids' | Category
const PRESENT: Category[] = [...new Set(PICKS.map((p) => p.category))]
const FILTERS: { key: Filter; label: string; count: number }[] = [
  { key: 'all', label: 'Everything', count: PICKS.length },
  ...(PICKS.some((p) => p.kid) ? [{ key: 'kids' as Filter, label: 'Kids', count: PICKS.filter((p) => p.kid).length }] : []),
  ...PRESENT.map((c) => ({ key: c as Filter, label: CATEGORY_LABEL[c], count: PICKS.filter((p) => p.category === c).length })),
]
const filterLabel = (f: Filter) =>
  f === 'saved' ? 'Saved' : f === 'shared' ? 'Shared with you' : (FILTERS.find((x) => x.key === f)?.label ?? 'Everything')

// the WHEN axis — time-sensitivity, incl. the evergreen canon. Maps to freshness.
type When = 'all' | Freshness
const WHEN_FILTERS = ([
  { key: 'all', label: 'Any time', count: PICKS.length },
  { key: 'weekend', label: 'This weekend', count: PICKS.filter((p) => p.freshness === 'weekend').length },
  { key: 'new', label: 'New this week', count: PICKS.filter((p) => p.freshness === 'new').length },
  { key: 'always', label: 'Evergreen canon', count: PICKS.filter((p) => p.freshness === 'always').length },
  { key: 'ending', label: 'Ending soon', count: PICKS.filter((p) => p.freshness === 'ending').length },
] as { key: When; label: string; count: number }[]).filter((o) => o.count > 0)
const whenLabel = (w: When) => WHEN_FILTERS.find((x) => x.key === w)?.label ?? 'Any time'

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

// the ambient field looks the user can switch between (persisted to localStorage)
const FIELD_OPTS: { key: Look; label: string }[] = [
  { key: 'aura', label: 'Aura' },
  { key: 'warp', label: 'Warp' },
  { key: 'aurora', label: 'Aurora' },
  { key: 'mesh', label: 'Mesh' },
  { key: 'metaball', label: 'Metaball' },
  { key: 'off', label: 'Static' },
]

export default function App() {
  const [mode, setMode] = useState<Mode>('HOT')
  const [view, setView] = useState<View>(SHARED_IDS ? 'list' : 'stack')
  const [wx, setWx] = useState<Wx>(DEMO.HOT)
  const [live, setLive] = useState(false)        // true once the real forecast loads
  const [swiped, setSwiped] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(() => loadSaved())   // persisted
  const [taste, setTaste] = useState<Taste>(() => loadTaste())         // persisted taste profile
  const [toast, setToast] = useState('')
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
    return FIELD_OPTS.some((o) => o.key === s) ? s : 'warp'
  })
  const [barOpen, setBarOpen] = useState(false)            // command bar expanded?
  const [intro, setIntro] = useState(true)                 // weather-aware intro (every load)
  const [listStyle, setListStyle] = useState<'wheel' | 'flux'>(() => {  // list motion language
    const s = localStorage.getItem('wkndr.liststyle')
    return s === 'flux' ? 'flux' : 'wheel'
  })

  useEffect(() => { applyMode(mode) }, [mode])
  useEffect(() => { persistSaved(saved) }, [saved])   // your list survives reloads
  useEffect(() => { persistTaste(taste) }, [taste])   // your taste accumulates over time
  useEffect(() => { localStorage.setItem('wkndr.field', look) }, [look])   // your ambient-field choice sticks
  useEffect(() => { localStorage.setItem('wkndr.liststyle', listStyle) }, [listStyle])   // list style sticks

  // Warm the image cache up front (during the intro) so a card's photo is already loaded
  // before it's revealed — no pop-in / flash as cards come forward.
  useEffect(() => {
    PICKS.forEach((p) => { if (p.image) { const im = new Image(); im.src = p.image } })
  }, [])

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

  // taste is read via a ref when ranking so that swiping (which updates taste every card)
  // does NOT re-sort the live deck — otherwise the "next up" card could change identity
  // mid-toss and its image would swap. Taste re-applies on Refresh / weather change.
  const tasteRef = useRef(taste)
  useEffect(() => { tasteRef.current = taste }, [taste])

  // Refresh reshuffles the whole pool (within weather tiers) so BOTH views reorder,
  // then re-ranks. List + stack both change; the stack re-deals with a toast.
  const pool = useMemo(() => (seed === 0 ? PICKS : shuffle(PICKS, seed)), [seed])
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

  function refresh() {
    setSwiped(new Set())
    setSeed((s) => s + 1)
    setDealKey((k) => k + 1)
    setToast(`Reshuffled · ${rankedAll.length} picks · re-ranked for ${MODE_META[mode].label.toLowerCase()}`)
  }

  function handleStackSwipe(p: Pick, dir: SwipeDir) {
    setSwiped((s) => new Set(s).add(p.id))
    if (dir === 'like' || dir === 'save') setSaved((s) => new Set(s).add(p.id))
    setTaste((t) => applySwipe(t, p, dir))   // every swipe teaches it
  }
  function handleListToggle(p: Pick, dir: SwipeDir) {
    setSaved((s) => {
      const next = new Set(s)
      if (dir === 'save') next.add(p.id); else next.delete(p.id)
      return next
    })
    if (dir === 'save') setTaste((t) => applySwipe(t, p, 'save'))
  }
  function toggleSave(p: Pick) {
    const wasSaved = saved.has(p.id)
    setSaved((s) => {
      const next = new Set(s)
      if (wasSaved) next.delete(p.id); else next.add(p.id)
      return next
    })
    if (!wasSaved) setTaste((t) => applySwipe(t, p, 'save'))
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
    setToast('Reset · saved list + taste cleared')
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
      <AmbientField mode={mode} look={look} onLookChange={setLook} />

      <AnimatePresence>
        {intro && <Intro mode={mode} onDone={() => setIntro(false)} />}
      </AnimatePresence>

      <motion.div
        className="app"
        initial={false}
        animate={intro ? { opacity: 0, y: 14 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: intro ? 0 : 0.2 }}
      >
        <header className="topbar">
          <AnimatePresence>
            {barOpen && (
              <motion.div
                className="topbar-scrim"
                onClick={() => setBarOpen(false)}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>

          <div className={`topbar-module${barOpen ? ' open' : ''}`}>
            <div
              className="topbar-row"
              role="button"
              tabIndex={0}
              aria-label={barOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={barOpen}
              onClick={() => setBarOpen((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBarOpen((v) => !v) } }}
            >
              <div className="tb-brandblock">
                <div className="tb-brand"><span className="tb-dot" aria-hidden />WKNDR</div>
                <span className="tb-divider" aria-hidden />
                <div className="tb-wx">
                  <span className="tb-temp">{wx.temp}°</span>
                  <span className="tb-city">{wx.city}</span>
                </div>
              </div>

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

            <div className={`tb-panel${barOpen ? ' open' : ''}`} aria-hidden={!barOpen}>
              <div className="tb-panel-clip">
                <div className="tb-panel-inner">
                    <div className="bar-group">
                      <span className="bar-label">View</span>
                      <div className="bar-row">
                        <div className="toggle" role="tablist">
                          <button className={view === 'stack' ? 'on' : ''} onClick={() => setView('stack')}>Stack</button>
                          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
                        </div>
                        <button className="bar-pill" onClick={refresh}>↻ Shuffle</button>
                      </div>
                      {view === 'list' && (
                        <div className="mode-pills" style={{ marginTop: 8 }}>
                          <button className={listStyle === 'wheel' ? 'on' : ''} onClick={() => setListStyle('wheel')}>Cylinder</button>
                          <button className={listStyle === 'flux' ? 'on' : ''} onClick={() => setListStyle('flux')}>Flux</button>
                        </div>
                      )}
                    </div>

                    <div className="bar-group">
                      <span className="bar-label">Filter</span>
                      <div className="bar-row">
                        <button className={`filter-trigger${when !== 'all' ? ' on' : ''}`} onClick={() => setWhenOpen(true)}>
                          <span className="ft-icon">◷</span> {whenLabel(when)}<span className="ft-caret">⌄</span>
                        </button>
                        <button className={`filter-trigger${filter !== 'all' && filter !== 'saved' ? ' on' : ''}`} onClick={() => setFilterOpen(true)}>
                          <span className="ft-icon">⊞</span> {filter === 'all' || filter === 'saved' ? 'Everything' : filterLabel(filter)}<span className="ft-caret">⌄</span>
                        </button>
                      </div>
                    </div>

                    <div className="bar-group">
                      <span className="bar-label">Your list</span>
                      <div className="bar-row">
                        <button
                          className={`bar-pill${filter === 'saved' ? ' on' : ''}`}
                          onClick={() => { setFilter('saved'); setView('list'); setBarOpen(false) }}
                        >★ Saved · {saved.size}</button>
                        {saved.size > 0 && <button className="bar-pill" onClick={() => { setShareOpen(true); setBarOpen(false) }}>Share ↗</button>}
                        {(saved.size > 0 || hasTaste(taste)) && (
                          <button className="bar-pill bar-pill--danger" onClick={resetData}>↺ Reset</button>
                        )}
                      </div>
                    </div>

                    <div className="bar-group">
                      <span className="bar-label">Weather</span>
                      <div className="bar-row">
                        <button className="bar-pill" onClick={() => { locate(); setBarOpen(false) }}>⌖ Use my location</button>
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
                      ⓘ Built from {SOURCE_COUNT} sources · weather × freshness{hasTaste(taste) ? ' × you' : ''}
                    </button>
                    <span className="bar-build">v{APP_VERSION}</span>
                  </div>
                </div>
              </div>
          </div>
        </header>

        {filter === 'saved' && saved.size > 0 && (
          <div className="ctx-bar">
            <span>Your weekend · {saved.size} saved</span>
            <button onClick={() => setShareOpen(true)}>Share ↗</button>
          </div>
        )}
        {filter === 'shared' && SHARED_IDS && (
          <div className="ctx-bar shared">
            <span>👋 A weekend shared with you · {SHARED_IDS.size} picks</span>
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
                key={`${dealKey}-${filter}-${when}`}
                picks={deck}
                onSwipe={handleStackSwipe}
                onRefresh={refresh}
                onOpen={setDetail}
                paused={detail !== null || intro}
                filterLabel={filterActive ? 'this filter' : null}
                onClearFilter={() => { setFilter('all'); setWhen('all') }}
                onSeeList={() => setView('list')}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list" className="view-pane view-pane--scroll"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <ListView picks={shown} savedIds={saved} onSwipe={handleListToggle} onOpen={setDetail} listStyle={listStyle} />
            </motion.div>
          )}
        </main>
      </motion.div>

      {toast && <div className="toast">↻ {toast}</div>}

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
        activeCount={ACTIVE_SOURCES}
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
        options={[FILTERS[0], { key: 'saved' as Filter, label: '★ Saved', count: saved.size }, ...FILTERS.slice(1)]}
        active={filter}
        onSelect={setFilter}
      />
    </>
  )
}
