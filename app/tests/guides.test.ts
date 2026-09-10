// THE WEEKEND GUIDES (V.11.11) — parsed deterministically from the two pages Ness reads when the deck
// feels stale. Fixtures are the real pages of 10/11 September 2026, trimmed to the guide body.
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { parseIamsGuide, parseLbbWeekendTips, whenFromText, decode, titleVariants, foldGuides } from '../scripts/adapters/guides'
import { titlesAgree, titleLooseMatch, approvalCheck, dedupe, type TasteCorpus, type WeeklySlate } from '../scripts/lib/pipeline'
import { rankPicks } from '../src/weather/modes'
import type { Pick } from '../src/types'

const iams = readFileSync(`${import.meta.dir}/fixtures/iams-weekend-guide-2026-09-11.html`, 'utf8')
const lbb = readFileSync(`${import.meta.dir}/fixtures/lbb-weekendtips-2026-09-10.html`, 'utf8')
const NOW = new Date('2026-09-10T10:00:00Z')

describe("I amsterdam's weekend guide", () => {
  const items = parseIamsGuide(iams)
  const by = (t: string) => items.find((i) => i.title === t)
  it('reads every item under its section, prefixes stripped, the slipped <h2> included', () => {
    expect(items.map((i) => i.title)).toEqual([
      'Open Monuments Day', 'Read My World', 'Phono Lake Festival', 'Pearls of the City', 'Side to Side',
      'Open House X TF at Meervaart', 'Cinema Culinair: film and brunch', 'Kwaku Downtown',
      'Biennale Pakhuis Wilhelmina', "@ H'ART: Vintage Market",
    ])
  })
  it('categories come from the section; the guide image is the full-width media asset', () => {
    expect(by('Phono Lake Festival')?.category).toBe('drink')
    expect(by('Pearls of the City')?.category).toBe('live')
    expect(by("@ H'ART: Vintage Market")?.category).toBe('market')
    expect(by('Open Monuments Day')?.image).toMatch(/^https:\/\/media\.iamsterdam\.com\/w_1800\/.+\.webp$/)
    expect(by('Open Monuments Day')?.text).not.toMatch(/^Image from/)
  })
  it('the link is the item’s own — an organiser page, an article, or the off-site venue', () => {
    expect(by('Pearls of the City')?.link).toContain('iamsterdam.com/uit/agenda/')
    expect(by('Cinema Culinair: film and brunch')?.link).toBe('https://cinemaculinair.nl/voorstellingen-amsterdam/')
    expect(by('Phono Lake Festival')?.link).toContain('weekend-guide')   // no link on the item → the guide itself
  })
})

describe("LBB's weekendtips", () => {
  const items = parseLbbWeekendTips(lbb)
  const by = (rx: RegExp) => items.find((i) => rx.test(i.title))
  it('the opening exhibition is an item, with its run read off the From:/to line', () => {
    const k = by(/Yayoi Kusama/)
    expect(k?.category).toBe('art')
    expect(k?.when).toBe('Until Sun 17 Jan')
    expect(k?.freshness).toBe('new')   // "Open this week" is a claim of newness, whatever the run length
  })
  it('events carry their dates; markets that recur are evergreen', () => {
    expect(by(/Open Monument Day/)?.when).toBe('Sat 12 Sep – Sun 13 Sep')
    expect(by(/Hanneke/)?.when).toBe('Fri 11 Sep')
    expect(by(/Blockparty/)?.when).toBe('Sun 13 Sep')
    expect(by(/^noordermarkt$/i)?.freshness).toBe('always')
    expect(by(/^noordermarkt$/i)?.when).toMatch(/^Every Saturday/)
    expect(by(/Amstel 1 Market/)?.when).toBe('Every Friday & Saturday')
  })
  it('the kids list is parsed per tip, flagged kid, dated', () => {
    const sam = by(/Sam & Julia/)
    expect(sam?.kid).toBe(true)
    expect(sam?.when).toBe('Sat 12 Sep')
    expect(sam?.link).toBe('https://meervaart.nl/agenda/sam-julia')
    expect(items.filter((i) => i.kid).length).toBeGreaterThanOrEqual(3)
  })
  it('kids tips that never name themselves are not cards', () => {
    for (const i of items.filter((i) => i.kid)) { expect(i.title.length).toBeLessThanOrEqual(48); expect(i.title).not.toMatch(/[?!]/) }
    expect(items.some((i) => /Game On/.test(i.title))).toBe(true)
  })
  it('affiliate boilerplate and list-posts are not items; prefixes are stripped', () => {
    expect(by(/Train City/)).toBeUndefined()
    expect(by(/^These /)).toBeUndefined()
    expect(by(/^The firm$/i)).toBeUndefined()
    expect(by(/^KISEKI/)).toBeDefined()               // "Just opened: " stripped
    expect(by(/KISEKI/)?.link).toBe('https://kisekiamsterdam.nl/')
  })
  it('images are the originals, not the -700x525 thumbnails', () => {
    const withImg = items.filter((i) => i.image)
    expect(withImg.length).toBeGreaterThan(0)
    for (const i of withImg) expect(i.image).not.toMatch(/-\d+x\d+\.\w+$/)
  })
})

describe('whenFromText — the shapes the guides actually write', () => {
  it('reads the common forms', () => {
    expect(whenFromText('Date: Saturday 12 & Sunday 13 September', NOW).when).toBe('Sat 12 Sep – Sun 13 Sep')
    expect(whenFromText('On Friday, September 11, Hannekes Boom is organizing', NOW).when).toBe('Fri 11 Sep')
    expect(whenFromText('From: Friday, September 11, 2026 to January 17, 2027', NOW).when).toBe('Until Sun 17 Jan')
    expect(whenFromText('Friday 11 to Sunday 13 September | NEMO', NOW).when).toBe('Fri 11 Sep – Sun 13 Sep')
    expect(whenFromText('Every Saturday, this is the place', NOW)).toEqual({ when: 'Every Saturday', freshness: 'always' })
    expect(whenFromText('head to the Vondelpark on Sunday', NOW).when).toBe('This weekend')
  })
  it('decodes entities', () => { expect(decode('Editor&#x27;s Pick &amp; more&nbsp;')).toBe("Editor's Pick & more ") })
})

describe('titleVariants + foldGuides — the same event under two names', () => {
  it('cuts the organiser-searchable name out of an editorial title', () => {
    expect(titleVariants('Yayoi Kusama exhibition at the Stedelijk')).toContain('Yayoi Kusama')
    expect(titleVariants('Cinema Culinair: film and brunch')[1]).toBe('Cinema Culinair')
  })
  it('folds the LBB tip onto the I amsterdam item, keeping both guides and the image', () => {
    const A = (id: string, title: string, img?: string) => ({ id, title, guide: id.includes('lbb') ? 'LBB weekendtips' : 'I amsterdam weekend guide', source: id.includes('lbb') ? 'Your Little Black Book' : 'I amsterdam', image: img, venue: '', area: '', when: 'This weekend', category: 'out', freshness: 'weekend', outdoor: false, kid: false, price: '', blurb: '', why: '', link: '', weatherFit: [] } as Pick)
    const out = foldGuides([A('web-iams-read-my-world', 'Read My World', 'https://i/rmw.jpg'), A('web-guide-iams-x', "@ H'ART: Vintage Market")],
      [A('web-lbb-tips-a', 'Read My World Book Market in the Tolhuistuin'), A('web-lbb-tips-b', "Vintage market during Summer @ H'ART"), A('web-lbb-tips-c', 'Hanneke’s Late Summer Party')], titleLooseMatch)
    expect(out.map((p) => p.title)).toEqual(['Read My World', "@ H'ART: Vintage Market", 'Hanneke’s Late Summer Party'])
    expect(out[0].guide).toBe('I amsterdam weekend guide · LBB weekendtips')
    expect(out[0].image).toBe('https://i/rmw.jpg')
    expect(out[0].buzz).toBe(2)
  })
})

describe('titlesAgree — tightened for the guides', () => {
  it('a shared genre word is not agreement', () => {
    expect(titlesAgree('Phono Lake Festival', 'Reggae Lake Festival')).toBe(false)
  })
  it('one event in two languages, or a plural, still agrees', () => {
    expect(titlesAgree('Open House X TF at Meervaart', 'Open Huis X TF - Meervaart')).toBe(true)
    expect(titlesAgree('Open Monuments Day', 'Open Monument Day')).toBe(true)
    expect(titlesAgree('Biennale Pakhuis Wilhelmina', '3e Biënnale Pakhuis Wilhelmina')).toBe(true)
  })
})

const P = (o: Partial<Pick> & { id: string; title: string }): Pick => ({
  venue: 'V', area: '', when: 'Daily', category: 'out', freshness: 'weekend', outdoor: false, kid: false, price: '',
  blurb: '', why: '', source: 'S', link: 'https://x.example/e', image: 'https://i/x.jpg',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...o,
})
describe('a guide feature is an approval, survives dedupe, and leads the deck', () => {
  it('approvalCheck', () => {
    const ok = approvalCheck({ starredKeeps: [], topPicks: [], starAnchors: [] } as unknown as TasteCorpus, { weekend: '2000-01-01', lead: [], later: [] } as WeeklySlate, [])
    expect(ok({ title: 'Anything', guide: 'LBB weekendtips' })).toBe(true)
    expect(ok({ title: 'Anything' })).toBe(false)
  })
  it('dedupe unions the guides', () => {
    const out = dedupe([P({ id: 'web-iams-guide-x', title: 'Read My World', guide: 'I amsterdam weekend guide' }), P({ id: 'web-lbb-tips-x', title: 'Read My World', guide: 'LBB weekendtips' })])
    expect(out.length).toBe(1)
    expect(out[0].guide).toBe('I amsterdam weekend guide · LBB weekendtips')
  })
  it('rankPicks: guide > plain; new > old; a this-weekend one-off > a long run; wallpaper sinks', () => {
    const today = new Date().toISOString().slice(0, 10)
    const old = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10)
    expect(rankPicks([P({ id: 'web-b', title: 'B' }), P({ id: 'web-a', title: 'A', guide: 'x' })], 'WARM')[0].id).toBe('web-a')
    expect(rankPicks([P({ id: 'web-old', title: 'O', firstSeen: old }), P({ id: 'web-new', title: 'N', firstSeen: today })], 'WARM')[0].id).toBe('web-new')
    expect(rankPicks([P({ id: 'web-old', title: 'O', firstSeen: old }), P({ id: 'web-none', title: 'X' })], 'WARM')[0].id).toBe('web-none')   // wallpaper below unstamped
  })
})

import { parseJudge } from '../scripts/adapters/editor'
describe('parseJudge — a truncated judge reply is salvaged, not discarded', () => {
  it('parses a whole reply', () => {
    expect(parseJudge('Here: {"scores":[{"id":"a","score":7}],"dupes":[["a","b"]]}')?.scores?.length).toBe(1)
  })
  it('keeps every complete row of a reply cut off mid-array (the 2026-09-10 failure)', () => {
    const cut = '{"scores":[{"id":"a","score":7},{"id":"b","score":4.5},{"id":"c","sco'
    const r = parseJudge(cut)
    expect(r?.scores?.map((x) => x.id)).toEqual(['a', 'b'])
    expect(r?.dupes).toEqual([])
  })
  it('nothing usable → null', () => { expect(parseJudge('sorry, no')).toBeNull() })
})
