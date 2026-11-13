import { CalendarClock, Plus, X } from 'lucide-react'
import type { Pick } from '../types'
import type { SaveEntry } from '../lib/account'
import { cssUrl } from '../lib/image'

/** THE LIBRARY's rows (the Later shelf of V.12.2, now the second of THE TWO PILES) — the saves
 *  panel's second tab. A save for a date after this weekend, or an open run, sorted soonest first.
 *  A row whose card has rotated out of the feed still shows (the snapshot carries its title and
 *  date) and opens the organiser's page instead — it can't be pulled into the plan, so no pill. */
export function LaterRows({
  entries, picks, arrives, onOpen, onMove, onRemove,
}: {
  entries: SaveEntry[]
  picks: Map<string, Pick>
  arrives?: (e: SaveEntry) => string | null   // "Next weekend" on the one that comes round next
  onOpen: (p: Pick) => void
  onMove?: (e: SaveEntry) => void             // + Weekend: into this weekend's plan
  onRemove: (id: string) => void
}) {
  return (
    <>
      {entries.map((e) => {
        const p = picks.get(e.id)
        const soon = arrives?.(e)
        return (
          <div className="sv-row" key={e.id}>
            <button
              className="sv-rowmain"
              onClick={() => { if (p) onOpen(p); else if (e.link) window.open(e.link, '_blank', 'noopener') }}
            >
              <span className="sv-thumb" style={p?.image ? { backgroundImage: cssUrl(p.image) } : undefined}>
                {!p?.image && <CalendarClock size={16} strokeWidth={2} />}
              </span>
              <span className="sv-meta">
                <span className="sv-when">{soon ?? (e.start ? e.when : 'Any week')}</span>
                <span className="sv-name">{e.title}</span>
              </span>
            </button>
            {p && onMove && (
              <button className="sv-pill sv-pill--in" aria-label={`Add ${e.title} to this weekend`} onClick={() => onMove(e)}>
                <Plus size={11} strokeWidth={2.8} /> Weekend
              </button>
            )}
            <button className="sv-remove" aria-label={`Remove ${e.title}`} onClick={() => onRemove(e.id)}>
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        )
      })}
    </>
  )
}

/** DID YOU GO? — a finished save asks once. The answer is the first outcome data WKNDR keeps
 *  (docs/moat.md §6 item 1): richer than a swipe, and only the person who went can give it. */
export function AskWent({ entries, onAnswer }: { entries: SaveEntry[]; onAnswer: (e: SaveEntry, went: boolean) => void }) {
  if (!entries.length) return null
  return (
    <div className="sv-ask">
      <div className="sv-group-label">Did you go?</div>
      {entries.slice(0, 3).map((e) => (
        <div className="sv-ask-row" key={e.id}>
          <span className="sv-meta">
            <span className="sv-name">{e.title}</span>
            <span className="sv-when">{e.when}</span>
          </span>
          <span className="sv-ask-btns">
            <button onClick={() => onAnswer(e, true)}>Went</button>
            <button onClick={() => onAnswer(e, false)}>Didn’t</button>
          </span>
        </div>
      ))}
    </div>
  )
}
