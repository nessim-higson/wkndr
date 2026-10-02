// EYE FILMMUSEUM — the exhibitions, from the museum's own page (2026-10-02).
//
// Ness: "what about the Eye and its exhibits? would be nice to add that — nice photography."
// Until now Eye reached the deck two ways: a canon card for the building, and whatever an LLM
// source happened to mention — the Ulrich Seidl show arrived that way with a mangled date string
// ("Sat 19 Sep 2026 (opening) — 31 Jan 2027") and a borrowed photo of the building. Eye's own
// exhibitions page is clean, server-rendered, and carries the museum's campaign photography at
// full size, so this adapter reads it directly: keyless, deterministic, no LLM.
//
// What it emits: every exhibition the page presents with a programme link (the temporary shows,
// dated from the page's own "On show from … through …" sentence, in the house `when` format),
// plus the permanent exhibition as an evergreen. Blocks that are not something to visit (the
// Eye Art & Film Prize) are skipped. id prefix `web-eye-*` (live; images are the organiser's own).
//
// AND THE FEATURED PROGRAMMES (same day): the what's-on page opens with a carousel of what Eye itself
// is featuring — the exhibition again, the running film season ("The Films of Jacques Demy", with its
// dates and campaign still), the ongoing series, the permanent exhibition. An LLM source used to read
// that very carousel and returned the season with a guessed link (the index) and no photograph, so the
// one Eye card with a closing date shipped blank. The carousel is server-rendered: read it here, and
// refresh skips the LLM read of the same page whenever this adapter delivers. DATED programmes only —
// an "Ongoing" series (Eye Classics) is what the canon's repertory card already says.
//
// Honest by construction: the title, dates, link and image are Eye's; the blurb is Eye's own
// sentence, trimmed. The image caption/credit is carried in `imageCredit` for the day the card shows one.
import type { Pick } from '../../src/types'
import { deriveWeatherFit } from '../lib/pipeline'
import { fixWhen } from '../../src/lib/when'
import { tidyBlurb } from '../../src/lib/blurb'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
export const EYE_EXHIBITIONS_URL = 'https://www.eyefilm.nl/en/exhibitions'

const ENT: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', eacute: 'é', uuml: 'ü', ouml: 'ö', auml: 'ä' }
const decode = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
const text = (h: string) => decode(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

export const EYE_WHATSON_URL = 'https://www.eyefilm.nl/en/whats-on'

export interface EyeBlock { title: string; body: string; link: string; image?: string; credit?: string; label?: string; dates?: string; featured?: boolean }

// the widest rendition a block offers (Craft transform folders are named _WIDTHxHEIGHT_…)
const widest = (html: string) => {
  const imgs = [...new Set(html.match(/https:\/\/assets\.eyefilm\.nl\/images\/[^"'\s,]+\.(?:jpe?g|png|webp)/gi) ?? [])]
  const width = (u: string) => Number(u.match(/\/_(\d+)x\d+_/)?.[1] ?? 0)
  return imgs.sort((a, b) => width(b) - width(a))[0]
}

/** The page's presentation blocks: one per exhibition (and a few that are not exhibitions). Pure. */
export function parseEyeExhibitions(html: string): EyeBlock[] {
  const out: EyeBlock[] = []
  for (const m of html.matchAll(/<section class="text-image-cta">([\s\S]*?)<\/section>/g)) {
    const s = m[1]
    const title = text(s.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '')
    const link = decode(s.match(/<a class="link" href="([^"]+)"/)?.[1] ?? '')
    if (!title || !link) continue
    const body = text(s.match(/text-image-cta__content">([\s\S]*?)<\/div>/)?.[1] ?? '')
    const image = widest(s)
    const credit = text(s.match(/image__caption">([\s\S]*?)<\/div>/)?.[1] ?? '') || undefined
    out.push({ title, body, link, image, credit })
  }
  return out
}

// "27 augustus — 14 oktober 2026" (the carousel's date line: Dutch months on the English page, the first
// year left off) · "On show from 19 September 2026 through 31 January 2027" (the exhibitions page)
const DATE_LINE = /(\d{1,2})\s+([A-Za-zé]{3,9})(?:\s+(\d{4}))?\s*(?:through|until|till|to|t\/m|–|—|-)\s*(\d{1,2})\s+([A-Za-zé]{3,9})\s+(\d{4})/
const MONTH: Record<string, number> = {
  januari: 0, january: 0, februari: 1, february: 1, maart: 2, march: 2, april: 3, mei: 4, may: 4, juni: 5, june: 5,
  juli: 6, july: 6, augustus: 7, august: 7, september: 8, oktober: 9, october: 9, november: 10, december: 11,
}
const EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** A run read off a line of Eye's copy, as dates and as the English range fixWhen takes. Pure. */
export function eyeRun(line: string): { start: Date; end: Date; range: string } | null {
  const m = line.match(DATE_LINE)
  if (!m) return null
  const m1 = MONTH[m[2].toLowerCase()], m2 = MONTH[m[5].toLowerCase()]
  if (m1 == null || m2 == null) return null
  const y2 = Number(m[6]), y1 = m[3] ? Number(m[3]) : (m1 <= m2 ? y2 : y2 - 1)
  const start = new Date(y1, m1, Number(m[1]), 12), end = new Date(y2, m2, Number(m[4]), 12)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  return { start, end, range: `${Number(m[1])} ${EN[m1]} ${y1} – ${Number(m[4])} ${EN[m2]} ${y2}` }
}

/** The what's-on page's featured programmes — its opening carousel, one <article> each: an <h2> (with an
 *  optional <span> label inside it), an optional <h3>, a date line, a sentence, a "Learn more" link and the
 *  campaign image. Read by STRUCTURE; the class names are build hashes. Pure. */
export function parseEyeFeatured(html: string): EyeBlock[] {
  const out: EyeBlock[] = []
  for (const m of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)) {
    const s = m[1]
    const h2 = s.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1]
    const link = decode(s.match(/href="(https:\/\/www\.eyefilm\.nl\/en\/(?:programme\/[^"]+|permanent-exhibition[^"]*))"/)?.[1] ?? '')
    if (!h2 || !link) continue
    const label = text(h2.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '') || undefined
    const head = text(h2.replace(/<span[^>]*>[\s\S]*?<\/span>/, ''))
    const sub = text(s.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '')
    // the copy under the headings: text-only <div>s — the date line when there is one, then the sentence
    const leaves = [...s.slice(s.indexOf('</h2>')).matchAll(/<div[^>]*>([^<]{12,})<\/div>/g)].map((x) => decode(x[1]).replace(/\s+/g, ' ').trim())
    const dates = leaves.find((t) => DATE_LINE.test(t) && t.length < 60)
    const body = leaves.filter((t) => t !== dates).sort((a, b) => b.length - a.length)[0] ?? ''
    if (!head) continue
    out.push({ title: sub && dates ? `${head} – ${sub}` : head, body, link, image: widest(s), label, dates, featured: true })
  }
  return out
}

const slugOf = (link: string) => link.replace(/[?#].*$/, '').split('/').filter(Boolean).filter((x) => !/^\d+$/.test(x)).pop() ?? 'exhibition'

/** Blocks → picks, one per programme (the exhibitions page first: its block carries the fuller copy and
 *  the photo credit). Shows that have ended, or that open more than three weeks out, are left off (the page
 *  lists what is coming long before it is a weekend's plan); a featured programme with no dates is an
 *  ongoing series and is left to the canon's repertory card. Pure, given `now`. */
export function eyePicks(blocks: EyeBlock[], now: Date = new Date()): Pick[] {
  const out: Pick[] = []
  for (const b of blocks) {
    const base = {
      venue: 'Eye Filmmuseum', area: 'Noord', outdoor: false, kid: false,
      price: 'ticketed', source: 'Eye Filmmuseum', link: b.link, image: b.image,
      weatherFit: deriveWeatherFit(false), verify: false,
    }
    let pick: Pick | null = null
    if (/\/programme\//.test(b.link)) {
      const run = eyeRun(b.dates ?? b.body)
      if (b.featured && !run) continue
      if (run && run.end.getTime() < now.getTime() - 864e5) continue
      if (run && run.start.getTime() > now.getTime() + 21 * 864e5) continue
      const when = run ? fixWhen(run.range, now) : 'Now on'
      const blurb = tidyBlurb(b.body.replace(/\s*On (?:show|view) from [^.]*\./i, '').trim(), 200)
      // an exhibition is `art`; a film season is `stage` (Stage & screen)
      const show = !b.featured || /exhibition/i.test(b.label ?? '')
      // 'ending' is only honest inside the last fortnight (refresh re-labels a long run 'always' on its own)
      const closing = !!run && run.start.getTime() <= now.getTime() && run.end.getTime() - now.getTime() <= 14 * 864e5
      pick = { ...base, category: show ? 'art' : 'stage', id: `web-eye-${slugOf(b.link)}`, title: b.title.slice(0, 90), when, freshness: closing ? 'ending' : 'weekend', blurb: blurb || b.title, why: show ? 'Exhibition at Eye' : 'A film season at Eye', ...(b.credit ? { imageCredit: b.credit } : {}) } as Pick
    } else if (/permanent-exhibition/.test(b.link)) {
      const title = b.title.replace(/^Permanent exhibition\s*/i, '').trim() || 'The permanent exhibition'
      pick = { ...base, category: 'art', id: 'web-eye-permanent-exhibition', title, when: 'Daily', freshness: 'always', blurb: tidyBlurb(b.body, 200) || title, why: 'The permanent exhibition at Eye', ...(b.credit ? { imageCredit: b.credit } : {}) } as Pick
    }
    if (pick && !out.some((p) => p.id === pick!.id)) out.push(pick)
  }
  return out
}

/** Eye's exhibitions and featured programmes as Pick[] (raw images; the caller portrait-wraps). Never throws. */
export async function eyeExtract(cityKey: string, now: Date = new Date()): Promise<Pick[]> {
  if (cityKey !== 'amsterdam') return []
  const get = (url: string) => fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(15000), redirect: 'follow' })
    .then((r) => (r.ok ? r.text() : '')).catch(() => '')
  try {
    const [exhibitions, whatsOn] = await Promise.all([get(EYE_EXHIBITIONS_URL), get(EYE_WHATSON_URL)])
    return eyePicks([...parseEyeExhibitions(exhibitions), ...parseEyeFeatured(whatsOn)], now)
  } catch {
    return []
  }
}
