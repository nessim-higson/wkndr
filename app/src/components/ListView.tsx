import { useLayoutEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'
import './ListView.css'

// rows cascade in subtly when the list mounts (transform only — opacity is owned
// by the scroll spotlight below, so the two never fight over the same channel)
const listV = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } } }
const rowV = {
  hidden: { y: 14 },
  show: { y: 0, transition: { type: 'spring', stiffness: 520, damping: 40 } },
}

/** The scannable posture — same ranked pool, compact rows. */
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

  // Spotlight focus: the row nearest the viewport centre holds full opacity while
  // rows above and below fade with distance — gives the flat list the same sense
  // of depth as the card stack, and draws the eye to where you're looking.
  useLayoutEffect(() => {
    const scroller = listRef.current?.closest('.main-list') as HTMLElement | null
    if (!scroller) return
    let raf = 0
    const apply = () => {
      raf = 0
      const scrolls = scroller.scrollHeight > scroller.clientHeight + 4
      const sr = scroller.getBoundingClientRect()
      const mid = sr.top + sr.height / 2
      const falloff = sr.height * 0.5
      for (const row of rowsRef.current) {
        if (!row) continue
        if (!scrolls) { row.style.opacity = '1'; continue }   // short lists stay fully lit
        const r = row.getBoundingClientRect()
        const d = Math.abs(r.top + r.height / 2 - mid)
        const t = Math.min(1, d / falloff)
        row.style.opacity = String(Math.max(0.2, 1 - t * 0.82))
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
    <motion.div className="list" ref={listRef} variants={listV} initial="hidden" animate="show">
      {picks.map((p, i) => {
        const saved = savedIds.has(p.id)
        return (
          <motion.article
            className="row"
            key={p.id}
            ref={(el) => { rowsRef.current[i] = el }}
            variants={rowV}
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
          </motion.article>
        )
      })}
      {picks.length === 0 && <p className="list-empty mono">No picks for this view yet.</p>}
    </motion.div>
  )
}
