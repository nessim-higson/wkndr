// READ THE LISTINGS — the carousel + vision pass (worker /drop/read).
//
// The fixture is a real slice of the Googlebot-rendered page for
// instagram.com/p/DbTKYb2imA9/ (@doubleamagazine's weekly Amsterdam roundup, 8 slides), captured
// 2026-08-02. It deliberately KEEPS the surrounding markup, because the bug this guards against was
// parsing the whole document: the page also embeds the account's other recent posts in the same
// "code"/"display_uri" shape, and an unscoped parse returned 20 "slides" for an 8-slide post.
import { describe, it, expect } from 'bun:test'
import { parseSlides, fullImageUrl } from '../../worker/curate/src/extract'
import { toBase64, MAX_SLIDES } from '../../worker/curate/src/roundup'

const html = await Bun.file(new URL('./fixtures-roundup.html', import.meta.url)).text()

// yt-dlp's own enumeration of the same post — the independent check on our parse
const CHILDREN = [
  'DbTJ6dgKGQs', 'DbTJ6hGqA1Y', 'DbTJ6kpqzjw', 'DbTJ6nQqVNF',
  'DbTJ6p7qPto', 'DbTJ6tuqUGJ', 'DbTJ6waKrwN', 'DbTJ6zhKDHz',
]

describe('carousel slides', () => {
  it('finds exactly the carousel children, in slide order', () => {
    expect(parseSlides(html).map((s) => s.code)).toEqual(CHILDREN)
  })

  it('does not swallow the account\'s other posts embedded on the same page', () => {
    // the decoy: codes present in the fixture but OUTSIDE the carousel_media array
    const codes = parseSlides(html).map((s) => s.code)
    for (const decoy of ['DbgJ64jCvN3', 'Dba8Ov-iseT', 'DbYhGywCriC', 'DbTKYb2imA9']) {
      expect(codes).not.toContain(decoy)
    }
  })

  it('unescapes the JSON-escaped image urls', () => {
    for (const s of parseSlides(html)) {
      expect(s.thumb.startsWith('https://')).toBe(true)
      expect(s.thumb).not.toContain('\\/')
    }
  })

  it('points the vision pass at the FULL image, not the 512px display_uri', () => {
    // display_uri is 512×640 — too small to read dense listings off reliably
    const s = parseSlides(html)[1]
    expect(s.full).toBe('https://www.instagram.com/p/DbTJ6hGqA1Y/media/?size=l')
    expect(s.full).not.toBe(s.thumb)
    expect(fullImageUrl('ABC')).toContain('/p/ABC/media/?size=l')
  })

  it('returns nothing for a post with no carousel, so the caller falls back', () => {
    expect(parseSlides('<html>no carousel here</html>')).toEqual([])
    expect(parseSlides('')).toEqual([])
  })

  it('is not fooled by a bracket inside a caption string', () => {
    const tricky = '{"carousel_media":[{"caption":"a ] bracket","code":"AAAAA","display_uri":"https://x/1.jpg"}],'
      + '"other":[{"code":"ZZZZZ","display_uri":"https://x/2.jpg"}]}'
    expect(parseSlides(tricky).map((s) => s.code)).toEqual(['AAAAA'])
  })

  it('caps how many slides one post can spend', () => {
    expect(MAX_SLIDES).toBeGreaterThanOrEqual(8)
    expect(MAX_SLIDES).toBeLessThanOrEqual(20)
  })
})

describe('base64 (Workers have no Buffer)', () => {
  const enc = (s: string) => toBase64(new TextEncoder().encode(s).buffer as ArrayBuffer)

  it('matches btoa across every padding case', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'abcd', 'hello world', 'M'.repeat(61)]) {
      expect(enc(s)).toBe(btoa(s))
    }
  })

  it('handles binary bytes a string-based encoder would corrupt', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])  // a JPEG header
    const b64 = toBase64(bytes.buffer as ArrayBuffer)
    expect(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))).toEqual(bytes)
  })
})
