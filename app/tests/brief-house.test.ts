// THE HOUSE FOUR (scripts/brief-house.ts). Pins: every one speaks WKNDR's own language — the
// wordmark with its orange dot, Clash Display linked for the display line, the forecast as "13° and
// cloudy" — and keeps the house rules (legal tables, {{unsub}}, under the clip, the hero once, a
// trace, the phone rule); then one pin per arrangement: the list's big date and rounded thumbs, the
// sky's plate field and three cards with chips, the deck's big hero card and two-across pairs with
// numbers, the panel's 200px sky panel that stacks on a phone.
import { describe, it, expect } from 'bun:test'
import { houseHtml, HOUSE_LAYOUTS, type HouseLayout } from '../scripts/brief-house'
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
  P({ id: 'a', title: 'Opening night', when: 'Sat 24 Oct · 22:00', image: IMG, imageFocal: [0.5, 0.25], servePos: 1, why: '610 going on RA', source: 'Resident Advisor', venue: 'Paradiso' }),
  P({ id: 'b', title: 'Sunday matinee', when: 'Sun 25 Oct · 15:00', category: 'stage', image: IMG, servePos: 2 }),
  P({ id: 'c', title: 'Saturday market', when: 'Sat 24 Oct · 10:00', category: 'market', image: IMG, servePos: 3 }),
  P({ id: 'd', title: 'Yusu pop-up', when: 'Sun 25 Oct', category: 'eat', servePos: 4, venue: 'Am' }),
  P({ id: 'e', title: 'Always there', when: 'Daily · all day', freshness: 'always', category: 'eat', image: IMG, servePos: 5 }),
  P({ id: 'f', title: 'Closing day', when: 'Sat 10 – Sun 25 Oct', category: 'stage', image: IMG, servePos: 6 }),
  P({ id: 'g', title: 'Late set', when: 'Sat 24 Oct · 23:30', image: IMG, servePos: 7 }),
]
const DRY: Wx = { label: '24 Oct – 25 Oct', span: 'Sat 24 – Sun 25 Oct', days: [
  { label: 'Sat', hi: 13, mode: 'COOL', pop: 10, sun: 0.4 }, { label: 'Sun', hi: 13, mode: 'COOL', pop: 10, sun: 0.1 } ] }

const LAYOUTS = Object.keys(HOUSE_LAYOUTS) as HouseLayout[]
const render = (layout: HouseLayout) => houseHtml(picks, DRY, { now: NOW, per: 3, layout })

describe('the house four — one language, the house rules', () => {
  for (const layout of LAYOUTS) {
    it(`${layout}: the wordmark's dot, Clash Display linked, "13° and cloudy", legal tables, unsub, the clip, the hero once, a trace, the phone rule`, () => {
      const out = render(layout)
      expect(out.layout).toBe(layout)
      expect(out.hero.id).toBe('a')
      expect([...out.sat, ...out.sun].map((p) => p.id)).not.toContain('a')
      expect(out.html).toContain('>WKNDR</span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff4d1f')
      expect(out.html).toContain('api.fontshare.com/v2/css?f[]=clash-display')
      expect(out.html).toContain("'Clash Display','Helvetica Neue'")
      expect(out.html).toMatch(/13°(<\/span>)? and cloudy/)   // the sky splits it across its display line
      expect(trsAreLegal(out.html)).toBe(true)
      expect(out.html).toContain('href="{{unsub}}"')
      expect(Buffer.byteLength(out.html, 'utf8')).toBeLessThan(100 * 1024)
      expect(out.html).toContain('@media (max-width:480px)')
      expect(out.html).toContain('via Resident Advisor')
      expect(out.html).toContain('Swipe. Save. Match.')
      expect(out.html).not.toContain('>Am<')
    })
  }
})

describe('each arrangement', () => {
  it('list: the date big with its spaces kept hard, orange numbers 1–6, 96px rounded thumbs, the day markers', () => {
    const h = render('list').html
    expect(h).toContain('font:600 46px/1 \'Clash Display\'')
    expect(h).toContain('>24&nbsp;Oct&nbsp;–&nbsp;25&nbsp;Oct<')
    expect(h).toContain('color:#ff4d1f;">1<')
    expect(h).toContain('color:#ff4d1f;">6<')
    expect(h).toContain('width="96" height="96"')
    expect(h).toContain('&amp;w=192&amp;h=192&amp;fit=cover&amp;a=focal')
    expect(h.indexOf('>Saturday')).toBeLessThan(h.indexOf('>Sunday'))
  })
  it('sky: the overcast plate as the field with its flat colour under it, the display line, three cards with chips, then rows from 4', () => {
    const h = render('sky').html
    expect(h).toContain('atmosphere%2Fovercast.webp')
    expect(h).toContain('bgcolor="#e8e9ea"')
    expect(h).toContain('Your weekend,<br><span style="color:#ff4d1f;">13°</span> and cloudy.')
    expect((h.match(/class="fc"/g) ?? []).length).toBe(3)
    expect(h).toContain('>Sat 24 Oct · 22:00<')          // the chip
    expect(h).toContain('background:rgba(11,29,56,.78)')  // the card footer
    expect(h).toContain('Also this weekend')
    expect(h).toContain('color:#ff4d1f;">4<')
  })
  it('deck: the hero as one 532×400 card numbered 1, the rest two across with numbers in their footers, every card a chip', () => {
    const h = render('deck').html
    expect(h).toContain('width="532" height="400"')
    expect(h).toContain('<span style="color:#ff4d1f;">1</span>&nbsp; Opening night')
    expect(h).toContain('<span style="color:#ff4d1f;">2</span>&nbsp; Saturday market')
    expect((h.match(/class="sc"/g) ?? []).length).toBe(5)
    expect((h.match(/rgba\(28,42,51,\.82\)/g) ?? []).length).toBe(6)   // six chips: the hero + five
    expect(h).toContain('.hc td.cd{width:100%!important;height:300px!important}')
  })
  it('panel: a 200px sky panel with the date broken over two lines, the picks as rows beside it, stacking on a phone', () => {
    const h = render('panel').html
    expect(h).toContain('class="stack pnl" width="200"')
    expect(h).toContain('>24&nbsp;Oct&nbsp;–<br>25&nbsp;Oct<')
    expect(h).toContain('This weekend in Amsterdam')
    expect(h).toContain('>app.wkndr.xyz</a>')
    expect(h).toContain('.disp br{display:none}')
    expect(h).toContain('width="64" height="64"')
  })
})
