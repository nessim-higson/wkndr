import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Mode, Pick } from '../types'
import { MODE_META } from '../weather/modes'
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
  const [name, setName] = useState(() => localStorage.getItem('wkndr.name') || '')
  function setNamePersist(v: string) {
    const clean = v.slice(0, 24)
    setName(clean)
    localStorage.setItem('wkndr.name', clean)
  }
  // …?w=ids&from=Name → the recipient lands on the Stack greeted "<name> shared some picks"
  const link = `${location.origin}${location.pathname}?w=${picks.map((p) => p.id).join(',')}`
    + (name.trim() ? `&from=${encodeURIComponent(name.trim())}` : '')

  function copy() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    })
  }
  async function share() {
    const who = name.trim() ? `${name.trim()} shared` : `My`
    const data = { title: 'WKNDR weekend', text: `${who} ${picks.length} ${city} picks`, url: link }
    try { if (navigator.share) { await navigator.share(data); return } } catch { /* fall through */ }
    copy()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="share-backdrop" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div className="share" onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
            <div className="share-handle" />

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
                  They’ll swipe through these to find the ones you <b>both</b> want — your matches{name.trim() ? `, from “${name.trim()}”` : ''}. No app or account needed.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
