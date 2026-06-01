import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mode, Pick, SwipeDir } from './types'
import { MODES, MODE_META, classify, applyMode, rankPicks, shuffle } from './weather/modes'
import { PICKS } from './data/picks'
import { AmbientField } from './weather/AmbientField'
import type { Look } from './weather/ambientEngine'
import { SwipeStack } from './components/SwipeStack'
import { ListView } from './components/ListView'
import { CardDetail } from './components/CardDetail'
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

const today = new Date().toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'long',
}).toUpperCase()

// the ambient field looks the user can switch between (persisted to localStorage)
const FIELD_OPTS: { key: Look; label: string }[] = [
  { key: 'aura', label: 'Aura' },
  { key: 'warp', label: 'Warp' },
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
  const [showAdjust, setShowAdjust] = useState(false)
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
  const [look, setLook] = useState<Look>(() => (localStorage.getItem('wkndr.field') as Look) || 'warp')  // ambient field

  useEffect(() => { applyMode(mode) }, [mode])
  useEffect(() => { persistSaved(saved) }, [saved])   // your list survives reloads
  useEffect(() => { persistTaste(taste) }, [taste])   // your taste accumulates over time
  useEffect(() => { localStorage.setItem('wkndr.field', look) }, [look])   // your ambient-field choice sticks

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
  const rankedAll = useMemo(
    () => rankPicks(pool, mode, hasTaste(taste) ? taste : undefined),
    [pool, mode, taste],
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

      <div className="app">
        <header className="app-head">
          <div className="brand">WKNDR<span className="brand-sub">weekend brief</span></div>
          <div className="head-right">
            <button className="refresh-btn" onClick={refresh} title="Refresh picks" aria-label="Refresh picks">↻</button>
            <button
              className={`saved-count${filter === 'saved' ? ' on' : ''}`}
              onClick={() => { setFilter('saved'); setView('list') }}
              title="Your saved list"
            >★ {saved.size}</button>
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
        <button className="built-from" onClick={() => setInputsOpen(true)}>
          ⓘ Built from {SOURCE_COUNT} sources · weather × freshness{hasTaste(taste) ? ' × you' : ''}
        </button>

        <div className="filter-bar">
          <button
            className={`filter-trigger${when !== 'all' ? ' on' : ''}`}
            onClick={() => setWhenOpen(true)}
          >
            <span className="ft-icon">◷</span> {whenLabel(when)}<span className="ft-caret">⌄</span>
          </button>
          <button
            className={`filter-trigger${filter !== 'all' ? ' on' : ''}`}
            onClick={() => setFilterOpen(true)}
          >
            <span className="ft-icon">⊞</span> {filter === 'all' ? 'Everything' : filterLabel(filter)}<span className="ft-caret">⌄</span>
          </button>
        </div>

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
          {view === 'stack' && (
            <SwipeStack
              key={`${dealKey}-${filter}-${when}`}
              picks={deck}
              onSwipe={handleStackSwipe}
              onRefresh={refresh}
              onOpen={setDetail}
              filterLabel={filterActive ? 'this filter' : null}
              onClearFilter={() => { setFilter('all'); setWhen('all') }}
              onSeeList={() => setView('list')}
            />
          )}
          {view === 'list' && (
            <ListView picks={shown} savedIds={saved} onSwipe={handleListToggle} onOpen={setDetail} />
          )}
        </main>

        <div className="controls">
          <button className={`adjust-toggle${showAdjust ? ' on' : ''}`} onClick={() => setShowAdjust((v) => !v)}>
            ⚙ Adjust
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
              <span className="adjust-label">Ambient field</span>
              <div className="mode-pills field-pills">
                {FIELD_OPTS.map((o) => (
                  <button key={o.key} className={o.key === look ? 'on' : ''} onClick={() => setLook(o.key)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
