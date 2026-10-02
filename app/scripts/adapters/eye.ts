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

export interface EyeBlock { title: string; body: string; link: string; image?: string; credit?: string }

/** The page's presentation blocks: one per exhibition (and a few that are not exhibitions). Pure. */
export function parseEyeExhibitions(html: string): EyeBlock[] {
  const out: EyeBlock[] = []
  for (const m of html.matchAll(/<section class="text-image-cta">([\s\S]*?)<\/section>/g)) {
    const s = m[1]
    const title = text(s.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '')
    const link = decode(s.match(/<a class="link" href="([^"]+)"/)?.[1] ?? '')
    if (!title || !link) continue
    const body = text(s.match(/text-image-cta__content">([\s\S]*?)<\/div>/)?.[1] ?? '')
    // the widest rendition the block offers (Craft transform folders are named _WIDTHxHEIGHT_…)
    const imgs = [...new Set(s.match(/https:\/\/assets\.eyefilm\.nl\/images\/[^"'\s,]+\.(?:jpe?g|png|webp)/gi) ?? [])]
    const width = (u: string) => Number(u.match(/\/_(\d+)x\d+_/)?.[1] ?? 0)
    const image = imgs.sort((a, b) => width(b) - width(a))[0]
    const credit = text(s.match(/image__caption">([\s\S]*?)<\/div>/)?.[1] ?? '') || undefined
    out.push({ title, body, link, image, credit })
  }
  return out
}

const RUN = /(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})\s+(?:through|until|till|to|–|—|-)\s+(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/
const day = (s: string) => { const d = new Date(`${s} 12:00`); return Number.isNaN(d.getTime()) ? null : d }
const slugOf = (link: string) => link.replace(/[?#].*$/, '').split('/').filter(Boolean).filter((x) => !/^\d+$/.test(x)).pop() ?? 'exhibition'

/** Blocks → picks. Temporary shows that have ended, or that open more than three weeks out, are left
 *  off (the page lists what is coming long before it is a weekend's plan). Pure, given `now`. */
export function eyePicks(blocks: EyeBlock[], now: Date = new Date()): Pick[] {
  const out: Pick[] = []
  for (const b of blocks) {
    const base = {
      venue: 'Eye Filmmuseum', area: 'Noord', category: 'art' as const, outdoor: false, kid: false,
      price: 'ticketed', source: 'Eye Filmmuseum', link: b.link, image: b.image,
      weatherFit: deriveWeatherFit(false), verify: false,
    }
    if (/\/programme\//.test(b.link)) {
      const run = b.body.match(RUN)
      const start = run ? day(run[1]) : null, end = run ? day(run[2]) : null
      if (end && end.getTime() < now.getTime() - 864e5) continue
      if (start && start.getTime() > now.getTime() + 21 * 864e5) continue
      const when = run ? fixWhen(`${run[1]} – ${run[2]}`, now) : 'Now on'
      const blurb = tidyBlurb(b.body.replace(/\s*On (?:show|view) from [^.]*\./i, '').trim(), 200)
      out.push({ ...base, id: `web-eye-${slugOf(b.link)}`, title: b.title.slice(0, 90), when, freshness: 'weekend', blurb: blurb || b.title, why: 'Exhibition at Eye', ...(b.credit ? { imageCredit: b.credit } : {}) } as Pick)
    } else if (/permanent-exhibition/.test(b.link)) {
      const title = b.title.replace(/^Permanent exhibition\s+/i, '').trim() || b.title
      out.push({ ...base, id: 'web-eye-permanent-exhibition', title, when: 'Daily', freshness: 'always', blurb: tidyBlurb(b.body, 200) || title, why: 'The permanent exhibition at Eye', ...(b.credit ? { imageCredit: b.credit } : {}) } as Pick)
    }
  }
  return out
}

/** Eye's exhibitions as Pick[] (raw images; the caller portrait-wraps). Never throws. */
export async function eyeExtract(cityKey: string, now: Date = new Date()): Promise<Pick[]> {
  if (cityKey !== 'amsterdam') return []
  try {
    const res = await fetch(EYE_EXHIBITIONS_URL, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(15000), redirect: 'follow' })
    if (!res.ok) return []
    return eyePicks(parseEyeExhibitions(await res.text()), now)
  } catch {
    return []
  }
}
