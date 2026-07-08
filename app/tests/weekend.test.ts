// Regression guard for src/weekend.ts — the Itinerary grouping + .ics export, now a thin shim
// over the shared date brain (src/lib/when.ts). Pins the V.8.5-era split-brain bug: a saved
// "Fri–Sun 5–7 Jun" range was grouped under Friday in the saves dock but fell into "Anytime"
// in the Itinerary and was silently left out of the exported .ics. One brain now → one answer.
import { describe, it, expect } from 'bun:test'
import { parseWhen, buildICS } from '../src/weekend'
import type { Pick } from '../src/types'

const NOW = new Date(2026, 6, 1, 12, 0, 0)   // Wed 1 Jul 2026 (weekend = Sat 4 / Sun 5 Jul)

const P = (o: Partial<Pick> & { id: string; title: string; when: string }): Pick => ({
  venue: 'V', area: 'Centrum', category: 'live', freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'S', link: 'https://x.example',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...o,
})

describe('parseWhen — agrees with the saves dock', () => {
  it('dates a weekend RANGE on its start day (the dock/itinerary split-brain bug)', () => {
    const info = parseWhen('Fri–Sun 3–5 Jul', NOW)
    expect(info.groupKey).toBe('2026-07-03')                  // same bucket the dock uses
    expect(info.date).toEqual({ y: 2026, m: 7, d: 3 })        // → makes it into the .ics
  })
  it('dates a single day, with its explicit time', () => {
    const info = parseWhen('Sat 4 Jul · doors 20:00', NOW)
    expect(info.groupKey).toBe('2026-07-04')
    expect(info.time).toBe('20:00')
    expect(info.minutes).toBe(20 * 60)
  })
  it('zero-pads a single-digit hour', () => {
    expect(parseWhen('Sat 4 Jul · 9:00', NOW).time).toBe('09:00')
  })
  it('keeps part-of-day words out of the time chip but uses them for row order', () => {
    const info = parseWhen('Sat 4 Jul · evening', NOW)
    expect(info.time).toBeNull()
    expect(info.minutes).toBe(19 * 60)
  })
  it('buckets open-ended runs under Anytime with no calendar date', () => {
    for (const when of ['Until Sun 27 Sep', 'Daily · 10:00–18:00']) {
      const info = parseWhen(when, NOW)
      expect(info.groupKey).toBe('anytime')
      expect(info.groupLabel).toBe('Anytime this weekend')
      expect(info.date).toBeNull()
    }
  })
})

describe('buildICS', () => {
  it('includes a dated range as an all-day event on its start day', () => {
    const info = parseWhen('Fri–Sun 3–5 Jul', NOW)
    const ics = buildICS([{ pick: P({ id: 'a', title: 'Festival', when: 'Fri–Sun 3–5 Jul' }), info }])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260703')
    expect(ics).toContain('DTEND;VALUE=DATE:20260704')
  })
  it('gives a timed pick a 2-hour block', () => {
    const info = parseWhen('Sat 4 Jul · doors 20:00', NOW)
    const ics = buildICS([{ pick: P({ id: 'b', title: 'Gig', when: 'Sat 4 Jul · doors 20:00' }), info }])
    expect(ics).toContain('DTSTART:20260704T200000')
    expect(ics).toContain('DTEND:20260704T220000')
  })
  it('rolls an all-day DTEND over a month boundary (31 Jul + 1 = 1 Aug, not 32 Jul)', () => {
    const info = parseWhen('Fri 31 Jul', NOW)
    const ics = buildICS([{ pick: P({ id: 'c', title: 'Late show', when: 'Fri 31 Jul' }), info }])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260731')
    expect(ics).toContain('DTEND;VALUE=DATE:20260801')
  })
  it('leaves undated picks out entirely', () => {
    const info = parseWhen('Until Sun 27 Sep', NOW)
    const ics = buildICS([{ pick: P({ id: 'd', title: 'Expo', when: 'Until Sun 27 Sep' }), info }])
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
