// THE WEEKEND POSTER — the pure half. Rendering needs Chrome (the workflow's own step, which is
// continue-on-error so a poster can never block the content publish); these cover the parts that
// decide WHAT goes on it, which is where a silent regression would actually hurt.
//
// Importing the module must not launch a browser — poster.ts guards its run block with
// `import.meta.main`. If that guard is ever removed this file will hang, which is the point.
import { describe, it, expect } from 'bun:test'
import { realVenue, topPicks, posterHtml } from '../scripts/poster'
import type { Mode, Pick } from '../src/types'

const p = (over: Partial<Pick>): Pick => ({
  id: over.title ?? 'x', title: 'x', venue: '', area: '', when: 'Daily', category: 'out',
  freshness: 'weekend', outdoor: false, kid: false, price: '', why: '', weatherFit: ['HOT'],
  image: 'https://img/x.jpg', blurb: '', source: '', link: '', ...over,
} as Pick)

describe('realVenue — never print the source as a place', () => {
  it('drops a venue that is just the source name', () => {
    expect(realVenue(p({ venue: 'I amsterdam', source: 'I amsterdam · Maps' }))).toBe('')
    expect(realVenue(p({ venue: 'I amsterdam', source: 'I amsterdam' }))).toBe('')
  })
  it('keeps a real venue even when that source is also credited', () => {
    expect(realVenue(p({ venue: 'Diverse locations', source: 'Your Little Black Book · I amsterdam' })))
      .toBe('Diverse locations')
    expect(realVenue(p({ venue: 'Nelson Mandelapark', source: 'I amsterdam' }))).toBe('Nelson Mandelapark')
  })
  it('handles a missing venue or source', () => {
    expect(realVenue(p({ venue: '', source: 'I amsterdam' }))).toBe('')
    expect(realVenue(p({ venue: 'Paradiso', source: '' }))).toBe('Paradiso')
  })
})

describe('topPicks — the poster shows the deck’s own front', () => {
  it('follows pilePos first, then the stamped serve order', () => {
    const picks = [
      p({ title: 'serve-2', servePos: 2 }),
      p({ title: 'pile-2', pilePos: 2 }),
      p({ title: 'serve-1', servePos: 1 }),
      p({ title: 'pile-1', pilePos: 1 }),
    ]
    expect(topPicks(picks, 4).map((x) => x.title)).toEqual(['pile-1', 'pile-2', 'serve-1', 'serve-2'])
  })
  it('skips picks with no image — a blank tile would be worse than a shorter list', () => {
    const picks = [p({ title: 'no-img', pilePos: 1, image: '' }), p({ title: 'ok', pilePos: 2 })]
    expect(topPicks(picks, 5).map((x) => x.title)).toEqual(['ok'])
  })
  it('caps at the requested count', () => {
    expect(topPicks(Array.from({ length: 20 }, (_, i) => p({ title: `p${i}`, servePos: i })), 5)).toHaveLength(5)
  })
})

describe('posterHtml', () => {
  const picks = [p({ title: 'Canal Parade', venue: 'Diverse locations', when: 'Sat 1 Aug', source: 'LBB' })]
  const day = (label: string, hi: number, mode: Mode) => ({ label, hi, mode })

  it('names BOTH days on a split weekend', () => {
    const html = posterHtml(picks, { label: '1–2 Aug', days: [day('Sat', 27, 'HOT'), day('Sun', 14, 'COLD_WET')] }, '')
    expect(html).toContain('Sat 27°')
    expect(html).toContain('Sun 14°')
  })
  it('shows one figure on a uniform weekend', () => {
    const html = posterHtml(picks, { label: '1–2 Aug', days: [day('Sat', 25, 'HOT'), day('Sun', 25, 'HOT')] }, '')
    expect(html).toContain('25°')
    expect(html).not.toContain('Sat 25°')
  })
  it('survives a dead forecast without printing a bogus temperature', () => {
    const html = posterHtml(picks, null, '')
    expect(html).toContain('This weekend')
    expect(html).not.toMatch(/\d+°/)
  })
  it('escapes pick text rather than injecting it', () => {
    const html = posterHtml([p({ title: '<script>x</script> & "co"', when: 'Sat 1 Aug' })], null, '')
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
  })
  it('renders the fixed canvas the share sizes depend on', () => {
    const html = posterHtml(picks, null, '')
    expect(html).toContain('width:1080px;height:1350px')   // 4:5 portrait
  })
})
