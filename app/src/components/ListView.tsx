import { useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Star } from 'lucide-react'
import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'
import './ListView.css'

type ListStyle = 'wheel' | 'flux'

// Below this much overflow the list is "short" (e.g. a handful of saves): no auto-cycle,
// and no cylinder/flux distortion — the few rows just sit flat and clean.
const CYCLE_MIN = 180

/** The scannable posture — same ranked pool, two motion languages:
 *  - "wheel"  : rows ride a vertical cylinder, folding edge-on at the rim.
 *  - "flux"   : flat cards with weight — they shear & stretch with scroll
 *               momentum, thumbnails parallax, and the centre card pops.
 *  Both fade rows to nothing at the edges, so neither shows a hard clip line. */
export function ListView({
  picks, savedIds, onSwipe, onOpen, listStyle = 'wheel',
}: {
  picks: Pick[]
  savedIds: Set<string>
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onOpen?: (p: Pick) => void
  listStyle?: ListStyle
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<(HTMLElement | null)[]>([])
  rowsRef.current = []
  const entering = useRef(true)   // suppress Flux's velocity-skew during the entrance spin-in

  // Entrance + flywheel: on open it spins in from the top to the middle (eased), then keeps
  // cycling one direction forever — wrapping at the end like a flywheel rather than bouncing.
  // Any real interaction stops it; it resumes the loop after a short rest.
  useEffect(() => {
    const scroller = listRef.current?.closest('.main-list') as HTMLElement | null
    if (!scroller) return
    let raf = 0
    let idleT: ReturnType<typeof setTimeout>
    entering.current = true
    const maxScroll = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    // Only auto-cycle when the list actually overflows enough to be worth it. With just a
    // few rows (a short saved list) the loop micro-scrolls over a tiny range and wraps
    // constantly — that's the wonky/glitchy motion. Below this, the list just sits still.
    const enoughToCycle = () => maxScroll() > CYCLE_MIN
    // continuous one-way loop — wraps back to the top so it cycles all the way around
    const loop = () => {
      const max = maxScroll()
      if (max > 4) {
        let next = scroller.scrollTop + 1.3   // ~78px/s
        if (next >= max) next -= max
        scroller.scrollTop = next
      }
      raf = requestAnimationFrame(loop)
    }
    // eased spin-in from the top to the middle, then hand off to the loop
    const spinIn = () => {
      const target = maxScroll() / 2
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 900)
        scroller.scrollTop = target * (1 - Math.pow(1 - p, 3))   // ease-out cubic
        if (p < 1) { raf = requestAnimationFrame(step) }
        else { entering.current = false; raf = requestAnimationFrame(loop) }   // skew allowed only now
      }
      scroller.scrollTop = 0
      raf = requestAnimationFrame(step)
    }
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0 }
    const onActivity = () => { entering.current = false; stop(); clearTimeout(idleT); idleT = setTimeout(() => { if (enoughToCycle()) { stop(); raf = requestAnimationFrame(loop) } }, 2200) }
    // short lists (e.g. a handful of saves): skip the spin-in + flywheel, just settle still
    const startT = setTimeout(() => { if (enoughToCycle()) spinIn(); else entering.current = false }, 120)
    const events = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const
    events.forEach((e) => scroller.addEventListener(e, onActivity, { passive: true }))
    return () => {
      stop(); clearTimeout(idleT); clearTimeout(startT)
      events.forEach((e) => scroller.removeEventListener(e, onActivity))
    }
  }, [picks, listStyle])

  useLayoutEffect(() => {
    const scroller = listRef.current?.closest('.main-list') as HTMLElement | null
    if (!scroller) return

    // ---- WHEEL: rigid vertical cylinder ------------------------------------
    if (listStyle === 'wheel') {
      let raf = 0
      const R = 125
      const apply = () => {
        raf = 0
        // short list → flat, undistorted rows
        if (scroller.scrollHeight - scroller.clientHeight <= CYCLE_MIN) {
          for (const row of rowsRef.current) { if (!row) continue; row.style.transform = ''; row.style.opacity = ''; row.style.zIndex = '' }
          return
        }
        const sr = scroller.getBoundingClientRect()
        const mid = sr.top + sr.height / 2
        const half = sr.height / 2
        for (const row of rowsRef.current) {
          if (!row) continue
          const r = row.getBoundingClientRect()
          const t = Math.max(-1.5, Math.min(1.5, (r.top + r.height / 2 - mid) / half))
          const ang = Math.max(-90, Math.min(90, t * 95))
          const rad = (ang * Math.PI) / 180
          const tz = -R * (1 - Math.cos(rad))
          const cos = Math.max(0, Math.cos(rad))
          row.style.transform = `perspective(540px) translateZ(${tz}px) rotateX(${-ang}deg)`
          row.style.opacity = String(cos ** 1.7)
          row.style.zIndex = String(Math.round(100 - Math.abs(t) * 60))
        }
      }
      const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply) }
      apply()
      scroller.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll)
      return () => {
        scroller.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onScroll)
        if (raf) cancelAnimationFrame(raf)
      }
    }

    // ---- FLUX: liquid, momentum-reactive feed ------------------------------
    let lastST = scroller.scrollTop
    let lastT = performance.now()
    let vel = 0            // smoothed scroll velocity (px/ms), signed
    let running = false
    const apply = () => {
      // short list → flat, undistorted rows
      if (scroller.scrollHeight - scroller.clientHeight <= CYCLE_MIN) {
        for (const row of rowsRef.current) {
          if (!row) continue
          row.style.transform = ''; row.style.opacity = ''; row.style.zIndex = ''
          const th = row.querySelector('.row-thumb') as HTMLElement | null
          if (th) th.style.backgroundPositionY = ''
        }
        return
      }
      const sr = scroller.getBoundingClientRect()
      const mid = sr.top + sr.height / 2
      const half = sr.height / 2
      // no shear/stretch during the entrance spin-in — only once the user is actually scrolling
      const skew = entering.current ? 0 : Math.max(-6, Math.min(6, vel * 3.5))
      const stretch = entering.current ? 0 : Math.min(0.08, Math.abs(vel) * 0.05)
      for (const row of rowsRef.current) {
        if (!row) continue
        const r = row.getBoundingClientRect()
        const t = Math.max(-1.4, Math.min(1.4, (r.top + r.height / 2 - mid) / half))
        const a = Math.min(1, Math.abs(t))
        const scale = 1.04 - a * 0.13                              // centre card pops forward
        row.style.transform = `scale(${scale}) scaleY(${1 + stretch}) skewY(${skew}deg)`
        row.style.opacity = String(Math.cos(a * Math.PI / 2) ** 1.4)  // crisp centre, dissolved edges (no hard line)
        row.style.zIndex = String(Math.round(100 - a * 50))
        const thumb = row.querySelector('.row-thumb') as HTMLElement | null
        if (thumb) thumb.style.backgroundPositionY = `${50 + t * 22}%`  // image parallax
      }
    }
    const frame = () => {
      const now = performance.now()
      const st = scroller.scrollTop
      const dt = Math.max(16, now - lastT)
      const v = (st - lastST) / dt
      lastST = st; lastT = now
      vel += (v - vel) * 0.25                                      // ease toward current velocity
      apply()
      if (Math.abs(vel) > 0.002) requestAnimationFrame(frame)      // keep going until it settles
      else { vel = 0; apply(); running = false }
    }
    const onScroll = () => {
      if (!running) { running = true; lastT = performance.now(); lastST = scroller.scrollTop; requestAnimationFrame(frame) }
    }
    const onResize = () => apply()
    apply()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [picks, listStyle])

  return (
    <div className={`list list--${listStyle}`} ref={listRef}>
      {picks.map((p, i) => {
        const saved = savedIds.has(p.id)
        return (
          <article
            className="row"
            key={p.id}
            ref={(el) => { rowsRef.current[i] = el }}
            style={{ '--i': Math.min(i, 14) } as CSSProperties}
            onClick={() => onOpen?.(p)}
          >
            <div className="row-inner">
              <div
                className={`row-thumb${p.image ? '' : ` poster poster--${p.category}`}`}
                style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
              />
              <div className="row-main">
                <div className="row-tags mono">
                  {p.status && <span className={`row-status row-status--${p.status}`}>{STATUS_LABEL[p.status]}</span>}
                  <span className="row-fresh">{FRESHNESS_LABEL[p.freshness]}</span>
                  <span className="row-cat">{CATEGORY_LABEL[p.category]}</span>
                  {p.verify && <span className="row-verify">verify</span>}
                </div>
                <h3 className="row-title">{p.title}</h3>
                <div className="row-meta"><span className="row-when">{p.when}</span> · {p.venue} · {p.area}</div>
                <div className="row-why">{p.why}</div>
              </div>
              <button
                className={`row-save${saved ? ' on' : ''}`}
                onClick={(e) => { e.stopPropagation(); onSwipe(p, saved ? 'skip' : 'save') }}
                aria-label={saved ? 'Saved' : 'Save'}
              ><Star size={16} strokeWidth={2.2} fill={saved ? 'currentColor' : 'none'} /></button>
            </div>
          </article>
        )
      })}
      {picks.length === 0 && <p className="list-empty mono">No picks for this view yet.</p>}
    </div>
  )
}
