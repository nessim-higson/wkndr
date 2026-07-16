// Regression guard for src/lib/when.ts — the runtime date brain. These three functions decide what the
// user is shown (weekday correction) and what is HIDDEN (the past-event filter), and they broke subtly
// twice during the pipeline era. All tests pin `now` to Wed 1 Jul 2026 (weekend = Sat 4 / Sun 5 Jul).
import { describe, it, expect } from 'bun:test'
import { fixWhen, whenIsPast, latestDateOf, whenSortKey, whenDayGroup, whenLooksBroken } from '../src/lib/when'

const NOW = new Date(2026, 6, 1, 12, 0, 0)   // Wed 1 Jul 2026

describe('fixWhen — weekday correction', () => {
  it('corrects a wrong single weekday from the real date', () => {
    expect(fixWhen('Sun 4 Jul', NOW)).toBe('Sat 4 Jul')          // 4 Jul 2026 is a Saturday
  })
  it('corrects both ends of a range', () => {
    expect(fixWhen('Fri–Sat 4–5 Jul', NOW)).toBe('Sat–Sun 4–5 Jul')
  })
  it('leaves a correct when unchanged (idempotent)', () => {
    const once = fixWhen('Sat 4 Jul · 20:00', NOW)
    expect(once).toBe('Sat 4 Jul · 20:00')
    expect(fixWhen(once, NOW)).toBe(once)
  })
  it('passes evergreen strings through untouched', () => {
    expect(fixWhen('Daily · shop hours', NOW)).toBe('Daily · shop hours')
  })
})

describe('whenIsPast — the runtime past-event filter', () => {
  it('drops last weekend', () => {
    expect(whenIsPast('Sun 28 Jun · 13:00-23:00', NOW)).toBe(true)
    expect(whenIsPast('Sat–Sun 27–28 Jun', NOW)).toBe(true)
    expect(whenIsPast('Until Sun 28 Jun · 08:00-00:00', NOW)).toBe(true)
  })
  it('keeps the coming weekend and ongoing runs', () => {
    expect(whenIsPast('Sat 4 Jul · 20:00', NOW)).toBe(false)
    expect(whenIsPast('Fri 3 – Sun 5 Jul', NOW)).toBe(false)
    expect(whenIsPast('Until Sun 27 Sep (open this weekend)', NOW)).toBe(false)
  })
  it('never drops undated / evergreen picks', () => {
    expect(whenIsPast('Daily · 10:00–18:00', NOW)).toBe(false)
    expect(whenIsPast('Mon–Sat · 09:00–17:00', NOW)).toBe(false)
    expect(whenIsPast('', NOW)).toBe(false)
  })
})

describe('whenLooksBroken — malformed ranges are dropped, not displayed', () => {
  it('flags a descending day pair with one month token (the missing-first-month range)', () => {
    expect(whenLooksBroken('Sun 28 – Sun 12 Jul', NOW)).toBe(true)
    expect(whenLooksBroken('28–12 Jul', NOW)).toBe(true)
  })
  it('flags an explicit start–end pair that runs backwards', () => {
    expect(whenLooksBroken('Sat 12 Jul – Sun 28 Jun', NOW)).toBe(true)
  })
  it('keeps valid compact and expanded ranges', () => {
    expect(whenLooksBroken('Fri–Sun 19–21 Jun', NOW)).toBe(false)
    expect(whenLooksBroken('Fri 3 – Sun 5 Jul', NOW)).toBe(false)
    expect(whenLooksBroken('Sat–Sun 4–5 Jul · 12:00–22:00', NOW)).toBe(false)
  })
  it('keeps cross-month and year-wrap ranges (each side has its own month)', () => {
    expect(whenLooksBroken('Thu 30 Jul – Sun 2 Aug', NOW)).toBe(false)
    expect(whenLooksBroken('Sat 20 Dec – Sun 4 Jan', new Date(2026, 10, 20, 12))).toBe(false)
  })
  it('never trips on time ranges or undated picks', () => {
    expect(whenLooksBroken('Sat 11 Jul · 14:00–23:00, Sun 12 Jul · 17:00–23:00', NOW)).toBe(false)
    expect(whenLooksBroken('Daily · 10:00–18:00', NOW)).toBe(false)
    expect(whenLooksBroken('Until 27 Sep · 10:00–17:00', NOW)).toBe(false)
    expect(whenLooksBroken('', NOW)).toBe(false)
  })
})

describe('year rollover — the resolveDate heuristic', () => {
  it('rolls an open run across the year boundary ("Until 15 Jan" in July = NEXT January)', () => {
    expect(whenIsPast('Until 15 Jan', NOW)).toBe(false)
    expect(latestDateOf('Until 15 Jan', NOW)?.getFullYear()).toBe(2027)
  })
  it('wraps a bare date near the boundary (a late-Dec feed saying "Sat 2 Jan")', () => {
    const DEC = new Date(2026, 11, 28, 12)                     // Mon 28 Dec 2026
    expect(whenIsPast('Sat 2 Jan', DEC)).toBe(false)
    expect(fixWhen('Fri 2 Jan', DEC)).toBe('Sat 2 Jan')        // 2 Jan 2027 is a Saturday
  })
  it('does NOT resurrect a stale feed\'s bare dates as next year\'s (the >45-day-lag bug)', () => {
    expect(whenIsPast('Sat 25 Apr', NOW)).toBe(true)           // 67 days past → past, not next April
    expect(whenIsPast('Sat–Sun 25–26 Apr', NOW)).toBe(true)
  })
})

describe('latestDateOf', () => {
  it('finds the latest date of a range', () => {
    const d = latestDateOf('Fri 3 – Sun 5 Jul', NOW)
    expect(d?.getMonth()).toBe(6)
    expect(d?.getDate()).toBe(5)
  })
  it('parses both sides of a cross-month expanded range', () => {
    const d = latestDateOf('Thu 30 Jul – Sun 2 Aug', NOW)   // Dekmantel phrasing
    expect(d?.getMonth()).toBe(7)
    expect(d?.getDate()).toBe(2)
  })
  it('returns null for undated whens', () => {
    expect(latestDateOf('Daily · dinner', NOW)).toBeNull()
  })
})

describe('whenDayGroup — a range is dated on its START day', () => {
  it('dates a compact weekend range on its start day', () => {
    const g = whenDayGroup('Fri–Sun 3–5 Jul', NOW)
    expect(g.key).toBe('2026-07-03')
    expect(g.label).toContain('Friday')
  })
  it('dates an expanded range (weekday after the dash) on its start day', () => {
    const g = whenDayGroup('Sat 25 – Sun 26 Jul', NOW)      // Milkshake phrasing — used to land on Sun 26
    expect(g.key).toBe('2026-07-25')
    expect(g.label).toContain('Saturday')
  })
  it('dates an expanded weekend range on its Friday', () => {
    const g = whenDayGroup('Fri 3 – Sun 5 Jul', NOW)
    expect(g.key).toBe('2026-07-03')
    expect(g.label).toContain('Friday')
  })
  it('dates a cross-month expanded range on its first day', () => {
    const g = whenDayGroup('Thu 30 Jul – Sun 2 Aug', NOW)   // Thu–Sun = 3-day span, still a dated plan
    expect(g.key).toBe('2026-07-30')
    expect(g.label).toContain('Thursday')
  })
  it('still sinks long runs and evergreens into Anytime', () => {
    expect(whenDayGroup('Until Sun 27 Sep', NOW).key).toBe('anytime')
    expect(whenDayGroup('Daily · shop hours', NOW).key).toBe('anytime')
  })
})

describe('whenSortKey — itinerary ordering', () => {
  it('orders dated picks chronologically, evergreen last', () => {
    const sat = whenSortKey('Sat 4 Jul · 20:00', NOW)
    const sun = whenSortKey('Sun 5 Jul · 12:00', NOW)
    const daily = whenSortKey('Daily · shop hours', NOW)
    expect(sat).toBeLessThan(sun)
    expect(sun).toBeLessThan(daily)
  })
  it('sorts an expanded range by its start day, ahead of a pick on its end day', () => {
    expect(whenSortKey('Sat 25 – Sun 26 Jul', NOW)).toBeLessThan(whenSortKey('Sun 26 Jul · 12:00', NOW))
  })
})

// V.8.7 — whenActiveBy, the TOP deck-lead gate's date question: "has this begun by the end of
// the weekend we're serving?"
import { whenActiveBy, upcomingWeekendEnd } from '../src/lib/when'

describe('whenActiveBy — the TOP weekend gate', () => {
  const NOW = new Date(2026, 6, 8, 12, 0, 0)            // Wed 8 Jul 2026
  const END = new Date(2026, 6, 12, 23, 59, 59)         // Sun 12 Jul — end of served weekend

  it('a place already open ("Opens 8 Jul") is active this weekend', () => {
    expect(whenActiveBy('Opens 8 Jul', END, NOW)).toBe(true)
  })
  it('a place opening AFTER the weekend is not ("Opens 20 Jul")', () => {
    expect(whenActiveBy('Opens 20 Jul', END, NOW)).toBe(false)
  })
  it('a future festival is not active until its own weekend', () => {
    expect(whenActiveBy('Sat 25 – Sun 26 Jul', END, NOW)).toBe(false)
    expect(whenActiveBy('Sat 25 – Sun 26 Jul', new Date(2026, 6, 26, 23, 59, 59), NOW)).toBe(true)
  })
  it('undated / recurring picks are always active', () => {
    expect(whenActiveBy('Daily · 9:00–18:00', END, NOW)).toBe(true)
    expect(whenActiveBy('', END, NOW)).toBe(true)
  })
  it('end-anchored open runs ("Until …") are already underway', () => {
    expect(whenActiveBy('Until Sun 27 Sep', END, NOW)).toBe(true)
  })
})

describe('upcomingWeekendEnd', () => {
  it('a weekday serves the coming Sunday', () => {
    const end = upcomingWeekendEnd(new Date(2026, 6, 8))        // Wed 8 Jul
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 6, 12])
  })
  it('a Saturday serves its own Sat–Sun; a Sunday serves itself', () => {
    expect(upcomingWeekendEnd(new Date(2026, 6, 11)).getDate()).toBe(12)
    expect(upcomingWeekendEnd(new Date(2026, 6, 12)).getDate()).toBe(12)
  })
})
