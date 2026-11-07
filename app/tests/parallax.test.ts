// PARALLAX — weather/parallax.ts: a tilt is a move, not a pose; the pointer's place is a direction.
import { describe, it, expect } from 'bun:test'
import { TiltRest, pointerParallax } from '../src/weather/parallax'

describe('the tilt', () => {
  it('the first reading is the rest pose and moves nothing', () => {
    const t = new TiltRest()
    expect(t.read(60, 0, 0)).toEqual([0, 0])
  })
  it('a quick tilt from rest is a parallax in its direction, bounded', () => {
    const t = new TiltRest()
    t.read(60, 0, 0)
    const [x, y] = t.read(60, 8, .016)
    expect(x).toBeCloseTo(.5, 1); expect(y).toBeCloseTo(0, 2)
    const [bx, by] = t.read(90, -40, .016)
    expect(bx).toBe(-1); expect(by).toBe(1)
  })
  it('held at the new angle, the rest pose follows and the sky settles back', () => {
    const t = new TiltRest()
    t.read(60, 0, 0)
    let x = 0
    for (let i = 0; i < 60 * 20; i++) [x] = t.read(60, 10, 1 / 60)   // 20 s at 60 Hz, held still
    expect(Math.abs(x)).toBeLessThan(.02)
  })
  it('a phone past vertical or face down is ignored, not lurched', () => {
    const t = new TiltRest()
    t.read(60, 0, 0)
    expect(t.read(120, 30, .016)).toEqual([0, 0])
    expect(t.read(-150, 30, .016)).toEqual([0, 0])
    expect(t.read(NaN, 30, .016)).toEqual([0, 0])
  })
})

describe('the pointer', () => {
  it('centre is nothing, the corners are the bounds, up is positive', () => {
    expect(pointerParallax(200, 100, 400, 200)).toEqual([0, 0])
    expect(pointerParallax(400, 0, 400, 200)).toEqual([1, 1])
    expect(pointerParallax(0, 200, 400, 200)).toEqual([-1, -1])
    expect(pointerParallax(10, 10, 0, 0)).toEqual([0, 0])
  })
})
