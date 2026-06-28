import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { X, Star, ArrowUpRight, Check } from 'lucide-react'
import type { Pick } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL, weatherPill } from '../types'
import { shortCode } from '../lib/share'
import './CardDetail.css'

// the detail body fades/rises in just after the sheet lands — staggered children
const bodyV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.14 } },
}
const itemV = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 34 } },
}

const MUSIC = new Set<Pick['category']>(['live'])

/** Full detail for a pick. Opens by EXPANDING OUT of the card that was tapped (App Store
 *  style) — `origin` is that card's on-screen rect; absent → a centred grow. Swipe the
 *  sheet down to dismiss. */
export function CardDetail({
  pick, saved, origin, onClose, onToggleSave,
}: {
  pick: Pick | null
  saved: boolean
  origin?: DOMRect | null
  onClose: () => void
  onToggleSave: (p: Pick) => void
}) {
  const [copied, setCopied] = useState(false)
  // drag-to-dismiss (App Store style): the gesture only starts from the image / top zone
  // (via dragControls), so the body below still scrolls normally.
  const dragControls = useDragControls()

  // The expand transform: start scaled down + translated to the tapped card's centre, then
  // grow to the centred sheet. Uniform scale off the width ratio reads as a clean morph.
  const o = useMemo(() => {
    if (!origin || typeof window === 'undefined') return { scale: 0.86, x: 0, y: 0 }
    const vw = window.innerWidth, vh = window.innerHeight
    const detailW = Math.min(460, vw - 32)
    return {
      scale: Math.max(0.18, origin.width / detailW),
      x: origin.left + origin.width / 2 - vw / 2,
      y: origin.top + origin.height / 2 - vh / 2,
    }
  }, [origin])

  const isMusic = pick ? MUSIC.has(pick.category) : false
  const q = pick ? encodeURIComponent(pick.title) : ''
  // the static weather affinity moved OFF the card front (V.4.8) — this is its home now
  const weather = pick ? `${weatherPill(pick).text}${pick.outdoor ? ' · outdoor' : ' · indoor'}` : ''

  // share THIS pick — a link that opens straight to it (no backend)
  async function share() {
    if (!pick) return
    const url = `${location.origin}${location.pathname}?w=${shortCode(pick)}`
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
          transition={{ duration: 0.26 }}
        >
          {/* EXPAND wrapper — grows from the card's origin; the inner article owns drag-to-dismiss */}
          <motion.div
            className="detail-expand"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: o.scale, x: o.x, y: o.y }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: o.scale, x: o.x, y: o.y }}
            transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.9 }}
          >
            <motion.article
              className="detail"
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.7}                       /* both directions follow the finger */
              /* dismiss on a decisive pull in EITHER direction — grab the image and fling up OR down */
              onDragEnd={(_, info) => { if (Math.abs(info.offset.y) > 110 || Math.abs(info.velocity.y) > 550) onClose() }}
            >
              <button
                className="detail-close"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Close"
              ><X size={20} strokeWidth={2.6} /></button>
              <motion.div
                className={`detail-img${pick.image ? '' : ` poster poster--${pick.category}`}`}
                style={{ ...(pick.image ? { backgroundImage: `url(${pick.image})` } : {}), touchAction: 'none' }}
                onPointerDown={(e) => dragControls.start(e)}
                initial={{ scale: pick.image ? 1.06 : 1 }} animate={{ scale: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
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
                <motion.div className="detail-venue" variants={itemV}>
                  {[pick.venue, pick.area, pick.price].filter(Boolean).join(' · ')}
                </motion.div>
                {pick.blurb && <motion.p className="detail-blurb" variants={itemV}>{pick.blurb}</motion.p>}

                {isMusic && (
                  <motion.div className="cb-listen" variants={itemV}>
                    <span className="cb-listen-label">Listen first</span>
                    <div className="cb-streams">
                      <a className="cb-stream cb-stream--spotify" href={`https://open.spotify.com/search/${q}`} target="_blank" rel="noreferrer">
                        Spotify <ArrowUpRight size={13} strokeWidth={2.4} />
                      </a>
                      <a className="cb-stream cb-stream--apple" href={`https://music.apple.com/search?term=${q}`} target="_blank" rel="noreferrer">
                        Apple Music <ArrowUpRight size={13} strokeWidth={2.4} />
                      </a>
                    </div>
                  </motion.div>
                )}

                <motion.dl className="cb-facts" variants={itemV}>
                  <div className="cb-fact"><dt>Weather</dt><dd>{weather}</dd></div>
                  {(pick.buzz ?? 0) > 1 && (
                    <div className="cb-fact"><dt>Buzz</dt><dd>Flagged by {pick.buzz} sources this week</dd></div>
                  )}
                </motion.dl>

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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
