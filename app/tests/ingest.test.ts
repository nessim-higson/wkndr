// Regression guard for scripts/lib/ingest.ts — the pure half of the daily poll (Workstream 3).
// The semantics worth pinning: the registry's min-date rule (an arrival date can only ever get
// EARLIER), the inbox's not-already-visible rule, and the health alerts that make a dead source
// visible instead of silently starving the feed.
import { describe, it, expect } from 'bun:test'
import { mergeSightings, pruneRegistry, buildInbox, appendRun, REGISTRY_DAYS, type SeenRegistry, type HealthFile } from '../scripts/lib/ingest'
import type { Pick } from '../src/types'

const pick = (title: string, over: Partial<Pick> = {}): Pick => ({
  id: 'rss-x', title, venue: '', area: '', when: 'This weekend', category: 'out', freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'X', link: 'https://x',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...over,
})
const key = (t: string) => t.toLowerCase()

describe('the seen registry — first sighting wins, forever', () => {
  it('records a new title and refuses to move an existing date forward', () => {
    let reg: SeenRegistry = { v: 1, seen: {} }
    reg = mergeSightings(reg, ['a'], '2026-08-20')
    reg = mergeSightings(reg, ['a', 'b'], '2026-08-29')   // 'a' sighted again, later
    expect(reg.seen['a']).toBe('2026-08-20')
    expect(reg.seen['b']).toBe('2026-08-29')
  })
  it('lets a backfilled EARLIER date move it back (the weekly writer healing the daily one)', () => {
    let reg: SeenRegistry = { v: 1, seen: { a: '2026-08-29' } }
    reg = mergeSightings(reg, ['a'], '2026-08-13')
    expect(reg.seen['a']).toBe('2026-08-13')
  })
  it('prunes only entries beyond the horizon', () => {
    const reg: SeenRegistry = { v: 1, seen: { old: '2026-01-01', recent: '2026-08-01' } }
    const out = pruneRegistry(reg, '2026-08-29')
    expect(out.seen['old']).toBeUndefined()      // 240 days > REGISTRY_DAYS
    expect(out.seen['recent']).toBe('2026-08-01')
    expect(REGISTRY_DAYS).toBe(180)              // a silent horizon change should fail a test
  })
})

describe('the inbox — fresh, and not already visible anywhere', () => {
  const reg: SeenRegistry = { v: 1, seen: { 'new find': '2026-08-28', 'old find': '2026-07-01', 'in feed': '2026-08-28' } }
  it('admits recent arrivals, excludes the old and the already-known', () => {
    const inbox = buildInbox(
      [pick('New Find'), pick('Old Find'), pick('In Feed')],
      reg, new Set(['in feed']), key, '2026-08-29',
    )
    expect(inbox.map((p) => p.title)).toEqual(['New Find'])
    expect(inbox[0].firstSeen).toBe('2026-08-28')   // carries its arrival date for the board
  })
  it('sorts newest arrival first, buzz as the tiebreak', () => {
    const r: SeenRegistry = { v: 1, seen: { a: '2026-08-27', b: '2026-08-29', c: '2026-08-29' } }
    const inbox = buildInbox([pick('A'), pick('B'), pick('C', { buzz: 3 })], r, new Set(), key, '2026-08-29')
    expect(inbox.map((p) => p.title)).toEqual(['C', 'B', 'A'])
  })
})

describe('ingest health — a dead source must be VISIBLE', () => {
  const run = (date: string, x: number, y: number, fresh = x + y): { date: string; kind: 'daily'; sources: Record<string, number>; fresh: number } =>
    ({ date, kind: 'daily', sources: { X: x, Y: y }, fresh })
  it('flags a source at zero for three consecutive runs — and clears when it recovers', () => {
    let h: HealthFile = { v: 1, runs: [], alerts: [] }
    h = appendRun(h, run('2026-08-26', 5, 0))
    h = appendRun(h, run('2026-08-27', 5, 0))
    expect(h.alerts).toEqual([])                          // two quiet runs = not yet
    h = appendRun(h, run('2026-08-28', 5, 0))
    expect(h.alerts.some((a) => a.kind === 'source-quiet' && a.detail.startsWith('Y:'))).toBe(true)
    h = appendRun(h, run('2026-08-29', 5, 4))
    expect(h.alerts.filter((a) => a.kind === 'source-quiet')).toEqual([])
  })
  it('flags starving inflow even when every source answers', () => {
    let h: HealthFile = { v: 1, runs: [], alerts: [] }
    for (const d of ['2026-08-26', '2026-08-27', '2026-08-28']) h = appendRun(h, run(d, 5, 5, 0))
    expect(h.alerts.some((a) => a.kind === 'inflow-low')).toBe(true)
  })
  it('re-running the same day replaces the run instead of double-counting it', () => {
    let h: HealthFile = { v: 1, runs: [], alerts: [] }
    h = appendRun(h, run('2026-08-29', 1, 1))
    h = appendRun(h, run('2026-08-29', 7, 7))
    expect(h.runs.length).toBe(1)
    expect(h.runs[0].sources['X']).toBe(7)
  })
  it('caps the run history', () => {
    let h: HealthFile = { v: 1, runs: [], alerts: [] }
    for (let i = 1; i <= 60; i++) h = appendRun(h, run(`2026-06-${String((i % 28) + 1).padStart(2, '0')}`, 1, 1))
    expect(h.runs.length).toBeLessThanOrEqual(45)
  })
})
