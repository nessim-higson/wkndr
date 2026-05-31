import { AnimatePresence, motion } from 'framer-motion'
import type { Pick } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL } from '../types'
import './CardDetail.css'

/** Full detail for a pick — opens on tap (stack) or row click (list). */
export function CardDetail({
  pick, saved, onClose, onToggleSave,
}: {
  pick: Pick | null
  saved: boolean
  onClose: () => void
  onToggleSave: (p: Pick) => void
}) {
  return (
    <AnimatePresence>
      {pick && (
        <motion.div
          className="detail-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.article
            className="detail"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 28, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <button className="detail-close" onClick={onClose} aria-label="Close">×</button>
            <div className="detail-img" style={{ backgroundImage: `url(${pick.image})` }}>
              <div className="detail-tags">
                <span className={`chip chip-fresh chip-fresh--${pick.freshness}`}>{FRESHNESS_LABEL[pick.freshness]}</span>
                <span className="chip chip-cat">{CATEGORY_LABEL[pick.category]}</span>
                {pick.outdoor && <span className="chip chip-outdoor">Outdoor</span>}
                {pick.kid && <span className="chip chip-kid">Kids</span>}
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-when">
                {pick.when}{pick.verify && <span className="verify">verify</span>}
              </div>
              <h2 className="detail-title">{pick.title}</h2>
              <div className="detail-venue">{pick.venue} · {pick.area} · {pick.price}</div>
              <p className="detail-blurb">{pick.blurb}</p>
              <div className="detail-why"><span aria-hidden>✦</span> {pick.why}</div>
              <div className="detail-actions">
                <button className={`detail-save${saved ? ' on' : ''}`} onClick={() => onToggleSave(pick)}>
                  {saved ? '★ Saved' : '☆ Save'}
                </button>
                <a className="detail-link" href={pick.link} target="_blank" rel="noreferrer">
                  Open at {pick.source} ↗
                </a>
              </div>
              <div className="detail-trace">
                ↳ surfaced from <b>{pick.source}</b> · ranked for this weekend’s weather
              </div>
            </div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
