// THE SCRUB DECK — the weather's own order for one hour of the weekend (see hourly.ts).
//
// Two departures from the served deck, both on purpose:
//   · the hand pile, 👑 and ▲ step aside. They ignore the weather by design, and while scrubbing the
//     weather IS the question — with them in place the first three cards would never move.
//   · what is not on that day waits behind what is: scrub to Sunday and a Saturday-only event sinks.
// Everything else (time gates, the pictured front) is still orderServed's job, applied by App.
import type { Pick } from '../types'
import { upcomingWeekendEnd, whenWeekendDays } from '../lib/when'

export function deckForHour(list: Pick[], dow: number, end: Date = upcomingWeekendEnd()): { on: Pick[]; off: Pick[] } {
  const sunD = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const satD = new Date(sunD.getFullYear(), sunD.getMonth(), sunD.getDate() - 1)
  const onDay = (p: Pick) => {
    const d = whenWeekendDays(p.when, satD, sunD)
    if (!d.sat && !d.sun) return true            // undated / evergreen: open whenever
    return dow === 0 ? d.sun : dow === 6 ? d.sat : true
  }
  const plain = list.map((p) => (p.pilePos != null || p.top || p.lead || p.later
    ? { ...p, pilePos: undefined, top: false, lead: false, later: false } : p))
  return { on: plain.filter(onDay), off: plain.filter((p) => !onDay(p)) }
}
