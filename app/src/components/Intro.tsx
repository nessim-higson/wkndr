import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import './Intro.css'

const FOLLOW = ''

/** Full-screen intro over the live field: the line, then it lifts away as the app
 *  rises in. Plays every load; tap to skip. `lead` is overridable so a shared visit
 *  can be greeted personally ("Ness shared some picks."). */
// The default lead matches the landing's hero verbatim (V.10.1 retired the Tinder framing
// there; the app intro finally gets the same memo) — accent on "one swipe", the app's own
// gesture, exactly like the landing's <span class="swap">.
const DEFAULT_LEAD = <>Your weekend, <em>one swipe</em> away.</>
export function Intro({ onDone, lead = DEFAULT_LEAD, sub, showHint = true }: { onDone: () => void; lead?: React.ReactNode; sub?: React.ReactNode; showHint?: boolean }) {
  const LEAD = lead
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
        <div className="intro-line">
          <h1 className="intro-lead">{LEAD}</h1>
          {sub && (
            <motion.p
              className="intro-sub"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >{sub}</motion.p>
          )}
          {FOLLOW && (
            <motion.span
              className="intro-follow"
              initial={{ opacity: 0, y: 18, filter: 'blur(9px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.55, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              {FOLLOW}
            </motion.span>
          )}
        </div>
      </motion.div>

      {showHint && (
        <motion.span
          className="intro-skip"
          initial={{ opacity: 0 }} animate={{ opacity: 0.45 }} transition={{ delay: 1.4 }}
        >
          tap to continue
        </motion.span>
      )}
    </motion.div>
  )
}
