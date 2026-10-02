// THE WEEKEND POSTER — the pure half. Rendering needs Chrome (the workflow's own step, which is
// continue-on-error so a poster can never block the content publish); these cover the parts that
// decide WHAT goes on it, which is where a silent regression would actually hurt.
//
// Importing the module must not launch a browser — poster.ts guards its run block with
// `import.meta.main`. If that guard is ever removed this file will hang, which is the point.
import { describe, it, expect } from 'bun:test'
import { realVenue, topPicks, posterHtml, THUMBS, assignDays, MODE_TINT, rankOf, CANVAS, OG_DEFAULT, OG_REV, OG_SKIES, weekendSky, weekendWords, type WxDay } from '../scripts/poster'
import { existsSync, readFileSync } from 'node:fs'
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
      expect(ogImagePath(now), `disagreement on ${iso}`).toBe(`/share/og-${key}-${OG_REV}.png`)   // the date AND the design revision
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

// The shipped unfurl composition is a deliberate call, not an accident of argument order — pin it so
// a future default change is visible in a diff rather than silently going out to every pasted link.
describe('the shipped unfurl composition', () => {
  const src = readFileSync(join(import.meta.dir, '../scripts/poster.ts'), 'utf8')
  it('is across — the sky, the line and three cards, picked by Ness on 2026-10-02', () => {
    expect(OG_DEFAULT).toBe('across')
    expect(src).toContain("const ogv = (arg('ogv') ?? OG_DEFAULT) as OgVariant")
  })
  it('across carries the line, the weekend, the weather and the deck’s first three, in order', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((t) => p({ title: t, image: `https://x.example/${t}.jpg`, when: 'Sat 3 Oct' }))
    const wx = { label: '3–4 Oct', span: 'Sat 3 – Sun 4 Oct', days: [{ label: 'Sat', hi: 20, mode: 'WARM' as const, pop: 0, sun: 0.9, code: 3 }, { label: 'Sun', hi: 21, mode: 'WARM' as const, pop: 12, sun: 0.73, code: 3 }] }
    const html = posterHtml(five, wx, '', { layout: 'og', ogv: 'across', plates: { sunny: 'data:image/webp;base64,AAAA' } })
    expect(html).toContain('Your weekend,<br><span class="em">one swipe</span> away.')
    expect(html).toContain('Amsterdam · Sat 3 – Sun 4 Oct')
    expect(html).toContain('21° and mostly sunny')
    expect(html).toContain("background-image:url('data:image/webp;base64,AAAA')")
    expect(html.indexOf('>a<')).toBeGreaterThan(0)
    expect(html.indexOf('>a<')).toBeLessThan(html.indexOf('>b<')); expect(html.indexOf('>b<')).toBeLessThan(html.indexOf('>c<'))
    expect(html).not.toContain('>d<')
    expect(html).toContain('clash-display')                        // the app's display face, from the app's own stylesheet
  })
  it('across names both days when the weekend splits, and says nothing about weather it does not have', () => {
    const three = ['a', 'b', 'c'].map((t) => p({ title: t, image: `https://x.example/${t}.jpg` }))
    const split = { label: '3–4 Oct', span: 'Sat 3 – Sun 4 Oct', days: [{ label: 'Sat', hi: 27, mode: 'HOT' as const, pop: 5, sun: 0.9 }, { label: 'Sun', hi: 17, mode: 'COLD_WET' as const, pop: 85, sun: 0.1 }] }
    const two = posterHtml(three, split, '', { layout: 'og', ogv: 'across' })
    expect(two).toContain('Sat 27° and mostly sunny<br>Sun 17° and rainy')   // a line per day, each with its own weather
    const dead = posterHtml(three, null, '', { layout: 'og', ogv: 'across' })
    expect(dead).toContain('Amsterdam · This weekend')
    expect(dead).not.toMatch(/\d+°/)
  })
  it('across escapes what the feed hands it', () => {
    const html = posterHtml([p({ title: '<b>x</b>', venue: 'A & B', image: 'https://x.example/a.jpg' })], null, '', { layout: 'og', ogv: 'across' })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;'); expect(html).toContain('A &amp; B')
  })
  it('hero renders exactly one pick, however many it is handed', () => {
    const three = [p({ title: 'a' }), p({ title: 'b' }), p({ title: 'c' })]
    const html = posterHtml(three, null, '', { layout: 'og', ogv: 'hero' })
    expect(html).toContain('>a<')
    expect(html).not.toContain('>b<')
    expect(html).not.toContain('>c<')
  })
})

describe('a venue is a place, never a publisher — the pipeline', () => {
  it('the adapter no longer fills an unknown venue with its own name, and the restamp scrubs the feed', async () => {
    const adapter = await Bun.file(`${import.meta.dir}/../scripts/adapters/iamsterdam.ts`).text()
    expect(adapter).not.toContain("venue || 'I amsterdam'")
    const restamp = await Bun.file(`${import.meta.dir}/../scripts/restamp.ts`).text()
    expect(restamp).toContain('p.venue = realVenue(p)')
    // …and the same at the refresh's choke point, with no adapter left falling back to its own name (2026-10-02)
    const refresh = await Bun.file(`${import.meta.dir}/../scripts/refresh.ts`).text()
    expect(refresh).toContain('p.venue = realVenue(p)')
    const guides = await Bun.file(`${import.meta.dir}/../scripts/adapters/guides.ts`).text()
    expect(guides).not.toMatch(/venue:[^\n]*\?\? source/)
  })
})

// THE UNFURL'S SKY is the weekend forecast's, and not its WMO code: code 3 is total cloud cover, and the
// Saturday this shipped on was "overcast" with 10.4 of 11.5 hours of sunshine forecast.
describe('the sky behind the unfurl', () => {
  const d = (o: Partial<WxDay>): WxDay => ({ label: 'Sat', hi: 20, mode: 'WARM', pop: 0, sun: 0.8, code: 1, ...o })
  it('that weekend: code 3 both days, dry, 90% and 73% of the daylight as sunshine', () => {
    const days = [d({ code: 3, sun: 0.9 }), d({ label: 'Sun', hi: 21, code: 3, sun: 0.73, pop: 12 })]
    expect(weekendSky(days)).toBe('sunny')
    expect(weekendWords(days)).toBe('mostly sunny')
  })
  it('dry weekends are sun or cloud by the sunshine forecast', () => {
    expect(weekendSky([d({ sun: 0.5 }), d({ sun: 0.55 })])).toBe('sunny'); expect(weekendWords([d({ sun: 0.5 }), d({ sun: 0.55 })])).toBe('sun and cloud')
    expect(weekendSky([d({ sun: 0.2 }), d({ sun: 0.3 })])).toBe('overcast'); expect(weekendWords([d({ sun: 0.2 }), d({ sun: 0.3 })])).toBe('cloudy')
  })
  it('rain chance decides the wet ones: a shower day, a wet weekend, snow, thunder', () => {
    expect(weekendSky([d({ pop: 45 }), d({ pop: 10 })])).toBe('mixed')
    expect(weekendSky([d({ pop: 70 }), d({ pop: 65 })])).toBe('rain'); expect(weekendWords([d({ pop: 70 }), d({ pop: 65 })])).toBe('rainy')
    expect(weekendSky([d({ pop: 60, code: 73 }), d({ pop: 20 })])).toBe('snow')
    expect(weekendSky([d({ pop: 80, code: 95 }), d({ pop: 30 })])).toBe('storm')
  })
  it('no sunshine figures: the mode stands in; no forecast at all: the house sky', () => {
    expect(weekendSky([d({ sun: undefined, mode: 'COOL' })])).toBe('overcast')
    expect(weekendSky([d({ sun: undefined, mode: 'HOT' })])).toBe('sunny')
    expect(weekendSky(undefined)).toBe('sunny')
  })
  it('every sky has its photograph on disk and an ink that reads on it', () => {
    for (const [sky, s] of Object.entries(OG_SKIES)) {
      expect(existsSync(join(import.meta.dir, '../src/assets/atmosphere', s.plate)), `${sky}: ${s.plate}`).toBe(true)
      expect(['dark', 'light']).toContain(s.ink)
    }
  })
  it('index.html carries the title that goes with it, and no em dash', () => {
    const idx = readFileSync(join(import.meta.dir, '../index.html'), 'utf8')
    expect(idx).toContain('<meta property="og:title" content="WKNDR · Your weekend, one swipe away" />')
    for (const tag of idx.match(/<meta[^>]+(?:og:title|og:description|name="description")[^>]*>/g) ?? []) expect(tag).not.toContain('—')
  })
})
