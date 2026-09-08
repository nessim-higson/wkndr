import { useEffect, useState } from 'react'
import { Star, SlidersHorizontal } from 'lucide-react'
import type { Pick } from '../types'
import { SwipeStack } from './SwipeStack'
import { FaceControls } from './FaceControls'
import { whenIsPast } from '../lib/when'
import { applyMode } from '../weather/modes'
import './NoPhotoStudy.css'

/** Isolated interaction study. Real feed records; no fixture enters the real deck. */
export function NoPhotoStudy() {
  const [picks, setPicks] = useState<Pick[]>([])
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
  const blanks = picks.filter(p => !p.image)
  const photos = picks.filter(p => p.image)
  const current = blanks[front % (blanks.length || 1)]
  const underneath = photos[behind % (photos.length || 1)]
  const next = photos[(behind + 1) % (photos.length || 1)]
  return <>
    <main className="np-app-study">
      <header><div><strong>WKNDR<span>•</span></strong><p>Amsterdam</p></div><span className="np-study-saves"><Star size={20} /> {saved}</span></header>
      <div className="np-study-filters"><span>This weekend</span><span>All interests</span><SlidersHorizontal size={18} /></div>
      <div className="np-study-deck">{current && underneath && <SwipeStack picks={[current, underneath, ...(next ? [next] : [])]} keysActive={false} onSwipe={(_,dir) => { if(dir === 'save' || dir === 'like') setSaved(n=>n+1); setFront(n=>n+1) }} />}</div>
      <div className="np-study-tools">
        <button onClick={() => setBehind(n=>n+1)}>Change card underneath ↻</button>
        <p>{underneath ? `Underneath: ${underneath.title}` : error ? 'Feed unavailable. Reload to try again.' : 'Loading the live feed…'}</p>
        <p>Material study · saves stay in this preview</p>
        <a href="?">Open the full app →</a>
      </div>
    </main>
    <FaceControls />
  </>
}
