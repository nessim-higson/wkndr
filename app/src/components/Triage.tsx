import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Pick, SwipeDir } from '../types'
import { SwipeStack } from './SwipeStack'
import { useDialogA11y } from '../lib/useDialogA11y'
import './Triage.css'

// ─── TRIAGE — the Curation Board's notebook (DEV PROTOTYPE, ?dev=1 only) ─────────────
// The board (public/curate/) is a *studio* instrument: a 1180px grid built to COMPARE —
// pile order, ▲LEAD/▼LATER, tiers, the canon library. On a phone that same page is 203
// screens of scroll, and no amount of CSS fixes that, because comparing-many and
// deciding-one are different jobs. This is the other job: the airlock queue, one card at
// a time, ★ / ✕, on the tram. Same verdicts, same store, different moment.
// See docs/curation-surfaces.md §3.
//
// WHY THIS IS SAFE — it cannot ship anything. The airlock runs
//   verdict → GitHub issue → HUMAN COMPILE into the taste corpus → restamp → live deck
// and approvalCheck (scripts/lib/pipeline.ts) reads the COMPILED corpus, never raw
// verdicts. Three gates downstream of this screen. Triage files a proposal, nothing more.
//
// WHY NO PAYLOAD CODE HERE — we deliberately do NOT re-implement the board's
// payload()/payloadCompact() text format. Two implementations of one wire format is a
// drift bug waiting to happen. Instead we write the board's OWN localStorage record and
// let the board's own Submit button read it. /curate/ is same-origin with the app, so
// this just works: triage on the phone → open /curate/ on that phone → Submit → GitHub.
// (localStorage is per-device: triage and submit on the SAME device.)
//
// THE STORE CONTRACT (mirror of public/curate/index.html — change both together):
//   key:   'wkndr.curate.' + <feed generatedAt>   ← scoped per run, so verdicts never leak
//   value: { V: { [pickId]: {t,stars,killed,top,lead,later,canon,img,note,betterImage} }, PILE }
const KEY_PREFIX = 'wkndr.curate.'

// A right-swipe writes stars:3 — the lowest rating approvalCheck honours as a star anchor
// (`starAnchors.filter(a => a.stars >= 3)`). Below 3 the verdict would compile to nothing,
// so a "yes" on the tram has to clear that bar or it silently isn't a yes.
const TRIAGE_STARS = 3

type Verdict = { t: string; stars?: number; killed?: boolean; [k: string]: unknown }
type Store = { V: Record<string, Verdict>; PILE: unknown }

function readStore(key: string): Store {
  try {
    const s = JSON.parse(localStorage.getItem(key) || '{}')
    return { V: s.V || {}, PILE: s.PILE ?? null }
  } catch { return { V: {}, PILE: null } }
}

// Read-modify-write: the board may already hold verdicts + a hand-set PILE for this run.
// Merge into the existing record for this id; never clobber the pile or a sibling verdict.
function writeVerdict(key: string, id: string, v: Verdict) {
  try {
    const s = readStore(key)
    s.V[id] = { ...s.V[id], ...v }
    localStorage.setItem(key, JSON.stringify({ V: s.V, PILE: s.PILE }))
  } catch { /* private mode / quota — the swipe still advances, it just won't persist */ }
}

export function Triage({ cityKey, onClose }: {
  cityKey: string
  onClose: () => void
}) {
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose)
  const [queue, setQueue] = useState<Pick[] | null>(null)
  const [feedKey, setFeedKey] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [starred, setStarred] = useState(0)
  const [killed, setKilled] = useState(0)

  // The airlock queue, in the order the pipeline stamped it — weekend-topical first
  // (dated-this-weekend → forecast-mode fit → judge). Do NOT re-sort: that order IS the
  // priority, and it's the same order the board's NEW FINDS tab shows.
  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}data/pending.${cityKey}.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!live) return
        const key = KEY_PREFIX + (d.generatedAt || 'x')
        const already = readStore(key).V
        // Skip anything already ruled on — in this deck or over on the board.
        setQueue((d.pending || []).filter((p: Pick) => !already[p.id]))
        setFeedKey(key)
      })
      .catch((e) => live && setErr(String(e.message || e)))
    return () => { live = false }
  }, [cityKey])

  const remaining = useMemo(() => (queue ? queue.slice(idx) : []), [queue, idx])
  const done = !!queue && idx >= queue.length
  const ruled = starred + killed

  // belt-and-braces against a double-fire mid-exit (mirrors Calibrate + the SwipeStack
  // flying-guard): each card writes exactly once.
  const seen = useMemo(() => new Set<string>(), [])
  function onSwipe(p: Pick, dir: SwipeDir) {
    if (seen.has(p.id) || !feedKey) return
    seen.add(p.id)
    const waved = dir === 'save' || dir === 'like'
    writeVerdict(feedKey, p.id, waved ? { t: p.title, stars: TRIAGE_STARS } : { t: p.title, killed: true })
    if (waved) setStarred((n) => n + 1); else setKilled((n) => n + 1)
    setIdx((i) => i + 1)
  }

  const boardHref = `${import.meta.env.BASE_URL}curate/`

  return (
    <div className="tri-veil" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Triage the airlock" tabIndex={-1}>
      <button className="tri-close" onClick={onClose} aria-label="Close triage">
        <X size={18} strokeWidth={2.5} />
      </button>

      <div className="tri-head">
        <span className="tri-eyebrow">Triage · airlock · dev prototype</span>
        <h2 className="tri-h">
          {err ? 'No queue.' : queue === null ? 'Loading the airlock…' : done ? 'Queue clear.' : 'Ship it?'}
        </h2>
        {!done && !err && queue !== null && (
          <p className="tri-sub">
            ★ waves it into the deck, ✕ kills it. Verdicts land in the board —
            open it to file the round.
          </p>
        )}
      </div>

      {err ? (
        <p className="tri-empty">Couldn’t load <code>pending.{cityKey}.json</code> — {err}</p>
      ) : queue === null ? (
        <p className="tri-empty">…</p>
      ) : done ? (
        <div className="tri-done">
          <p className="tri-tally">
            {ruled === 0 ? 'Nothing left to rule on.' : <><b>{starred}</b> waved in · <b>{killed}</b> killed</>}
          </p>
          {ruled > 0 && (
            <p className="tri-next">
              Saved to this device’s board. Open it and hit <b>Submit → GitHub</b> to file the round.
            </p>
          )}
          <a className="tri-board" href={boardHref} target="_blank" rel="noreferrer">Open the board</a>
          <button className="tri-skip" onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          <div className="tri-stage">
            <SwipeStack picks={remaining} onSwipe={onSwipe} keysActive />
          </div>
          <div className="tri-count" aria-live="polite">
            {idx + 1} of {queue.length}
            {ruled > 0 && <span className="tri-run"> · {starred}★ {killed}✕</span>}
          </div>
        </>
      )}
    </div>
  )
}
