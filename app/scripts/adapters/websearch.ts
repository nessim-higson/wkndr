// WEB-SEARCH EXTRACTOR — the fresh-event engine (V.5.3).
//
// The scrape adapter (llm.ts) reads fixed URLs' STATIC HTML, so it misses everything rendered by
// JavaScript — which is most of I amsterdam's calendar, all of Songkick, etc. (verified: a raw
// fetch of iamsterdam.com/whats-on contains ZERO of the weekend's actual event names). This
// adapter closes that gap the way a person does: it gives Claude the web_search server tool and
// asks it to FIND the coming weekend's events on the live web, returning them as structured Picks
// with the REAL links search surfaced.
//
// Needs ANTHROPIC_API_KEY (same key as llm.ts). Cost: web_search is ~$10 / 1,000 searches + the
// usual tokens — a few cents per run at WKNDR's volume. Never throws (returns [] on any failure;
// the RSS + canon floor carries the pool).
//
// Signal + link, never republish: extracts FACTS only (name, venue, date, price), writes OUR own
// blurb, credits + links the real source the search returned.
import type { Pick, Category } from '../../src/types'
import { deriveWeatherFit, upcomingWeekend } from '../lib/pipeline'

const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'

// Pace calls so a low-tier account's per-minute limits aren't tripped (web-search responses pull
// the search-result text in as input tokens, so each call is heavier than a plain extract).
const RPM = Math.max(1, Number(process.env.ANTHROPIC_RPM) || 3)
const GAP = Math.ceil(60000 / RPM)
let nextAt = 0
async function gate(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, nextAt - now)
  nextAt = (wait > 0 ? nextAt : now) + GAP
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

const CATEGORIES: Category[] = ['live', 'art', 'stage', 'eat', 'drink', 'market', 'out', 'daytrip']

const TODAY = new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const WK = upcomingWeekend()
const fmt = (d: Date) => d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })
const WEEKEND = WK.sat.getTime() === WK.sun.getTime() - 864e5 ? `${fmt(WK.sat)} – ${fmt(WK.sun)}` : fmt(WK.sat)

// rough geo hint per city so web_search localises results (city.key → location params)
const GEO: Record<string, { city: string; region?: string; country: string; timezone: string }> = {
  amsterdam: { city: 'Amsterdam', country: 'NL', timezone: 'Europe/Amsterdam' },
  'new-orleans': { city: 'New Orleans', region: 'Louisiana', country: 'US', timezone: 'America/Chicago' },
}

// the facets to search — broad editorial spread, discovered live. MORE facets = more genuinely
// fresh, dated events per run (the freshness lever), and they cover the experiential categories
// real users asked for (workshops, talks, markets, family). Each facet is one paced API call.
const FACETS = [
  'festivals, street fairs and big outdoor/free events',
  'live music — concerts and gigs at music venues',
  'club nights, DJ sets and electronic/dance events',
  'art & museum exhibitions opening or closing soon, plus theatre, dance and film',
  'notable new restaurant & bar openings, food festivals and tastings',
  'markets, fairs and pop-ups (design, vintage, food, makers)',
  'workshops, classes and creative sessions — ceramics, cooking, life-drawing, run clubs',
  'talks, lectures and special or late-night museum openings',
  'family- and kid-friendly things to do',
]

function systemPrompt(cityName: string): string {
  return `You are WKNDR's culture scout for ${cityName}. TODAY IS ${TODAY}. Your job is to find the
genuinely interesting things to do THE COMING WEEKEND: ${WEEKEND} (and its Friday run-up), plus
ongoing things (a run "until <date>", a "daily" thing, a restaurant/show open that weekend).

Use the web_search tool to find what is ACTUALLY ON in ${cityName} that weekend — search official
city guides, venue pages, listings and event sites. Prefer specific, dated, real events over
generic evergreen filler.

RULES:
- DATES MUST BE REAL AND EXACT, taken from a source you actually found in search. Never guess or
  shift a date to make something fall on the weekend. If you can't confirm an event is on or
  spanning ${WEEKEND}, OMIT it. A wrong date is far worse than a missing event.
- Do NOT include mid-week one-offs that finish before that weekend, or anything already past.
- LINKS MUST BE REAL URLs that appeared in your search results — never invent a slug. Use the most
  specific event/booking page you found; else the listing/source page.
- Legal: signal + link, never republish. Use only FACTS; write your OWN ≤22-word blurb.
- Return the 4–7 best, most worth-knowing items for the weekend. Skip weak filler.

Return ONLY a JSON array (no prose), each item:
{
  "title": string,
  "venue": string,
  "area": string,
  "when": string,                 // human, e.g. "Sat 21 Jun · 20:00" or "Fri–Sun 20–22 Jun"
  "category": one of ${JSON.stringify(CATEGORIES)},   // films/theatre = "stage"
  "freshness": "new" | "weekend" | "ending" | "always",
  "outdoor": boolean,
  "kid": boolean,
  "price": string,                // "free", "from €25", "ticketed", etc.
  "blurb": string,                // YOUR words, ≤22 words, why it's interesting
  "why": string,                  // ≤12 words: the hook ("final weekend", "sells out", "free")
  "source": string,               // the publication/site the info came from (e.g. "I amsterdam")
  "link": string                  // the real URL from your search results
}
If nothing genuinely worth doing is on that weekend, return [].`
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}
function parseArray(text: string): Record<string, unknown>[] {
  const a = text.indexOf('['), b = text.lastIndexOf(']')
  if (a === -1 || b === -1) return []
  try { const v = JSON.parse(text.slice(a, b + 1)); return Array.isArray(v) ? v : [] } catch { return [] }
}

/** Run all facet searches for a city → Pick[]. Never throws. */
export async function websearchExtract(cityKey: string, cityName: string): Promise<Pick[]> {
  if (!KEY) return []
  const geo = GEO[cityKey]
  const tag = '    · web-search'
  const out: Pick[] = []
  const sys = [{ type: 'text', text: systemPrompt(cityName), cache_control: { type: 'ephemeral' } }]

  for (const facet of FACETS) {
    try {
      const body = JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 4,
          ...(geo ? { user_location: { type: 'approximate', ...geo } } : {}),
        }],
        system: sys,
        messages: [{ role: 'user', content: `Find the best ${facet} in ${cityName} for ${WEEKEND}. Search the live web, then return ONLY the JSON array.` }],
      })

      let res: any
      for (let attempt = 0; attempt < 2; attempt++) {
        await gate()
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body,
        }).then((r) => r.json())
        if (res?.error?.type === 'rate_limit_error' && attempt === 0) {
          await new Promise((r) => setTimeout(r, GAP + 5000)); continue
        }
        break
      }
      if (res?.error || !Array.isArray(res?.content)) {
        console.log(`${tag}: API → ${JSON.stringify(res?.error ?? res?.type ?? 'no content').slice(0, 160)}`)
        continue
      }
      // concatenate every text block (the model may narrate between searches); the JSON array is
      // in the final answer text. searches issued = server_tool_use blocks (each one bills).
      const searches = res.content.filter((b: any) => b?.type === 'server_tool_use').length
      const textOut = res.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n')
      const rows = parseArray(textOut)
      console.log(`${tag}: "${facet.slice(0, 28)}…" → ${searches} searches, ${rows.length} picks`)

      for (const e of rows) {
        if (!e || typeof e.title !== 'string' || (e.title as string).length < 2) continue
        const outdoor = !!e.outdoor
        const category = (CATEGORIES.includes(e.category as Category) ? e.category : 'out') as Category
        const src = String(e.source ?? '').slice(0, 40) || 'the web'
        out.push({
          id: `web-${slug(src)}-${slug(String(e.title))}`,
          title: String(e.title).slice(0, 90),
          venue: String(e.venue ?? '').slice(0, 60) || src,
          area: String(e.area ?? '').slice(0, 40),
          when: String(e.when ?? 'This weekend').slice(0, 60),
          category,
          freshness: (['new', 'weekend', 'ending', 'always'].includes(e.freshness as string) ? e.freshness : 'weekend') as Pick['freshness'],
          outdoor,
          kid: !!e.kid,
          price: String(e.price ?? '').slice(0, 30),
          blurb: String(e.blurb ?? '').slice(0, 160),
          why: String(e.why ?? '').slice(0, 60),
          source: src,
          link: (typeof e.link === 'string' && e.link.startsWith('http')) ? e.link : '',
          weatherFit: deriveWeatherFit(outdoor),
          verify: true,
        })
      }
    } catch (e) {
      console.log(`${tag}: "${facet.slice(0, 28)}…" threw — ${(e as Error).message}`)
    }
  }
  return out
}
