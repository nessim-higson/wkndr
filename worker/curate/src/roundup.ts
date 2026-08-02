// READ THE LISTINGS — vision pass over a roundup carousel.
//
// Accounts like @doubleamagazine post a weekly "Amsterdam events" carousel: slide 1 is a cover,
// slides 2..n are day-by-day listings as TYPESET IMAGES. The caption carries none of it — a plain
// drop of such a post yields one card titled "PSA - Events in Amsterdam this Week!" and loses the
// twenty-odd real events behind it. This reads them out.
//
// Two things that matter and are easy to get wrong:
//   · Use the FULL 1080px slide (extract.ts `full`), never `display_uri` (512×640) and never the
//     wsrv portrait render — `fit=cover` CROPS, and cropping a listings poster cuts off text.
//   · Slide 1 is usually a cover with no events. The model is told to return [] for such a slide
//     rather than inventing something to fill the gap.
//
// Model default is Sonnet: this is dense-but-clean typography, and the job is transcription plus
// light structuring, not judgement. The editorial judge downstream is where taste gets applied.

import { type Slide } from './extract'

const API = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-5'
/** A roundup runs to ~10 slides; cap so one pathological post can't burn the budget. */
export const MAX_SLIDES = 12

export type RoundupEvent = {
  title: string
  venue?: string
  /** As printed on the slide, e.g. "MON 27/07" — deliberately NOT normalised here. The board shows
   *  it verbatim so a misread is obvious; when.ts does the parsing at compile time. */
  date?: string
  /** These carousels split DAY and NIGHT slides. Real signal: NIGHT is club/gig, DAY skews
   *  film/exhibition — and it's the difference between a 3pm picnic and a 3am afters. */
  part?: 'day' | 'night'
  category?: string
  slide: number
}

export class RoundupError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
  }
}

const SYSTEM = `You are WKNDR's extractor, reading one slide from an Amsterdam weekly-events carousel.

Layout of these slides:
- A section heading at the very top, either "DAY" or "NIGHT".
- Under it, day headings like "FRI 31/07", each followed by event lines.
- An event line is "<title> | <venue>". Spacing around the "|" is inconsistent — "Mykki Blanco|
  Melkweg" and "Juno   |   Cinetol" are the same shape.
- A long line WRAPS, and the wrapped part is indented. The venue is often what wrapped:
  "Dekmantel with RHR & Skrillex, Skin on Skin, Nicolini & more |" / "    Amsterdams Bos" is ONE
  event, venue "Amsterdams Bos". Join wrapped lines before splitting on "|".

Rules:
- FACTS ONLY. Transcribe exactly what is printed. Never invent, complete or guess a title, venue or
  date, and never add events that are not on this slide. If a line is illegible, omit it.
- Carry the day heading above a line onto every event beneath it, verbatim ("FRI 31/07").
- Set part to "day" or "night" from the heading at the top of the slide.
- Keep the film-maker or artist prefix in the title (e.g. "Bob Fosse's \\"Cabaret\\"").
- A COVER slide — just a masthead like "PUBLIC SERVICE ANNOUNCEMENT", a logo, or a date range —
  has no events: return {"events": []}. Do not manufacture entries to fill it.
- category, only when obvious, is one of: out, eat, drink, art, live, stage, daytrip, market, shop.
  A film screening or theatre is "stage"; a gig, club night or party is "live"; an exhibition or
  gallery opening is "art". Omit the field when unsure.

Return ONLY a JSON object: {"events":[{"title","venue","date","part","category"}]}`

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
/** Workers have no Buffer; btoa chokes on a big binary string, so encode the bytes directly. */
export function toBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < b.length; i += 3) {
    const c = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
    out += B64[(c >> 18) & 63] + B64[(c >> 12) & 63] +
      (i + 1 < b.length ? B64[(c >> 6) & 63] : '=') +
      (i + 2 < b.length ? B64[c & 63] : '=')
  }
  return out
}

/** Inline the slide rather than handing Anthropic a URL: Instagram's CDN is hotlink-protected and
 *  its signed URLs expire, so a URL source is the one that fails intermittently and confusingly. */
async function inlineImage(url: string, fetchFn: Fetcher): Promise<{ media: string; data: string } | null> {
  const r = await fetchFn(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' },
    redirect: 'follow',
  })
  const media = (r.headers.get('Content-Type') || '').split(';')[0].trim()
  if (!r.ok || !media.startsWith('image/')) return null
  return { media: media === 'image/jpg' ? 'image/jpeg' : media, data: toBase64(await r.arrayBuffer()) }
}

async function readSlide(
  slide: Slide, index: number, key: string, model: string, fetchFn: Fetcher,
): Promise<RoundupEvent[]> {
  const img = await inlineImage(slide.full, fetchFn)
  if (!img) return []

  const res = await fetchFn(API, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: img.media, data: img.data } },
          { type: 'text', text: 'Transcribe this slide. Return ONLY the JSON object.' },
        ],
      }],
    }),
  })

  const j = (await res.json()) as { content?: { type?: string; text?: string }[]; error?: { message?: string } }
  if (j.error) throw new RoundupError(j.error.message ?? 'the reader refused that image', 'api')
  if (!Array.isArray(j.content)) return []

  const text = j.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('')
  const a = text.indexOf('{'), b = text.lastIndexOf('}')
  if (a < 0 || b < 0) return []
  let parsed: { events?: Partial<RoundupEvent>[] }
  try {
    parsed = JSON.parse(text.slice(a, b + 1))
  } catch {
    return []
  }
  return (parsed.events ?? [])
    .filter((e) => e && typeof e.title === 'string' && e.title.trim())
    .map((e) => ({
      title: String(e.title).trim().slice(0, 200),
      venue: e.venue ? String(e.venue).trim().slice(0, 120) : undefined,
      date: e.date ? String(e.date).trim().slice(0, 60) : undefined,
      part: e.part === 'day' || e.part === 'night' ? e.part : undefined,
      category: e.category ? String(e.category).trim().slice(0, 20) : undefined,
      slide: index + 1,
    }))
}

/** Read every slide. Slides run concurrently — one unreadable slide yields [] rather than sinking
 *  the batch, because a roundup is still worth having with 7 of 8 slides. */
export async function readRoundup(
  slides: Slide[], key: string, model = DEFAULT_MODEL, fetchFn: Fetcher = fetch,
): Promise<{ events: RoundupEvent[]; slidesRead: number; failed: number }> {
  if (!key) throw new RoundupError('The reader is not configured on the server yet.', 'no-key')
  const use = slides.slice(0, MAX_SLIDES)

  const results = await Promise.all(
    use.map((s, i) =>
      readSlide(s, i, key, model, fetchFn).then(
        (events) => ({ events, ok: true }),
        () => ({ events: [] as RoundupEvent[], ok: false }),
      ),
    ),
  )

  // The same event can be printed twice across slides. Key on title+date+part so a genuine
  // multi-night run stays as separate entries, and a day party and its night session at the same
  // venue on the same date (these carousels really do list both) don't collapse into one.
  const seen = new Set<string>()
  const events: RoundupEvent[] = []
  for (const r of results) {
    for (const e of r.events) {
      const k = `${e.title.toLowerCase().replace(/[^a-z0-9]/g, '')}|${(e.date ?? '').toLowerCase()}|${e.part ?? ''}`
      if (seen.has(k)) continue
      seen.add(k)
      events.push(e)
    }
  }
  return { events, slidesRead: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length }
}
