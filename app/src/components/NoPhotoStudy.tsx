import { useEffect, useState } from 'react'
import { Star, Cloud, Sun, Moon, CloudRain, CloudLightning, CloudFog, Snowflake } from 'lucide-react'
import type { Pick } from '../types'
import { SwipeStack } from './SwipeStack'
import { FaceControls, FACE_VARIANTS, CURRENT_VARIANTS } from './FaceControls'
import { whenIsPast } from '../lib/when'
import { applyMode } from '../weather/modes'
import './NoPhotoStudy.css'
import './CurrentMaterials.css'
import { useCurrentWeather } from './useCurrentWeather'

const referenceTitles: Pick[] = ['Museum Market', 'Nederlands Theater Festival & Amsterdam Fringe Festival'].map((title, i) => ({
  id: `reference-title-${i}`, title, venue: '', area: 'Amsterdam', when: 'This weekend',
  category: i === 0 ? 'market' : 'stage', freshness: 'always', outdoor: false, kid: false,
  price: '', blurb: '', why: '', source: 'Visual study', link: '', weatherFit: [],
}))

/** Isolated interaction study. Real feed records; no fixture enters the real deck. */
export function NoPhotoStudy() {
  const [variant,setVariant] = useState('glass-opal')
  const weatherSet = variant.startsWith('weather-current')
  const { reading, loading } = useCurrentWeather()
  const WeatherIcon = reading ? {clear:Sun,night:Moon,cloud:Cloud,fog:CloudFog,rain:CloudRain,snow:Snowflake,storm:CloudLightning}[reading.sky] : Cloud
  const [picks, setPicks] = useState<Pick[]>([])
  const [reference, setReference] = useState(false)
  const [front, setFront] = useState(0)
  const [behind, setBehind] = useState(0)
  const [saved, setSaved] = useState(0)
  const [error, setError] = useState(false)
  useEffect(() => {
    applyMode('COOL')
    const controller = new AbortController()
    fetch(`${import.meta.env.VITE_DATA_ORIGIN || import.meta.env.BASE_URL}data/picks.amsterdam.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Feed unavailable'); return r.json() })
      .then(data => setPicks(data.picks.filter((p: Pick) => !whenIsPast(p.when)))).catch(e => { if (e.name !== 'AbortError') setError(true) })
    return () => controller.abort()
  }, [])
  const blanks = reference ? referenceTitles : picks.filter(p => !p.image)
  const photos = picks.filter(p => p.image)
  const current = blanks[front % (blanks.length || 1)]
  const underneath = photos[behind % (photos.length || 1)]
  const next = photos[(behind + 1) % (photos.length || 1)]
  return <>
    <nav className="material-set-switch" aria-label="Compare card sets"><button aria-pressed={!weatherSet} onClick={()=>setVariant('glass-opal')}>Transparent glass</button><button aria-pressed={weatherSet} onClick={()=>setVariant('weather-current')}>Weather now</button></nav>
    <main className="np-app-study" data-current-weather={reading?.sky ?? 'unknown'}>
      <header><div><strong>WKNDR<span>•</span></strong><p>Amsterdam</p></div><span className="np-study-saves"><Star size={20} /> {saved}</span></header>
      <div className="np-study-filters"><span>Amsterdam discoveries</span><span>{weatherSet ? 'Weather-responsive surfaces' : 'Luminous glass surfaces'}</span></div>
      <div className="np-study-deck">{current && underneath && <SwipeStack picks={[current, underneath, ...(next ? [next] : [])]} keysActive={false} context={<div className="current-weather-strip" aria-live="polite"><WeatherIcon size={20}/><div><span>{reading ? `${Math.round(reading.temperature)}° · ${reading.label}` : loading ? 'Checking current weather…' : 'Current weather unavailable'}</span><small>{reading ? `Amsterdam estimate · ${new Date(reading.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'})}` : 'Neutral material until a fresh reading arrives'}</small></div></div>} onSwipe={(_,dir) => { if(dir === 'save' || dir === 'like') setSaved(n=>n+1); setFront(n=>n+1) }} />}</div>
      <div className="np-study-tools">
        <label>Cards <select aria-label="Study cards" value={reference ? 'reference' : 'live'} onChange={e => { setReference(e.target.value === 'reference'); setFront(0) }}><option value="live">Live feed</option><option value="reference">Reference titles</option></select></label>
        <button onClick={() => setBehind(n=>n+1)}>Change card underneath ↻</button>
        <p>{underneath ? `Underneath: ${underneath.title}` : error ? 'Feed unavailable. Reload to try again.' : 'Loading the live feed…'}</p>
        <p>{reference ? 'Reference title study · illustrative metadata' : 'Material study · saves stay in this preview'}</p>
        <a href="?">Open the full app →</a><a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Weather source · 15-minute model estimate</a>
      </div>
    </main>
    <FaceControls value={variant} onChange={setVariant} options={weatherSet ? CURRENT_VARIANTS : FACE_VARIANTS.filter(([key])=>key.startsWith('glass'))} />
  </>
}
