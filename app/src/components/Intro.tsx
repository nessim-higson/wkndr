import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Mode } from '../types'
import './Intro.css'

// the value-prop hook, tuned to the live weather — a bold lead + a light follow.
const LINES: Record<Mode, [string, string]> = {
  HOT: ['It’s a scorcher.', 'Get outside.'],
  WARM: ['A perfect one.', 'Let’s make it count.'],
  COOL: ['Crisp and clear.', 'The city’s yours.'],
  COLD_WET: ['A grey, wet one.', 'Here’s where to hide.'],
  VOLATILE: ['The sky can’t decide.', 'We picked some backups.'],
}

/** Full-screen intro over the live field: a bold weather-aware line, then it lifts
 *  away as the app rises in. Plays every load; tap to skip. */
export function Intro({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2600)
    return () => clearTimeout(id)
  }, [onDone])

  return (
    <motion.div
      className="intro"
      onClick={onDone}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="intro-inner"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -30 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="intro-mark"><span className="intro-dot" aria-hidden />WKNDR</span>
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            className="intro-line"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="intro-lead">{LINES[mode][0]}</h1>
            <motion.span
              className="intro-follow"
              initial={{ opacity: 0, y: 18, filter: 'blur(9px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {LINES[mode][1]}
            </motion.span>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <motion.span
        className="intro-skip"
        initial={{ opacity: 0 }} animate={{ opacity: 0.45 }} transition={{ delay: 1.4 }}
      >
        tap to continue
      </motion.span>
    </motion.div>
  )
}
