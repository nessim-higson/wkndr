import { Plus, Clock } from 'lucide-react'
import type { Pick, Mode } from '../types'
import { CATEGORY_LABEL, cardSignal } from '../types'
import './Card.css'

/** The stack card FRONT — image-led and deliberately quiet: the WHEN stamp (day/time +
 *  forecast temp on outdoor picks), AT MOST one signal pill (cardSignal: live weather peak
 *  > scarcity > new/ending), and the title over the bottom scrim. Everything else — static
 *  weather affinity, kids, trending, category — lives on the detail (tap to expand). */
export function Card({ pick, temp, mode }: { pick: Pick; temp?: number; mode?: Mode }) {
  const sig = cardSignal(pick, mode)
  return (
    <article className={`card${pick.image ? '' : ` poster poster--${pick.category}`}`}>
      {/* BLUR-FILL: the whole photo (contain, never cropped) over a blurred/darkened copy of itself
          (cover) so there are no hard letterbox bars AND no cropped subjects — landscape event
          photos show in full on a tall card. */}
      {pick.image && (
        <>
          <div className="card-img-blur" style={{ backgroundImage: `url(${pick.image})` }} aria-hidden />
          <div className="card-img" style={{ backgroundImage: `url(${pick.image})` }} aria-hidden />
        </>
      )}
      {!pick.image && <span className="poster-mark">{CATEGORY_LABEL[pick.category]}</span>}
      <div className="card-scrim" aria-hidden />

      {/* TOP — the when stamp, and (only when it earns it) the one signal pill */}
      <div className="card-top">
        <span className="card-when">
          <Clock size={14} strokeWidth={2.6} />
          <span className="card-when-text">{pick.when}</span>
          {pick.outdoor && temp != null && <span className="card-when-temp">{Math.round(temp)}°</span>}
        </span>
        {sig && <span className={`card-signal card-signal--${sig.tone}${sig.glow ? ' card-signal--glow' : ''}`}>{sig.text}</span>}
      </div>

      <span className="card-expand" aria-hidden><Plus size={15} strokeWidth={2.8} /></span>

      <div className="card-body">
        <h2 className="card-title">{pick.title}</h2>
      </div>
    </article>
  )
}
