// EYE FILMMUSEUM — adapters/eye.ts, against the three presentation blocks of the live exhibitions page
// saved verbatim on 2026-10-02 (tests/fixtures-eye.html).
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEyeExhibitions, eyePicks } from '../scripts/adapters/eye'

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
