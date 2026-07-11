// V.9.3 — "More like this": the detail sheet's super-weighted taste signal
// (applyMoreLikeThis / revertMoreLikeThis in src/taste.ts) and the likeness re-deal
// (moreLikeOrder in src/weather/modes.ts). Encodes the spec's invariants: stronger than a
// save, undo-symmetric like revertSwipe, same-category first / same-area second / weather
// still dominant, and the endless deck never truncates.
import { describe, it, expect } from 'bun:test'
import { applyMoreLikeThis, revertMoreLikeThis, applySwipe, tokensFor, hasTaste } from '../src/taste'
import { moreLikeOrder } from '../src/weather/modes'
import type { Pick, Category, Mode } from '../src/types'

const ALL: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const P = (o: Partial<Pick> & { id: string }): Pick => ({
  title: o.id, venue: 'V', area: 'Centrum', when: 'Sat 11 Jul', category: 'eat' as Category, freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'S', link: 'https://x.example',
  weatherFit: ALL, ...o,
})

describe('applyMoreLikeThis — the super-weighted signal', () => {
  it('outweighs a save on every token (stronger than the strongest swipe)', () => {
    const p = P({ id: 'ref' })
    const savedT = applySwipe({}, p, 'save')
    const moreT = applyMoreLikeThis({}, p)
    for (const tok of tokensFor(p)) {
      expect(moreT[tok]).toBeGreaterThan(savedT[tok])
    }
  })

  it('accumulates on top of an existing profile (adds, never overwrites)', () => {
    const p = P({ id: 'ref' })
    const before = applySwipe({}, p, 'like')          // +1 per token
    const after = applyMoreLikeThis(before, p)
    for (const tok of tokensFor(p)) {
      expect(after[tok]).toBe(before[tok] + 3)
    }
  })

  it('revertMoreLikeThis is the exact inverse — a fresh profile ends genuinely empty', () => {
    const p = P({ id: 'ref' })
    const reverted = revertMoreLikeThis(applyMoreLikeThis({}, p), p)
    expect(hasTaste(reverted)).toBe(false)            // zeroed tokens dropped, like revertSwipe
    expect(reverted).toEqual({})
  })

  it('revert restores a pre-existing profile exactly (no residue on other tokens)', () => {
    const a = P({ id: 'a', category: 'live', area: 'Noord' })
    const ref = P({ id: 'ref' })
    const before = applySwipe(applySwipe({}, a, 'save'), ref, 'nope')
    const roundTrip = revertMoreLikeThis(applyMoreLikeThis(before, ref), ref)
    expect(roundTrip).toEqual(before)
  })
})

describe('moreLikeOrder — the likeness re-deal', () => {
  it('same category leads within the weather tier', () => {
    const ref = P({ id: 'ref', category: 'eat' })
    const kin = P({ id: 'kin', category: 'eat', area: 'Noord' })
    const other = P({ id: 'other', category: 'art', area: 'Noord' })
    expect(moreLikeOrder([other, kin, ref], ref, 'WARM')[0].id).toBe('kin')
  })

  it('same area is the second axis — a category match beats an area match', () => {
    const ref = P({ id: 'ref', category: 'eat', area: 'Jordaan' })
    const catMatch = P({ id: 'catMatch', category: 'eat', area: 'Oost' })
    const areaMatch = P({ id: 'areaMatch', category: 'art', area: 'Jordaan' })
    const out = moreLikeOrder([areaMatch, catMatch], ref, 'WARM')
    expect(out.map((p) => p.id)).toEqual(['catMatch', 'areaMatch'])
  })

  it('…and breaks ties between category matches', () => {
    const ref = P({ id: 'ref', category: 'eat', area: 'Jordaan' })
    const near = P({ id: 'near', category: 'eat', area: 'Jordaan' })
    const far = P({ id: 'far', category: 'eat', area: 'Oost' })
    expect(moreLikeOrder([far, near], ref, 'WARM')[0].id).toBe('near')
  })

  it('weather stays dominant — a weather-fit stranger beats a rain-day twin', () => {
    const ref = P({ id: 'ref', category: 'eat', area: 'Jordaan', weatherFit: ['WARM'] })
    const twin = P({ id: 'twin', category: 'eat', area: 'Jordaan', weatherFit: ['COLD_WET'] })
    const stranger = P({ id: 'stranger', category: 'art', area: 'Oost', weatherFit: ['WARM'] })
    expect(moreLikeOrder([twin, stranger], ref, 'WARM')[0].id).toBe('stranger')
  })

  it('finer shared tokens (outdoor/kids/source) break ties inside a tier', () => {
    const ref = P({ id: 'ref', category: 'eat', outdoor: true, kid: true, weatherFit: ['WARM'] })
    const closer = P({ id: 'closer', category: 'art', area: 'Oost', outdoor: true, kid: true, weatherFit: ['WARM'] })
    const flatter = P({ id: 'flatter', category: 'live', area: 'Oost', weatherFit: ['WARM'] })
    expect(moreLikeOrder([flatter, closer], ref, 'WARM')[0].id).toBe('closer')
  })

  it('drops the reference (its sheet was just read), keeps everyone else — endless never truncates', () => {
    const ref = P({ id: 'ref' })
    const rest = ['a', 'b', 'c', 'd'].map((id, i) => P({ id, category: (['art', 'live', 'out', 'shop'] as Category[])[i] }))
    const out = moreLikeOrder([rest[0], ref, rest[1], rest[2], rest[3]], ref, 'WARM')
    expect(out.length).toBe(4)
    expect(new Set(out.map((p) => p.id))).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('is a STABLE reorder — equal likeness keeps the incoming rank order', () => {
    const ref = P({ id: 'ref', category: 'eat', area: 'Jordaan' })
    const ranked = ['first', 'second', 'third'].map((id) => P({ id, category: 'art', area: 'Oost' }))
    expect(moreLikeOrder(ranked, ref, 'WARM').map((p) => p.id)).toEqual(['first', 'second', 'third'])
  })
})
