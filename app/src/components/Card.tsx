import type { Pick } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL } from '../types'
import './Card.css'

/** The big, image-led pick card. Used inside the swipe stack. */
export function Card({ pick }: { pick: Pick }) {
  return (
    <article className="card">
      <div className="card-img" style={{ backgroundImage: `url(${pick.image})` }}>
        <div className="card-tags">
          <span className="chip chip-fresh">{FRESHNESS_LABEL[pick.freshness]}</span>
          <span className="chip">{CATEGORY_LABEL[pick.category]}</span>
          {pick.outdoor && <span className="chip chip-light">Outdoor</span>}
          {pick.kid && <span className="chip chip-kid">Kids</span>}
        </div>
        <div className="card-img-foot mono">{pick.area} · {pick.price}</div>
      </div>
      <div className="card-body">
        <h2 className="card-title">{pick.title}</h2>
        <div className="card-venue">{pick.venue}</div>
        <p className="card-blurb">{pick.blurb}</p>
        <div className="card-why"><span aria-hidden>✦</span> {pick.why}</div>
        <div className="card-source mono">↳ {pick.source}</div>
      </div>
    </article>
  )
}
