import { useEffect, useMemo, useRef } from 'react'
import type { Pick, Mode } from '../types'
import { weatherPill } from '../types'
import './Coverflow.css'

/** MOBILE browse — a horizontal 3D coverflow. The centred card stands upright + bright; cards to
 *  either side rotate away in perspective and dim. Scroll-snaps to a card; tap to open its detail.
 *  Width-bounded by design (we position each card directly), so nothing ever crops. Per-frame work
 *  is transform + a composited dim-overlay opacity only — no paint — so the scroll stays smooth. */
export function Coverflow({ picks, onOpen, mode }: { picks: Pick[]; onOpen?: (p: Pick) => void; mode?: Mode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const cards = useMemo(() => picks.slice(0, 18), [picks])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const items = [...track.querySelectorAll<HTMLElement>('.cf-card')].map((el) => ({
      el,
      dim: el.querySelector<HTMLElement>('.cf-dim'),
    }))
    let raf = 0
    const render = () => {
      raf = 0
      const mid = track.scrollLeft + track.clientWidth / 2
      for (const { el, dim } of items) {
        const cc = el.offsetLeft + el.clientWidth / 2
        const d = (cc - mid) / el.clientWidth          // signed distance from centre, in card-widths
        const ad = Math.min(Math.abs(d), 2.2)
        const rot = Math.max(-48, Math.min(48, -d * 40))
        el.style.transform = `translateX(${-d * 14}px) rotateY(${rot}deg) scale(${1 - ad * 0.14})`
        if (dim) dim.style.opacity = Math.min(0.6, ad * 0.42).toFixed(3)
        el.style.zIndex = String(100 - (ad * 10 | 0))
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(render) }
    track.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    requestAnimationFrame(render)   // initial layout (first card sits centred at scroll 0)
    return () => {
      track.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [cards])

  return (
    <div className="cf-stage">
      <div className="cf-track" ref={trackRef}>
        {cards.map((p) => (
          <button className="cf-card" key={p.id} onClick={() => onOpen?.(p)}>
            <span
              className={`cf-face${p.image ? '' : ` poster poster--${p.category}`}`}
              style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
            >
              <span className="cf-shade" aria-hidden />
              <span className="cf-dim" aria-hidden />
              <span className="cf-info">
                {(() => { const w = weatherPill(p, mode); return (
                  <span className={`cf-cat mono${w.perfect ? ' cf-cat--perfect' : ''}`}>{w.text}</span>
                ) })()}
                <span className="cf-title">{p.title}</span>
                <span className="cf-when mono">{p.when}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      {cards.length === 0 && <p className="cf-empty mono">No picks for this view yet.</p>}
    </div>
  )
}
