import { useMemo } from 'react'
import { Star, CalendarPlus } from 'lucide-react'
import type { Pick, SwipeDir } from '../types'
import { CATEGORY_LABEL } from '../types'
import { parseWhen, buildICS, downloadICS } from '../weekend'
import './Itinerary.css'

/** Your saved picks, laid out as a day-by-day plan (Fri/Sat/Sun + an "Anytime" bucket for
 *  ongoing/multi-day things) so you can read your weekend at a glance — times, order, what's
 *  where. Replaces the motion list when you're looking at your saves specifically. */
export function Itinerary({
  picks, onOpen, onSwipe, sharedName,
}: {
  picks: Pick[]
  onOpen?: (p: Pick) => void
  onSwipe: (p: Pick, dir: SwipeDir) => void   // 'skip' removes from saved
  sharedName?: string | null
}) {
  const year = useMemo(() => new Date().getFullYear(), [])

  const { groups, datedCount } = useMemo(() => {
    const items = picks.map((p) => ({ pick: p, info: parseWhen(p.when, year) }))
    const map = new Map<string, { label: string; sortDay: number; rows: typeof items }>()
    for (const it of items) {
      const g = map.get(it.info.groupKey) ?? { label: it.info.groupLabel, sortDay: it.info.sortDay, rows: [] }
      g.rows.push(it)
      map.set(it.info.groupKey, g)
    }
    const arr = [...map.values()].sort((a, b) => a.sortDay - b.sortDay)
    arr.forEach((g) => g.rows.sort((a, b) => a.info.minutes - b.info.minutes))
    return { groups: arr, datedCount: items.filter((x) => x.info.date).length }
  }, [picks, year])

  function addAllToCalendar() {
    const items = picks.map((p) => ({ pick: p, info: parseWhen(p.when, year) })).filter((x) => x.info.date)
    if (!items.length) return
    downloadICS('my-wknd.ics', buildICS(items))
  }

  if (picks.length === 0) {
    return (
      <div className="itin-empty">
        <Star size={26} strokeWidth={1.7} />
        <b>Nothing saved yet</b>
        <span>Swipe right on the Stack, or tap ★ on a card, and your weekend builds itself here.</span>
      </div>
    )
  }

  return (
    <div className="itin">
      <div className="itin-sheet">
        <div className="itin-head">
          <div className="itin-head-txt">
            <h2 className="itin-title">{sharedName ? `${sharedName}'s weekend` : 'Your weekend'}</h2>
            <span className="itin-sub">{picks.length} saved{datedCount < picks.length ? ` · ${datedCount} dated` : ''}</span>
          </div>
          {datedCount > 0 && (
            <button className="itin-cal" onClick={addAllToCalendar}>
              <CalendarPlus size={15} strokeWidth={2.2} /> Add to calendar
            </button>
          )}
        </div>

        {groups.map((g) => (
          <section className="itin-day" key={g.label}>
            <div className="itin-day-l">{g.label}</div>
            {g.rows.map(({ pick: p, info }) => (
              <article className="itin-row" key={p.id} onClick={() => onOpen?.(p)}>
                <span className="itin-time">{info.time ?? '—'}</span>
                <span
                  className={`itin-thumb${p.image ? '' : ` poster poster--${p.category}`}`}
                  style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}
                />
                <div className="itin-info">
                  <h4 className="itin-name">{p.title}</h4>
                  <p className="itin-ven">{p.venue} · {p.area} · {CATEGORY_LABEL[p.category]}</p>
                </div>
                <button
                  className="itin-save"
                  onClick={(e) => { e.stopPropagation(); onSwipe(p, 'skip') }}
                  aria-label={`Remove ${p.title}`}
                ><Star size={16} strokeWidth={2.2} fill="currentColor" /></button>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
