import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Heart } from 'lucide-react'
import type { Pick, SwipeDir, Mode } from '../types'
import { CATEGORY_LABEL } from '../types'
import { SwipeStack } from './SwipeStack'
import { shareLink, shortCode } from '../lib/share'
import { postRound } from '../lib/relay'
import { track } from '../lib/metrics'
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
  picks, temp, mode, partnerName = 'Robin', partnerIds, roundId, onOpen, onClose, onComplete,
}: {
  picks: Pick[]
  temp?: number
  mode?: Mode
  partnerName?: string
  partnerIds?: string[]   // REAL partner's yes-set, decoded from the share link. Absent → demo (simulated).
  roundId?: string        // relay round id from the invite (`&r=`) — matches POST back under it (lib/relay)
  onOpen?: (p: Pick, origin?: DOMRect) => void
  onClose: () => void
  onComplete?: (matched: Pick[]) => void
}) {
  const real = !!partnerIds && partnerIds.length > 0
  // REAL: the deck IS the partner's shared picks (in feed-rank order) — "which of these do you
  // want too?", so every yes is genuine overlap. No image requirement — picks without a photo
  // render the typographic poster, and silently dropping shared picks broke the count.
  // DEMO: a slice of the feed with a simulated set.
  const session = useMemo(() => {
    if (real) {
      const want = new Set(partnerIds)
      return picks.filter((p) => want.has(p.id)).slice(0, 30)
    }
    return picks.filter((p) => p.image).slice(0, SESSION)
  }, [picks, real, partnerIds])
  const partnerYes = useMemo(
    () => (real
      ? new Set(partnerIds)
      : new Set(session.filter((p) => rand(`${p.id}·${partnerName}`) > 0.5).map((p) => p.id))),
    [real, partnerIds, session, partnerName],
  )
  // the queue is DERIVED (session minus what you've swiped) — not snapshotted at mount, so a
  // live feed landing mid-launch (which changes which shared ids resolve) flows straight in
  // instead of stranding a stale empty deck.
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set())
  const queue = useMemo(() => session.filter((p) => !swipedIds.has(p.id)), [session, swipedIds])
  const [matched, setMatched] = useState<Pick[]>([])
  const [slam, setSlam] = useState<Pick | null>(null)
  const total = session.length

  // self-managed exit: fade the overlay, THEN unmount. (AnimatePresence used to own this and
  // could strand the overlay mid-exit — invisible but still swallowing every tap: the "freeze".)
  const [leaving, setLeaving] = useState(false)
  function requestClose() {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onClose, 440)   // let the lift-away animation finish before unmounting
  }

  function onSwipe(p: Pick, dir: SwipeDir) {
    setSwipedIds((s) => new Set(s).add(p.id))
    const yes = dir === 'like' || dir === 'save'
    if (yes && partnerYes.has(p.id)) {
      haptic([14, 50, 22])
      track('match-slam')
      setMatched((m) => [...m, p])
      setSlam(p)
    }
  }

  const done = queue.length === 0
  const seen = total - queue.length

  // THE RELAY LEG — each match posts the running code-set under the invite's round id, and
  // completion posts done:true (that's what flips the sender's app to "it's a match" without
  // the manual link-back, and fires the email ping). Fire-and-forget: the "Send your matches"
  // button in MatchPlan stays as the fallback when the relay is off or unreachable. total===0
  // guards the dead-link case (done at mount with nothing swiped — not a completed round).
  useEffect(() => {
    if (!real || !roundId || total === 0) return
    if (!matched.length && !done) return
    postRound(roundId, matched.map(shortCode), (localStorage.getItem('wkndr.name') || '').trim(), done)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.length, done])

  return (
    <motion.div
      className="mg"
      /* enters with a quick fade; LEAVES by gently lifting away (fade + slight scale-up over
         a longer ease) so the hand-off to the app underneath feels like a reveal, not a cut. */
      initial={{ opacity: 0, scale: 1.01 }}
      animate={leaving ? { opacity: 0, scale: 1.03 } : { opacity: 1, scale: 1 }}
      transition={{ duration: leaving ? 0.44 : 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mg-head">
        <button className="mg-close" onClick={requestClose} aria-label="Close match"><X size={20} strokeWidth={2.4} /></button>
        <div className="mg-head-mid">
          <span className="mg-brand">WKNDR</span>
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
            slamOpen={!!slam}
            onSave={() => { onComplete?.(matched); requestClose() }} onClose={requestClose}
          />
        ) : (
          <SwipeStack picks={queue} temp={temp} mode={mode} onSwipe={onSwipe} onOpen={onOpen} nudge />
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
  matched, total, partnerName, real, slamOpen, onOpen, onSave, onClose,
}: {
  matched: Pick[]; total: number; partnerName: string; real: boolean; slamOpen?: boolean
  onOpen?: (p: Pick, origin?: DOMRect) => void; onSave: () => void; onClose: () => void
}) {
  const n = matched.length
  const [sent, setSent] = useState(false)
  // THE RETURN GATE — a real round that found matches must not end in silence. The sender
  // can't see ANY of this until the link comes back, and "send it back" buried as one of
  // three equal buttons got missed in the field (2026-07-11). So the return leg is a captive
  // final step above the plan; skippable, but only on purpose. Waits for the slam to clear.
  const [gate, setGate] = useState(real && n > 0)
  const showGate = gate && !slamOpen
  const canShare = !!navigator.share

  // the return link — same boomerang the plan actions send
  function returnPayload() {
    const me = (localStorage.getItem('wkndr.name') || '').trim()
    // `&m=1` = the confirmation breadcrumb: tells the original sender's app this is the RETURN leg
    // (you both matched), so it greets them with "it's a match" instead of a fresh invite.
    const url = shareLink(matched, me) + '&m=1'
    return { title: 'WKNDR — it’s a match', text: `${n} we both want to do this weekend`, url }
  }

  // auto-offer the sheet a beat after the gate composes — the ritual presents itself instead
  // of waiting to be found. Cancelling is a decision (AbortError, V.8.6): the gate stays up
  // with the explicit button, and the clipboard is never touched on the auto path.
  useEffect(() => {
    if (!showGate || !navigator.share) return
    const id = window.setTimeout(async () => {
      try {
        await navigator.share(returnPayload())
        track('plan-sent')   // only a COMPLETED auto-share counts — an auto-opened-then-cancelled sheet doesn't
        setGate(false)
      } catch { /* AbortError (or a blocked non-gesture call) — the giant button is right there */ }
    }, 800)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matched is frozen once the round is done
  }, [showGate])
  // a shared link can outlive the feed (it refreshes weekly; ids rotate) — when NONE of its
  // picks resolve, say so honestly instead of "you ran through all 0".
  if (total === 0) {
    return (
      <div className="mg-plan">
        <span className="mg-plan-eyebrow">Matching with {partnerName}</span>
        <h2 className="mg-plan-title">These picks have moved on</h2>
        <p className="mg-plan-sub">
          The feed refreshes every week, and the picks in this link aren’t in it anymore.
          Ask {partnerName} to share a fresh weekend — or see what’s on right now.
        </p>
        <div className="mg-plan-actions">
          <button className="mg-btn primary" onClick={onClose}>Explore Amsterdam →</button>
        </div>
      </div>
    )
  }
  // close the loop: send your matches BACK as the same kind of link, so they land on the plan you
  // both agreed on (from your name, stored when you last shared).
  async function shareBack() {
    track('plan-sent')   // the boomerang leaves — 'return-leg' on the sender's side completes it
    if (navigator.share) {
      // cancelling the sheet is AbortError — a decision, not a failure (V.8.6): stay put,
      // never fall through to the clipboard. A completed share has done the job: gate down.
      try { await navigator.share(returnPayload()); setGate(false) } catch { /* stay */ }
      return
    }
    navigator.clipboard?.writeText(returnPayload().url)
      .then(() => { setSent(true); setTimeout(() => setSent(false), 1800) })
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
        {/* the boomerang: closing the loop back to the sender is the primary move for a real
            match — one tap sends your matches back so THEY see what you both want. */}
        {real && n > 0 && <button className="mg-btn primary" onClick={shareBack}>{sent ? '✓ Copied — paste it to ' + partnerName : `Send ${partnerName} your matches`}</button>}
        {n > 0 && <button className={`mg-btn${real ? '' : ' primary'}`} onClick={onSave}>Add {n} to my list</button>}
        <button className="mg-btn" onClick={onClose}>See what else is on →</button>
      </div>

      <AnimatePresence>
        {showGate && (
          <ReturnGate
            partnerName={partnerName} n={n} sent={sent} canShare={canShare}
            onSend={shareBack}
            onSkip={() => { track('return-skipped'); setGate(false) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// THE CAPTIVE RETURN LEG — full-screen moment over the plan (the list stays readable behind
// the veil). One giant send, one quiet skip; no backdrop dismiss — leaving is a choice.
function ReturnGate({
  partnerName, n, sent, canShare, onSend, onSkip,
}: {
  partnerName: string; n: number; sent: boolean; canShare: boolean
  onSend: () => void; onSkip: () => void
}) {
  // same arm-delay as the slam: a queued tap from the last swipe of the round can land the
  // instant this composes and silently skip (or fire) the whole ritual — ignore taps until
  // the moment has visibly arrived.
  const [armed, setArmed] = useState(false)
  useEffect(() => { const id = setTimeout(() => setArmed(true), 700); return () => clearTimeout(id) }, [])
  return (
    <motion.div
      className="mg-gate"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
    >
      <motion.div
        className="mg-gate-inner"
        initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <span className="mg-gate-count">
          <Heart size={12} strokeWidth={2.8} fill="currentColor" /> {n} match{n > 1 ? 'es' : ''}
        </span>
        {/* "only way he finds out" is literally true while the relay (lib/relay) is dormant —
            once RELAY_URL goes live the matches may already have posted, so soften this copy then */}
        <h2 className="mg-gate-title">{partnerName} can’t see your swipes</h2>
        <p className="mg-gate-sub">
          This link is the only way {partnerName} finds out what you both said yes to.
          {canShare ? ' Send it back to finish the match.' : ' Copy it and send it back to finish the match.'}
        </p>
        <motion.button
          className="mg-gate-send" onClick={() => armed && onSend()}
          initial={{ opacity: 0 }} animate={{ opacity: armed ? 1 : 0.55 }} transition={{ delay: 0.2 }}
        >
          {sent ? `✓ Copied — paste it to ${partnerName}`
            : canShare ? `Send ${partnerName} your matches` : `Copy the link for ${partnerName}`}
        </motion.button>
        <button className="mg-gate-skip" onClick={() => armed && onSkip()}>Skip for now</button>
      </motion.div>
    </motion.div>
  )
}
