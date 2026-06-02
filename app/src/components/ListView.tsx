import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'
import './ListView.css'

/** The scannable posture — same ranked pool, compact rows.
 *  Rows ride the surface of a vertical cylinder: the one passing through the
 *  centre is flat, crisp and front-most; rows above/below curve backwards and
 *  fade, so scanning feels like turning a dial. The curve is scroll-driven
 *  (the layout effect); the cards "assemble" onto the wheel on entry (CSS). */
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
    const R = 170        // cylinder radius (px) — larger = gentler barrel
    const apply = () => {
      raf = 0
      const sr = scroller.getBoundingClientRect()
      const mid = sr.top + sr.height / 2
      const half = sr.height / 2
      for (const row of rowsRef.current) {
        if (!row) continue
        const r = row.getBoundingClientRect()
        // distance from the focal centre → an angle on the cylinder
        const t = Math.max(-1.5, Math.min(1.5, (r.top + r.height / 2 - mid) / half))
        const ang = Math.max(-85, Math.min(85, t * 64))       // degrees of wrap
        const rad = (ang * Math.PI) / 180
        const tz = -R * (1 - Math.cos(rad))                    // recede along the curve
        const cos = Math.max(0, Math.cos(rad))
        row.style.transform = `perspective(680px) translateZ(${tz}px) rotateX(${-ang}deg)`
        row.style.opacity = String(Math.max(0.08, cos ** 1.4))  // fade tracks the facing angle
        row.style.zIndex = String(100 - Math.round(Math.abs(t) * 50))  // centre row on top
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
              >★</button>
            </div>
          </article>
        )
      })}
      {picks.length === 0 && <p className="list-empty mono">No picks for this view yet.</p>}
    </div>
  )
}
