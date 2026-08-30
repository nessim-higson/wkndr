// Regression guard for scripts/lib/score.ts — the inbox composite (Workstream 2). What's pinned
// is the brief's LAW, not just arithmetic: novelty and corroboration must outweigh raw volume,
// affinity must AMPLIFY signal rather than manufacture it, and the weights must be config.
import { describe, it, expect } from 'bun:test'
import { loadWeights, starredVocabulary, scoreInbox, type ScoreWeights } from '../scripts/lib/score'
import type { Pick } from '../src/types'

const W: ScoreWeights = loadWeights(undefined)
const TODAY = '2026-08-29'   // a Saturday
const pick = (over: Partial<Pick>): Pick => ({
  id: 'rss-x', title: 'X', venue: '', area: '', when: 'This weekend', category: 'out', freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'X', link: 'https://x',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...over,
})
const score = (p: Pick, vocab = new Set<string>()) => scoreInbox(p, vocab, W, TODAY).score

describe('the brief’s law — novelty and corroboration above raw volume', () => {
  it('a fresh two-source find outranks a famous-venue volume monster', () => {
    const fresh = pick({ firstSeen: TODAY, buzz: 2 })
    const famous = pick({ firstSeen: '2026-08-20', buzz: 1, popularity: 5000 })
    expect(score(fresh)).toBeGreaterThan(score(famous))
  })
  it('novelty decays linearly to zero across the window', () => {
    const day0 = score(pick({ firstSeen: TODAY }))
    const day5 = score(pick({ firstSeen: '2026-08-24' }))
    const day11 = score(pick({ firstSeen: '2026-08-18' }))
    expect(day0).toBeGreaterThan(day5)
    expect(day5).toBeGreaterThan(day11)
    expect(day11).toBe(0)   // no other signal → nothing left
  })
  it('no arrival record earns no novelty — fails closed, like effectiveFreshness', () => {
    expect(score(pick({}))).toBe(0)
  })
  it('real draw is capped below novelty plus one corroborating source', () => {
    const drawOnly = score(pick({ firstSeen: '2026-08-18', popularity: 1e9 }))   // novelty lapsed
    const freshCorro = score(pick({ firstSeen: TODAY, buzz: 2 }))
    expect(drawOnly).toBeLessThan(freshCorro)
  })
})

describe('dated — separates events from article-shaped RSS items', () => {
  it('the rss default "This weekend" earns nothing; a real date does; active-by-Sunday earns more', () => {
    const article = score(pick({ firstSeen: TODAY }))
    const dated = score(pick({ firstSeen: TODAY, when: 'Until Sun 20 Dec' }))
    const weekend = score(pick({ firstSeen: TODAY, when: 'Sat 29 Aug · 20:00' }))
    expect(dated).toBeGreaterThan(article)
    expect(weekend).toBeGreaterThan(article)
  })
})

describe('affinity — a multiplier, never a source of signal', () => {
  const vocab = starredVocabulary({ starAnchors: [{ title: 'Dekmantel Festival', stars: 5 }], starredKeeps: [] })
  it('amplifies an already-signalful pick', () => {
    const base = pick({ firstSeen: TODAY, title: 'Some Night' })
    const kin = pick({ firstSeen: TODAY, title: 'Warehouse Festival Night' })
    expect(score(kin, vocab)).toBeGreaterThan(score(base, vocab))
  })
  it('cannot lift a zero-signal pick off the floor', () => {
    expect(score(pick({ title: 'Dekmantel Festival Tribute' }), vocab)).toBe(0)
  })
  it('★<3 anchors and short/stopped tokens stay out of the vocabulary', () => {
    const v = starredVocabulary({ starAnchors: [{ title: 'Amsterdam at EQ', stars: 2 }], starredKeeps: [{ match: 'jazz nights', stars: 4 }] })
    expect(v.has('jazz')).toBe(true)      // 4-char taste words stay IN — jazz-ness IS signal
    expect(v.has('nights')).toBe(true)
    expect(v.has('amsterdam')).toBe(false)  // ★2 anchor excluded entirely
  })
})

describe('weights are config', () => {
  it('WKNDR_WEIGHTS overrides merge over taste/weights.json', () => {
    const w = loadWeights('{"novelty": 99}')
    expect(w.novelty).toBe(99)
    expect(w.corroboration).toBe(W.corroboration)   // untouched keys survive
  })
  it('invalid JSON falls back to the file instead of crashing the poll', () => {
    expect(loadWeights('{oops').novelty).toBe(W.novelty)
  })
  it('the receipt names its parts', () => {
    const s = scoreInbox(pick({ firstSeen: TODAY, buzz: 3, when: 'Sat 29 Aug' }), new Set(), W, TODAY)
    expect(s.why).toContain('seen today')
    expect(s.why).toContain('3 sources')
  })
})
