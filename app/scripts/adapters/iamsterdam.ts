// I AMSTERDAM — the deterministic VARIETY engine (V.6.16).
//
// iamsterdam.com is a keyless front-end over "The Feed Factory", the national aggregator that hundreds of
// Amsterdam venues + organisers self-submit to (~1,500 live events, updated hourly). Every event detail page
// embeds a clean schema.org Event JSON-LD block — exact dates, a real flyer image, venue, price, category — so
// ONE keyless adapter covers 7 of WKNDR's 9 categories deterministically (exhibitions, festivals, concerts,
// theatre, food, nightlife, shopping): the pop-ups / markets / exhibitions / theatre breadth beyond concerts +
// clubs. This is the source that lets web_search demote from "carries all the variety" to serendipity.
//
// Crawl the robots-Allowed category listing pages → collect event-detail links → fetch each detail → parse its
// Event JSON-LD → keep events whose run SPANS the coming weekend → map to Pick. Pure parse, no LLM, keyless,
// bounded (cap per category). id prefix web-iams- (treated as live). Never throws (returns [] on any failure —
// the rest of the pipeline carries the feed). ra.ts is the shape template.
//
// V.11.9 — THE SAME PARSER ALSO UPGRADES KEYLESS PICKS ON CONTACT (`upgradeViaIamsterdam`). A web-search
// pick that cites I amsterdam but carries Haiku's guessed category, a paraphrased date and no image is one
// hop from the organiser's real record: its own link when that IS an event page, else the events sitemap
// (~2,900 locs, keyless) matched by title. The 2026-09-03 feed shipped a tattoo convention filed as
// `market` wearing the Bloemenmarkt's photo while its event page held two real flyers.
import type { Pick, Category } from '../../src/types'
import { deriveWeatherFit, upcomingWeekend, htmlToText, mapLimit, iamsCategoryFromPath, linkIsIndex, matchEventLocs, titlesAgree, unionCredits } from '../lib/pipeline'

const BASE = 'https://www.iamsterdam.com'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const PER_CAT = 12   // cap detail fetches per category (≈ inside the run budget; pure parse, no API cost)

// iamsterdam calendar namespace → WKNDR category. (markets have no clean namespace; canon covers them.)
const CATS: { path: string; category: Category }[] = [
  { path: 'exhibitions', category: 'art' },
  { path: 'festivals', category: 'out' },
  { path: 'concerts-and-music', category: 'live' },
  { path: 'theatre-and-stage', category: 'stage' },
  { path: 'eating-and-drinking', category: 'eat' },
  { path: 'nightlife', category: 'drink' },
  { path: 'shopping', category: 'shop' },
]

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const slugOf = (rel: string) => rel.split('?')[0].replace(/\/$/, '').split('/').pop() || ''
// A REMOVED listing redirects to /event-gone (a 200 with a full page and no Event JSON-LD) — read it
// as nothing, not as a page to parse. Seen live 2026-09-05: Concertgebouw Open, still in the sitemap.
const get = (url: string) => fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) })
  .then((r) => (r.ok && !/\/event-gone\b/.test(r.url) ? r.text() : ''))

// Pull the first @type:"Event" object out of a page's JSON-LD blocks (handles a bare object, an array, or @graph).
export function eventLd(html: string): Record<string, unknown> | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim())
      const arr = Array.isArray(j) ? j : (Array.isArray((j as { '@graph'?: unknown[] })['@graph']) ? (j as { '@graph': unknown[] })['@graph'] : [j])
      const ev = (arr as Record<string, unknown>[]).find((o) => o && o['@type'] === 'Event')
      if (ev) return ev
    } catch { /* malformed block — skip */ }
  }
  return null
}

// ISO start/end → a human `when`, tz-safe off the string. Single day → "Sat 4 Jul · 20:00"; a run that ends
// well after the weekend → "Until Sun 2 Sep"; a short span → "Fri 3 – Sun 5 Jul". fixWhen re-checks weekdays.
function fmtWhen(startIso: string, endIso: string, wkEndMs: number): string {
  const part = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return { wd: WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], d, mo: MO[m - 1] } }
  const s = part(startIso), e = part(endIso)
  const hhmm = startIso.slice(11, 16)
  const time = hhmm && hhmm !== '00:00' ? ` · ${hhmm}` : ''
  if (startIso.slice(0, 10) === endIso.slice(0, 10)) return `${s.wd} ${s.d} ${s.mo}${time}`
  const endMs = new Date(endIso.slice(0, 10) + 'T00:00:00Z').getTime()
  if (endMs - wkEndMs > 3 * 864e5) return `Until ${e.wd} ${e.d} ${e.mo}`
  return `${s.wd} ${s.d} – ${e.wd} ${e.d} ${e.mo}`
}

/** Parse ONE event detail page into a Pick (raw image; caller portrait-wraps). `spansWeekend` is
 *  reported rather than filtered so the upgrade path can tell "not this weekend" from "not an event". */
export function parseEventPage(html: string, pageUrl: string, category: Category): { pick: Pick; spansWeekend: boolean } | null {
  const wk = upcomingWeekend()
  const wkStart = Date.UTC(wk.cutoff.getFullYear(), wk.cutoff.getMonth(), wk.cutoff.getDate())      // Friday 00:00
  const wkEnd = Date.UTC(wk.sun.getFullYear(), wk.sun.getMonth(), wk.sun.getDate() + 1)             // Monday 00:00
  const ev = eventLd(html)
  const name = ev?.name
  const startDate = ev?.startDate as string | undefined
  if (!ev || typeof name !== 'string' || !startDate) return null
  const endDate = (ev.endDate as string) || startDate
  const startMs = Date.parse(startDate), endMs = Date.parse(endDate)
  const spansWeekend = startMs < wkEnd && endMs >= wkStart
  const imgRaw = Array.isArray(ev.image) ? (ev.image as unknown[]).find((x) => typeof x === 'string') : ev.image
  const loc = (ev.location || {}) as { name?: string; address?: { streetAddress?: string; addressLocality?: string }; url?: string }
  const venue = String(loc.name || '').slice(0, 60)
  const locality = loc.address?.addressLocality
  const area = String((locality && locality !== 'Amsterdam' ? locality : (loc.address?.streetAddress || '')) || '').slice(0, 40)
  const offer = (Array.isArray(ev.offers) ? ev.offers[0] : ev.offers) as { price?: string | number } | undefined
  const priceStr = offer?.price != null ? (Number(offer.price) === 0 ? 'free' : `from €${offer.price}`) : 'ticketed'
  // strip HTML; collapse a doubled leading phrase ("David Levinthal David Levinthal (born…)" — the
  // page repeats the heading at the start of its body text)
  const blurb = htmlToText(String(ev.description || '')).replace(/^((?:\S+\s+){1,5})\1/, '$1').slice(0, 160)
  // LINK — the most direct page we can offer. The JSON-LD `url` is unreliable (often the generic
  // /en/whats-on index, which dead-ends the card's "open at"). Rule: an OFF-SITE organiser/venue event
  // page wins (the "talked about elsewhere" link); otherwise the exact detail page we just crawled.
  const evUrl = typeof ev.url === 'string' && (ev.url as string).startsWith('http') ? (ev.url as string) : ''
  const link = evUrl && !/iamsterdam\.com/i.test(evUrl) ? evUrl : pageUrl
  const pick: Pick = {
    id: `web-iams-${slugOf(pageUrl)}`,
    title: name.slice(0, 90),
    venue: venue || 'I amsterdam',
    area,
    when: fmtWhen(startDate, endDate, wkEnd),
    category,
    freshness: 'weekend',
    outdoor: category === 'out',
    kid: false,
    price: priceStr,
    image: typeof imgRaw === 'string' && imgRaw.startsWith('http') ? imgRaw : undefined,
    blurb: blurb || name,
    why: 'On I amsterdam',
    source: 'I amsterdam',
    link,
    weatherFit: deriveWeatherFit(category === 'out'),
    verify: false,
  }
  return { pick, spansWeekend }
}

/** This weekend's I amsterdam events as Pick[] (raw images; caller portrait-wraps). Never throws. */
export async function iamsterdamExtract(cityKey: string): Promise<Pick[]> {
  if (cityKey !== 'amsterdam') return []   // The Feed Factory front-end is Amsterdam-scoped
  const out: Pick[] = []
  for (const { path, category } of CATS) {
    try {
      const listing = await get(`${BASE}/en/whats-on/calendar/${path}`)
      const links = [...new Set([...listing.matchAll(/href="(\/en\/whats-on\/calendar\/[^"?#]+)"/g)].map((m) => m[1]))]
        .filter((u) => u.split('/').length >= 6 && !u.includes('/business/'))
        .slice(0, PER_CAT)
      const picks = await mapLimit(links, 4, async (rel): Promise<Pick | null> => {
        try {
          const r = parseEventPage(await get(BASE + rel), BASE + rel, category)
          return r && r.spansWeekend ? r.pick : null
        } catch { return null }
      })
      for (const p of picks) if (p) out.push(p)
    } catch { /* skip this category */ }
  }
  return out
}

// THE EVENTS SITEMAP — every event page I amsterdam serves (~2,900 locs, EN + NL twins), keyless,
// fetched once per run and shared. Empty on any failure: the upgrade then only fires on picks that
// already link an event page.
let sitemap: Promise<string[]> | null = null
export function iamsEventsSitemap(): Promise<string[]> {
  sitemap ??= get(`${BASE}/sitemap/events.xml`)
    .then((xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).filter((u) => u.startsWith(BASE)))
    .catch(() => [] as string[])
  return sitemap
}

const isEventPage = (url: string) => /iamsterdam\.com\/(?:en\/whats-on\/calendar|uit\/agenda)\/[^/]+\/[^/]+\/[^/]+/i.test(url) && !linkIsIndex(url)

/** STRUCTURED UPGRADE ON CONTACT — turn a keyless pick into the organiser's own record when I amsterdam
 *  serves one for it: its own link if that is an event page, else the sitemap by title. Returns the
 *  structured Pick (new `web-iams-` id, real dates/category/image, the keyless pick's editorial voice
 *  kept), `'off-weekend'` when the organiser's dates say the event is NOT on this weekend (the keyless
 *  claim was wrong — drop it), or null when there is nothing to upgrade to. Never throws. */
export async function upgradeViaIamsterdam(p: Pick): Promise<Pick | 'off-weekend' | null> {
  try {
    // its own link first when that is an event page, then the sitemap's best few — walked in order,
    // because a matched page can lack Event JSON-LD (a concert sub-page) or name a different event
    const own = p.link && isEventPage(p.link) ? p.link : null
    const urls = [...new Set([...(own ? [own] : []), ...matchEventLocs(p.title, await iamsEventsSitemap())])]
    let r: ReturnType<typeof parseEventPage> = null
    let via: string | null = null
    for (const url of urls) {
      const html = await get(url)
      if (!html) continue
      const cand = parseEventPage(html, url, iamsCategoryFromPath(url) ?? p.category)
      if (!cand) continue
      // the page must be about THIS event — a slug match is a lead, the organiser's own name is the proof
      if (!titlesAgree(p.title, cand.pick.title) && !titlesAgree(cand.pick.title, p.title)) continue
      // a SITEMAP match whose dates miss the weekend may be a different run of the same name (last
      // year's World Press Photo page) — keep looking for one that spans it; only the pick's OWN
      // link is authoritative enough to drop on
      if (!cand.spansWeekend && url !== own) continue
      r = cand; via = url
      break
    }
    if (!r) return null
    if (!r.spansWeekend) return via === own ? 'off-weekend' : null
    const s = r.pick
    const credit = unionCredits('I amsterdam', p.source)
    return {
      ...s,
      // OUR words beat the organiser's copy: a web-search blurb is a ≤22-word editorial line, the
      // JSON-LD description is marketing. The hook (`why`) likewise. Facts (dates/venue/price/image/
      // category) are the organiser's — that is the whole point of the upgrade.
      blurb: p.blurb && p.blurb.length >= 20 ? p.blurb : s.blurb,
      why: p.why || s.why,
      kid: p.kid || s.kid,
      source: credit.source,
      buzz: Math.max(p.buzz ?? 1, credit.buzz),
      popularity: p.popularity,
    }
  } catch { return null }
}
