// Regression guard for src/lib/freshness.ts — the decay rule that stops "New this week" from
// meaning "whenever someone last edited a file". The bug it replaces was live for months: two canon
// picks (east-beach, de-pimpelmees) carried freshness:'new' from the day they were typed, every
// scouted find is stamped 'new' on ingest, and the pipeline's date-derived correction skips canon
// outright — so the bucket could not empty, and after three quiet weeks it was still promising New.
// All tests pin `now` to Wed 1 Jul 2026.
import { describe, it, expect } from 'bun:test'
import { effectiveFreshness, seenAgeDays, NEW_DAYS } from '../src/lib/freshness'
import type { Pick } from '../src/types'

const NOW = new Date(2026, 6, 1, 12, 0, 0)   // Wed 1 Jul 2026
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString().slice(0, 10)

const pick = (over: Partial<Pick>): Pick => ({
  id: 'x', title: 'X', venue: '', area: '', when: '', category: 'out', freshness: 'new',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: '', link: '',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...over,
})

describe('effectiveFreshness — a `new` claim expires against firstSeen', () => {
  it('honours a claim we saw arrive today', () => {
    expect(effectiveFreshness(pick({ firstSeen: daysBefore(0) }), NOW)).toBe('new')
  })
  it('honours it on the last day of the window (boundary is inclusive)', () => {
    expect(effectiveFreshness(pick({ firstSeen: daysBefore(NEW_DAYS) }), NOW)).toBe('new')
  })
  it('expires it the day after', () => {
    expect(effectiveFreshness(pick({ firstSeen: daysBefore(NEW_DAYS + 1) }), NOW)).not.toBe('new')
  })
  it('falls back to `weekend` when the pick still carries a real date', () => {
    expect(effectiveFreshness(pick({ firstSeen: daysBefore(40), when: 'Sat 4 Jul · 20:00' }), NOW)).toBe('weekend')
  })
  it('falls back to `always` when it carries no date (a standing listing)', () => {
    expect(effectiveFreshness(pick({ firstSeen: daysBefore(40), when: 'Now open · daytime' }), NOW)).toBe('always')
  })
})

describe('effectiveFreshness — fails CLOSED', () => {
  // Absence of evidence is the whole reason the old bucket never emptied. No record of arriving =
  // no claim, rather than the benefit of the doubt.
  it('demotes a `new` with no firstSeen at all', () => {
    expect(effectiveFreshness(pick({ when: 'New · daily' }), NOW)).toBe('always')
  })
  it('demotes a `new` whose firstSeen is unparseable', () => {
    expect(effectiveFreshness(pick({ firstSeen: 'soon', when: '' }), NOW)).toBe('always')
  })
  it('reports an unknown age as null rather than 0', () => {
    expect(seenAgeDays(pick({}), NOW)).toBeNull()
    expect(seenAgeDays(pick({ firstSeen: daysBefore(3) }), NOW)).toBe(3)
  })
})

describe('effectiveFreshness — everything else passes through', () => {
  // `weekend` / `ending` are already derived from real dates in the pipeline and `always` is a
  // standing fact; only the `new` claim has no natural expiry, so only `new` is touched.
  for (const f of ['weekend', 'always', 'ending'] as const) {
    it(`leaves \`${f}\` alone, firstSeen or not`, () => {
      expect(effectiveFreshness(pick({ freshness: f }), NOW)).toBe(f)
      expect(effectiveFreshness(pick({ freshness: f, firstSeen: daysBefore(400) }), NOW)).toBe(f)
    })
  }
})

describe('the two immortal canon picks (the actual regression)', () => {
  // Shape copied from src/data/picks.ts. Hand-authored, undated, tagged new, never stamped — these
  // were 2 of the 3 picks the live "New this week" bucket held on 2026-08-28.
  const immortal = [
    pick({ id: 'east-beach', title: 'East Beach — rooftop city beach', when: 'New · daily' }),
    pick({ id: 'de-pimpelmees', title: 'De Pimpelmees', when: 'New · daily' }),
  ]
  it('no longer claim New', () => {
    for (const p of immortal) expect(effectiveFreshness(p, NOW)).toBe('always')
  })
  it('DO claim New again once the pipeline stamps them as freshly seen', () => {
    for (const p of immortal) expect(effectiveFreshness({ ...p, firstSeen: daysBefore(1) }, NOW)).toBe('new')
  })
})
