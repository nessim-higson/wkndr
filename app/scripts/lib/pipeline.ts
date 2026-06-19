// Shared pipeline spine — the part every adapter reuses. Adapters do FETCH + NORMALIZE
// (source → Pick[]); this does the rest: DEDUPE → DERIVE → ENRICH(og:image) → PUBLISH.
// Plain Bun TypeScript, no app/React imports beyond the Pick type.
import type { Mode, Pick } from '../../src/types'

const ALL_MODES: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const FAIR_MODES: Mode[] = ['HOT', 'WARM', 'COOL']

// Indoor things are weather-proof (fit every mode incl. the wet ones); outdoor things are
// fair-weather only. Adapters can override, but this is the sane default.
export function deriveWeatherFit(outdoor: boolean): Mode[] {
  return outdoor ? [...FAIR_MODES] : [...ALL_MODES]
}

// A loose IDENTITY key for an event title, for dedupe across adapters that title the same thing
// differently ("Holland Festival" vs "Holland Festival 2026: Alain Clark…"). Drop a year, take
// the part before the first separator, strip to alphanumerics. Venue is NOT part of the key —
// a festival arriving from two sources with different "venue" strings is still ONE event.
export const titleKey = (s: string) =>
  s.toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, '')                         // drop a year
    .split(/[:–—·|(]/)[0]                                      // take the part before the first separator
    .replace(/\b(amsterdam|nieuw-?west|new orleans|nola)\b/g, '')  // drop city/area tokens ("…Amsterdam")
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 28)

// Merge the same event arriving from multiple adapters. Key = title+venue. The richest
// record wins; we union the source credits (the cross-source "buzz" signal lives here).
export function dedupe(picks: Pick[]): Pick[] {
  // merge b INTO a: richer record (longer blurb / has image) wins, credits union, buzz = #sources
  const merge = (a: Pick, b: Pick): Pick => {
    const richer = (b.blurb?.length ?? 0) + (b.image ? 50 : 0) > (a.blurb?.length ?? 0) + (a.image ? 50 : 0) ? b : a
    const credits = new Set((a.source + ' · ' + b.source).split(' · ').filter(Boolean))
    return { ...a, ...richer, source: [...credits].join(' · '), buzz: credits.size }
  }

  // PASS 1 — exact normalized-title key.
  const byKey = new Map<string, Pick>()
  for (const p of picks) {
    const key = titleKey(p.title)
    byKey.set(key, byKey.has(key) ? merge(byKey.get(key)!, p) : { ...p })
  }

  // PASS 2 — collapse near-dups where one key is a PREFIX of another (≥10 chars): catches
  // "Guns N' Roses" vs "Guns N' Roses and Mammoth", "Open Garden Days" vs "…(Open Tuinen Dagen)".
  // Shortest key is the canonical survivor (sort ascending so prefixes are seen first).
  const out = new Map<string, Pick>()
  for (const key of [...byKey.keys()].sort((a, b) => a.length - b.length || a.localeCompare(b))) {
    const base = [...out.keys()].find((o) => o.length >= 10 && key.startsWith(o))
    if (base) out.set(base, merge(out.get(base)!, byKey.get(key)!))
    else out.set(key, byKey.get(key)!)
  }
  return [...out.values()]
}

// Keep the pool DIVERSE: cap how many of each category make the cut, so a firehose source
// (e.g. a ticketing feed full of gigs) can't drown out food / art / free / markets.
export function balanceByCategory(picks: Pick[], perCat = 6): Pick[] {
  const count: Record<string, number> = {}
  const kept: Pick[] = []
  for (const p of picks) {                                       // assumes input is already buzz/quality-ordered
    const c = count[p.category] ?? 0
    if (c >= perCat) continue
    count[p.category] = c + 1
    kept.push(p)
  }
  return kept
}

// Strip HTML to readable text for the LLM (drop script/style/nav noise, collapse whitespace).
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// ─── IMAGE QUALITY SCREEN ───────────────────────────────────────────────────
// A card image must be a real PHOTO, not a logo/favicon/placeholder/share-graphic.
// We reject by URL shape AND by real pixel dimensions, so a blown-up 100×100 logo
// (e.g. a site's facebook.png) can never reach a card again.
const MIN_DIM = 600                 // shortest side must be ≥ this
const ASPECT_RANGE: [number, number] = [0.42, 2.6]   // not a banner strip, not a square icon
const LOGO_URL = /logo|favicon|icon|sprite|placeholder|wordmark|social[-_]?shar|sharing[-_]?image|og[-_]?default|default[-_]?(og|share)|avatar|thumbnail|pictogram|picotogram|badge|emblem/i
// Stock-agency hosts plaster a watermark across the image (the "alamy"/"getty" scrawl). Reject
// by host from ANY source (web search, og:image, scraped) — never let one reach a card.
const STOCK_URL = /alamy|shutterstock|gettyimages|istockphoto|\bistock\b|dreamstime|123rf|depositphotos|stock\.adobe|adobestock|stockphoto|\.stock\.|bigstock|agefotostock|picfair|pond5|vectorstock|stocksy/i

// Parse pixel dimensions from the first bytes of PNG / JPEG / GIF / WEBP.
function imageDims(b: Uint8Array): [number, number] | null {
  if (b.length < 24) return null
  if (b[0] === 0x89 && b[1] === 0x50) { const dv = new DataView(b.buffer, b.byteOffset); return [dv.getUint32(16), dv.getUint32(20)] }   // PNG
  if (b[0] === 0x47 && b[1] === 0x49) return [b[6] | b[7] << 8, b[8] | b[9] << 8]                                                          // GIF
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {                                                                // WEBP
    const fmt = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (fmt === 'VP8 ') return [(b[26] | b[27] << 8) & 0x3fff, (b[28] | b[29] << 8) & 0x3fff]
    if (fmt === 'VP8X') return [1 + (b[24] | b[25] << 8 | b[26] << 16), 1 + (b[27] | b[28] << 8 | b[29] << 16)]
  }
  if (b[0] === 0xff && b[1] === 0xd8) {                                                                                                    // JPEG
    let i = 2
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue }
      const mk = b[i + 1]
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return [b[i + 7] << 8 | b[i + 8], b[i + 5] << 8 | b[i + 6]]
      i += 2 + (b[i + 2] << 8 | b[i + 3])
    }
  }
  return null
}

/** True if `url` resolves to a real, card-worthy photo (right shape + resolution). Requires
 *  HTTPS — an http:// image is mixed-content-blocked by the browser on the https site (a blank
 *  card), even though a server-side fetch of it succeeds. */
export async function isGoodImage(url: string, timeoutMs = 8000): Promise<boolean> {
  // also reject the notorious I amsterdam "Canal Parade" site hero (a Pride photo it serves as the
  // og:image on unrelated event pages) — passes every quality screen but is the wrong subject.
  if (!url.startsWith('https://') || LOGO_URL.test(url) || STOCK_URL.test(url) || /canal[-_]?parade/i.test(url)) return false
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { headers: { 'user-agent': UA, range: 'bytes=0-65535' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return false
    const wh = imageDims(new Uint8Array(await res.arrayBuffer()))
    if (!wh) return true                                  // couldn't parse (progressive/odd) — give benefit of the doubt
    const [w, h] = wh, ar = w / h
    return Math.min(w, h) >= MIN_DIM && ar >= ASPECT_RANGE[0] && ar <= ASPECT_RANGE[1]
  } catch {
    return false
  }
}

// ─── STALE-DATE FILTER ───────────────────────────────────────────────────────
// A pick's human `when` ("Sat 6 Jun", "Fri–Sun 5–7 Jun", "Until 21 Jun", "Opens 5 Jun ·
// until 25 Oct", "Daily · dinner") → is its LATEST date already in the past? Undated /
// evergreen whens are never stale. Catches both stale canon and LLM picks that scraped
// already-finished events off a source page.
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
const MONTH_RE = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'

/** The LATEST concrete date a `when` refers to, or null if it's evergreen/undated. */
function latestDateOf(when: string, now: Date): Date | null {
  const s = (when || '').toLowerCase()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let latest: Date | null = null
  const consider = (mon: number, day: number) => {
    if (mon < 0 || day < 1 || day > 31) return
    let dt = new Date(now.getFullYear(), mon, day)
    // if that lands well in the past (>45d), it's almost certainly next year's occurrence
    if (dt < today && today.getTime() - dt.getTime() > 45 * 864e5) dt = new Date(now.getFullYear() + 1, mon, day)
    if (!latest || dt > latest) latest = dt
  }
  for (const m of s.matchAll(new RegExp(`(\\d{1,2})\\s*[–-]?\\s*(\\d{1,2})?\\s*(${MONTH_RE})`, 'g')))
    consider(MONTHS[m[3]], Math.max(+m[1], m[2] ? +m[2] : 0))
  for (const m of s.matchAll(new RegExp(`(${MONTH_RE})\\s*(\\d{1,2})`, 'g')))
    consider(MONTHS[m[1]], +m[2])
  return latest
}

export function whenIsPast(when: string, now: Date = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const latest = latestDateOf(when, now)
  return latest ? latest < today : false   // no parseable date → evergreen → keep
}

// ─── WEEKEND FOCUS ───────────────────────────────────────────────────────────
// WKNDR is a WEEKEND app: on a Monday the feed should point at the COMING Sat–Sun, not at
// today's mid-week one-offs. This computes that weekend and screens out dated weekday events
// that finish before it (evergreen restaurants/museums + weekend-or-later events stay).

/** The upcoming weekend (Sat + Sun), plus the Friday cutoff (we keep the Fri run-up). If today
 *  is itself Sat/Sun, that IS the weekend. */
export function upcomingWeekend(now: Date = new Date()): { sat: Date; sun: Date; cutoff: Date } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = d.getDay()                                   // 0 Sun … 6 Sat
  const sat = new Date(d)
  if (dow === 0) sat.setDate(d.getDate() - 1)              // Sun → this weekend's Sat was yesterday
  else if (dow !== 6) sat.setDate(d.getDate() + (6 - dow)) // Mon–Fri → the next Saturday
  const sun = new Date(sat); sun.setDate(sat.getDate() + 1)
  const cutoff = new Date(sat); cutoff.setDate(sat.getDate() - 1)   // Friday — include the run-up
  return { sat, sun, cutoff }
}

/** A dated one-off that ENDS before this weekend's Friday — i.e. weekday filler, not weekend
 *  content. Evergreen / ongoing / weekend-or-later picks return false (kept). */
export function whenBeforeWeekend(when: string, now: Date = new Date()): boolean {
  const latest = latestDateOf(when, now)
  return latest ? latest < upcomingWeekend(now).cutoff : false
}

/** Is a URL definitively DEAD (a 404/410)? Catches LLM-fabricated slug links so a pick's "open
 *  at" never dead-ends. CONSERVATIVE on purpose: only a hard not-found/gone counts as dead — a
 *  bot-block (403), a 5xx, a timeout, or any network hiccup returns OK, so we never nuke a real
 *  link we just couldn't reach. (No range header — it corrupts gzip/brotli bodies → false deaths.) */
export async function linkOk(url: string, timeoutMs = 8000): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    return res.status !== 404 && res.status !== 410
  } catch {
    return true   // unreachable ≠ dead — benefit of the doubt, keep the link
  }
}

// Best-effort og:image scrape for a single page, SCREENED for quality. Returns a real-photo
// URL or null. Never throws — a blocked/slow page or a logo-only og:image → poster fallback.
export async function fetchOgImage(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok) return null
    const html = await res.text()
    const m =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    if (!m) return null
    let img = m[1].trim()
    if (img.startsWith('//')) img = 'https:' + img
    if (img.startsWith('/')) { const u = new URL(url); img = u.origin + img }
    img = img.replace(/^http:\/\//i, 'https://')          // avoid mixed-content blanks
    if (!img.startsWith('http')) return null
    return (await isGoodImage(img)) ? img : null          // SCREEN: reject logos / low-res / wrong-shape / non-https
  } catch {
    return null
  }
}

// WEB-SEARCH image fallback via Wikipedia: search for the entity (artist / film / show /
// venue) and return its lead photo (a real Wikimedia image of the actual subject). Keyless.
// Best for named entities — the caller should gate it to safe categories so a restaurant
// like "Belly Pepper" can't collide with the "bell pepper" article. Retries once on the
// rate-limit HTML response. The result is still run through isGoodImage by the caller.
const WIKI_UA = 'WKNDR/1.0 (https://github.com/nessim-higson/wkndr; weekend discovery) content-pipeline'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export async function wikiImage(query: string): Promise<string | null> {
  const api = (params: string) =>
    fetch(`https://en.wikipedia.org/w/api.php?${params}&format=json&origin=*`, { headers: { 'user-agent': WIKI_UA, accept: 'application/json' } })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const s = await api(`action=query&list=search&srlimit=1&srsearch=${encodeURIComponent(query)}`)
      if (!s.ok) { await sleep(700); continue }
      const title = (await s.json())?.query?.search?.[0]?.title
      if (!title) return null
      const p = await api(`action=query&prop=pageimages&piprop=original|thumbnail&pithumbsize=1200&titles=${encodeURIComponent(title)}`)
      if (!p.ok) { await sleep(700); continue }
      const page = Object.values((await p.json())?.query?.pages || {})[0] as { original?: { source?: string }; thumbnail?: { source?: string } } | undefined
      const img = page?.original?.source || page?.thumbnail?.source
      return typeof img === 'string' && img.startsWith('http') ? img : null
    } catch { await sleep(700) }
  }
  return null
}

// WEB IMAGE SEARCH (keyless, via DuckDuckGo) — the broad fallback: find a real, subject-accurate
// photo from the open web for any pick the sources don't supply one for (a restaurant's own
// shot, a venue, an artist). Returns the first result that passes the quality screen AND is
// actually hotlinkable; tries several so a blocked/low-res top hit doesn't sink it.
export async function webImage(query: string): Promise<string | null> {
  try {
    const page = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(query) + '&iax=images&ia=images',
      { headers: { 'user-agent': UA, accept: 'text/html' } }).then((r) => r.text())
    const vqd = page.match(/vqd=["']?([\d-]+)["']?/)?.[1]
    if (!vqd) return null
    await sleep(250)
    const data = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
      { headers: { 'user-agent': UA, referer: 'https://duckduckgo.com/' } }).then((r) => r.json()).catch(() => null)
    const results: { image?: string; width?: number; height?: number }[] = data?.results || []
    // RANK relevance-FIRST (DuckDuckGo's order ≈ subject accuracy — critical, since we can't
    // verify the subject), with image SHAPE as a gentle tiebreak: only an EXTREME banner/panorama
    // (aspect > ~2.0) — which crops to a broken seam on a portrait card — gets pushed down. We
    // never reorder a merely-landscape shot ahead of the most on-topic result. Dimensions come
    // from DuckDuckGo's payload, so ranking costs no extra fetches.
    const penalty = (r: { width?: number; height?: number }) => {
      const w = Number(r.width), h = Number(r.height)
      if (!w || !h) return 0
      const ar = w / h
      return ar > 2.0 ? 3 : ar > 1.7 ? 1 : 0       // demote panoramas a few slots; nudge wide shots one
    }
    const ranked = results
      .filter((r) => typeof r.image === 'string' && r.image!.startsWith('http') && !STOCK_URL.test(r.image!))
      .map((r, i) => ({ r, key: i + penalty(r) }))   // relevance index + a small shape nudge
      .sort((a, b) => a.key - b.key)
    for (const { r } of ranked.slice(0, 10)) {
      const u = r.image!.replace(/^http:\/\//i, 'https://')   // secure version (most hosts serve both; http = mixed-content-blocked)
      if (await isGoodImage(u)) return u
    }
    return null
  } catch {
    return null
  }
}

// THEMED STOCK (Pexels) — vivid, licensed photography keyed to the event's theme. The fix for the
// "dull / wrong borrowed photo" problem: for an event with no trustworthy per-event photo we query
// Pexels by its OWN theme ("Queer Power" → queer-art imagery, "Bacchus Wine Festival" → wine shots)
// so the image is vibrant AND on-theme, and never an embarrassing wrong civic subject. Needs a free
// PEXELS_API_KEY (https://www.pexels.com/api/). `salt` (an id hash) varies which of the top results
// we take, so several same-theme events don't all land on the identical photo. Returns null on any
// miss → the caller falls back to the canon bank, so a missing key never blanks a card.
export async function pexelsImage(query: string, salt = 0): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY
  if (!key || !query.trim()) return null
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&orientation=portrait&size=medium`
    const res = await fetch(url, { headers: { Authorization: key } }).then((r) => r.json()).catch(() => null)
    const photos: { src?: { portrait?: string; large?: string; large2x?: string } }[] = res?.photos || []
    if (!photos.length) return null
    const p = photos[salt % photos.length]
    const src = p?.src?.portrait || p?.src?.large2x || p?.src?.large
    return typeof src === 'string' && src.startsWith('https://') ? src : null
  } catch {
    return null
  }
}

// Run an async fn over items with a concurrency cap (be polite to source servers).
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
