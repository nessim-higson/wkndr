// THE PANE — the recipe half of the weather glass (weather/wetglass.ts). The shader cannot run
// here; what can be pinned is the contract it renders from: every scene has a plate and a wetness
// inside the ranges the shader expects, a dry sky is actually dry, and the bead layout is stable
// for a session but not for a lifetime.
import { describe, it, expect } from 'bun:test'
import { WET_RECIPES, seedForNow, plateFor, gradeOn } from '../src/weather/wetglass'
import { gradeFor } from '../src/weather/daylight'
import { GLASS_SCENES } from '../src/weather/glass'

describe('wet glass recipes', () => {
  it('every scene has a plate and in-range wetness', () => {
    for (const s of GLASS_SCENES) {
      const r = WET_RECIPES[s]
      expect(typeof r.plate).toBe('string')
      expect(r.plate.length).toBeGreaterThan(0)
      for (const k of ['wet', 'fog', 'snow'] as const) { expect(r[k]).toBeGreaterThanOrEqual(0); expect(r[k]).toBeLessThanOrEqual(1) }
      expect(r.mapScale).toBeGreaterThan(300)
      if (r.wet > 0) expect(typeof r.map).toBe('string'); else expect(r.map).toBeNull()
      expect(r.dim).toBeGreaterThan(.5); expect(r.dim).toBeLessThanOrEqual(1.1)
      expect(r.tint.length).toBe(3)
    }
  })
  it('a dry sky has no water on it; rain and storm are fully wet, the storm darker', () => {
    expect(WET_RECIPES.sunny.wet).toBe(0)
    expect(WET_RECIPES.sunny.map).toBeNull()
    expect(WET_RECIPES.sunny.fog).toBe(0)
    expect(WET_RECIPES.evening.wet).toBe(0)
    expect(WET_RECIPES.rain.wet).toBe(1)
    expect(WET_RECIPES.storm.wet).toBe(1)
    expect(WET_RECIPES.storm.map).not.toBe(WET_RECIPES.rain.map)   // heavier water, not the same photo darker
    expect(WET_RECIPES.storm.dim).toBeLessThan(WET_RECIPES.rain.dim)
  })
  it('fog is condensation with only fine water; snow is flakes in the air, not on the pane', () => {
    expect(WET_RECIPES.mist.fog).toBeGreaterThan(.7)
    expect(WET_RECIPES.mist.wet).toBeLessThan(.5)
    expect(WET_RECIPES.snow.snow).toBe(1)
    for (const s of GLASS_SCENES) if (s !== 'snow') expect(WET_RECIPES[s].snow).toBe(0)
  })
})

describe('the bead layout seed', () => {
  it('is the same within an hour and different on another day', () => {
    const a = seedForNow(new Date(2026, 8, 12, 14, 5)), b = seedForNow(new Date(2026, 8, 12, 14, 55))
    expect(a).toBe(b)
    expect(seedForNow(new Date(2026, 8, 13, 14, 5))).not.toBe(a)
    expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(1000)
  })
})

describe('the hour', () => {
  it('a clear sky swaps plates with the sun; every other sky keeps its plate and takes the grade', () => {
    const day = plateFor('sunny', 'day'), gold = plateFor('sunny', 'golden'), night = plateFor('sunny', 'night')
    expect(day.native).toBe(false); expect(gold.native).toBe(true); expect(night.native).toBe(true)
    expect(gold.recipe.plate).not.toBe(day.recipe.plate)
    expect(night.recipe.plate).not.toBe(gold.recipe.plate)
    expect(plateFor('sunny', 'dusk').recipe.plate).toBe(plateFor('sunny', 'dawn').recipe.plate)
    for (const s of GLASS_SCENES) if (s !== 'sunny' && s !== 'evening') {
      expect(plateFor(s, 'night').recipe.plate).toBe(WET_RECIPES[s].plate)
      expect(plateFor(s, 'night').native).toBe(false)
    }
    expect(plateFor('evening', 'day').native).toBe(true)   // the moon plate is a night whatever the clock says
  })
  it('rain at night is dark rain: the grade keeps the water and drops the light', () => {
    const n = gradeFor(-20)
    expect(gradeOn(n, false)).toEqual(n)
    const native = gradeOn(n, true)
    expect(native.gold + native.dusk + native.night).toBe(0)
    expect(native.light).toBeGreaterThan(n.light)
    expect(plateFor('rain', 'night').recipe.wet).toBe(1)
  })
  it('only wet scenes run, and the fog never does', () => {
    for (const s of GLASS_SCENES) { const r = WET_RECIPES[s]; if (r.wet === 0) expect(r.run).toBe(0); expect(r.run).toBeLessThanOrEqual(1) }
    expect(WET_RECIPES.rain.run).toBeGreaterThan(.5)
    expect(WET_RECIPES.mist.run).toBe(0)
  })
})
