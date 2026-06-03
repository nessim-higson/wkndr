import { useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { X, Star, ArrowUpRight, Check, Sparkles } from 'lucide-react'
import type { Pick } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'
import './CardDetail.css'

// the detail body fades/rises in just after the sheet lands — staggered children
const bodyV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
}
const itemV = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 34 } },
}

/** Full detail for a pick — opens on tap (stack) or row click (list). */
export function CardDetail({
  pick, saved, onClose, onToggleSave,
}: {
  pick: Pick | null
  saved: boolean
  onClose: () => void
  onToggleSave: (p: Pick) => void
}) {
  const [copied, setCopied] = useState(false)
  // drag-to-dismiss (App Store style): the gesture only starts from the image /
  // top zone (via dragControls), so the body below still scrolls normally.
  const dragControls = useDragControls()

  // share THIS pick — a link that opens straight to it (no backend)
  async function share() {
    if (!pick) return
    const url = `${location.origin}${location.pathname}?w=${pick.id}`
    const data = { title: pick.title, text: `${pick.title} — ${pick.venue}, ${pick.area}`, url }
    try { if (navigator.share) { await navigator.share(data); return } } catch { /* fall through to copy */ }
    try {
      await navigator.clipboard?.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch { /* no-op */ }
  }

  return (
    <AnimatePresence onExitComplete={() => setCopied(false)}>
      {pick && (
        <motion.div
          className="detail-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <motion.article
            className="detail"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.84 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.02, bottom: 0.7 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }}
          >
            <button
              className="detail-close"
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close"
            ><X size={18} strokeWidth={2.4} /></button>
            <motion.div
              className={`detail-img${pick.image ? '' : ` poster poster--${pick.category}`}`}
              style={{ ...(pick.image ? { backgroundImage: `url(${pick.image})` } : {}), touchAction: 'none' }}
              onPointerDown={(e) => dragControls.start(e)}
              initial={{ scale: pick.image ? 1.08 : 1 }} animate={{ scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="detail-grip" aria-hidden />
              {!pick.image && <span className="poster-mark">{CATEGORY_LABEL[pick.category]}</span>}
              <div className="detail-tags">
                {pick.status && <span className={`chip chip-status chip-status--${pick.status}`}>{STATUS_LABEL[pick.status]}</span>}
                <span className={`chip chip-fresh chip-fresh--${pick.freshness}`}>{FRESHNESS_LABEL[pick.freshness]}</span>
                <span className="chip chip-cat">{CATEGORY_LABEL[pick.category]}</span>
                {pick.outdoor && <span className="chip chip-outdoor">Outdoor</span>}
                {pick.kid && <span className="chip chip-kid">Kids</span>}
              </div>
            </motion.div>
            <motion.div className="detail-body" variants={bodyV} initial="hidden" animate="show">
              <motion.div className="detail-when" variants={itemV}>
                {pick.when}{pick.verify && <span className="verify">verify</span>}
              </motion.div>
              <motion.h2 className="detail-title" variants={itemV}>{pick.title}</motion.h2>
              <motion.div className="detail-venue" variants={itemV}>{pick.venue} · {pick.area} · {pick.price}</motion.div>
              <motion.p className="detail-blurb" variants={itemV}>{pick.blurb}</motion.p>
              <motion.div className="detail-why" variants={itemV}><Sparkles className="why-mark" size={13} /> {pick.why}</motion.div>
              <motion.div className="detail-actions" variants={itemV}>
                <button className={`detail-icon-btn${saved ? ' on' : ''}`} onClick={() => onToggleSave(pick)} aria-label={saved ? 'Saved' : 'Save'}>
                  <Star size={19} strokeWidth={2.2} fill={saved ? 'currentColor' : 'none'} />
                </button>
                <button className="detail-icon-btn" onClick={share} aria-label="Share this pick">
                  {copied ? <Check size={19} strokeWidth={2.4} /> : <ArrowUpRight size={19} strokeWidth={2.2} />}
                </button>
                <a className="detail-link" href={pick.link} target="_blank" rel="noreferrer">
                  Open at {pick.source} <ArrowUpRight size={15} strokeWidth={2.2} style={{ verticalAlign: '-2px' }} />
                </a>
              </motion.div>
              <motion.div className="detail-trace" variants={itemV}>
                ↳ surfaced from <b>{pick.source}</b> · ranked for this weekend’s weather
              </motion.div>
            </motion.div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
