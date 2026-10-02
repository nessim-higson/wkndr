// EYE FILMMUSEUM — adapters/eye.ts, against the three presentation blocks of the live exhibitions page
// saved verbatim on 2026-10-02 (tests/fixtures-eye.html), and the four featured-programme articles of the
// what's-on carousel saved the same day (tests/fixtures-eye-whatson.html).
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEyeExhibitions, parseEyeFeatured, eyePicks, eyeRun } from '../scripts/adapters/eye'

const html = readFileSync(join(import.meta.dir, 'fixtures-eye.html'), 'utf8')
const blocks = parseEyeExhibitions(html)

describe("Eye's exhibitions page", () => {
  it('reads every presentation block: title, copy, link, the widest image, the credit', () => {
    expect(blocks.map((b) => b.title)).toEqual(['Ulrich Seidl – Über das Leben, die Liebe und den Tod', 'Permanent exhibition What is Film?', 'Eye Art & Film Prize'])
    expect(blocks[0].link).toBe('https://www.eyefilm.nl/en/programme/ulrich-seidl/1633828')
    expect(blocks[0].image).toMatch(/^https:\/\/assets\.eyefilm\.nl\/images\/programme-item\/_\d{4}x\d+_/)
    expect(Number(blocks[0].image!.match(/\/_(\d+)x/)![1])).toBeGreaterThanOrEqual(1500)
    expect(blocks[0].credit).toContain('Ulrich Seidl Filmproduktion')
  })
  it('emits the running show in the house date format, and the permanent exhibition as an evergreen', () => {
    const picks = eyePicks(blocks, new Date(2026, 9, 2, 12))
    expect(picks.map((p) => p.id)).toEqual(['web-eye-ulrich-seidl', 'web-eye-permanent-exhibition'])
    const [seidl, perm] = picks
    expect(seidl.when).toBe('Until Sun 31 Jan')
    expect(seidl.freshness).toBe('weekend')
    expect(seidl.venue).toBe('Eye Filmmuseum')
    expect(seidl.blurb).not.toMatch(/On show from/)
    expect(seidl.blurb.length).toBeLessThanOrEqual(201)
    expect(perm.title).toBe('What is Film?')
    expect(perm.when).toBe('Daily')
    expect(perm.freshness).toBe('always')
    for (const p of picks) { expect(p.image).toMatch(/^https:\/\/assets\.eyefilm\.nl\//); expect(p.outdoor).toBe(false); expect(p.source).toBe('Eye Filmmuseum') }
  })
  it('the Prize block is not something to visit this weekend', () => {
    expect(eyePicks(blocks, new Date(2026, 9, 2)).some((p) => /prize/i.test(p.title))).toBe(false)
  })
  it('says when a show opens; drops one that has closed or is still far off', () => {
    expect(eyePicks(blocks, new Date(2026, 8, 10, 12))[0].when).toBe('Opens Sat 19 Sep · until Sun 31 Jan')
    expect(eyePicks(blocks, new Date(2027, 1, 5, 12)).map((p) => p.id)).toEqual(['web-eye-permanent-exhibition'])
    expect(eyePicks(blocks, new Date(2026, 7, 1, 12)).map((p) => p.id)).toEqual(['web-eye-permanent-exhibition'])
  })
})

describe("Eye's featured programmes (the what's-on carousel)", () => {
  const featured = parseEyeFeatured(readFileSync(join(import.meta.dir, 'fixtures-eye-whatson.html'), 'utf8'))
  const now = new Date(2026, 9, 2, 12)
  it('reads each article by structure: title, label, date line, sentence, link, the widest campaign image', () => {
    expect(featured.map((b) => b.title)).toEqual(['Ulrich Seidl – Über das Leben, die Liebe und den Tod', 'The Films of Jacques Demy', 'Eye Classics', 'Permanent exhibition'])
    const demy = featured[1]
    expect(demy.dates).toBe('27 augustus — 14 oktober 2026')
    expect(demy.link).toBe('https://www.eyefilm.nl/en/programme/jacques-demy/1670654')
    expect(demy.image).toMatch(/_2900x1631_.*campagnebeeld-Jacques-Demy/)
    expect(demy.body).toMatch(/^Other Jacques Demy films/)
    expect(featured[2].label).toBe('Ongoing')
    expect(featured[2].dates).toBeUndefined()
  })
  it('reads the Dutch date line (first year left off) and the English sentence alike', () => {
    expect(eyeRun('27 augustus — 14 oktober 2026')?.range).toBe('27 August 2026 – 14 October 2026')
    expect(eyeRun('On show from 19 September 2026 through 31 January 2027.')?.range).toBe('19 September 2026 – 31 January 2027')
    expect(eyeRun('20 december — 4 januari 2027')?.range).toBe('20 December 2026 – 4 January 2027')   // a run over New Year
    expect(eyeRun('Do you know your classics?')).toBeNull()
  })
  it('the film season is a card with Eye’s link, dates and campaign still; the ongoing series is not', () => {
    const picks = eyePicks([...blocks, ...featured], now)
    expect(picks.map((p) => p.id)).toEqual(['web-eye-ulrich-seidl', 'web-eye-permanent-exhibition', 'web-eye-jacques-demy'])
    const demy = picks[2]
    expect(demy.when).toBe('Until Wed 14 Oct')
    expect(demy.freshness).toBe('ending')            // inside its last fortnight
    expect(demy.category).toBe('stage')              // a film season, not an exhibition
    expect(demy.link).toContain('/programme/jacques-demy/')
    expect(demy.image).toContain('campagnebeeld-Jacques-Demy')
  })
  it('one card per programme: the exhibitions page wins over the carousel for a show on both', () => {
    const picks = eyePicks([...blocks, ...featured], now)
    expect(picks.filter((p) => /seidl/i.test(p.id))).toHaveLength(1)
    expect(picks[0].imageCredit).toContain('Ulrich Seidl Filmproduktion')   // the fuller block
    expect(picks[1].title).toBe('What is Film?')
  })
  it('stands on the carousel alone if the exhibitions page is unreadable', () => {
    const picks = eyePicks(featured, now)
    expect(picks.map((p) => p.id)).toEqual(['web-eye-ulrich-seidl', 'web-eye-jacques-demy', 'web-eye-permanent-exhibition'])
    expect(picks[0].category).toBe('art')            // labelled "Exhibition, Films, Talks & Events"
    expect(picks[2].title).toBe('The permanent exhibition')
  })
  it('a season is not "ending" before its last fortnight, and is gone after it', () => {
    expect(eyePicks(featured, new Date(2026, 8, 5, 12)).find((p) => p.id === 'web-eye-jacques-demy')?.freshness).toBe('weekend')
    expect(eyePicks(featured, new Date(2026, 9, 20, 12)).some((p) => p.id === 'web-eye-jacques-demy')).toBe(false)
  })
})
