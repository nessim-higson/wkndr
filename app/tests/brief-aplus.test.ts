// A+ — THE FRIDAY BRIEF (scripts/brief-aplus.ts), the design chosen in the 4 Nov 2026 review. Pins the
// review's own rules ("whichever design wins, these go into brief-*.ts as tests"):
//   · the weather is the subject and the cover's claim; the picks are the preheader
//   · small: the cover and at most seven, each pick once
//   · each day opens with ONE large pick, then at most two smaller
//   · Saturday night is its own dark block, and needs no photograph
//   · the sunset line; "If it holds / If it rains" only on a day the forecast splits
//   · a status is only ever what the pick's own dates say
//   · a pick with no photo gets a type tile; every pick carries its source; the house rules hold
import { describe, it, expect } from 'bun:test'
import { aplusHtml, headline, advice, shortTitle, statusTag, partOfDay, pictureTag, dayPlan } from '../scripts/brief-aplus'
import { trsAreLegal } from '../scripts/lib/brief-shared'
import type { Pick, Mode } from '../src/types'
import type { Wx } from '../scripts/poster'

const ALL: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const P = (o: Partial<Pick> & { id: string; title: string; when: string }): Pick => ({
  venue: 'Venue', area: '', category: 'live', freshness: 'weekend', outdoor: false, kid: false, price: '',
  blurb: `About ${o.title}.`, why: '', source: 'Your Little Black Book', link: `https://x.example/${o.id}`, weatherFit: ALL, ...o,
})
const NOW = new Date(2026, 10, 6, 7, 30)   // Fri 6 Nov 2026, 07:30 — the weekend of 7–8 Nov, the comp's own
const IMG = 'https://images.weserv.nl/?url=https%3A%2F%2Fx.example%2Fa.jpg&w=800&h=1200&fit=cover&a=attention&output=jpg'
const picks: Pick[] = [
  P({ id: 'rink', title: 'Skate under the Rijksmuseum: the rink is back', when: 'Sat 7 Nov · 16:00', image: IMG, servePos: 1, outdoor: true, venue: 'Museumplein' }),
  P({ id: 'kusama', title: 'Kusama, before the queue', when: 'Sat 7 Nov · 10:00', image: IMG, servePos: 2, category: 'art', venue: 'Stedelijk', source: 'I amsterdam' }),
  P({ id: 'nacht', title: 'Museumnacht', when: 'Sat 7 Nov · 19:00', servePos: 3, category: 'art', price: '€25', venue: 'Fifty museums' }),
  P({ id: 'jollof', title: 'The Jollof Club', when: 'Sat 7 Nov · 12:30', image: IMG, servePos: 4, category: 'eat', freshness: 'new' }),
  P({ id: 'foam', title: 'Hailun Ma: Hometown', when: 'Sat 7 Nov · 15:00', servePos: 5, category: 'art', venue: 'Foam' }),
  P({ id: 'eye', title: 'The Elegant Beasts of Yuzo Kawashima', when: 'Until Wed 11 Nov', image: IMG, servePos: 6, category: 'stage', venue: 'Eye Filmmuseum', source: 'Eye Filmmuseum' }),
  P({ id: 'maker', title: 'The Maker Market', when: 'Sun 8 Nov · 10:00', image: IMG, servePos: 7, category: 'market', outdoor: true, venue: 'De Hallen' }),
  P({ id: 'sauna', title: 'Sauna Deco', when: 'Sun 8 Nov', image: IMG, servePos: 8, venue: 'Jordaan' }),
  P({ id: 'extra', title: 'One too many', when: 'Sun 8 Nov · 14:00', image: IMG, servePos: 9 }),
  P({ id: 'late', title: 'A second late one', when: 'Sat 7 Nov · 23:00', image: IMG, servePos: 10 }),
  P({ id: 'always', title: 'Always there', when: 'Daily · all day', freshness: 'always', image: IMG, servePos: 11 }),
]
const SPLIT: Wx = { label: '7–8 Nov', span: 'Sat 7 – Sun 8 Nov', days: [
  { label: 'Sat', hi: 7, mode: 'COOL', pop: 5, sun: 0.5, sunset: '17:00' }, { label: 'Sun', hi: 9, mode: 'COLD_WET', pop: 55, sun: 0.1, sunset: '16:58' } ] }
const day = (pop: number, hi = 11): Wx['days'][number] => ({ label: 'Sat', hi, mode: 'COOL', pop })

describe('A+ — the document', () => {
  const out = aplusHtml(picks, SPLIT, { now: NOW })
  it('the weather is the subject and the cover\'s claim; the picks are the preheader', () => {
    expect(out.subject).toBe('Cold, dry Saturday. Go out before Sunday’s rain.')
    expect(out.html).toContain(`class="claim"`)
    expect(out.html).toContain('Cold, dry Saturday. Go out before Sunday’s rain.</div>')
    expect(out.preheader).toBe('Skate under the Rijksmuseum, Museumnacht, The Elegant Beasts of Yuzo Kawashima')
    expect(out.html.indexOf(out.preheader)).toBeLessThan(out.html.indexOf('class="claim"'))
  })
  it('small: the cover and at most seven, each pick once, nothing evergreen', () => {
    const all = [out.hero, ...out.sat, ...(out.night ? [out.night] : []), ...out.sun]
    expect(out.hero.id).toBe('rink')
    expect(all.length).toBeLessThanOrEqual(8)
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length)
    expect(all.map((p) => p.id)).not.toContain('always')
    for (const p of all) expect(out.html.split(`href="${p.link}"`).length - 1).toBeGreaterThanOrEqual(1)
    expect(out.html).not.toContain('One too many')
  })
  it('each day opens with one large pick, then two smaller', () => {
    expect(out.sat.map((p) => p.id)).toEqual(['kusama', 'jollof', 'foam'])       // the large one, then the two by the clock
    expect(out.sun.map((p) => p.id)).toEqual(['eye', 'maker', 'sauna'])
    expect(out.html.split('class="bg1"').length - 1).toBe(2)                     // one large picture a day
    expect(out.html.split('class="sm"').length - 1).toBe(4)
  })
  it('Saturday night is its own dark block, set in type — the best timed pick from 18:00, photo or not', () => {
    expect(out.night?.id).toBe('nacht')
    expect(out.html).toContain('Saturday night &middot; 19:00')
    expect(out.html).toContain('bgcolor="#14202a"')
    expect(out.html).toContain('One night only')
    expect(out.html).toContain('€25')
    expect(out.html).not.toContain('A second late one')                           // one night block, not two
  })
  it('the sunset line stands before the night, and the chips name both days and the sunset', () => {
    expect(out.html).toContain('Sunset 17:00')
    expect(out.html.lastIndexOf('Sunset 17:00')).toBeLessThan(out.html.indexOf('Saturday night'))
    expect(out.html).toContain('Sat 7&deg; &middot; dry')
    expect(out.html).toContain('Sun 9&deg; &middot; showers')
  })
  it('plan tags only on the day the forecast splits; a status only from the pick\'s own dates', () => {
    expect(out.html).toContain('If it holds')      // the Maker Market, outdoors, on showery Sunday
    expect(out.html).toContain('If it rains')      // Sauna Deco
    const satPart = out.html.slice(out.html.indexOf('>Saturday<'), out.html.indexOf('>Sunday<'))
    expect(satPart).not.toMatch(/If it (holds|rains)/)
    expect(out.html).toContain('Last days')        // Eye's run ends Wed 11 Nov
    expect(satPart).toContain('>New<')             // the Jollof Club
  })
  it('a pick with no photo is a type tile, and every pick carries its source', () => {
    expect(out.html).toMatch(/font:600 \d+px\/1 'Clash Display'[^>]*>H<\/div>/)   // Hailun Ma, no photograph
    expect(out.html.split('>via ').length - 1).toBe(8)                           // the cover + seven
    expect(out.html).toContain('via I amsterdam')
  })
  it('keeps the house rules: legal tables, unsubscribe, under the clip, the phone rules, the door and the two answers', () => {
    expect(trsAreLegal(out.html)).toBe(true)
    expect(out.html).toContain('href="{{unsub}}"')
    expect(Buffer.byteLength(out.html, 'utf8')).toBeLessThan(100_000)
    expect(out.html).toContain('@media (max-width:480px)')
    expect(out.html).toContain('.cv td.px{width:100%!important')
    expect(out.html).toContain('Swipe the rest of the weekend')
    expect(out.html).toContain('fb=up&amp;wk=2026-11-07')
    expect(out.html).toContain('fb=down&amp;wk=2026-11-07')
    expect(out.html).not.toMatch(/[?&]w=/)         // `w` is the app's shared-plan parameter — never the brief's
  })
  it('with no forecast and no evening pick it still stands: no chips, no sunset, no night', () => {
    const quiet = aplusHtml(picks.filter((p) => !['nacht', 'late'].includes(p.id)), null, { now: NOW })
    expect(quiet.subject).toBe('The weekend, by day.')
    expect(quiet.night).toBeNull()
    expect(quiet.html).not.toContain('Sunset')
    expect(quiet.html).not.toContain('night &middot;')
    expect(trsAreLegal(quiet.html)).toBe(true)
  })
})

describe('A+ — the words', () => {
  it('headline: the weather first, then what to do about it, never a dash', () => {
    const wx = (a: number, b: number, hi = 11): Wx => ({ label: '', days: [day(a, hi), { ...day(b, hi), label: 'Sun' }] })
    expect(headline(wx(5, 5, 6))).toBe('Cold, dry weekend. Go out after dark.')
    expect(headline(wx(5, 5, 22))).toBe('Warm, dry weekend. Stay out late.')
    expect(headline(wx(10, 70))).toBe('Cool, dry Saturday. Go out before Sunday’s rain.')
    expect(headline(wx(70, 10))).toBe('Wet Saturday, dry Sunday. Save the outdoors for Sunday.')
    expect(headline(wx(80, 75))).toBe('Cool and wet. An indoors weekend.')
    expect(headline(wx(45, 50))).toBe('Cool and showery. Pick by the hour.')
    expect(headline(null)).toBe('The weekend, by day.')
    for (const h of [headline(wx(5, 5)), headline(wx(70, 10)), headline(wx(45, 50))]) expect(h).not.toMatch(/[—–-]/)
    expect(advice(wx(10, 70))).toBe('Spend Saturday out, and keep Sunday for warm rooms.')   // the comp's own line
  })
  it('shortTitle cuts at the first colon, dash or bracket and drops the shout', () => {
    expect(shortTitle('Sunday Market comes to Oostenburg: winter pop-up with local makers')).toBe('Sunday Market comes to Oostenburg')
    expect(shortTitle('De Pure Markt gaat naar binnen!')).toBe('De Pure Markt gaat naar binnen')
    expect(shortTitle('Party on Sunday (6+)')).toBe('Party on Sunday')
    expect(shortTitle('Museumnacht')).toBe('Museumnacht')
    expect(shortTitle('Jazz – late set')).toBe('Jazz')
  })
  it('statusTag never claims more than the dates do', () => {
    expect(statusTag(P({ id: 'a', title: 'a', when: 'Until Wed 11 Nov' }), NOW)?.text).toBe('Last days')
    expect(statusTag(P({ id: 'a', title: 'a', when: 'Until Sun 8 Nov' }), NOW)?.text).toBe('Last weekend')
    expect(statusTag(P({ id: 'a', title: 'a', when: 'Until Sun 31 Jan' }), NOW)).toBeNull()
    expect(statusTag(P({ id: 'a', title: 'a', when: 'Opens Sat 7 Nov · until Sun 31 Jan' }), NOW)?.text).toBe('Opens this weekend')
    expect(statusTag(P({ id: 'a', title: 'a', when: 'Opens Thu 26 Nov · until Wed 23 Dec' }), NOW)).toBeNull()
    expect(statusTag(P({ id: 'a', title: 'a', when: 'Sat 7 Nov', freshness: 'new' }), NOW)?.text).toBe('New')
    expect(statusTag(P({ id: 'a', title: 'a', when: 'Sat 7 Nov · 20:00' }), NOW)).toBeNull()
  })
  it('partOfDay and the picture tag', () => {
    expect(partOfDay(P({ id: 'a', title: 'a', when: 'Sat 7 Nov · 10:00' }))).toBe('Morning')
    expect(partOfDay(P({ id: 'a', title: 'a', when: 'Sat 7 Nov · 12:30', category: 'eat' }))).toBe('Lunch')
    expect(partOfDay(P({ id: 'a', title: 'a', when: 'Sat 7 Nov · 12:30', category: 'market' }))).toBe('Midday')
    expect(partOfDay(P({ id: 'a', title: 'a', when: 'Sat 7 Nov · 21:00' }))).toBe('Night')
    expect(partOfDay(P({ id: 'a', title: 'a', when: 'Sun 8 Nov' }))).toBe('All day')
    expect(partOfDay(P({ id: 'a', title: 'a', when: 'Thu 5 – Sun 8 Nov' }))).toBe('All weekend')
    const out = P({ id: 'a', title: 'a', when: 'Sun 8 Nov · 10:00', outdoor: true })
    expect(pictureTag(out, day(55), NOW, true).text).toBe('If it holds')
    expect(pictureTag(out, day(10), NOW, true).text).toBe('Morning')
    expect(pictureTag(out, day(55), NOW, false).text).toBe('Morning')            // the large pick keeps its hour
  })
  it('dayPlan: the night is the best timed evening pick, the large one the best pictured pick left', () => {
    const a = P({ id: 'a', title: 'a', when: 'Sat 7 Nov · 11:00', servePos: 1 })             // no photograph
    const b = P({ id: 'b', title: 'b', when: 'Sat 7 Nov · 21:00', servePos: 2, image: IMG })
    const c = P({ id: 'c', title: 'c', when: 'Sat 7 Nov · 15:00', servePos: 3, image: IMG })
    const d = P({ id: 'd', title: 'd', when: 'Sat 7 Nov · 09:00', servePos: 4, image: IMG })
    const plan = dayPlan([d, c, b, a], true)
    expect(plan.night?.id).toBe('b')
    expect(plan.hero?.id).toBe('c')
    expect(plan.two.map((p) => p.id)).toEqual(['d', 'a'])                         // by the clock
    expect(dayPlan([d, c, b, a], false).night).toBeNull()
    expect(dayPlan([], true)).toEqual({ hero: null, two: [], night: null })
  })
})
