import { useEffect, useRef, useState } from 'react'
import type { Mode } from '../types'
import { WeatherField } from './WeatherField'
import { MODE_META } from './modes'
import { FieldEngine, type Look, type FieldStats } from './ambientEngine'
import type { LookRenderer } from './looks/types'
import { AurasRenderer } from './looks/auras'
import { RisoRenderer } from './looks/riso'
import { FormsRenderer } from './looks/forms'
import { AGradientRenderer } from './looks/agradient'
import './WeatherField.css'

// the static base gradient (same recipe as WeatherField) — guarantees the field is
// never blank before the canvas paints, and is the graceful fallback if canvas is off
function baseGradient(mode: Mode): string {
  const f = MODE_META[mode].field
  return [
    `radial-gradient(ellipse 90% 60% at 50% 4%, ${f.glow} 0%, transparent 55%)`,
    `radial-gradient(ellipse 85% 70% at 74% 60%, ${f.c2} 0%, transparent 60%)`,
    `radial-gradient(ellipse 75% 60% at 16% 94%, ${f.c3} 0%, transparent 65%)`,
    `linear-gradient(180deg, ${f.c1} 0%, ${f.c2} 56%, ${f.c3} 100%)`,
  ].join(', ')
}

// the four ported looks, each rendered by its own pluggable LookRenderer (own canvas)
const RENDERERS: Partial<Record<Look, () => LookRenderer>> = {
  auras: () => new AurasRenderer(),
  riso: () => new RisoRenderer(),
  forms: () => new FormsRenderer(),
  agradient: () => new AGradientRenderer(),
}

const LOOKS: Look[] = ['off', 'silk', 'auras', 'riso', 'forms', 'agradient']
const LOOK_LABEL: Record<Look, string> = {
  off: 'CSS', silk: 'Silk', auras: 'Auras', riso: 'Riso', forms: 'Forms', agradient: 'A Gradient',
  dunes: 'Dunes', ink: 'Ink', rings: 'Rings', dots: 'Dots',                                  // legacy
  aura: 'Aura', warp: 'Warp', aurora: 'Aurora', mesh: 'Mesh', metaball: 'Metaball',          // legacy
}
const DEV = import.meta.env.DEV

/**
 * Drop-in for <WeatherField>. Renders a generative ambient field behind everything,
 * driven by the mode palette. `off` renders the real production WeatherField, `silk`
 * uses the original low-res FieldEngine, and the four ported looks each mount their
 * own LookRenderer (own canvas) into the `.field` container.
 */
// looks with a seeded generative composition that can be re-rolled
const SEEDED: Look[] = ['auras', 'riso', 'forms']

export function AmbientField({ mode, look, onLookChange, rerollNonce }: { mode: Mode; look: Look; onLookChange?: (l: Look) => void; rerollNonce?: number }) {
  const [stats, setStats] = useState<FieldStats | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<FieldEngine | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<LookRenderer | null>(null)

  const isPlugin = look in RENDERERS

  // mount the FieldEngine for `silk` (skipped for `off` and the plugin looks)
  useEffect(() => {
    if (look !== 'silk' || !canvasRef.current) return
    const eng = new FieldEngine(canvasRef.current, mode)
    eng.onStats = setStats
    engineRef.current = eng
    const fit = () => eng.resize(window.innerWidth, window.innerHeight)
    fit(); eng.setLook(look); eng.start()
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('resize', fit); eng.stop(); engineRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look])

  // mount the matching LookRenderer for the four ported looks
  useEffect(() => {
    if (!isPlugin || !containerRef.current) return
    const renderer = RENDERERS[look]!()
    rendererRef.current = renderer
    renderer.mount(containerRef.current, mode)
    const fit = () => renderer.resize()
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('resize', fit); renderer.destroy(); rendererRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look])

  useEffect(() => {
    engineRef.current?.setMode(mode)
    rendererRef.current?.setMode(mode)
  }, [mode])

  // reroll the seeded composition when the nonce bumps (driven by the field picker's ⟳ button)
  useEffect(() => {
    if (rerollNonce) rendererRef.current?.reroll?.()
  }, [rerollNonce])

  return (
    <>
      {look === 'off' ? (
        <WeatherField mode={mode} />
      ) : (
        <div ref={containerRef} className="field" aria-hidden style={{ background: baseGradient(mode) }}>
          {look === 'silk' && <canvas ref={canvasRef} className="field-canvas" />}
          <div className="field-grain" />
          <div className="field-vignette" />
        </div>
      )}

      {DEV && (
        <div className="field-dev">
          <div className="field-dev-looks">
            {LOOKS.map((l) => (
              <button key={l} className={l === look ? 'on' : ''} onClick={() => onLookChange?.(l)}>{LOOK_LABEL[l]}</button>
            ))}
            {SEEDED.includes(look) && (
              <button onClick={() => rendererRef.current?.reroll?.()} title="New seed">⟳</button>
            )}
          </div>
          <div className="field-dev-stats">
            {look === 'off' ? 'CSS gradient · 0 canvas cost'
              : look === 'silk' ? (stats ? `${stats.fps} fps · ${stats.ms}ms/frame · ${stats.res} buf` : '…')
              : LOOK_LABEL[look]}
          </div>
        </div>
      )}
    </>
  )
}
