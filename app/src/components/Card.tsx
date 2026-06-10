import { Plus, Clock, TrendingUp } from 'lucide-react'
import type { Pick, Mode } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL, weatherPill } from '../types'
import './Card.css'

/** The stack card FRONT — image-led. The WHEN stamp (day/time + forecast temp on
 *  outdoor picks) is pinned to the TOP as a ticket stamp, with the at-a-glance tags
 *  (scarcity, freshness, trending, outdoor/kids) beneath it; the category + title sit
 *  over the bottom scrim. The full detail expands on tap. */
export function Card({ pick, temp, mode }: { pick: Pick; temp?: number; mode?: Mode }) {
  // freshness is worth a chip when it's time-sensitive (new / ending) — the everyday
  // "this weekend" / "always good" stay quiet so the row doesn't get noisy.
  const showFresh = pick.freshness === 'new' || pick.freshness === 'ending'
  const trending = (pick.buzz ?? 0) >= 2          // flagged by 2+ independent sources
  const wx = weatherPill(pick, mode)              // the weather-affinity pill (outdoor chip folds into this)
  const hasTags = pick.status || showFresh || trending || pick.kid
  return (
    <article
      className={`card${pick.image ? '' : ` poster poster--${pick.category}`}`}
      style={pick.image ? { backgroundImage: `url(${pick.image})` } : undefined}
    >
      {!pick.image && <span className="poster-mark">{CATEGORY_LABEL[pick.category]}</span>}
      <div className="card-scrim" aria-hidden />

      {/* TOP — weather-affinity pill leads (top-left, like the landing), then the when stamp + tags */}
      <div className="card-top">
        <span className={`card-weather${wx.perfect ? ' card-weather--perfect' : ''}`}>{wx.text}</span>
        <span className="card-when">
          <Clock size={14} strokeWidth={2.6} />
          <span className="card-when-text">{pick.when}</span>
          {pick.outdoor && temp != null && <span className="card-when-temp">{Math.round(temp)}°</span>}
        </span>
        {hasTags && (
          <div className="card-tags">
            {pick.status && <span className={`chip chip-status chip-status--${pick.status}`}>{STATUS_LABEL[pick.status]}</span>}
            {showFresh && <span className={`chip chip-fresh chip-fresh--${pick.freshness}`}>{FRESHNESS_LABEL[pick.freshness]}</span>}
            {trending && <span className="chip chip-buzz"><TrendingUp size={11} strokeWidth={2.6} /> Trending</span>}
            {pick.kid && <span className="chip chip-kid">Kids</span>}
          </div>
        )}
      </div>

      <span className="card-expand" aria-hidden><Plus size={15} strokeWidth={2.8} /></span>

      <div className="card-body">
        <h2 className="card-title">{pick.title}</h2>
      </div>
    </article>
  )
}
