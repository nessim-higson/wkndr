// YOUR LITTLE BLACK BOOK — Ness's #1 trusted source, feeding DIRECTLY (V.7.2).
//
// LBB has no event API, but its WordPress RSS (yourlittleblackbook.me/feed/) delivers full articles —
// including the weekly "Weekendtips Amsterdam: N X dit wil je doen op <dates>" agenda plus the monthly
// museum/theatre/film agendas — with their EDITORIAL IMAGES and per-event OUTBOUND LINKS embedded. So
// instead of hoping web_search stumbles on LBB's picks (and then scraping random images for them), we
// read the agenda articles themselves and extract events from LBB's own clean text: exact editorial
// curation, their photo when the article carries one, and the event's real outbound link (whose og:image
// the normal image pass can use when it doesn't). This is the deterministic delivery of the editorial
// voice — the fix for the wrong-but-plausible scraped-image class.
//
// Legal stance (same as websearch.ts): signal + link, never republish — FACTS only, our OWN ≤22-word
// blurb, LBB credited as the source, links out. Needs ANTHROPIC_API_KEY (Haiku extraction from the
// article text); returns [] without it. Never throws. id prefix `web-lbb-*` (live; images trusted).
import type { Pick, Category } from '../../src/types'
import { deriveWeatherFit, upcomingWeekend, mapLimit } from '../lib/pipeline'
import { latestDateOf } from '../../src/lib/when'

const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const FEED = 'https://www.yourlittleblackbook.me/feed/'
const MAX_ARTICLES = 4          // agenda articles per run (weekendtips + the monthly museum/theatre/film agendas)
const MAX_PER_ARTICLE = 10      // best events per article — extraction is curation, not transcription
const CATEGORIES: Category[] = ['out', 'eat', 'drink', 'art', 'live', 'stage', 'daytrip', 'market', 'shop']

type Article = { title: string; link: string; pubDate: Date; score: number; html: string }

const unwrap = (s: string) => s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
const tag = (item: string, t: string) => { const m = item.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? unwrap(m[1]) : '' }

/** The feed's Amsterdam AGENDA articles, best-first (exported for keyless testing). */
export function selectAgendaArticles(xml: string, now = new Date()): Article[] {
  const out: Article[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1]
    const title = tag(it, 'title')
    if (!/amsterdam/i.test(title)) continue
    if (/recept|recipe|netflix|schiphol|door heel nederland|tote bag|airline/i.test(title)) continue
    const pubDate = new Date(tag(it, 'pubDate') || 0)
    if (!pubDate.getTime() || (now.getTime() - pubDate.getTime()) > 21 * 864e5) continue   // stale article
    const html = (it.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/) || [])[1] || ''
    if (!html) continue
    let score = 0
    if (/weekendtips/i.test(title)) score += 20      // THE weekly agenda — always first
    if (/agenda/i.test(title)) score += 8
    if (/museum|tentoonstell|theater|film|expo/i.test(title)) score += 3
    if (/nieuw|opening|hotspot/i.test(title)) score += 4
    out.push({ title, link: tag(it, 'link'), pubDate, score, html: unwrap(html) })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, MAX_ARTICLES)
}

/** Article HTML → clean text with [IMAGE: url] / [LINK: url] markers the extractor can cite. */
export function prepareArticle(html: string, maxChars = 20000): string {
  return html
    .replace(/<img[^>]+(?:data-src|src)="(https?:[^"]+)"[^>]*>/gi, (_m, u) => /logo|icon|avatar|emoji|gravatar/i.test(u) ? ' ' : `\n[IMAGE: ${u}]\n`)
    .replace(/<a[^>]+href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, u, txt) => /yourlittleblackbook\.me\/(?:tag|category|author)|facebook|instagram|pinterest|whatsapp|twitter/i.test(u) ? txt : `${txt} [LINK: ${u}]`)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .slice(0, maxChars)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
const fmt = (d: Date) => d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })

/** Fallback link when the extractor found no per-event outbound URL. The old fallback was the
 *  agenda ARTICLE (a monthly roundup) — so a card promising one exhibition ("View event details")
 *  landed on a generic listing (field report, 2026-07-21: Ekō @ Scheepvaartmuseum → museum-agenda
 *  page). A scoped web search for the exact title + venue lands on the real event page instead
 *  (the venue's own listing near-always ranks first), which is what the CTA promises. */
const searchLink = (title: string, venue: string) =>
  `https://duckduckgo.com/?q=${encodeURIComponent([title, venue, 'Amsterdam'].filter(Boolean).join(' '))}`

/** A usable per-event outbound link — http(s) AND not a link back into LBB itself. The extractor
 *  sometimes hands back the agenda ARTICLE's own yourlittleblackbook.me URL as the "event page"
 *  (2026-07-23 refresh: World Press Photo, Ekō, Nederland–Japan all pointed at museum-agenda pages),
 *  which is the exact card↔page mismatch — a specific card opening a generic roundup. Treat any
 *  LBB-internal URL as "no link found" and fall through to the scoped event search. */
const usableLink = (u: unknown): u is string =>
  typeof u === 'string' && /^https?:/.test(u) && !/yourlittleblackbook\.me/i.test(u)

/** LBB agenda events for a city → Pick[]. Amsterdam-only for now; needs ANTHROPIC_API_KEY. Never throws. */
export async function lbbExtract(cityKey: string): Promise<Pick[]> {
  if (cityKey !== 'amsterdam' || !KEY) return []
  const wk = upcomingWeekend()
  const WEEKEND = `${fmt(wk.sat)} – ${fmt(wk.sun)}`
  const out: Pick[] = []
  try {
    const xml = await fetch(FEED, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) }).then((r) => r.text())
    const articles = selectAgendaArticles(xml)
    if (!articles.length) return []
    const results = await mapLimit(articles, 1, async (art): Promise<Pick[]> => {
      try {
        const text = prepareArticle(art.html)
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 3000,
            system: `You are WKNDR's extractor reading a Your Little Black Book (Amsterdam city guide) article.
The coming weekend is ${WEEKEND}. Extract the ${MAX_PER_ARTICLE} BEST items genuinely relevant to that
weekend in/around Amsterdam — a dated event on those days, an ongoing exhibition/run open then, or a
distinctive place/hotspot worth going to that weekend. Skip anything already past, anything that only
STARTS after ${fmt(wk.sun)} (a monthly agenda lists the whole month — later items are NOT this weekend),
national round-up items outside the Amsterdam area, and thin filler. A WIDE-RELEASE cinema listing (a
Hollywood movie simply playing in theatres) is filler — include a film ONLY for a special screening
(open-air, festival, premiere, classics night at a distinctive venue), and films/theatre = category
"stage". FACTS ONLY; never invent dates.
Return ONLY a JSON array, each item:
{"title": string, "venue": string, "area": string,
 "when": string,          // ENGLISH, e.g. "Sat 4 Jul · 20:00", "Fri–Sun 3–5 Jul", "Until Sun 30 Aug", or "" if the text gives none
 "category": one of ${JSON.stringify(CATEGORIES)},
 "outdoor": boolean, "kid": boolean, "price": string,
 "blurb": string,         // YOUR OWN words, ≤22 words, why it's worth it (do not copy the article's phrasing)
 "why": string,           // ≤10 words hook
 "image": string|null,    // the [IMAGE: url] nearest/belonging to THIS item, else null — never reuse one image for two items
 "link": string|null}     // this item's [LINK: url] (venue/event page), else null`,
            messages: [{ role: 'user', content: `ARTICLE: "${art.title}"\n\n${text}\n\nReturn ONLY the JSON array.` }],
          }),
        }).then((r) => r.json())
        if (res?.error || !Array.isArray(res?.content)) return []
        const textOut = res.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text).join('')
        const a = textOut.indexOf('['), b = textOut.lastIndexOf(']')
        if (a === -1 || b === -1) return []
        let rows: Record<string, unknown>[] = []
        try { const v = JSON.parse(textOut.slice(a, b + 1)); rows = Array.isArray(v) ? v : [] } catch { return [] }
        const seenImg = new Set<string>()
        return rows.slice(0, MAX_PER_ARTICLE).flatMap((e): Pick[] => {
          if (!e || typeof e.title !== 'string' || (e.title as string).length < 2) return []
          const outdoor = !!e.outdoor
          const category = (CATEGORIES.includes(e.category as Category) ? e.category : 'out') as Category
          let image = typeof e.image === 'string' && (e.image as string).startsWith('http') ? (e.image as string) : undefined
          if (image && seenImg.has(image)) image = undefined   // one editorial photo may not cover two events
          if (image) seenImg.add(image)
          return [{
            id: `web-lbb-${slug(String(e.title))}`,
            title: String(e.title).slice(0, 90),
            venue: String(e.venue ?? '').slice(0, 60) || 'Amsterdam',
            area: String(e.area ?? '').slice(0, 40),
            when: String(e.when ?? '').slice(0, 60) || 'This weekend',
            category,
            freshness: 'weekend',                 // the dates-guard in refresh.ts re-labels long runs
            outdoor,
            kid: !!e.kid,
            price: String(e.price ?? '').slice(0, 30),
            image,
            blurb: String(e.blurb ?? '').slice(0, 160),
            why: String(e.why ?? '').slice(0, 60) || 'LBB pick',
            source: 'Your Little Black Book',
            // per-event outbound link if the extractor found a real one; else a scoped search for
            // THIS event (never the generic agenda article or any LBB self-link — the mismatch).
            link: (usableLink(e.link)
              ? e.link
              : searchLink(String(e.title), String(e.venue ?? ''))),
            weatherFit: deriveWeatherFit(outdoor),
            verify: false,
          }]
        }).filter((p) => {
          // BELT + BRACES for the prompt rule above: the monthly agendas list ALL of July, and the model
          // still leaks "From Thu 9 Jul" items into the weekend deck. Open-ended runs ("Until…", daily)
          // are already-running → keep; otherwise a pick whose dates fall wholly AFTER the weekend's
          // Sunday is next week's news → drop.
          if (/until|t\/m|ongoing|daily|dagelijks/i.test(p.when)) return true
          const latest = latestDateOf(p.when)
          if (!latest) return true                              // undated hotspot → fine this weekend
          return latest.getTime() <= wk.sun.getTime() + 864e5   // ends by Sunday (+1d slack for midnight)
        })
      } catch { return [] }
    })
    for (const r of results) out.push(...r)
  } catch { /* feed unreachable — the rest of the pipeline carries the run */ }
  return out
}
