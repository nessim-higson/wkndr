// Shared pipeline spine — the part every adapter reuses. Adapters do FETCH + NORMALIZE
// (source → Pick[]); this does the rest: DEDUPE → DERIVE → ENRICH(og:image) → PUBLISH.
// Plain Bun TypeScript, no app/React imports beyond the Pick type and the shared date
// brain (src/lib/when.ts — the ONE place `when` strings are parsed, build- and runtime).
import type { Mode, Pick } from '../../src/types'
import { latestDateOf } from '../../src/lib/when'
import corpus from '../taste/corpus.json'

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

// WORD-ORDER-BLIND identity key: strip diacritics + stopwords, SORT the tokens. Catches the twins
// prefix rules can't — "Openluchttheater Vondelpark" ⇄ "Vondelpark Openluchttheater", "Throwback
// AMSTERDAM - Back to 80s…" ⇄ "Throwback | Back to 80s…". Returns '' (= no key, never matches)
// under 2 meaningful tokens so short names can't over-merge.
const TOK_STOP = new Set(['the', 'a', 'an', 'de', 'het', 'een', 'at', 'in', 'on', 'of', 'and', 'en', 'bij', 'to', 'met', 'with', 'w', 'amsterdam', 'festival', 'back'])
export const tokKey = (s: string): string => {
  const toks = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter((x) => x && !TOK_STOP.has(x))
  return toks.length >= 2 ? [...new Set(toks)].sort().join(' ') : ''
}

// LOOSE title match for the board's PILE-ORDER (and other title-anchored verdicts): the board
// stores card titles VERBATIM at drag time, but next week's crawl may retitle the same event
// ("Kwaku Summer Festival - Weekend 1" → "… Opening Weekend") or drop a descriptive suffix
// ("Nara Nara Egyptian restaurant" → "Nara Nara") — exact word-boundary matching then silently
// loses positions (R4 stamped 7/10). Two stages: normalized containment either way, else a
// token-overlap vote (≥75% of the smaller token set shared, min 2 tokens — tokKey's stoplist).
export function titleLooseMatch(feedTitle: string, entry: string): boolean {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const a = norm(feedTitle), b = norm(entry)
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const toks = (s: string) => new Set(s.split(' ').filter((x) => x && !TOK_STOP.has(x)))
  const ta = toks(a), tb = toks(b)
  const shared = [...ta].filter((x) => tb.has(x)).length
  return shared >= 2 && shared >= Math.min(ta.size, tb.size) * 0.75
}

// Merge the same event arriving from multiple adapters. Key = title+venue. The richest
// record wins; we union the source credits (the cross-source "buzz" signal lives here).
export function dedupe(picks: Pick[]): Pick[] {
  // merge b INTO a: richer record (longer blurb / has image) wins, credits union, buzz = #sources
  const merge = (a: Pick, b: Pick): Pick => {
    const richer = (b.blurb?.length ?? 0) + (b.image ? 50 : 0) > (a.blurb?.length ?? 0) + (a.image ? 50 : 0) ? b : a
    const credits = new Set((a.source + ' · ' + b.source).split(' · ').filter(Boolean))
    // keep the strongest draw signal through the merge — the {...richer} spread would otherwise drop it
    // when the richer record is the one WITHOUT a popularity count (e.g. a web-search dup of an RA night).
    const popularity = Math.max(a.popularity ?? 0, b.popularity ?? 0) || undefined
    return { ...a, ...richer, source: [...credits].join(' · '), buzz: credits.size, popularity }
  }

  // Structured sources (I amsterdam, RA) carry a STABLE per-event id (a slug), so two similarly-titled but
  // DISTINCT events must never collapse — key those by id. Everything keyless (web-search, canon, rss, llm)
  // keys by normalized title as before. This is what makes unioning many sources safe.
  const STRUCTURED = /^web-(iams|ra)-/

  // PASS 1 — structured picks keyed by their id; the rest by 't:'+titleKey.
  const byKey = new Map<string, Pick>()
  for (const p of picks) {
    const key = STRUCTURED.test(p.id) ? p.id : 't:' + titleKey(p.title)
    byKey.set(key, byKey.has(key) ? merge(byKey.get(key)!, p) : { ...p })
  }

  // PASS 2 — collapse near-dups where one TITLE key is a PREFIX of another (≥10 chars): catches "Guns N'
  // Roses" vs "Guns N' Roses and Mammoth". Only among title-keyed picks; structured ids never prefix-collapse.
  const out = new Map<string, Pick>()
  for (const key of [...byKey.keys()].sort((a, b) => a.length - b.length || a.localeCompare(b))) {
    const p = byKey.get(key)!
    if (!key.startsWith('t:')) { out.set(key, p); continue }
    const base = [...out.keys()].find((o) => o.startsWith('t:') && o.length >= 12 && key.startsWith(o))
    if (base) out.set(base, merge(out.get(base)!, p))
    else out.set(key, p)
  }

  // PASS 2.5 — TOKEN-SET collapse among title-keyed picks: same words, different order/punctuation
  // ("Openluchttheater Vondelpark" ⇄ "Vondelpark Openluchttheater"). Prefix rules can't see these;
  // sorting the tokens can. Structured ids never collapse (two distinct events may share every word).
  {
    const byTok = new Map<string, string>()   // tokKey → the out-map key that owns it
    for (const key of [...out.keys()]) {
      if (!key.startsWith('t:')) continue
      const tk = tokKey(out.get(key)!.title)
      if (!tk) continue
      const owner = byTok.get(tk)
      if (owner && owner !== key && out.has(owner)) { out.set(owner, merge(out.get(owner)!, out.get(key)!)); out.delete(key) }
      else byTok.set(tk, key)
    }
  }

  // PASS 3 — RECONCILE across sources: a keyless pick that is the SAME event as a structured one (same
  // normalized title) folds INTO it — so an event found by BOTH I amsterdam and web-search shows ONCE, with
  // the structured pick's exact date/link/flyer kept and both sources credited (buzz counts the corroboration).
  const all = [...out.values()]
  const struct = new Map(all.filter((p) => STRUCTURED.test(p.id)).map((p) => [titleKey(p.title), p]))
  const kept: Pick[] = []
  for (const p of all) {
    if (STRUCTURED.test(p.id)) { kept.push(p); continue }
    const k = titleKey(p.title)
    let s = struct.get(k)
    // near-match fold: "World Press Photo EXHIBITION 2026" (keyless) must fold into "World Press
    // Photo 2026" (structured) — same prefix rule PASS 2 uses among keyless picks (≥12 chars).
    if (!s) for (const [sk, sp] of struct) { if ((sk.length >= 12 && k.startsWith(sk)) || (k.length >= 12 && sk.startsWith(k))) { s = sp; break } }
    if (s) {
      const credits = new Set((s.source + ' · ' + p.source).split(' · ').filter(Boolean))
      s.source = [...credits].join(' · ')
      s.buzz = credits.size
      s.popularity = Math.max(s.popularity ?? 0, p.popularity ?? 0) || undefined
    } else kept.push(p)
  }
  return kept
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
const MIN_DIM = 700                 // shortest side ≥ this — a 1200-tall card upscales smaller sources to blur
const ASPECT_RANGE: [number, number] = [0.42, 2.6]   // not a banner strip, not a square icon
const LOGO_URL = /logo|favicon|icon|sprite|placeholder|wordmark|social[-_]?shar|sharing[-_]?image|og[-_]?default|default[-_]?(og|share)|avatar|thumbnail|pictogram|picotogram|badge|emblem/i

/** Keyless URL-level screen: does this image URL smell like a logo/wordmark/stock asset rather than a real
 *  photo? Used to sanity-screen even TRUSTED organiser images — a Feed Factory upload literally named
 *  "LOGO___WORDMARK_square_black.webp" flattened to a solid black card. Cheap, deterministic, no fetch. */
export function urlLooksNonPhoto(url: string): boolean {
  return LOGO_URL.test(url) || STOCK_URL.test(url)
}
// Stock-agency + AI-upscaler hosts plaster a watermark across the image (the "alamy"/"getty"/"Magnific"
// scrawl) and/or serve a generic non-event subject. Reject by host from ANY source (web search, og:image,
// scraped) — never let one reach a card. freepik/magnific especially: Freepik owns Magnific and tiles
// "Magnific" across its premium previews (caught on a generic-theatre card for "Eye Classics").
const STOCK_URL = /alamy|shutterstock|gettyimages|istockphoto|\bistock\b|dreamstime|123rf|depositphotos|stock\.adobe|adobestock|stockphoto|\.stock\.|bigstock|agefotostock|picfair|pond5|vectorstock|stocksy|freepik|magnific|vecteezy|rawpixel|\bcanva\b|placeit|dreamfusion|lummi/i

// Parse pixel dimensions from the first bytes of PNG / JPEG / GIF / WEBP.
function imageDims(b: Uint8Array): [number, number] | null {
  if (b.length < 24) return null
  if (b[0] === 0x89 && b[1] === 0x50) { const dv = new DataView(b.buffer, b.byteOffset); return [dv.getUint32(16), dv.getUint32(20)] }   // PNG
  if (b[0] === 0x47 && b[1] === 0x49) return [b[6] | b[7] << 8, b[8] | b[9] << 8]                                                          // GIF
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {                                                                // WEBP
    const fmt = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (fmt === 'VP8 ') return [(b[26] | b[27] << 8) & 0x3fff, (b[28] | b[29] << 8) & 0x3fff]
    if (fmt === 'VP8X') return [1 + (b[24] | b[25] << 8 | b[26] << 16), 1 + (b[27] | b[28] << 8 | b[29] << 16)]
    if (fmt === 'VP8L') return [1 + (b[21] | (b[22] & 0x3f) << 8), 1 + ((b[22] >> 6) | b[23] << 2 | (b[24] & 0x0f) << 10)]   // lossless
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
  if (/[()\s]/.test(url.split('?')[0])) return false   // malformed path (raw parens/space, e.g. a Kirby "img.jpg(mediaclass-…).jpg") — wsrv chokes → grey card
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    // 256KB range — EXIF-heavy JPEGs park the SOF frame past 64KB; those used to slip the floor unparsed
    const res = await fetch(url, { headers: { 'user-agent': UA, range: 'bytes=0-262143' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return false
    const wh = imageDims(new Uint8Array(await res.arrayBuffer()))
    // UNPARSEABLE = UNVERIFIABLE = REJECT. The old benefit-of-the-doubt pass was the low-res back door:
    // an image whose dims couldn't be read skipped the resolution floor entirely — exactly the tiny
    // organiser uploads that render as bitmapped mush on the 1200-tall card. Every caller has a
    // fallback (gather chain → bank), so rejecting an oddball container costs a photo swap, not a card.
    if (!wh) return false
    const [w, h] = wh, ar = w / h
    if (Math.min(w, h) < MIN_DIM || ar < ASPECT_RANGE[0] || ar > ASPECT_RANGE[1]) return false
    // RENDER-AWARE upscale guard: the card is 800×1200 cover, so scale = max(800/w, 1200/h). A landscape
    // 1200×720 passes the 700 floor on width but stretches 1.67× in height → visible bitmap. Cap 1.6×.
    return Math.max(800 / w, 1200 / h) <= 1.6
  } catch {
    return false
  }
}

/** True if `url` is a good photo AND PORTRAIT (taller than wide). The card is a tall portrait, so a
 *  portrait source fills it with almost no crop — and since a named act's promo/Wikipedia portrait is
 *  tall while a wrong-subject landmark/crowd shot is usually landscape, requiring portrait also doubles
 *  as a light wrong-subject guard. Needs real, parseable dimensions (no benefit-of-the-doubt here). */
export async function isPortraitImage(url: string, timeoutMs = 8000): Promise<boolean> {
  if (!url.startsWith('https://') || LOGO_URL.test(url) || STOCK_URL.test(url) || /canal[-_]?parade/i.test(url)) return false
  if (/[()\s]/.test(url.split('?')[0])) return false   // malformed path (raw parens/space, e.g. a Kirby "img.jpg(mediaclass-…).jpg") — wsrv chokes → grey card
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { headers: { 'user-agent': UA, range: 'bytes=0-65535' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return false
    const wh = imageDims(new Uint8Array(await res.arrayBuffer()))
    if (!wh) return false
    const [w, h] = wh
    return Math.min(w, h) >= MIN_DIM && h >= w * 1.05   // portrait (allow a hair off square), sharp enough
  } catch {
    return false
  }
}

/** Is `url` DEFINITIVELY broken for a browser (i.e. would blank a card)? True only on a hard failure —
 *  404/410/400, a non-https URL, or a 2xx that isn't actually an image (e.g. an error page/JSON, which is
 *  exactly what a dead wsrv source returns). A 429/5xx/timeout/network hiccup returns FALSE (transient —
 *  never replace a good image over a rate-limit). Used for the final feed sweep so no dead image ships. */
export async function imageBroken(url: string, timeoutMs = 9000): Promise<boolean> {
  if (!url || !url.startsWith('https://')) return true
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/*' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (res.status === 404 || res.status === 410 || res.status === 400) return true
    if (!res.ok) return false                                    // 429 / 5xx → transient, keep
    return !(res.headers.get('content-type') || '').startsWith('image/')   // 2xx but not an image → broken
  } catch {
    return false                                                  // network / timeout → keep (don't nuke over a hiccup)
  }
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

// Pull an image out of schema.org Event / ImageObject JSON-LD — the organizer's per-event photo, which is
// more reliable for events than the page's social og:image (often a generic site hero). Walks every
// <script type="application/ld+json"> block for the first usable `image` (string | string[] | {url|contentUrl}).
function jsonLdImage(html: string): string | null {
  const pickFrom = (img: unknown): string | null => {
    if (typeof img === 'string') return img
    if (Array.isArray(img)) { for (const it of img) { const u = pickFrom(it); if (u) return u } return null }
    if (img && typeof img === 'object') { const o = img as Record<string, unknown>; const u = o.url ?? o.contentUrl; return typeof u === 'string' ? u : null }
    return null
  }
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) { for (const it of node) { const u = walk(it); if (u) return u } return null }
    const o = node as Record<string, unknown>
    if (o.image) { const u = pickFrom(o.image); if (u) return u }
    for (const v of Object.values(o)) if (v && typeof v === 'object') { const u = walk(v); if (u) return u }
    return null
  }
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const u = walk(JSON.parse(m[1].trim())); if (u) return u } catch { /* malformed block — skip */ }
  }
  return null
}

// Event-page image, screened: schema.org Event JSON-LD image FIRST (the organizer's per-event photo), then
// og:image / twitter:image — ONE fetch, returns a real-photo URL or null. The per-event JSON-LD image is
// what lets a festival/market/exhibition (no reliable open-web photo of itself) get a TRUE picture; the
// caller still runs the result through the vision verifier, so a generic civic hero is rejected anyway.
export async function fetchEventImage(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok) return null
    const html = await res.text()
    const candidates = [
      jsonLdImage(html),
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)?.[1],
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1],
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    ]
    for (const raw of candidates) {
      if (!raw) continue
      let img = raw.trim()
      if (img.startsWith('//')) img = 'https:' + img
      else if (img.startsWith('/')) { const u = new URL(url); img = u.origin + img }
      img = img.replace(/^http:\/\//i, 'https://')                          // avoid mixed-content blanks
      if (img.startsWith('http') && (await isGoodImage(img))) return img     // SCREEN each candidate
    }
    return null
  } catch {
    return null
  }
}

// Reshape any image URL to a tall PORTRAIT via the keyless wsrv.nl proxy (libvips saliency crop), so a
// landscape source fills the tall `cover` card with its salient region centred instead of cropping to a
// thin band. CDN-cached, free, no key; wsrv fetches server-side, so it can also rescue some hotlink-blocked
// images. Tradeoff: routes images through a third-party CDN — trivially reverted; the caller applies it to
// LIVE picks only (canon photos are hand-curated). Verified: a landscape source → a true 800×1200 JPEG.
export function toPortrait(url: string, w = 800, h = 1200): string {
  if (!url || !url.startsWith('https://') || /images\.weserv\.nl/i.test(url)) return url
  // &default=<original> — if wsrv can't fetch the source at RENDER time (intermittent upstream failure),
  // it redirects the browser to the raw image instead of serving its grey error gradient. Uncropped
  // original beats a grey card; build-time checks can't catch a render-time flake.
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}&h=${h}&fit=cover&a=attention&output=jpg&default=${encodeURIComponent(url)}`
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

// WEB IMAGE SEARCH (keyless, via DuckDuckGo) — find real, subject-accurate photos from the open web.
// `webImageCandidates` returns up to `max` hotlinkable, quality-screened URLs in relevance order, so
// a vision verifier (below) can pick the one that ACTUALLY depicts the event. `webImage` keeps the
// old single-result behaviour (first good hit) for callers that don't verify.
// Raw image hits in relevance order, with dimensions. Prefers SERPER (a Google-Images API — far better
// relevance + reliable dims) when SERPER_API_KEY is set; falls back to the keyless DuckDuckGo scrape (the
// vqd token is fragile and silently breaks, which is why a paid key is worth it). Both → {image,width,height}[].
async function rawImageResults(query: string): Promise<{ image?: string; width?: number; height?: number }[]> {
  if (process.env.SERPER_API_KEY) {
    try {
      const res = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ q: query, num: 20, gl: 'nl' }),
        signal: AbortSignal.timeout(12000),
      }).then((r) => r.json())
      const imgs = (res?.images || []).map((r: { imageUrl?: string; imageWidth?: number; imageHeight?: number }) =>
        ({ image: r.imageUrl, width: r.imageWidth, height: r.imageHeight })).filter((r: { image?: string }) => typeof r.image === 'string')
      if (imgs.length) return imgs
    } catch { /* fall through to DuckDuckGo */ }
  }
  try {
    const page = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(query) + '&iax=images&ia=images',
      { headers: { 'user-agent': UA, accept: 'text/html' } }).then((r) => r.text())
    const vqd = page.match(/vqd=["']?([\d-]+)["']?/)?.[1]
    if (!vqd) return []
    await sleep(250)
    const data = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
      { headers: { 'user-agent': UA, referer: 'https://duckduckgo.com/' } }).then((r) => r.json()).catch(() => null)
    return data?.results || []
  } catch {
    return []
  }
}

export async function webImageCandidates(query: string, max = 6): Promise<string[]> {
  try {
    const results = await rawImageResults(query)
    if (!results.length) return []
    // RANK relevance-FIRST (the source's order ≈ subject accuracy), with image SHAPE as a tiebreak.
    // The card is a TALL PORTRAIT filled with `cover`, so LANDSCAPE photos get cropped to a thin band
    // (the "image looks cropped" complaint). Bias toward portrait/square images that fill the card
    // with minimal loss; demote landscape, and bury panoramas. Dimensions come from DuckDuckGo's
    // payload (no extra fetch); shapeless results (no dims) stay neutral so we don't lose good hits.
    const penalty = (r: { width?: number; height?: number }) => {
      const w = Number(r.width), h = Number(r.height)
      if (!w || !h) return 0
      const ar = w / h
      return ar > 2.0 ? 6 : ar > 1.5 ? 3 : ar > 1.2 ? 1.5 : 0   // wide = worse; portrait/square = ideal
    }
    const ranked = results
      .filter((r) => typeof r.image === 'string' && r.image!.startsWith('http') && !STOCK_URL.test(r.image!))
      .map((r, i) => ({ r, key: i + penalty(r) }))
      .sort((a, b) => a.key - b.key)
    const out: string[] = []
    for (const { r } of ranked.slice(0, 16)) {
      const u = r.image!.replace(/^http:\/\//i, 'https://')   // secure version (http = mixed-content-blocked)
      if (await isGoodImage(u)) { out.push(u); if (out.length >= max) break }
    }
    return out
  } catch {
    return []
  }
}
export async function webImage(query: string): Promise<string | null> {
  return (await webImageCandidates(query, 1))[0] ?? null
}

// VISION VERIFIER — the agent that LOOKS at candidate photos and picks the one that genuinely depicts
// the event, or rejects them all. This is what makes open-web image search safe for generic events:
// a text search for "Open Garden Days" returns canal-garden shots AND wrong subjects (a Pride parade,
// another city) — Claude's vision call sees each image and the event context and chooses the honest
// fit, or returns null so we fall back to themed stock rather than show a misleading photo. Needs
// ANTHROPIC_API_KEY (vision-capable model). We DOWNLOAD each candidate ourselves (browser UA) and
// send the bytes as base64 — NOT the URL — because Anthropic's own image fetcher fails on the many
// hotlink-protected hosts that pass our HEAD check, which would error the whole call and reject a
// perfectly good photo. Fetching the bytes here makes the verify reliable.
export async function verifyImageForEvent(
  candidates: string[],
  ev: { title: string; venue?: string; area?: string; category?: string; blurb?: string },
  cityName: string,
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
  const uniq = [...new Set(candidates)].slice(0, 4)
  if (!key || !uniq.length) return null
  // download + base64 the candidates that actually return a real image (skip the rest)
  const imgs: { url: string; data: string; mt: string }[] = []
  await Promise.all(uniq.map(async (url) => {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) })
      const mt = (r.headers.get('content-type') || '').split(';')[0].trim()
      if (!r.ok || !/^image\/(jpeg|png|webp|gif)$/.test(mt)) return
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length < 2000 || buf.length > 5_000_000) return
      imgs.push({ url, data: buf.toString('base64'), mt })
    } catch { /* unreachable/blocked — drop this candidate */ }
  }))
  if (!imgs.length) return null
  const content: Record<string, unknown>[] = []
  imgs.forEach((im, i) => {
    content.push({ type: 'text', text: `Image ${i + 1}:` })
    content.push({ type: 'image', source: { type: 'base64', media_type: im.mt, data: im.data } })
  })
  content.push({ type: 'text', text:
    `This is for an events app card. EVENT: "${ev.title}"` +
    `${ev.venue ? ` at ${ev.venue}` : ''}${ev.area ? `, ${ev.area}` : ''}, ${cityName}.` +
    `${ev.category ? ` Category: ${ev.category}.` : ''}${ev.blurb ? ` ${ev.blurb}` : ''}\n\n` +
    `Which image best fits THIS event, shown as a TALL PORTRAIT card? It will be cropped to a vertical ` +
    `frame, so prefer images where the main subject is clearly framed and survives a portrait crop (not a ` +
    `tiny figure lost in a wide shot). For a concert/gig/show, ANY genuine photo of the named performer or ` +
    `band is a CORRECT fit (it need not be from this date or city) — prefer a clean photo of the artist over ` +
    `a wide crowd-and-stage-lights shot; for a PERFORMER event REJECT images that show only a building, ` +
    `facade or empty venue exterior (a cinema front is not a gig). The image must plausibly match the NAMED ` +
    `venue and artist: REJECT a photo of a DIFFERENT recognizable venue or landmark (the Concertgebouw on a ` +
    `forest-theatre card, a maritime museum on a Royal Palace show) and REJECT a DIFFERENT identifiable ` +
    `performer. For a place / festival / market / garden / food event, pick a photo ` +
    `showing that kind of place or activity. REJECT an image if it shows a clearly DIFFERENT subject (a ` +
    `different artist, an unrelated event/landmark/city, a parade when it isn't one), OR is a promotional ` +
    `POSTER / FLYER with prominent text, dates or line-up overlaid, a logo, a screenshot, or watermarked ` +
    `stock. Prefer the cleanest real photograph; pick one whenever a reasonable, on-subject photo exists, else 0. ` +
    `THE CURATOR'S EYE (Ness — these preferences win ties): ` + (corpus.imageRules as string[]).join(' ') + ` ` +
    `Reply with ONLY JSON: {"best": <the 1-based image number that fits, or 0 if NONE fit>}.` })
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 60, messages: [{ role: 'user', content }] }),
    }).then((r) => r.json())
    if (res?.error || !Array.isArray(res?.content)) return null
    const text = res.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text).join('')
    const idx = Number(text.match(/"best"\s*:\s*(\d+)/)?.[1] ?? 0)
    return idx >= 1 && idx <= imgs.length ? imgs[idx - 1].url : null
  } catch {
    return null
  }
}

// TRUSTED-IMAGE SANITY — a narrower vision question than verifyImageForEvent, for ORGANISER-uploaded images
// (Feed Factory / RA flyers). These are trusted on subject, but organisers sometimes upload their LOGO or a
// wordmark instead of a photo — which flattens to a solid black/blank card. So we only ask "is this usable as
// a card background at all?": real photographs AND designed posters/flyers WITH imagery are KEEP (a film
// poster like Agatha's Almanac is exactly what we want); logos, wordmarks, icons, flat/solid graphics,
// near-blank or near-black frames, QR codes and text-only slides are REJECT. Needs ANTHROPIC_API_KEY;
// returns true (keep) on any API failure so a hiccup never strips a good image.
export async function imageIsCardworthy(url: string): Promise<boolean> {
  const key = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
  if (!key) return true
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) })
    const mt = (r.headers.get('content-type') || '').split(';')[0].trim()
    if (!r.ok || !/^image\/(jpeg|png|webp|gif)$/.test(mt)) return true
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 2000 || buf.length > 5_000_000) return true
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 30,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mt, data: buf.toString('base64') } },
          { type: 'text', text:
            'Is this image usable as an event-card BACKGROUND? KEEP if it is a real photograph OR a designed ' +
            'event poster/flyer with pictorial imagery. REJECT if it is essentially a logo, wordmark, icon, ' +
            'flat/solid-colour graphic, near-blank or near-black frame, QR code, or a text-only slide. ' +
            'ALSO REJECT if the image is visibly pixelated, upscaled-looking, out of focus, or wrecked by ' +
            'compression artifacts — it will be blown up to a full-screen card and must survive that. ' +
            'Reply ONLY JSON: {"keep": true|false}.' },
        ] }],
      }),
    }).then((x) => x.json())
    const text = Array.isArray(res?.content) ? res.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text).join('') : ''
    return !/"keep"\s*:\s*false/.test(text)
  } catch {
    return true
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
