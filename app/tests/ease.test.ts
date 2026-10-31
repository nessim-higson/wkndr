// EASE — weather/ease.ts: the pane's changes dissolve on a curve at rest at both ends, and a change
// asked for mid-dissolve continues from what is showing — the "never pops" contract.
import { describe, it, expect } from 'bun:test'
import { Eased, smoother } from '../src/weather/ease'

describe('smootherstep', () => {
  it('rests at both ends and climbs monotonically between them', () => {
    expect(smoother(0)).toBe(0); expect(smoother(1)).toBe(1)
    expect(smoother(-1)).toBe(0); expect(smoother(2)).toBe(1)
    expect(smoother(.5)).toBeCloseTo(.5, 9)
    let prev = 0
    for (let i = 1; i <= 100; i++) { const v = smoother(i / 100); expect(v).toBeGreaterThanOrEqual(prev); prev = v }
    // zero velocity at the ends: the first and last percent move almost nothing
    expect(smoother(.01)).toBeLessThan(1e-4); expect(1 - smoother(.99)).toBeLessThan(1e-4)
  })
})

describe('an eased set of values', () => {
  it('starts where it was, lands where it was sent, and is done when it says so', () => {
    const e = new Eased([0, 1])
    e.set([1, 0], 1000, 10_000)
    expect(Array.from(e.at(10_000))).toEqual([0, 1])
    expect(e.active(10_500)).toBe(true)
    const mid = e.at(10_500)
    expect(mid[0]).toBeCloseTo(.5, 6); expect(mid[1]).toBeCloseTo(.5, 6)
    expect(Array.from(e.at(11_000))).toEqual([1, 0])
    expect(e.active(11_000)).toBe(false)
  })
  it('retargeted mid-flight, it continues from the value showing — no jump back, no jump forward', () => {
    const e = new Eased([0])
    e.set([1], 1000, 0)
    const showing = e.at(300)[0]
    e.set([0], 1000, 300)
    expect(e.at(300)[0]).toBeCloseTo(showing, 6)
    expect(e.at(301)[0]).toBeCloseTo(showing, 3)   // the new dissolve starts at rest
    expect(e.at(1300)[0]).toBe(0)
  })
  it('a jump lands at once; the target is readable', () => {
    const e = new Eased([.5])
    e.set([1], 5000, 0)
    e.jump([.25])
    expect(e.at(1)[0]).toBe(.25)
    expect(e.active(1)).toBe(false)
    e.set([.75], 100, 1)
    expect(e.target[0]).toBe(.75)
  })
})
