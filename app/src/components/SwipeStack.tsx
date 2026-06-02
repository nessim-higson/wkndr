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
const IDLE_MS = 3000   // sit still this long and the deck starts cycling itself

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
  const flip = useMotionValue(0)               // rotateX — used by the idle "tuck to the back"
  const lift = useMotionValue(1)               // scale — shrinks as it recedes
  const fade = useMotionValue(1)               // opacity — fades as it passes behind
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
    const exitSpeed = Math.min(2300, 1250 + speed * 0.2)    // harder toss → a bit quicker (gentle, clamped)
    const dur = Math.min(0.85, Math.max(0.58, dist / exitSpeed))
    const ease = [0.3, 0.18, 0.28, 1] as const
    // toss-spin: harder + edge-grabbed throws spin more, in the throw's horizontal sense
    const spinDeg = Math.sign(dx || 1) * (4 + Math.min(14, speed * 0.007)) * (0.55 + Math.abs(grabLever.current) * 0.6)
    animate(spin, spinDeg, { duration: dur, ease })
    animate(progress, 1, { duration: Math.min(0.5, dur), ease: 'easeOut' })   // next card advances as this flies
    animate(x, targetX, { duration: dur, ease })
    animate(y, targetY, { duration: dur, ease, onComplete: () => onSwipe(pick, dir) })
  }

  // The idle move: the top card tips back, shrinks and recedes — peeling off to the
  // back of the deck — while the cards behind ease forward (progress → 1). On finish,
  // the parent rotates this card to the end of the order; it then re-enters at the back.
  function cycle() {
    const ease = [0.45, 0, 0.2, 1] as const
    animate(progress, 1, { duration: 0.5, ease: 'easeInOut' })
    animate(flip, -32, { duration: 0.34, ease })
    animate(lift, 0.82, { duration: 0.66, ease })
    animate(y, 26, { duration: 0.66, ease })
    animate(fade, 0, { duration: 0.62, ease, onComplete: () => onCycle?.(pick) })
  }
  useImperativeHandle(ref, () => ({ fling, cycle }), [pick])

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
      style={{ zIndex: 10 - depth, scale: slotScale, y: slotY, pointerEvents: interactive ? 'auto' : 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* INNER — only the top card is draggable; x/y/rotate start at 0 every time */}
      <motion.div
        ref={cardRef}
        className="swipe-card"
        style={interactive ? { x, y, rotate, rotateX: flip, scale: lift, opacity: fade, transformPerspective: 1100 } : undefined}
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

  // The idle auto-cycle rotates cards to the back WITHOUT committing a swipe. Rather
  // than hold a separate order array (which would lag one render behind `picks` on a
  // real swipe and flash a stale card), we keep a rotation counter and derive the order
  // synchronously from `picks` — so a committed swipe stays seamless.
  const [rot, setRot] = useState(0)
  const n = picks.length
  const order = useMemo(() => {
    if (n === 0) return picks
    const k = ((rot % n) + n) % n
    return k === 0 ? picks : [...picks.slice(k), ...picks.slice(0, k)]
  }, [picks, rot, n])

  const visible = order.slice(0, 3)

  // When the top card changes (a swipe committed / a cycle rotated), reset progress AFTER
  // the new depths commit but BEFORE paint — so the promoted stack never flashes.
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
    setRot((r) => r + 1)   // advance one → top rotates to the back; arm() re-fires via topId effect
  }

  // (re)arm whenever the top card changes or the pause/availability state flips
  useEffect(() => { arm(); return () => clearTimeout(idle.current) }, [arm, topId])

  // any touch on the deck resets the idle clock (and interrupts a pending cycle)
  function bump() { cycling.current = false; arm() }

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
      <div className="stack-deck" onPointerDown={bump}>
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
            onCycle={handleCycle}
            onOpen={onOpen}
          />
        ))}
      </div>

      <div className="stack-actions">
        <button className="act act-nope" onClick={() => { bump(); topRef.current?.fling('nope') }} aria-label="Not for me">✕</button>
        <button className="act act-save" onClick={() => { bump(); topRef.current?.fling('save') }} aria-label="Save">★</button>
      </div>
    </div>
  )
}
