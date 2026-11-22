// THE FRIDAY SEND'S GUARDS (list/scripts/friday.ts refusal) — what the unattended run refuses to mail.
// Fixed clocks throughout; never the real one.
import { describe, it, expect } from 'bun:test'
import { refusal, type Receipt } from '../../list/scripts/friday'

const ok: Receipt = { saturday: '2026-11-28', subject: 'Cold, dry Saturday. Go out after dark.', stale: false, template: 'picks', picks: 9, forecast: true }
const FRI = new Date('2026-11-27T06:30:00Z')   // Friday 07:30 Amsterdam

describe('refusal', () => {
  it('lets the coming weekend through on Friday, and a Saturday-morning rescue', () => {
    expect(refusal(ok, 30_000, FRI)).toBeNull()
    expect(refusal(ok, 30_000, new Date('2026-11-26T15:00:00Z'))).toBeNull()   // Thursday, after the refresh
    expect(refusal(ok, 30_000, new Date('2026-11-28T08:00:00Z'))).toBeNull()   // Saturday morning
    expect(refusal(ok, 30_000, new Date('2026-11-29T08:00:00Z'))).toBeNull()   // Sunday, still under way
  })
  it('refuses a stale feed — the refresh gate went red and the deck is last weekend\'s', () => {
    expect(refusal({ ...ok, saturday: '2026-11-21', stale: true }, 30_000, FRI)).toMatch(/already past/)
    expect(refusal({ ...ok, saturday: '2026-11-21' }, 30_000, FRI)).toMatch(/is over/)   // even if nobody flagged it
  })
  it('refuses a weekend that is not this one', () => {
    expect(refusal({ ...ok, saturday: '2026-12-12' }, 30_000, FRI)).toMatch(/days out/)
    expect(refusal({ ...ok, saturday: null }, 30_000, FRI)).toMatch(/no weekend/)
  })
  it('refuses a thin, empty, subject-less or clipped draft', () => {
    expect(refusal({ ...ok, picks: 2 }, 30_000, FRI)).toMatch(/too thin/)
    expect(refusal({ ...ok, subject: ' ' }, 30_000, FRI)).toMatch(/no subject/)
    expect(refusal(ok, 500, FRI)).toMatch(/nearly empty/)
    expect(refusal(ok, 104_000, FRI)).toMatch(/clips/)
  })
  it('reads the day in Amsterdam, not UTC — late Sunday night there is still the weekend', () => {
    expect(refusal(ok, 30_000, new Date('2026-11-29T22:30:00Z'))).toBeNull()        // 23:30 Sunday in Amsterdam
    expect(refusal(ok, 30_000, new Date('2026-12-01T00:30:00Z'))).toMatch(/is over/)   // Tuesday
  })
})
