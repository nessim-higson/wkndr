// VERBATIM CARDS — Ness's request (2026-08-08): review cards that carry I amsterdam's and
// Your Little Black Book's weekend recommendations IN THE SOURCE'S OWN WORDS, with grey
// imagery, on the curation board's VERBATIM tab.
//
// This is a REVIEW EXHIBIT, deliberately outside the live pipeline: nothing here writes to
// picks/pending/candidates, and the app never reads this file — only the board does. The
// legal model (signal + link, never republish — CLAUDE.md) still governs anything that
// SHIPS; a verbatim blurb must be rewritten before a pick goes live.
//
// Keyless + deterministic on purpose: no LLM touches the text, so "verbatim" is true by
// construction. LBB's WordPress RSS (content:encoded) carries the full weekendtips article;
// I amsterdam's event pages carry schema.org Event JSON-LD with their full descriptions.
// Never throws — a source that fails to fetch just contributes zero items.
import { mapLimit, upcomingWeekend } from './lib/pipeline'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const OUT = new URL('../public/data/verbatim.amsterdam.json', import.meta.url).pathname

const get = (u: string) => fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) }).then((r) => r.text())
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

// ─── verbatim-safe HTML → text ──────────────────────────────────────────────
// The pipeline's htmlToText flattens entities to spaces — fine for an LLM, fatal for a
// verbatim claim ("café" must stay "café"). This one decodes them properly.
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', aacute: 'á', agrave: 'à', acirc: 'â', auml: 'ä',
  iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï', oacute: 'ó', ograve: 'ò', ocirc: 'ô', ouml: 'ö',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ', szlig: 'ß',
  Eacute: 'É', Egrave: 'È', Euml: 'Ë', Ouml: 'Ö', Uuml: 'Ü',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', sbquo: '‚', bdquo: '„',
  ndash: '–', mdash: '—', hellip: '…', euro: '€', pound: '£', deg: '°', frac12: '½',
  times: '×', middot: '·', bull: '•', laquo: '«', raquo: '»', trade: '™', copy: '©', reg: '®',
}
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(+d))
    .replace(/&([a-zA-Z]+);/g, (m, n) => NAMED[n] ?? m)
}
export function verbatimText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|figure)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim()
}

type VerbItem = {
  id: string
  title: string
  text: string          // the source's own words, complete and untouched
  when?: string
  venue?: string
  area?: string
  price?: string
  category?: string
  link: string          // the item's own outbound page, else the source article
}

// ─── YOUR LITTLE BLACK BOOK — the weekly weekendtips article, via RSS ───────
const LBB_FEED = 'https://www.yourlittleblackbook.me/feed/'
const cdata = (s: string) => s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
const rssTag = (item: string, t: string) => { const m = item.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? cdata(m[1]) : '' }

/** Split the article HTML into per-tip blocks: each h2/h3/h4 heading + everything until the
 *  next heading. Exported for testing. */
export function lbbItems(articleHtml: string, articleLink: string): VerbItem[] {
  const out: VerbItem[] = []
  const hs = [...articleHtml.matchAll(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi)]
  for (let i = 0; i < hs.length; i++) {
    const title = verbatimText(hs[i][2]).replace(/\s+/g, ' ').trim()
    if (!title || title.length < 3) continue
    // housekeeping headings, not recommendations
    if (/nieuwsbrief|newsletter|volg (ons|je|us)|save this|bewaar dit|deel (dit|je)|share this|meer (weekend)?tips|more (weekend )?tips|hotspot updates|comments?|reacties/i.test(title)) continue
    // article chrome (seen on the 2026-08-07 issue): the guide's own lede block, the AMSTERDAM
    // UPDATES signup, in-article section headers ("➋ … op een rij:" / anything ending in ":"),
    // and the closing "wat er verder…" outro — none of these is a recommendation
    if (/^amsterdam weekend guide|^amsterdam updates|^wat er verder/i.test(title)) continue
    if (/:\s*$/.test(title) || /^[➀-➓➊❶-❿①-⑩]/.test(title)) continue
    const start = hs[i].index! + hs[i][0].length
    const end = i + 1 < hs.length ? hs[i + 1].index! : articleHtml.length
    const block = articleHtml.slice(start, end)
    const text = verbatimText(block)
    if (text.length < 60) continue   // a bare heading with no body isn't a tip
    if (/geeft vereiste velden aan|this field is for validation/i.test(text)) continue   // an embedded signup form
    // this tip's own outbound link: first anchor that isn't social/share/LBB-internal chrome
    let link = ''
    for (const a of block.matchAll(/<a[^>]+href="(https?:[^"]+)"[^>]*>/gi)) {
      const u = a[1]
      if (/facebook|instagram|pinterest|whatsapp|twitter|x\.com|linkedin|mailto/i.test(u)) continue
      if (/yourlittleblackbook\.me\/(tag|category|author|feed)/i.test(u)) continue
      if (/yourlittleblackbook\.me/i.test(u)) continue   // internal cross-links are LBB chrome, not the venue
      link = u; break
    }
    out.push({ id: `verb-lbb-${slug(title)}`, title, text, link: link || articleLink })
  }
  return out
}

async function lbb(): Promise<{ article: { title: string; link: string; pubDate: string } | null; items: VerbItem[] }> {
  try {
    const xml = await get(LBB_FEED)
    const arts: { title: string; link: string; pubDate: string; html: string; t: number }[] = []
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const it = m[1]
      const title = rssTag(it, 'title')
      if (!/weekendtips/i.test(title) || !/amsterdam/i.test(title)) continue
      const html = cdata((it.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/) || ['', ''])[1])
      if (!html) continue
      const pubDate = rssTag(it, 'pubDate')
      arts.push({ title: decodeEntities(title), link: rssTag(it, 'link'), pubDate, html, t: Date.parse(pubDate) || 0 })
    }
    arts.sort((a, b) => b.t - a.t)
    const art = arts[0]
    if (!art) return { article: null, items: [] }
    return { article: { title: art.title, link: art.link, pubDate: art.pubDate }, items: lbbItems(art.html, art.link) }
  } catch { return { article: null, items: [] } }
}

// ─── I AMSTERDAM — their weekend selection, full JSON-LD descriptions ───────
const BASE = 'https://www.iamsterdam.com'
// their own "this weekend" collection first (that IS the recommendation); category listings as fallback
const WEEKEND_PAGES = ['/en/whats-on/calendar/whats-on-this-weekend', '/en/whats-on/whats-on-this-weekend']
const CAT_PAGES = ['exhibitions', 'festivals', 'concerts-and-music', 'theatre-and-stage', 'eating-and-drinking', 'nightlife', 'shopping']
const MAX_DETAILS = 40
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
const detailLinks = (html: string) =>
  [...new Set([...html.matchAll(/href="(\/en\/whats-on\/calendar\/[^"?#]+)"/g)].map((m) => m[1]))]
    .filter((u) => u.split('/').length >= 6 && !u.includes('/business/'))

async function iamsterdam(): Promise<{ page: string; items: VerbItem[] }> {
  const wk = upcomingWeekend()
  const wkStart = Date.UTC(wk.cutoff.getFullYear(), wk.cutoff.getMonth(), wk.cutoff.getDate())
  const wkEnd = Date.UTC(wk.sun.getFullYear(), wk.sun.getMonth(), wk.sun.getDate() + 1)
  let links: string[] = []
  let page = ''
  for (const p of WEEKEND_PAGES) {
    try {
      const found = detailLinks(await get(BASE + p))
      if (found.length >= 5) { links = found.slice(0, MAX_DETAILS); page = BASE + p; break }
    } catch { /* try the next candidate */ }
  }
  if (!links.length) {   // no weekend collection page — walk their category listings instead
    page = BASE + '/en/whats-on/calendar'
    for (const cat of CAT_PAGES) {
      try { links.push(...detailLinks(await get(`${BASE}/en/whats-on/calendar/${cat}`)).slice(0, 8)) } catch { /* skip category */ }
    }
    links = [...new Set(links)].slice(0, MAX_DETAILS)
  }
  const items = await mapLimit(links, 4, async (rel): Promise<VerbItem | null> => {
    try {
      const html = await get(BASE + rel)
      const ev = eventLd(html)
      const name = ev?.name
      const startDate = ev?.startDate as string | undefined
      if (!ev || typeof name !== 'string' || !startDate) return null
      const endDate = (ev.endDate as string) || startDate
      if (!(Date.parse(startDate) < wkEnd && Date.parse(endDate) >= wkStart)) return null   // must span the weekend
      const loc = (ev.location || {}) as { name?: string; address?: { streetAddress?: string; addressLocality?: string } }
      const locality = loc.address?.addressLocality
      const offer = (Array.isArray(ev.offers) ? ev.offers[0] : ev.offers) as { price?: string | number } | undefined
      const evUrl = typeof ev.url === 'string' && ev.url.startsWith('http') ? ev.url : ''
      return {
        id: `verb-iams-${slug(rel.split('/').pop() || name)}`,
        title: decodeEntities(name).slice(0, 120),
        text: verbatimText(String(ev.description || '')),   // FULL description, their words, no cap
        when: fmtWhen(startDate, endDate, wkEnd),
        venue: String(loc.name || '').slice(0, 60),
        area: String((locality && locality !== 'Amsterdam' ? locality : (loc.address?.streetAddress || '')) || '').slice(0, 40),
        price: offer?.price != null ? (Number(offer.price) === 0 ? 'free' : `from €${offer.price}`) : '',
        category: rel.split('/')[4] || '',
        link: evUrl && !/iamsterdam\.com/i.test(evUrl) ? evUrl : BASE + rel,
      }
    } catch { return null }
  })
  const seen = new Set<string>()
  return { page, items: items.filter((x): x is VerbItem => !!x && !!x.text && !seen.has(x.id) && !!seen.add(x.id)) }
}

// ─── run ────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  const wk = upcomingWeekend()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [l, ia] = await Promise.all([lbb(), iamsterdam()])
  const payload = {
    generatedAt: new Date().toISOString(),
    weekend: { sat: iso(wk.sat), sun: iso(wk.sun) },
    note: "The source's own words, unedited, for board review only. The legal model (signal + link, never republish) still applies to anything that ships — rewrite before promoting.",
    lbb: l,
    iamsterdam: ia,
  }
  await Bun.write(OUT, JSON.stringify(payload, null, 2) + '\n')
  console.log(`verbatim: LBB "${l.article?.title ?? '—'}" → ${l.items.length} items · I amsterdam (${ia.page}) → ${ia.items.length} items → ${OUT}`)
  if (!l.items.length && !ia.items.length) { console.error('both sources came back empty — not publishing a useful file'); process.exit(1) }
}
