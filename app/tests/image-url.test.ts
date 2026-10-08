// THE BLANK CARD OF 2026-10-08. The De Hallen market opened the deck with no photograph although the
// feed carried one (a venue borrow, the Foodhallen on Wikimedia). lib/image originalOf decoded the
// wsrv source TWICE — searchParams.get had already done it — so the file name's own `%28…%29` became
// `(…)`, encodeURIComponent left the parentheses alone, and the card's unquoted `url(…)` was invalid
// CSS: background-image none. Five of the hundred pictured live cards had the same face. These pin
// the two halves of the fix: one decode, and every inline url() quoted.
import { describe, it, expect } from 'bun:test'
import { originalOf, cardImageOf, headerImageOf, cssUrl } from '../src/lib/image'
import feed from '../public/data/picks.amsterdam.json'

const SRC = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Foodhallen_in_Oud-West_%28Amsterdam%2C_The_Netherlands_2017%29_%2834245643041%29.jpg/1280px-Foodhallen_in_Oud-West_%28Amsterdam%2C_The_Netherlands_2017%29_%2834245643041%29.jpg'
// exactly what scripts/lib/pipeline toPortrait publishes for it
const RENDER = `https://images.weserv.nl/?url=${encodeURIComponent(SRC)}&w=800&h=1200&fit=cover&a=focal&fpx=0.500&fpy=0.575&output=jpg&default=${encodeURIComponent(SRC)}`
const UNSAFE = /[()'"\s]/

describe('originalOf — one decode, the source as the pipeline saw it', () => {
  it('returns the source with its own escapes intact', () => {
    expect(originalOf(RENDER)).toBe(SRC)
    expect(originalOf(RENDER)).not.toMatch(/\(/)
  })
  it('passes a non-wsrv url through', () => {
    expect(originalOf('/posters/x.jpg')).toBe('/posters/x.jpg')
    expect(originalOf(SRC)).toBe(SRC)
  })
})

describe('the derived renders stay CSS-safe', () => {
  it('card face and detail header carry no raw parentheses, quotes or whitespace', () => {
    expect(cardImageOf(RENDER)).not.toMatch(UNSAFE)
    expect(headerImageOf(RENDER, [0.5, 0.575])).not.toMatch(UNSAFE)
    expect(cardImageOf(RENDER)).toContain(encodeURIComponent(SRC))
  })
})

describe('cssUrl — quoted, so a source wsrv left parentheses in cannot break the card', () => {
  it('quotes and keeps the url intact', () => {
    const u = 'https://images.weserv.nl/?url=https%3A%2F%2Fx.example%2Fa%2520(8).png&w=800'
    expect(cssUrl(u)).toBe(`url("${u}")`)
  })
  it('escapes the one character a double-quoted url cannot hold', () => {
    expect(cssUrl('https://x.example/a"b.jpg')).toBe('url("https://x.example/a%22b.jpg")')
    expect(cssUrl('https://x.example/a\\b.jpg')).not.toContain('\\')
  })
})

describe('the published feed renders on every face', () => {
  it('every pictured pick has a card-face url and a thumb url that CSS will accept once quoted', () => {
    const pictured = (feed.picks as { image?: string | null }[]).filter((p) => p.image)
    expect(pictured.length).toBeGreaterThan(0)
    for (const p of pictured) {
      const face = cardImageOf(p.image!)
      expect(face.startsWith('https://') || face.startsWith('/')).toBe(true)
      expect(cssUrl(face).startsWith('url("')).toBe(true)
      const body = cssUrl(p.image!).slice(5, -2)   // between url(" and ")
      expect(body).not.toMatch(/["\n\r]/)
      // the one decode: a double-decoded source would have lost its %28/%29
      if (p.image!.includes('%2528')) expect(originalOf(p.image!)).toContain('%28')
    }
  })
})
