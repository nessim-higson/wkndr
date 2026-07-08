// WHEN normalization — the single source of truth for displayed dates.
//
// LLM-extracted (and some hand-authored) `when` strings carry a weekday that the source
// wrote, which can be wrong or stale ("Sun 8 Jun" when 8 Jun is actually a Monday). Rather
// than trust it, we RECOMPUTE the weekday from the day+month, against today. So whatever the
// feed says, the day-of-week shown to the user is always correct.
//
// Applied once where the feed enters the app (App.tsx) so every surface — cards, the saves
// dock, the fan, detail, share — reads the same corrected date. Pure + cheap.

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
const MONS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'
// precise weekday tokens (avoids matching a stray word like "satay") — 3-letter stems + full forms
const WDAY = 'mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?'

// Open-run phrasings ("Until 15 Jan", "runs through Mar") legitimately point months ahead
// across a year boundary, so their dates roll forward generously.
const OPEN_RUN = /\b(until|through|thru|till|t\/m|ongoing|runs?|opens?)\b/i

// Resolve a bare day+month to the right year. This year, unless the date is already well past
// (>45d) — then it MAY be next year's, but only when the phrasing is an open run (an exhibition
// "Until 15 Jan" seen in July) or the wrap lands near (a late-Dec feed saying "Sat 2 Jan").
// A merely-stale feed's events therefore stay in THIS year and get filtered as past, instead
// of resurrecting as next year's (the >45-day-lag failure mode).
function resolveDate(day: number, mon: number, now: Date, openRun = false): Date {
  const y = now.getFullYear()
  const d = new Date(y, mon, day, 12, 0, 0)
  if (d.getTime() >= now.getTime() - 45 * 864e5) return d
  const next = new Date(y + 1, mon, day, 12, 0, 0)
  return openRun || next.getTime() - now.getTime() < 60 * 864e5 ? next : d
}

/** Correct the weekday(s) in a freeform `when` string to match the actual date. Idempotent. */
export function fixWhen(when: string, now: Date = new Date()): string {
  if (!when) return when
  const openRun = OPEN_RUN.test(when)
  // range first: "Sat–Sun 13–14 Jun" → recompute both ends from the two day numbers
  let s = when.replace(
    new RegExp(`\\b(?:${WDAY})\\s*[–—-]\\s*(?:${WDAY})\\s+(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})\\s+(${MONS})(\\w*)`, 'gi'),
    (_full, d1: string, d2: string, mon: string, tail: string) => {
      const mi = MON[mon.toLowerCase()]
      const a = resolveDate(+d1, mi, now, openRun), b = resolveDate(+d2, mi, now, openRun)
      return `${WD[a.getDay()]}–${WD[b.getDay()]} ${d1}–${d2} ${mon}${tail}`
    },
  )
  // single: "Sun 8 Jun" → "Mon 8 Jun"
  s = s.replace(
    new RegExp(`\\b(?:${WDAY})\\.?\\s+(\\d{1,2})\\s+(${MONS})(\\w*)`, 'gi'),
    (_full, d: string, mon: string, tail: string) => {
      const dt = resolveDate(+d, MON[mon.toLowerCase()], now, openRun)
      return `${WD[dt.getDay()]} ${d} ${mon}${tail}`
    },
  )
  return s
}

// ── grouping helpers (the saves dock sorts/groups by day + time) ───────────────

/** Minutes-into-the-day for intra-day ordering — explicit HH:MM, else a part-of-day word. */
export function whenMinutes(when: string): number {
  const t = when.match(/(\d{1,2}):(\d{2})/)
  if (t) return +t[1] * 60 + +t[2]
  if (/\bmorning\b/i.test(when)) return 9 * 60
  if (/\b(noon|midday|lunch)\b/i.test(when)) return 12 * 60
  if (/\b(afternoon|matinee)\b/i.test(when)) return 14 * 60
  if (/\b(evening|doors|tonight)\b/i.test(when)) return 19 * 60
  if (/\b(night|late)\b/i.test(when)) return 22 * 60
  return 12 * 60
}

/** Every concrete date mentioned in a `when`, sorted ascending. */
function datesIn(s: string, now: Date): Date[] {
  const out: Date[] = []
  const openRun = OPEN_RUN.test(s)
  for (const m of s.matchAll(new RegExp(`(\\d{1,2})\\s*[–—-]?\\s*(\\d{1,2})?\\s*(${MONS})`, 'gi'))) {
    const mi = MON[m[3].slice(0, 3).toLowerCase()]
    out.push(resolveDate(+m[1], mi, now, openRun))
    if (m[2]) out.push(resolveDate(+m[2], mi, now, openRun))
  }
  for (const m of s.matchAll(new RegExp(`(${MONS})\\s*(\\d{1,2})`, 'gi')))
    out.push(resolveDate(+m[2], MON[m[1].slice(0, 3).toLowerCase()], now, openRun))
  return out.sort((a, b) => a.getTime() - b.getTime())
}

/** Is this pick "anytime" rather than a specific-day plan? True for open-ended/recurring runs
 *  ("Until 21 Jun", "Daily") AND for long runs spanning more than a weekend (an exhibition open
 *  for weeks) — so the saves list buckets those under Anytime, not on a misleading end date. */
function classifyWhen(when: string, now: Date): { anytime: boolean; start: Date | null } {
  const s = (when || '').toLowerCase()
  if (/\b(daily|until|ongoing|every\s?day|always|through(?:out)?|all\s?(?:summer|year|weekend)|now\s?open|open\s?now)\b/.test(s))
    return { anytime: true, start: null }
  const dates = datesIn(s, now)
  if (!dates.length) return { anytime: true, start: null }
  const spanDays = (dates[dates.length - 1].getTime() - dates[0].getTime()) / 864e5
  return { anytime: spanDays > 3, start: dates[0] }       // a run longer than a weekend → anytime
}

/** A sortable key: dated picks chronologically; ongoing / long-running / evergreen sink last. */
export function whenSortKey(when: string, now: Date = new Date()): number {
  const { anytime, start } = classifyWhen(when, now)
  if (anytime || !start) return Number.MAX_SAFE_INTEGER
  return start.getTime() + whenMinutes(when) * 60000
}

/** The START date of a dated pick (its first concrete date), or null for anytime / open-ended
 *  runs. The one answer to "which day does this belong to" — the saves dock, the Itinerary,
 *  and the .ics export all key off this, so they can never disagree about a pick's day. */
export function whenStartDate(when: string, now: Date = new Date()): Date | null {
  const { anytime, start } = classifyWhen(when, now)
  return anytime ? null : start
}

/** The day bucket a pick belongs to, for the saves breakdown. Ongoing/long-running → "Anytime". */
export function whenDayGroup(when: string, now: Date = new Date()): { key: string; label: string } {
  const { anytime, start } = classifyWhen(when, now)
  if (anytime || !start) return { key: 'anytime', label: 'Anytime' }
  const label = start.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })
  return { key: start.toISOString().slice(0, 10), label }
}

/** The LATEST concrete date a `when` refers to, or null if it's undated / evergreen. */
export function latestDateOf(when: string, now: Date = new Date()): Date | null {
  const dates = datesIn(when || '', now)
  return dates.length ? dates[dates.length - 1] : null
}

/** Has this `when` already finished? (Its latest date is before today.) Undated / open-ended / recurring
 *  picks — "Daily", "Until <future>", a market's "Mon–Sat", evergreen canon — have no concrete latest date
 *  and return false (kept). This is the RUNTIME guard: the feed is rebuilt weekly for the coming weekend,
 *  so between refreshes it can lag into a now-past weekend; filtering on this in the app means last
 *  weekend's events never reach a card no matter how stale the feed is. Mirrors the build-time whenIsPast. */
export function whenIsPast(when: string, now: Date = new Date()): boolean {
  const latest = latestDateOf(when, now)
  if (!latest) return false
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return latest < today
}

/** Just the time / part-of-day slice of a `when`, for the row's time chip ("" if none). */
export function whenTime(when: string): string {
  const t = when.match(/\b\d{1,2}:\d{2}\b/)
  if (t) return t[0]
  const word = when.match(/\b(morning|noon|midday|lunch|afternoon|matinee|evening|tonight|night|late|all day|doors)\b/i)
  return word ? word[0].toLowerCase() : ''
}
