// TEMPLATE E — THE PICKS (scripts/brief-picks.ts). Pins: pick 01 is the deck's first pictured weekend
// card and appears once; the days split and run chronologically with continuous numbering; a card
// with no photo gets its typographic face, never an <img>; every row carries its source trace; the
// sky band reads the forecast; both layouts keep every <tr> in a <table>, the unsubscribe slot and the
// size under Gmail's clip; the phone rules are present.
import { describe, it, expect } from 'bun:test'
import { picksHtml, PICKS_LAYOUTS, type PicksLayout } from '../scripts/brief-picks'
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
  P({ id: 'a', title: 'Opening night', when: 'Sat 24 Oct · 22:00', image: IMG, imageFocal: [0.5, 0.25], servePos: 1, why: '610 going on RA', source: 'Resident Advisor' }),
  P({ id: 'b', title: 'Sunday matinee', when: 'Sun 25 Oct · 15:00', category: 'stage', image: IMG, servePos: 2 }),
  P({ id: 'c', title: 'Saturday market', when: 'Sat 24 Oct · 10:00', category: 'market', image: IMG, servePos: 3 }),
  P({ id: 'd', title: 'Yusu pop-up', when: 'Sun 25 Oct', category: 'eat', servePos: 4, venue: 'Am' }),   // no photo; a junk venue
  P({ id: 'e', title: 'Always there', when: 'Daily · all day', freshness: 'always', category: 'eat', image: IMG, servePos: 5 }),
  P({ id: 'f', title: 'Closing day', when: 'Sat 10 – Sun 25 Oct', category: 'stage', image: IMG, servePos: 6 }),
  P({ id: 'g', title: 'Late set', when: 'Sat 24 Oct · 23:30', image: IMG, servePos: 7 }),
]
const DRY: Wx = { label: '24–25 Oct', span: 'Sat 24 – Sun 25 Oct', days: [
  { label: 'Sat', hi: 13, mode: 'COOL', pop: 10, sun: 0.4 }, { label: 'Sun', hi: 13, mode: 'COOL', pop: 10, sun: 0.1 } ] }
const SPLIT: Wx = { label: '24–25 Oct', span: 'Sat 24 – Sun 25 Oct', days: [
  { label: 'Sat', hi: 21, mode: 'WARM', pop: 10, sun: 0.7 }, { label: 'Sun', hi: 14, mode: 'COLD_WET', pop: 80, sun: 0.1 } ] }

const nums = (html: string) => [...html.matchAll(/<span style="color:#ff4d1f;">(\d\d)<\/span>/g)].map((m) => m[1])

describe('template E — the picks', () => {
  const out = picksHtml(picks, DRY, { now: NOW, per: 3 })
  it('leads with the deck\'s first pictured weekend card as 01, once, cut 3:2 from the original on its focal point', () => {
    expect(out.hero.id).toBe('a')
    expect([...out.sat, ...out.sun].map((p) => p.id)).not.toContain('a')
    expect(out.html).toContain('&amp;w=1064&amp;h=710&amp;fit=cover&amp;a=focal&amp;fpx=0.500&amp;fpy=0.250')
    expect(out.html).toContain('The one to book')
  })
  it('splits the days and numbers the rows continuously, chronologically inside each day', () => {
    expect(out.sat.map((p) => p.id)).toEqual(['c', 'g', 'f'])          // 10:00, 23:30, then the all-day run (last day): the clock first, all-day last
    expect(out.sun.map((p) => p.id)).toEqual(['b', 'd'])
    expect(nums(out.html)).toEqual(['01', '02', '03', '04', '05', '06'])
    expect(out.html.indexOf('>Saturday<')).toBeLessThan(out.html.indexOf('>Sunday<'))
    expect([...out.sat, ...out.sun].map((p) => p.id)).not.toContain('e')   // the canon is not the weekend
  })
  it('gives a card with no photo its typographic face, and drops a junk venue', () => {
    expect(out.html).toContain('class="th np"')
    expect(out.html).toMatch(/class="th np"[^>]*>Y</)
    expect(out.html).not.toMatch(/src="[^"]*"[^>]*alt="Yusu pop-up"/)
    expect(out.html).not.toContain('>Am<')
  })
  it('carries the source trace on every row, in mono, with the card\'s own why', () => {
    expect((out.html.match(/>via /g) ?? []).length).toBe(6)
    expect(out.html).toContain('via Resident Advisor · 610 going on RA')
    expect(out.html).toContain("'SF Mono',Menlo")
    expect(out.html).toContain('Last day')
  })
  it('opens on the sky: the claim, two tinted day cells, the forecast receipt', () => {
    expect(out.html).toContain('Two dry days at 13°')
    expect(out.html).toContain('forecast Open-Meteo')
    expect(out.html).toContain('read Fri 23 Oct 12:00')
    const split = picksHtml(picks, SPLIT, { now: NOW })
    expect(split.html).toContain('Saturday is the day to be out')
    expect(split.subject).toBe('Saturday is the day to be out; the other is for the museums.')
  })
  it('keeps the email rules in both layouts: <tr>s legal, {{unsub}}, under the clip, phone rules present', () => {
    for (const layout of ['rows', 'grid'] as const) {
      const r = picksHtml(picks, DRY, { now: NOW, layout })
      expect(trsAreLegal(r.html)).toBe(true)
      expect(r.html).toContain('{{unsub}}')
      expect(Buffer.byteLength(r.html, 'utf8')).toBeLessThan(100 * 1024)
      expect(r.html).toContain('@media (max-width:480px)')
      expect(r.html).toContain('[data-ogsc] .wash')
      expect(r.layout).toBe(layout)
    }
    const grid = picksHtml(picks, DRY, { now: NOW, layout: 'grid', per: 3 })
    expect((grid.html.match(/class="stack-gap"/g) ?? []).length).toBe(3)   // 3 + 2 picks → 2 + 1 pairs
    expect(grid.html).toContain('&amp;w=560&amp;h=374')
  })
  it('pins the cover by title when asked and counts the rest honestly', () => {
    const pinned = picksHtml(picks, DRY, { now: NOW, hero: 'matinee', per: 1 })
    expect(pinned.hero.id).toBe('b')
    expect(pinned.html).toContain('3 more, sorted the same way')   // 6 weekend cards − cover − 2 shown
  })
})

describe('template E — the other layouts', () => {
  const LAYOUTS = Object.keys(PICKS_LAYOUTS) as PicksLayout[]
  it('every layout keeps the rules: <tr>s legal, the cover once, {{unsub}}, under the clip, the trace, the phone rules', () => {
    for (const layout of LAYOUTS) {
      const r = picksHtml(picks, DRY, { now: NOW, layout, per: 3 })
      expect(r.layout).toBe(layout)
      expect(trsAreLegal(r.html)).toBe(true)
      expect(r.html).toContain('{{unsub}}')
      expect(Buffer.byteLength(r.html, 'utf8')).toBeLessThan(100 * 1024)
      expect(r.html).toContain('@media (max-width:480px)')
      expect((r.html.match(/>Opening night</g) ?? []).length).toBe(1)   // the cover title once (alt text aside)
      expect(r.html).toContain('via Resident Advisor')
      expect(r.html).toContain('Two dry days at 13°')
    }
  })
  it('the index has no thumbs after the cover; the plates wear the brick accent and no pill', () => {
    const index = picksHtml(picks, DRY, { now: NOW, layout: 'index' })
    expect(index.html).not.toContain('&amp;w=300&amp;h=300')
    expect(index.html).toContain('font:400 36px/1')   // the hanging numeral
    const plates = picksHtml(picks, DRY, { now: NOW, layout: 'plates' })
    expect(plates.html).not.toContain('#ff4d1f')
    expect(plates.html).toContain('#8a2818')
    expect(plates.html).not.toContain('border-radius:100px')
    expect((plates.html.match(/&amp;w=1064&amp;h=710/g) ?? []).length).toBe(5)   // every pictured pick a plate (a, b, c, f, g)
  })
  it('the cover field wears the wetter day\'s tint and the list uses round 72px thumbs; the split and the blocks tint by day', () => {
    const cover = picksHtml(picks, SPLIT, { now: NOW, layout: 'cover' })
    expect(cover.html).toContain('bgcolor="#4a6489"')   // Sunday is the wet one (COLD_WET)
    expect(cover.html).toContain('border-radius:36px')
    const split = picksHtml(picks, DRY, { now: NOW, layout: 'split' })
    expect((split.html.match(/class="stack col"/g) ?? []).length).toBe(2)
    const blocks = picksHtml(picks, SPLIT, { now: NOW, layout: 'blocks' })
    expect(blocks.html).toContain('bgcolor="#fdf0e2"')   // Saturday WARM wash
    expect(blocks.html).toContain('bgcolor="#e7ecf3"')   // Sunday COLD_WET wash
    expect(blocks.html).toContain('class="bkc"')
  })
})
