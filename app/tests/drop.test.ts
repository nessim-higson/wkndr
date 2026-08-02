// THE DROP BOX — paste a social link, get a pick (board V.9.32 / worker /drop).
//
// The strings asserted below are REAL responses captured from Instagram on 2026-08-02, not
// invented fixtures — every one of them encodes a trap that cost a debugging round:
//   · og:description packs likes/comments/author/date AROUND the caption, so a naive read hands
//     the deck a title that starts "5,628 likes, 101 comments - ...".
//   · Instagram truncates a long caption and DROPS the closing quote, so a greedy /"(.*)"/ match
//     silently swallows the whole prefix.
//   · og:image arrives HTML-escaped; feeding `&amp;` back to the CDN fails with "Bad URL hash".
//   · a deleted post still answers 200, with a small placeholder image — dimensions are the tell.
import { describe, it, expect } from 'bun:test'
import {
  parseOgDescription, parseCount, unescapeHtml, meta, titleFrom,
  normalizeUrl, platformOf, shortcodeOf, imageDims, MIN_DIM,
} from '../../worker/curate/src/extract'
import { applyOverrides, type CurateOverrides } from '../src/lib/overrides'
import type { Pick } from '../src/types'

const REAL_OG =
  '5,628 likes, 101 comments - benjitalent on June 7, 2023: "Figure It Out live from Paradiso Amsterdam 📸 @matt_morgan_davies".'

describe('og:description parsing', () => {
  it('lifts the caption out from between the engagement counts and the trailing period', () => {
    const d = parseOgDescription(REAL_OG)
    expect(d.caption).toBe('Figure It Out live from Paradiso Amsterdam 📸 @matt_morgan_davies')
    expect(d.author).toBe('benjitalent')
    expect(d.date).toBe('June 7, 2023')
    expect(d.likes).toBe(5628)
    expect(d.comments).toBe(101)
  })

  it('still parses when Instagram truncates and drops the closing quote', () => {
    const d = parseOgDescription('41M likes, 486K comments - cristiano on November 19, 2022: "Victory is a State of Mind. A long tradition of...')
    expect(d.author).toBe('cristiano')
    expect(d.likes).toBe(41_000_000)
    expect(d.comments).toBe(486_000)
    // the point: the caption must NOT carry the "41M likes, ..." prefix
    expect(d.caption?.startsWith('Victory is a State of Mind')).toBe(true)
  })

  it('falls back to the raw string when the shape is unrecognised', () => {
    expect(parseOgDescription('just some text').caption).toBe('just some text')
    expect(parseOgDescription(undefined)).toEqual({})
  })

  it('reads K/M suffixes and plain thousands', () => {
    expect(parseCount('41M')).toBe(41_000_000)
    expect(parseCount('486K')).toBe(486_000)
    expect(parseCount('5,628')).toBe(5628)
    expect(parseCount('nonsense')).toBeUndefined()
  })
})

describe('html entities', () => {
  it('restores & in a signed CDN url — the "Bad URL hash" bug', () => {
    expect(unescapeHtml('a.jpg?x=1&amp;oh=2&amp;oe=3')).toBe('a.jpg?x=1&oh=2&oe=3')
  })
  it('decodes the numeric emoji entity Instagram emits', () => {
    expect(unescapeHtml('shot &#x1f4f8; here')).toBe('shot 📸 here')
  })
  it('reads a meta tag with attributes in either order', () => {
    expect(meta('<meta property="og:image" content="https://x/y.jpg?a=1&amp;b=2">', 'og:image'))
      .toBe('https://x/y.jpg?a=1&b=2')
    expect(meta('<meta content="hello" property="og:title">', 'og:title')).toBe('hello')
    expect(meta('<meta property="og:title" content="hi">', 'og:image')).toBeUndefined()
  })
})

describe('titles', () => {
  it('takes the first sentence and caps the length', () => {
    expect(titleFrom('Figure It Out live from Paradiso. Second sentence.')).toBe('Figure It Out live from Paradiso.')
    expect(titleFrom('a'.repeat(200)).length).toBeLessThanOrEqual(90)
  })
  it('names the author when the post has no caption at all', () => {
    expect(titleFrom('', 'paradisoadam')).toBe('Post by @paradisoadam')
  })
})

describe('url handling', () => {
  it('accepts the post permalinks we support and strips tracking params', () => {
    expect(normalizeUrl('https://www.instagram.com/p/CtLr8sgAeHI/?igshid=abc'))
      .toBe('https://www.instagram.com/p/CtLr8sgAeHI/')
    expect(normalizeUrl('instagram.com/reel/CtLr8sgAeHI/')).toContain('/reel/CtLr8sgAeHI')
    expect(() => normalizeUrl('https://x.com/jack/status/20')).not.toThrow()
    expect(() => normalizeUrl('https://www.tiktok.com/@a/video/6718335390845095173')).not.toThrow()
  })

  it('refuses anything that is not a single public post', () => {
    // a profile URL is the classic mistake — there is no post to read
    expect(() => normalizeUrl('https://www.instagram.com/paradisoadam/')).toThrow()
    expect(() => normalizeUrl('https://evil.example.com/p/abc/')).toThrow()
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow()
    expect(() => normalizeUrl('')).toThrow()
  })

  it('identifies platform and shortcode', () => {
    expect(platformOf('https://www.instagram.com/p/A1/')).toBe('instagram')
    expect(platformOf('https://x.com/a/status/1')).toBe('x')
    expect(shortcodeOf('https://www.instagram.com/reel/CtLr8sgAeHI/')).toBe('CtLr8sgAeHI')
    expect(shortcodeOf('https://x.com/a/status/1')).toBeUndefined()
  })
})

describe('image dimensions — how a deleted post is detected', () => {
  /** Minimal JPEG: SOI, an APP0 segment, then SOF0 carrying height/width. */
  const jpeg = (w: number, h: number): ArrayBuffer => {
    const b = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
               0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255]
    while (b.length < 24) b.push(0)
    return new Uint8Array(b).buffer
  }

  it('reads dimensions past a leading segment', () => {
    expect(imageDims(jpeg(1080, 1351))).toEqual({ w: 1080, h: 1351 })
  })
  it('reads PNG dimensions', () => {
    const b = new Uint8Array(32); b[0] = 0x89; b[1] = 0x50
    new DataView(b.buffer).setUint32(16, 800); new DataView(b.buffer).setUint32(20, 1200)
    expect(imageDims(b.buffer)).toEqual({ w: 800, h: 1200 })
  })
  it('puts the live 1080px lane above the floor and a dead post below it', () => {
    expect(Math.max(1080, 1351)).toBeGreaterThanOrEqual(MIN_DIM)  // /media/?size=l
    expect(584).toBeLessThan(MIN_DIM)                             // the deleted-post placeholder
  })
  it('returns null rather than guessing on junk', () => {
    expect(imageDims(new Uint8Array(4).buffer)).toBeNull()
  })
})

describe('applyOverrides — injecting a dropped pick', () => {
  const AT = '2026-08-01T10:00:00Z'
  const feed: Pick[] = [{
    id: 'web-1', title: 'Existing Thing', venue: 'V', area: 'A', when: '', category: 'out',
    freshness: 'weekend', outdoor: false, kid: false, price: '', blurb: '', why: '',
    source: 'S', link: 'https://e.example', weatherFit: ['WARM'],
  }]
  const drop = { title: 'Paradiso night', link: 'https://www.instagram.com/p/A1/', image: 'https://i/x.jpg' }
  const ov = (o: Partial<CurateOverrides>): CurateOverrides => ({ generatedAt: AT, ...o })

  it('adds a pasted pick the feed has never seen', () => {
    const out = applyOverrides(feed, ov({ added: [drop] }), AT)
    expect(out).toHaveLength(2)
    const added = out.find((p) => p.title === 'Paradiso night')!
    expect(added.link).toBe(drop.link)
    expect(added.image).toBe(drop.image)
    // NOT a crawl id — the airlock audits web-/llm-/rss-/sk-, and a hand-paste is its own approval
    expect(added.id.startsWith('drop-')).toBe(true)
    expect(['web-', 'llm-', 'rss-', 'sk-'].some((p) => added.id.startsWith(p))).toBe(false)
  })

  it('leaves the feed untouched when the override targets a rolled-over feed', () => {
    expect(applyOverrides(feed, ov({ added: [drop] }), '2026-08-08T10:00:00Z')).toHaveLength(1)
  })

  it('never duplicates a pick the feed already carries', () => {
    const dupe = { title: 'existing thing', link: 'https://www.instagram.com/p/B2/' }
    expect(applyOverrides(feed, ov({ added: [dupe] }), AT)).toHaveLength(1)
  })

  it('does not add a drop that was cancelled in the same round', () => {
    const out = applyOverrides(feed, ov({ added: [drop], killed: [{ title: 'Paradiso night' }] }), AT)
    expect(out.map((p) => p.title)).toEqual(['Existing Thing'])
  })

  it('lets the pile order a dropped pick like any other', () => {
    const out = applyOverrides(feed, ov({ added: [drop], pile: ['Paradiso night', 'Existing Thing'] }), AT)
    expect(out.find((p) => p.title === 'Paradiso night')!.pilePos).toBe(1)
    expect(out.find((p) => p.title === 'Existing Thing')!.pilePos).toBe(2)
  })

  it('ignores a malformed drop instead of injecting a broken card', () => {
    const bad = [{ title: '', link: 'https://x' }, { title: 'No link', link: '' }]
    expect(applyOverrides(feed, ov({ added: bad }), AT)).toHaveLength(1)
  })

  it('survives an override with no added array at all (the pre-V.9.32 shape)', () => {
    expect(applyOverrides(feed, ov({ pile: ['Existing Thing'] }), AT)).toHaveLength(1)
  })
})
