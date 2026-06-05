// LLM EXTRACTOR — the general-purpose "interesting + diverse" engine. Reads a source page
// (editorial, listings, venue, RSS) and pulls the most interesting / time-sensitive / exciting
// events out of it as structured Picks, tagged to our taxonomy. This is what no ticketing API
// gives you: the free things, art runs, food, festivals, the buzzy stuff — across categories.
//
// Needs ANTHROPIC_API_KEY (cents per run). Without it the adapter no-ops and the keyless RSS +
// canon floor carry the pool. Set ANTHROPIC_MODEL to override the model.
//
// Signal + link, never republish: the prompt extracts FACTS only and writes OUR OWN one-line
// blurb, always crediting + linking the source.
import type { Pick, Category } from '../../src/types'
import { htmlToText, deriveWeatherFit } from '../lib/pipeline'
import type { RosterSource } from '../roster'

const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'   // cheap/fast tier (the 3-5-haiku alias was retired)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36'

const CATEGORIES: Category[] = ['live', 'art', 'stage', 'eat', 'drink', 'market', 'out', 'daytrip']

function systemPrompt(cityName: string): string {
  return `You are WKNDR's culture scout for ${cityName}. You read a source page and extract the
genuinely INTERESTING, DIVERSE, TIME-SENSITIVE things to do THIS WEEKEND — not a dump of every
listing. Run the gamut: exciting gigs, critically-acclaimed AND crowd-pleasing films, festivals,
new openings, things CLOSING SOON, kid-friendly options, free/outdoor things, food & drink,
day-trips, members' club events (e.g. Soho House) if present.

Pick only the 3–8 most worth-knowing items on the page. Skip generic/evergreen filler unless it
is exceptional.

LEGAL: signal + link, never republish. Use only FACTS (name, venue, date, price). Write your OWN
short blurb in your own words — never copy the source's sentences.

Return ONLY a JSON array (no prose), each item:
{
  "title": string,
  "venue": string,
  "area": string,                       // neighbourhood/area if known, else ""
  "when": string,                       // human, e.g. "Sat 7 Jun · 20:00" or "Fri–Sun 6–8 Jun"
  "category": one of ${JSON.stringify(CATEGORIES)},   // films/theatre = "stage"
  "freshness": "new" | "weekend" | "ending" | "always",  // "ending" = closing soon
  "outdoor": boolean,
  "kid": boolean,
  "price": string,                      // "free", "from €25", "ticketed", etc.
  "blurb": string,                      // YOUR words, ≤ 22 words, why it's interesting
  "why": string,                        // ≤ 12 words: the hook (e.g. "final weekend", "sells out", "critics' pick")
  "link": string                        // the most specific URL you can (event/booking), else the source URL
}
If the page has nothing genuinely worth doing this weekend, return [].`
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}
function parseArray(text: string): Record<string, unknown>[] {
  const a = text.indexOf('['), b = text.lastIndexOf(']')
  if (a === -1 || b === -1) return []
  try { const v = JSON.parse(text.slice(a, b + 1)); return Array.isArray(v) ? v : [] } catch { return [] }
}

/** Read one source with the LLM → Pick[]. Never throws (returns [] on any failure). */
export async function llmExtract(cityName: string, source: RosterSource): Promise<Pick[]> {
  if (!KEY) return []
  const tag = `    · ${source.name}:`
  try {
    const r = await fetch(source.url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' } })
    const html = r.ok ? await r.text() : ''
    if (!html) { console.log(`${tag} fetch ${r.status} — no HTML`); return [] }
    const text = htmlToText(html).slice(0, 14000)
    if (text.length < 200) { console.log(`${tag} thin text (${text.length} chars after strip)`); return [] }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2200,
        // the static instructions are cached across every source call in a run (cheaper)
        system: [{ type: 'text', text: systemPrompt(cityName), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `SOURCE: ${source.name} — focus: ${source.facet}\nURL: ${source.url}\n\nPAGE TEXT:\n${text}\n\nReturn the JSON array.` }],
      }),
    }).then((r) => r.json())

    if (res?.error || !Array.isArray(res?.content)) {
      console.log(`${tag} API → ${JSON.stringify(res?.error ?? res?.type ?? res).slice(0, 200)}`)
      return []
    }
    const out = res?.content?.[0]?.text ?? ''
    const rows = parseArray(out)
    console.log(`${tag} ${rows.length} extracted (read ${text.length} chars)`)
    return rows
      .filter((e) => e && typeof e.title === 'string' && (e.title as string).length > 1)
      .map((e): Pick => {
        const outdoor = !!e.outdoor
        const category = (CATEGORIES.includes(e.category as Category) ? e.category : 'out') as Category
        return {
          id: `llm-${slug(source.name)}-${slug(String(e.title))}`,
          title: String(e.title).slice(0, 90),
          venue: String(e.venue ?? '').slice(0, 60) || source.name,
          area: String(e.area ?? '').slice(0, 40),
          when: String(e.when ?? 'This weekend').slice(0, 60),
          category,
          freshness: (['new', 'weekend', 'ending', 'always'].includes(e.freshness as string) ? e.freshness : 'weekend') as Pick['freshness'],
          outdoor,
          kid: !!e.kid,
          price: String(e.price ?? '').slice(0, 30),
          blurb: String(e.blurb ?? '').slice(0, 160),
          why: String(e.why ?? '').slice(0, 60),
          source: source.name,
          link: (typeof e.link === 'string' && e.link.startsWith('http')) ? e.link : source.url,
          weatherFit: deriveWeatherFit(outdoor),
          verify: true,   // auto-extracted — confirm before relying
        }
      })
  } catch (e) {
    console.log(`${tag} threw — ${(e as Error).message}`)
    return []
  }
}
