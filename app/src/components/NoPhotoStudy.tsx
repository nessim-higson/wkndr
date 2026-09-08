import { useEffect, useState } from 'react'
import type { Pick } from '../types'
import { Card } from './Card'
import { applyMode } from '../weather/modes'
import './NoPhotoStudy.css'

// Review surface only: real blanks from the same feed; the named stress fixture is
// explicitly separate and never enters the ranked deck or saved picks.
export function NoPhotoStudy() {
  const [picks, setPicks] = useState<Pick[]>([])
  useEffect(() => {
    applyMode('COOL')
    const controller = new AbortController()
    fetch(`${import.meta.env.VITE_DATA_ORIGIN || import.meta.env.BASE_URL}data/picks.amsterdam.json`, { signal: controller.signal })
      .then(r => r.json()).then(data => setPicks(data.picks.filter((p: Pick) => !p.image)))
      .catch(() => {})
    return () => controller.abort()
  }, [])
  const selected = ['web-lbb-liefde-op-de-grachten-30-jaar-canal-parade', 'web-lbb-larissa-sansour-rogue-agents-of-history', 'web-iams-museum-market'].map(id => picks.find(p => p.id === id)).filter((p): p is Pick => !!p)
  const fixture = selected[0] && { ...selected[0], title: 'Nederlands Theater Festival & Amsterdam Fringe Festival', venue: 'Festival venues', price: '', area: '', id: 'type-stress', when: 'Typography study' }
  return <main className="np-study"><h1>The no-photo face</h1><p>Three real feed blanks · portrait and near-square · title 46px. Stress fixture labelled separately.</p>
    {[...selected, ...(fixture ? [fixture] : [])].map(p => <section key={p.id}><h2>{p.id === 'type-stress' ? 'Typography stress fixture — not a live listing' : p.title}</h2><div className="np-study-pair"><div className="np-study-tall"><Card pick={p} /></div><div className="np-study-square"><Card pick={p} /></div></div></section>)}
    {!selected.length && <p>Loading live blanks…</p>}
  </main>
}
