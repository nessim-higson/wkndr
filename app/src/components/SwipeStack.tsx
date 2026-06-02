import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import {
  motion, useMotionValue, useTransform, animate,
  type MotionValue, type PanInfo,
} from 'framer-motion'
import type { Pick, SwipeDir } from '../types'
import { Card } from './Card'
import './SwipeStack.css'

const THRESHOLD = 105
const VELOCITY = 550

// unit direction the card travels when committed
const DIR: Record<SwipeDir, { x: number; y: number }> = {
  like: { x: 1, y: 0 },
  nope: { x: -1, y: 0 },
  save: { x: 0, y: -1 },
  skip: { x: 0, y: 1 },
}

interface CardHandle { fling: (dir: SwipeDir, info?: PanInfo) => void }

interface SwipeCardProps {
  pick: Pick
  interactive: boolean
  depth: number // 0 = top
  progress: MotionValue<number>   // shared: how far the TOP card is dragged (0→1)
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onOpen?: (p: Pick) => void
}

const PROGRESS_REF = 140   // px of drag at which the next card has fully advanced

const SwipeCard = forwardRef<CardHandle, SwipeCardProps>(function SwipeCard(
  { pick, interactive, depth, progress, onSwipe, onOpen }, ref,
) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const spin = useMotionValue(0)               // extra rotation imparted by a toss
  const grabLever = useRef(0)                  // where you grabbed: -1 top … +1 bottom
  const cardRef = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)  // true once a real drag begins → suppresses the tap-to-open

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
  const slotScale = useTransform(progress, (p) => 1 - Math.max(0, depth - p) * 0.05)
  const slotY = useTransform(progress, (p) => Math.max(0, depth - p) * 18)

  // Throw the card off-screen in `dir`, carrying the gesture's momentum. The exit
  // glides at a fairly consistent pace (a hard toss is only a little quicker) and is
  // clamped so cards never just vanish — they leave the frame where you can see them.
  function fling(dir: SwipeDir, info?: PanInfo) {
    const W = window.innerWidth, H = window.innerHeight
    // exit ALONG the throw: a flick uses the velocity vector, a slow drag uses the offset,
    // a button press falls back to the cardinal direction. So a diagonal toss flies off diagonally.
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
    const exitSpeed = Math.min(3200, 1850 + speed * 0.32)   // harder toss → quicker exit (clamped)
    const dur = Math.min(0.62, Math.max(0.4, dist / exitSpeed))
    const ease = [0.32, 0.12, 0.24, 1] as const
    // toss-spin: harder + edge-grabbed throws spin more, in the throw's horizontal sense
    const spinDeg = Math.sign(dx || 1) * (8 + Math.min(26, speed * 0.012)) * (0.6 + Math.abs(grabLever.current) * 0.8)
    animate(spin, spinDeg, { duration: dur, ease })
    animate(progress, 1, { duration: Math.min(0.34, dur), ease: 'easeOut' })   // next card advances as this flies
    animate(x, targetX, { duration: dur, ease })
    animate(y, targetY, { duration: dur, ease, onComplete: () => onSwipe(pick, dir) })
  }
  useImperativeHandle(ref, () => ({ fling }), [pick])

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
    // not committed → card snaps home and the stack eases back
    animate(progress, 0, { type: 'spring', stiffness: 320, damping: 32 })
  }

  return (
    // SLOT — owns the stack position (depth scale + offset). Animates smoothly when a
    // card is promoted, so it never fights the drag offset (which lives on the inner).
    <motion.div
      className="swipe-card-slot"
      style={{ zIndex: 10 - depth, scale: slotScale, y: slotY, pointerEvents: interactive ? 'auto' : 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* INNER — only the top card is draggable; x/y/rotate start at 0 every time */}
      <motion.div
        ref={cardRef}
        className="swipe-card"
        style={interactive ? { x, y, rotate } : undefined}
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
  picks, onSwipe, onRefresh, onOpen, filterLabel, onClearFilter, onSeeList,
}: {
  picks: Pick[]
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onRefresh?: () => void
  onOpen?: (p: Pick) => void
  filterLabel?: string | null
  onClearFilter?: () => void
  onSeeList?: () => void
}) {
  const topRef = useRef<CardHandle>(null)
  const progress = useMotionValue(0)   // top card's drag (0→1), drives the cards behind
  const visible = picks.slice(0, 3)

  // When the top card changes (a swipe committed), reset progress AFTER the new depths
  // commit but BEFORE paint — so the promoted stack never flashes its pre-shift frame.
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
          {onRefresh && <button className="stack-btn" onClick={onRefresh}>↻ Refresh</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="stack-wrap">
      <div className="stack-deck">
        {/* Stable DOM order — stacking is handled by each slot's z-index (set per depth),
            so we never reorder nodes on a swipe (reordering mid-transform = glitches). */}
        {visible.map((p, i) => (
          <SwipeCard
            key={p.id}
            ref={i === 0 ? topRef : undefined}
            pick={p}
            depth={i}
            interactive={i === 0}
            progress={progress}
            onSwipe={onSwipe}
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
