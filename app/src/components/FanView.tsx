import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import type { Pick } from '../types'
import { CATEGORY_LABEL } from '../types'
import './FanView.css'

const MAX = 26          // cards placed around the wheel
const SENS = 0.26       // degrees of spin per px dragged
const FLICK = 0.5       // how much a release-flick coasts
const AUTO_DPS = 4.5    // idle drift speed (deg/sec)
const IDLE_MS = 2600    // resume the drift this long after you let go

/** A wheel of cards: they sit around a big circle whose centre is pushed below the
 *  screen, so only the top arc shows. It spins in on entry, drifts slowly on its own,
 *  and you grab & spin it (snaps to a card with a spring). Tap a card to investigate. */
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
  const tapTarget = useRef<EventTarget | null>(null)
  const auto = useRef<ReturnType<typeof animate> | null>(null)
  const idle = useRef<ReturnType<typeof setTimeout>>()

  const startDrift = useCallback(() => {
    auto.current?.stop()
    if (paused || n === 0) return
    auto.current = animate(spin, spin.get() + 100000, { duration: 100000 / AUTO_DPS, ease: 'linear' })
  }, [paused, n, spin])

  const armIdle = useCallback(() => {
    clearTimeout(idle.current)
    idle.current = setTimeout(startDrift, IDLE_MS)
  }, [startDrift])

  // entrance: the wheel spins in (and scales/fades via the motion props below)
  useEffect(() => {
    spin.set(-28)
    auto.current = animate(spin, 0, { type: 'spring', stiffness: 50, damping: 13 })
    return () => { auto.current?.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // idle drift follows the paused state: stop while a detail is open, resume after it closes
  useEffect(() => {
    if (paused) { auto.current?.stop(); clearTimeout(idle.current); return }
    armIdle()
    return () => clearTimeout(idle.current)
  }, [paused, armIdle])

  function onPointerDown(e: RPointerEvent) {
    auto.current?.stop()
    clearTimeout(idle.current)
    moved.current = false
    spinStart.current = spin.get()
    tapTarget.current = e.target
  }
  function onPan(_e: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) + Math.abs(info.offset.y) > 5) moved.current = true
    spin.set(spinStart.current + info.offset.x * SENS)
  }
  function onPanEnd(_e: unknown, info: PanInfo) {
    auto.current?.stop()
    // project where the flick wants to land, snap to the nearest card detent with an
    // underdamped spring — overshoots and pulls back like a weighted spring-wheel.
    const projected = spin.get() + info.velocity.x * SENS * FLICK
    const snapped = step ? Math.round(projected / step) * step : projected
    auto.current = animate(spin, snapped, { type: 'spring', stiffness: 70, damping: 12, restDelta: 0.2 })
    armIdle()
  }
  // a tap (pointer down+up with no real drag) opens that card — handled here because the
  // pan gesture captures the pointer, so a plain onClick on the card never fires.
  function onPointerUp() {
    if (moved.current) return
    const el = (tapTarget.current as HTMLElement | null)?.closest('[data-fan-i]') as HTMLElement | null
    if (el) onOpen?.(cards[Number(el.dataset.fanI)])
    armIdle()
  }

  return (
    <motion.div
      className="wheel-stage"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPan={onPan}
      onPanEnd={onPanEnd}
    >
      <motion.div
        className="wheel"
        style={{ rotate: spin }}
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {cards.map((p, i) => (
          <div className="wheel-card" key={p.id} data-fan-i={i} style={{ transform: `rotate(${i * step}deg)` }}>
            <div
              className={`wheel-card-face${p.image ? '' : ` poster poster--${p.category}`}`}
              style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
            >
              <span className="wcard-shade" aria-hidden />
              <span className="wcard-info">
                <span className="wcard-cat mono">{CATEGORY_LABEL[p.category]}</span>
                <span className="wcard-title">{p.title}</span>
                <span className="wcard-when mono">{p.when}</span>
              </span>
            </div>
          </div>
        ))}
      </motion.div>
      {n === 0 && <p className="wheel-empty mono">No picks for this view yet.</p>}
    </motion.div>
  )
}
