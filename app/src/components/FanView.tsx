import { useEffect, useMemo, useRef } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion'
import type { Pick } from '../types'
import { CATEGORY_LABEL } from '../types'
import { Coverflow } from './Coverflow'
import './FanView.css'

/** Fan view = the signature browse. MOBILE gets the Coverflow (width-bounded, never crops);
 *  DESKTOP gets the wide hand-fan arc. (May unify to Coverflow on both in a later pass.) */
export function FanView(props: { picks: Pick[]; onOpen?: (p: Pick) => void }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 720
  return isMobile ? <Coverflow {...props} /> : <WheelFan {...props} />
}

const MAX_DESKTOP = 26  // cards placed around the wheel
const SENS = 0.26       // degrees of spin per px dragged
const HALO = 20         // degrees from top within which a card gets the "hero" treatment
// degrees of fan on each side before cards fade out. Mobile = tight hand fan; desktop = a
// WIDE, airy fan (cards splay further out — the earlier, more interesting desktop look).

/** A wheel of cards cropped to its top arc. The card at the top is the HERO — larger,
 *  lifted, on top, neighbours recede. Purely user-driven: grab and spin it freely (snaps to
 *  a card on release); tap a card to investigate. (No auto-advance — it felt forced.) DESKTOP only. */
function WheelFan({
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
  // Desktop = the WIDE, impressive arc (many cards splay down + out, the lowest dimmest). Mobile
  // stays a tight, crop-free fan (its own concept is being explored separately).
  const spread = useMemo(() => (isMobile ? 48 : 104), [isMobile])

  const moved = useRef(false)
  const spinStart = useRef(0)
  const tapTarget = useRef<EventTarget | null>(null)
  const auto = useRef<ReturnType<typeof animate> | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)

  // (entrance now lives in the emphasis loop below — the cards UNFURL into the fan, so there's no
  // separate wheel-spin-in.)

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

  // HERO emphasis + ENTRANCE — one per-frame loop owns every card's visuals. The cards UNFURL:
  // each rotates out from the hero (rotate 0) to its fan angle and fades in, staggered by its
  // distance from the top, so the fan visibly DEALS open from the centre outward. After the
  // entrance the same loop just runs on spin changes (the hero emphasis as the wheel turns).
  useEffect(() => {
    const wheel = wheelRef.current
    if (!wheel) return
    // Cache the element refs ONCE (not per frame) — querying the DOM every frame was a needless
    // cost. Each item carries its base angle so the per-frame loop is pure math + composited writes.
    // Open on a DIFFERENT hero each time the fan mounts — stack→fan no longer always lands on card 0.
    const heroIdx = n > 0 ? Math.floor(Math.random() * n) : 0
    const heroBase = heroIdx * step
    spin.set(-heroBase)                                // rotate that card to the top
    const norm = (d: number) => (((d % 360) + 540) % 360) - 180   // shortest signed angle, [-180,180]
    const items = [...wheel.querySelectorAll<HTMLElement>('.wheel-card')].map((card, i) => {
      const base = i * step
      const delta = norm(base - heroBase)             // signed angle from the hero out to this card
      return {
        card,
        face: card.querySelector<HTMLElement>('.wheel-card-face'),
        info: card.querySelector<HTMLElement>('.wcard-info'),
        dim: card.querySelector<HTMLElement>('.wcard-dim'),
        base,
        delta,
        fromHero: Math.abs(delta),                    // 0 for the hero, growing outward
      }
    })
    const ENTER = 580, STAGGER = 62                   // ms: per-card unfurl + delay between rings
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t)   // cubic ease-out
    const start = performance.now()
    const enterEnd = start + ENTER + (spread / step) * STAGGER + 120

    const update = () => {
      const s = spin.get()
      const elapsed = performance.now() - start
      for (let i = 0; i < items.length; i++) {
        const { card, face, info, dim, base, delta, fromHero } = items[i]
        // entrance progress for THIS card (0→1), delayed by how far out from the hero it sits
        const ef = easeOut(Math.max(0, Math.min(1, (elapsed - (fromHero / step) * STAGGER) / ENTER)))
        const rot = heroBase + delta * ef             // unfurl: stacked on the hero → its fan angle
        card.style.transform = `rotate(${rot}deg)`
        // emphasis (scale/dim) uses the RESTING angle, not the unfurling one — so each card holds
        // its final size and simply rotates out + fades in (a clean fan-open, no size-flashing).
        let a = (base + s) % 360
        if (a > 180) a -= 360
        else if (a < -180) a += 360
        const aa = a < 0 ? -a : a
        const vis = aa < spread ? 1 - aa / spread : 0   // fan membership: 1 centre → 0 at the spread edge
        const p = aa < HALO ? 1 - aa / HALO : 0         // hero emphasis (tighter than the spread)
        const e = p * p
        // hero: lifts forward (scale) + pulls to centre; neighbours sit back, tilted into the fan.
        // ONLY transform/opacity are written per frame — both composite on the GPU (no paint/layout).
        // a subtle pop (0.9→1) as the card deals in adds life on top of the unfurl; ×1 at rest
        if (face) face.style.transform = `scale(${(0.86 + e * 0.46) * (0.9 + 0.1 * ef)}) translateY(${e * heroLift}px)`
        if (info) info.style.opacity = (0.12 + 0.88 * e).toFixed(3)
        // depth fade, two parts so the hero clearly wins: every non-hero card gets a baseline
        // darkening the instant it leaves the hero halo, ramping up toward the bottom of the arc.
        if (dim) dim.style.opacity = ((1 - e) * (0.32 + 0.6 * (1 - vis))).toFixed(3)
        card.style.zIndex = String(300 - (aa | 0))
        // edge-fade × entrance fade-in
        card.style.opacity = (Math.max(0, Math.min(1, (spread - aa) / 14)) * ef).toFixed(3)
        card.style.pointerEvents = (ef < 1 || spread - aa < 1) ? 'none' : 'auto'
      }
    }

    // drive every frame through the entrance, then settle into spin-driven updates
    let raf = 0
    const loop = () => { update(); if (performance.now() < enterEnd) raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    const unsub = spin.on('change', update)
    return () => { cancelAnimationFrame(raf); unsub() }
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
    // MOMENTUM: let the wheel coast off the release velocity and decay naturally, then settle on
    // the nearest card — far smoother than snapping straight to a computed target. Travel is capped
    // (modifyTarget clamp) so a hard flick advances a handful of cards, never an uncontrolled spin.
    // THROW: project a target from the release velocity (so a harder flick carries further —
    // momentum), cap the travel, snap to a card, and settle with a SOFT spring (a touch under
    // critical) so it decelerates smoothly and lands without a hard snap.
    const projected = cur + info.velocity.x * SENS * 0.2
    const capped = Math.max(cur - step * 7, Math.min(cur + step * 7, projected))
    const snapped = step ? Math.round(capped / step) * step : capped
    auto.current = animate(spin, snapped, { type: 'spring', stiffness: 58, damping: 14, restDelta: 0.15 })
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
        /* just a quick fade for the container — the CARDS unfurling (below) are the entrance */
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {cards.map((p, i) => (
          <div className="wheel-card" key={p.id} data-fan-i={i}>
            <div
              className={`wheel-card-face${p.image ? '' : ` poster poster--${p.category}`}`}
              style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
            >
              <span className="wcard-shade" aria-hidden />
              <span className="wcard-dim" aria-hidden />
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
