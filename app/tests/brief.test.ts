// THE FRIDAY BRIEF (scripts/brief.ts) — the draft written from the deck and the forecast. Pins:
// the cover is the deck's first pictured weekend card, a Sunday-dated card lands in Sunday's column,
// every <tr> sits in a <table> (the silent-discard bug from comp A), the unsubscribe slot survives,
// the forecast line reads the two days, and the whole thing stays under Gmail's clip.
import { describe, it, expect } from 'bun:test'
import { briefHtml, trsAreLegal } from '../scripts/brief'
import type { Pick, Mode } from '../src/types'
import type { Wx } from '../scripts/poster'

const ALL: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const P = (o: Partial<Pick> & { id: string; title: string; when: string }): Pick => ({
  venue: 'V', area: '', category: 'live', freshness: 'weekend', outdoor: false, kid: false, price: '',
  blurb: `About ${o.title}.`, why: '', source: 'S', link: `https://x.example/${o.id}`, weatherFit: ALL, ...o,
})
const NOW = new Date(2026, 9, 23, 12)   // Fri 23 Oct 2026 — the weekend of 24–25 Oct
const IMG = 'https://images.weserv.nl/?url=https%3A%2F%2Fx.example%2Fa.jpg&w=800&h=1200&fit=cover&a=attention&output=jpg'
const picks: Pick[] = [
  P({ id: 'a', title: 'Opening night', when: 'Fri 23 Oct · 22:00', image: IMG, servePos: 1 }),
  P({ id: 'b', title: 'Sunday matinee', when: 'Sun 25 Oct · 15:00', category: 'stage', servePos: 2 }),
  P({ id: 'c', title: 'Saturday market', when: 'Sat 24 Oct · 10:00', category: 'market', servePos: 3 }),
  P({ id: 'd', title: 'A long run', when: 'Until Sun 17 Jan', category: 'art', servePos: 4 }),
  P({ id: 'e', title: 'Always there', when: 'Daily · all day', freshness: 'always', category: 'eat', servePos: 5 }),
  P({ id: 'f', title: 'Closing day', when: 'Sat 10 – Sun 25 Oct', category: 'stage', servePos: 6 }),
]
const WET: Wx = { label: '24–25 Oct', span: 'Sat 24 – Sun 25 Oct', days: [
  { label: 'Sat', hi: 13, mode: 'COLD_WET', pop: 100, sun: 0.05 }, { label: 'Sun', hi: 13, mode: 'COLD_WET', pop: 100, sun: 0.05 } ] }
const SPLIT: Wx = { label: '24–25 Oct', span: 'Sat 24 – Sun 25 Oct', days: [
  { label: 'Sat', hi: 21, mode: 'WARM', pop: 10, sun: 0.7 }, { label: 'Sun', hi: 14, mode: 'COLD_WET', pop: 80, sun: 0.1 } ] }

describe('the Friday brief', () => {
  const out = briefHtml(picks, WET, { now: NOW })
  it('leads with the deck\'s first pictured weekend card', () => {
    expect(out.hero.id).toBe('a')
    expect(out.html).toContain('&amp;w=1200&amp;h=700')   // the cover re-cut from the original, not the card crop (ampersands escaped, as HTML wants)
  })
  it('puts a Sunday-dated card in Sunday\'s column and a Saturday one in Saturday\'s', () => {
    expect(out.sun.map((p) => p.id)).toContain('b')
    expect(out.sat.map((p) => p.id)).toContain('c')
    expect([...out.sat, ...out.sun].map((p) => p.id)).not.toContain('a')   // the cover appears once
    expect([...out.sat, ...out.sun].map((p) => p.id)).not.toContain('e')   // the canon is not the weekend
  })
  it('labels a run that ends on Sunday as its last day', () => {
    expect(out.html).toContain('Last day')
  })
  it('keeps every <tr> inside a <table>, the unsubscribe slot, and the size under the clip', () => {
    expect(trsAreLegal(out.html)).toBe(true)
    expect(trsAreLegal('<table><tr><td><tr><td>x</td></tr></td></tr></table>')).toBe(false)
    expect(out.html).toContain('{{unsub}}')
    expect(Buffer.byteLength(out.html, 'utf8')).toBeLessThan(100 * 1024)
  })
  it('reads the forecast: two wet days say indoors, a split weekend names the day', () => {
    expect(out.html).toContain('indoors weekend')
    expect(out.html).toContain('Rain most of the day')
    const split = briefHtml(picks, SPLIT, { now: NOW })
    expect(split.html).toContain('Saturday is the day to be out')
    expect(split.html).toContain('21&deg;')
  })
  it('pins the cover by title when asked, and links titles to the organiser', () => {
    const pinned = briefHtml(picks, WET, { now: NOW, hero: 'matinee' })
    expect(pinned.hero.id).toBe('b')
    expect(pinned.html).toContain('href="https://x.example/b"')
  })
  it('renders without a forecast (a stale feed on a Monday) and says so in the bands', () => {
    const none = briefHtml(picks, null, { now: NOW })
    expect(none.html).toContain('No forecast yet.')
    expect(trsAreLegal(none.html)).toBe(true)
  })
})
