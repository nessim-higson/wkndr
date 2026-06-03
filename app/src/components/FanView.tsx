import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import type { Pick } from '../types'
import { CATEGORY_LABEL } from '../types'
import './FanView.css'

const MAX = 26          // cards placed around the wheel
const SENS = 0.26       // degrees of spin per px dragged
const FLICK = 0.5       // how much a release-flick coasts
const HOLD_MS = 3200    // how long the hero card holds before the wheel advances
const HALO = 24         // degrees from top within which a card gets the "hero" treatment

/** A wheel of cards cropped to its top arc. The card at the top is the HERO — larger,
 *  lifted, on top, neighbours recede. It holds ~3s, then the wheel steps to the next.
 *  Grab and spin it freely (snaps to a card on release); tap a card to investigate. */
export function FanView({
  picks, onOpen, paused = false,
}: {
  picks: Pick[]
  onOpen?: (p: Pick) => void
  paused?: boolean
}) {
  const cards = useMemo(() => picks.slice(0, MAX), [picks])
  const n = cards.length
  const step = n > 0 ? 360 / n : 0
  const spin = useMotionValue(0)
  // how far the hero pulls down out of the arc to land centred (less on a short phone)
  const heroLift = useMemo(() => (typeof window !== 'undefined' && window.innerWidth < 720 ? 96 : 76), [])

  const moved = useRef(false)
  const spinStart = useRef(0)
  const tapTarget = useRef<EventTarget | null>(null)
  const auto = useRef<ReturnType<typeof animate> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const wheelRef = useRef<HTMLDivElement>(null)

  // auto-advance: dwell on the hero, then step to the next card with a spring
  const advance = useCallback(() => {
    auto.current?.stop()
    const cur = step ? Math.round(spin.get() / step) * step : 0
    auto.current = animate(spin, cur - step, { type: 'spring', stiffness: 60, damping: 15 })
    timer.current = setTimeout(advance, HOLD_MS)
  }, [spin, step])

  const startAuto = useCallback(() => {
    clearTimeout(timer.current)
    if (paused || n < 2) return
    timer.current = setTimeout(advance, HOLD_MS)
  }, [paused, n, advance])

  // entrance: the wheel spins + scales/fades in (motion props below)
  useEffect(() => {
    spin.set(-28)
    auto.current = animate(spin, 0, { type: 'spring', stiffness: 50, damping: 13 })
    return () => { auto.current?.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // auto-advance follows the paused state (stop while a detail is open; resume after)
  useEffect(() => {
    if (paused) { auto.current?.stop(); clearTimeout(timer.current); return }
    startAuto()
    return () => clearTimeout(timer.current)
  }, [paused, startAuto])

  // HERO emphasis — recomputed every time the wheel turns: the card nearest the top
  // grows + lifts + comes to the front; the others shrink and dim back.
  useEffect(() => {
    const wheel = wheelRef.current
    if (!wheel) return
    const update = () => {
      const s = spin.get()
      const els = wheel.querySelectorAll<HTMLElement>('.wheel-card')
      els.forEach((card, i) => {
        let a = (i * step + s) % 360
        if (a > 180) a -= 360
        else if (a < -180) a += 360
        const p = Math.max(0, 1 - Math.abs(a) / HALO)   // 1 at the top, 0 by HALO°
        const e = p * p                                 // ease so only the very centre lifts out
        const face = card.querySelector<HTMLElement>('.wheel-card-face')
        // hero: the top card comes OUT — neighbours sit back at 0.82, the hero grows to 1.34
        // and pulls down to centre. Bigger gap = the main card is clearly the focus.
        if (face) face.style.transform = `scale(${0.82 + e * 0.52}) translateY(${e * heroLift}px)`
        card.style.zIndex = String(100 + Math.round(p * 100))
        card.style.opacity = String(0.46 + p * 0.54)    // neighbours recede further
      })
    }
    update()
    const unsub = spin.on('change', update)
    return unsub
  }, [spin, step, n, heroLift])

  function onPointerDown(e: RPointerEvent) {
    auto.current?.stop()
    clearTimeout(timer.current)
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
    const projected = spin.get() + info.velocity.x * SENS * FLICK
    const snapped = step ? Math.round(projected / step) * step : projected
    auto.current = animate(spin, snapped, { type: 'spring', stiffness: 70, damping: 13, restDelta: 0.2 })
    startAuto()
  }
  function onPointerUp() {
    if (moved.current) return
    const el = (tapTarget.current as HTMLElement | null)?.closest('[data-fan-i]') as HTMLElement | null
    if (el) onOpen?.(cards[Number(el.dataset.fanI)])
    startAuto()
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
        ref={wheelRef}
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
