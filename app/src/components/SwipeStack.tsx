import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
} from 'react'
import {
  motion, useMotionValue, useTransform, animate,
  type MotionValue, type PanInfo,
} from 'framer-motion'
import type { Pick, SwipeDir } from '../types'
import { Card } from './Card'
import './SwipeStack.css'

const THRESHOLD = 105
const VELOCITY = 550
const IDLE_MS = 3000   // no interaction for this long → the deck demos itself
const RENDER = 4         // cards kept in the DOM
const VISIBLE_DEPTH = 2  // only 3 cards show; anything deeper parks behind the back one — a hidden
                         // buffer, so a card cycling in mounts unseen and only appears by being revealed
const STEP_SCALE = 0.05
const STEP_Y = 18

// unit direction the card travels when committed
const DIR: Record<SwipeDir, { x: number; y: number }> = {
  like: { x: 1, y: 0 },
  nope: { x: -1, y: 0 },
  save: { x: 0, y: -1 },
  skip: { x: 0, y: 1 },
}

interface CardHandle {
  fling: (dir: SwipeDir, info?: PanInfo) => void
  autoFling: () => void
}

interface SwipeCardProps {
  pick: Pick
  interactive: boolean
  depth: number // 0 = top
  dealIn: boolean // true → fly onto the deck (initial build); false → just fade (a card cycling in)
  progress: MotionValue<number>   // shared: how far the TOP card is dragged (0→1)
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onCycle?: (p: Pick) => void
  onOpen?: (p: Pick) => void
}

const PROGRESS_REF = 140   // px of drag at which the next card has fully advanced

// deterministic [-1, 1) from a string — gives each card a stable little imperfection
function hashUnit(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return ((h % 2000) / 1000) - 1
}

const SwipeCard = forwardRef<CardHandle, SwipeCardProps>(function SwipeCard(
  { pick, interactive, depth, dealIn, progress, onSwipe, onCycle, onOpen }, ref,
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
  const enterY = useMotionValue(dealIn ? 680 : 0)               // build-in: fly up from below
  const enterRotExtra = useMotionValue(dealIn ? (depth % 2 ? 7 : -7) : 0)  // entrance tilt → 0
  const enterOp = useMotionValue(0)
  const grabLever = useRef(0)                  // where you grabbed: -1 top … +1 bottom
  const cardRef = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)  // true once a real drag begins → suppresses the tap-to-open

  // Build-in: when the deck first deals (initial load, refresh, entering the stack) the
  // cards fly up onto it, back-to-front. A card that merely cycles in at the back later
  // just fades — no fly-in. Runs once on mount.
  useEffect(() => {
    const delay = dealIn ? (RENDER - 1 - depth) * 0.07 : 0
    animate(enterOp, 1, { duration: dealIn ? 0.5 : 0.34, delay, ease: [0.22, 1, 0.36, 1] })
    if (dealIn) {
      // a hair of overshoot + extra settle time so the card "drops" and rocks to rest, not a clean snap
      animate(enterY, 0, { type: 'spring', stiffness: 260, damping: 17, delay })
      animate(enterRotExtra, 0, { type: 'spring', stiffness: 240, damping: 14, delay })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tilt is torque: grabbing the TOP and pulling pivots the card hard one way, the BOTTOM
  // the other, a centre grab barely tilts. Plus any spin imparted on a toss.
  const rotate = useTransform([x, spin], ([lx, ls]: number[]) => {
    const tilt = lx * (0.026 - 0.055 * grabLever.current)
    return Math.max(-20, Math.min(20, tilt)) + ls
  })
  // drag feedback: left → bold red wash (dismiss), right → bold green wash (keep)
  const redOp = useTransform(x, [-130, -18], [0.88, 0])
  const greenOp = useTransform(x, [18, 130], [0, 0.88])

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

  // Fly the card off-screen along (dx, dy), carrying `speed` of momentum. The exit glides
  // at a fairly steady pace (a hard toss is only a little quicker) and is clamped so cards
  // leave the frame where you can see them. `onDone` fires once it's gone.
  function exit(dx: number, dy: number, speed: number, onDone: () => void) {
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
    animate(flipY, Math.sign(dx || 1) * (78 + r * 64), { duration: dur, ease })   // 78–142°
    animate(flipX, (Math.random() * 2 - 1) * 64, { duration: dur, ease })          // ±64°
    animate(pop, 1.16 + r * 0.2, { duration: dur * 0.62, ease })                   // 1.16–1.36 toward camera
    animate(x, targetX, { duration: dur, ease })
    animate(y, targetY, { duration: dur, ease, onComplete: onDone })
  }

  // Committed swipe: exit ALONG the throw (velocity flick → offset drag → cardinal fallback).
  function fling(dir: SwipeDir, info?: PanInfo) {
    let dx = DIR[dir].x, dy = DIR[dir].y, speed = 0
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
  useImperativeHandle(ref, () => ({ fling, autoFling }), [pick])

  // live: as the top card drags, publish how far (0→1) so the stack advances with it
  function onDrag(_e: unknown, info: PanInfo) {
    progress.set(Math.min(1, Math.hypot(info.offset.x, info.offset.y) / PROGRESS_REF))
  }
  function onDragEnd(_e: unknown, info: PanInfo) {
    const { offset, velocity } = info
    if (offset.x > THRESHOLD || velocity.x > VELOCITY) return fling('like', info)
    if (offset.x < -THRESHOLD || velocity.x < -VELOCITY) return fling('nope', info)
    if (offset.y < -THRESHOLD || velocity.y < -VELOCITY) return fling('save', info)
    if (offset.y > THRESHOLD || velocity.y > VELOCITY) return fling('skip', info)
    // not committed → card snaps home and the stack eases back (soft)
    animate(progress, 0, { type: 'spring', stiffness: 230, damping: 30 })
  }

  return (
    // SLOT — owns the stack position (depth scale + offset). Animates smoothly when a
    // card is promoted, so it never fights the drag offset (which lives on the inner).
    <motion.div
      className="swipe-card-slot"
      style={{ zIndex: 10 - depth, scale: slotScale, x: slotX, y: slotY, rotate: slotRot, opacity: enterOp, pointerEvents: interactive ? 'auto' : 'none' }}
    >
      {/* INNER — only the top card is draggable; x/y/rotate start at 0 every time */}
      <motion.div
        ref={cardRef}
        className="swipe-card"
        style={interactive ? { x, y, rotate, rotateY: flipY, rotateX: flipX, scale: pop, transformPerspective: 1200 } : undefined}
        drag={interactive}
        dragSnapToOrigin
        dragElastic={0.6}
        onPointerDown={interactive ? capturePoint : undefined}
        onTapStart={interactive ? () => { dragged.current = false } : undefined}
        onDragStart={interactive ? () => { dragged.current = true } : undefined}
        onDrag={interactive ? onDrag : undefined}
        onDragEnd={interactive ? onDragEnd : undefined}
        onTap={interactive ? () => { if (!dragged.current) onOpen?.(pick) } : undefined}
        whileTap={interactive ? { cursor: 'grabbing' } : undefined}
      >
        {interactive && (
          <>
            <motion.div className="swipe-tint red" style={{ opacity: redOp }} aria-hidden />
            <motion.div className="swipe-tint green" style={{ opacity: greenOp }} aria-hidden />
          </>
        )}
        <Card pick={pick} />
      </motion.div>
    </motion.div>
  )
})

export function SwipeStack({
  picks, onSwipe, onRefresh, onOpen, filterLabel, onClearFilter, onSeeList, paused = false,
}: {
  picks: Pick[]
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onRefresh?: () => void
  onOpen?: (p: Pick) => void
  filterLabel?: string | null
  onClearFilter?: () => void
  onSeeList?: () => void
  paused?: boolean   // suppress the idle demo (e.g. while a detail sheet is open)
}) {
  const topRef = useRef<CardHandle>(null)
  const progress = useMotionValue(0)   // top card's drag (0→1), drives the cards behind
  const firstDeal = useRef(true)       // only the initial set flies in; later arrivals fade
  useEffect(() => { firstDeal.current = false }, [])

  // Rotation counter — lets the idle demo send the top card to the back WITHOUT committing
  // a swipe. Derived synchronously from `picks` so a real swipe never lags / flashes.
  const [rot, setRot] = useState(0)
  const n = picks.length
  const order = useMemo(() => {
    if (n === 0) return picks
    const k = ((rot % n) + n) % n
    return k === 0 ? picks : [...picks.slice(k), ...picks.slice(0, k)]
  }, [picks, rot, n])

  const visible = order.slice(0, RENDER)

  const topId = visible[0]?.id
  useLayoutEffect(() => { progress.set(0) }, [topId, progress])

  // ---- idle demo -----------------------------------------------------------
  const idle = useRef<ReturnType<typeof setTimeout>>()
  const cycling = useRef(false)
  const canCycle = !paused && n > 1

  const arm = useCallback(() => {
    clearTimeout(idle.current)
    if (!canCycle) return
    idle.current = setTimeout(() => {
      if (document.hidden || cycling.current) { arm(); return }   // don't burn cycles in a hidden tab
      cycling.current = true
      topRef.current?.autoFling()
    }, IDLE_MS)
  }, [canCycle])

  function handleCycle() {
    cycling.current = false
    setRot((r) => r + 1)   // flung card → back of the deck; the topId-change effect re-arms
  }

  // Pause the instant a pointer goes down on the stack; resume the countdown only once it
  // lifts — so the deck never auto-flings mid-touch, and only resumes with no interaction.
  function pause() { clearTimeout(idle.current); cycling.current = false }
  useEffect(() => {
    const resume = () => arm()
    window.addEventListener('pointerup', resume)
    window.addEventListener('pointercancel', resume)
    return () => {
      window.removeEventListener('pointerup', resume)
      window.removeEventListener('pointercancel', resume)
    }
  }, [arm])

  // (re)arm whenever the top card changes or the pause/availability state flips
  useEffect(() => { arm(); return () => clearTimeout(idle.current) }, [arm, topId])

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
          {onRefresh && <button className="stack-btn" onClick={onRefresh}>↻ Refresh</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="stack-wrap" onPointerDown={pause}>
      <div className="stack-deck">
        {/* Stable DOM order — stacking is each slot's z-index, so we never reorder nodes
            on a swipe (reordering mid-transform = glitches). */}
        {visible.map((p, i) => (
          <SwipeCard
            key={p.id}
            ref={i === 0 ? topRef : undefined}
            pick={p}
            depth={i}
            dealIn={firstDeal.current}
            interactive={i === 0}
            progress={progress}
            onSwipe={onSwipe}
            onCycle={handleCycle}
            onOpen={onOpen}
          />
        ))}
      </div>

      <div className="stack-actions">
        <button className="act act-nope" onClick={() => topRef.current?.fling('nope')} aria-label="Not for me">✕</button>
        <button className="act act-save" onClick={() => topRef.current?.fling('save')} aria-label="Save">★</button>
      </div>
    </div>
  )
}
