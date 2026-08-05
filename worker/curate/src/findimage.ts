// FIND AN IMAGE for a dropped listing.
//
// A roundup agenda slide is typeset text — "FRI 31/07 / Mykki Blanco | Melkweg" — so there is no
// photograph on it to lift. Ninety-three events arrive with no picture. This goes and finds one,
// using the same two-stage shape the build-time pipeline already uses for its own picks
// (scripts/lib/pipeline.ts): search wide, then let vision throw out the ones that don't match.
//
// The second stage is not optional. A bare search returned something for 8 of 8 real events, but
// "Pride Is A Protest" came back with a stock photo from an Indian news site. Coverage was 100%,
// accuracy was not, and an obviously-wrong photo on a card is worse than the app's own typographic
// poster. Vision is what makes the difference.
//
// Only ever called for a pick with NO image. A post's own photo always wins — it was taken by the
// person promoting the thing.

import { BROWSER_UA, imageDims, toPortrait } from './extract'
import { toBase64 } from './roundup'

const DDG_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** Below this on the long edge a card looks soft, so it is not worth a vision call. */
const MIN_EDGE = 700
/** Stock-photo hosts: watermarked, generic, and never the actual event. */
const STOCK = /(shutterstock|istockphoto|gettyimages|alamy|dreamstime|123rf|depositphotos)\./i

export type ImageEvent = {
  title: string
  venue?: string
  category?: string
  blurb?: string
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** DuckDuckGo image search, keyless. Two steps: the HTML page issues a `vqd` token, which the
 *  JSON endpoint then requires. No token, no results — so a failure here is silent and returns []. */
export async function searchImages(query: string, fetchFn: Fetcher = fetch): Promise<string[]> {
  try {
    const page = await fetchFn(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
      headers: { 'User-Agent': DDG_UA, Accept: 'text/html' },
    }).then((r) => r.text())
    const vqd = page.match(/vqd=["']?([\d-]+)["']?/)?.[1]
    if (!vqd) return []
    await sleep(250) // DDG rejects an immediate follow-up
    const data = (await fetchFn(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
      { headers: { 'User-Agent': DDG_UA, Referer: 'https://duckduckgo.com/' } },
    ).then((r) => r.json())) as { results?: { image?: string; width?: number; height?: number }[] }

    // Rank relevance-first (search order ≈ subject accuracy) with SHAPE as the tiebreak. The card is
    // a tall portrait filled with `cover`, so a landscape photo gets cropped to a thin band.
    const penalty = (r: { width?: number; height?: number }) => {
      const w = Number(r.width), h = Number(r.height)
      if (!w || !h) return 0
      const ar = w / h
      return ar > 2.0 ? 6 : ar > 1.5 ? 3 : ar > 1.2 ? 1.5 : 0
    }
    return (data?.results ?? [])
      .filter((r) => typeof r.image === 'string' && r.image.startsWith('http') && !STOCK.test(r.image))
      .map((r, i) => ({ url: r.image!.replace(/^http:\/\//i, 'https://'), key: i + penalty(r) }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.url)
      .slice(0, 8)
  } catch {
    return []
  }
}

/** Fetch a candidate and keep it only if it is a real, big-enough image. Cheap filter before the
 *  expensive one — no point spending a vision call on a 200px thumbnail. */
async function grab(url: string, fetchFn: Fetcher): Promise<{ url: string; data: string; mt: string } | null> {
  try {
    const r = await fetchFn(url, { headers: { 'User-Agent': BROWSER_UA } })
    const mt = (r.headers.get('Content-Type') || '').split(';')[0].trim()
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(mt)) return null
    const buf = await r.arrayBuffer()
    if (buf.byteLength < 8_000 || buf.byteLength > 5_000_000) return null
    const d = imageDims(buf)
    if (d && Math.max(d.w, d.h) < MIN_EDGE) return null
    return { url, data: toBase64(buf), mt }
  } catch {
    return null
  }
}

const SYSTEM = `You are picking the photograph for a WKNDR card — a tall portrait tile in a weekend
events app for Amsterdam.

You will see numbered images and one event. Choose the image that genuinely depicts THAT event, or
answer 0 if none does.

Choose:
- For a gig, club night or performance: any real photo of the named artist or act. It does not have
  to be from this date or this city.
- For a film or screening: a still or poster art from that film.
- For an exhibition, market, restaurant or place: a photo of that place, or of the kind of thing on
  show there.

Reject, and prefer 0 over a bad pick:
- A different artist, a different venue, a different city, or an unrelated event.
- A building facade or empty interior when the event is a PERFORMER — a cinema front is not a gig.
- A promotional flyer covered in text, dates or line-ups. A logo. A screenshot. Watermarked stock.
- A wide crowd-and-lights shot where the subject is a speck. This gets cropped to a vertical frame,
  so the subject must survive that crop.

A card with the app's own typographic poster is BETTER than a card with a wrong or generic photo.
When it is close, answer 0.

Answer with ONLY a number: the image's number, or 0.`

/** Ask vision which candidate actually depicts the event. Returns the winning url, or null. */
export async function pickBest(
  candidates: string[], ev: ImageEvent, key: string, model: string, fetchFn: Fetcher = fetch,
): Promise<string | null> {
  const uniq = [...new Set(candidates)].slice(0, 4)
  if (!key || !uniq.length) return null

  const imgs = (await Promise.all(uniq.map((u) => grab(u, fetchFn)))).filter(
    (x): x is { url: string; data: string; mt: string } => x !== null,
  )
  if (!imgs.length) return null

  const content: unknown[] = []
  imgs.forEach((im, i) => {
    content.push({ type: 'text', text: `Image ${i + 1}:` })
    content.push({ type: 'image', source: { type: 'base64', media_type: im.mt, data: im.data } })
  })
  content.push({
    type: 'text',
    text: `EVENT: "${ev.title}"${ev.venue ? ` at ${ev.venue}` : ''}, Amsterdam.` +
      `${ev.category ? ` Category: ${ev.category}.` : ''}${ev.blurb ? ` ${ev.blurb}` : ''}\n\n` +
      `Which image (1-${imgs.length}), or 0 for none?`,
  })

  const res = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 8, system: SYSTEM, messages: [{ role: 'user', content }] }),
  })
  const j = (await res.json()) as { content?: { type?: string; text?: string }[] }
  const text = (j.content ?? []).filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('')
  const n = Number((text.match(/\d+/) ?? ['0'])[0])
  return n >= 1 && n <= imgs.length ? imgs[n - 1].url : null
}

/** Search, verify, and hand back a card-ready image — or null, which means the app's typographic
 *  poster is the better answer. Two queries: the specific one, then a looser fallback, because
 *  "Queer Aunties Yellow House Amsterdam" finds nothing while "Queer Aunties Amsterdam" might. */
export async function findImageFor(
  ev: ImageEvent, key: string, model = 'claude-sonnet-5', fetchFn: Fetcher = fetch,
): Promise<string | null> {
  const queries = [
    [ev.title, ev.venue, 'Amsterdam'].filter(Boolean).join(' '),
    [ev.title, 'Amsterdam'].filter(Boolean).join(' '),
  ]
  const seen = new Set<string>()
  for (const q of queries) {
    const found = (await searchImages(q, fetchFn)).filter((u) => !seen.has(u))
    found.forEach((u) => seen.add(u))
    if (!found.length) continue
    const best = await pickBest(found, ev, key, model, fetchFn)
    if (best) return toPortrait(best)
  }
  return null
}
