import { useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import type { Pick } from '../types'
import { CATEGORY_LABEL } from '../types'
import './FanView.css'

const MAX_DESKTOP = 26  // cards placed around the wheel
const SENS = 0.26       // degrees of spin per px dragged
const FLICK = 0.5       // how much a release-flick coasts
const HALO = 20         // degrees from top within which a card gets the "hero" treatment
// degrees of fan on each side before cards fade out. Mobile = tight hand fan; desktop = a
// WIDE, airy fan (cards splay further out — the earlier, more interesting desktop look).

/** A wheel of cards cropped to its top arc. The card at the top is the HERO — larger,
 *  lifted, on top, neighbours recede. Purely user-driven: grab and spin it freely (snaps to
 *  a card on release); tap a card to investigate. (No auto-advance — it felt forced.) */
export function FanView({
  picks, onOpen,
}: {
  picks: Pick[]
  onOpen?: (p: Pick) => void
}) {
  // how far the hero pulls down out of the arc to land centred (less on a short phone)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 720
  // fewer cards on a phone — 26 large background-images + per-frame style writes is the fan's
  // main mobile cost. ~16 still reads as a full hand fan.
  const cards = useMemo(() => picks.slice(0, isMobile ? 16 : MAX_DESKTOP), [picks, isMobile])
  const n = cards.length
  const step = n > 0 ? 360 / n : 0
  const spin = useMotionValue(0)
  const heroLift = useMemo(() => (isMobile ? 96 : 84), [isMobile])
  const spread = useMemo(() => (isMobile ? 46 : 56), [isMobile])   // tight fan — cards stay up beside the hero, not wrapping into a ring

  const moved = useRef(false)
  const spinStart = useRef(0)
  const tapTarget = useRef<EventTarget | null>(null)
  const auto = useRef<ReturnType<typeof animate> | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)

  // entrance: the wheel spins + scales/fades in (motion props below), then it just rests
  // until the user spins it. No timed auto-advance.
  useEffect(() => {
    spin.set(-28)
    auto.current = animate(spin, 0, { type: 'spring', stiffness: 64, damping: 17 })   // settles upright fast, minimal bounce
    return () => { auto.current?.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the hero settled UPRIGHT across viewport changes (Safari's toolbar showing/hiding
  // changes dvh and can leave the wheel resting between cards → a crooked hero).
  useEffect(() => {
    const onResize = () => {
      auto.current?.stop()
      const cur = spin.get()
      spin.set(step ? Math.round(cur / step) * step : cur)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [spin, step])

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
        const aa = Math.abs(a)
        const vis = Math.max(0, 1 - aa / spread)        // fan membership: 1 centre → 0 at the spread edge
        const p = Math.max(0, 1 - aa / HALO)            // hero emphasis (tighter than the spread)
        const e = p * p
        const face = card.querySelector<HTMLElement>('.wheel-card-face')
        // hero: lifts forward (scale) + pulls to centre; neighbours sit back, tilted into the fan
        if (face) face.style.transform = `scale(${0.86 + e * 0.46}) translateY(${e * heroLift}px)`
        // text belongs to the HERO only — fade each card's copy out by its distance from the top
        // so neighbours become quiet image tiles instead of a wall of competing titles
        const info = card.querySelector<HTMLElement>('.wcard-info')
        if (info) info.style.opacity = (0.12 + 0.88 * e).toFixed(3)
        // layer inner→outer by angle so the hero is on top and the fan stacks cleanly
        card.style.zIndex = String(Math.round(300 - aa))
        // Cards stay OPAQUE so they don't bleed each other's edges (the whole .wheel carries a
        // single group-translucency against the field instead). Depth = brightness, not alpha:
        // recessed cards dim back; the hero stays bright. Only the very far edge fades to 0 to
        // hide off-fan cards (they're off-screen anyway).
        card.style.opacity = String(Math.max(0, Math.min(1, (spread - aa) / 14)))
        card.style.filter = `brightness(${(0.52 + 0.48 * vis).toFixed(3)})`
        card.style.pointerEvents = spread - aa < 1 ? 'none' : 'auto'
      })
    }
    update()
    const unsub = spin.on('change', update)
    return unsub
  }, [spin, step, n, heroLift, spread])

  function onPointerDown(e: RPointerEvent) {
    auto.current?.stop()
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
    const cur = spin.get()
    // clamp the flick so a hard swipe advances a few cards, never an uncontrolled spin
    const raw = cur + info.velocity.x * SENS * FLICK
    const clamped = Math.max(cur - step * 4, Math.min(cur + step * 4, raw))
    const snapped = step ? Math.round(clamped / step) * step : clamped
    auto.current = animate(spin, snapped, { type: 'spring', stiffness: 90, damping: 20, restDelta: 0.2 })   // clean settle, no overshoot wobble
  }
  function onPointerUp() {
    if (moved.current) return
    const el = (tapTarget.current as HTMLElement | null)?.closest('[data-fan-i]') as HTMLElement | null
    if (el) onOpen?.(cards[Number(el.dataset.fanI)])
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
        /* cards are SOLID — the old group-translucency (0.82) read as a milky veil over the
           whole screen against the bright field. Depth comes from the per-card edge-fade
           (computed in JS) + the bottom shade gradient, not from washing the whole fan out. */
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
