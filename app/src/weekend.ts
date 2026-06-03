// Parse a pick's human `when` string ("Sat 6 Jun · doors 18:00", "Fri–Sun 5–7 Jun",
// "Until 21 Jun", "Daily") into something we can group into a day-by-day itinerary and
// export to a calendar. Best-effort: anything without a single, specific dated day lands in
// an "Anytime" bucket and is left out of the .ics (no honest start time to put there).
import type { Pick } from './types'

const MON: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}
// keywords that mean "ongoing / multi-day", not a single dated event
const ONGOING = /^(until|opens|runs|daily|new|final|all)\b|incl\./i

export interface WhenInfo {
  groupKey: string
  groupLabel: string
  sortDay: number               // for ordering day groups; large = "anytime", goes last
  time: string | null           // "18:00" (first time found), or null
  minutes: number               // for ordering rows within a day; large = timeless
  date: { y: number; m: number; d: number } | null   // a specific calendar date (for the .ics)
}

export function parseWhen(when: string, year: number): WhenInfo {
  const single = when.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+([A-Z][a-z]{2})\b/)
  const isRange = /[–—]/.test(when)            // en/em dash → a span of days
  const tm = when.match(/(\d{1,2}):(\d{2})/)
  const time = tm ? `${String(+tm[1]).padStart(2, '0')}:${tm[2]}` : null
  const minutes = tm ? (+tm[1]) * 60 + (+tm[2]) : 100000

  // a single, specific day (not a range, not an "ongoing" phrasing) → its own day group
  if (single && !isRange && !ONGOING.test(when.trim())) {
    const [, wd, dd, mon] = single
    const m = MON[mon] || 0
    const d = +dd
    return {
      groupKey: `${wd}-${dd}-${mon}`,
      groupLabel: `${wd} ${dd} ${mon}`,
      sortDay: m * 100 + d,
      time,
      minutes,
      date: m ? { y: year, m, d } : null,
    }
  }
  // everything else: spans, runs, "until …", daily, evergreen
  return { groupKey: 'anytime', groupLabel: 'Anytime this weekend', sortDay: 999999, time: null, minutes: 100000, date: null }
}

const pad = (n: number) => String(n).padStart(2, '0')
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Build an iCalendar (.ics) document from saved picks that have a real date.
// Timed events get a 2-hour block (clamped to end-of-day); date-only ones become all-day.
export function buildICS(items: { pick: Pick; info: WhenInfo }[]): string {
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WKNDR//Amsterdam//EN', 'CALSCALE:GREGORIAN']
  for (const { pick, info } of items) {
    if (!info.date) continue
    const { y, m, d } = info.date
    out.push('BEGIN:VEVENT')
    out.push(`UID:wkndr-${pick.id}@wkndr.app`)
    if (info.time) {
      const [hh, mm] = info.time.split(':').map(Number)
      const eh = Math.min(23, hh + 2), em = hh + 2 > 23 ? 59 : mm
      out.push(`DTSTART:${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`)
      out.push(`DTEND:${y}${pad(m)}${pad(d)}T${pad(eh)}${pad(em)}00`)
    } else {
      out.push(`DTSTART;VALUE=DATE:${y}${pad(m)}${pad(d)}`)
      out.push(`DTEND;VALUE=DATE:${y}${pad(m)}${pad(d + 1)}`)
    }
    out.push(`SUMMARY:${esc(pick.title)}`)
    const loc = [pick.venue, pick.area].filter(Boolean).join(', ')
    if (loc) out.push(`LOCATION:${esc(loc)}`)
    const desc = [pick.blurb, pick.link ? `More: ${pick.link}` : '', 'Saved in WKNDR'].filter(Boolean).join('\n')
    out.push(`DESCRIPTION:${esc(desc)}`)
    out.push('END:VEVENT')
  }
  out.push('END:VCALENDAR')
  return out.join('\r\n')
}

// Trigger a download of an .ics file (user-initiated, from a button).
export function downloadICS(filename: string, ics: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
