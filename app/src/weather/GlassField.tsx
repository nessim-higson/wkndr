import { useEffect, useRef, useState } from 'react'
import type { GlassScene } from './glass'
import { WET_RECIPES, seedForNow, wetGlassSupported } from './wetglass'
import { WetGlassPane } from './WetGlassPane'
import './GlassField.css'

// Fixed, irregular placement: no random layout changes on a save, swipe or re-render.
// (The CSS fallback pane — drawn only where WebGL2 is missing.)
const DROPS = Array.from({ length: 96 }, (_, i) => ({
  x: ((i * 73 + i * i * 19 + 31) % 997) / 10,
  y: ((i * 139 + i * i * 11 + 17) % 991) / 10,
  size: 3 + ((i * 17) % 10),
  stretch: i % 9 === 0 ? 2.6 : 1.15,
  delay: -(i % 17),
}))

/** The entire weather surface is below .app. Opaque card faces physically occlude
 *  every droplet, even mid-drag — no measured masks, no rain painted onto photos.
 *
 *  THE PANE (2026-09-12): on WebGL2 the sky is drawn THROUGH wet glass by WetGlassPane.ts —
 *  the plate, lensed by beads, softened by condensation, with trails and flakes as the
 *  recipe says (wetglass.ts). The CSS layers below are the fallback for a device without
 *  WebGL2, kept exactly as the branch first shipped them. */
export function GlassField({ scene, moving }: { scene: GlassScene; moving: boolean }) {
  const [visible, setVisible] = useState(() => !document.hidden)
  const [gl] = useState(() => wetGlassSupported())
  const hostRef = useRef<HTMLDivElement>(null)
  const paneRef = useRef<WetGlassPane | null>(null)

  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  // mount the pane once; scene + motion changes are pushed into it, never remounted
  useEffect(() => {
    if (!gl || !hostRef.current) return
    let pane: WetGlassPane | null = null
    try {
      pane = new WetGlassPane()
      pane.mount(hostRef.current, WET_RECIPES[scene], seedForNow(), moving)
    } catch { pane?.destroy(); return }   // a context that fails to create → the CSS pane stays
    paneRef.current = pane
    const fit = () => pane!.resize()
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('resize', fit); pane!.destroy(); paneRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])
  useEffect(() => { paneRef.current?.setRecipe(WET_RECIPES[scene]) }, [scene])
  useEffect(() => { paneRef.current?.setMoving(moving) }, [moving])

  const live = gl && !!paneRef.current
  const wet = ['rain', 'storm'].includes(scene)
  const count = scene === 'storm' ? 96 : scene === 'rain' ? 72 : scene === 'mist' ? 36 : 24
  return <div ref={hostRef} className="field glass-field" data-scene={scene} data-moving={moving && visible} data-pane={gl ? 'gl' : 'css'} aria-hidden="true">
    {!gl && <div className="glass-sky" />}
    <div className="glass-light" />
    <div className="glass-cloud glass-cloud-one" />
    <div className="glass-cloud glass-cloud-two" />
    <div className="glass-haze" />
    {!live && wet && <div className="glass-rain">{DROPS.slice(0, count).map((d, i) =>
      <i key={i} className={`glass-drop${i % 9 === 0 ? ' glass-drop-trail' : ''}`} style={{
        left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size * d.stretch,
        '--delay': `${d.delay}s`, '--duration': `${19 + i % 13}s`,
      } as React.CSSProperties} />)}</div>}
    {!live && scene === 'snow' && <div className="glass-snow">{DROPS.slice(0, 48).map((d, i) =>
      <i key={i} style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size / 2, height: d.size / 2,
        '--delay': `${d.delay}s`, '--duration': `${24 + i % 12}s` } as React.CSSProperties} />)}</div>}
  </div>
}
