import { useState } from 'react'
import { Star, ArrowUpRight, Check, Sparkles, RotateCcw } from 'lucide-react'
import type { Pick } from '../types'
import { CATEGORY_LABEL, FRESHNESS_LABEL, STATUS_LABEL } from '../types'

// Categories where a "listen" link makes sense — gigs are about an artist.
const MUSIC = new Set<Pick['category']>(['live'])

/** The BACK of a stack card — the rich dossier you flip to. Keeps the photo up top
 *  (with the tags over it) and lays out everything else below: blurb, the hook, the
 *  facts (when / where / price / weather / buzz), and — for gigs — a Spotify / Apple
 *  Music "listen first" link so you can sample before you commit. */
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
  const weather = pick.outdoor ? 'Best in dry, mild weather' : 'Indoor — any weather'

  async function share() {
    const url = `${location.origin}${location.pathname}?w=${pick.id}`
    const data = { title: pick.title, text: `${pick.title} — ${pick.venue}, ${pick.area}`, url }
    try { if (navigator.share) { await navigator.share(data); return } } catch { /* fall through */ }
    try { await navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* no-op */ }
  }

  // stop taps inside the back from bubbling up to the card's tap/drag handlers
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation()

  return (
    <div className={`card-back cb--${pick.category}`} onPointerDown={stop}>
      {/* image header — the photo carries over to the back, tags + flip-back over it */}
      <div
        className={`cb-media${pick.image ? '' : ` poster poster--${pick.category}`}`}
        style={pick.image ? { backgroundImage: `url(${pick.image})` } : undefined}
      >
        {!pick.image && <span className="poster-mark">{CATEGORY_LABEL[pick.category]}</span>}
        <div className="cb-media-scrim" aria-hidden />
        <button className="cb-flip" onClick={onFlipBack} onPointerDown={stop} aria-label="Flip card back">
          <RotateCcw size={16} strokeWidth={2.4} />
        </button>
        <div className="cb-media-tags">
          {pick.status && <span className={`chip chip-status chip-status--${pick.status}`}>{STATUS_LABEL[pick.status]}</span>}
          <span className={`chip chip-fresh chip-fresh--${pick.freshness}`}>{FRESHNESS_LABEL[pick.freshness]}</span>
          <span className="chip chip-cat">{CATEGORY_LABEL[pick.category]}</span>
          {pick.outdoor && <span className="chip chip-outdoor">Outdoor</span>}
          {pick.kid && <span className="chip chip-kid">Kids</span>}
        </div>
      </div>

      <div className="cb-scroll">
        <h2 className="cb-title">{pick.title}</h2>

        {/* the facts — the scannable "more information", up high so it's seen first */}
        <dl className="cb-facts">
          <div className="cb-fact">
            <dt>When</dt>
            <dd>{pick.when}{pick.verify && <span className="cb-verify">verify</span>}</dd>
          </div>
          {(pick.venue || pick.area) && (
            <div className="cb-fact">
              <dt>Where</dt>
              <dd>{[pick.venue, pick.area].filter(Boolean).join(' · ')}</dd>
            </div>
          )}
          {pick.price && (
            <div className="cb-fact"><dt>Price</dt><dd>{pick.price}</dd></div>
          )}
          <div className="cb-fact"><dt>Weather</dt><dd>{weather}</dd></div>
          {(pick.buzz ?? 0) > 1 && (
            <div className="cb-fact"><dt>Buzz</dt><dd>Flagged by {pick.buzz} sources this week</dd></div>
          )}
        </dl>

        {/* gigs: sample the act before you commit — kept high, above the prose */}
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

        {pick.blurb && <p className="cb-blurb">{pick.blurb}</p>}
        {pick.why && <div className="cb-why"><Sparkles className="why-mark" size={13} /> {pick.why}</div>}
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
