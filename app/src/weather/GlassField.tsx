import { useEffect, useMemo, useRef, useState } from 'react'
import type { GlassScene } from './glass'
import type { Daylight } from './daylight'
import { plateFor, gradeOn, seedForNow, wetGlassSupported } from './wetglass'
import { WetGlassPane, type PaneStats } from './WetGlassPane'
import { STILL_AIR, type Air } from './air'
import { TiltRest, pointerParallax } from './parallax'
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

/** iOS asks once per site whether a page may read the phone's motion; a refusal is remembered
 *  here so the first tap of every visit does not ask again. */
const TILT_KEY = 'wkndr.tilt'
const HUD = new URLSearchParams(location.search).get('hud') === '1'

/** The entire weather surface is below .app. Opaque card faces physically occlude
 *  every droplet, even mid-drag — no measured masks, no rain painted onto photos.
 *
 *  THE PANE (2026-09-12): on WebGL2 the sky is drawn THROUGH wet glass by WetGlassPane.ts —
 *  the plate, lensed by beads, softened by condensation, with runners, rain and flakes as the
 *  recipe says (wetglass.ts) — graded by the sun (daylight.ts) and leaning with the wind
 *  (air.ts). The CSS layers below are the fallback for a device without WebGL2, kept exactly
 *  as the branch first shipped them. */
export function GlassField({ scene, daylight, moving, air = STILL_AIR }: { scene: GlassScene; daylight: Daylight; moving: boolean; air?: Air }) {
  const [gl] = useState(() => wetGlassSupported())
  const hostRef = useRef<HTMLDivElement>(null)
  const paneRef = useRef<WetGlassPane | null>(null)
  // the plate for this scene at this hour (a clear sky swaps plates), and the grade on it
  const { recipe, native } = useMemo(() => plateFor(scene, daylight.phase), [scene, daylight.phase])
  const grade = useMemo(() => gradeOn(daylight, native), [daylight, native])

  // mount the pane once; scene, sun, wind and motion changes are pushed into it, never remounted
  useEffect(() => {
    if (!gl || !hostRef.current) return
    let pane: WetGlassPane | null = null
    try {
      pane = new WetGlassPane()
      pane.mount(hostRef.current, recipe, grade, seedForNow(), moving, air)
    } catch { pane?.destroy(); return }   // a context that fails to create → the CSS pane stays
    paneRef.current = pane
    ;(window as Window & { __wkndrPane?: WetGlassPane }).__wkndrPane = pane   // a handle for judging: __wkndrPane.stats()
    const fit = () => pane!.resize()
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('resize', fit); pane!.destroy(); paneRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])
  useEffect(() => { paneRef.current?.setRecipe(recipe) }, [recipe])
  useEffect(() => { paneRef.current?.setGrade(grade) }, [grade])
  useEffect(() => { paneRef.current?.setAir(air) }, [air])
  useEffect(() => { paneRef.current?.setMoving(moving) }, [moving])

  // PARALLAX (2026-10-26, parallax.ts): the pointer on desktop, the phone's tilt on a phone — the
  // latter behind iOS's permission prompt, which may only be raised from a tap, so it is asked on
  // the first pointerup of the visit (and not again once refused). Nothing listens with motion off.
  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    if (!moving) { pane.setParallax(0, 0); return }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const [x, y] = pointerParallax(e.clientX, e.clientY, window.innerWidth, window.innerHeight)
      pane.setParallax(x, y)
    }
    const onLeave = () => pane.setParallax(0, 0)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    const rest = new TiltRest()
    let lastT = 0
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      const now = performance.now()
      const dt = lastT ? (now - lastT) / 1000 : 0
      lastT = now
      const [x, y] = rest.read(e.beta, e.gamma, dt)
      pane.setParallax(x, y)
    }
    let listening = false
    const listen = () => { if (listening) return; listening = true; window.addEventListener('deviceorientation', onTilt, { passive: true }) }
    const DOE = (window as Window & { DeviceOrientationEvent?: typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> } }).DeviceOrientationEvent
    const ask = () => {
      DOE?.requestPermission?.().then((r) => { try { localStorage.setItem(TILT_KEY, r) } catch { /* private mode */ } if (r === 'granted') listen() }).catch(() => { /* not from a gesture, or refused */ })
    }
    let armed = false
    if (DOE && typeof DOE.requestPermission === 'function') {
      let refused = false
      try { refused = localStorage.getItem(TILT_KEY) === 'denied' } catch { /* private mode */ }
      if (!refused) { armed = true; window.addEventListener('pointerup', ask, { once: true }) }
    } else if (DOE) listen()   // Android and desktop fire without asking (or never fire, which costs nothing)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      if (armed) window.removeEventListener('pointerup', ask)
      if (listening) window.removeEventListener('deviceorientation', onTilt)
      pane.setParallax(0, 0)
    }
  }, [moving, gl])

  const live = gl && !!paneRef.current
  const wet = ['rain', 'storm'].includes(scene)
  const count = scene === 'storm' ? 96 : scene === 'rain' ? 72 : scene === 'mist' ? 36 : 24
  return <div ref={hostRef} className="field glass-field" data-scene={scene} data-daylight={daylight.phase} data-moving={moving} data-pane={gl ? 'gl' : 'css'} aria-hidden="true">
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
    {HUD && live && <PaneHud pane={paneRef} />}
  </div>
}

/** ?hud=1 — the pane's frame rate, budget, parallax and wind, for judging on a phone */
function PaneHud({ pane }: { pane: React.RefObject<WetGlassPane | null> }) {
  const [s, setS] = useState<PaneStats | null>(null)
  useEffect(() => {
    const id = window.setInterval(() => setS(pane.current?.stats() ?? null), 500)
    return () => window.clearInterval(id)
  }, [pane])
  if (!s) return null
  return <div className="glass-hud">{s.fps} fps · {s.budget === 16 ? '60' : '30'}{s.degraded ? ' (fell back)' : ''} · par {s.par[0].toFixed(2)} {s.par[1].toFixed(2)} · wind {s.air.x.toFixed(2)} / {s.air.force.toFixed(2)}</div>
}
