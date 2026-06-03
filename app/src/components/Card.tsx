import { Sparkles } from 'lucide-react'
import type { Pick } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'
import './Card.css'

/** The big, image-led pick card — full-bleed photo with the details over a scrim. */
export function Card({ pick }: { pick: Pick }) {
  return (
    <article
      className={`card${pick.image ? '' : ` poster poster--${pick.category}`}`}
      style={pick.image ? { backgroundImage: `url(${pick.image})` } : undefined}
    >
      <div className="card-tags">
        {pick.status && <span className={`chip chip-status chip-status--${pick.status}`}>{STATUS_LABEL[pick.status]}</span>}
        <span className={`chip chip-fresh chip-fresh--${pick.freshness}`}>{FRESHNESS_LABEL[pick.freshness]}</span>
        <span className="chip chip-cat">{CATEGORY_LABEL[pick.category]}</span>
        {pick.outdoor && <span className="chip chip-outdoor">Outdoor</span>}
        {pick.kid && <span className="chip chip-kid">Kids</span>}
      </div>

      {!pick.image && <span className="poster-mark">{CATEGORY_LABEL[pick.category]}</span>}

      <div className="card-scrim" aria-hidden />
      <div className="card-body">
        <div className="card-when mono">
          {pick.when}
          {pick.verify && <span className="verify">verify</span>}
        </div>
        <h2 className="card-title">{pick.title}</h2>
        <div className="card-venue">{pick.venue} · {pick.area} · {pick.price}</div>
        <p className="card-blurb">{pick.blurb}</p>
        <div className="card-why"><Sparkles className="why-mark" size={13} strokeWidth={2.2} /> {pick.why}</div>
      </div>
    </article>
  )
}
