import { Maximize2, Clock } from 'lucide-react'
import type { Pick, Mode } from '../types'
import { CATEGORY_LABEL, cardSignal } from '../types'
import './Card.css'

/** The stack card FRONT — image-led and deliberately quiet: the WHEN stamp (day/time +
 *  forecast temp on outdoor picks), AT MOST one signal pill (cardSignal: live weather peak
 *  > scarcity > new/ending), and the title over the bottom scrim. Everything else — static
 *  weather affinity, kids, trending, category — lives on the detail (tap to expand). */
export function Card({ pick, temp, mode }: { pick: Pick; temp?: number; mode?: Mode }) {
  const sig = cardSignal(pick, mode)
  // THE NO-PHOTO FACE (V.11.9). The pipeline no longer fills a missing photo with a category-bank
  // or stock image — a plausible wrong photo was the one failure a stranger can't spot — so a card
  // without one is now a DESIGNED object, not a placeholder: the weather field as its ground, the
  // house grain, and the title set as the poster's hero line (Clash, the display voice) with the
  // venue beneath it. One idea per face: the event, typographically. No "no photo" apology on the
  // card — the board carries that receipt (imageWhy).
  const nophoto = !pick.image
  return (
    <article
      className={`card${nophoto ? ' card--nophoto' : ''}`}
      style={pick.image ? { backgroundImage: `url(${pick.image})` } : undefined}
    >
      {nophoto && <div className="np-ground" aria-hidden />}
      {pick.image && <div className="card-grade" aria-hidden />}
      {pick.image && <div className="card-tint" aria-hidden />}
      <div className="card-grain" aria-hidden />
      {pick.image && <div className="card-scrim" aria-hidden />}

      {/* TOP — the when stamp, and (only when it earns it) the one signal pill */}
      <div className="card-top">
        <span className="card-when">
          <Clock size={14} strokeWidth={2.6} />
          <span className="card-when-text">{pick.when}</span>
          {pick.outdoor && temp != null && <span className="card-when-temp">{Math.round(temp)}°</span>}
        </span>
        {sig && <span className={`card-signal card-signal--${sig.tone}${sig.glow ? ' card-signal--glow' : ''}`}>{sig.text}</span>}
      </div>

      {/* expand affordance — Maximize2, not a + (a plus read as “add/save” next to the real save) */}
      <span className="card-expand" aria-hidden><Maximize2 size={14} strokeWidth={2.6} /></span>

      {nophoto ? (
        <div className="np-hero">
          <span className="np-cat">{CATEGORY_LABEL[pick.category]}</span>
          <h2 className="np-title display">{pick.title}</h2>
          {(pick.venue || pick.area) && (
            <p className="np-venue">{[pick.venue, pick.area].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      ) : (
        <div className="card-body">
          <h2 className="card-title">{pick.title}</h2>
        </div>
      )}
    </article>
  )
}
