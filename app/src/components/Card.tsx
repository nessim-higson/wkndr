import { RotateCw } from 'lucide-react'
import type { Pick } from '../types'
import { CATEGORY_LABEL, STATUS_LABEL } from '../types'
import './Card.css'

/** The stack card FRONT — simple & image-led, like the fan: a scarcity flag, the category,
 *  the title, and the date hero'd. The rich detail lives on the back (tap to flip). */
export function Card({ pick }: { pick: Pick }) {
  const closing = pick.freshness === 'ending'
  return (
    <article
      className={`card${pick.image ? '' : ` poster poster--${pick.category}`}`}
      style={pick.image ? { backgroundImage: `url(${pick.image})` } : undefined}
    >
      {(pick.status || closing) && (
        <div className="card-tags">
          {pick.status && <span className={`chip chip-status chip-status--${pick.status}`}>{STATUS_LABEL[pick.status]}</span>}
          {closing && !pick.status && <span className="chip chip-closing">Closing soon</span>}
        </div>
      )}

      {!pick.image && <span className="poster-mark">{CATEGORY_LABEL[pick.category]}</span>}

      <div className="card-scrim" aria-hidden />
      <div className="card-body">
        <div className="card-cat mono">{CATEGORY_LABEL[pick.category]}</div>
        <h2 className="card-title">{pick.title}</h2>
        <div className="card-when">
          <span>{pick.when}</span>
          <span className="card-flip-cue"><RotateCw size={11} strokeWidth={2.6} /> Details</span>
        </div>
      </div>
    </article>
  )
}
