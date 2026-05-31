import type { Mode, Pick, Category } from '../types'
import { CATEGORY_LABEL } from '../types'
import './GuideView.css'

// reading order for the canon
const ORDER: Category[] = ['art', 'eat', 'drink', 'out', 'market', 'daytrip', 'live', 'stage']

/**
 * The evergreen "Guide / Canon" — the always-good things, grouped by category,
 * weather-tagged and taste-ranked. The reference layer + the bottomless safety net.
 * Picks arrive already ranked (weather × taste), so order within a group reflects
 * what fits today + your taste; "Good today" flags weather-fit.
 */
export function GuideView({
  picks, mode, savedIds, onOpen, onToggleSave,
}: {
  picks: Pick[]
  mode: Mode
  savedIds: Set<string>
  onOpen: (p: Pick) => void
  onToggleSave: (p: Pick) => void
}) {
  const groups = new Map<Category, Pick[]>()
  for (const p of picks) {
    if (!groups.has(p.category)) groups.set(p.category, [])
    groups.get(p.category)!.push(p)
  }
  const cats = ORDER.filter((c) => groups.has(c))

  if (picks.length === 0) {
    return <div className="guide-empty">No evergreen picks in this view.</div>
  }

  return (
    <div className="guide">
      <p className="guide-intro">The canon — Amsterdam’s always-good, ranked for today’s weather and your taste.</p>
      {cats.map((cat) => (
        <section className="guide-group" key={cat}>
          <h3 className="guide-cat">{CATEGORY_LABEL[cat]}<span>{groups.get(cat)!.length}</span></h3>
          <div className="guide-grid">
            {groups.get(cat)!.map((p) => {
              const saved = savedIds.has(p.id)
              const goodToday = p.weatherFit.includes(mode)
              return (
                <article className="g-card" key={p.id} onClick={() => onOpen(p)}>
                  <div className="g-img" style={{ backgroundImage: `url(${p.image})` }}>
                    {goodToday && <span className="g-now">Good today</span>}
                    <button
                      className={`g-save${saved ? ' on' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleSave(p) }}
                      aria-label={saved ? 'Saved' : 'Save'}
                    >★</button>
                  </div>
                  <div className="g-body">
                    <h4 className="g-title">{p.title}</h4>
                    <div className="g-meta">{p.area} · {p.price}</div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
