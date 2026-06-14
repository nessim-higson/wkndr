import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Shuffle, Clock, ChevronDown, LayoutGrid, Star, ArrowUpRight, LocateFixed, Info, RotateCw, RotateCcw, X, Heart } from 'lucide-react'

// subtle haptic on commit/save (Android/Chrome; iOS Safari ignores navigator.vibrate)
const haptic = (ms = 10) => { try { navigator.vibrate?.(ms) } catch { /* unsupported */ } }
import type { Mode, Pick, SwipeDir } from './types'
import { MODES, MODE_META, classify, applyMode, rankPicks } from './weather/modes'
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
import { MatchGame } from './components/MatchGame'
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
// the header degrees take on the live weather's hue — a cool day reads cool, a hot day warm —
// so the number itself signals the mood (muted tints, readable on the cream pill)
const TEMP_TINT: Record<Mode, string> = {
  HOT: '#c2310e', WARM: '#b5791f', COOL: '#3f7d74', COLD_WET: '#4a6491', VOLATILE: '#7a5a7a',
}
import { CATEGORY_LABEL, type Category } from './types'
import { fixWhen, whenDayGroup, whenSortKey, whenTime } from './lib/when'
import { inShared } from './lib/share'
import {
  type Taste, applySwipe, hasTaste, loadSaved, loadTaste, persistSaved, persistTaste,
} from './taste'
import './App.css'

// `filter` is now just the top-level MODE (browse / saved / shared). The category + when axes are
// MULTI-SELECT sets layered on top — tick several and they combine (a union).
type Filter = 'all' | 'saved' | 'shared'
type CatKey = 'kids' | Category               // category sheet keys (kids = a cross-cut)
type FilterOpt = { key: CatKey | 'all'; label: string; count: number }
// the WHEN axis — time-sensitivity + two evergreen "tiers" (classic = well-known staples,
// bespoke = cooler/curated finds) so you can browse the library by flavour.
type When = Freshness | 'classic' | 'bespoke'   // selectable when-keys (no 'all' — empty set = any time)
type WhenKey = When | 'all'
type WhenOpt = { key: WhenKey; label: string; count: number }

// the city we boot into: ?city= override, else the default (Amsterdam). Live geolocation
// can switch it later (goLive) if it lands somewhere we have a feed for.
const INITIAL_CITY: City =
  cityByKey(new URLSearchParams(window.location.search).get('city')) ?? DEFAULT_CITY

type View = 'stack' | 'list' | 'fan'
// `temp` is the headline number; `label` is the window it describes ("This weekend" / a
// preview). The live forecast describes the COMING WEEKEND, not the current hour.
interface Wx { temp: number; hi: number; lo: number; city: string; label?: string }

// Pick the upcoming weekend (Sat+Sun) out of a daily forecast's date list. If today is the
// weekend, use today onward. Returns the indices into the daily arrays + a human label.
function weekendWindow(times: string[]): { idx: number[]; label: string } {
  const dow = times.map((t) => new Date(`${t}T12:00:00`).getDay())   // 0 Sun … 6 Sat
  const mon = (t: string) => new Date(`${t}T12:00:00`).toLocaleDateString('en', { month: 'short' })
  const dayNum = (t: string) => new Date(`${t}T12:00:00`).getDate()
  const shortDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let idx: number[] = []
  if (dow[0] === 0) idx = [0]                                         // today is Sun → this weekend = today
  else if (dow[0] === 6) idx = dow[1] === 0 ? [0, 1] : [0]            // today is Sat
  else {
    const s = dow.indexOf(6)                                         // next Saturday
    if (s === -1) { const su = dow.indexOf(0); idx = su === -1 ? [0] : [su] }
    else idx = (s + 1 < dow.length && dow[s + 1] === 0) ? [s, s + 1] : [s]
  }
  const a = idx[0], b = idx[idx.length - 1]
  // Compact, un-truncatable date for the header pill. The app is ABOUT weekends, so a range
  // doesn't need the redundant "Sat–Sun ·" prefix — "13–14 Jun" already reads as that weekend
  // and fits beside the temp with room. A single day keeps its (short) weekday for clarity.
  const label = idx.length > 1
    ? `${dayNum(times[a])}–${dayNum(times[b])} ${mon(times[b])}`
    : `${shortDay[dow[a]]} ${dayNum(times[a])} ${mon(times[a])}`
  return { idx, label }
}

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
  { key: 'auras', label: 'Auras' },
  { key: 'riso', label: 'Riso' },
  { key: 'forms', label: 'Forms' },
  { key: 'agradient', label: 'A Gradient' },
  { key: 'off', label: 'CSS' },
]
// the seeded looks expose a "Randomize" button (A Gradient is a continuous shader — no seed)
const SEEDED_FIELDS: Look[] = ['auras', 'riso', 'forms']

export default function App() {
  const [mode, setMode] = useState<Mode>('HOT')
  // a shared weekend opens on the FAN — the recipient sees everything you sent at once and taps
  // in, instead of a one-at-a-time Stack (confusing before the Match flow exists). Normal = Stack.
  const [view, setView] = useState<View>(SHARED_IDS ? 'fan' : 'stack')
  const [wx, setWx] = useState<Wx>(DEMO.HOT)
  const [live, setLive] = useState(false)        // true once the real forecast loads
  const [swiped, setSwiped] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(() => loadSaved())   // persisted
  const [taste, setTaste] = useState<Taste>(() => loadTaste())         // persisted taste profile
  const [toast, setToast] = useState<{ text: string; save?: boolean } | null>(null)
  // the last stack swipe, kept briefly so it can be UNDONE (Norman: error recovery)
  const [undoable, setUndoable] = useState<{ pick: Pick; dir: SwipeDir; wasSaved: boolean } | null>(null)
  const [undoShown, setUndoShown] = useState(false)   // surfaces only after you PAUSE — never mid-flurry
  const undoTimer = useRef<number | null>(null)
  const [locating, setLocating] = useState(false)   // weather/location fetch in flight
  const [visits] = useState(() => {                  // for progressive-reduction of hints
    const v = Number(localStorage.getItem('wkndr.visits') || 0) + 1
    localStorage.setItem('wkndr.visits', String(v))
    return v
  })
  const flash = (text: string, save = false) => setToast({ text, save })
  const [seed, setSeed] = useState(0)            // 0 = forecast order; bumped by Refresh
  const [dealKey, setDealKey] = useState(0)      // bump → stack re-deals (refresh signal)
  const [matching, setMatching] = useState(false)   // match-mode overlay
  const matchLaunched = useRef(false)
  const [detail, setDetail] = useState<Pick | null>(null)  // open card detail
  // where the detail should expand FROM (the tapped card's on-screen rect) — App Store style.
  // null → fall back to a centred grow. Cleared on close.
  const [detailOrigin, setDetailOrigin] = useState<DOMRect | null>(null)
  const openDetail = (p: Pick, origin?: DOMRect) => { setDetailOrigin(origin ?? null); setDetail(p) }
  const [inputsOpen, setInputsOpen] = useState(false)      // "what's feeding this" sheet
  const [filter, setFilter] = useState<Filter>(SHARED_IDS ? 'shared' : 'all')  // mode: browse / saved / shared
  const [cats, setCats] = useState<CatKey[]>([])           // What: multi-select categories (empty = all)
  const [whens, setWhens] = useState<When[]>([])           // When: multi-select time/tier (empty = any time)
  const [shareOpen, setShareOpen] = useState(false)        // "My Weekend" share sheet
  const [shareNudgeOff, setShareNudgeOff] = useState(() => localStorage.getItem('wkndr.sharenudge') === 'off')
  const dismissShareNudge = () => { setShareNudgeOff(true); localStorage.setItem('wkndr.sharenudge', 'off') }
  // toggle helpers for the multi-select sheets ('all'/'any' clears the set)
  const toggleCat = (k: CatKey | 'all') => setCats((p) => k === 'all' ? [] : p.includes(k) ? p.filter((x) => x !== k) : [...p, k])
  const toggleWhen = (k: WhenKey) => setWhens((p) => k === 'all' ? [] : p.includes(k) ? p.filter((x) => x !== k) : [...p, k])
  const [filterOpen, setFilterOpen] = useState(false)      // What sheet
  const [whenOpen, setWhenOpen] = useState(false)          // When sheet
  const [look, setLook] = useState<Look>(() => {       // ambient field (validated)
    const s = localStorage.getItem('wkndr.field') as Look
    return FIELD_OPTS.some((o) => o.key === s) ? s : 'silk'
  })
  const [fieldReroll, setFieldReroll] = useState(0)   // bump → reroll the seeded field's composition
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
  // Dates are normalized HERE (once) so every surface — cards, saves dock, fan, detail, share —
  // shows a weekday that actually matches the date (the feed's can be wrong/stale).
  const rawPicks = feeds[city.key]?.picks ?? city.picks
  const cityPicks = useMemo(
    () => rawPicks.map((p) => (p.when ? { ...p, when: fixWhen(p.when) } : p)),
    [rawPicks],
  )
  // resolve the share-link tokens (short codes, or legacy full ids) against the ACTIVE pool —
  // everything downstream (filter, save-all, match deck) works in real pick ids
  const sharedPickIds = useMemo(
    () => (SHARED_IDS ? new Set(cityPicks.filter((p) => inShared(p, SHARED_IDS)).map((p) => p.id)) : null),
    [cityPicks],
  )
  // a shared link (?w=codes&from=Name) IS a match invite — the sender's picks are the partner's yes-set
  const matchPartner = useMemo<{ name: string; ids: string[] } | null>(
    () => (SHARED_IDS ? { name: SHARED_FROM || 'A friend', ids: sharedPickIds ? [...sharedPickIds] : [] } : null),
    [sharedPickIds],
  )
  const feedAt = feeds[city.key]?.generatedAt ?? null

  // Everything that used to be derived from the single static PICKS set is now derived from
  // the ACTIVE city's pool — so switching city swaps the whole feed (filters, counts, deck).
  const present = useMemo<Category[]>(() => [...new Set(cityPicks.map((p) => p.category))], [cityPicks])
  const FILTERS = useMemo<FilterOpt[]>(() => [
    { key: 'all', label: 'Everything', count: cityPicks.length },
    ...(cityPicks.some((p) => p.kid) ? [{ key: 'kids' as CatKey, label: 'Kids', count: cityPicks.filter((p) => p.kid).length }] : []),
    ...present.map((c) => ({ key: c as CatKey, label: CATEGORY_LABEL[c], count: cityPicks.filter((p) => p.category === c).length })),
  ], [cityPicks, present])
  const WHEN_FILTERS = useMemo<WhenOpt[]>(() => ([
    { key: 'all', label: 'Any time', count: cityPicks.length },
    { key: 'weekend', label: 'This weekend', count: cityPicks.filter((p) => p.freshness === 'weekend').length },
    { key: 'new', label: 'New this week', count: cityPicks.filter((p) => p.freshness === 'new').length },
    { key: 'always', label: 'Evergreen · all', count: cityPicks.filter((p) => p.freshness === 'always').length },
    { key: 'classic', label: 'Evergreen · classics', count: cityPicks.filter((p) => p.freshness === 'always' && p.tier === 'classic').length },
    { key: 'bespoke', label: 'Evergreen · bespoke', count: cityPicks.filter((p) => p.freshness === 'always' && p.tier === 'bespoke').length },
    { key: 'ending', label: 'Ending soon', count: cityPicks.filter((p) => p.freshness === 'ending').length },
  ] as WhenOpt[]).filter((o) => o.count > 0), [cityPicks])
  const activeSources = useMemo(() => new Set(cityPicks.map((p) => p.source)).size, [cityPicks])
  // multi-select summary labels for the two filter triggers ("Eat +2", "This weekend +1")
  const catLabel = (k: CatKey) => (k === 'kids' ? 'Kids' : CATEGORY_LABEL[k])
  const whenLabel = (w: When) => WHEN_FILTERS.find((x) => x.key === w)?.label ?? 'Any time'
  const catSummary = cats.length === 0 ? 'Everything' : cats.length === 1 ? catLabel(cats[0]) : `${catLabel(cats[0])} +${cats.length - 1}`
  const whenSummary = whens.length === 0 ? 'Any time' : whens.length === 1 ? whenLabel(whens[0]) : `${whenLabel(whens[0])} +${whens.length - 1}`

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

  // the Undo affordance only appears once you PAUSE (a fast swipe streak keeps resetting the
  // settle timer in handleStackSwipe, so it never pops up to fight you) — then lingers ~5s.
  useEffect(() => {
    if (!undoShown) return
    const id = setTimeout(() => { setUndoable(null); setUndoShown(false) }, 5000)
    return () => clearTimeout(id)
  }, [undoShown])
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])
  // opening a shared link launches the match game once the intro lifts — you swipe their picks to
  // find what you both want. Closing it drops you onto the shared list (the 💌 banner can re-launch).
  useEffect(() => {
    if (matchPartner && !intro && !matchLaunched.current) { matchLaunched.current = true; setMatching(true) }
  }, [intro, matchPartner])

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
  const rankedAll = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => rankPicks(cityPicks, mode, hasTaste(tasteRef.current) ? tasteRef.current : undefined, seed),
    [cityPicks, mode, seed],   // seed jitters the order ("show me more"); NOT [taste] — keeps the deck stable while swiping
  )
  const shown = useMemo(
    () => {
      const matchesWhen = (p: Pick, w: When) =>
        w === 'classic' ? (p.freshness === 'always' && p.tier === 'classic')
          : w === 'bespoke' ? (p.freshness === 'always' && p.tier === 'bespoke')
          : p.freshness === w
      const filtered = rankedAll.filter((p) => {
        if (filter === 'saved') return saved.has(p.id)
        if (filter === 'shared') return !!sharedPickIds?.has(p.id)
        // browse: multi-select category + when (empty set = no constraint; selections are a UNION)
        const whatOk = cats.length === 0 || cats.some((c) => (c === 'kids' ? p.kid : p.category === c))
        const whenOk = whens.length === 0 || whens.some((w) => matchesWhen(p, w))
        return whatOk && whenOk
      })
      // RESERVE: in the default browse (no filter), lead with the weekend's time-sensitive picks and
      // hold the deep evergreen library back — only a rotating sample surfaces, and Shuffle (seed)
      // rotates it, so "show me more" keeps revealing fresh evergreens without flooding the feed.
      // Any explicit filter (incl. the Evergreen tiers) shows the full set.
      if (filter !== 'all' || cats.length > 0 || whens.length > 0) return filtered
      const RESERVE = 12
      const fresh = filtered.filter((p) => p.freshness !== 'always')
      const ever = filtered.filter((p) => p.freshness === 'always')
      if (ever.length <= RESERVE) return filtered
      const start = (seed * RESERVE) % ever.length
      const sample = [...ever, ...ever].slice(start, start + RESERVE)
      return [...fresh, ...sample]
    },
    [rankedAll, filter, cats, whens, saved, seed, sharedPickIds],
  )
  const filterActive = filter !== 'all' || cats.length > 0 || whens.length > 0
  const deck = useMemo(() => shown.filter((p) => !swiped.has(p.id)), [shown, swiped])
  // saved picks in rank order — fuels the saves-dock peek
  const savedPicks = useMemo(() => rankedAll.filter((p) => saved.has(p.id)), [rankedAll, saved])
  // …grouped into a day-by-day itinerary for the saves dock: dated picks first (chronological,
  // sorted by time within a day), evergreen ("Anytime") last. This is the "breakdown by day +
  // time" view when you open your list.
  const savedGroups = useMemo(() => {
    const groups = new Map<string, { label: string; order: number; items: Pick[] }>()
    for (const p of savedPicks) {
      const g = whenDayGroup(p.when)
      const order = whenSortKey(p.when)
      const grp = groups.get(g.key) ?? { label: g.label, order, items: [] }
      grp.items.push(p)
      grp.order = Math.min(grp.order, order)
      groups.set(g.key, grp)
    }
    return [...groups.values()]
      .map((grp) => ({ ...grp, items: [...grp.items].sort((a, b) => whenSortKey(a.when) - whenSortKey(b.when)) }))
      .sort((a, b) => a.order - b.order)
  }, [savedPicks])

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

  // "Show me more" / Shuffle: bump the seed so the ranking JITTERS — different picks lead,
  // not the same high-scorers. Keep what you've already seen hidden so "more" really is more;
  // only start the pool over once you've been through most of it.
  function refresh() {
    setSeed((s) => s + 1)
    setDealKey((k) => k + 1)
    const nearlyDone = deck.length <= Math.max(3, Math.round(shown.length * 0.25))
    if (nearlyDone) { setSwiped(new Set()); flash('Starting fresh') }
    else flash('More for you')
  }

  function handleStackSwipe(p: Pick, dir: SwipeDir) {
    const wasSaved = saved.has(p.id)
    setSwiped((s) => new Set(s).add(p.id))
    if (dir === 'like' || dir === 'save') {
      setSaved((s) => new Set(s).add(p.id))   // the header counter turns orange + bumps — that's the confirmation
    }
    setTaste((t) => applySwipe(t, p, dir))   // every swipe teaches it
    setUndoable({ pick: p, dir, wasSaved })  // offer a brief take-back…
    // …but defer showing it: each swipe resets a settle timer, so the pill only appears once
    // you've genuinely STOPPED (1.1s — longer than any rapid-streak gap, so it never animates
    // in/out between fast swipes and never stutters the next fling).
    setUndoShown(false)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndoShown(true), 1100)
  }
  // bring the last-swiped card back to the top (un-swipe → it re-enters the ranked deck
  // at its old position, which was the front). Un-saves only if the swipe was what saved it.
  function undoSwipe() {
    if (!undoable) return
    const { pick, dir, wasSaved } = undoable
    setSwiped((s) => { const n = new Set(s); n.delete(pick.id); return n })
    if ((dir === 'like' || dir === 'save') && !wasSaved) {
      setSaved((s) => { const n = new Set(s); n.delete(pick.id); return n })
    }
    setUndoable(null)
    setUndoShown(false)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    haptic(8)
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
    setFilter('all'); setCats([]); setWhens([])
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
    setFilter('all'); setCats([]); setWhens([])
    setSwiped(new Set()); setSeed(0); setDealKey((k) => k + 1)
    if (!autoSwitch) { setView('stack'); setBarOpen(false); goLive(c.lat, c.lon) }
  }

  function locate() {
    if (!navigator.geolocation) return
    setLocating(true)   // feedback starts the moment you ask — not once the fix lands
    navigator.geolocation.getCurrentPosition(
      (pos) => goLive(pos.coords.latitude, pos.coords.longitude),
      () => goLive(city.lat, city.lon),
      // maximumAge: accept a cached OS fix (≤10 min old) — the single biggest wait was the
      // device acquiring a FRESH fix; for city-level weather a recent one is just as good.
      { timeout: 8000, maximumAge: 600_000 },
    )
  }
  async function goLive(lat: number, lon: number) {
    setLocating(true)
    try {
      // the app is about the COMING WEEKEND — pull the week's daily forecast and read the
      // weekend out of it, not today's weather. Forecast + reverse-geocode run in PARALLEL
      // (they used to be sequential), and the geocode is capped at 2.5s so a slow lookup
      // can only ever delay the city NAME, never the weather.
      const wP = fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=10`,
      ).then((r) => r.json())
      const gP = fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}`,
        { signal: AbortSignal.timeout(2500) },
      ).then((r) => r.json()).catch(() => null)
      const [w, g] = await Promise.all([wP, gP])
      let placeName = city.name
      if (g) placeName = g.city || g.locality || g.principalSubdivision || placeName
      // if the live location is somewhere we actually have a feed for, swap to it
      const matched = cityByName(placeName) ?? nearestCity(lat, lon)
      if (matched && matched.key !== city.key) selectCity(matched, true)
      const dly = w.daily
      const { idx, label } = weekendWindow(dly.time as string[])
      const his = idx.map((i) => dly.temperature_2m_max[i])
      const los = idx.map((i) => dly.temperature_2m_min[i])
      const pps = idx.map((i) => dly.precipitation_probability_max[i] ?? 0)
      const hi = Math.round(Math.max(...his))
      const lo = Math.round(Math.min(...los))
      const pp = Math.max(...pps)
      const m = classify(hi, pp, hi - lo)   // classify the WEEKEND
      setMode(m)
      setWx({ temp: hi, hi, lo, city: placeName, label })
      setLive(true)
    } catch { /* keep current */ }
    finally { setLocating(false) }
  }

  return (
    <>
      <AmbientField mode={mode} look={look} onLookChange={setLook} rerollNonce={fieldReroll} />

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
                  <span className="tb-when">
                    {locating ? 'Locating…' : live && wx.label ? wx.label : wx.city}
                  </span>
                  <span className="tb-temp" style={{ color: TEMP_TINT[mode] }}>{wx.temp}°</span>
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
                        <button className={`filter-trigger${whens.length > 0 ? ' on' : ''}`} onClick={() => setWhenOpen(true)}>
                          <Clock className="ft-icon" size={14} strokeWidth={2.2} /> {whenSummary}<ChevronDown className="ft-caret" size={14} strokeWidth={2.2} />
                        </button>
                        <button className={`filter-trigger${cats.length > 0 ? ' on' : ''}`} onClick={() => setFilterOpen(true)}>
                          <LayoutGrid className="ft-icon" size={14} strokeWidth={2.2} /> {catSummary}<ChevronDown className="ft-caret" size={14} strokeWidth={2.2} />
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
                      <span className="bar-label">Plan together</span>
                      <div className="bar-row">
                        <button className="bar-pill bar-pill--match" onClick={() => { setShareOpen(true); setBarOpen(false) }}>
                          <Heart size={14} strokeWidth={2.4} fill="currentColor" /> Match with someone
                        </button>
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
                      {SEEDED_FIELDS.includes(look) && (
                        <button className="bar-pill" style={{ marginTop: 8 }} onClick={() => setFieldReroll((n) => n + 1)}>
                          <Shuffle size={14} strokeWidth={2.2} /> Randomize
                        </button>
                      )}
                    </div>

                    <button className="bar-foot" onClick={() => { setInputsOpen(true); setBarOpen(false) }}>
                      <Info size={13} strokeWidth={2.2} /> Built from {city.sourceCount} sources · weather × freshness{hasTaste(taste) ? ' × you' : ''}
                    </button>
                    <span className="bar-build">{APP_VERSION}</span>
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
                          {savedGroups.map((group) => (
                            <div className="sv-group" key={group.label}>
                              <div className="sv-group-label">{group.label}</div>
                              {group.items.map((p) => {
                                const t = whenTime(p.when)
                                return (
                                  <div className="sv-row" key={p.id}>
                                    <button className="sv-rowmain" onClick={() => { openDetail(p); setSavesOpen(false) }}>
                                      <span className="sv-thumb" style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}>
                                        {!p.image && <span className="sv-thumb-cat">{CATEGORY_LABEL[p.category]}</span>}
                                      </span>
                                      <span className="sv-meta">
                                        <span className="sv-name">{p.title}</span>
                                        <span className="sv-sub-line">
                                          <span className="sv-cat">{CATEGORY_LABEL[p.category]}</span>
                                          {t && <span className="sv-time">{t}</span>}
                                        </span>
                                      </span>
                                    </button>
                                    <button className="sv-remove" aria-label={`Remove ${p.title}`} onClick={() => toggleSave(p)}>
                                      <X size={15} strokeWidth={2.4} />
                                    </button>
                                  </div>
                                )
                              })}
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
            <span>💌 {SHARED_FROM || 'A friend'} shared {sharedPickIds?.size || SHARED_IDS.size} picks</span>
            <button className="ctx-match" onClick={() => setMatching(true)}><Heart size={13} strokeWidth={2.6} fill="currentColor" /> Match</button>
            <button onClick={() => setSaved((s) => new Set([...s, ...(sharedPickIds ?? [])]))}>Save all</button>
          </div>
        )}
        {/* Share nudge — appears once you've saved enough to be worth planning together (and not
            already in a saved/shared context). Dismissible; it's the growth lever for matching.
            Yields while the undo pill is up — they share the under-header slot. */}
        {!shareNudgeOff && saved.size >= 3 && !SHARED_IDS && filter === 'all' && !intro && !(undoable && undoShown) && (
          <div className="ctx-bar nudge">
            <span>💛 Plan these together</span>
            <button className="ctx-match" onClick={() => { setShareOpen(true) }}><Heart size={13} strokeWidth={2.6} fill="currentColor" /> Match</button>
            <button className="ctx-x" onClick={dismissShareNudge} aria-label="Dismiss"><X size={15} strokeWidth={2.5} /></button>
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
                key={`${dealKey}-${filter}-${cats.join(',')}-${whens.join(',')}-${intro ? 'intro' : 'live'}`}
                picks={deck}
                temp={wx.temp}
                mode={mode}
                onSwipe={handleStackSwipe}
                onOpen={openDetail}
                onRefresh={refresh}
                filterLabel={filterActive ? 'this filter' : null}
                onClearFilter={() => { setFilter('all'); setCats([]); setWhens([]) }}
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
              <FanView picks={shown} onOpen={openDetail} mode={mode} />
            </motion.div>
          ) : (
            <motion.div
              key="list" className="view-pane view-pane--scroll"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {filter === 'saved'
                ? <Itinerary picks={shown} onOpen={openDetail} onSwipe={handleListToggle} />
                : <ListView picks={shown} savedIds={saved} onSwipe={handleListToggle} onOpen={openDetail} listStyle={listStyle} />}
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

      {/* MATCH MODE — focused swipe-to-match over a partner's shared picks. A real ?w= link drives
          partnerName/partnerIds (the sender's yes-set); with no link it falls back to a demo.
          NOT inside AnimatePresence: the overlay got stuck mid-exit (opacity 0, pointer-events
          still on — an invisible wall that "froze" the whole app). MatchGame now runs its own
          fade-out and THEN asks to unmount, which can't strand it. */}
      {matching && (
        <MatchGame
          picks={rankedAll}
          temp={wx.temp}
          mode={mode}
          partnerName={matchPartner?.name ?? 'Robin'}
          partnerIds={matchPartner?.ids}
          onOpen={openDetail}
          onClose={() => setMatching(false)}
          onComplete={(m) => { setSaved((s) => new Set([...s, ...m.map((p) => p.id)])); flash(`${m.length} added to your list`, true) }}
        />
      )}

      {/* Undo — a brief take-back after a stack swipe (the card returns to the top). The
          full-width anchor flex-centres the pill so framer's animated transform can't
          knock it off-centre. */}
      <AnimatePresence>
        {undoable && undoShown && view === 'stack' && !intro && !barOpen && !savesOpen && (
          <motion.div
            key="undo"
            className="undo-anchor"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12, ease: 'easeIn' } }}
          >
            <button className="undo-bar" onClick={undoSwipe}>
              <span className="undo-what">
                {undoable.dir === 'save' || undoable.dir === 'like' ? 'Saved' : undoable.dir === 'nope' ? 'Passed' : 'Skipped'}
                <span className="undo-title"> · {undoable.pick.title}</span>
              </span>
              <span className="undo-action"><RotateCcw size={14} strokeWidth={2.5} /> Undo</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <CardDetail
        pick={detail}
        saved={detail ? saved.has(detail.id) : false}
        origin={detailOrigin}
        onClose={() => setDetail(null)}
        onToggleSave={toggleSave}
      />
      <InputsSheet
        open={inputsOpen}
        onClose={() => setInputsOpen(false)}
        mode={mode}
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
        selected={whens}
        onToggle={toggleWhen}
        clearKey={'all'}
      />
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Show me"
        options={FILTERS}
        selected={cats}
        onToggle={toggleCat}
        clearKey={'all'}
      />
    </>
  )
}
