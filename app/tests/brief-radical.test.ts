// THE RADICAL FIVE (scripts/brief-radical.ts). Pins: each layout is a different object and keeps the
// house rules — every <tr> in a <table>, the unsubscribe slot, under Gmail's clip, the cover pick
// present once as the hero, a source trace, the forecast's claim — and each carries the one thing
// that makes it that object: the poster's black page and full-bleed 4:5 hero, the receipt's mono
// strip and barcode with no <img>, the board's red times and no <img>, the postcard's stamp with the
// temperature and the handwritten stack, the note's bare white page with no mast and no numbers.
import { describe, it, expect } from 'bun:test'
import { radicalHtml, RADICAL_LAYOUTS, type RadicalLayout } from '../scripts/brief-radical'
import { trsAreLegal } from '../scripts/lib/brief-shared'
import type { Pick, Mode } from '../src/types'
import type { Wx } from '../scripts/poster'

const ALL: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const P = (o: Partial<Pick> & { id: string; title: string; when: string }): Pick => ({
  venue: 'Venue', area: '', category: 'live', freshness: 'weekend', outdoor: false, kid: false, price: '',
  blurb: `About ${o.title}.`, why: '', source: 'Your Little Black Book', link: `https://x.example/${o.id}`, weatherFit: ALL, ...o,
})
const NOW = new Date(2026, 9, 23, 12)   // Fri 23 Oct 2026 — the weekend of 24–25 Oct
const IMG = 'https://images.weserv.nl/?url=https%3A%2F%2Fx.example%2Fa.jpg&w=800&h=1200&fit=cover&a=attention&output=jpg'
const picks: Pick[] = [
  P({ id: 'a', title: 'Opening night', when: 'Sat 24 Oct · 22:00', image: IMG, imageFocal: [0.5, 0.25], servePos: 1, why: '610 going on RA', source: 'Resident Advisor', price: 'ticketed' }),
  P({ id: 'b', title: 'Sunday matinee', when: 'Sun 25 Oct · 15:00', category: 'stage', image: IMG, servePos: 2 }),
  P({ id: 'c', title: 'Saturday market', when: 'Sat 24 Oct · 10:00', category: 'market', image: IMG, servePos: 3 }),
  P({ id: 'd', title: 'Yusu pop-up', when: 'Sun 25 Oct', category: 'eat', servePos: 4, venue: 'Am' }),
  P({ id: 'e', title: 'Always there', when: 'Daily · all day', freshness: 'always', category: 'eat', image: IMG, servePos: 5 }),
  P({ id: 'f', title: 'Closing day', when: 'Sat 10 – Sun 25 Oct', category: 'stage', image: IMG, servePos: 6 }),
  P({ id: 'g', title: 'Late set', when: 'Sat 24 Oct · 23:30', image: IMG, servePos: 7 }),
]
const DRY: Wx = { label: '24–25 Oct', span: 'Sat 24 – Sun 25 Oct', days: [
  { label: 'Sat', hi: 13, mode: 'COOL', pop: 10, sun: 0.4 }, { label: 'Sun', hi: 13, mode: 'COOL', pop: 10, sun: 0.1 } ] }

const LAYOUTS = Object.keys(RADICAL_LAYOUTS) as RadicalLayout[]
const render = (layout: RadicalLayout) => radicalHtml(picks, DRY, { now: NOW, per: 3, layout })

describe('the radical five — the house rules hold in every one', () => {
  for (const layout of LAYOUTS) {
    it(`${layout}: legal tables, unsubscribe, under the clip, the hero once, a trace, the claim, the phone rule`, () => {
      const out = render(layout)
      expect(out.layout).toBe(layout)
      expect(out.hero.id).toBe('a')
      expect([...out.sat, ...out.sun].map((p) => p.id)).not.toContain('a')
      expect([...out.sat, ...out.sun].map((p) => p.id)).not.toContain('e')
      expect(trsAreLegal(out.html)).toBe(true)
      expect(out.html).toContain('href="{{unsub}}"')
      expect(Buffer.byteLength(out.html, 'utf8')).toBeLessThan(100 * 1024)
      expect(out.html).toContain('@media (max-width:480px)')
      expect((out.html.match(/Opening night/g) ?? []).length).toBeGreaterThanOrEqual(2)   // the preheader, then once as the hero
      expect(out.html).toContain('via Resident Advisor')
      expect(out.html).toContain('Two dry days at 13')
      expect(out.html).not.toContain('>Am<')
      expect(out.subject).toBe('Two dry days at 13° — the difference is the hour, not the day.')
    })
  }
})

describe('each is its own object', () => {
  it('poster: a black page, the hero cut 4:5 full-bleed, the lineup in uppercase, the claim on orange', () => {
    const h = render('poster').html
    expect(h).toContain('bgcolor="#0a0a0a"')
    expect(h).toContain('&amp;w=1200&amp;h=1500&amp;fit=cover&amp;a=focal')
    expect(h).toContain('text-transform:uppercase;color:#ffffff;"><a href="https://x.example/c"')
    expect(h).toContain('bgcolor="#ff4d1f"')
    expect(h).not.toContain('border-radius')
  })
  it('receipt: a 360px mono strip, no <img>, line items with the hour, totals and a barcode', () => {
    const h = render('receipt').html
    expect(h).toContain('max-width:360px')
    expect(h).not.toContain('<img')
    expect(h).toContain('PICKS OF THE WEEKEND')
    expect(h).toContain('SAT 10:00')
    expect(h).toContain('<b>TOTAL</b>')
    expect(h).toContain('<b>6 PICKS</b>')
    expect((h.match(/height:38px;background:#2b2b2b/g) ?? []).length).toBeGreaterThan(10)   // the bars
    expect(h).toContain("'SF Mono',Menlo")
  })
  it('board: times in red down a column, black rules, a square per row in the day\'s tint, not one photograph', () => {
    const h = render('board').html
    expect(h).not.toContain('<img')
    expect(h).toContain('color:#ff4d1f;">10:00')
    expect(h).toContain('color:#ff4d1f;">22:00')
    expect(h).toContain('border-top:6px solid #111111')
    expect(h).toContain('background:#4d857a;font-size:0')   // COOL's tint as the sky square
    expect(h).toContain('Departures')
  })
  it('postcard: the photo as the front, a handwritten note naming the picks, a stamp with the temperature', () => {
    const h = render('postcard').html
    expect(h).toContain('&amp;w=1144&amp;h=800&amp;fit=cover&amp;a=focal')
    expect(h).toContain("'Snell Roundhand','Apple Chancery'")
    expect(h).toContain('Dear you,')
    expect(h).toMatch(/Saturday: .*Saturday market.* at 10:00/)
    expect(h).toContain('>13&deg;<')
    expect(h).toContain('WKNDR post')
    expect(h).toContain('To: you')
  })
  it('note: a white page, the system font, no mast, no card, no numbers, no pictures — prose with links', () => {
    const h = render('note').html
    expect(h).toContain('bgcolor="#ffffff"')
    expect(h).toContain('-apple-system,BlinkMacSystemFont')
    expect(h).not.toContain('<img')
    expect(h).not.toContain('<h1')
    expect(h).not.toMatch(/>0[1-9]</)
    expect(h).toContain('Hi,')
    expect(h).toContain('<b>Saturday</b>')
    expect(h).toContain('The one I\'d book: <a href="https://x.example/a"')
    expect(h).toContain('— WKNDR')
  })
})
