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

import { type Slide, toPortrait } from './extract'

const API = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-5'
/** A roundup runs to ~10 slides; cap so one pathological post can't burn the budget. */
export const MAX_SLIDES = 12

/** These accounts post two different carousel shapes, and the difference decides whether the slide's
 *  photo is worth anything:
 *   · `listing` — a dense typeset agenda ("FRI 31/07", then "<event> | <venue>" lines). Many events
 *     per slide, and the slide image is a wall of text: useless as a card photo.
 *   · `feature` — ONE recommendation per slide, with a real photograph, a title ("Hamachi Crudo at
 *     Taiko") and a short write-up. The photo IS the card.
 *   · `cover` — masthead only, no events.
 *  The model reports which it saw, and only a `feature` slide donates its image. */
export type SlideKind = 'listing' | 'feature' | 'cover'

export type RoundupEvent = {
  title: string
  venue?: string
  /** As printed on the slide, e.g. "MON 27/07". Shown on the board verbatim so a misread is obvious. */
  date?: string
  /** The same date rewritten for `lib/when.ts` ("Fri 31 Jul"). The printed numeric form does not
   *  parse, so without this a dropped pick carries no date the app can act on. */
  when?: string
  /** These carousels split DAY and NIGHT slides. Real signal: NIGHT is club/gig, DAY skews
   *  film/exhibition — and it's the difference between a 3pm picnic and a 3am afters. */
  part?: 'day' | 'night'
  category?: string
  /** The slide's own write-up, on a feature slide. Becomes the card's blurb. */
  blurb?: string
  /** Set only for a feature slide: that slide's photo, wsrv-wrapped and ready to render. */
  image?: string
  slide: number
}

export class RoundupError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

/** "FRI 31/07" → "Fri 31 Jul".
 *
 *  These carousels print dates numerically, and `lib/when.ts` cannot read that: verified that
 *  "Fri 31 Jul" parses and "FRI 31/07" does not. Left as printed, a dropped pick has no date the
 *  app understands — so no date stamp on the card, no expiry when the day passes, and no per-day
 *  weather ranking. Converting here (server-side, once) keeps the whole app on one date brain.
 *  Anything we can't confidently convert is returned untouched rather than guessed at. */
export function normalizeWhen(raw?: string): string | undefined {
  const s = (raw ?? '').trim()
  if (!s) return undefined
  const m = s.match(/^(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2})\s*[/.-]\s*(\d{1,2})$/)
  if (!m) return s // already words ("Fri 31 Jul"), a range, or something we shouldn't touch
  const day = Number(m[2])
  const mon = Number(m[3])
  if (!(day >= 1 && day <= 31) || !(mon >= 1 && mon <= 12)) return s
  const dow = m[1] ? DAYS[m[1].slice(0, 3).toLowerCase()] : undefined
  return `${dow ? dow + ' ' : ''}${day} ${MONTHS[mon - 1]}`
}

const CATEGORIES = new Set(['out', 'eat', 'drink', 'art', 'live', 'stage', 'daytrip', 'market', 'shop'])
export const cleanCategory = (c?: string): string | undefined => {
  const k = (c ?? '').trim().toLowerCase()
  return CATEGORIES.has(k) ? k : undefined
}

const SYSTEM = `You are WKNDR's extractor, reading ONE slide from an Amsterdam city-guide carousel.

First decide which of three kinds of slide this is, and set "kind" accordingly.

kind "cover" — a masthead only: a big title like "PUBLIC SERVICE ANNOUNCEMENT" or "We 8! Amsterdam's
best eats right now", maybe over a photo, plus a logo. It lists nothing.
  → return {"kind":"cover","events":[]}. Never manufacture entries to fill a cover.

kind "listing" — a dense typeset agenda. A section heading at the top, either "DAY" or "NIGHT";
under it day headings like "FRI 31/07"; under those, event lines shaped "<title> | <venue>".
  - Spacing around the "|" is ragged: "Mykki Blanco| Melkweg" and "Juno   |   Cinetol" are the same.
  - A long line WRAPS and the wrapped part is indented, and it is usually the venue that wrapped:
    "Dekmantel with RHR & Skrillex, Skin on Skin & more |" / "   Amsterdams Bos" is ONE event with
    venue "Amsterdams Bos". Rejoin wrapped lines before splitting on "|".
  - Carry the day heading onto every event beneath it, verbatim ("FRI 31/07").
  - Set part to "day" or "night" from the heading at the top of the slide.
  - Keep an artist or film-maker prefix in the title (e.g. "Bob Fosse's \\"Cabaret\\"").
  - Expect MANY events on such a slide. Transcribe every one.

kind "feature" — ONE recommendation, presented as a photograph with a caption. Typically an
underlined title near the bottom like "Hamachi Crudo at Taiko", then a few lines describing it.
  → exactly ONE event.
  - Split "<thing> at <place>" into title "<thing>" and venue "<place>". If there is no "at", put
    the whole heading in title and leave venue out.
  - Put the descriptive write-up in blurb, transcribed as printed (trim it at ~300 characters).
  - These slides usually carry no date. Leave date out rather than inventing one.

Rules for every kind:
- FACTS ONLY. Transcribe what is printed. Never invent, complete or guess a title, venue, date or
  description, and never add anything that is not on this slide. Omit an illegible line.
- Ignore recurring furniture: a website URL in the corner ("full list on doubleamagazine.com"), a
  page number, a logo, an @handle watermark. None of those are events.
- category, only when obvious, is one of: out, eat, drink, art, live, stage, daytrip, market, shop.
  A dish or restaurant is "eat"; a bar or cocktail is "drink"; a film or theatre is "stage"; a gig,
  club night or party is "live"; an exhibition or gallery opening is "art". Omit when unsure.

Return ONLY a JSON object:
{"kind":"cover|listing|feature","events":[{"title","venue","date","part","category","blurb"}]}`

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
  let parsed: { kind?: string; events?: Partial<RoundupEvent>[] }
  try {
    parsed = JSON.parse(text.slice(a, b + 1))
  } catch {
    return []
  }

  const list = (parsed.events ?? []).filter((e) => e && typeof e.title === 'string' && e.title.trim())
  // Only a feature slide donates its photo. A listing slide's image is a wall of text — as a card
  // photo it would be worse than none, since the app falls back to its typographic poster.
  // Belt and braces: a "feature" that somehow returned many events is really a listing.
  const isFeature = parsed.kind === 'feature' && list.length === 1
  const photo = isFeature ? toPortrait(slide.full) : undefined

  return list.map((e) => {
    const printed = e.date ? String(e.date).trim().slice(0, 60) : undefined
    return {
      title: String(e.title).trim().slice(0, 200),
      venue: e.venue ? String(e.venue).trim().slice(0, 120) : undefined,
      date: printed, // shown on the board verbatim, so a misread stays obvious
      when: normalizeWhen(printed), // what the app's date brain can actually read
      part: e.part === 'day' || e.part === 'night' ? e.part : undefined,
      category: cleanCategory(e.category),
      blurb: e.blurb ? String(e.blurb).trim().slice(0, 400) : undefined,
      image: photo,
      slide: index + 1,
    }
  })
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
