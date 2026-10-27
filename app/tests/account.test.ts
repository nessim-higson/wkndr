// THE ACCOUNT's pure rules (src/lib/account.ts): the save snapshot, the Later shelf, the arrival
// pill, the look-back question, and THE MERGE two devices agree on. The wire and storage edges
// are thin wrappers; everything that decides lives here. Pinned:
//   1. A merge never loses a save, never double-counts taste, and is idempotent.
//   2. Later = after the served weekend, or an open run outliving it; this weekend stays the plan.
//   3. The pill shows once per week, only for a save made in an EARLIER week.
//   4. The question is asked for a finished save within three weeks, once.
import { describe, it, expect } from 'bun:test'
import { snapshotSaves, shelfOf, laterShelf, arriving, lookBack, mergeState, fingerprint, emptyState, weekOf } from '../src/lib/account'
import type { AccountState, SaveEntry } from '../src/lib/account'
import { firstDateOf } from '../src/lib/when'
import type { Pick } from '../src/types'

// a Wednesday — the served weekend is Sat 31 Oct + Sun 1 Nov 2026
const NOW = new Date(2026, 9, 28, 14, 0)
const pick = (id: string, when: string, title = id, link = `https://x.io/${id}`): Pick => ({
  id, title, venue: 'V', area: 'Centrum', when, category: 'out', freshness: 'weekend', outdoor: false, kid: false, price: '',
  blurb: '', why: '', source: 'S', link, weatherFit: ['WARM'],
})
const entry = (id: string, when: string, start?: string, end?: string, at = NOW.getTime()): SaveEntry =>
  ({ id, title: id, when, at, ...(start ? { start } : {}), ...(end ? { end } : {}) })

describe('snapshotSaves', () => {
  it('snapshots a new save from its pick, with its dates, and keeps the old moment on re-projection', () => {
    const picks = [pick('a', 'Sat 31 Oct · 20:00'), pick('b', 'Until Sun 31 Jan'), pick('c', 'Daily')]
    const first = snapshotSaves([], new Set(['a', 'b', 'c']), picks, NOW)
    expect(first.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(first[0]).toMatchObject({ title: 'a', when: 'Sat 31 Oct · 20:00', start: '2026-10-31', end: '2026-10-31', link: 'https://x.io/a' })
    expect(first[1]).toMatchObject({ start: '2027-01-31', end: '2027-01-31' })
    expect(first[2].start).toBeUndefined()
    const later = snapshotSaves(first, new Set(['a', 'b', 'c']), picks, new Date(NOW.getTime() + 864e5))
    expect(later).toEqual(first)                                        // `at` is the save moment, not the render
  })
  it('drops an unsaved id, keeps a saved one whose card rotated out, skips one with nothing to show', () => {
    const prev = [entry('gone', 'Sat 7 Nov', '2026-11-07', '2026-11-07')]
    const out = snapshotSaves(prev, new Set(['gone', 'ghost']), [pick('x', 'Sat 31 Oct')], NOW)
    expect(out).toEqual(prev)                                           // 'gone' kept from its snapshot; 'ghost' has neither
    expect(snapshotSaves(prev, new Set(), [], NOW)).toEqual([])
  })
  it('an "Opens … until …" run files by its opening day (firstDateOf), not null', () => {
    expect(firstDateOf('Opens Sat 14 Nov · until Sun 31 Jan', NOW)?.getDate()).toBe(14)
    const [e] = snapshotSaves([], new Set(['r']), [pick('r', 'Opens Sat 14 Nov · until Sun 31 Jan')], NOW)
    expect(e.start).toBe('2026-11-14')
    expect(e.end).toBe('2027-01-31')
  })
})

describe('the Later shelf', () => {
  it('this weekend, undated and recurring stay the plan; next weekend and open runs go later', () => {
    expect(shelfOf(entry('a', 'Sat 31 Oct', '2026-10-31', '2026-10-31'), NOW)).toBe('weekend')
    expect(shelfOf(entry('b', 'Sun 1 Nov', '2026-11-01', '2026-11-01'), NOW)).toBe('weekend')
    expect(shelfOf(entry('c', 'Daily'), NOW)).toBe('weekend')
    expect(shelfOf(entry('d', 'Sat 7 Nov', '2026-11-07', '2026-11-07'), NOW)).toBe('later')
    expect(shelfOf(entry('e', 'Until Sun 31 Jan', '2027-01-31', '2027-01-31'), NOW)).toBe('later')
    expect(shelfOf(entry('f', 'Until Sun 1 Nov', '2026-11-01', '2026-11-01'), NOW)).toBe('weekend')   // a run that ends this weekend IS this weekend
    expect(shelfOf(entry('g', 'Fri 30 Oct – Sun 8 Nov', '2026-10-30', '2026-11-08'), NOW)).toBe('weekend')   // starts now, runs on
  })
  it('sorts soonest first — a run by its end, the deadline', () => {
    const shelf = laterShelf([
      entry('jan', 'Until Sun 31 Jan', '2027-01-31', '2027-01-31'),
      entry('nov14', 'Sat 14 Nov', '2026-11-14', '2026-11-14'),
      entry('now', 'Sat 31 Oct', '2026-10-31', '2026-10-31'),
      entry('nov7', 'Sat 7 Nov', '2026-11-07', '2026-11-07'),
      entry('dec', 'Opens Sat 5 Dec · until Sun 10 Jan', '2026-12-05', '2027-01-10'),
    ], NOW)
    expect(shelf.map((e) => e.id)).toEqual(['nov7', 'nov14', 'dec', 'jan'])
  })
})

describe('the arrival pill', () => {
  const lastMonth = new Date(2026, 8, 20).getTime()
  const st = (saves: SaveEntry[], later: AccountState['later'] = {}) => ({ saves, later })
  it('shows for a save made in an earlier week whose day is this weekend, once per week', () => {
    const e = entry('a', 'Sat 31 Oct', '2026-10-31', '2026-10-31', lastMonth)
    expect(arriving(st([e]), NOW).map((x) => x.id)).toEqual(['a'])
    expect(arriving(st([e], { a: { seen: weekOf(NOW.getTime()) } }), NOW)).toEqual([])        // dismissed this week
    expect(arriving(st([e], { a: { seen: weekOf(NOW.getTime()) - 1 } }), NOW).length).toBe(1)   // dismissed some other week
  })
  it('stays quiet for a save made this week, a day still weeks off, a day gone by, or no day at all', () => {
    expect(arriving(st([entry('a', 'Sat 31 Oct', '2026-10-31', '2026-10-31', NOW.getTime() - 3600e3)]), NOW)).toEqual([])
    expect(arriving(st([entry('b', 'Sat 14 Nov', '2026-11-14', '2026-11-14', lastMonth)]), NOW)).toEqual([])
    expect(arriving(st([entry('c', 'Sat 24 Oct', '2026-10-24', '2026-10-24', lastMonth)]), NOW)).toEqual([])
    expect(arriving(st([entry('d', 'Daily', undefined, undefined, lastMonth)]), NOW)).toEqual([])
    expect(arriving(st([entry('e', 'Wed 28 Oct', '2026-10-28', '2026-10-28', lastMonth)]), NOW).length).toBe(1)   // today counts
  })
})

describe('did you go?', () => {
  it('asks about a finished save within three weeks, newest first, and not twice', () => {
    const saves = [
      entry('old', 'Sat 3 Oct', '2026-10-03', '2026-10-03'),            // 25 days ago — too long to remember honestly
      entry('last', 'Sat 24 Oct', '2026-10-24', '2026-10-24'),
      entry('run', 'Until Sun 25 Oct', undefined, '2026-10-25'),
      entry('soon', 'Sat 31 Oct', '2026-10-31', '2026-10-31'),
      entry('today', 'Wed 28 Oct', '2026-10-28', '2026-10-28'),         // not over yet
      entry('done', 'Sun 18 Oct', '2026-10-18', '2026-10-18'),
    ]
    const out = lookBack({ saves, went: { done: { went: true, at: 1 } } }, NOW)
    expect(out.map((e) => e.id)).toEqual(['run', 'last'])
  })
})

describe('the merge', () => {
  const doc = (over: Partial<AccountState>): AccountState => ({ ...emptyState(), ...over })
  const wk = weekOf(NOW.getTime())
  it('unions saves (earliest moment wins), fills missing dates, and is idempotent', () => {
    const phone = doc({ updatedAt: 200, saves: [entry('a', 'Sat 31 Oct', undefined, undefined, 50), entry('b', 'Sat 7 Nov', '2026-11-07', '2026-11-07', 60)] })
    const laptop = doc({ updatedAt: 100, saves: [entry('a', 'Sat 31 Oct', '2026-10-31', '2026-10-31', 40), entry('c', 'Daily', undefined, undefined, 70)] })
    const m = mergeState(phone, laptop)
    expect(m.saves.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(m.saves[0]).toMatchObject({ at: 40, start: '2026-10-31', end: '2026-10-31' })
    expect(mergeState(m, laptop)).toEqual(m)
    expect(mergeState(phone, laptop)).toEqual(mergeState(laptop, phone))
  })
  it('taste: the newer document wins a shared token; each keeps what only it learned; never summed', () => {
    const phone = doc({ updatedAt: 200, taste: { 'cat:eat': 3, 'area:west': 1 } })
    const laptop = doc({ updatedAt: 100, taste: { 'cat:eat': 1, 'cat:art': 2 } })
    expect(mergeState(phone, laptop).taste).toEqual({ 'cat:eat': 3, 'area:west': 1, 'cat:art': 2 })
    expect(mergeState(laptop, phone).taste).toEqual({ 'cat:eat': 3, 'area:west': 1, 'cat:art': 2 })
    const twice = mergeState(mergeState(phone, laptop), phone)
    expect(twice.taste['cat:eat']).toBe(3)
  })
  it('declines: union within a week, the newer week otherwise', () => {
    expect(mergeState(doc({ declines: { w: wk, ids: ['x'] } }), doc({ declines: { w: wk, ids: ['y', 'x'] } })).declines).toEqual({ w: wk, ids: ['x', 'y'] })
    expect(mergeState(doc({ declines: { w: wk - 1, ids: ['old'] } }), doc({ declines: { w: wk, ids: ['new'] } })).declines).toEqual({ w: wk, ids: ['new'] })
  })
  it('answers are deliberate: the later one wins; seen weeks take the max; versions take the max', () => {
    const a = doc({ version: 4, updatedAt: 10, went: { p: { went: false, at: 5 } }, later: { q: { seen: 10 } } })
    const b = doc({ version: 6, updatedAt: 20, went: { p: { went: true, at: 9 }, r: { went: true, at: 1 } }, later: { q: { seen: 8 }, s: {} } })
    const m = mergeState(a, b)
    expect(m.went).toEqual({ p: { went: true, at: 9 }, r: { went: true, at: 1 } })
    expect(m.later).toEqual({ q: { seen: 10 }, s: {} })
    expect(m.version).toBe(6)
    expect(m.updatedAt).toBe(20)
  })
  it('fingerprint ignores the server stamps', () => {
    const a = doc({ version: 1, updatedAt: 5, taste: { x: 1 } })
    expect(fingerprint(a)).toBe(fingerprint({ ...a, version: 9, updatedAt: 99 }))
    expect(fingerprint(a)).not.toBe(fingerprint({ ...a, taste: { x: 2 } }))
  })
})
