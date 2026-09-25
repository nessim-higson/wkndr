// THE SUN — weather/daylight.ts. The grade is judged by eye; what can be pinned is the astronomy
// (sunset in Amsterdam is when it is) and the shape of the curves it drives.
import { describe, it, expect } from 'bun:test'
import { sunAltitude, gradeFor, daylightAt, dateAtClock } from '../src/weather/daylight'

const AMS = [52.37, 4.89] as const

describe('sun altitude', () => {
  it('puts Amsterdam sunset on 18 Sep 2026 within a degree of the horizon at 19:49 CEST', () => {
    expect(Math.abs(sunAltitude(new Date('2026-09-18T17:49:00Z'), ...AMS))).toBeLessThan(1)
  })
  it('peaks near 39° at solar noon that day, and is deep below the horizon at midnight', () => {
    expect(sunAltitude(new Date('2026-09-18T11:34:00Z'), ...AMS)).toBeGreaterThan(38)
    expect(sunAltitude(new Date('2026-09-18T11:34:00Z'), ...AMS)).toBeLessThan(41)
    expect(sunAltitude(new Date('2026-09-18T00:00:00Z'), ...AMS)).toBeLessThan(-30)
  })
  it('knows June from December', () => {
    expect(sunAltitude(new Date('2026-06-21T19:30:00Z'), ...AMS)).toBeGreaterThan(0)    // 21:30 CEST, still light
    expect(sunAltitude(new Date('2026-12-21T16:00:00Z'), ...AMS)).toBeLessThan(0)       // 17:00 CET, dark
  })
})

describe('the grade', () => {
  it('is full light by day, a floor at night, and monotonic between', () => {
    expect(gradeFor(40).light).toBe(1)
    expect(gradeFor(-30).light).toBeCloseTo(.26, 5)
    let prev = gradeFor(-30).light
    for (let a = -29; a <= 40; a++) { const l = gradeFor(a).light; expect(l).toBeGreaterThanOrEqual(prev); prev = l }
  })
  it('is golden with the sun just up, rose at dusk, blue at night — and never two at full strength', () => {
    expect(gradeFor(3).gold).toBe(1)
    expect(gradeFor(3).night).toBe(0)
    expect(gradeFor(-4).dusk).toBe(1)
    expect(gradeFor(-20).night).toBe(1)
    expect(gradeFor(-20).gold).toBe(0)
    expect(gradeFor(40).gold + gradeFor(40).dusk + gradeFor(40).night).toBe(0)
  })
  it('names the phases, and tells dawn from dusk by which way the sun is going', () => {
    expect(gradeFor(30).phase).toBe('day')
    expect(gradeFor(4).phase).toBe('golden')
    expect(gradeFor(-3, false).phase).toBe('dusk')
    expect(gradeFor(-3, true).phase).toBe('dawn')
    expect(gradeFor(-15).phase).toBe('night')
    expect(daylightAt(new Date('2026-09-18T05:30:00Z'), ...AMS).rising).toBe(true)    // 07:30 CEST, just after sunrise
    expect(daylightAt(new Date('2026-09-18T17:30:00Z'), ...AMS).rising).toBe(false)
  })
})

describe('?at=', () => {
  it('reads a clock time onto today and ignores junk', () => {
    const now = new Date(2026, 8, 18, 12, 0)
    expect(dateAtClock('19:40', now)?.getHours()).toBe(19)
    expect(dateAtClock('19:40', now)?.getMinutes()).toBe(40)
    expect(dateAtClock('19:40', now)?.getDate()).toBe(18)
    expect(dateAtClock('golden', now)).toBeNull()
    expect(dateAtClock(null, now)).toBeNull()
  })
})
