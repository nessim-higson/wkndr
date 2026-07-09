// Regression guard for src/weather/modes.ts — rankPicks (the runtime score) and diversify (the
// anti-clustering pass). Encodes the documented invariants: weather-fit beats jitter, corroborated
// ("most talked about") events lead their tier, evergreen sits below timely, no category waves.
import { describe, it, expect } from 'bun:test'
import { rankPicks, diversify } from '../src/weather/modes'
import type { Pick, Category, Mode } from '../src/types'

const ALL: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const P = (o: Partial<Pick> & { id: string }): Pick => ({
  title: o.id, venue: 'V', area: '', when: 'Sat 4 Jul', category: 'live' as Category, freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'S', link: 'https://x.example',
  weatherFit: ALL, ...o,
})

describe('rankPicks — score invariants', () => {
  it('weather-fit always beats the seed jitter (the modes.ts contract)', () => {
    const fit = P({ id: 'fit', weatherFit: ['WARM'] })
    const miss = P({ id: 'miss', weatherFit: ['HOT'] })
    for (const seed of [1, 7, 42]) {
      const out = rankPicks([miss, fit], 'WARM', undefined, seed)
      expect(out[0].id).toBe('fit')
    }
  })

  it('cross-source buzz up-levels within a tier (the "most talked about" signal)', () => {
    const talked = P({ id: 'talked', buzz: 3 })
    const single = P({ id: 'single' })
    expect(rankPicks([single, talked], 'WARM')[0].id).toBe('talked')
  })

  it('editorScore lifts the editorially-best pick', () => {
    const best = P({ id: 'best', editorScore: 9 })
    const meh = P({ id: 'meh', editorScore: 2 })
    expect(rankPicks([meh, best], 'WARM')[0].id).toBe('best')
  })

  it('real-draw popularity (RA attending) lifts within a tier', () => {
    const packed = P({ id: 'packed', popularity: 500 })
    const quiet = P({ id: 'quiet' })
    expect(rankPicks([quiet, packed], 'WARM')[0].id).toBe('packed')
  })

  it('evergreen sits below timely picks of the same tier', () => {
    const timely = P({ id: 'timely', freshness: 'weekend' })
    const always = P({ id: 'always', freshness: 'always' })
    expect(rankPicks([always, timely], 'WARM')[0].id).toBe('timely')
  })
})

describe('diversify — anti-clustering', () => {
  it('breaks up category runs when an alternative exists', () => {
    const input = [
      P({ id: 'a1', category: 'art' }), P({ id: 'a2', category: 'art' }),
      P({ id: 'e1', category: 'eat' }), P({ id: 'e2', category: 'eat' }),
    ]
    const out = diversify(input)
    let adjacentDupes = 0
    for (let i = 1; i < out.length; i++) if (out[i].category === out[i - 1].category) adjacentDupes++
    expect(adjacentDupes).toBe(0)   // art,eat,art,eat — never a wave
  })

  it('degrades gracefully when only one category remains', () => {
    const input = [P({ id: 'a1', category: 'art' }), P({ id: 'a2', category: 'art' })]
    expect(diversify(input).length).toBe(2)   // forced adjacency is allowed, nothing dropped
  })

  it('preserves the pool exactly (reorders, never truncates)', () => {
    const input = ['art', 'art', 'eat', 'live', 'live', 'live'].map((c, i) => P({ id: `p${i}`, category: c as Category }))
    const out = diversify(input)
    expect(out.length).toBe(input.length)
    expect(new Set(out.map((p) => p.id)).size).toBe(input.length)
  })
})

// V.8.7 — orderServed's time-gated 👑 tier: a TOP only OPENS the deck once its event is active
// by the end of the weekend being served. Pins the live 2026-07-08 defect: Milkshake (25–26 Jul)
// and Dekmantel (30 Jul–2 Aug) led the 11–12 Jul deck.
import { orderServed } from '../src/weather/modes'

describe('orderServed — the pile order, with the TOP weekend gate', () => {
  const END = new Date(2026, 6, 12, 23, 59, 59)   // Sun 12 Jul 2026 — end of the served weekend

  it('a TOP active this weekend opens the deck', () => {
    const top = P({ id: 'lemmeke', when: 'Opens 8 Jul', top: true })
    const mid = P({ id: 'mid' })
    expect(orderServed([mid, top], END)[0].id).toBe('lemmeke')
  })

  it('an undated / recurring TOP always opens the deck (ARTIS "Daily")', () => {
    const top = P({ id: 'artis', when: 'Daily · 9:00–18:00', top: true })
    const mid = P({ id: 'mid' })
    expect(orderServed([mid, top], END)[0].id).toBe('artis')
  })

  it('a future-dated TOP waits for its own weekend — heads the horizon at the back', () => {
    const milkshake = P({ id: 'milkshake', when: 'Sat 25 – Sun 26 Jul', top: true })
    const lead = P({ id: 'lead', lead: true })
    const mid = P({ id: 'mid' })
    const later = P({ id: 'later', later: true })
    const out = orderServed([milkshake, later, mid, lead], END)
    expect(out[0].id).toBe('lead')                          // LEAD takes over the open
    expect(out.map((p) => p.id)).toEqual(['lead', 'mid', 'later', 'milkshake'])
    expect(out.find((p) => p.id === 'milkshake')?.top).toBe(true)   // pill/status intact
  })

  it('ANY not-yet-active pick sinks to the horizon — TOPs head it (the WorldPride case)', () => {
    const pride = P({ id: 'pride', when: 'Sat 25 Jul – Sat 8 Aug' })            // future, no crown
    const dekmantel = P({ id: 'dekmantel', when: 'Thu 30 Jul – Sun 2 Aug', top: true })
    const mid = P({ id: 'mid' })
    const later = P({ id: 'later', later: true })
    const out = orderServed([pride, later, dekmantel, mid], END)
    expect(out.map((p) => p.id)).toEqual(['mid', 'later', 'dekmantel', 'pride'])
  })

  it('…and DOES lead once the served weekend reaches it', () => {
    const milkshake = P({ id: 'milkshake', when: 'Sat 25 – Sun 26 Jul', top: true })
    const ownWeekend = new Date(2026, 6, 26, 23, 59, 59)    // Sun 26 Jul
    expect(orderServed([P({ id: 'mid' }), milkshake], ownWeekend)[0].id).toBe('milkshake')
  })

  it('an already-running "Until …" TOP leads (end-anchored = underway)', () => {
    const expo = P({ id: 'expo', when: 'Until Sun 27 Sep', top: true })
    expect(orderServed([P({ id: 'mid' }), expo], END)[0].id).toBe('expo')
  })
})
