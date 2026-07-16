import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { Mode, Pick } from '../types'
import { MODE_META } from '../weather/modes'
import { shareLink } from '../lib/share'
import { newRoundId, relayOn, rememberSentRound } from '../lib/relay'
import { useDialogA11y } from '../lib/useDialogA11y'
import './ShareSheet.css'

function cover(mode: Mode): string {
  const f = MODE_META[mode].field
  return `radial-gradient(ellipse 90% 70% at 28% 8%, ${f.glow} 0%, transparent 55%), `
    + `linear-gradient(160deg, ${f.c1} 0%, ${f.c2} 58%, ${f.c3} 100%)`
}

/** "My Weekend" — the shareable artifact. Encodes saved picks into a link the
 *  partner can open (no backend). The distribution lever (docs/moat.md §5). */
export function ShareSheet({
  open, onClose, picks, mode, city,
}: {
  open: boolean
  onClose: () => void
  picks: Pick[]
  mode: Mode
  city: string
}) {
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
  const link = shareLink(picks, name, round || undefined)

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      armRound()
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    })
  }
  async function share() {
    const who = name.trim() ? `${name.trim()} shared` : `My`
    const data = { title: 'WKNDR weekend', text: `${who} ${picks.length} ${city} picks`, url: link }
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
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="Share your picks" tabIndex={-1}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
            <div className="share-handle" />
            <button className="share-close" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={2.5} /></button>

            {picks.length === 0 ? (
              <div className="share-empty">
                <h3>Build your weekend first</h3>
                <p>Tap ♥ or ★ on the picks you like, then come back to share them with someone.</p>
                <button className="share-done" onClick={onClose}>Got it</button>
              </div>
            ) : (
              <>
                {/* the artifact */}
                <div className="weekend-card" style={{ background: cover(mode) }}>
                  <div className="wc-grain" />
                  <div className="wc-head">
                    <span className="wc-eyebrow">My weekend · {city}</span>
                    <span className="wc-mode">{MODE_META[mode].label}</span>
                  </div>
                  <ul className="wc-list">
                    {picks.slice(0, 5).map((p) => (
                      <li key={p.id} className="wc-item">
                        <span className={`wc-thumb${p.image ? '' : ` poster poster--${p.category}`}`} style={p.image ? { backgroundImage: `url(${p.image})` } : undefined} />
                        <span className="wc-text">
                          <span className="wc-title">{p.title}</span>
                          <span className="wc-when">{p.when}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {picks.length > 5 && <div className="wc-more">+ {picks.length - 5} more</div>}
                  <div className="wc-foot">WKNDR · weather-ranked for the weekend</div>
                </div>

                <input
                  className="share-name"
                  value={name}
                  onChange={(e) => setNamePersist(e.target.value)}
                  placeholder="Your name (so they know it’s from you)"
                  aria-label="Your name"
                />
                <div className="share-actions">
                  <button className="share-primary" onClick={share}>Share with a friend</button>
                  <button className="share-copy" onClick={copy}>{copied ? '✓ Link copied' : 'Copy link'}</button>
                </div>
                <p className="share-note">
                  They’ll swipe through these to find the plans you <b>both</b> saved{name.trim() ? ` — from “${name.trim()}”` : ''}. No app or account needed.
                </p>
                <p className="share-privacy">
                  Your link contains only your picks{name.trim() ? ' and first name' : ''}.
                  {relayOn() ? ' Matching data expires after about 14 days.' : ''}{' '}
                  <a href="https://wkndr.xyz/privacy" target="_blank" rel="noreferrer">Privacy</a>
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
