import { motion } from 'framer-motion'
import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL } from '../types'
import './ListView.css'

// rows cascade in subtly when the list mounts
const listV = { hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } } }
const rowV = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 520, damping: 40 } },
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
  return (
    <motion.div className="list" variants={listV} initial="hidden" animate="show">
      {picks.map((p) => {
        const saved = savedIds.has(p.id)
        return (
          <motion.article className="row" key={p.id} variants={rowV} onClick={() => onOpen?.(p)}>
            <div className="row-thumb" style={{ backgroundImage: `url(${p.image})` }} />
            <div className="row-main">
              <div className="row-tags mono">
                <span className="row-fresh">{FRESHNESS_LABEL[p.freshness]}</span>
                <span>· {CATEGORY_LABEL[p.category]}</span>
                <span className="row-when">· {p.when}</span>
                {p.verify && <span className="row-verify">verify</span>}
              </div>
              <h3 className="row-title">{p.title}</h3>
              <div className="row-meta">{p.venue} · {p.area} · {p.price}</div>
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
