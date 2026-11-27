// THE AIR — weather/air.ts: the forecast wind → the pane's lean. The shader cannot run here; the
// contract it reads from can be pinned: calm is still, a breeze is the full effect, a gale is no
// more than that, and the direction follows the south-facing window's convention.
import { describe, it, expect } from 'bun:test'
import { airFor, STILL_AIR } from '../src/weather/air'

describe('the air', () => {
  it('a calm day is still; nothing at all is still too', () => {
    expect(airFor(null)).toEqual(STILL_AIR)
    expect(airFor(undefined)).toEqual(STILL_AIR)
    expect(airFor({ speed: 0, dir: 270 })).toEqual(STILL_AIR)
    expect(airFor({ speed: 3, dir: 270 })).toEqual(STILL_AIR)
    expect(airFor({ speed: NaN, dir: 270 })).toEqual(STILL_AIR)
    expect(airFor({ speed: -5, dir: 270 })).toEqual(STILL_AIR)
  })
  it('a fresh breeze is the whole effect and a gale is no more than that', () => {
    expect(airFor({ speed: 30, dir: 270 }).force).toBe(1)
    expect(airFor({ speed: 90, dir: 270 }).force).toBe(1)
    const light = airFor({ speed: 12, dir: 270 }).force, moderate = airFor({ speed: 22, dir: 270 }).force
    expect(light).toBeGreaterThan(0); expect(light).toBeLessThan(moderate); expect(moderate).toBeLessThan(1)
  })
  it('looking south: a westerly pushes left, an easterly right, a northerly nowhere sideways', () => {
    expect(airFor({ speed: 30, dir: 270 }).x).toBeCloseTo(-1, 6)
    expect(airFor({ speed: 30, dir: 90 }).x).toBeCloseTo(1, 6)
    expect(airFor({ speed: 30, dir: 0 }).x).toBe(0)
    expect(airFor({ speed: 30, dir: 180 }).x).toBe(0)
    expect(airFor({ speed: 30, dir: 225 }).x).toBeCloseTo(-Math.SQRT1_2, 6)
  })
  it('the push is weighted by the force, so a light westerly is a light lean', () => {
    const a = airFor({ speed: 15, dir: 270 })
    expect(a.x).toBeCloseTo(-a.force, 6)
    expect(Math.abs(a.x)).toBeLessThan(1)
  })
})
