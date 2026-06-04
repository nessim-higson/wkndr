import { useState } from 'react'
import { Star, ArrowUpRight, Check, Sparkles, RotateCcw } from 'lucide-react'
import type { Pick } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'

// Categories where a "listen" link makes sense — gigs are about an artist.
const MUSIC = new Set<Pick['category']>(['live'])

/** The BACK of a stack card — the rich dossier you flip to. Front is the poster;
 *  this is everything else: full blurb, the hook, save/share/open, and (for gigs)
 *  a Spotify / Apple Music "listen first" link so you can sample before you commit. */
export function CardBack({
  pick, saved, onToggleSave, onFlipBack,
}: {
  pick: Pick
  saved: boolean
  onToggleSave: (p: Pick) => void
  onFlipBack: () => void
}) {
  const [copied, setCopied] = useState(false)
  const isMusic = MUSIC.has(pick.category)
  // search the act by name — no IDs to maintain, always resolves to the artist page
  const q = encodeURIComponent(pick.title)

  async function share() {
    const url = `${location.origin}${location.pathname}?w=${pick.id}`
    const data = { title: pick.title, text: `${pick.title} — ${pick.venue}, ${pick.area}`, url }
    try { if (navigator.share) { await navigator.share(data); return } } catch { /* fall through */ }
    try { await navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* no-op */ }
  }

  // stop taps inside the back from bubbling up to the card (which would do nothing here,
  // but keeps drag/tap handlers on the slot clean)
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation()

  return (
    <div className={`card-back cb--${pick.category}`} onPointerDown={stop}>
      <span className="cb-rail" aria-hidden />
      <button className="cb-flip" onClick={onFlipBack} onPointerDown={stop} aria-label="Flip card back">
        <RotateCcw size={16} strokeWidth={2.4} />
      </button>

      <div className="cb-scroll">
        <div className="cb-chips">
          {pick.status && <span className={`chip chip-status chip-status--${pick.status}`}>{STATUS_LABEL[pick.status]}</span>}
          <span className={`chip chip-fresh chip-fresh--${pick.freshness}`}>{FRESHNESS_LABEL[pick.freshness]}</span>
          {pick.outdoor && <span className="chip chip-outdoor">Outdoor</span>}
          {pick.kid && <span className="chip chip-kid">Kids</span>}
        </div>

        <div className="cb-cat mono">{CATEGORY_LABEL[pick.category]}</div>
        <h2 className="cb-title">{pick.title}</h2>
        <div className="cb-meta">
          {[pick.venue, pick.area, pick.price].filter(Boolean).join(' · ')}
        </div>
        <div className="cb-when">
          {pick.when}{pick.verify && <span className="cb-verify">verify</span>}
        </div>

        {pick.blurb && <p className="cb-blurb">{pick.blurb}</p>}
        {pick.why && <div className="cb-why"><Sparkles className="why-mark" size={13} /> {pick.why}</div>}

        {isMusic && (
          <div className="cb-listen">
            <span className="cb-listen-label">Listen first</span>
            <div className="cb-streams">
              <a className="cb-stream cb-stream--spotify" href={`https://open.spotify.com/search/${q}`} target="_blank" rel="noreferrer" onPointerDown={stop}>
                Spotify <ArrowUpRight size={13} strokeWidth={2.4} />
              </a>
              <a className="cb-stream cb-stream--apple" href={`https://music.apple.com/search?term=${q}`} target="_blank" rel="noreferrer" onPointerDown={stop}>
                Apple Music <ArrowUpRight size={13} strokeWidth={2.4} />
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="cb-foot">
        <div className="cb-actions">
          <button className={`cb-icon${saved ? ' on' : ''}`} onClick={() => onToggleSave(pick)} onPointerDown={stop} aria-label={saved ? 'Saved' : 'Save'}>
            <Star size={18} strokeWidth={2.2} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button className="cb-icon" onClick={share} onPointerDown={stop} aria-label="Share this pick">
            {copied ? <Check size={18} strokeWidth={2.4} /> : <ArrowUpRight size={18} strokeWidth={2.2} />}
          </button>
          <a className="cb-open" href={pick.link} target="_blank" rel="noreferrer" onPointerDown={stop}>
            Open at {pick.source} <ArrowUpRight size={14} strokeWidth={2.3} style={{ verticalAlign: '-2px' }} />
          </a>
        </div>
        <div className="cb-trace">↳ surfaced from <b>{pick.source}</b></div>
      </div>
    </div>
  )
}
