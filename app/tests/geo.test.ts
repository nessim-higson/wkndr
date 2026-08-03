// THE GEO LAYER (V.11) — resolution coverage, the distance model, and the two invariants
// that keep hyper-local honest: near-me never empties the deck, and we never guess a place.
//
// Coverage is asserted against the REAL published feed, so a pipeline change that starts
// stamping coords (or a refresh that renames venues) shows up here rather than as silently
// worse distances in someone's hand.

import { describe, expect, test } from 'bun:test'
import {
  DISTRICTS, districtOf, resolveGeo, routeTo, routeFor, nearScore, trainMinutes,
  displayMinutes, haversineKm, bikeMinutes, originAt, ORIGIN_PRESETS, IJ_LAT,
  type Origin,
} from '../src/lib/geo'
import type { Pick } from '../src/types'
import feed from '../public/data/picks.amsterdam.json'

const CS: Origin = ORIGIN_PRESETS.centraal
const NOORD: Origin = ORIGIN_PRESETS.noord
const picks = (feed as { picks: Pick[] }).picks

const mk = (over: Partial<Pick>): Pick => ({
  id: 't', title: 'T', venue: 'V', area: '', when: 'Sat', category: 'out', freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'S', link: '#',
  weatherFit: ['HOT'], ...over,
})

describe('districtOf — reads the feed’s own area strings', () => {
  test('the compass basics', () => {
    expect(districtOf('Noord')).toBe('Noord')
    expect(districtOf('Zuid (De Pijp)')).toBe('De Pijp')
    expect(districtOf('Amsterdam-Zuidoost')).toBe('Zuidoost')
    expect(districtOf('West (Oud-West)')).toBe('West')
  })
  test('Centrum landmarks beat the generic compass tokens', () => {
    // "Oosterdok" is Centrum, not Oost — the ordering bug this test exists to prevent
    expect(districtOf('Oosterdok')).toBe('Centrum')
    expect(districtOf('Keizersgracht')).toBe('Centrum')
    expect(districtOf('Centrum (Leidseplein)')).toBe('Centrum')
    expect(districtOf('Museumplein')).toBe('Zuid')
  })
  test('WE DO NOT GUESS: a bare city name is not a district', () => {
    expect(districtOf('Amsterdam')).toBeNull()
    expect(districtOf('')).toBeNull()
    expect(districtOf(undefined)).toBeNull()
    expect(districtOf('Citywide')).toBeNull()
  })
})

describe('resolveGeo', () => {
  test('pins a known venue by name, and flags the north bank', () => {
    const p = resolveGeo(mk({ venue: 'Pllek', area: 'Noord' }))
    expect(p.kind).toBe('pin')
    expect(p.district).toBe('Noord')
    expect(p.north).toBe(true)
  })
  test('falls back to a district centroid, MARKED approximate', () => {
    const p = resolveGeo(mk({ venue: 'Some New Bar', area: 'Zuid' }))
    expect(p.kind).toBe('approx')
    expect(p.district).toBe('Zuid')
  })
  test('unknown stays unknown — no invented coordinates', () => {
    const p = resolveGeo(mk({ venue: 'Mystery Club', area: 'Amsterdam' }))
    expect(p.kind).toBe('unknown')
    expect(p.district).toBeNull()
    expect(p.lat).toBeUndefined()
  })
  test('day-trips carry the travel time from their own area string', () => {
    expect(resolveGeo(mk({ category: 'daytrip', area: 'Day-trip · ~25 min by train' })).train).toBe(25)
    expect(trainMinutes('Kaatsheuvel · ~1h15')).toBe(75)
    expect(trainMinutes('nothing parseable')).toBe(45)
  })
  test('citywide events are citywide, not somewhere', () => {
    expect(resolveGeo(mk({ venue: 'Diverse locations' })).kind).toBe('citywide')
  })
  test('feed-stamped coordinates WIN over the gazetteer (pipeline forward-compat)', () => {
    const p = resolveGeo(mk({ venue: 'Pllek', area: 'Noord', lat: 52.36, lon: 4.89 }))
    expect(p.kind).toBe('pin')
    expect(p.lat).toBe(52.36)
    expect(p.north).toBe(false)   // derived from the stamped latitude, not the old flag
  })
})

describe('the distance model', () => {
  test('haversine + bike minutes are in the right ballpark', () => {
    // Centraal → Rijksmuseum is ~2.2km crow-flies, ~10-12 min by bike with the detour factor
    const km = haversineKm(CS, { lat: 52.3600, lon: 4.8852 })
    expect(km).toBeGreaterThan(1.9)
    expect(km).toBeLessThan(2.6)
    const m = bikeMinutes(CS, { lat: 52.3600, lon: 4.8852 })
    expect(m).toBeGreaterThan(8)
    expect(m).toBeLessThan(15)
  })
  test('rounds UP to fives — the model does not deserve single-minute precision', () => {
    expect(displayMinutes(3)).toBe('~5 min')
    expect(displayMinutes(11)).toBe('~15 min')
    expect(displayMinutes(15)).toBe('~15 min')
  })

  test('THE IJ: crossing costs a ferry, and crow-flies alone would lie', () => {
    // Tolhuistuin is ~700m from Centraal as the crow flies but there is water in between.
    const tolhuis = mk({ venue: 'Tolhuistuin', area: 'Noord' })
    const place = resolveGeo(tolhuis)
    const crow = bikeMinutes(CS, { lat: place.lat!, lon: place.lon! })
    const real = routeTo(place, CS)
    expect(crow).toBeLessThan(5)             // the lie
    expect(real.mins).toBeGreaterThan(8)     // the truth
    expect(real.label).toContain('ferry')
    expect(real.detail).toContain('Buiksloterweg')
  })
  test('no ferry when both sides are the same bank', () => {
    const r = routeTo(resolveGeo(mk({ venue: 'Paradiso', area: 'Centrum' })), CS)
    expect(r.label).toContain('bike')
    expect(r.label).not.toContain('ferry')
  })
  test('the same pick is CLOSER from Noord than from Centraal', () => {
    const pllek = mk({ venue: 'Pllek', area: 'Noord' })
    expect(routeFor(pllek, NOORD).mins).toBeLessThan(routeFor(pllek, CS).mins)
  })
  test('unknown places show no distance rather than a wrong one', () => {
    const r = routeFor(mk({ venue: 'Mystery Club', area: 'Amsterdam' }), CS)
    expect(r.label).toBe('')
    expect(r.detail).toBeNull()
    expect(r.mins).toBe(Infinity)   // sorts last, claims nothing
  })
  test('no origin, no claims', () => {
    expect(routeFor(mk({ venue: 'Pllek' }), null).label).toBe('')
  })
  test('originAt reads the IJ from latitude for a user position', () => {
    expect(originAt(IJ_LAT + 0.01, 4.9).north).toBe(true)
    expect(originAt(IJ_LAT - 0.01, 4.9).north).toBe(false)
  })
})

describe('nearScore — a sort weight, never a gate', () => {
  test('closer scores higher, and nothing ever scores below zero', () => {
    const near = nearScore(mk({ venue: 'Pllek', area: 'Noord' }), NOORD)
    const far = nearScore(mk({ venue: 'Pllek', area: 'Noord' }), CS)
    expect(near).toBeGreaterThan(far)
    expect(far).toBeGreaterThanOrEqual(0)
  })
  test('day-trips, citywide and unknown are neutral — not punished', () => {
    expect(nearScore(mk({ category: 'daytrip', area: 'Day-trip · ~30 min' }), CS)).toBe(0)
    expect(nearScore(mk({ venue: 'Diverse locations' }), CS)).toBe(0)
    expect(nearScore(mk({ venue: 'Mystery', area: 'Amsterdam' }), CS)).toBe(0)
  })
  test('stays UNDER the weather term so weather remains the thesis', () => {
    const most = Math.max(...picks.map((p) => nearScore(p, CS)))
    expect(most).toBeLessThan(10)
  })
  test('inert without a location grant', () => {
    expect(nearScore(mk({ venue: 'Pllek' }), null)).toBe(0)
  })
})

describe('the live feed — coverage and the pool shape', () => {
  test('most of the feed resolves to a real pin', () => {
    const kinds = picks.map((p) => resolveGeo(p).kind)
    const pinned = kinds.filter((k) => k === 'pin').length
    // 62/80 when V.11 was cut. A refresh may move this a little; a COLLAPSE means the
    // gazetteer has drifted from the feed's venue names and needs a look.
    expect(pinned / picks.length).toBeGreaterThan(0.6)
  })
  test('every resolved district is one we actually offer', () => {
    for (const p of picks) {
      const d = resolveGeo(p).district
      if (d) expect([...DISTRICTS, 'Citywide']).toContain(d)
    }
  })
  test('THE POOL SHAPE: evergreen outnumbers dated, so weekend-only must never hard-gate alone', () => {
    const dated = picks.filter((p) => p.freshness === 'weekend' || p.freshness === 'new').length
    const evergreen = picks.filter((p) => p.freshness === 'always').length
    expect(evergreen).toBeGreaterThan(dated)
  })
  test('near-me REORDERS the deck without removing anything', () => {
    const before = picks.length
    const scored = picks.map((p) => ({ p, s: nearScore(p, NOORD) }))
    expect(scored.length).toBe(before)          // nothing dropped
    expect(scored.some((x) => x.s > 0)).toBe(true)   // and it actually does something
  })
})
