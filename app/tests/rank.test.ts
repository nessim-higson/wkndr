// Regression guard for src/weather/modes.ts — rankPicks (the runtime score) and diversify (the
// anti-clustering pass). Encodes the documented invariants: weather-fit beats jitter, corroborated
// ("most talked about") events lead their tier, evergreen sits below timely, no category waves.
import { describe, it, expect } from 'bun:test'
import { rankPicks, diversify, umbrellaOf, UMBRELLA_GAP } from '../src/weather/modes'
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

// V.9.3 — THE SUN BONUS: on a HOT/WARM weekend, an OUTDOOR pick dated THIS weekend leads its
// tier (the deck front matches the board's THIS WEEKEND × THIS WEATHER lens). Dates are built
// from the real upcoming weekend so the invariant holds whenever the suite runs.
import { upcomingWeekendEnd } from '../src/lib/when'

describe('rankPicks — the sun bonus', () => {
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const end = upcomingWeekendEnd()
  const sat = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
  const satStr = `Sat ${sat.getDate()} ${MONS[sat.getMonth()]}`   // the coming weekend's Saturday

  it('outdoor + dated this weekend beats an indoor twin on a HOT day — and not on a COOL one', () => {
    const openair = P({ id: 'openair', outdoor: true, when: satStr, weatherFit: ['HOT', 'WARM', 'COOL'] })
    const indoor = P({ id: 'indoor', outdoor: false, when: satStr, editorScore: 2 })
    expect(rankPicks([indoor, openair], 'HOT')[0].id).toBe('openair')
    expect(rankPicks([indoor, openair], 'COOL')[0].id).toBe('indoor')   // bonus is HOT/WARM only
  })

  it('a seasonal "All summer" venue takes no bonus — a concrete this-weekend date is required', () => {
    const seasonal = P({ id: 'seasonal', outdoor: true, when: 'All summer · evenings', freshness: 'always', weatherFit: ['HOT', 'WARM', 'COOL'] })
    const indoor = P({ id: 'indoor', outdoor: false, when: satStr, editorScore: 2 })
    expect(rankPicks([seasonal, indoor], 'HOT')[0].id).toBe('indoor')
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

// THE UMBRELLA (2026-10-23) — one festival, a dozen cards, never a wall. Pins the ADE weekend:
// the front of the 23–25 Oct deck was ADE in 7 of its first 11 slots.
describe('diversify — the umbrella gap', () => {
  const ADE = new Date(2026, 9, 23)   // Fri 23 Oct 2026 — inside ADE week
  const ade = (i: number) => P({ id: `ade${i}`, title: `Night ${i} x ADE`, category: 'live', when: 'Fri 23 Oct · 23:00' })
  it('keeps two cards of one umbrella at least UMBRELLA_GAP apart while alternatives exist', () => {
    const others: Category[] = ['art', 'market', 'stage', 'eat', 'out', 'shop', 'drink', 'daytrip', 'art', 'market', 'stage', 'eat']
    const input = [
      ...[1, 2, 3, 4, 5, 6].map(ade),      // the whole ADE block outranks everything else
      ...others.map((c, i) => P({ id: `o${i}`, category: c, when: 'Sat 24 Oct' })),   // 12 — room for every third slot
    ]
    const out = diversify(input)
    const at = out.map((p, i) => [p, i] as const).filter(([p]) => umbrellaOf(p, ADE) === 'ade').map(([, i]) => i)
    for (let k = 1; k < at.length; k++) expect(at[k] - at[k - 1]).toBeGreaterThan(UMBRELLA_GAP)
    expect(out[0].id).toBe('ade1')          // the festival still leads — it IS the weekend
    expect(out.length).toBe(input.length)   // reorders, never truncates
  })
  it('an RA club night dated inside ADE week counts as ADE without saying so', () => {
    const ra = P({ id: 'ra', title: 'fabric x Loud-Contact: Jeff Mills', source: 'Resident Advisor', category: 'live', when: 'Fri 23 Oct · 22:00' })
    expect(umbrellaOf(ra, ADE)).toBe('ade')
    const later = P({ id: 'ra2', title: 'Some night', source: 'Resident Advisor', category: 'live', when: 'Sat 31 Oct · 22:00' })
    expect(umbrellaOf(later, ADE)).toBeNull()
    const notRa = P({ id: 'x', title: 'Brass Rave Unit', source: 'I amsterdam', category: 'live', when: 'Sat 24 Oct · 20:30' })
    expect(umbrellaOf(notRa, ADE)).toBeNull()
  })
  it('names the other umbrellas by text, and nothing else', () => {
    expect(umbrellaOf(P({ id: 'a', title: 'IDFA: opening night' }))).toBe('idfa')
    expect(umbrellaOf(P({ id: 'b', title: 'Cinekid Festival 2026' }))).toBe('cinekid')
    expect(umbrellaOf(P({ id: 'c', title: 'Yayoi Kusama', blurb: 'A major retrospective.' }))).toBeNull()
  })
  it('degrades to forced adjacency when only one umbrella remains', () => {
    const out = diversify([1, 2, 3].map(ade))
    expect(out.map((p) => p.id)).toEqual(['ade1', 'ade2', 'ade3'])
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

  it('a hand-dragged pile order (pilePos) deals first, in exact order, above every tier', () => {
    const first = P({ id: 'first', pilePos: 1 })
    const second = P({ id: 'second', when: 'Sat 25 – Sun 26 Jul', pilePos: 2 })  // even a future pick — human override
    const top = P({ id: 'top', when: 'Daily', top: true })
    const lead = P({ id: 'lead', lead: true })
    const out = orderServed([lead, top, second, first], END)
    expect(out.map((p) => p.id)).toEqual(['first', 'second', 'top', 'lead'])
  })
})
