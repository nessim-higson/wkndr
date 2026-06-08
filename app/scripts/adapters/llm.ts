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
import { htmlToText, deriveWeatherFit, upcomingWeekend } from '../lib/pipeline'
import type { RosterSource } from '../roster'

const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'   // cheap/fast tier (the 3-5-haiku alias was retired)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36'

// ── global rate gate ────────────────────────────────────────────────────────
// New / low-tier Anthropic accounts cap at a few requests + ~10k input tokens per
// minute. We space ALL Messages calls (across both cities) at least GAP apart so we
// never burst past the limit. Override with ANTHROPIC_RPM as the account tier grows.
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

function systemPrompt(cityName: string): string {
  return `You are WKNDR's culture scout for ${cityName}. TODAY IS ${TODAY}.

YOUR FOCUS IS THE COMING WEEKEND: ${WEEKEND}. WKNDR is a WEEKEND app — extract the genuinely
INTERESTING, DIVERSE things to do THAT WEEKEND (and its Friday run-up), plus ongoing things that
will still be on then. Run the gamut: exciting gigs, critically-acclaimed AND crowd-pleasing
films, festivals, new openings, things CLOSING SOON, kid-friendly options, free/outdoor things,
food & drink, day-trips, members' club events (e.g. Soho House) if present.

CRUCIAL: do NOT include mid-week one-offs that happen and finish BEFORE that weekend (e.g. a
Monday or Tuesday event), and never an event whose date has already passed. Source pages list
events across many dates — pick the ones ON or spanning the weekend of ${WEEKEND}. Ongoing things
("until <future date>", "daily", a restaurant/museum open that weekend) are always fine.

Pick only the 3–8 most worth-knowing items for that weekend. Skip generic/evergreen filler
unless it is exceptional.

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
  "link": string,                       // the most specific URL you can (event/booking), else the source URL
  "image": number                       // index from CANDIDATE IMAGES of the photo that PLAINLY depicts THIS specific
                                        // item (this act / this restaurant / this show). Use -1 if no candidate clearly
                                        // belongs to it. Do NOT pick a generic page banner/hero shared by everything.
}
IMAGE MATCHING is important — this is a photo-first product. Candidate images are listed in page
order, usually right next to the item they illustrate, so an item's photo is typically the
candidate nearest it. Only assign an image you're confident shows that specific item; else -1.
If the page has nothing genuinely worth doing this weekend, return [].`
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

// Pull candidate CONTENT images out of the raw page HTML, in document order, so the LLM can
// match each item to the photo that sits next to it (e.g. each restaurant's own Eater shot).
// Logos / icons / sprites / svgs / pixels are filtered out up front.
const BAD_IMG = /\.svg(\?|$)|data:image|sprite|favicon|logo|icon|placeholder|avatar|1x1|pixel|blank\.|spacer/i
function extractImages(html: string, baseUrl: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (u?: string) => {
    if (!u) return
    let abs: string
    try { abs = (u.startsWith('//') ? 'https:' + u : new URL(u, baseUrl).href).replace(/&amp;/g, '&') } catch { return }
    if (!abs.startsWith('http') || BAD_IMG.test(abs) || seen.has(abs)) return
    seen.add(abs); out.push(abs)
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0]
    const srcset = t.match(/\bsrcset=["']([^"']+)["']/i)?.[1]
    if (srcset) {
      const best = srcset.split(',').map((s) => { const [u, d] = s.trim().split(/\s+/); return { u, w: d?.endsWith('w') ? parseInt(d) : 0 } })
        .filter((c) => c.u).sort((a, b) => b.w - a.w)[0]
      if (best) push(best.u)
    }
    push(t.match(/\bsrc=["']([^"']+)["']/i)?.[1] || t.match(/\bdata-(?:src|lazy-src|original)=["']([^"']+)["']/i)?.[1])
  }
  return out.slice(0, 20)
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
    const candidates = extractImages(html, source.url)
    const text = htmlToText(html).slice(0, 8500)   // room for the image list while keeping enough items
    if (text.length < 200) { console.log(`${tag} thin text (${text.length} chars after strip)`); return [] }

    const imgList = candidates.length
      ? `\n\nCANDIDATE IMAGES (page order — pick the index that best shows each item, -1 if none):\n${candidates.map((u, i) => `${i}: ${u}`).join('\n')}`
      : ''
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 2200,
      // the static instructions are cached across every source call in a run (cheaper)
      system: [{ type: 'text', text: systemPrompt(cityName), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `SOURCE: ${source.name} — focus: ${source.facet}\nURL: ${source.url}\n\nPAGE TEXT:\n${text}${imgList}\n\nReturn the JSON array.` }],
    })
    // gated call, with one back-off retry if we still trip the rate limit
    let res: any
    for (let attempt = 0; attempt < 2; attempt++) {
      await gate()
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body,
      }).then((r) => r.json())
      if (res?.error?.type === 'rate_limit_error' && attempt === 0) {
        console.log(`${tag} rate-limited — backing off ${Math.round((GAP + 5000) / 1000)}s`)
        await new Promise((r) => setTimeout(r, GAP + 5000))
        continue
      }
      break
    }

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
        const idx = Number(e.image)
        const image = Number.isInteger(idx) && idx >= 0 && idx < candidates.length ? candidates[idx] : undefined
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
          image,                          // the page photo the LLM matched to this item (validated later)
          weatherFit: deriveWeatherFit(outdoor),
          verify: true,   // auto-extracted — confirm before relying
        }
      })
  } catch (e) {
    console.log(`${tag} threw — ${(e as Error).message}`)
    return []
  }
}
