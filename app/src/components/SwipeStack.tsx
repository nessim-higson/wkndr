import {
  forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef,
} from 'react'
import {
  motion, useMotionValue, useTransform, animate,
  type MotionValue, type PanInfo,
} from 'framer-motion'
import { X, Star } from 'lucide-react'
import type { Pick, SwipeDir, Mode } from '../types'
import { Card } from './Card'
import './SwipeStack.css'

// reduced motion: no entrance choreography, no exit tumble — cards land/leave in a step
const PRM = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const THRESHOLD = 105
const VELOCITY = 550
const RENDER = 4         // cards kept in the DOM
const VISIBLE_DEPTH = 2  // only 3 cards show; anything deeper parks behind the back one — a hidden
                         // buffer, so a card cycling in mounts unseen and only appears by being revealed
const STEP_SCALE = 0.05
const STEP_Y = 12   // depth offset per card — tightened (was 18) so the stack is compact
                    // and the ✕/★ controls can sit close beneath it without overlap

// unit direction the card travels when committed
const DIR: Record<SwipeDir, { x: number; y: number }> = {
  like: { x: 1, y: 0 },
  nope: { x: -1, y: 0 },
  save: { x: 1, y: 0 },   // the ✓ button mirrors a right-swipe (was up — read as neither yes nor no)
  skip: { x: 0, y: 1 },
}

interface CardHandle {
  fling: (dir: SwipeDir, info?: PanInfo) => void
  autoFling: () => void
  nudge: () => void
  open: () => void
}

interface SwipeCardProps {
  pick: Pick
  interactive: boolean
  depth: number // 0 = top
  dealIn: boolean // true → fly onto the deck (initial build); false → just fade (a card cycling in)
  progress: MotionValue<number>   // shared: how far the TOP card is dragged (0→1)
  temp?: number                   // forecast temp, shown on outdoor cards
  mode?: Mode                     // live weather mode → drives the card's "Perfect today" pill
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onOpen?: (p: Pick, origin?: DOMRect) => void
  onCycle?: (p: Pick) => void
}

const PROGRESS_REF = 140   // px of drag at which the next card has fully advanced

// deterministic [-1, 1) from a string — gives each card a stable little imperfection
function hashUnit(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return ((h % 2000) / 1000) - 1
}

const SwipeCard = forwardRef<CardHandle, SwipeCardProps>(function SwipeCard(
  { pick, interactive, depth, dealIn, progress, temp, mode, onSwipe, onOpen, onCycle }, ref,
) {
  // a touch of deterministic imperfection per card — the stack looks hand-laid, not machined
  const skew = useMemo(() => hashUnit(pick.id) * 2.8, [pick.id])        // ±2.8° resting tilt
  const restX = useMemo(() => hashUnit(`${pick.id}x`) * 7, [pick.id])   // ±7px resting nudge

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const spin = useMotionValue(0)               // extra rotation imparted by a toss
  const flipY = useMotionValue(0)              // 3D turn as the card flies off
  const flipX = useMotionValue(0)              // 3D tumble on exit (varies per throw)
  const pop = useMotionValue(1)                // grows toward camera on exit
  const enterY = useMotionValue(dealIn && !PRM ? 680 : 0)       // build-in: fly up from below
  const enterRotExtra = useMotionValue(dealIn && !PRM ? (depth % 2 ? 7 : -7) : 0)  // entrance tilt → 0
  // dealt cards fade in (fly-in). A card that CYCLES in at the back starts fully opaque and
  // is hidden purely by depth-occlusion (below) — no mount-fade, so no "blip" at the back.
  const enterOp = useMotionValue(dealIn && !PRM ? 0 : 1)
  const grabLever = useRef(0)                  // where you grabbed: -1 top … +1 bottom
  const cardRef = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)  // true once a real drag begins → suppresses the tap-to-open

  // Build-in: when the deck first deals (initial load, refresh, entering the stack) the
  // cards fly up onto it, back-to-front. A card that merely cycles in at the back later
  // just fades — no fly-in. Runs once on mount.
  useEffect(() => {
    if (dealIn && !PRM) {
      const delay = (RENDER - 1 - depth) * 0.07
      animate(enterOp, 1, { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] })
      // a soft drop that settles to rest (gentler than before — less bounce, no snap)
      animate(enterY, 0, { type: 'spring', stiffness: 220, damping: 24, delay })
      animate(enterRotExtra, 0, { type: 'spring', stiffness: 220, damping: 22, delay })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Safety: only the TOP card carries a fly-off transform. The moment a card is no longer
  // the top one, snap its drag/exit values back to rest — so a recycled card can never
  // reappear mid-flight or return to the top still flung off-screen (the reshuffle "pop").
  useEffect(() => {
    if (!interactive) {
      x.set(0); y.set(0); spin.set(0); flipY.set(0); flipX.set(0); pop.set(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive])

  // Tilt is torque: grabbing the TOP and pulling pivots the card hard one way, the BOTTOM
  // the other, a centre grab barely tilts. Plus any spin imparted on a toss.
  const rotate = useTransform([x, spin], ([lx, ls]: number[]) => {
    const tilt = lx * (0.026 - 0.055 * grabLever.current)
    return Math.max(-20, Math.min(20, tilt)) + ls
  })
  // drag feedback: left → red wash (dismiss), right → green wash (keep). The wash is a
  // supporting tint — the STAMP (the big ✓ / ✕ below) carries the signal.
  const redOp = useTransform(x, [-104, -8], [1, 0])
  const greenOp = useTransform(x, [8, 104], [0, 1])
  // the stamps grow into place as the drag commits — a slow settle, not a pop
  const likeScale = useTransform(x, [8, 120], [0.6, 1])
  const nopeScale = useTransform(x, [-120, -8], [1, 0.6])
  // 3D dimension WHILE dragging: the card turns on its Y axis as you pull sideways and tilts
  // on X as you pull up/down — and these compound with the exit flip (flipY/flipX) on release.
  const turnY = useTransform([x, flipY], ([lx, f]: number[]) => Math.max(-34, Math.min(34, lx * 0.07)) + f)
  const turnX = useTransform([y, flipX], ([ly, f]: number[]) => Math.max(-28, Math.min(28, -ly * 0.07)) + f)

  // record the grab point (relative to the card's height) the instant you press down
  function capturePoint(e: { clientY: number }) {
    const r = cardRef.current?.getBoundingClientRect()
    if (r) grabLever.current = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
  }

  // Each card sits at an effective depth of (depth − progress): as the top card is
  // dragged (progress 0→1), every card behind eases forward one step in lockstep. On
  // commit, depth decrements exactly as progress resets, so the position stays continuous.
  // clamp the visible depth: cards deeper than VISIBLE_DEPTH sit exactly where the back one
  // does (occluded behind it) until they advance forward — so the incoming card is never seen
  // to "insert", it just gets uncovered as the stack moves up.
  const eff = useTransform(progress, (p) => Math.min(VISIBLE_DEPTH, Math.max(0, depth - p)))
  const slotScale = useTransform(eff, (d) => 1 - d * STEP_SCALE)
  const slotY = useTransform([eff, enterY], ([d, ey]: number[]) => d * STEP_Y + ey)
  // resting imperfection scales with depth: the TOP card stays nearly square; deeper cards tilt/offset more
  const slotRot = useTransform([eff, enterRotExtra], ([d, ex]: number[]) => skew * Math.min(1, d) + ex)
  const slotX = useTransform(eff, (d) => restX * Math.min(1, d))
  // Depth occlusion: the buffer card (deeper than VISIBLE_DEPTH) is fully transparent behind
  // the back card, then revealed CONTINUOUSLY by progress as it advances forward — so a
  // cycling-in card is never seen to fade/insert ("blip"); it's just uncovered as the stack moves.
  const rawDepth = useTransform(progress, (p) => Math.max(0, depth - p))
  const depthOpacity = useTransform(rawDepth, (d) => 1 - Math.max(0, Math.min(1, d - VISIBLE_DEPTH)))
  const slotOpacity = useTransform([enterOp, depthOpacity], ([e, d]: number[]) => e * d)

  // Fly the card off-screen along (dx, dy), carrying `speed` of momentum. The exit glides
  // at a fairly steady pace (a hard toss is only a little quicker) and is clamped so cards
  // leave the frame where you can see them. `onDone` fires once it's gone.
  // `gentle` = an optional soft slide-out (mild tilt, no backface) — currently unused: buttons
  // synthesize a medium throw in fling() instead, so they exit EXACTLY like a real drag (Ness's
  // call after trying the gentle variant). Kept as the one-flag option if a softer exit is ever
  // wanted for a new surface.
  function exit(dx: number, dy: number, speed: number, onDone: () => void, gentle = false) {
    // reduced motion: no flight, no tumble — the card steps out with a short fade while the
    // stack advances, landing directly on the next stable state.
    if (PRM) {
      animate(progress, 1, { duration: 0.12, ease: 'easeOut' })
      animate(enterOp, 0, { duration: 0.16, ease: 'easeOut', onComplete: onDone })
      return
    }
    const W = window.innerWidth, H = window.innerHeight
    const mag = Math.hypot(dx, dy) || 1
    const reach = Math.max(W, H) * 1.25 + 200
    const targetX = (dx / mag) * reach
    const targetY = (dy / mag) * reach
    const dist = Math.hypot(targetX - x.get(), targetY - y.get())
    const exitSpeed = Math.min(2300, 1250 + speed * 0.2)
    const dur = Math.min(0.85, Math.max(0.58, dist / exitSpeed))
    const ease = [0.3, 0.18, 0.28, 1] as const
    const spinDeg = Math.sign(dx || 1) * (4 + Math.min(14, speed * 0.007)) * (0.55 + Math.abs(grabLever.current) * 0.6)
    animate(spin, spinDeg, { duration: dur, ease })
    animate(progress, 1, { duration: Math.min(0.5, dur), ease: 'easeOut' })   // next card advances as this flies
    // dimension on exit: a big, VARIED tumble — turns hard on Y, tumbles a little on X, and
    // lunges toward camera. Random per throw so no two exits look alike.
    const r = Math.random()
    const slideEase = [0.45, 0.05, 0.25, 1] as const   // from rest: visible wind-up, then away
    animate(flipY, Math.sign(dx || 1) * (gentle ? 22 : 110 + r * 70), { duration: dur, ease: gentle ? slideEase : ease })
    animate(flipX, gentle ? 0 : (Math.random() * 2 - 1) * 85, { duration: dur, ease })
    animate(pop, gentle ? 1.1 : 1.28 + r * 0.32, { duration: dur * 0.6, ease })
    // onDone rides the DOMINANT axis: it used to sit on y unconditionally, so a purely horizontal
    // exit (both buttons since V.8.19) had y animating 0 → 0 — framer completes a zero-distance
    // tween INSTANTLY, onDone fired on the spot, and the card unmounted before its first frame
    // ("the pop"). The axis that actually travels is the one that reports arrival.
    const xTravels = Math.abs(targetX - x.get()) >= Math.abs(targetY - y.get())
    animate(x, targetX, { duration: dur, ease: gentle ? slideEase : ease, onComplete: xTravels ? onDone : undefined })
    animate(y, targetY, { duration: dur, ease: gentle ? slideEase : ease, onComplete: xTravels ? undefined : onDone })
  }

  // Committed swipe: exit ALONG the throw (velocity flick → offset drag → cardinal fallback).
  function fling(dir: SwipeDir, info?: PanInfo) {
    try { navigator.vibrate?.(11) } catch { /* unsupported (iOS) */ }   // tactile commit
    let dx = DIR[dir].x, dy = DIR[dir].y, speed = 950   // button press = a synthesized MEDIUM THROW:
    // same momentum-scaled exit as a real drag (spin, tumble, pace) — with speed 0 the card left
    // from a standstill and read as a lifeless pop; with a fake velocity it flies like you threw it.
    if (info) {
      speed = Math.hypot(info.velocity.x, info.velocity.y)
      if (speed > 400) { dx = info.velocity.x; dy = info.velocity.y }
      else { dx = info.offset.x || DIR[dir].x; dy = info.offset.y || DIR[dir].y }
    }
    exit(dx, dy, speed, () => onSwipe(pick, dir))
  }

  // Idle demo: the top card slides off in a varying direction, then rotates to the back of
  // the deck (non-destructive — the deck never empties). Direction varies each time so the
  // deck fans itself out every which way while you're not touching it.
  function autoFling() {
    const ang = Math.random() * Math.PI * 2                 // any direction
    const lean = -0.5 + Math.random()                       // slight up/down lean for variety
    exit(Math.cos(ang), Math.sin(ang) * 0.7 + lean * 0.3, 650, () => onCycle?.(pick))
  }

  // First-run affordance: the top card leans right and settles — the universal "I swipe"
  // signal, shown with motion instead of an instruction. Rides the same x MotionValue as a
  // real drag (so the tilt/wash respond exactly as they would to a finger); aborts if the
  // user has already started dragging.
  function nudge() {
    if (dragged.current || PRM) return
    animate(x, 34, {
      duration: 0.32, ease: [0.22, 1, 0.36, 1],
      onComplete: () => animate(x, 0, { type: 'spring', stiffness: 240, damping: 14 }),
    })
  }
  function open() { onOpen?.(pick, cardRef.current?.getBoundingClientRect()) }
  useImperativeHandle(ref, () => ({ fling, autoFling, nudge, open }), [pick])

  // live: as the top card drags, publish how far (0→1) so the stack advances with it
  function onDrag(_e: unknown, info: PanInfo) {
    progress.set(Math.min(1, Math.hypot(info.offset.x, info.offset.y) / PROGRESS_REF))
  }
  function onDragEnd(_e: unknown, info: PanInfo) {
    const { offset, velocity } = info
    if (offset.x > THRESHOLD || velocity.x > VELOCITY) return fling('like', info)
    if (offset.x < -THRESHOLD || velocity.x < -VELOCITY) return fling('nope', info)
    // two gestures only — right = save, left = pass (was 4: up/down save/skip dropped)
    // not committed → ease the card home and the stack eases back (soft). We snap home
    // ourselves rather than via dragSnapToOrigin, which would otherwise fight a committed
    // exit on release and stutter for a frame.
    animate(x, 0, { type: 'spring', stiffness: 260, damping: 28 })
    animate(y, 0, { type: 'spring', stiffness: 260, damping: 28 })
    animate(progress, 0, { type: 'spring', stiffness: 230, damping: 30 })
  }

  return (
    // SLOT — owns the stack position (depth scale + offset). Animates smoothly when a
    // card is promoted, so it never fights the drag offset (which lives on the inner).
    <motion.div
      className="swipe-card-slot"
      style={{ zIndex: 10 - depth, scale: slotScale, x: slotX, y: slotY, rotate: slotRot, opacity: slotOpacity, pointerEvents: interactive ? 'auto' : 'none' }}
    >
      {/* INNER — only the top card is draggable; x/y/rotate start at 0 every time.
          Tap (no drag) opens the detail, which expands out of THIS card's position. */}
      <motion.div
        ref={cardRef}
        className="swipe-card"
        style={interactive ? { x, y, rotate, rotateY: turnY, rotateX: turnX, scale: pop, transformPerspective: 1100 } : undefined}
        drag={interactive ? 'x' : false}   /* two gestures: the card only slides left/right */
        dragElastic={0.6}
        dragMomentum={false}   /* WE own the release animation (exit or ease-home); framer's
                                  inertia would otherwise coast the card and fight it → the snap */
        onPointerDown={interactive ? capturePoint : undefined}
        onTapStart={interactive ? () => { dragged.current = false } : undefined}
        onDragStart={interactive ? () => { dragged.current = true } : undefined}
        onDrag={interactive ? onDrag : undefined}
        onDragEnd={interactive ? onDragEnd : undefined}
        onTap={interactive ? () => { if (!dragged.current) onOpen?.(pick, cardRef.current?.getBoundingClientRect()) } : undefined}
        whileTap={interactive ? { cursor: 'grabbing' } : undefined}
        /* keyboard/SR surface — swipe is never the only way in: the top card is a real button
           (Enter/Space opens details; ←/→ skip/save ride the global handler below) */
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-label={interactive ? `${pick.title} — ${pick.venue}, ${pick.when}. Enter opens details; arrow keys skip or save.` : undefined}
        onKeyDown={interactive ? (e: { key: string; preventDefault: () => void }) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(pick, cardRef.current?.getBoundingClientRect()) }
        } : undefined}
      >
        {interactive && (
          <>
            <motion.div className="swipe-tint red" style={{ opacity: redOp }} aria-hidden />
            <motion.div className="swipe-tint green" style={{ opacity: greenOp }} aria-hidden />
            {/* the commit STAMPS — a large glass ✓ / ✕ that settles into the card's centre
                as the drag commits. White-on-glass; the tint beneath supplies the colour. */}
            <motion.div className="stamp" style={{ opacity: greenOp, scale: likeScale, rotate: 6 }} aria-hidden>
              <Star size={44} strokeWidth={2.2} fill="currentColor" />
            </motion.div>
            <motion.div className="stamp" style={{ opacity: redOp, scale: nopeScale, rotate: -6 }} aria-hidden>
              <X size={46} strokeWidth={2.4} />
            </motion.div>
          </>
        )}
        <Card pick={pick} temp={temp} mode={mode} />
      </motion.div>
    </motion.div>
  )
})

export function SwipeStack({
  picks, temp, mode, onSwipe, onOpen, onRefresh, filterLabel, onClearFilter, onSeeList, nudge, keysActive,
}: {
  picks: Pick[]
  temp?: number
  mode?: Mode
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onOpen?: (p: Pick, origin?: DOMRect) => void
  onRefresh?: () => void
  filterLabel?: string | null
  onClearFilter?: () => void
  onSeeList?: () => void
  nudge?: boolean   // arm the one-time first-run swipe hint (fires once per device, ever)
  keysActive?: boolean  // App says when the deck owns the keyboard (no overlay/menu open)
}) {
  const topRef = useRef<CardHandle>(null)
  const progress = useMotionValue(0)   // top card's drag (0→1), drives the cards behind
  const firstDeal = useRef(true)       // only the initial set flies in; later arrivals fade
  useEffect(() => { firstDeal.current = false }, [])

  // keyboard swipes — ← skips, → saves (matching the drag directions), Enter opens the top
  // card's details — wherever focus sits, as long as no sheet/menu is above the deck and
  // you're not typing in a field. (The top card is ALSO a focusable button with its own
  // Enter/Space — this window-level path covers focus-on-body.)
  useEffect(() => {
    if (!keysActive) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); topRef.current?.fling('nope') }
      else if (e.key === 'ArrowRight') { e.preventDefault(); topRef.current?.fling('save') }
      else if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A' && !t?.closest('.swipe-card')) {
        e.preventDefault(); topRef.current?.open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keysActive])

  // the first-run hint: after the deal-in settles (~0.9s), lean the top card once. localStorage
  // gate = once per device across BOTH decks (browse stack + match game) — whichever shows first.
  useEffect(() => {
    if (!nudge || !picks.length) return
    if (localStorage.getItem('wkndr.nudged')) return
    const id = window.setTimeout(() => {
      topRef.current?.nudge()
      localStorage.setItem('wkndr.nudged', '1')
    }, 900)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge])

  // The deck never moves on its own — no idle auto-flip. Cards only leave when YOU swipe
  // (or hit the action buttons). Stable DOM order; stacking is each slot's z-index.
  const visible = picks.slice(0, RENDER)
  const topId = visible[0]?.id
  useLayoutEffect(() => { progress.set(0) }, [topId, progress])

  if (visible.length === 0) {
    return (
      <div className="stack-empty">
        <p className="stack-empty-title">
          {filterLabel ? 'That’s everything in this filter.' : 'That’s the weekend.'}
        </p>
        <span>
          {filterLabel
            ? 'Clear the filters for the full set, or check back as the week refreshes.'
            : 'You’ve seen every pick. Fresh ones land each week — run through again, or browse the full list.'}
        </span>
        <div className="stack-empty-actions">
          {filterLabel && onClearFilter && (
            <button className="stack-btn primary" onClick={onClearFilter}>Clear filters</button>
          )}
          {onSeeList && <button className="stack-btn" onClick={onSeeList}>See all in List</button>}
          {onRefresh && <button className="stack-btn" onClick={onRefresh}>Refresh</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="stack-wrap">
      <div className="stack-deck">
        {visible.map((p, i) => (
          <SwipeCard
            key={p.id}
            ref={i === 0 ? topRef : undefined}
            pick={p}
            depth={i}
            dealIn={firstDeal.current}
            interactive={i === 0}
            progress={progress}
            temp={temp}
            mode={mode}
            onSwipe={onSwipe}
            onOpen={onOpen}
          />
        ))}
      </div>

      {/* the top card announced for screen readers as the deck advances */}
      <div className="sr-only" aria-live="polite">
        {visible[0] ? `${visible[0].title} — ${visible[0].venue}, ${visible[0].when}` : ''}
      </div>

      <div className="stack-actions">
        <button className="act act-nope" onClick={() => topRef.current?.fling('nope')} aria-label="Skip">
          <X size={22} strokeWidth={2.5} />
          <span className="act-label" aria-hidden>Skip</span>
        </button>
        <button className="act act-save" onClick={() => topRef.current?.fling('save')} aria-label="Save">
          <Star size={21} strokeWidth={2.2} />
          <span className="act-label" aria-hidden>Save</span>
        </button>
      </div>

      {onRefresh && (
        <button className="stack-more" onClick={onRefresh}>
          Not feeling these? <b>Shuffle for more</b>
        </button>
      )}
    </div>
  )
}
