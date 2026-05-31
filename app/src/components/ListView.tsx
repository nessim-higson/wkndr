import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL } from '../types'
import './ListView.css'

/** The scannable posture — same ranked pool, compact rows. */
export function ListView({
  picks, savedIds, onSwipe,
}: {
  picks: Pick[]
  savedIds: Set<string>
  onSwipe: (p: Pick, dir: SwipeDir) => void
}) {
  return (
    <div className="list">
      {picks.map((p) => {
        const saved = savedIds.has(p.id)
        return (
          <article className="row" key={p.id}>
            <div className="row-thumb" style={{ backgroundImage: `url(${p.image})` }} />
            <div className="row-main">
              <div className="row-tags mono">
                <span className="row-fresh">{FRESHNESS_LABEL[p.freshness]}</span>
                <span>· {CATEGORY_LABEL[p.category]}</span>
              </div>
              <h3 className="row-title">{p.title}</h3>
              <div className="row-meta">{p.venue} · {p.area} · {p.price}</div>
              <div className="row-why">{p.why}</div>
            </div>
            <button
              className={`row-save${saved ? ' on' : ''}`}
              onClick={() => onSwipe(p, saved ? 'skip' : 'save')}
              aria-label={saved ? 'Saved' : 'Save'}
            >★</button>
          </article>
        )
      })}
      {picks.length === 0 && <p className="list-empty mono">No picks for this view yet.</p>}
    </div>
  )
}
