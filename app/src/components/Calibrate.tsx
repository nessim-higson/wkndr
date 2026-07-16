import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL } from '../types'
import { SwipeStack } from './SwipeStack'
import { type Taste, applyCalibration, topTastes } from '../taste'
import { useDialogA11y } from '../lib/useDialogA11y'
import './Calibrate.css'

// ─── TUNE WKNDR — the calibration micro-deck (DEV PROTOTYPE, ?dev=1 only) ────────────
// Eight archetype weekends, swiped in the app's own language: ★ = "that's me", ✕ = "not
// me". Each swipe writes a deliberately-heavy taste signal (taste.ts applyCalibration)
// and the real deck re-deals, re-ranked, the moment you're done — all on-device, no
// account, no recompile. The archetypes are written in the ONLY vocabulary the taste
// model reads (tokensFor): category, outdoor, weather affinity. Genre nuance (club vs.
// gig) is invisible to the model, so it isn't asked. area/source stay EMPTY on purpose:
// their tokens are inert, so a calibration can never bias toward a specific venue
// neighbourhood or publication. No image → the card renders as the typographic poster.

const ARCH = (a: Partial<Pick> & { id: string; title: string; category: Pick['category'] }): Pick => ({
  venue: '', area: '', when: '', freshness: 'weekend', outdoor: false, kid: false,
  price: '', blurb: '', why: '', source: '', link: '', weatherFit: [],
  ...a,
} as Pick)

const ARCHETYPES: Pick[] = [
  ARCH({ id: 'cal-live', title: 'A loud night of live music', category: 'live', when: 'Sat · 21:00' }),
  ARCH({ id: 'cal-art', title: 'A slow gallery morning', category: 'art', when: 'Sun · 11:00' }),
  ARCH({ id: 'cal-eat', title: 'Dinner worth booking ahead', category: 'eat', when: 'Sat · 19:30' }),
  ARCH({ id: 'cal-drink', title: 'A bar you’d text a friend about', category: 'drink', when: 'Fri · 18:00' }),
  ARCH({ id: 'cal-market', title: 'A market crawl, hands full', category: 'market', when: 'Sat · 10:00', outdoor: true }),
  ARCH({ id: 'cal-out', title: 'Sun’s out — be outside', category: 'out', when: 'Sat · 14:00', outdoor: true, weatherFit: ['HOT', 'WARM'] }),
  ARCH({ id: 'cal-daytrip', title: 'A train out of town', category: 'daytrip', when: 'Sun · 09:30', outdoor: true }),
  ARCH({ id: 'cal-shop', title: 'Record bins & concept stores', category: 'shop', when: 'Sat · 15:00' }),
]

export function Calibrate({ taste, onClose, onDone }: {
  taste: Taste
  onClose: () => void                          // dismiss = discard (nothing committed)
  onDone: (next: Taste, likes: number) => void // commit the accumulated profile + re-deal
}) {
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose)
  const [idx, setIdx] = useState(0)
  const [acc, setAcc] = useState<Taste>(taste)
  const [likes, setLikes] = useState(0)
  const remaining = useMemo(() => ARCHETYPES.slice(idx), [idx])
  const done = idx >= ARCHETYPES.length
  // what the profile now leans toward — the interpretable model, read back to the user.
  // Raw tokens prettified: category keys → their labels, weather modes → plain words.
  const leanings = useMemo(() => {
    if (!done) return []
    const nice: Record<string, string> = { ...CATEGORY_LABEL, HOT: 'sunny weather', WARM: 'warm weather', outdoor: 'being outdoors' }
    return topTastes(acc, 3).map((l) => (nice[l] ?? l).toLowerCase())
  }, [done, acc])

  // belt-and-braces against any double-fire: each archetype writes exactly once
  const seen = useMemo(() => new Set<string>(), [])
  function onSwipe(p: Pick, dir: SwipeDir) {
    if (seen.has(p.id)) return
    seen.add(p.id)
    const liked = dir === 'save' || dir === 'like'
    setAcc((t) => applyCalibration(t, p, liked))
    if (liked) setLikes((n) => n + 1)
    setIdx((i) => i + 1)
  }

  return (
    <div className="cal-veil" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Tune WKNDR" tabIndex={-1}>
      <button className="cal-close" onClick={onClose} aria-label="Close without saving">
        <X size={18} strokeWidth={2.5} />
      </button>

      <div className="cal-head">
        <span className="cal-eyebrow">Tune WKNDR · dev prototype</span>
        <h2 className="cal-h">{done ? 'Tuned.' : 'What sounds like you?'}</h2>
        {!done && (
          <p className="cal-sub">
            ★ the weekends you’d actually have, ✕ the ones you wouldn’t.
            The deck re-ranks on your device — nothing leaves it.
          </p>
        )}
      </div>

      {done ? (
        <div className="cal-done">
          {leanings.length > 0 && (
            <p className="cal-lean">Leaning into <b>{leanings.join(' · ')}</b>.</p>
          )}
          <button className="cal-deal" onClick={() => onDone(acc, likes)}>Deal my deck</button>
          <button className="cal-skip" onClick={onClose}>Discard</button>
        </div>
      ) : (
        <>
          <div className="cal-stage">
            <SwipeStack picks={remaining} onSwipe={onSwipe} keysActive />
          </div>
          <div className="cal-count" aria-live="polite">{Math.min(idx + 1, ARCHETYPES.length)} of {ARCHETYPES.length}</div>
        </>
      )}
    </div>
  )
}
