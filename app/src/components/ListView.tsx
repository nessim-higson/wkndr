import { useLayoutEffect, useRef } from 'react'
import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'
import './ListView.css'

/** The scannable posture — same ranked pool, compact rows.
 *  Rows ride a gentle vertical "wheel": the one passing through the centre is the
 *  flat, full-opacity focal point; rows above/below tilt backwards and fade with
 *  distance, so scanning the list feels like turning a dial rather than reading a
 *  flat column. The whole effect is scroll-driven (see the layout effect). */
export function ListView({
  picks, savedIds, onSwipe, onOpen,
}: {
  picks: Pick[]
  savedIds: Set<string>
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onOpen?: (p: Pick) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<(HTMLElement | null)[]>([])
  rowsRef.current = []

  useLayoutEffect(() => {
    const scroller = listRef.current?.closest('.main-list') as HTMLElement | null
    if (!scroller) return
    let raf = 0
    const apply = () => {
      raf = 0
      const sr = scroller.getBoundingClientRect()
      const mid = sr.top + sr.height / 2
      const half = sr.height / 2
      for (const row of rowsRef.current) {
        if (!row) continue
        const r = row.getBoundingClientRect()
        // signed distance from the focal centre, normalised to ~[-1, 1] across the viewport
        const t = Math.max(-1.6, Math.min(1.6, (r.top + r.height / 2 - mid) / half))
        const a = Math.abs(t)
        const rot = -t * 50              // tilt away from centre (top of the wheel rolls back)
        const tz = -a * 120              // recede with distance for real depth
        // eased falloff: the centred row stays crisp, then fades off hard with distance
        const opacity = Math.max(0.12, 1 - Math.min(1, a) ** 1.7 * 0.9)
        row.style.transform = `perspective(900px) translateZ(${tz}px) rotateX(${rot}deg)`
        row.style.opacity = String(opacity)
        row.style.zIndex = String(100 - Math.round(a * 50))   // centre row sits on top
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
  }, [picks])

  return (
    <div className="list" ref={listRef}>
      {picks.map((p, i) => {
        const saved = savedIds.has(p.id)
        return (
          <article
            className="row"
            key={p.id}
            ref={(el) => { rowsRef.current[i] = el }}
            onClick={() => onOpen?.(p)}
          >
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
            >★</button>
          </article>
        )
      })}
      {picks.length === 0 && <p className="list-empty mono">No picks for this view yet.</p>}
    </div>
  )
}
