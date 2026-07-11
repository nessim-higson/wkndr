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

// Pace calls so a low-tier account's per-minute limits aren't tripped. Web-search responses pull
// the search RESULTS in as input tokens (several k per call), so on the lowest Anthropic tier
// (10k input tokens/min) we must keep to ~1 call/min — anything faster trips rate_limit_error and
// the fresh-event yield collapses. Override with WEBSEARCH_RPM as the account tier grows.
const RPM = Math.max(0.5, Number(process.env.WEBSEARCH_RPM) || 1)
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

// FACET SET — one paced web_search "agent" per facet. MORE facets = deeper, less-stale coverage
// PHASE 2 (2026-07-10) — web_search demoted from spine to SERENDIPITY EDGE, per the pipeline
// roadmap: YLBB, I amsterdam and RA now have deterministic adapters crawling their agendas
// directly (2026-07-09 run: 31 LBB + full iams + 30 RA), so their facets here were spending
// LLM-search budget re-finding what the crawlers already had. What remains: the one trusted
// source WITHOUT an adapter (Volkskrant) + the two thinnest slices (new eat/drink openings —
// the backlog's known gap — and big outdoor one-offs). The retired facets stay below, commented,
// for one-line re-enable if a deterministic adapter breaks.
const FACETS = [
  "de Volkskrant (volkskrant.nl) — this weekend's cultural agenda: concerts, theatre, art, film",
  'notable new restaurant & bar openings, food festivals and tastings',
  'festivals, street fairs, markets and big free or outdoor events',
]
// retired 2026-07-10 (deterministic coverage / low unique yield):
//   "Your Little Black Book (yourlittleblackbook.me) — its Amsterdam weekend agenda / weekend tips for this weekend",
//   "I amsterdam (iamsterdam.com/whats-on) — festivals, exhibitions and events on this weekend",
//   "Resident Advisor (ra.co) — club nights, DJ sets and electronic events in Amsterdam this weekend",
//   'art & museum exhibitions opening or closing soon, plus theatre and dance',
//   'open-air cinema and outdoor film screenings',
//   'rooftop bars, terraces, canal/boat events and summer pop-ups',
//   'workshops, classes, run clubs and active daytime things',

function systemPrompt(cityName: string): string {
  return `You are WKNDR's culture scout for ${cityName}. TODAY IS ${TODAY}. Your job is to find the
genuinely interesting things to do THE COMING WEEKEND: ${WEEKEND} (and its Friday run-up), plus
ongoing things (a run "until <date>", a "daily" thing, a restaurant/show open that weekend).

Use the web_search tool to find what is ACTUALLY ON in ${cityName} that weekend.

TRUSTED SOURCES — strongly prefer these, in this priority order, and CREDIT the one you used:
  1. Your Little Black Book (yourlittleblackbook.me)
  2. I amsterdam (iamsterdam.com)
  3. Resident Advisor (ra.co) — the source for club nights & electronic music
  4. de Volkskrant (volkskrant.nl)
An event you can confirm on one of these is far better than one from a random blog or a venue's own
marketing. Open the SPECIFIC event page (not just a month-listing index) to read the real date + details.

RULES:
- DATES MUST BE REAL AND EXACT, read off the specific event page. Never guess or shift a date to make
  something fall on the weekend. If you can't CONFIRM it's on or spanning ${WEEKEND}, OMIT it. A wrong
  date is far worse than a missing event. (Watch end-dates: an exhibition that closed last week is OUT.)
- THE ONE EXCEPTION — SEASONAL VENUES: a venue-class find that runs all season (an open-air cinema,
  an urban beach or swim spot, a rooftop / on-the-water terrace programme) has no per-day event date —
  do NOT invent one, and do NOT omit it for lacking one. If its own page confirms the season is
  running across ${WEEKEND} (opened, not yet closed), include it with an honest seasonal "when"
  like "All summer · evenings" or "Daily until late Sep", and freshness "always".
- For club / DJ / electronic nights, use RESIDENT ADVISOR — do NOT surface a commercial club's own
  self-promotion (e.g. big touristy clubs advertising their weekly night). Quality over hype.
- Do NOT include mid-week one-offs that finish before that weekend, or anything already past.
- LINKS MUST be the most SPECIFIC real event page you found (not a generic "/whats-on" month index) —
  if all you have is a generic listing index, OMIT the item rather than attach a vague link.
- Legal: signal + link, never republish. Use only FACTS; write your OWN ≤22-word blurb.
- Return the 4–7 best, most worth-knowing items. Skip weak filler and anything you can't date-confirm.

Return ONLY a JSON array (no prose), each item:
{
  "title": string,
  "venue": string,
  "area": string,
  "when": string,                 // human: "Sat 21 Jun · 20:00", "Fri–Sun 20–22 Jun" — or, seasonal venue: "All summer · evenings"
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

// WEATHER-AWARE FACETS (R4 feedback, 2026-07-10): "warm sunny weekend and the feed had ONE
// open-air cinema while YLBB's front page led with 8 of them." The static facet trim (Phase 2)
// cut the seasonal searches entirely — wrong lesson. Instead: check the weekend forecast
// (open-meteo, keyless) and arm the 2 facets that match it. Fails soft → no extra facets.
// (2026-07-11: the open-air facet ARMED but returned 0 — the systemPrompt's exact-date rule was
// discarding venue-class seasonal finds; it now carves out SEASONAL VENUES with an honest
// "All summer · evenings" style `when`.)
async function weatherFacets(): Promise<string[]> {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.37&longitude=4.9&daily=temperature_2m_max,precipitation_probability_max&timezone=Europe%2FAmsterdam&forecast_days=7')
    const j = await r.json() as { daily: { time: string[]; temperature_2m_max: number[]; precipitation_probability_max: number[] } }
    const satIso = `${WK.sat.getFullYear()}-${String(WK.sat.getMonth() + 1).padStart(2, '0')}-${String(WK.sat.getDate()).padStart(2, '0')}`
    const i = j.daily.time.indexOf(satIso)
    if (i < 0) return []
    const hi = Math.max(j.daily.temperature_2m_max[i], j.daily.temperature_2m_max[i + 1] ?? 0)
    const wet = Math.max(j.daily.precipitation_probability_max[i], j.daily.precipitation_probability_max[i + 1] ?? 0)
    console.log(`    · web-search weather lens: weekend hi ${hi}° · rain ${wet}%`)
    if (wet >= 55) return ['cosy indoor: museum nights, food halls, galleries, listening bars and rainy-day one-offs']
    if (hi >= 22) return [
      'open-air cinema and outdoor film screenings',
      'swimming spots, urban beaches, terraces on the water and outdoor summer one-offs',
    ]
    return ['open-air and outdoor events suited to mild weather: parks, markets, walks']
  } catch { return [] }
}

/** Run all facet searches for a city → Pick[]. Never throws. */
export async function websearchExtract(cityKey: string, cityName: string): Promise<Pick[]> {
  if (!KEY) return []
  const geo = GEO[cityKey]
  const tag = '    · web-search'
  const out: Pick[] = []
  const sys = [{ type: 'text', text: systemPrompt(cityName), cache_control: { type: 'ephemeral' } }]

  for (const facet of [...FACETS, ...(await weatherFacets())]) {
    try {
      const body = JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,   // deeper: more searches per facet so the agent digs past the first guide
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
