import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Pick } from '../types'
import { Card } from './Card'
import './FanView.css'

const FAN_MAX = 5     // cards held in the fan
const SPREAD = 58     // total degrees the fan opens across
const HOLD_MS = 2200  // how long each card stays pulled forward in autoplay

/** A hand of cards fanned up from the bottom. Idle → it auto-pulls each card forward
 *  in turn to show it off; tap any card to pull it and investigate (opens its detail). */
export function FanView({
  picks, onOpen, paused = false,
}: {
  picks: Pick[]
  onOpen?: (p: Pick) => void
  paused?: boolean
}) {
  const cards = useMemo(() => picks.slice(0, FAN_MAX), [picks])
  const n = cards.length
  const step = n > 1 ? SPREAD / (n - 1) : 0
  const [active, setActive] = useState(-1)   // which card is pulled forward (−1 = none)

  // idle autoplay: sweep the "pulled" card across the fan, one at a time
  const idle = useRef<ReturnType<typeof setTimeout>>()
  const arm = useCallback(() => {
    clearTimeout(idle.current)
    if (paused || n === 0) return
    idle.current = setTimeout(() => {
      if (document.hidden) { arm(); return }
      setActive((a) => (a + 1) % n)
      arm()
    }, HOLD_MS)
  }, [paused, n])

  useEffect(() => { arm(); return () => clearTimeout(idle.current) }, [arm])

  // any touch pauses the sweep and drops the pulled card; it resumes once you let go
  function pause() { clearTimeout(idle.current); setActive(-1) }
  useEffect(() => {
    const resume = () => arm()
    window.addEventListener('pointerup', resume)
    window.addEventListener('pointercancel', resume)
    return () => {
      window.removeEventListener('pointerup', resume)
      window.removeEventListener('pointercancel', resume)
    }
  }, [arm])

  return (
    <div className="fan" onPointerDown={pause}>
      {cards.map((p, i) => {
        const phi = (i - (n - 1) / 2) * step   // this card's angle in the fan
        const isActive = active === i
        return (
          <motion.div
            className="fan-slot"
            key={p.id}
            style={{ zIndex: isActive ? 100 : 10 + i }}
            // deal in from below, arcing out into the fan
            initial={{ rotate: 0, y: 480, opacity: 0 }}
            animate={{ rotate: phi, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 170, damping: 22, delay: i * 0.07 }}
          >
            <motion.div
              className="fan-lift"
              // pulled forward: straighten up, rise, and grow
              animate={isActive ? { rotate: -phi, y: -64, scale: 1.18 } : { rotate: 0, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              onClick={() => onOpen?.(p)}
            >
              <div className="fan-card">
                <Card pick={p} />
              </div>
            </motion.div>
          </motion.div>
        )
      })}
      {n === 0 && <p className="fan-empty mono">No picks for this view yet.</p>}
    </div>
  )
}
