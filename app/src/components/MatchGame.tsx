import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Heart } from 'lucide-react'
import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL } from '../types'
import { SwipeStack } from './SwipeStack'
import './MatchGame.css'

// PROTOTYPE — the swipe-to-match slice. Reuses the real SwipeStack physics; the "partner" is
// simulated here (a deterministic subset of the deck they've already said yes to) so that mutual
// matches actually fire as you swipe. In the shipping version this set is decoded from the share
// link instead — the rest (the slam moment, the running plan) stays exactly as-is.

const SESSION = 16 // how many cards a match round runs for (a feelable session, not all 100)

// deterministic 0..1 from a string — stable per pick so the partner's "likes" don't reshuffle
function rand(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return ((h >>> 0) % 10000) / 10000
}
function haptic(p: number | number[]) { try { navigator.vibrate?.(p) } catch { /* iOS */ } }

export function MatchGame({
  picks, temp, partnerName = 'Robin', partnerIds, onOpen, onClose, onComplete,
}: {
  picks: Pick[]
  temp?: number
  partnerName?: string
  partnerIds?: string[]   // REAL partner's yes-set, decoded from the share link. Absent → demo (simulated).
  onOpen?: (p: Pick, origin?: DOMRect) => void
  onClose: () => void
  onComplete?: (matched: Pick[]) => void
}) {
  const real = !!partnerIds && partnerIds.length > 0
  // REAL: the deck IS the partner's shared picks (in feed-rank order) — "which of these do you
  // want too?", so every yes is genuine overlap. DEMO: a slice of the feed with a simulated set.
  const session = useMemo(() => {
    if (real) {
      const want = new Set(partnerIds)
      return picks.filter((p) => want.has(p.id) && p.image).slice(0, 30)
    }
    return picks.filter((p) => p.image).slice(0, SESSION)
  }, [picks, real, partnerIds])
  const partnerYes = useMemo(
    () => (real
      ? new Set(partnerIds)
      : new Set(session.filter((p) => rand(`${p.id}·${partnerName}`) > 0.5).map((p) => p.id))),
    [real, partnerIds, session, partnerName],
  )
  const [queue, setQueue] = useState<Pick[]>(session)
  const [matched, setMatched] = useState<Pick[]>([])
  const [slam, setSlam] = useState<Pick | null>(null)
  const total = session.length

  function onSwipe(p: Pick, dir: SwipeDir) {
    setQueue((q) => q.filter((x) => x.id !== p.id))
    const yes = dir === 'like' || dir === 'save'
    if (yes && partnerYes.has(p.id)) {
      haptic([14, 50, 22])
      setMatched((m) => [...m, p])
      setSlam(p)
    }
  }

  const done = queue.length === 0
  const seen = total - queue.length

  return (
    <motion.div
      className="mg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mg-head">
        <button className="mg-close" onClick={onClose} aria-label="Close match"><X size={20} strokeWidth={2.4} /></button>
        <div className="mg-head-mid">
          <span className="mg-with">Matching with <b>{partnerName}</b></span>
          {!done && <span className="mg-progress">{Math.min(seen + 1, total)} of {total}</span>}
        </div>
        <span className={`mg-count${matched.length ? ' on' : ''}`}>
          <Heart size={12} strokeWidth={2.8} fill="currentColor" /> {matched.length}
        </span>
      </div>

      <div className="mg-body">
        {done ? (
          <MatchPlan
            matched={matched} total={total} partnerName={partnerName} real={real} onOpen={onOpen}
            onSave={() => { onComplete?.(matched); onClose() }} onClose={onClose}
          />
        ) : (
          <SwipeStack picks={queue} temp={temp} onSwipe={onSwipe} onOpen={onOpen} />
        )}
      </div>

      <AnimatePresence>
        {slam && (
          <MatchSlam
            pick={slam} partnerName={partnerName} count={matched.length}
            onDismiss={() => setSlam(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// THE SIGNATURE MOMENT — two avatars fly in and collide, a stamp lands, the matched pick drops in.
function MatchSlam({
  pick, partnerName, count, onDismiss,
}: { pick: Pick; partnerName: string; count: number; onDismiss: () => void }) {
  const initial = partnerName.charAt(0).toUpperCase()
  const collide = { type: 'spring' as const, stiffness: 260, damping: 13 }
  // ARM DELAY — until the moment has fully composed, ignore taps. A queued tap from a fast swipe
  // streak (meant for the deck) can otherwise dismiss the slam the instant it appears, so the
  // match gets missed. ~700ms lets it land before any dismiss (incl. a stray backdrop tap) works.
  const [armed, setArmed] = useState(false)
  useEffect(() => { const id = setTimeout(() => setArmed(true), 700); return () => clearTimeout(id) }, [])
  const dismiss = () => { if (armed) onDismiss() }
  return (
    <motion.div
      className="mg-slam"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }} onClick={dismiss}
    >
      <motion.div
        className="mg-slam-inner" onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.92, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <div className="mg-avatars">
          <motion.span
            className="mg-av mg-av--you"
            initial={{ x: -150, rotate: -24, opacity: 0 }} animate={{ x: 0, rotate: -9, opacity: 1 }}
            transition={{ ...collide, delay: 0.04 }}
          >You</motion.span>
          <motion.span
            className="mg-spark"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.92] }}
            transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
          ><Sparkles size={28} strokeWidth={2.6} /></motion.span>
          <motion.span
            className="mg-av mg-av--them"
            initial={{ x: 150, rotate: 24, opacity: 0 }} animate={{ x: 0, rotate: 9, opacity: 1 }}
            transition={{ ...collide, delay: 0.04 }}
          >{initial}</motion.span>
        </div>

        <motion.h2
          className="mg-slam-title"
          initial={{ scale: 1.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.32, type: 'spring', stiffness: 300, damping: 17 }}
        >It’s a match</motion.h2>

        <motion.div
          className="mg-slam-card"
          initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.46, type: 'spring', stiffness: 300, damping: 24 }}
        >
          <div
            className={`mg-slam-thumb${pick.image ? '' : ` poster--${pick.category}`}`}
            style={pick.image ? { backgroundImage: `url(${pick.image})` } : undefined}
          />
          <div className="mg-slam-meta">
            <span className="mg-slam-cat">{CATEGORY_LABEL[pick.category]}</span>
            <span className="mg-slam-name">{pick.title}</span>
            <span className="mg-slam-sub">You both want to go here</span>
          </div>
        </motion.div>

        <motion.button
          className="mg-slam-go" onClick={dismiss}
          initial={{ opacity: 0 }} animate={{ opacity: armed ? 1 : 0.5 }} transition={{ delay: 0.5 }}
        >Keep swiping{count > 1 ? ` · ${count} matched` : ''}</motion.button>
      </motion.div>
    </motion.div>
  )
}

// THE PAYOFF — the shared plan once the round is done.
function MatchPlan({
  matched, total, partnerName, real, onOpen, onSave, onClose,
}: {
  matched: Pick[]; total: number; partnerName: string; real: boolean
  onOpen?: (p: Pick, origin?: DOMRect) => void; onSave: () => void; onClose: () => void
}) {
  const n = matched.length
  const [sent, setSent] = useState(false)
  // close the loop: send your matches BACK as the same kind of link, so they land on the plan you
  // both agreed on (from your name, stored when you last shared).
  function shareBack() {
    const me = (localStorage.getItem('wkndr.name') || '').trim()
    const url = `${location.origin}${location.pathname}?w=${matched.map((p) => p.id).join(',')}`
      + (me ? `&from=${encodeURIComponent(me)}` : '')
    const data = { title: 'WKNDR — our match', text: `${n} we both want to do`, url }
    if (navigator.share) { navigator.share(data).catch(() => {}); return }
    navigator.clipboard?.writeText(url).then(() => { setSent(true); setTimeout(() => setSent(false), 1800) })
  }
  return (
    <div className="mg-plan">
      <span className="mg-plan-eyebrow">Your weekend with {partnerName}</span>
      <h2 className="mg-plan-title">{n ? `${n} match${n > 1 ? 'es' : ''}` : 'No overlap — yet'}</h2>
      <p className="mg-plan-sub">
        {n
          ? 'The places you both said yes to. Build them into the weekend.'
          : `You ran through all ${total}. Nothing lined up this round — shuffle for a fresh deck.`}
      </p>
      {n > 0 && (
        <ul className="mg-plan-list">
          {matched.map((p) => (
            <li key={p.id} className="mg-plan-row" onClick={() => onOpen?.(p)}>
              <div
                className={`mg-plan-thumb${p.image ? '' : ` poster--${p.category}`}`}
                style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
              />
              <div className="mg-plan-info">
                <span className="mg-plan-cat">{CATEGORY_LABEL[p.category]}</span>
                <span className="mg-plan-name">{p.title}</span>
                <span className="mg-plan-when">{p.when}</span>
              </div>
              <Heart className="mg-plan-heart" size={15} strokeWidth={2.6} fill="currentColor" />
            </li>
          ))}
        </ul>
      )}
      <div className="mg-plan-actions">
        {n > 0 && <button className="mg-btn primary" onClick={onSave}>Add {n} to my list</button>}
        {real && n > 0 && <button className="mg-btn" onClick={shareBack}>{sent ? '✓ Link copied' : `Send ${partnerName} the plan`}</button>}
        <button className="mg-btn" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
