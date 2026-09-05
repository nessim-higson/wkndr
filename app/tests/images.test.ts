// HONEST IMAGES (V.11.9) — the law: a live card's photo is OF the event (or of its venue), or the
// card has none. These guard the pure pieces of that law and audit the published feed against it.
//
// The bug they encode: the 2026-09-03 feed shipped a tattoo convention (filed `market` by a web-search
// guess) wearing the Bloemenmarkt's photo, and "Concertgebouw Open" wearing Haarlem — the category-bank
// fallback working exactly as designed. 9 of 53 live cards showed a photo that was not of the event.
import { describe, it, expect } from 'bun:test'
import { linkIsIndex, iamsCategoryFromPath, matchEventLoc, matchEventLocs, titlesAgree, titleTokens, venueMatchImage, NO_PHOTO_CAP } from '../scripts/lib/pipeline'
import { rankPicks, holdBackImageless, orderServed } from '../src/weather/modes'
import type { Pick, ImageWhy } from '../src/types'
import feed from '../public/data/picks.amsterdam.json'

const P = (o: Partial<Pick> & { id: string; title: string }): Pick => ({
  venue: 'V', area: '', when: 'Sat 5 Sep', category: 'out', freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'S', link: 'https://x.example/e/1',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...o,
})

describe('linkIsIndex — a listing page is not an event page', () => {
  it('flags the index-only links the 2026-09-03 web-search picks shipped with', () => {
    expect(linkIsIndex('https://www.iamsterdam.com/en/whats-on')).toBe(true)
    expect(linkIsIndex('https://www.iamsterdam.com/en/whats-on/weekend-guide')).toBe(true)
    expect(linkIsIndex('https://www.iamsterdam.com/en/whats-on/annual-event-calendar')).toBe(true)
    expect(linkIsIndex('https://www.iamsterdam.com/zien-en-doen/gratis-deze-maand')).toBe(true)
    expect(linkIsIndex('https://www.concertgebouw.nl/')).toBe(true)
    expect(linkIsIndex('not a url')).toBe(true)
  })
  it('keeps a specific event page', () => {
    expect(linkIsIndex('https://www.iamsterdam.com/uit/agenda/festivals/events/the-20th-international-amsterdam-tattoo-convention-2026')).toBe(false)
    expect(linkIsIndex('https://www.concertgebouw.nl/concerten/concertgebouw-open-2026')).toBe(false)
    expect(linkIsIndex('https://www.volkskrant.nl/cultuur-media/een-weekend-vol-jazz~b1234/')).toBe(false)
  })
})

describe('iamsCategoryFromPath — the organiser namespace, EN and NL', () => {
  it('maps calendar namespaces', () => {
    expect(iamsCategoryFromPath('https://www.iamsterdam.com/en/whats-on/calendar/concerts-and-music/concerts/x')).toBe('live')
    expect(iamsCategoryFromPath('https://www.iamsterdam.com/uit/agenda/festivals/events/x')).toBe('out')
    expect(iamsCategoryFromPath('https://www.iamsterdam.com/en/whats-on/calendar/exhibitions/all-exhibitions/x')).toBe('art')
    expect(iamsCategoryFromPath('https://www.iamsterdam.com/en/whats-on/calendar/attractions-and-sights/tours/x')).toBe('daytrip')
  })
  it('returns null off the calendar', () => {
    expect(iamsCategoryFromPath('https://www.iamsterdam.com/en/whats-on/weekend-guide')).toBeNull()
  })
})

// a slice of the real events sitemap (2026-09-04)
const LOCS = [
  'https://www.iamsterdam.com/en/business/calendar/events/all/volunteer-cafe',
  'https://www.iamsterdam.com/en/whats-on/calendar/concerts-and-music/concerts/kerstavond-in-het-concertgebouw',
  'https://www.iamsterdam.com/uit/agenda/concerten-en-muziek/concerten/umut-veysel-demirtas-concertgebouw-open',   // a sub-concert page: no Event JSON-LD
  'https://www.iamsterdam.com/en/whats-on/calendar/concerts-and-music/concerts/concertgebouw-open-gratis-miniconcerten-voor-iedereen',
  'https://www.iamsterdam.com/en/whats-on/calendar/concerts-and-music/concerts/emanuel-ax-en-het-concertgebouworkest-spelen-john-williams',
  'https://www.iamsterdam.com/uit/agenda/festivals/events/the-20th-international-amsterdam-tattoo-convention-2026',
  'https://www.iamsterdam.com/en/whats-on/calendar/attractions-and-sights/tours/guided-tour-world-press-photo-exhibition-2026',
  'https://www.iamsterdam.com/en/whats-on/calendar/exhibitions/all-exhibitions/world-press-photo',
  'https://www.iamsterdam.com/en/whats-on/calendar/festivals/events/amsterdam-city-swim',
  'https://www.iamsterdam.com/en/whats-on/calendar/festivals/events/amsterdam-wine-festival',
  'https://www.iamsterdam.com/uit/agenda/festivals/events/buitenmarkt-xl-door-noordoogst',
  'https://www.iamsterdam.com/en/whats-on/calendar/festivals/events/buitenmarkt-xl-door-noordoogst',
]
describe('matchEventLoc — the sitemap rescue', () => {
  it('finds the event page behind each index-linked 2026-09-03 pick', () => {
    expect(matchEventLoc('Concertgebouw Open', LOCS)).toContain('concertgebouw-open-gratis')
    expect(matchEventLoc('Amsterdam Tattoo Convention (20th Edition)', LOCS)).toContain('tattoo-convention-2026')
    expect(matchEventLoc('City Swim (Amsterdam Swim)', LOCS)).toContain('amsterdam-city-swim')
    expect(matchEventLoc('Amsterdam Wine Festival', LOCS)).toContain('amsterdam-wine-festival')
  })
  it('the event itself outranks a sub-event named after it, which stays as the fallback', () => {
    // the live 2026-09-05 miss: the Umut Veysel Demirtaş mini-concert page (fewer extra tokens, no
    // JSON-LD) tie-broke ahead of the real "Concertgebouw Open" page — a slug that STARTS with the
    // title now wins, and the caller walks the next candidates when the first page can't be parsed
    const ranked = matchEventLocs('Concertgebouw Open', LOCS)
    expect(ranked[0]).toContain('concertgebouw-open-gratis')
    expect(ranked[1]).toContain('umut-veysel-demirtas')
  })
  it('prefers the event itself over its guided tour, and the English twin over the Dutch', () => {
    expect(matchEventLoc('World Press Photo', LOCS)).toBe('https://www.iamsterdam.com/en/whats-on/calendar/exhibitions/all-exhibitions/world-press-photo')
    expect(matchEventLoc('Buitenmarkt XL', LOCS)).toContain('/en/')
  })
  it('never matches on one shared common token, and never a business-calendar page', () => {
    expect(matchEventLoc('Open Studios Noord', LOCS)).toBeNull()      // "open" alone is not evidence
    expect(matchEventLoc('Volunteer Cafe', LOCS)).toBeNull()
    expect(matchEventLoc('NDSM 80-Year History Exhibition', LOCS)).toBeNull()
  })
  it('a lone token rescues only when distinctive', () => {
    expect(matchEventLoc('Sleazefest', ['https://www.iamsterdam.com/en/whats-on/calendar/concerts-and-music/concerts/sleazefest-2026'])).not.toBeNull()
    expect(matchEventLoc('Open', LOCS)).toBeNull()
  })
})

describe('titlesAgree — the organiser name is the proof, the slug is the lead', () => {
  it('agrees across the paraphrase', () => {
    expect(titlesAgree('Amsterdam Tattoo Convention (20th Edition)', 'The 20th International Amsterdam Tattoo Convention 2026')).toBe(true)
    expect(titlesAgree('Concertgebouw Open', 'Concertgebouw Open: gratis miniconcerten voor iedereen')).toBe(true)
  })
  it('refuses a different event on the same theme', () => {
    expect(titlesAgree('Concertgebouw Open', 'Kerstavond in het Concertgebouw')).toBe(false)
  })
  it('titleTokens drops years, connectives and the city', () => {
    expect(titleTokens('The 20th Amsterdam Tattoo Convention 2026')).toEqual(['20th', 'tattoo', 'convention'])
  })
})

describe('venueMatchImage — the one honest borrow', () => {
  const places = [
    { name: 'Royal Concertgebouw', image: 'https://c/concertgebouw.jpg' },
    { name: 'Paradiso', image: 'https://c/paradiso.jpg' },
    { name: 'Vondelpark Openluchttheater', image: 'https://c/vondel.jpg' },
    { name: 'Het Amsterdamse Bos', image: 'https://c/bos.jpg' },
    { name: 'Pllek — waterfront hang', image: 'https://c/pllek.jpg' },
    { name: 'The Movies', image: 'https://c/movies.jpg' },
    { name: 'The American Book Center', image: 'https://c/abc.jpg' },
  ]
  it('a core token never bridges from a TITLE (the first live run: "American Myth Memory" ≠ the bookshop)', () => {
    expect(venueMatchImage({ title: 'American Myth Memory – David Levinthal', venue: 'Huis Marseille', category: 'art' }, places)).toBeNull()
    // …while the same core token on the VENUE field still stands for the place
    expect(venueMatchImage({ title: 'Poetry night', venue: 'American Book Center', category: 'shop' }, places)?.image).toBe('https://c/abc.jpg')
  })
  it('the Concertgebouw open day wears the Concertgebouw (the 2026-09-03 Haarlem card)', () => {
    const m = venueMatchImage({ title: 'Concertgebouw Open', venue: 'Het Concertgebouw', category: 'live' }, places)
    expect(m?.image).toBe('https://c/concertgebouw.jpg')
  })
  it('an ACT at the hall never wears the hall (imageRules: never a stand-in)', () => {
    expect(venueMatchImage({ title: 'Peder Mannerfelt, Parrish Smith', venue: 'Paradiso', category: 'live' }, places)).toBeNull()
    expect(venueMatchImage({ title: 'Jacques Demy retrospective', venue: 'The Movies', category: 'stage' }, places)).toBeNull()
  })
  it('a venue-led night names the place in its title and may wear it', () => {
    expect(venueMatchImage({ title: 'Paradiso 55: open house', venue: 'Paradiso', category: 'live' }, places)?.image).toBe('https://c/paradiso.jpg')
  })
  it('a non-performer event at a canon place wears the place', () => {
    expect(venueMatchImage({ title: 'Sunday market', venue: 'Pllek', category: 'market' }, places)?.image).toBe('https://c/pllek.jpg')
  })
  it('the wrong-landmark class: a generic core word never bridges two venues', () => {
    // "Openluchttheater" is generic — the Bos theatre must not wear the Vondelpark stage
    expect(venueMatchImage({ title: 'Summer concert', venue: 'Openluchttheater Amsterdamse Bos', category: 'out' }, places)?.image).not.toBe('https://c/vondel.jpg')
    expect(venueMatchImage({ title: 'Silent movies night', venue: 'Pathé Tuschinski', category: 'stage' }, places)).toBeNull()
  })
  it('a generic venue string never matches anything', () => {
    expect(venueMatchImage({ title: 'Some festival', venue: 'Amsterdam', category: 'out' }, places)).toBeNull()
  })
})

describe('the deck — a blank ranks below a pictured peer and never opens the deck on its own', () => {
  it('rankPicks: the no-photo penalty', () => {
    const a = P({ id: 'web-a', title: 'A', image: 'https://i/a.jpg', editorScore: 6 })
    const b = P({ id: 'web-b', title: 'B', editorScore: 6 })
    expect(rankPicks([b, a], 'WARM').map((p) => p.id)).toEqual(['web-a', 'web-b'])
    // …but it is a nudge inside the tier (−2, i.e. four judge points), not a gate: a much better blank still leads
    const d = P({ id: 'web-d', title: 'D', image: 'https://i/d.jpg', editorScore: 4 })
    const c = P({ id: 'web-c', title: 'C', editorScore: 10 })
    expect(rankPicks([d, c], 'WARM')[0].id).toBe('web-c')
  })
  it('holdBackImageless: the first five are pictured, held cards deal right after, order kept', () => {
    const img = (id: string) => P({ id, title: id, image: 'https://i/x.jpg' })
    const list = [P({ id: 'n1', title: 'n1' }), img('p1'), img('p2'), P({ id: 'n2', title: 'n2' }), img('p3'), img('p4'), img('p5'), img('p6'), P({ id: 'n3', title: 'n3' })]
    expect(holdBackImageless(list).map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'n1', 'n2', 'p6', 'n3'])
  })
  it('holdBackImageless: a human call keeps its slot, photo or not', () => {
    const img = (id: string) => P({ id, title: id, image: 'https://i/x.jpg' })
    const list = [P({ id: 'top', title: 'top', top: true }), P({ id: 'hand', title: 'hand', pilePos: 1 }), img('p1'), img('p2')]
    expect(holdBackImageless(list).map((p) => p.id)).toEqual(['top', 'hand', 'p1', 'p2'])
  })
  it('holdBackImageless: a no-op when nothing is pictured (fixtures, a feed with no image pass)', () => {
    const list = [P({ id: 'a', title: 'a' }), P({ id: 'b', title: 'b' })]
    expect(holdBackImageless(list)).toBe(list)
    expect(orderServed(list).map((p) => p.id)).toEqual(['a', 'b'])
  })
})

// THE FEED AUDIT — applies once a feed built under the law is published (any pick carries a receipt).
// Pre-V.11.9 feeds carry none and are not judged by a law they were not built under.
const LIVE = ['web-', 'llm-', 'rss-', 'sk-']
const HONEST: ImageWhy[] = ['organiser', 'event-page', 'portrait', 'web', 'venue', 'curated']
describe('the published feed keeps the law', () => {
  const picks = (feed as { picks: Pick[] }).picks
  const live = picks.filter((p) => LIVE.some((pre) => p.id.startsWith(pre)))
  const built = live.some((p) => p.imageWhy)
  it('every live pick carries a receipt, and the receipt matches the photo', () => {
    if (!built) return
    for (const p of live) {
      expect(p.imageWhy, p.title).toBeDefined()
      if (p.image) expect(HONEST, `${p.title} · ${p.imageWhy}`).toContain(p.imageWhy!)
      else expect(p.imageWhy, p.title).toBe('none')
    }
  })
  it('no two live cards wear the same photo', () => {
    if (!built) return
    const seen = new Map<string, string>()
    for (const p of live) {
      if (!p.image) continue
      expect(seen.get(p.image), `${p.title} shares a photo with ${seen.get(p.image)}`).toBeUndefined()
      seen.set(p.image, p.title)
    }
  })
  it('honest blanks are the exception, not the deck', () => {
    if (!built) return
    const blanks = live.filter((p) => !p.image).length
    // the cap plus explicit human calls (a ★ admits a blank) — a generous ceiling; the point is that a
    // runaway image pass (most of the deck blank) shows up RED here, not on a phone
    expect(blanks).toBeLessThanOrEqual(Math.max(NO_PHOTO_CAP + 6, Math.ceil(live.length * 0.25)))
  })
})
