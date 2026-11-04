// ONBOARDING (phase 1) — the pure half: which cards it asks about, what each answer writes, the
// taste card, and when the flow shows at all. The component is a renderer over these.
import { describe, it, expect } from 'bun:test'
import type { Pick } from '../src/types'
import { tasteScore } from '../src/taste'
import { pickPairs, pickSwipes, applyPair, applyRoundSwipe, applyCompany, applyRain, revealOf, shouldOnboard } from '../src/onboarding'

const P = (id: string, category: Pick['category'], o: Partial<Pick> = {}): Pick => ({
  id, title: id, category, venue: '', area: '', when: '', freshness: 'weekend', outdoor: false, kid: false,
  price: '', blurb: '', why: '', source: '', link: '', weatherFit: [], image: `https://img/${id}.jpg`, ...o,
} as Pick)

const deck = [
  P('a1', 'art'), P('a2', 'art'), P('a3', 'art'), P('l1', 'live'), P('e1', 'eat'), P('m1', 'market', { outdoor: true }),
  P('n1', 'eat', { image: undefined }), P('o1', 'out', { outdoor: true }), P('d1', 'drink'), P('s1', 'stage'),
  P('l2', 'live'), P('e2', 'eat'), P('t1', 'daytrip'), P('sh', 'shop'), P('m2', 'market'),
]

describe('pickPairs', () => {
  const pairs = pickPairs(deck)
  it('makes up to six pairs, each half a different category', () => {
    expect(pairs.length).toBeGreaterThan(3)
    expect(pairs.length).toBeLessThanOrEqual(6)
    for (const p of pairs) expect(p.a.category).not.toBe(p.b.category)
  })
  it('never shows a card twice, never a card without a photo, and caps a category at two', () => {
    const ids = pairs.flatMap((p) => [p.a.id, p.b.id])
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('n1')
    const art = pairs.flatMap((p) => [p.a, p.b]).filter((p) => p.category === 'art')
    expect(art.length).toBeLessThanOrEqual(2)
  })
  it('ties each pair to a moment of the weekend', () => {
    expect(pairs[0].slot).toBe('Saturday, 11:00')
  })
})

describe('pickSwipes', () => {
  it('skips the cards already used in pairs and samples the categories', () => {
    const used = new Set(['a1', 'l1'])
    const s = pickSwipes(deck, used, 12)
    expect(s.map((p) => p.id)).not.toContain('a1')
    expect(new Set(s.map((p) => p.id)).size).toBe(s.length)
    expect(s.filter((p) => p.category === 'art').length).toBeLessThanOrEqual(3)
    expect(s.slice(0, 5).every((p) => !!p.image)).toBe(true)   // pictured first
  })
})

describe('what an answer writes', () => {
  const pair = { a: P('x', 'art'), b: P('y', 'live'), slot: '' }
  it('a pick is a stronger yes than a swipe, and a mild no to the other', () => {
    const t = applyPair({}, pair, 'a')
    expect(t['cat:art']).toBe(2)
    expect(t['cat:live']).toBe(-1)
  })
  it('a pair writes only what it is about, never the weather, source or area every card shares', () => {
    const t = applyPair({}, { a: P('x', 'market', { outdoor: true, weatherFit: ['WARM', 'COOL'], source: 'LBB' }), b: P('y', 'live'), slot: '' }, 'a')
    expect(Object.keys(t).sort()).toEqual(['cat:live', 'cat:market', 'outdoor'])
  })
  it('the swipe round uses the deck weights on the same focused tokens', () => {
    const p = P('r', 'art', { weatherFit: ['COOL'], source: 'Eye' })
    expect(applyRoundSwipe({}, p, 'save')).toEqual({ 'cat:art': 1.5 })
    expect(applyRoundSwipe({}, p, 'skip')).toEqual({})
  })
  it('both and neither are mild, and a balanced answer leaves no residue', () => {
    expect(applyPair({}, pair, 'both')['cat:live']).toBe(1)
    const back = applyPair(applyPair({}, pair, 'both'), pair, 'neither')
    expect(back).toEqual({})
  })
  it('kids is a soft boost the model can read; the rest wait in the profile', () => {
    expect(applyCompany({}, ['kids', 'partner']).kid).toBe(3)
    expect(applyCompany({}, ['partner', 'friends'])).toEqual({})
  })
  it('rain answers lean in the weather vocabulary, small enough that the forecast still leads', () => {
    expect(applyRain({}, 'stay')['wf:COLD_WET']).toBe(2)
    expect(applyRain({}, 'anyway').outdoor).toBe(1)
    expect(applyRain({ a: 1 }, null)).toEqual({ a: 1 })
    // a whole onboarding of yeses on one card can't outrank the weather term (~10)
    let t = {}
    const p = P('z', 'art', { weatherFit: ['COLD_WET'] })
    for (let i = 0; i < 6; i++) t = applyPair(t, { a: p, b: P('w' + i, 'live'), slot: '' }, 'a')
    expect(tasteScore(p, applyRain(t, 'stay'))).toBeLessThanOrEqual(6)
  })
})

describe('the taste card', () => {
  it('reads the headline off the top two categories', () => {
    const r = revealOf({ 'cat:art': 4, 'cat:live': 2, 'cat:eat': 1 }, { company: [], rain: null })
    expect(r.headline).toBe('Slow galleries, loud nights.')
    expect(r.bars[0]).toEqual({ label: 'Art', score: 78 })
    expect(r.bars.length).toBe(5)
  })
  it('says so honestly when there is nothing to read', () => {
    expect(revealOf({}, { company: [], rain: null }).headline).toBe('A bit of everything.')
  })
  it('bars stay inside the card, however strong the weight', () => {
    const r = revealOf({ 'cat:art': 40, 'cat:live': -40 }, { company: [], rain: null })
    expect(Math.max(...r.bars.map((b) => b.score))).toBe(96)
    expect(r.bars.map((b) => b.label)).not.toContain('Live music')   // the card shows what you're into, strongest first
    const all = revealOf({ 'cat:art': 9, 'cat:live': -40, 'cat:eat': -40, 'cat:drink': -40, 'cat:market': -40, 'cat:out': -40, 'cat:stage': -40, 'cat:daytrip': -40, 'cat:shop': -40 }, { company: [], rain: null })
    expect(Math.min(...all.bars.map((b) => b.score))).toBe(4)
  })
  it('turns the non-weight answers into traits', () => {
    const r = revealOf({ outdoor: 1 }, { company: ['partner', 'kids'], rain: 'indoors' })
    expect(r.traits).toEqual(['With a partner', 'Kids too', 'Rain → indoors', 'Outdoors when dry'])
  })
})

describe('shouldOnboard', () => {
  const base = { search: '', visits: 1, hasTaste: false, onboarded: false, shared: false, curate: false }
  it('shows on a first visit with no taste', () => expect(shouldOnboard(base)).toBe(true))
  it('never asks someone who already has a taste, has done it, or is back again', () => {
    expect(shouldOnboard({ ...base, hasTaste: true })).toBe(false)
    expect(shouldOnboard({ ...base, onboarded: true })).toBe(false)
    expect(shouldOnboard({ ...base, visits: 2 })).toBe(false)
  })
  it('stays out of a shared round and the curation door', () => {
    expect(shouldOnboard({ ...base, shared: true })).toBe(false)
    expect(shouldOnboard({ ...base, curate: true })).toBe(false)
  })
  it('?onboard=1 forces it, ?onboard=0 suppresses it', () => {
    expect(shouldOnboard({ ...base, visits: 9, hasTaste: true, search: '?onboard=1' })).toBe(true)
    expect(shouldOnboard({ ...base, search: '?onboard=0' })).toBe(false)
  })
})
