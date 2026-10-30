/**
 * THE BRIEF'S SHARED HALF — what every email template reads: the deck's order, which cards are this
 * weekend's, the slot labels down a day, the forecast in words, the mode washes, the image cuts, and
 * the <tr> legality check. `brief.ts` (template D, the hybrid) and `brief-picks.ts` (template E, the
 * picks) both import from here so the two never drift on what "this weekend" or "afternoon" means.
 */
import { realVenue, MODE_TINT, type Wx, type WxDay } from '../poster'
import { originalOf } from '../../src/lib/image'
import { whenMinutes, latestDateOf, upcomingWeekendEnd, whenWeekendDays } from '../../src/lib/when'
import { endCleanly } from '../../src/lib/blurb'
import type { Pick, Mode } from '../../src/types'

export const APP = 'https://app.wkndr.xyz/?utm_source=brief'
export const FONT = `'Helvetica Neue',Helvetica,Arial,sans-serif`
/** Monospace is for receipts and source traces only (CLAUDE.md design tokens) — never a headline. */
export const MONO = `'SF Mono',Menlo,Consolas,'Liberation Mono',monospace`

export const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export const deg = (n: number) => `${Math.round(n)}&deg;`

/** A wsrv cut of the ORIGINAL at the email's size, on the focal point when known (never a crop of the
 *  card's portrait crop). `w×h` is the retina size; the <img> is shown at half. */
export function cut(p: Pick, w: number, h: number): string {
  const src = originalOf(p.image!)
  const crop = p.imageFocal ? `a=focal&fpx=${p.imageFocal[0].toFixed(3)}&fpy=${p.imageFocal[1].toFixed(3)}` : 'a=attention'
  return `https://images.weserv.nl/?url=${encodeURIComponent(src)}&w=${w}&h=${h}&fit=cover&${crop}&output=jpg&default=${encodeURIComponent(src)}`
}
/** The cover photograph at D's crop (600 wide, 7:12 → 1200×700). */
export const coverImage = (p: Pick) => cut(p, 1200, 700)

/** The deck's own order: the hand pile first, then the stamped serve order — the brief never
 *  advertises a different front than the app deals. */
export function deckOrder(picks: Pick[]): Pick[] {
  return [...picks].sort((a, b) => {
    const ap = a.pilePos ?? Infinity, bp = b.pilePos ?? Infinity
    if (ap !== bp) return ap - bp
    return (a.servePos ?? Infinity) - (b.servePos ?? Infinity)
  })
}

/** The served weekend's two days, from `now`. */
export function weekendDays(now: Date): { satD: Date; sunD: Date } {
  const end = upcomingWeekendEnd(now)
  const sunD = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const satD = new Date(sunD.getFullYear(), sunD.getMonth(), sunD.getDate() - 1)
  return { satD, sunD }
}

/** Dated to this weekend (or running through it) — the brief is about the two days, not the canon. */
export function thisWeekend(p: Pick, now: Date): boolean {
  const { satD, sunD } = weekendDays(now)
  const d = whenWeekendDays(p.when, satD, sunD, now)
  return (d.sat || d.sun) && p.freshness !== 'always'
}

/** The slot label down a column: the hour if the card has one, else what its dates say. */
export function slot(p: Pick, now: Date): { text: string; accent: boolean } {
  const end = upcomingWeekendEnd(now)
  const latest = latestDateOf(p.when, now)
  const endsSun = !!latest && latest.toDateString() === end.toDateString() && /until|t\/m|through|–|-/i.test(p.when)
  const m = whenMinutes(p.when)
  if (m >= 0 && Number.isFinite(m) && m < 24 * 60 && /\d{1,2}[:.]\d{2}/.test(p.when)) {
    const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0')
    const when = m < 12 * 60 ? 'Morning' : m < 17 * 60 ? 'Afternoon' : m < 20 * 60 ? 'Early evening' : 'After dark'
    return { text: `${when} &nbsp;·&nbsp; ${h}:${mm}`, accent: false }
  }
  if (endsSun) return { text: 'Last day', accent: true }
  if (/^until|^t\/m|^through/i.test(p.when)) return { text: 'Running', accent: false }
  return { text: 'All day', accent: false }
}
/** Chronological inside a column: timed cards by the clock, then the all-day ones. */
export const clock = (p: Pick) => { const m = whenMinutes(p.when); return /\d{1,2}[:.]\d{2}/.test(p.when) && Number.isFinite(m) ? m : 24 * 60 }

/** One line under a title: the card's own blurb, cut cleanly, or its why. */
export const line = (p: Pick, max = 120) => esc(endCleanly(p.blurb || p.why || '', max, (p.blurb || '').length > max))

/** The day's band: how the forecast reads in a short sentence, in the app's own vocabulary. */
export function dayWords(d: WxDay): string {
  const pop = d.pop ?? 0, sun = d.sun
  if (pop >= 70) return 'Rain most of the day. Indoors wins.'
  if (pop >= 40) return 'Showers around; keep a dry plan in reserve.'
  if (sun != null && sun >= 0.6) return 'Bright. Go out early and stay out.'
  if (sun != null && sun >= 0.3) return 'Sun and cloud, dry.'
  return 'Cloudy but dry.'
}
/** The claim between the cover and the split — why the weekend has this shape. A draft line. */
export function claim(wx: Wx | null): { strong: string; soft: string } {
  if (!wx || wx.days.length < 2) return { strong: 'The weekend, by day.', soft: 'Here is the rest of it, in the order the sky wants.' }
  const [a, b] = wx.days
  const same = a.mode === b.mode && Math.abs(a.hi - b.hi) < 4
  if (same) {
    const wet = (a.pop ?? 0) >= 60 && (b.pop ?? 0) >= 60
    const strong = wet ? `Two wet days at ${Math.round(Math.max(a.hi, b.hi))}° — this is an indoors weekend.`
      : (a.pop ?? 0) < 30 && (b.pop ?? 0) < 30 ? `Two dry days at ${Math.round(Math.max(a.hi, b.hi))}° — the difference is the hour, not the day.`
      : `Two of the same at ${Math.round(Math.max(a.hi, b.hi))}° — pick by the hour.`
    return { strong: esc(strong), soft: 'Here is the rest of it, in the order the sky wants.' }
  }
  const nicer = (a.pop ?? 0) <= (b.pop ?? 0) ? a : b
  return { strong: esc(`${nicer.label === 'Sat' ? 'Saturday' : 'Sunday'} is the day to be out; the other is for the museums.`), soft: `Sat ${Math.round(a.hi)}°, Sun ${Math.round(b.hi)}°. The rest, by day.` }
}
/** The band colours per mode: a soft wash of the app's weather tint, and the tint itself for type. */
export function band(mode: Mode): { bg: string; ink: string } {
  const tint = MODE_TINT[mode]
  const wash: Record<Mode, string> = { HOT: '#fdebe3', WARM: '#fdf0e2', COOL: '#e8f0ee', COLD_WET: '#e7ecf3', VOLATILE: '#efe8f0' }
  return { bg: wash[mode], ink: tint }
}

/** The publication(s) a card is credited to, as the trace line reads them: "via LBB · I amsterdam". */
export function trace(p: Pick): string {
  const src = (p.source || '').replace(/Your Little Black Book/g, 'LBB').trim()
  return src ? `via ${src}` : ''
}

/** Every <tr> must be a direct child of a <table> — a <tr> inside a <td> is silently discarded
 *  by HTML parsers (it cost comp A two blocks). Checked on every write. */
export function trsAreLegal(html: string): boolean {
  const stack: string[] = []
  const re = /<\/?(table|tr|td|th|tbody|thead)\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const close = m[0][1] === '/', tag = m[1].toLowerCase()
    if (close) { while (stack.length && stack.pop() !== tag) { /* unwind */ } ; continue }
    if (tag === 'tr' && !['table', 'tbody', 'thead'].includes(stack[stack.length - 1] ?? '')) return false
    stack.push(tag)
  }
  return true
}

export { realVenue, MODE_TINT, type Wx, type WxDay }
