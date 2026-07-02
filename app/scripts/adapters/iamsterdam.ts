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
import type { Pick, Category } from '../../src/types'
import { deriveWeatherFit, upcomingWeekend, htmlToText, mapLimit } from '../lib/pipeline'

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

// Pull the first @type:"Event" object out of a page's JSON-LD blocks (handles a bare object, an array, or @graph).
function eventLd(html: string): Record<string, unknown> | null {
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

/** This weekend's I amsterdam events as Pick[] (raw images; caller portrait-wraps). Never throws. */
export async function iamsterdamExtract(cityKey: string): Promise<Pick[]> {
  if (cityKey !== 'amsterdam') return []   // The Feed Factory front-end is Amsterdam-scoped
  const wk = upcomingWeekend()
  const wkStart = Date.UTC(wk.cutoff.getFullYear(), wk.cutoff.getMonth(), wk.cutoff.getDate())      // Friday 00:00
  const wkEnd = Date.UTC(wk.sun.getFullYear(), wk.sun.getMonth(), wk.sun.getDate() + 1)             // Monday 00:00
  const out: Pick[] = []
  for (const { path, category } of CATS) {
    try {
      const listing = await fetch(`${BASE}/en/whats-on/calendar/${path}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) }).then((r) => r.text())
      const links = [...new Set([...listing.matchAll(/href="(\/en\/whats-on\/calendar\/[^"?#]+)"/g)].map((m) => m[1]))]
        .filter((u) => u.split('/').length >= 6 && !u.includes('/business/'))
        .slice(0, PER_CAT)
      const picks = await mapLimit(links, 4, async (rel): Promise<Pick | null> => {
        try {
          const html = await fetch(BASE + rel, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) }).then((r) => r.text())
          const ev = eventLd(html)
          const name = ev?.name
          const startDate = ev?.startDate as string | undefined
          if (!ev || typeof name !== 'string' || !startDate) return null
          const endDate = (ev.endDate as string) || startDate
          const startMs = Date.parse(startDate), endMs = Date.parse(endDate)
          if (!(startMs < wkEnd && endMs >= wkStart)) return null                 // must SPAN the weekend
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
          const link = evUrl && !/iamsterdam\.com/i.test(evUrl) ? evUrl : BASE + rel
          return {
            id: `web-iams-${slugOf(rel)}`,
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
          } satisfies Pick
        } catch { return null }
      })
      for (const p of picks) if (p) out.push(p)
    } catch { /* skip this category */ }
  }
  return out
}
