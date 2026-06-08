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

// Resolve a bare day+month to the nearest sensible year: this year, unless that date is
// already well in the past (>45d) — then it's next year's. Mirrors the pipeline heuristic.
function resolveDate(day: number, mon: number, now: Date): Date {
  const y = now.getFullYear()
  let d = new Date(y, mon, day, 12, 0, 0)
  if (d.getTime() < now.getTime() - 45 * 864e5) d = new Date(y + 1, mon, day, 12, 0, 0)
  return d
}

/** Correct the weekday(s) in a freeform `when` string to match the actual date. Idempotent. */
export function fixWhen(when: string, now: Date = new Date()): string {
  if (!when) return when
  // range first: "Sat–Sun 13–14 Jun" → recompute both ends from the two day numbers
  let s = when.replace(
    new RegExp(`\\b(?:${WDAY})\\s*[–—-]\\s*(?:${WDAY})\\s+(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})\\s+(${MONS})(\\w*)`, 'gi'),
    (_full, d1: string, d2: string, mon: string, tail: string) => {
      const mi = MON[mon.toLowerCase()]
      const a = resolveDate(+d1, mi, now), b = resolveDate(+d2, mi, now)
      return `${WD[a.getDay()]}–${WD[b.getDay()]} ${d1}–${d2} ${mon}${tail}`
    },
  )
  // single: "Sun 8 Jun" → "Mon 8 Jun"
  s = s.replace(
    new RegExp(`\\b(?:${WDAY})\\.?\\s+(\\d{1,2})\\s+(${MONS})(\\w*)`, 'gi'),
    (_full, d: string, mon: string, tail: string) => {
      const dt = resolveDate(+d, MON[mon.toLowerCase()], now)
      return `${WD[dt.getDay()]} ${d} ${mon}${tail}`
    },
  )
  return s
}

// ── grouping helpers (the saves dock sorts/groups by day + time) ───────────────

/** The first concrete date in a `when` (the START of a range), or null if it's evergreen. */
function firstDate(when: string, now: Date): Date | null {
  const m = when.match(new RegExp(`(\\d{1,2})(?:\\s*[–—-]\\s*\\d{1,2})?\\s+(${MONS})`, 'i'))
  if (!m) return null
  return resolveDate(+m[1], MON[m[2].toLowerCase()], now)
}

/** Minutes-into-the-day for intra-day ordering — explicit HH:MM, else a part-of-day word. */
function timeMinutes(when: string): number {
  const t = when.match(/(\d{1,2}):(\d{2})/)
  if (t) return +t[1] * 60 + +t[2]
  if (/\bmorning\b/i.test(when)) return 9 * 60
  if (/\b(noon|midday|lunch)\b/i.test(when)) return 12 * 60
  if (/\b(afternoon|matinee)\b/i.test(when)) return 14 * 60
  if (/\b(evening|doors|tonight)\b/i.test(when)) return 19 * 60
  if (/\b(night|late)\b/i.test(when)) return 22 * 60
  return 12 * 60
}

/** A sortable key: dated picks chronologically; evergreen ("Daily", "Open now") sink last. */
export function whenSortKey(when: string, now: Date = new Date()): number {
  const d = firstDate(when, now)
  if (!d) return Number.MAX_SAFE_INTEGER
  return d.getTime() + timeMinutes(when) * 60000
}

/** The day bucket a pick belongs to, for the saves breakdown. Evergreen → "Anytime". */
export function whenDayGroup(when: string, now: Date = new Date()): { key: string; label: string } {
  const d = firstDate(when, now)
  if (!d) return { key: 'anytime', label: 'Anytime' }
  const label = d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })
  return { key: d.toISOString().slice(0, 10), label }
}

/** Just the time / part-of-day slice of a `when`, for the row's time chip ("" if none). */
export function whenTime(when: string): string {
  const t = when.match(/\b\d{1,2}:\d{2}\b/)
  if (t) return t[0]
  const word = when.match(/\b(morning|noon|midday|lunch|afternoon|matinee|evening|tonight|night|late|all day|doors)\b/i)
  return word ? word[0].toLowerCase() : ''
}
