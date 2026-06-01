import { useEffect, useRef, useState } from 'react'
import type { Mode } from '../types'
import { WeatherField } from './WeatherField'
import { MODE_META } from './modes'
import { FieldEngine, type Look, type FieldStats } from './ambientEngine'
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

const LOOKS: Look[] = ['off', 'aura', 'warp', 'aurora', 'mesh', 'metaball']
const LOOK_LABEL: Record<Look, string> = { off: 'CSS', aura: 'Aura', warp: 'Warp', aurora: 'Aurora', mesh: 'Mesh', metaball: 'Metaball' }
const DEV = import.meta.env.DEV

/**
 * Drop-in for <WeatherField>. Renders a generative ambient field on a single
 * low-res canvas behind everything, driven by the mode palette. `off` renders the
 * real production WeatherField, so the dev panel is a true A/B. The engine handles
 * all the perf-budget concerns (see ambientEngine.ts).
 */
export function AmbientField({ mode, look, onLookChange }: { mode: Mode; look: Look; onLookChange?: (l: Look) => void }) {
  const [stats, setStats] = useState<FieldStats | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<FieldEngine | null>(null)

  // mount the engine once the canvas exists (skipped entirely when look === 'off')
  useEffect(() => {
    if (look === 'off' || !canvasRef.current) return
    const eng = new FieldEngine(canvasRef.current, mode)
    eng.onStats = setStats
    engineRef.current = eng
    const fit = () => eng.resize(window.innerWidth, window.innerHeight)
    fit(); eng.setLook(look); eng.start()
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('resize', fit); eng.stop(); engineRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look])

  useEffect(() => { engineRef.current?.setMode(mode) }, [mode])

  return (
    <>
      {look === 'off' ? (
        <WeatherField mode={mode} />
      ) : (
        <div className="field" aria-hidden style={{ background: baseGradient(mode) }}>
          <canvas ref={canvasRef} className="field-canvas" />
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
          </div>
          <div className="field-dev-stats">
            {look === 'off' ? 'CSS gradient · 0 canvas cost'
              : stats ? `${stats.fps} fps · ${stats.ms}ms/frame · ${stats.res} buf` : '…'}
          </div>
        </div>
      )}
    </>
  )
}
