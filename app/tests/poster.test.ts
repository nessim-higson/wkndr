// THE WEEKEND POSTER — the pure half. Rendering needs Chrome (the workflow's own step, which is
// continue-on-error so a poster can never block the content publish); these cover the parts that
// decide WHAT goes on it, which is where a silent regression would actually hurt.
//
// Importing the module must not launch a browser — poster.ts guards its run block with
// `import.meta.main`. If that guard is ever removed this file will hang, which is the point.
import { describe, it, expect } from 'bun:test'
import { realVenue, topPicks, posterHtml, THUMBS, assignDays, MODE_TINT, rankOf, CANVAS } from '../scripts/poster'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { upcomingWeekend } from '../scripts/lib/pipeline'
import { upcomingWeekendEnd } from '../src/lib/when'
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

// The `overlay` variant shipped 21px over budget on its first cut. Because the header/footer are
// flex children, the overflow didn't push anything off-canvas — it SILENTLY SHRANK the black rule to
// zero. This pins the budget so a new variant can't repeat that, and the flex:none guard that makes
// an overflow visible rather than invisible.
describe('THUMBS — every variant fits the canvas', () => {
  const PER_ROW = 176   // (1350 − the fixed header/footer furniture) ÷ 5 rows

  for (const [name, t] of Object.entries(THUMBS)) {
    it(`${name} stays within the per-row budget`, () => {
      const h = /height:(\d+)px/.exec(t.css)?.[1]
      if (!h) return          // `none` draws no thumb — its row is text-height only
      expect(t.rowPad * 2 + Number(h) + 1).toBeLessThanOrEqual(PER_ROW)
    })
  }

  it('the fixed furniture cannot be squeezed by an overflowing list', () => {
    const html = posterHtml([], null, '')
    for (const sel of ['.mark{flex:none', '.when{flex:none', '.temps{flex:none', '.rule{flex:none', '.foot{flex:none'])
      expect(html).toContain(sel)
    expect(html).toContain('ul{list-style:none;flex:1;min-height:0')
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

// ── the DAYS layout: which pick belongs to which half of the weekend ─────────────────────────────
// This is the per-day weather (V.10.18) made visible: on a hot-Sat / wet-Sun weekend the poster
// should put the outdoor pick on Saturday and the all-weather one on Sunday, and say so with two
// differently-coloured temperature stamps.
describe('assignDays — splitting the weekend', () => {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  const end = upcomingWeekendEnd(now)
  const SUN = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const SAT = new Date(SUN.getFullYear(), SUN.getMonth(), SUN.getDate() - 1)
  const ds = (d: Date) => `${d.getDate()} ${M[d.getMonth()]}`
  const SPLIT = [{ label: 'Sat', hi: 27, mode: 'HOT' as Mode }, { label: 'Sun', hi: 14, mode: 'COLD_WET' as Mode }]

  it('sends a day-locked pick to its own day', () => {
    const satOnly = p({ title: 'sat-only', when: `Sat ${ds(SAT)}` })
    const sunOnly = p({ title: 'sun-only', when: `Sun ${ds(SUN)}` })
    const out = assignDays([satOnly, sunOnly], SPLIT, 2, now)
    expect(out.sat.map((x) => x.title)).toContain('sat-only')
    expect(out.sun.map((x) => x.title)).toContain('sun-only')
  })

  it('sends a flexible pick to the day whose weather it actually fits', () => {
    const outdoor = p({ title: 'terrace', when: 'Daily', weatherFit: ['HOT', 'WARM'] })
    const allWeather = p({ title: 'cinema', when: 'Daily', weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'] })
    const out = assignDays([outdoor, allWeather], SPLIT, 1, now)
    expect(out.sat.map((x) => x.title)).toEqual(['terrace'])   // only Saturday is HOT
    expect(out.sun.map((x) => x.title)).toEqual(['cinema'])    // the one that can take a wet day
  })

  it('never places the same pick on both days', () => {
    const picks = Array.from({ length: 8 }, (_, i) => p({ title: `p${i}`, when: 'Daily' }))
    const out = assignDays(picks, SPLIT, 2, now)
    const all = [...out.sat, ...out.sun].map((x) => x.title)
    expect(new Set(all).size).toBe(all.length)
  })

  it('balances the two days when everything fits both (a uniform weekend)', () => {
    const same = [{ label: 'Sat', hi: 25, mode: 'HOT' as Mode }, { label: 'Sun', hi: 25, mode: 'HOT' as Mode }]
    const picks = Array.from({ length: 6 }, (_, i) => p({ title: `p${i}`, when: 'Daily' }))
    const out = assignDays(picks, same, 2, now)
    expect(out.sat).toHaveLength(2)
    expect(out.sun).toHaveLength(2)
  })

  it('honours the per-day cap and degrades on a dead forecast', () => {
    const picks = Array.from({ length: 9 }, (_, i) => p({ title: `p${i}`, when: 'Daily' }))
    expect(assignDays(picks, SPLIT, 3, now).sat).toHaveLength(3)
    const noWx = assignDays(picks, undefined, 2, now)
    expect(noWx.sat).toHaveLength(2)
    expect(noWx.sun).toHaveLength(2)
  })

  it('stamps each day in its own weather colour', () => {
    expect(MODE_TINT.HOT).not.toBe(MODE_TINT.COLD_WET)
    expect(Object.keys(MODE_TINT).sort()).toEqual(['COLD_WET', 'COOL', 'HOT', 'VOLATILE', 'WARM'])
  })
})

// ── THE UNFURL ──────────────────────────────────────────────────────────────────────────────────
// og:image is stamped by vite.config as /share/og-<saturday>.png, and the poster script writes that
// exact file on the same weekly cron. The two compute the weekend date INDEPENDENTLY, so if they
// ever disagree the tag points at a 404 and every pasted link loses its card. This pins them together.
describe('the unfurl', () => {
  const viteSrc = readFileSync(join(import.meta.dir, '../vite.config.ts'), 'utf8')
  // strip the TS signature annotations — new Function() parses JS, not TypeScript
  const fn = viteSrc
    .slice(viteSrc.indexOf('function ogImagePath('), viteSrc.indexOf('\n}', viteSrc.indexOf('function ogImagePath(')) + 2)
    .replace(/\)\s*:\s*string\s*\{/, ') {')
    .replace(/(\w+)\s*=\s*new Date\(\)\s*:\s*Date/, '$1 = new Date()')
  const ogImagePath = new Function(`${fn}\nreturn ogImagePath`)() as (now?: Date) => string

  it('vite and the pipeline agree on which Saturday this is', () => {
    for (const iso of ['2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03', '2026-12-31']) {
      const now = new Date(`${iso}T09:00:00`)
      const sat = upcomingWeekend(now).sat
      const key = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`
      expect(ogImagePath(now), `disagreement on ${iso}`).toBe(`/share/og-${key}.png`)
    }
  })

  it('the filename changes weekly — a fixed one would serve a stale card forever', () => {
    const a = ogImagePath(new Date('2026-08-01T09:00:00'))
    const b = ogImagePath(new Date('2026-08-08T09:00:00'))
    expect(a).not.toBe(b)
  })

  it('index.html asks for the stamped image, not a fixed card', () => {
    const idx = readFileSync(join(import.meta.dir, '../index.html'), 'utf8')
    expect(idx).toContain('content="%OG_ORIGIN%%OG_IMAGE%"')
    expect(idx).not.toContain('og-app.png')
    expect(idx).toContain('<meta property="og:image:width" content="1200" />')
    expect(idx).toContain('<meta property="og:image:height" content="630" />')
  })

  it('renders on the 1.91:1 canvas the platforms expect', () => {
    const [w, h] = CANVAS('og')
    expect([w, h]).toEqual([1200, 630])
    expect(Math.abs(w / h - 1.91)).toBeLessThan(0.02)
    expect(CANVAS('list')).toEqual([1080, 1350])   // the share poster keeps 4:5
  })
})

// The number on a pick is its position in the APP'S DECK, not its index on the poster — with
// --picks= pinning a hand-chosen pair, poster-index numbering claimed Chefs in het Bos was "2"
// when the app deals it 9th.
describe('rankOf', () => {
  it('prefers the hand-set deck position', () => {
    expect(rankOf(p({ pilePos: 9, servePos: 3 }), 1)).toBe(9)
  })
  it('falls back to the stamped serve order, then to the poster index', () => {
    expect(rankOf(p({ servePos: 4 }), 0)).toBe(4)
    expect(rankOf(p({}), 1)).toBe(2)
  })
})
