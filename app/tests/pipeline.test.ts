// Regression guard for scripts/lib/pipeline.ts — dedupe (the multi-source union), titleKey identity,
// the image URL screens, and the weekend window. These are the pure functions the whole content
// pipeline leans on; each rule here encodes a bug we actually hit during the pipeline era.
import { describe, it, expect } from 'bun:test'
import { dedupe, titleKey, urlLooksNonPhoto, toPortrait, upcomingWeekend, whenIsPast } from '../scripts/lib/pipeline'
import type { Pick } from '../src/types'

const P = (o: Partial<Pick> & { id: string; title: string }): Pick => ({
  venue: 'V', area: '', when: 'Sat 4 Jul', category: 'live', freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'S', link: 'https://x.example',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...o,
})

describe('titleKey — canonical event identity', () => {
  it('matches title variants of the same event', () => {
    expect(titleKey('Holland Festival 2026: Alain Clark & friends')).toBe(titleKey('Holland Festival'))
  })
  it('drops city tokens', () => {
    expect(titleKey('Vunzige Deuntjes Festival Amsterdam')).toBe(titleKey('Vunzige Deuntjes Festival'))
  })
})

describe('dedupe — unioning many sources safely', () => {
  it('merges same-title keyless picks and counts buzz', () => {
    const out = dedupe([
      P({ id: 'web-a-same-night', title: 'Same Night', source: 'Source A' }),
      P({ id: 'llm-b-same-night', title: 'Same Night', source: 'Source B' }),
    ])
    expect(out.length).toBe(1)
    expect(out[0].buzz).toBe(2)
    expect(out[0].source).toContain('Source A')
    expect(out[0].source).toContain('Source B')
  })

  it('NEVER collapses two structured picks (distinct events, same-ish title)', () => {
    const out = dedupe([
      P({ id: 'web-iams-show-jul-4', title: 'Summer Show' }),
      P({ id: 'web-iams-show-jul-5', title: 'Summer Show' }),
    ])
    expect(out.length).toBe(2)   // stable ids = distinct instances — the multi-date-collapse bug
  })

  it('folds a keyless duplicate INTO the structured pick (cross-source corroboration)', () => {
    const out = dedupe([
      P({ id: 'web-iams-big-show', title: 'Big Show', source: 'I amsterdam' }),
      P({ id: 'web-search-big-show', title: 'Big Show', source: 'Your Little Black Book', popularity: 300 }),
    ])
    expect(out.length).toBe(1)
    expect(out[0].id).toBe('web-iams-big-show')      // structured identity survives
    expect(out[0].buzz).toBe(2)                       // corroboration counted
    expect(out[0].popularity).toBe(300)               // strongest draw signal carried through
  })

  it('collapses near-duplicate keyless titles by prefix', () => {
    const out = dedupe([
      P({ id: 'web-a-gnr', title: "Guns N' Roses" }),
      P({ id: 'web-b-gnr-plus', title: "Guns N' Roses and Mammoth" }),
    ])
    expect(out.length).toBe(1)
  })
})

describe('image URL screens', () => {
  it('flags organiser logos/wordmarks (the black-card class)', () => {
    expect(urlLooksNonPhoto('https://app.thefeedfactory.nl/api/assets/x/LOGO___WORDMARK_square_black.webp')).toBe(true)
  })
  it('flags watermarked stock hosts (the Magnific class)', () => {
    expect(urlLooksNonPhoto('https://img.freepik.com/premium-photo/theatre_1288284.jpg')).toBe(true)
  })
  it('passes real photos', () => {
    expect(urlLooksNonPhoto('https://images.pexels.com/photos/302769/pexels-photo-302769.jpeg')).toBe(false)
    expect(urlLooksNonPhoto('https://upload.wikimedia.org/wikipedia/commons/6/62/Albert_Cuypmarkt.jpg')).toBe(false)
  })
})

describe('toPortrait — wsrv wrap', () => {
  it('wraps an https source and is idempotent', () => {
    const wrapped = toPortrait('https://example.com/a.jpg')
    expect(wrapped).toContain('images.weserv.nl')
    expect(toPortrait(wrapped)).toBe(wrapped)
  })
  it('leaves non-https URLs alone (mixed-content guard handles them elsewhere)', () => {
    expect(toPortrait('http://example.com/a.jpg')).toBe('http://example.com/a.jpg')
  })
})

describe('weekend window', () => {
  const NOW = new Date(2026, 6, 1, 12)   // Wed 1 Jul 2026
  it('computes the coming weekend from a weekday', () => {
    const wk = upcomingWeekend(NOW)
    expect([wk.sat.getDate(), wk.sun.getDate(), wk.cutoff.getDate()]).toEqual([4, 5, 3])
  })
  it('build-time whenIsPast drops finished events, keeps evergreen', () => {
    expect(whenIsPast('Sun 28 Jun', NOW)).toBe(true)
    expect(whenIsPast('Daily · dinner', NOW)).toBe(false)
  })
})
