// RESIDENT ADVISOR — keyless structured club/electronic listings (V.6.4).
//
// Ness's #3 trusted source and the canonical source for club nights & electronic music. RA's public
// GraphQL endpoint (ra.co/graphql) returns the coming weekend's events for a city area with EXACT dates,
// a real flyer image, the line-up, and an `attending` count — a genuine popularity signal the open-web
// search can't give. (RA's event PAGES are bot-gated and return a near-empty shell, but the GraphQL POST
// responds fine to a browser-ish request — verified.) Signal + link, never republish: facts only, link the
// real RA event page. No API key. Never throws (returns [] on any failure; the rest of the pipeline carries
// the feed). Picks are tagged id `web-ra-*` so they're treated as live (lead the deck, get editor-scored).
import type { Pick } from '../../src/types'
import { deriveWeatherFit, upcomingWeekend, raEventIdOf, unionCredits } from '../lib/pipeline'

// RA area ids (resolved live from ra.co/graphql `areas`). Add a city here to turn RA on for it.
const RA_AREA: Record<string, number> = { amsterdam: 29 }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const QUERY = `query GET_EVENT_LISTINGS($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
  eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
    data { event { id title date startTime contentUrl images { filename } venue { name area { name } } attending artists { name } } }
    totalResults
  }
}`

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// tz-safe: read the wall-clock parts straight off the ISO string (RA times are already local wall-clock),
// so a UTC CI runner doesn't shift "23:00" → some other hour. fixWhen() re-verifies the weekday in refresh.
function fmtWhen(dateIso: string, startIso?: string): string {
  const src = startIso || dateIso
  const [y, m, d] = src.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return 'This weekend'
  const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const hhmm = startIso ? startIso.slice(11, 16) : ''
  const time = hhmm && hhmm !== '00:00' ? ` · ${hhmm}` : ''
  return `${wd} ${d} ${MO[m - 1]}${time}`
}

type RAEvent = {
  id?: string; title?: string; date?: string; startTime?: string; contentUrl?: string
  images?: { filename?: string }[]; venue?: { name?: string; area?: { name?: string } }
  attending?: number; artists?: { name?: string }[]
}

/** This weekend's Resident Advisor club nights for a city → Pick[], most-attended first. Never throws. */
export async function raExtract(cityKey: string): Promise<Pick[]> {
  const area = RA_AREA[cityKey]
  if (!area) return []
  const wk = upcomingWeekend()
  const isoDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString()
  const end = new Date(wk.sun); end.setDate(end.getDate() + 1)   // include all of Sunday
  try {
    const res = await fetch('https://ra.co/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': UA,
        referer: `https://ra.co/events/nl/${cityKey}`,
        'ra-content-language': 'en',
      },
      body: JSON.stringify({
        operationName: 'GET_EVENT_LISTINGS',
        variables: { filters: { areas: { eq: area }, listingDate: { gte: isoDay(wk.cutoff), lte: isoDay(end) } }, pageSize: 30, page: 1 },
        query: QUERY,
      }),
      signal: AbortSignal.timeout(20000),
    }).then((r) => r.json())

    const rows: { event?: RAEvent }[] = res?.data?.eventListings?.data ?? []
    if (!rows.length) return []
    const out: Pick[] = rows
      .map((r) => r.event)
      .filter((e): e is RAEvent => !!e && typeof e.title === 'string' && (e.title as string).length > 1 && !!e.id)
      .map((e) => {
        const venue = (e.venue?.name || '').slice(0, 60)
        const acts = (e.artists ?? []).map((a) => a?.name).filter((n): n is string => !!n)
        const img = e.images?.find((i) => typeof i?.filename === 'string' && i.filename!.startsWith('http'))?.filename
        const attending = typeof e.attending === 'number' && e.attending > 0 ? e.attending : 0
        return {
          id: `web-ra-${e.id}`,
          title: String(e.title).slice(0, 90),
          venue: venue || 'Resident Advisor',
          area: '',
          when: fmtWhen(e.date || '', e.startTime),
          category: 'live',
          freshness: 'weekend',
          outdoor: false,
          kid: false,
          price: '',
          image: img,
          blurb: (acts.length ? `${acts.slice(0, 4).join(', ')}${acts.length > 4 ? ' and more' : ''} at ${venue}.` : `Club night at ${venue}.`).slice(0, 160),
          why: attending >= 20 ? `${attending} going on RA` : 'On Resident Advisor',
          source: 'Resident Advisor',
          link: e.contentUrl ? `https://ra.co${e.contentUrl}` : 'https://ra.co',
          weatherFit: deriveWeatherFit(false),
          popularity: attending || undefined,
        } as Pick
      })
    out.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))   // biggest nights first → survive the per-category cap
    return out
  } catch {
    return []
  }
}

// STRUCTURED UPGRADE ON CONTACT (V.11.10) — the RA twin of adapters/iamsterdam.ts `upgradeViaIamsterdam`.
// A web-search pick that links an ra.co event page ("DKMNTL at BRET", found via search, id
// `web-resident-advisor-…`) carries a paraphrased time and NO image: RA's event pages are JS shells,
// so the og:image pass finds nothing, and on 2026-09-05 the carry-forward stripped last week's photo.
// The same GraphQL endpoint serves the event BY ID — flyer, exact start, venue, attending. Returns the
// structured Pick (id `web-ra-<id>`, so dedupe folds it onto the listing crawl's twin), 'off-weekend'
// when RA's own date says it isn't on this weekend, null when there is nothing to upgrade. Never throws.
const EVENT_QUERY = `query GET_EVENT($id: ID!) { event(id: $id) { id title date startTime contentUrl images { filename type } venue { name area { name } } attending artists { name } } }`
export async function upgradeViaRa(p: Pick): Promise<Pick | 'off-weekend' | null> {
  const id = raEventIdOf(p.link)
  if (!id) return null
  try {
    const res = await fetch('https://ra.co/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA, referer: 'https://ra.co/events/nl/amsterdam', 'ra-content-language': 'en' },
      body: JSON.stringify({ operationName: 'GET_EVENT', variables: { id }, query: EVENT_QUERY }),
      signal: AbortSignal.timeout(15000),
    }).then((r) => r.json())
    const e: RAEvent | undefined = res?.data?.event
    if (!e || typeof e.title !== 'string' || !e.id || !e.date) return null
    const wk = upcomingWeekend()
    const day = e.date.slice(0, 10)
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (day < iso(wk.cutoff) || day > iso(wk.sun)) return 'off-weekend'
    const venue = (e.venue?.name || '').slice(0, 60)
    const acts = (e.artists ?? []).map((a) => a?.name).filter((n): n is string => !!n)
    const img = e.images?.find((i) => typeof i?.filename === 'string' && i.filename!.startsWith('http'))?.filename
    const attending = typeof e.attending === 'number' && e.attending > 0 ? e.attending : 0
    const credit = unionCredits('Resident Advisor', p.source)
    return {
      ...p,
      id: `web-ra-${e.id}`,
      title: String(e.title).slice(0, 90),
      venue: venue || p.venue || 'Resident Advisor',
      when: fmtWhen(e.date, e.startTime),
      category: p.category === 'drink' ? 'drink' : 'live',
      freshness: 'weekend',
      image: img ?? p.image,
      blurb: p.blurb && p.blurb.length >= 20 ? p.blurb : (acts.length ? `${acts.slice(0, 4).join(', ')}${acts.length > 4 ? ' and more' : ''} at ${venue}.` : `Club night at ${venue}.`).slice(0, 160),
      why: p.why || (attending >= 20 ? `${attending} going on RA` : 'On Resident Advisor'),
      source: credit.source,
      buzz: Math.max(p.buzz ?? 1, credit.buzz),
      link: e.contentUrl ? `https://ra.co${e.contentUrl}` : p.link,
      popularity: attending || p.popularity,
      verify: false,
    }
  } catch { return null }
}
