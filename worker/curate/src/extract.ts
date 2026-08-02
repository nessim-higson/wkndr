// THE DROP BOX — turn a pasted social link into a WKNDR pick, server-side.
//
// Why this exists: getting real Amsterdam events out of Instagram was the long-running content
// blocker (docs/backlog.md). The tools that "read an IG link" don't scrape the app — they read
// the same OpenGraph tags Instagram serves to link-preview bots, which needs no login, no cookie
// and no API key. Verified live 2026-08-02.
//
// The two lanes, in order:
//   1. TEXT — GET the post with a crawler UA. Instagram/TikTok/X hand back og:description, which
//      for IG carries "<likes> likes, <comments> comments - <author> on <date>: "<caption>"".
//      The UA matters: facebookexternalhit + Twitterbot + Googlebot all work, WhatsApp returns an
//      EMPTY og:description. TikTok has a keyless oEmbed; X only answers via the fxtwitter mirror.
//   2. IMAGE — og:image is a preview thumbnail capped at ~640px (and only 360px on a reel), which
//      would trip the app's low-res gate. `/p/<code>/media/?size=l` redirects to the NATIVE image
//      (1080px) with no auth. That one call is the difference between unusable and full-res.
//
// Two traps, both of which fail silently if you get them wrong:
//   - og:image arrives HTML-escaped. Feed `&amp;` to the CDN and the signed URL is rejected with
//     "Bad URL hash". Always unescape before fetching.
//   - the size token in the CDN URL is covered by the `oh=` signature, so you CANNOT rewrite
//     `s640x640` upward — that returns 403. `?size=l` is the only way up.
//
// A deleted or private post still answers 200, with a small fallback image — hence MIN_DIM.

export const CRAWLER_UA = 'facebookexternalhit/1.1'
export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
/** Instagram server-renders the FULL post JSON — carousel children included — only for Googlebot.
 *  Every other UA (including facebookexternalhit and a real Chrome string) gets a shell with just
 *  the first slide. This is the only keyless way in to slides 2..n. */
export const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

/** Under this on the long edge means Instagram served a placeholder, i.e. the post is gone. */
export const MIN_DIM = 600
/** The app's own low-res floor (lib/pipeline isGoodImage) — below this we still take the pick but flag it. */
export const GOOD_DIM = 800

export type Drop = {
  url: string
  platform: 'instagram' | 'tiktok' | 'x' | 'unknown'
  title: string
  caption: string
  author?: string
  date?: string
  likes?: number
  comments?: number
  image?: string // wsrv-wrapped, ready to render
  imageOriginal?: string // the raw CDN url, for the board's loupe
  width?: number
  height?: number
  lowRes?: boolean
  lane: string
}

/** Mirror of scripts/lib/pipeline.ts toPortrait — every WKNDR card image is a wsrv 800×1200 render.
 *  Not cosmetic: Instagram's CDN refuses hotlinked requests from a browser, so an unwrapped scontent
 *  URL renders as a broken image on both the board and the card. wsrv fetches SERVER-SIDE, which is
 *  what makes the image show up at all. `default=` falls back to the original if wsrv itself flakes. */
export function toPortrait(url: string, w = 800, h = 1200): string {
  if (!url || !url.startsWith('https://') || /images\.weserv\.nl/i.test(url)) return url
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}&h=${h}&fit=cover&a=attention&output=jpg&default=${encodeURIComponent(url)}`
}

export class DropError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ', '#x27': "'",
}

/** Minimal HTML entity decode — enough for og: content, including the &#x1f4f8; emoji IG emits. */
export function unescapeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (ENTITIES[e]) return ENTITIES[e]
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16))
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10))
    return m
  })
}

/** Pull a <meta property|name="X" content="Y"> value, attributes in either order. */
export function meta(doc: string, prop: string): string | undefined {
  const p = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const a = doc.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["']`, 'i'))
  if (a) return unescapeHtml(a[1]).trim()
  const b = doc.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`, 'i'))
  return b ? unescapeHtml(b[1]).trim() : undefined
}

// "5,628 likes, 101 comments - benjitalent on June 7, 2023: "Figure It Out live from Paradiso"."
// The trailing quote is OPTIONAL: Instagram truncates long captions with an ellipsis and drops it,
// which is why a naive /"(.*)"/ silently returns the whole prefix as the caption.
const OG_DESC =
  /^(?:([\d,.]+[KM]?)\s+likes?,\s*([\d,.]+[KM]?)\s+comments?\s*-\s*)?(\S+?)\s+on\s+(.+?):\s*["“”](.*?)["“”]?\.?\s*$/s

/** "41M" / "5,628" → 41000000 / 5628 */
export function parseCount(s?: string): number | undefined {
  if (!s) return undefined
  const m = s.match(/^([\d,.]+)([KM]?)$/)
  if (!m) return undefined
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return undefined
  return Math.round(n * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1))
}

export function parseOgDescription(desc?: string): Partial<Drop> {
  if (!desc) return {}
  const m = OG_DESC.exec(desc.trim())
  if (!m) return { caption: desc.trim() }
  return {
    likes: parseCount(m[1]),
    comments: parseCount(m[2]),
    author: m[3],
    date: m[4],
    caption: m[5].trim(),
  }
}

/** First sentence / line of the caption, trimmed to a card-sized title. */
export function titleFrom(caption: string, author?: string): string {
  const first = (caption || '').split(/\n|(?<=[.!?])\s+/).map((s) => s.trim()).find(Boolean)
  const t = (first || caption || '').replace(/\s+/g, ' ').trim()
  if (!t) return author ? `Post by @${author}` : 'Untitled post'
  return t.length > 90 ? t.slice(0, 87).replace(/[\s,;:–-]+$/, '') + '…' : t
}

/** Instagram serves a post at BOTH /p/<code>/ and /<username>/p/<code>/ — copying a link from a
 *  profile gives the second form, so the username segment has to be optional here. */
const IG_POST = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|tv)\/([A-Za-z0-9_-]+)/

export function shortcodeOf(url: string): string | undefined {
  return url.match(IG_POST)?.[1]
}

export function platformOf(url: string): Drop['platform'] {
  if (/instagram\.com/i.test(url)) return 'instagram'
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/(twitter|x)\.com/i.test(url)) return 'x'
  return 'unknown'
}

/** Accept only public post permalinks — never a private host, never a non-post path. */
export function normalizeUrl(raw: string): string {
  const s = (raw || '').trim()
  if (!s) throw new DropError('Paste a link first.', 'empty')
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    throw new DropError("That doesn't look like a link.", 'badurl')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new DropError('Links only.', 'badurl')
  const host = u.hostname.replace(/^www\./, '').toLowerCase()

  // Canonicalise Instagram to /p/<code>/ regardless of which form was pasted. Both the bare
  // /p/<code>/ and the profile-copied /<username>/p/<code>/ resolve to the same post, so folding
  // them here means the same post pasted twice dedupes instead of landing as two picks.
  if (host === 'instagram.com') {
    const code = shortcodeOf(u.toString())
    if (!code) {
      throw new DropError(
        'That looks like a profile, not a post — open the post first, then copy its link.',
        'unsupported',
      )
    }
    return `https://www.instagram.com/p/${code}/`
  }

  const ok =
    (host === 'tiktok.com' && /\/(?:video|photo)\/\d+/.test(u.pathname)) ||
    (host === 'tiktok.com' && /^\/t\/[A-Za-z0-9]+/.test(u.pathname)) ||
    host === 'vm.tiktok.com' ||
    ((host === 'twitter.com' || host === 'x.com') && /\/status(?:es)?\/\d+/.test(u.pathname))
  if (!ok) {
    throw new DropError(
      'That needs to be a link to a single public post — Instagram, TikTok or X.',
      'unsupported',
    )
  }
  // `?img_index=`, `?igshid=`, utm params — none of them change which post this is.
  u.search = ''
  u.hash = ''
  return u.toString()
}

/** JPEG/PNG/WEBP dimensions from the leading bytes. Returns null when it can't tell. */
export function imageDims(buf: ArrayBuffer): { w: number; h: number } | null {
  const b = new Uint8Array(buf)
  const dv = new DataView(buf)
  if (b.length < 24) return null
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50) return { w: dv.getUint32(16), h: dv.getUint32(20) }
  // WEBP (VP8X / VP8L / VP8 )
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const tag = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (tag === 'VP8X') return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) }
    if (tag === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff }
  }
  // JPEG — walk the segment chain to the SOF marker
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue }
      const marker = b[i + 1]
      if (marker >= 0xc0 && marker <= 0xc3) return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
      const len = dv.getUint16(i + 2)
      if (len < 2) return null
      i += 2 + len
    }
  }
  return null
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

/** One slide of a carousel post.
 *  `thumb` is the page's own `display_uri` — only 512×640, fine for a preview and useless for
 *  reading dense listings. `full` is the per-child native image (1080px), which is what the vision
 *  pass must use or small text is lost. */
export type Slide = { code: string; thumb: string; full: string }

export const fullImageUrl = (code: string) => `https://www.instagram.com/p/${code}/media/?size=l`

/** Pull the carousel children out of a Googlebot-rendered post page.
 *
 *  MUST be scoped to the `carousel_media` array: the page also embeds the account's OTHER recent
 *  posts as thumbnails, in the same `"code"/"display_uri"` shape. Parsing the whole document
 *  returned 20 "slides" for an 8-slide post — 12 of them unrelated posts.
 *
 *  Inside the array each child is `"code":"<shortcode>","display_uri":"<url>"`, JSON-escaped
 *  (`\/` for every slash). Parsing the pair together preserves slide order, which a roundup needs.
 *  A non-carousel post has no such array → [] → the caller falls back to the single-image lane. */
export function parseSlides(html: string): Slide[] {
  const at = html.indexOf('"carousel_media"')
  if (at < 0) return []
  const open = html.indexOf('[', at)
  if (open < 0) return []

  // Walk to the matching close bracket, skipping brackets that sit inside string literals
  // (captions routinely contain them) and honouring backslash escapes.
  let depth = 0
  let end = -1
  let inStr = false
  let esc = false
  for (let i = open; i < html.length; i++) {
    const c = html[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end < 0) return []

  const out: Slide[] = []
  const seen = new Set<string>()
  const re = /"code":"([A-Za-z0-9_-]{5,})"\s*,\s*"display_uri":"((?:[^"\\]|\\.)*)"/g
  for (const m of html.slice(open, end).matchAll(re)) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    const thumb = m[2].replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/\\"/g, '"')
    if (thumb.startsWith('https://')) out.push({ code: m[1], thumb, full: fullImageUrl(m[1]) })
  }
  return out
}

/** Every slide of a post, best-effort. Returns [] when the page can't be read — the caller keeps
 *  whatever the normal single-image lane already found rather than failing the whole drop. */
export async function carouselSlides(url: string, fetchFn: Fetcher = fetch): Promise<Slide[]> {
  const code = shortcodeOf(url)
  if (!code) return []
  try {
    const r = await fetchFn(`https://www.instagram.com/p/${code}/`, {
      headers: { 'User-Agent': GOOGLEBOT_UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (!r.ok) return []
    return parseSlides(await r.text())
  } catch {
    return []
  }
}

async function text(fetchFn: Fetcher, url: string, ua: string): Promise<string> {
  const r = await fetchFn(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9' } })
  if (!r.ok) throw new DropError(`The post didn't load (${r.status}).`, 'fetch')
  return await r.text()
}

/** The native-resolution image. Returns undefined when the platform has no such endpoint. */
async function fullResImage(
  fetchFn: Fetcher,
  url: string,
): Promise<{ image: string; width?: number; height?: number } | undefined> {
  const code = shortcodeOf(url)
  if (!code) return undefined
  const r = await fetchFn(`https://www.instagram.com/p/${code}/media/?size=l`, {
    headers: { 'User-Agent': BROWSER_UA },
    redirect: 'follow',
  })
  if (!r.ok || !(r.headers.get('Content-Type') || '').startsWith('image/')) return undefined
  const dims = imageDims(await r.arrayBuffer())
  return { image: r.url, width: dims?.w, height: dims?.h }
}

async function fromInstagram(fetchFn: Fetcher, url: string): Promise<Drop> {
  const doc = await text(fetchFn, url, CRAWLER_UA)
  const parsed = parseOgDescription(meta(doc, 'og:description'))
  const hi = await fullResImage(fetchFn, url)
  const image = hi?.image ?? meta(doc, 'og:image')
  const long = Math.max(hi?.width ?? 0, hi?.height ?? 0)

  // A deleted/private post answers 200 with a small placeholder — that's the tell.
  if (long && long < MIN_DIM && !parsed.caption) {
    throw new DropError('That post is gone — deleted, or the account is private.', 'gone')
  }
  if (!parsed.caption && !image) {
    throw new DropError("Instagram didn't return anything for that link.", 'empty-response')
  }
  const caption = parsed.caption ?? ''
  return {
    url,
    platform: 'instagram',
    title: titleFrom(caption, parsed.author),
    caption,
    author: parsed.author,
    date: parsed.date,
    likes: parsed.likes,
    comments: parsed.comments,
    image: image ? toPortrait(image) : undefined,
    imageOriginal: image,
    width: hi?.width,
    height: hi?.height,
    lowRes: long > 0 && long < GOOD_DIM,
    lane: hi ? 'og + media?size=l' : 'og',
  }
}

async function fromTikTok(fetchFn: Fetcher, url: string): Promise<Drop> {
  const r = await fetchFn(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': BROWSER_UA },
  })
  if (!r.ok) throw new DropError("TikTok didn't return that post.", 'fetch')
  const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
  const caption = j.title ?? ''
  if (!caption && !j.thumbnail_url) throw new DropError('That TikTok came back empty.', 'empty-response')
  return {
    url, platform: 'tiktok', title: titleFrom(caption, j.author_name), caption,
    author: j.author_name,
    image: j.thumbnail_url ? toPortrait(j.thumbnail_url) : undefined,
    imageOriginal: j.thumbnail_url, lane: 'tiktok oembed',
  }
}

async function fromX(fetchFn: Fetcher, url: string): Promise<Drop> {
  // X blocks both its own oembed and crawler UAs now; the fxtwitter mirror still answers.
  // It 401s a request with no User-Agent, which is exactly what a Worker subrequest sends by
  // default — so the header is load-bearing, not decoration.
  const r = await fetchFn(url.replace(/(twitter|x)\.com/i, 'api.fxtwitter.com'), {
    headers: { 'User-Agent': BROWSER_UA },
  })
  if (!r.ok) throw new DropError("That post didn't load — X links go through a mirror that may be down.", 'fetch')
  const j = (await r.json()) as {
    tweet?: { text?: string; author?: { screen_name?: string }; media?: { photos?: { url: string }[] } }
  }
  const t = j.tweet
  if (!t?.text) throw new DropError('That post came back empty.', 'empty-response')
  return {
    url, platform: 'x', title: titleFrom(t.text, t.author?.screen_name), caption: t.text,
    author: t.author?.screen_name,
    image: t.media?.photos?.[0]?.url ? toPortrait(t.media.photos[0].url) : undefined,
    imageOriginal: t.media?.photos?.[0]?.url, lane: 'fxtwitter',
  }
}

export async function extractDrop(rawUrl: string, fetchFn: Fetcher = fetch): Promise<Drop> {
  const url = normalizeUrl(rawUrl)
  switch (platformOf(url)) {
    case 'instagram': return await fromInstagram(fetchFn, url)
    case 'tiktok': return await fromTikTok(fetchFn, url)
    case 'x': return await fromX(fetchFn, url)
    default: throw new DropError('Unsupported link.', 'unsupported')
  }
}
