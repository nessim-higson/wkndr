import { useEffect, useState, type CSSProperties } from 'react'
import type { GlassScene } from './glass'
import './GlassField.css'

// Fixed, irregular placement: no random layout changes on a save, swipe or re-render.
const DROPS = Array.from({ length: 96 }, (_, i) => ({
  x: ((i * 73 + i * i * 19 + 31) % 997) / 10,
  y: ((i * 139 + i * i * 11 + 17) % 991) / 10,
  size: 3 + ((i * 17) % 10),
  stretch: i % 9 === 0 ? 2.6 : 1.15,
  delay: -(i % 17),
}))

/** The entire weather surface is below .app. Opaque card faces physically occlude
 *  every droplet, even mid-drag — no measured masks, no rain painted onto photos. */
export function GlassField({ scene, moving }: { scene: GlassScene; moving: boolean }) {
  const [visible, setVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  const wet = ['rain', 'storm', 'mixed', 'mist'].includes(scene)
  const count = scene === 'storm' ? 96 : scene === 'rain' ? 72 : scene === 'mist' ? 36 : 24
  return <div className="field glass-field" data-scene={scene} data-moving={moving && visible} aria-hidden="true">
    <div className="glass-light" />
    <div className="glass-cloud glass-cloud-one" />
    <div className="glass-cloud glass-cloud-two" />
    <div className="glass-haze" />
    {wet && <div className="glass-rain">{DROPS.slice(0, count).map((d, i) =>
      <i key={i} className={`glass-drop${i % 9 === 0 ? ' glass-drop-trail' : ''}`} style={{
        left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size * d.stretch,
        '--delay': `${d.delay}s`, '--duration': `${19 + i % 13}s`,
      } as CSSProperties} />)}</div>}
    {scene === 'snow' && <div className="glass-snow">{DROPS.slice(0, 48).map((d, i) =>
      <i key={i} style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size / 2, height: d.size / 2,
        '--delay': `${d.delay}s`, '--duration': `${24 + i % 12}s` } as CSSProperties} />)}</div>}
  </div>
}
