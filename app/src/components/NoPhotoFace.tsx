import type { Pick } from '../types'
import { CATEGORY_LABEL } from '../types'
import { resolveGeo } from '../lib/geo'

export function venueMark(venue: string): string {
  return venue.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase('nl-NL')
}

/** A venue imprint, not invented imagery or a pretend ticket/admission promise. */
export function NoPhotoFace({ pick }: { pick: Pick }) {
  const place = resolveGeo(pick)
  return <div className="np-hero">
    <span className="np-cat">{CATEGORY_LABEL[pick.category]}</span>
    <h2 className="np-title display" lang="nl">{pick.title}</h2>
    <div className="np-imprint" aria-hidden>{venueMark(pick.venue)}</div>
    <div className="np-stub">
      {pick.venue && <p className="np-venue">{pick.venue}</p>}
      <div className="np-facts">
        <span>{place.district ?? pick.area}</span>
        {pick.price && <span>{pick.price}</span>}
      </div>
    </div>
  </div>
}
