import { useCallback, useEffect, useMemo, useRef } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import type { Pick } from '../types'
import { Card } from './Card'
import './FanView.css'

const MAX = 26          // cards placed around the wheel
const SENS = 0.26       // degrees of spin per px dragged
const FLICK = 0.32      // how much a release-flick coasts
const AUTO_DPS = 4.5    // idle drift speed (deg/sec)
const IDLE_MS = 2600    // resume the drift this long after you let go

/** A wheel of cards: they sit around a big circle whose centre is pushed below the
 *  screen, so only the top arc shows. It drifts slowly on its own; grab and spin it
 *  with the pointer (with a little release-momentum); tap a card to investigate. */
export function FanView({
  picks, onOpen, paused = false,
}: {
  picks: Pick[]
  onOpen?: (p: Pick) => void
  paused?: boolean
}) {
  const cards = useMemo(() => picks.slice(0, MAX), [picks])
  const n = cards.length
  const step = n > 0 ? 360 / n : 0      // evenly fill the circle so the spin wraps seamlessly
  const spin = useMotionValue(0)        // wheel rotation in degrees (drives the whole wheel)

  const moved = useRef(false)           // distinguishes a spin-drag from a tap
  const spinStart = useRef(0)
  const auto = useRef<ReturnType<typeof animate> | null>(null)
  const idle = useRef<ReturnType<typeof setTimeout>>()

  const startDrift = useCallback(() => {
    auto.current?.stop()
    if (paused || n === 0) return
    // creep forever at a steady rate; any interaction stops it
    auto.current = animate(spin, spin.get() + 100000, { duration: 100000 / AUTO_DPS, ease: 'linear' })
  }, [paused, n, spin])

  const armIdle = useCallback(() => {
    clearTimeout(idle.current)
    idle.current = setTimeout(startDrift, IDLE_MS)
  }, [startDrift])

  useEffect(() => {
    startDrift()
    return () => { auto.current?.stop(); clearTimeout(idle.current) }
  }, [startDrift])

  function onPanStart() {
    auto.current?.stop()
    clearTimeout(idle.current)
    moved.current = false
    spinStart.current = spin.get()
  }
  function onPan(_e: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) + Math.abs(info.offset.y) > 5) moved.current = true
    spin.set(spinStart.current + info.offset.x * SENS)
  }
  function onPanEnd(_e: unknown, info: PanInfo) {
    auto.current?.stop()
    // coast on the release velocity, then hand back to the idle drift
    auto.current = animate(spin, spin.get() + info.velocity.x * SENS * FLICK, {
      duration: 0.9, ease: [0.16, 1, 0.3, 1],
    })
    armIdle()
  }

  return (
    <motion.div
      className="wheel-stage"
      onPanStart={onPanStart}
      onPan={onPan}
      onPanEnd={onPanEnd}
    >
      <motion.div className="wheel" style={{ rotate: spin }}>
        {cards.map((p, i) => (
          <div className="wheel-card" key={p.id} style={{ transform: `rotate(${i * step}deg)` }}>
            <div
              className="wheel-card-face"
              onClick={() => { if (!moved.current) onOpen?.(p) }}
            >
              <Card pick={p} />
            </div>
          </div>
        ))}
      </motion.div>
      {n === 0 && <p className="wheel-empty mono">No picks for this view yet.</p>}
    </motion.div>
  )
}
