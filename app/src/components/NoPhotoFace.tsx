import type { Pick } from '../types'
import { CATEGORY_LABEL } from '../types'
import { titleMark } from '../lib/card-material'
import { resolveGeo } from '../lib/geo'

export function venueMark(venue: string): string {
  return venue.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase('nl-NL')
}

/** Pressed title typography, not invented imagery or an admission promise. */
export function NoPhotoFace({ pick }: { pick: Pick }) {
  const place = resolveGeo(pick)
  const mark = titleMark(pick.title)
  return <div className="np-hero" data-title-length={pick.title.length <= 24 ? 'short' : 'long'}>
    <span className="np-cat">{CATEGORY_LABEL[pick.category]}</span>
    <h2 className="np-title display" lang="nl">{pick.title}</h2>
    <div className="np-imprint" aria-hidden>
      <svg viewBox="0 0 180 120" focusable="false" className={mark === '&' ? 'np-imprint-amp' : undefined}>
        <text x="90" y="92" textAnchor="middle">{mark}</text>
      </svg>
    </div>
    <div className="np-stub">
      {pick.venue && <p className="np-venue">{pick.venue}</p>}
      <div className="np-facts">
        <span>{place.district ?? pick.area}</span>
        {pick.price && <span>{pick.price}</span>}
      </div>
    </div>
  </div>
}
