// Itinerary + calendar-export glue over the shared date brain (src/lib/when.ts). ALL date
// parsing lives there — this file only shapes its answers for the Itinerary view and the
// .ics builder, so the itinerary can never disagree with the saves dock about a pick's day.
// Picks without a concrete start day ("Until 21 Jun", "Daily") land in an "Anytime" bucket
// and are left out of the .ics (no honest start date to put there); dated ranges
// ("Fri–Sun 5–7 Jun") are calendared on their START day.
import type { Pick } from './types'
import { whenDayGroup, whenMinutes, whenSortKey, whenStartDate, whenTime } from './lib/when'

export interface WhenInfo {
  groupKey: string
  groupLabel: string
  sortDay: number               // for ordering day groups; large = "anytime", goes last
  time: string | null           // "18:00" (first explicit time found), or null
  minutes: number               // for ordering rows within a day
  date: { y: number; m: number; d: number } | null   // a specific calendar date (for the .ics)
}

export function parseWhen(when: string, now: Date = new Date()): WhenInfo {
  const group = whenDayGroup(when, now)
  const start = whenStartDate(when, now)
  const t = whenTime(when)
  return {
    groupKey: group.key,
    groupLabel: group.key === 'anytime' ? 'Anytime this weekend' : group.label,
    sortDay: whenSortKey(when, now),
    time: /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, '0') : null,
    minutes: whenMinutes(when),
    date: start ? { y: start.getFullYear(), m: start.getMonth() + 1, d: start.getDate() } : null,
  }
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
      const end = new Date(y, m - 1, d + 1)   // normalizes month/year overflow (e.g. 31 Jul + 1)
      out.push(`DTSTART;VALUE=DATE:${y}${pad(m)}${pad(d)}`)
      out.push(`DTEND;VALUE=DATE:${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}`)
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
