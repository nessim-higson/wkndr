import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CalendarClock, Plus, X } from 'lucide-react'
import type { Pick } from '../types'
import type { SaveEntry } from '../lib/account'
import type { Pile } from '../lib/plan'
import { shareLink } from '../lib/share'
import { newRoundId, relayOn, rememberSentRound } from '../lib/relay'
import { useDialogA11y } from '../lib/useDialogA11y'
import './ShareSheet.css'
import { cssUrl } from '../lib/image'

/** "My Weekend" — the shareable artifact, now composed from TWO PILES (proto/two-piles). THIS
 *  WEEKEND is the plan and the only thing a share sends; the LIBRARY (later dates, open runs, the
 *  evergreens) stays home. The two pills move a save across for this weekend. Encodes the plan
 *  into a link the partner can open (no backend). The distribution lever (docs/moat.md §5). */
export function ShareSheet({
  open, onClose, weekend, library, entries, pickById, arrives, onMove, city,
}: {
  open: boolean
  onClose: () => void
  weekend: Pick[]                                 // this weekend's pile, in itinerary order
  library: SaveEntry[]                            // the other pile, soonest first
  entries: Map<string, SaveEntry>                 // the save behind each weekend pick (for its pill)
  pickById: Map<string, Pick>                     // a library save whose card is still in the feed
  arrives: (e: SaveEntry) => string | null        // "Next weekend" on a library row that comes round next
  onMove: (e: SaveEntry, to: Pile) => void
  city: string
}) {
  const [tab, setTab] = useState<Pile>('weekend')
  const [copied, setCopied] = useState(false)
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose)
  const [name, setName] = useState(() => localStorage.getItem('wkndr.name') || '')
  function setNamePersist(v: string) {
    const clean = v.slice(0, 24)
    setName(clean)
    localStorage.setItem('wkndr.name', clean)
  }
  // each OPEN mints a fresh relay round id (`&r=` on the link) — the key the recipient's
  // matches will POST back under. It only becomes a pending round (polled for its return)
  // once the link actually LEAVES: copy or share resolved, not merely the sheet opened.
  // With the relay off (lib/relay RELAY_URL empty) the link is byte-identical to before.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const round = useMemo(() => (relayOn() ? newRoundId() : ''), [open])
  const armRound = () => { if (round) rememberSentRound(round) }
  // …?w=codes&from=Name → the recipient lands greeted "<name> shared some picks".
  // Short stable codes (lib/share.ts), not raw ids — ~90 chars for 10 picks, not 400+.
  const link = shareLink(weekend, name, round || undefined)
  const n = weekend.length
  const total = n + library.length

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      armRound()
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    })
  }
  async function share() {
    const who = name.trim() ? `${name.trim()} shared` : `My`
    const data = { title: 'WKNDR weekend', text: `${who} ${n} ${city} picks for this weekend`, url: link }
    if (navigator.share) {
      // cancelling the native sheet rejects with AbortError — that's a decision, not a
      // failure. Only a real failure falls through to copy(); a cancel must not
      // overwrite the clipboard (or flash "copied" for something they didn't ask for).
      try { await navigator.share(data); armRound(); return }
      catch (e) { if ((e as DOMException)?.name === 'AbortError') return }
    }
    copy()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="share-backdrop" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div className="share" onClick={(e) => e.stopPropagation()}
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="Share your weekend" tabIndex={-1}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
            <div className="share-handle" />
            <button className="share-close" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={2.5} /></button>

            {total === 0 ? (
              <div className="share-empty">
                <h3>Build your weekend first</h3>
                <p>Tap ♥ or ★ on the picks you like, then come back to share them with someone.</p>
                <button className="share-done" onClick={onClose}>Got it</button>
              </div>
            ) : (
              <>
                <div className="share-head">
                  <h3>{tab === 'weekend' ? 'This weekend' : 'Library'}</h3>
                  <p>{tab === 'weekend'
                    ? (n ? `The plan. This is what goes out${name.trim() ? ` from ${name.trim()}` : ''}.` : 'Nothing in the plan yet — pull something over from the Library.')
                    : 'Later dates, open runs, the evergreens. Nothing here goes out until you pull it in.'}</p>
                </div>

                {/* THE TWO PILES — one segmented control, the same one the saves panel uses */}
                <div className="share-tabs" role="tablist">
                  <button role="tab" aria-selected={tab === 'weekend'} className={tab === 'weekend' ? 'on' : ''} onClick={() => setTab('weekend')}>This weekend · {n}</button>
                  <button role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}><CalendarClock size={12} strokeWidth={2.4} /> Library · {library.length}</button>
                </div>

                <div className="share-rows" role="list">
                  {tab === 'weekend' ? weekend.map((p) => {
                    const e = entries.get(p.id)
                    return (
                      <div className="share-row" role="listitem" key={p.id}>
                        <span className={`share-thumb${p.image ? '' : ` poster poster--${p.category}`}`} style={p.image ? { backgroundImage: cssUrl(p.image) } : undefined} />
                        <span className="share-meta">
                          <span className="share-title">{p.title}</span>
                          <span className="share-when">{p.when}</span>
                        </span>
                        {e && (
                          <button className="share-pill" onClick={() => onMove(e, 'library')} aria-label={`Move ${p.title} to the Library`}>
                            <ArrowRight size={12} strokeWidth={2.6} /> Library
                          </button>
                        )}
                      </div>
                    )
                  }) : library.map((e) => {
                    const p = pickById.get(e.id)
                    const soon = arrives(e)
                    return (
                      <div className="share-row" role="listitem" key={e.id}>
                        <span className="share-thumb" style={p?.image ? { backgroundImage: cssUrl(p.image) } : undefined}>
                          {!p?.image && <CalendarClock size={16} strokeWidth={2} />}
                        </span>
                        <span className="share-meta">
                          <span className="share-title">{e.title}</span>
                          <span className="share-when">{soon ? <b>{soon}</b> : e.start ? e.when : 'Any week'}</span>
                        </span>
                        {/* a save whose card has rotated out of the feed can't be shared — it stays a library row */}
                        {p && (
                          <button className="share-pill share-pill--in" onClick={() => onMove(e, 'weekend')} aria-label={`Add ${e.title} to this weekend`}>
                            <Plus size={12} strokeWidth={2.8} /> Weekend
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {tab === 'library' && library.length === 0 && (
                    <div className="share-rows-empty">Everything you've saved is in this weekend's plan.</div>
                  )}
                </div>

                {tab === 'weekend' ? (
                  <>
                    <input
                      className="share-name"
                      value={name}
                      onChange={(e) => setNamePersist(e.target.value)}
                      placeholder="Your name (so they know it’s from you)"
                      aria-label="Your name"
                    />
                    <div className="share-actions">
                      <button className="share-primary" onClick={share} disabled={n === 0}>Share this weekend · {n}</button>
                      <button className="share-copy" onClick={copy} disabled={n === 0}>{copied ? '✓ Link copied' : 'Copy link'}</button>
                    </div>
                    <p className="share-note">
                      They’ll swipe through these {n === 1 ? 'to see if it’s a yes' : <>to find the plans you <b>both</b> saved</>}{name.trim() ? ` — from “${name.trim()}”` : ''}. No app or account needed.
                    </p>
                    <p className="share-privacy">
                      Your link contains only this weekend’s picks{name.trim() ? ' and first name' : ''}.
                      {relayOn() ? ' Matching data expires after about 14 days.' : ''}{' '}
                      <a href="https://wkndr.xyz/privacy" target="_blank" rel="noreferrer">Privacy</a>
                    </p>
                  </>
                ) : (
                  <p className="share-note">
                    <b>+ Weekend</b> puts a pick in this weekend’s plan. Next week it goes back to where its date puts it.
                  </p>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
