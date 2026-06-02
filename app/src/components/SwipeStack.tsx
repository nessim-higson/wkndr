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
const IDLE_MS = 3000   // no interaction for this long → the deck starts cycling itself
const RENDER = 4       // cards kept in the DOM (depth 0..3); depth 3 is the rear/receiving slot
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
  cycle: () => void
}

interface SwipeCardProps {
  pick: Pick
  interactive: boolean
  depth: number // 0 = top
  progress: MotionValue<number>   // shared: how far the TOP card is dragged (0→1)
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onCycle?: (p: Pick) => void
  onOpen?: (p: Pick) => void
}

const PROGRESS_REF = 140   // px of drag at which the next card has fully advanced

const SwipeCard = forwardRef<CardHandle, SwipeCardProps>(function SwipeCard(
  { pick, interactive, depth, progress, onSwipe, onCycle, onOpen }, ref,
) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const spin = useMotionValue(0)               // extra rotation imparted by a toss
  const lift = useMotionValue(1)               // inner scale — shrinks as it slides to the back
  const slotZ = useMotionValue(10 - depth)     // stacking order; the cycle drops it behind the deck
  const grabLever = useRef(0)                  // where you grabbed: -1 top … +1 bottom
  const cardRef = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)  // true once a real drag begins → suppresses the tap-to-open

  // keep z in step with depth as cards are promoted (except while a cycle has parked it behind)
  useLayoutEffect(() => { slotZ.set(10 - depth) }, [depth, slotZ])

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
  const slotScale = useTransform(progress, (p) => 1 - Math.max(0, depth - p) * STEP_SCALE)
  const slotY = useTransform(progress, (p) => Math.max(0, depth - p) * STEP_Y)

  // Throw the card off-screen in `dir`, carrying the gesture's momentum.
  function fling(dir: SwipeDir, info?: PanInfo) {
    const W = window.innerWidth, H = window.innerHeight
    let dx = DIR[dir].x, dy = DIR[dir].y, speed = 0
    if (info) {
      speed = Math.hypot(info.velocity.x, info.velocity.y)
      if (speed > 400) { dx = info.velocity.x; dy = info.velocity.y }
      else { dx = info.offset.x || DIR[dir].x; dy = info.offset.y || DIR[dir].y }
    }
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
    animate(progress, 1, { duration: Math.min(0.5, dur), ease: 'easeOut' })
    animate(x, targetX, { duration: dur, ease })
    animate(y, targetY, { duration: dur, ease, onComplete: () => onSwipe(pick, dir) })
  }

  // The idle move: the top card drops BEHIND the deck (z below the others) and slides
  // straight back into the rearmost slot — shrinking and lowering to match it — while the
  // cards in front advance one step. No lift, no fade: it literally tucks behind the stack.
  // The rear slot is occluded, so when the parent then rotates the order the swap is unseen.
  function cycle() {
    const ease = [0.4, 0, 0.2, 1] as const
    const dur = 0.7
    const rear = RENDER - 1                       // deepest rendered slot
    slotZ.set(1)                                  // behind every other card (their z is 7..10)
    animate(progress, 1, { duration: dur, ease })
    animate(lift, 1 - rear * STEP_SCALE, { duration: dur, ease })   // shrink to rear-slot size
    animate(y, rear * STEP_Y, { duration: dur, ease, onComplete: () => onCycle?.(pick) })   // settle into rear slot
  }
  useImperativeHandle(ref, () => ({ fling, cycle }), [pick])

  function onDrag(_e: unknown, info: PanInfo) {
    progress.set(Math.min(1, Math.hypot(info.offset.x, info.offset.y) / PROGRESS_REF))
  }
  function onDragEnd(_e: unknown, info: PanInfo) {
    const { offset, velocity } = info
    if (offset.x > THRESHOLD || velocity.x > VELOCITY) return fling('like', info)
    if (offset.x < -THRESHOLD || velocity.x < -VELOCITY) return fling('nope', info)
    if (offset.y < -THRESHOLD || velocity.y < -VELOCITY) return fling('save', info)
    if (offset.y > THRESHOLD || velocity.y > VELOCITY) return fling('skip', info)
    animate(progress, 0, { type: 'spring', stiffness: 230, damping: 30 })
  }

  return (
    // SLOT — owns the stack position (depth scale + offset) and stacking order.
    <motion.div
      className="swipe-card-slot"
      style={{ zIndex: slotZ, scale: slotScale, y: slotY, pointerEvents: interactive ? 'auto' : 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* INNER — only the top card is draggable; x/y/rotate start at 0 every time */}
      <motion.div
        ref={cardRef}
        className="swipe-card"
        style={interactive ? { x, y, rotate, scale: lift } : undefined}
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
  paused?: boolean   // suppress the idle auto-cycle (e.g. while a detail sheet is open)
}) {
  const topRef = useRef<CardHandle>(null)
  const progress = useMotionValue(0)   // top card's drag (0→1), drives the cards behind

  // Rotation counter — lets the idle auto-cycle send the top card to the back WITHOUT
  // committing a swipe. Derived synchronously from `picks` so a real swipe never lags.
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

  // ---- idle auto-cycle -----------------------------------------------------
  const idle = useRef<ReturnType<typeof setTimeout>>()
  const cycling = useRef(false)
  const canCycle = !paused && n > 1

  const arm = useCallback(() => {
    clearTimeout(idle.current)
    if (!canCycle) return
    idle.current = setTimeout(() => {
      if (document.hidden || cycling.current) { arm(); return }   // don't burn cycles in a hidden tab
      cycling.current = true
      topRef.current?.cycle()
    }, IDLE_MS)
  }, [canCycle])

  function handleCycle() {
    cycling.current = false
    setRot((r) => r + 1)   // top → back; the topId-change effect re-arms the idle clock
  }

  // Pause the instant a pointer goes down on the stack; resume the countdown only once it
  // lifts — so the deck never cycles mid-drag, and only resumes after you stop interacting.
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
