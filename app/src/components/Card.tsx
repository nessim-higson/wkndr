import { Plus, Clock } from 'lucide-react'
import type { Pick } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'
import './Card.css'

/** The stack card FRONT — image-led like the fan, but carrying the at-a-glance signals:
 *  scarcity, freshness, outdoor/kids, the category, the title, and the date hero'd.
 *  The full dossier lives on the back (tap to flip). */
export function Card({ pick }: { pick: Pick }) {
  // freshness is worth a chip when it's time-sensitive (new / ending) — the everyday
  // "this weekend" / "always good" stay quiet so the row doesn't get noisy.
  const showFresh = pick.freshness === 'new' || pick.freshness === 'ending'
  const hasTags = pick.status || showFresh || pick.outdoor || pick.kid
  return (
    <article
      className={`card${pick.image ? '' : ` poster poster--${pick.category}`}`}
      style={pick.image ? { backgroundImage: `url(${pick.image})` } : undefined}
    >
      {hasTags && (
        <div className="card-tags">
          {pick.status && <span className={`chip chip-status chip-status--${pick.status}`}>{STATUS_LABEL[pick.status]}</span>}
          {showFresh && <span className={`chip chip-fresh chip-fresh--${pick.freshness}`}>{FRESHNESS_LABEL[pick.freshness]}</span>}
          {pick.outdoor && <span className="chip chip-outdoor">Outdoor</span>}
          {pick.kid && <span className="chip chip-kid">Kids</span>}
        </div>
      )}

      {!pick.image && <span className="poster-mark">{CATEGORY_LABEL[pick.category]}</span>}

      <div className="card-scrim" aria-hidden />
      <div className="card-body">
        <div className="card-cat mono">{CATEGORY_LABEL[pick.category]}</div>
        <h2 className="card-title">{pick.title}</h2>
        <div className="card-when">
          <span className="card-when-stamp"><Clock size={14} strokeWidth={2.6} /> {pick.when}</span>
          <span className="card-flip-cue" aria-hidden><Plus size={15} strokeWidth={2.8} /></span>
        </div>
      </div>
    </article>
  )
}
