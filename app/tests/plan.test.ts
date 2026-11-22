// THE TWO PILES (src/lib/plan.ts): this weekend vs the library. Pinned:
//   1. With no pills, a save sits where the Later-shelf rule puts it (dates decide).
//   2. A pill moves a save for THIS weekend; moving it back clears the override (no no-ops kept).
//   3. The library sorts soonest first; "Next weekend" names the one that comes round next.
//   4. A stored plan belongs to one weekend — read on the next, it's gone.
import { describe, it, expect, beforeEach } from 'bun:test'
import { pileOf, movePile, libraryShelf, isOver, arrivesLabel, emptyPlan, weekendKey, loadPlan, persistPlan, KEY_PLAN } from '../src/lib/plan'
import type { SaveEntry } from '../src/lib/account'

// a Wednesday — the served weekend is Sat 31 Oct + Sun 1 Nov 2026
const NOW = new Date(2026, 9, 28, 14, 0)
const NEXT_WEEK = new Date(2026, 10, 4, 14, 0)
const entry = (id: string, when: string, start?: string, end?: string, at = NOW.getTime()): SaveEntry =>
  ({ id, title: id, when, at, ...(start ? { start } : {}), ...(end ? { end } : {}) })

const sat = entry('sat', 'Sat 31 Oct · 20:00', '2026-10-31', '2026-10-31')
const daily = entry('daily', 'Daily')
const run = entry('run', 'Until Sun 20 Dec', '2026-10-28', '2026-12-20')
const next = entry('next', 'Sat 7 Nov', '2026-11-07', '2026-11-07')
const far = entry('far', 'Sat 28 Nov', '2026-11-28', '2026-11-28')

describe('pileOf', () => {
  it('without a pill, the date decides: this weekend and undated → weekend; later and open runs → library', () => {
    const plan = emptyPlan(NOW)
    expect(pileOf(sat, plan, NOW)).toBe('weekend')
    expect(pileOf(daily, plan, NOW)).toBe('weekend')
    expect(pileOf(run, plan, NOW)).toBe('library')
    expect(pileOf(next, plan, NOW)).toBe('library')
  })
})

describe('movePile', () => {
  it('pulls a run into the weekend, pushes an evergreen out, and moving back clears the override', () => {
    let plan = movePile(emptyPlan(NOW), run, 'weekend', NOW)
    expect(pileOf(run, plan, NOW)).toBe('weekend')
    expect(plan.add).toEqual(['run'])
    plan = movePile(plan, daily, 'library', NOW)
    expect(pileOf(daily, plan, NOW)).toBe('library')
    expect(plan.drop).toEqual(['daily'])
    plan = movePile(plan, run, 'library', NOW)
    plan = movePile(plan, daily, 'weekend', NOW)
    expect(plan).toEqual(emptyPlan(NOW))                                   // nothing left to remember
  })
  it('a second move of the same save replaces the first, never doubles it', () => {
    const plan = movePile(movePile(emptyPlan(NOW), run, 'weekend', NOW), run, 'weekend', NOW)
    expect(plan.add).toEqual(['run'])
  })
})

describe('libraryShelf + arrivesLabel', () => {
  it('lists the library soonest first, pushed-out evergreens last, and names next weekend', () => {
    const plan = movePile(emptyPlan(NOW), daily, 'library', NOW)
    const lib = libraryShelf([far, daily, run, sat, next], plan, NOW)
    expect(lib.map((e) => e.id)).toEqual(['next', 'far', 'run', 'daily'])
    expect(arrivesLabel(next, NOW)).toBe('Next weekend')
    expect(arrivesLabel(far, NOW)).toBeNull()
    expect(arrivesLabel(run, NOW)).toBeNull()
    expect(arrivesLabel(daily, NOW)).toBeNull()
  })
})

describe('the two tabs add up to every save', () => {
  // Ness, 22 Nov 2026: "I only see a few things in the list — how do I access the longer list?" The star
  // said five; the plan tab showed three; two finished Saturdays sat in neither tab.
  const gone1 = entry('gone1', 'Sat 17 Oct', '2026-10-17', '2026-10-17')
  const gone2 = entry('gone2', 'Sun 25 Oct', '2026-10-25', '2026-10-25')
  const rotated = entry('rotated', 'Daily')            // an evergreen the feed no longer carries
  const bare = entry('web-iams-old-card', '')
  it('a finished save is over; one on today or ahead is not', () => {
    expect(isOver(gone1, NOW)).toBe(true)
    expect(isOver(entry('today', 'Wed 28 Oct', '2026-10-28', '2026-10-28'), NOW)).toBe(false)
    expect(isOver(run, NOW)).toBe(false)
    expect(isOver(daily, NOW)).toBe(false)
  })
  it('the library holds what the plan cannot show: finished days and cards out of this week’s pool', () => {
    const live = new Set(['sat', 'daily', 'run', 'next'])
    const all = [gone1, sat, rotated, daily, run, gone2, next, bare]
    const lib = libraryShelf(all, emptyPlan(NOW), NOW, live)
    // to come (soonest first) → any week (oldest save first) → been and gone (most recent first)
    expect(lib.map((e) => e.id)).toEqual(['next', 'run', 'rotated', 'web-iams-old-card', 'gone2', 'gone1'])
    const planTab = all.filter((e) => live.has(e.id) && !lib.includes(e))
    expect(planTab.map((e) => e.id)).toEqual(['sat', 'daily'])
    expect(planTab.length + lib.length).toBe(all.length)
  })
  it('a finished save stays in the library even while its card is still in the pool', () => {
    expect(libraryShelf([gone1], emptyPlan(NOW), NOW, new Set(['gone1'])).map((e) => e.id)).toEqual(['gone1'])
  })
})

describe('the plan belongs to one weekend', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
    }
  })
  it('round-trips for the weekend it was made for and resets on the next', () => {
    const plan = movePile(emptyPlan(NOW), run, 'weekend', NOW)
    persistPlan(plan)
    expect(JSON.parse(store.get(KEY_PLAN)!).wk).toBe(weekendKey(NOW))
    expect(loadPlan(NOW)).toEqual(plan)
    expect(loadPlan(NEXT_WEEK)).toEqual(emptyPlan(NEXT_WEEK))
  })
  it('an unreadable store is a fresh plan, not a crash', () => {
    store.set(KEY_PLAN, '{not json')
    expect(loadPlan(NOW)).toEqual(emptyPlan(NOW))
  })
})
