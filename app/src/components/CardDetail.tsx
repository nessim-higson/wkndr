import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { X, Star, ArrowUpRight, Check, Maximize2, Sparkles } from 'lucide-react'
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

// Every card image is a PRE-CROPPED 800×1200 wsrv render — the tall card's crop is baked into the
// URL, so the sheet never shows the whole photo. The FOCUS view unwraps the proxy's `url=` param to
// present the ORIGINAL, uncropped (falls back to the rendered crop if the raw host blocks hotlinking).
function originalOf(src: string): string {
  try {
    const u = new URL(src)
    if (u.hostname === 'images.weserv.nl') {
      const raw = u.searchParams.get('url')
      if (raw) return decodeURIComponent(raw)
    }
  } catch { /* not a URL we understand — use as-is */ }
  return src
}

// The sheet's header is 3/2 LANDSCAPE — feeding it the card's 800×1200 PORTRAIT render was a crop OF
// a crop (the middle ~44% of an already-cropped frame: "the crop is too tight"). Re-derive a 3/2
// render from the ORIGINAL instead: same wsrv pipeline (server-side fetch, saliency crop, hotlink-
// proof), right aspect, single crop.
function headerImageOf(src: string): string {
  const orig = originalOf(src)
  if (orig === src) return src            // not a wsrv render — use as-is
  const enc = encodeURIComponent(orig)
  return `https://images.weserv.nl/?url=${enc}&w=1200&h=800&fit=cover&a=attention&output=jpg&default=${enc}`
}

/** Full detail for a pick. Opens by EXPANDING OUT of the card that was tapped (App Store
 *  style) — `origin` is that card's on-screen rect; absent → a centred grow. Swipe the
 *  sheet down to dismiss. */
export function CardDetail({
  pick, saved, origin, onClose, onToggleSave, onMoreLike,
}: {
  pick: Pick | null
  saved: boolean
  origin?: DOMRect | null
  onClose: () => void
  onToggleSave: (p: Pick) => void
  onMoreLike?: (p: Pick) => void
}) {
  const [copied, setCopied] = useState(false)
  // FOCUS view — full-screen, uncropped look at the pick's photo (the curator's loupe)
  const [focus, setFocus] = useState(false)
  const [focusSrc, setFocusSrc] = useState<string | null>(null)
  const [focusDims, setFocusDims] = useState<string | null>(null)
  // drag-to-dismiss (App Store style): the gesture only starts from the image / top zone
  // (via dragControls), so the body below still scrolls normally.
  const dragControls = useDragControls()

  function openFocus() {
    if (!pick?.image) return
    setFocusDims(null)
    setFocusSrc(originalOf(pick.image))
    setFocus(true)
  }

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
    if (navigator.share) {
      // cancelling the native sheet rejects with AbortError — that's a decision, not a
      // failure. Only a real failure falls through to the clipboard; a cancel must not
      // overwrite what's on it (or flash "copied" for something they didn't ask for).
      try { await navigator.share(data); return }
      catch (e) { if ((e as DOMException)?.name === 'AbortError') return }
    }
    try {
      await navigator.clipboard?.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch { /* no-op */ }
  }

  return (
    <AnimatePresence onExitComplete={() => { setCopied(false); setFocus(false) }}>
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
                style={{ ...(pick.image ? { backgroundImage: `url(${headerImageOf(pick.image)})` } : {}), touchAction: 'none' }}
                onPointerDown={(e) => dragControls.start(e)}
                initial={{ scale: pick.image ? 1.06 : 1 }} animate={{ scale: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="detail-grip" aria-hidden />
                {pick.image && <div className="card-grade" aria-hidden />}
                {pick.image && <div className="card-tint" aria-hidden />}
                {pick.image && <div className="card-grain" aria-hidden />}
                {!pick.image && <span className="poster-mark">{CATEGORY_LABEL[pick.category]}</span>}
                {pick.image && (
                  <button
                    className="detail-zoom"
                    onClick={openFocus}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label="View the full photo"
                  ><Maximize2 size={16} strokeWidth={2.4} /></button>
                )}
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
                  {/* venue repeats the title for venue-IS-the-pick rows (restaurants, shops) — skip it */}
                  {[pick.venue !== pick.title ? pick.venue : null, pick.area, pick.price].filter(Boolean).join(' · ')}
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
                  {/* label the ACTION, not the source ("Open at Fresh find" read broken to cold
                      users) — provenance already lives in the trace line below */}
                  <a className="detail-link" href={pick.link} target="_blank" rel="noreferrer">
                    Open the page <ArrowUpRight size={15} strokeWidth={2.2} style={{ verticalAlign: '-2px' }} />
                  </a>
                </motion.div>
                {onMoreLike && (
                  <motion.button
                    className="detail-morelike"
                    variants={itemV}
                    onClick={() => onMoreLike(pick)}
                  >
                    <Sparkles size={15} strokeWidth={2.2} /> More like this
                  </motion.button>
                )}
                <motion.div className="detail-trace" variants={itemV}>
                  ↳ surfaced from <b>{pick.source}</b> · ranked for this weekend’s weather
                </motion.div>
              </motion.div>
            </motion.article>
          </motion.div>

          {/* FOCUS — the photo, whole, on black: pinch the vibe before you commit the evening.
              Loads the ORIGINAL behind the card's crop; tap anywhere to come back. */}
          <AnimatePresence>
            {focus && focusSrc && (
              <motion.div
                className="focus-veil"
                onClick={(e) => { e.stopPropagation(); setFocus(false) }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <motion.img
                  src={focusSrc}
                  alt={pick.title}
                  initial={{ scale: 0.94 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth) setFocusDims(`${im.naturalWidth}×${im.naturalHeight}`) }}
                  onError={() => { if (pick.image && focusSrc !== pick.image) setFocusSrc(pick.image) }}
                />
                <span className="focus-caption">
                  {pick.title}{focusDims ? ` · original ${focusDims}` : ''}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
