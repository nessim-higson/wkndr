import { forwardRef, useImperativeHandle, useRef } from 'react'
import {
  motion, useMotionValue, useTransform, animate,
  type PanInfo,
} from 'framer-motion'
import type { Pick, SwipeDir } from '../types'
import { Card } from './Card'
import './SwipeStack.css'

const THRESHOLD = 110
const VELOCITY = 600

const FLING: Record<SwipeDir, { x: number; y: number }> = {
  like: { x: 700, y: 0 },
  nope: { x: -700, y: 0 },
  save: { x: 0, y: -800 },
  skip: { x: 0, y: 600 },
}

interface CardHandle { fling: (dir: SwipeDir) => void }

interface SwipeCardProps {
  pick: Pick
  interactive: boolean
  depth: number // 0 = top
  onSwipe: (p: Pick, dir: SwipeDir) => void
  onOpen?: (p: Pick) => void
}

const SwipeCard = forwardRef<CardHandle, SwipeCardProps>(function SwipeCard(
  { pick, interactive, depth, onSwipe, onOpen }, ref,
) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-13, 13])
  const dragged = useRef(false)  // true once a real drag begins → suppresses the tap-to-open

  // directional indicator opacities driven by the drag
  const likeOp = useTransform(x, [40, 150], [0, 1])
  const nopeOp = useTransform(x, [-150, -40], [1, 0])
  const saveOp = useTransform(y, [-150, -40], [1, 0])
  const skipOp = useTransform(y, [40, 150], [0, 1])

  function fling(dir: SwipeDir) {
    const t = FLING[dir]
    animate(x, t.x, { duration: 0.32, ease: 'easeIn' })
    animate(y, t.y, { duration: 0.32, ease: 'easeIn', onComplete: () => onSwipe(pick, dir) })
  }
  useImperativeHandle(ref, () => ({ fling }), [pick])

  function onDragEnd(_e: unknown, info: PanInfo) {
    const { offset, velocity } = info
    if (offset.x > THRESHOLD || velocity.x > VELOCITY) return fling('like')
    if (offset.x < -THRESHOLD || velocity.x < -VELOCITY) return fling('nope')
    if (offset.y < -THRESHOLD || velocity.y < -VELOCITY) return fling('save')
    if (offset.y > THRESHOLD || velocity.y > VELOCITY) return fling('skip')
    // otherwise dragSnapToOrigin returns it home
  }

  return (
    <motion.div
      className="swipe-card"
      style={interactive ? { x, y, rotate, zIndex: 10 } : { zIndex: 10 - depth }}
      initial={{ scale: 0.94 }}
      animate={interactive
        ? { scale: 1 }
        : { scale: 1 - depth * 0.045, y: depth * 16 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag={interactive}
      dragSnapToOrigin
      dragElastic={0.6}
      onTapStart={interactive ? () => { dragged.current = false } : undefined}
      onDragStart={interactive ? () => { dragged.current = true } : undefined}
      onDragEnd={interactive ? onDragEnd : undefined}
      onTap={interactive ? () => { if (!dragged.current) onOpen?.(pick) } : undefined}
      whileTap={interactive ? { cursor: 'grabbing' } : undefined}
    >
      {interactive && (
        <>
          <motion.div className="ind ind-like" style={{ opacity: likeOp }}>LIKE</motion.div>
          <motion.div className="ind ind-nope" style={{ opacity: nopeOp }}>NOPE</motion.div>
          <motion.div className="ind ind-save" style={{ opacity: saveOp }}>SAVE</motion.div>
          <motion.div className="ind ind-skip" style={{ opacity: skipOp }}>SKIP</motion.div>
        </>
      )}
      <Card pick={pick} />
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
  const visible = picks.slice(0, 3)

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
        {/* render back-to-front so the top card paints last */}
        {visible.map((p, i) => (
          <SwipeCard
            key={p.id}
            ref={i === 0 ? topRef : undefined}
            pick={p}
            depth={i}
            interactive={i === 0}
            onSwipe={onSwipe}
            onOpen={onOpen}
          />
        )).reverse()}
      </div>

      <div className="stack-actions">
        <button className="act act-nope" onClick={() => topRef.current?.fling('nope')} aria-label="Not for me">✕</button>
        <button className="act act-skip" onClick={() => topRef.current?.fling('skip')} aria-label="Skip">↓</button>
        <button className="act act-save" onClick={() => topRef.current?.fling('save')} aria-label="Save">★</button>
        <button className="act act-like" onClick={() => topRef.current?.fling('like')} aria-label="Like">♥</button>
      </div>
    </div>
  )
}
