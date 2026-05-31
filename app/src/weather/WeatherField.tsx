import { AnimatePresence, motion } from 'framer-motion'
import type { Mode } from '../types'
import { MODE_META } from './modes'
import './WeatherField.css'

function gradient(mode: Mode): string {
  const f = MODE_META[mode].field
  return [
    `radial-gradient(ellipse 90% 60% at 50% 4%, ${f.glow} 0%, transparent 55%)`,
    `radial-gradient(ellipse 85% 70% at 74% 60%, ${f.c2} 0%, transparent 60%)`,
    `radial-gradient(ellipse 75% 60% at 16% 94%, ${f.c3} 0%, transparent 65%)`,
    `linear-gradient(180deg, ${f.c1} 0%, ${f.c2} 56%, ${f.c3} 100%)`,
  ].join(', ')
}

/**
 * Full-screen weather-reactive background. Crossfades between modes (~1.2s)
 * with a slow perpetual "breathing" drift. CSS gradients for Phase 1; this is
 * the seam where the WebGL shader drops in at Phase 3.
 */
export function WeatherField({ mode }: { mode: Mode }) {
  return (
    // static base gradient guarantees the field is never blank, even before/if
    // the crossfade animation runs; the motion layers ride on top for transitions.
    <div className="field" aria-hidden style={{ background: gradient(mode) }}>
      <AnimatePresence>
        <motion.div
          key={mode}
          className="field-layer"
          style={{ background: gradient(mode) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, scale: [1, 1.05, 1] }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.2, ease: 'easeInOut' },
            scale: { duration: 22, ease: 'easeInOut', repeat: Infinity },
          }}
        />
      </AnimatePresence>
      <div className="field-grain" />
      <div className="field-vignette" />
    </div>
  )
}
