// THE WEEKEND GUIDES (V.11.11) — the two pages Ness opens when WKNDR feels stale, read as guides.
//
// I amsterdam's weekend guide (/en/whats-on/weekend-guide) and Your Little Black Book's weekendtips
// are the city's two editorial "this weekend" lists — his #1 and #2 sources — and neither was read
// AS a guide: the I amsterdam page is an index the crawl never opened, and LBB's went through a
// Haiku extraction capped at ten of eighty-nine. On 2026-09-10 both were full of things the deck
// didn't have (Yayoi Kusama at the Stedelijk, Open Monuments Day, Read My World, Phono Lake, Pearls
// of the City…). This adapter parses both pages DETERMINISTICALLY — headings, the paragraph under
// each, the first link, the first image — no LLM, no key — and resolves every item to the
// organiser's own record when I amsterdam serves one (event page by link, else the events sitemap
// by title): exact dates, a real flyer, a stable id that dedupe folds onto the crawl's twin. Items
// the organiser doesn't serve keep the guide's editorial image and a "This weekend" when.
//
// Every pick carries `guide` — the editorial feature. Downstream that is worth: an approval at the
// publish bar (the guides ARE the taste signal), exemption from the source/category/no-photo caps,
// and a +3 in the served ranking (modes.ts). Signal + link, never republish: the guide's own words
// are trimmed to a short blurb, the source credited, the link out is the guide's link or the
// organiser's page. Never throws.
import type { Pick, Category } from '../../src/types'
import { deriveWeatherFit, matchEventLocs, titlesAgree, iamsCategoryFromPath, raEventIdOf, mapLimit } from '../lib/pipeline'
import { iamsEventsSitemap, parseEventPage } from './iamsterdam'
import { upgradeViaRa } from './ra'

export const IAMS_GUIDE_URL = 'https://www.iamsterdam.com/en/whats-on/weekend-guide'
export const LBB_TIPS_URL = 'https://www.yourlittleblackbook.me/en/weekendtips-amsterdam/'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const get = (url: string) => fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(12000) })
  .then((r) => (r.ok && !/\/event-gone\b/.test(r.url) ? r.text() : '')).catch(() => '')

export type GuideItem = {
  title: string; section: string; text: string; link: string; image?: string
  category: Category; kid: boolean; when: string; freshness: 'new' | 'weekend' | 'always'
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m }
    return ENT[e.toLowerCase()] ?? m
  })
}
const text = (h: string) => decode(h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS = /(january|february|march|april|may|june|july|august|september|october|november|december)/i
const monIdx = (m: string) => ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(m.toLowerCase())
const fmt = (d: number, mi: number, y: number) => `${WD[new Date(Date.UTC(y, mi, d)).getUTCDay()]} ${d} ${MO[mi]}`
const yearFor = (mi: number, now: Date) => (mi < now.getMonth() - 1 ? now.getFullYear() + 1 : now.getFullYear())

/** A `when` read off a guide paragraph. Covers the shapes both pages actually use; anything else is
 *  "This weekend" (the page's own claim) — never a guessed date. Recurring markets → 'always'. */
export function whenFromText(t: string, now = new Date()): { when: string; freshness: 'weekend' | 'always' } {
  const M = MONTHS.source
  let m: RegExpMatchArray | null
  // "From: Friday, September 11, 2026 to January 17, 2027" (LBB's exhibition line)
  if ((m = t.match(new RegExp(`From:?\\s*(?:\\w+day,?\\s*)?${M}\\s+(\\d{1,2}),?\\s*(\\d{4})?\\s*(?:to|until|–|-)\\s*(?:\\w+day,?\\s*)?${M}\\s+(\\d{1,2}),?\\s*(\\d{4})?`, 'i')))) {
    const mi = monIdx(m[4]), y = m[6] ? Number(m[6]) : yearFor(mi, now)
    return { when: `Until ${fmt(Number(m[5]), mi, y)}`, freshness: 'weekend' }
  }
  // "Saturday 12 & Sunday 13 September" · "Saturday 12 and Sunday 13 September" · "Friday 11 to Sunday 13 September"
  if ((m = t.match(new RegExp(`(\\w+day),?\\s+(\\d{1,2})\\s*(?:&|and|to|–|-)\\s*(\\w+day),?\\s+(\\d{1,2})\\s+${M}`, 'i')))) {
    const mi = monIdx(m[5]), y = yearFor(mi, now)
    return { when: `${fmt(Number(m[2]), mi, y)} – ${fmt(Number(m[4]), mi, y)}`, freshness: 'weekend' }
  }
  // "Friday, September 11 to Sunday, September 13"
  if ((m = t.match(new RegExp(`(\\w+day),?\\s+${M}\\s+(\\d{1,2})\\s*(?:to|until|–|-)\\s*(?:\\w+day,?\\s*)?${M}\\s+(\\d{1,2})`, 'i')))) {
    const a = monIdx(m[2]), b = monIdx(m[4]), y = yearFor(a, now)
    return { when: `${fmt(Number(m[3]), a, y)} – ${fmt(Number(m[5]), b, y)}`, freshness: 'weekend' }
  }
  // recurring markets: "Every Saturday", "Every Friday and Saturday", "every Sunday"
  if ((m = t.match(/\bevery\s+((?:\w+day)(?:\s*(?:,|and|&)\s*\w+day)*|weekend)\b/i))) {
    return { when: `Every ${m[1].replace(/\s*,\s*/g, ' & ').replace(/\s+and\s+/gi, ' & ')}`, freshness: 'always' }
  }
  // "Friday, September 11" (US order) · "Saturday 12 September" · "on Sunday, September 13"
  if ((m = t.match(new RegExp(`(\\w+day),?\\s+${M}\\s+(\\d{1,2})`, 'i')))) {
    const mi = monIdx(m[2]); return { when: fmt(Number(m[3]), mi, yearFor(mi, now)), freshness: 'weekend' }
  }
  if ((m = t.match(new RegExp(`(\\w+day),?\\s+(\\d{1,2})\\s+${M}`, 'i')))) {
    const mi = monIdx(m[3]); return { when: fmt(Number(m[2]), mi, yearFor(mi, now)), freshness: 'weekend' }
  }
  // "until 25 October" / "runs until October 25"
  if ((m = t.match(new RegExp(`until\\s+(?:${M}\\s+(\\d{1,2})|(\\d{1,2})\\s+${M})`, 'i')))) {
    const mi = monIdx(m[1] ?? m[4]), d = Number(m[2] ?? m[3]); return { when: `Until ${fmt(d, mi, yearFor(mi, now))}`, freshness: 'weekend' }
  }
  return { when: 'This weekend', freshness: 'weekend' }
}

// ─── I AMSTERDAM — the weekend guide ─────────────────────────────────────────
// Page shape (2026-09): an all-caps <h2> per section (FESTIVALS & EVENTS · CLUBBING & PARTIES ·
// CONCERTS & GIGS · EAT & DRINK · SHOPPING & MARKETS), then an <h3> per item (occasionally an <h2>
// — "Cinema Culinair: film and brunch" — the markup slips), each followed by the item's image
// (media.iamsterdam.com, percent-encoded inside a Next.js srcSet) and one rich-text <p> with a link.
const IAMS_SECTION: [RegExp, Category, boolean][] = [
  [/famil|kid|child/i, 'out', true], [/festival|event/i, 'out', false], [/club|part/i, 'drink', false],
  [/concert|gig|music/i, 'live', false], [/eat|drink|food/i, 'eat', false], [/shop|market/i, 'market', false],
  [/exhibition|art|museum/i, 'art', false], [/theat|stage|film|cinema/i, 'stage', false],
]
export function parseIamsGuide(html: string): GuideItem[] {
  const stop = html.search(/Follow us on social media|Related articles|Others also read/)
  const doc = stop > 0 ? html.slice(0, stop) : html
  const heads = [...doc.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/g)]
  let section = ''
  const out: GuideItem[] = []
  heads.forEach((m, i) => {
    const t = text(m[2])
    const caps = t.length >= 4 && t === t.toUpperCase() && /[A-Z]/.test(t)
    if (m[1] === '2' && caps) { section = t; return }
    if (!section || !t) return
    const block = doc.slice(m.index! + m[0].length, heads[i + 1]?.index ?? doc.length)
    const title = t.replace(/^(editor'?s pick|tip)\s*:\s*/i, '').trim()
    const hrefs = [...block.matchAll(/href="([^"#]+)"/g)].map((h) => decode(h[1]))
      .filter((u) => /^https?:\/\//.test(u) || u.startsWith('/'))
      .map((u) => (u.startsWith('/') ? 'https://www.iamsterdam.com' + u : u))
      .filter((u) => !/\/(privacy|cookies|newsletter)|iamsterdam\.com\/en\/?$/i.test(u))
    const img = block.match(/media\.iamsterdam\.com(?:%2F|\/)(?:w_\d+(?:%2C|,)h_\d+(?:%2F|\/)|w_\d+(?:%2F|\/))?([^"'&\s%]+?\.(?:webp|jpg|jpeg|png))/i)
    const body = text(block).replace(/^Image (?:from|by|©)\s[^.]{0,80}?(?=\s[A-Z][a-z])/, '').trim()
    const [, category, kid] = IAMS_SECTION.find(([rx]) => rx.test(section)) ?? [null, 'out' as Category, false]
    const { when, freshness } = whenFromText(body)
    out.push({ title, section, text: body.slice(0, 420), link: hrefs[0] ?? IAMS_GUIDE_URL, image: img ? `https://media.iamsterdam.com/w_1800/${img[1]}` : undefined, category, kid, when, freshness })
  })
  return out
}

// ─── YOUR LITTLE BLACK BOOK — the weekendtips ────────────────────────────────
// Page shape (2026-09): numbered <h2> sections (➊ the week's opening · ➋ markets · ❸ events ·
// ❹ new hotspots · ➎ kids). Items are <h3>s with their paragraphs beneath — dates in the prose or a
// "Date:/From:/Location:" line — except ➊, where the <h2> itself is the item, and ➎, where the tips
// are <li>s. Images are WordPress uploads (a -700x525 suffix names the thumbnail; strip it for the
// original). Links out are the venue/ticket links; LBB's own affiliate links are last resort.
const LBB_SKIP = /^(tip:|train city|these |the firm$|amsterdam tips|to do$|accommodation|city trips|travel|read more|what else)/i
export function parseLbbWeekendTips(html: string): GuideItem[] {
  const a = html.search(/<h2[^>]*>\s*(?:<[^>]+>\s*)*AMSTERDAM WEEKEND TIPS/i)
  const b = html.search(/<h2[^>]*>\s*(?:<[^>]+>\s*)*What else is there/i)
  const doc = html.slice(a < 0 ? 0 : a, b < 0 ? undefined : b)
  const heads = [...doc.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/g)]
  let section = '', category: Category = 'out', kid = false
  const out: GuideItem[] = []
  const item = (title: string, block: string, cat: Category, isKid: boolean, sec: string) => {
    const hrefs = [...block.matchAll(/href="(https?:\/\/[^"#]+)"/g)].map((h) => decode(h[1]))
    const ext = hrefs.find((u) => !/yourlittleblackbook\.me/i.test(u) && !/instagram\.com/i.test(u)) ?? hrefs.find((u) => !/yourlittleblackbook\.me/i.test(u)) ?? hrefs[0]
    const img = block.match(/(?:data-src|src)="(https:\/\/www\.yourlittleblackbook\.me\/wp-content\/uploads\/[^"]+\.(?:jpe?g|png|webp))"/i)
    const body = text(block)
    const { when, freshness } = whenFromText(body)
    out.push({ title: title.trim(), section: sec, text: body.slice(0, 420), link: ext ?? LBB_TIPS_URL, image: img ? img[1].replace(/-\d{2,4}x\d{2,4}(?=\.\w+$)/, '') : undefined, category: cat, kid: isKid, when, freshness })
  }
  heads.forEach((m, i) => {
    const raw = text(m[2])
    const t = raw.replace(/^[➊➋➌➍➎❶❷❸❹❺]\s*/u, '').replace(/^\d+[.)]\s*/, '').trim()
    const block = doc.slice(m.index! + m[0].length, heads[i + 1]?.index ?? doc.length)
    if (m[1] === '2') {
      section = t; kid = /kid|child|famil/i.test(t)
      category = kid ? 'out' : /market/i.test(t) ? 'market' : /hotspot|restaurant|food|eat/i.test(t) ? 'eat' : /exhibition|museum|art/i.test(t) ? 'art' : 'out'
      // ➊ "Open this week: major Yayoi Kusama exhibition at the Stedelijk" — the heading IS the item
      if (/^open this week:/i.test(t)) { item(t.replace(/^open this week:\s*/i, '').replace(/^(a |the )?major\s+/i, ''), block, /exhibition|museum|expo/i.test(t) ? 'art' : category, false, section); out[out.length - 1].freshness = 'new' as never }
      // ➎ the kids list — one <li> per tip; the tip names itself before the first colon or " | venue"
      if (kid) for (const li of block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
        const body = text(li[1])
        const head = body.split(':')[0].trim()
        const sentence = (t: string) => t.length > 48 || /[?!]/.test(t) || /^(a |an |another |are |do |does |feeling|want|visiting|in the|it is|here|more |with |the weekend|now |haven|looking|fancy|is |on )/i.test(t)
        const venue = body.match(/\|\s*([^,.|]{3,60})/)?.[1]?.trim()
        const place = body.match(/\b(Museum of [A-Z]\w+|[A-Z][\w'&]+ (?:Science )?Museum|NEMO|ARTIS(?: [A-Z]\w+)*|Jeugdland|Kinderkookkaf[ée]|Artis)\b/)?.[1]
        const named = body.match(/\bthe ([A-Z][\w&' ]{2,40}?) (?:exhibition|show|festival|market)\b/)?.[1]
        const title = !sentence(head) ? head
          : named ? `${named}${venue && !/\d{2,}/.test(venue) ? ` at ${venue}` : place ? ` at ${place}` : ''}`
          : venue && !/\d{2,}/.test(venue) ? venue : place ?? ''
        if (!title || sentence(title)) continue   // a tip that never names itself is not a card
        item(title, li[1], /museum|exhibition/i.test(body) ? 'art' : 'out', true, section)
      }
      return
    }
    if (!section || LBB_SKIP.test(t)) return
    item(t.replace(/^just opened:\s*/i, '').replace(/^new in [\w-]+:\s*/i, ''), block, category, kid, section)
  })
  return out
}

// ─── resolve → Pick ──────────────────────────────────────────────────────────
const isIamsEventPage = (u: string) => /iamsterdam\.com\/(?:en\/whats-on\/calendar|uit\/agenda)\/[^/]+\/[^/]+\/[^/?#]+/i.test(u)

/** The organiser's record for a guide item, when I amsterdam serves one: by the item's own link
 *  first, then the events sitemap by title. Returns null when nothing agrees or nothing spans the
 *  weekend — the item then ships on the guide's own facts. */
/** The names a guide item might be listed under: "Yayoi Kusama exhibition at the Stedelijk" is
 *  "Yayoi Kusama" on the organiser's page — try the full title, then the part before "at/in/@/:",
 *  then that without genre words. */
export function titleVariants(title: string): string[] {
  const cut = title.split(/\s+(?:at|in|@)\s+|:\s+/i)[0].trim()
  const bare = cut.replace(/\b(exhibition|expo|show|festival|market|markt|party|edition|the|a|an|major|new)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  // ≥ 8 chars, ≥ 2 tokens: "Amstel 1" or "Sunday" would match half the sitemap and cost a fetch each
  return [...new Set([title, cut, bare].filter((t) => t.length >= 8 && t.trim().split(/\s+/).length >= 2))]
}
async function organiserRecord(item: GuideItem): Promise<{ pick: Pick; url: string } | null> {
  const own = isIamsEventPage(item.link) ? item.link : null
  const locs = await iamsEventsSitemap()
  const urls = [...new Set([...(own ? [own] : []), ...titleVariants(item.title).flatMap((t) => matchEventLocs(t, locs, 2))])].slice(0, 4)
  for (const url of urls) {
    const html = await get(url)
    if (!html) continue
    const r = parseEventPage(html, url, iamsCategoryFromPath(url) ?? item.category)
    if (!r || !r.spansWeekend) continue
    if (url !== own && !titlesAgree(item.title, r.pick.title) && !titlesAgree(r.pick.title, item.title)) continue
    return { pick: r.pick, url }
  }
  return null
}

function toPick(item: GuideItem, guide: string, source: string, idPrefix: string, why: string, rec: { pick: Pick; url: string } | null): Pick {
  const blurb = item.text.length >= 20 ? item.text.slice(0, 160) : ''
  if (rec) {
    const s = rec.pick
    // I amsterdam's guide title always (editorial English — "Open Monuments Day", "Pearls of the City" —
    // what Ness recognises and what the weekly pile names); for LBB the shorter, cleaner of the two
    const title = guide.startsWith('I amsterdam') || /\/uit\//.test(rec.url) ? item.title : (s.title.length <= item.title.length ? s.title : item.title)
    // the guide's claim rides the organiser's record: "Open this week" is `new`, a recurring market `always`
    const freshness = item.freshness === 'new' ? 'new' : item.freshness === 'always' ? 'always' : s.freshness
    return { ...s, title, freshness, blurb: blurb || s.blurb, why, kid: item.kid || s.kid, source, guide, verify: false }
  }
  return {
    id: `${idPrefix}-${slug(item.title)}`,
    title: item.title.slice(0, 90),
    venue: item.text.match(/Location:\s*([^.|]{3,60})/)?.[1]?.trim() ?? source,
    area: '',
    when: item.when,
    category: item.category,
    freshness: item.freshness,
    outdoor: item.category === 'out' || item.category === 'market',
    kid: item.kid,
    price: /\bfree\b/i.test(item.text) ? 'free' : '',
    image: item.image,
    blurb: blurb || item.title,
    why,
    source,
    link: item.link,
    weatherFit: deriveWeatherFit(item.category === 'out' || item.category === 'market'),
    verify: false,
    guide,
  }
}

/** I amsterdam's weekend guide as Pick[]. Keyless. Never throws. */
export async function iamsGuideExtract(cityKey: string): Promise<Pick[]> {
  if (cityKey !== 'amsterdam') return []
  try {
    const items = parseIamsGuide(await get(IAMS_GUIDE_URL))
    return await mapLimit(items, 4, async (it) => toPick(it, 'I amsterdam weekend guide', 'I amsterdam', 'web-guide-iams', "In I amsterdam's weekend guide", await organiserRecord(it)))
  } catch { return [] }
}

/** Your Little Black Book's weekendtips as Pick[]. Keyless. Never throws. */
export async function lbbWeekendTipsExtract(cityKey: string): Promise<Pick[]> {
  if (cityKey !== 'amsterdam') return []
  try {
    const items = parseLbbWeekendTips(await get(LBB_TIPS_URL))
    return await mapLimit(items, 4, async (it) => {
      const rec = await organiserRecord(it)
      let pick = toPick(it, 'LBB weekendtips', 'Your Little Black Book', 'web-lbb-tips', "One of LBB's weekend tips", rec)
      if (!rec && raEventIdOf(it.link)) { const r = await upgradeViaRa(pick); if (r && r !== 'off-weekend') pick = { ...r, guide: 'LBB weekendtips', why: pick.why } }
      return pick
    })
  } catch { return [] }
}

/** The two guides name the same events in different words ("Read My World Book Market in the
 *  Tolhuistuin" ↔ "Read My World"; "Vintage market during Summer @ H'ART" ↔ "@ H'ART: Vintage
 *  Market"). Fold the LBB tip onto the I amsterdam item — the one with the organiser record and
 *  image, usually — keeping both credits and both guides. Pure; the loose title match is the pile's. */
export function foldGuides(iams: Pick[], lbb: Pick[], loose: (a: string, b: string) => boolean): Pick[] {
  const out = [...iams]
  for (const t of lbb) {
    const twin = out.find((p) => loose(p.title, t.title) || loose(t.title, p.title))
    if (!twin) { out.push(t); continue }
    const keep = twin.image || !t.image ? twin : { ...t, title: twin.title }
    const guide = [...new Set([twin.guide, t.guide].flatMap((g) => (g ? g.split(' · ') : [])))].join(' · ')
    const src = [...new Set([twin.source, t.source].flatMap((g) => (g ? g.split(' · ') : [])))]
    Object.assign(keep, { guide, source: src.join(' · '), buzz: Math.max(twin.buzz ?? 1, t.buzz ?? 1, src.length), kid: twin.kid || t.kid })
    if (keep !== twin) out[out.indexOf(twin)] = keep
  }
  return out
}
