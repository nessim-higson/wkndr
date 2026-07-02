// Regression guard for src/lib/when.ts — the runtime date brain. These three functions decide what the
// user is shown (weekday correction) and what is HIDDEN (the past-event filter), and they broke subtly
// twice during the pipeline era. All tests pin `now` to Wed 1 Jul 2026 (weekend = Sat 4 / Sun 5 Jul).
import { describe, it, expect } from 'bun:test'
import { fixWhen, whenIsPast, latestDateOf, whenSortKey } from '../src/lib/when'

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

describe('latestDateOf', () => {
  it('finds the latest date of a range', () => {
    const d = latestDateOf('Fri 3 – Sun 5 Jul', NOW)
    expect(d?.getMonth()).toBe(6)
    expect(d?.getDate()).toBe(5)
  })
  it('returns null for undated whens', () => {
    expect(latestDateOf('Daily · dinner', NOW)).toBeNull()
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
})
