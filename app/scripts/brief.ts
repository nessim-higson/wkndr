/**
 * THE FRIDAY BRIEF — a draft of the email, written from the live deck and the forecast.
 *
 * Ness, 2026-10-26: "I want to kick start the email feature." The list worker, the send script and
 * the four template comps had been built since July (list/README.md); what was missing was the step
 * between Thursday's crawl and Friday's send — the file. This writes it: template D (the hybrid, the
 * comp Ness's July notes settled on) filled from `public/data/picks.<city>.json` in the deck's own
 * order and the weekend's per-day forecast, so Friday morning starts from a draft, not a blank page.
 *
 * A DRAFT, on purpose. The send script's premise (list/scripts/send.ts) is that the brief is written
 * by a person after seeing what the pipeline produced. This fills the structure — the one pick on the
 * cover, the forecast line, the two days chronologically — with the cards' own copy; the hero sentence
 * and the forecast line are the two places to put a human voice before sending.
 *
 *   bun run brief                          → list/out/brief-<saturday>.html + list/out/brief.html
 *   bun run brief --hero="copenhagen"      → pin the cover to a pick by title (loose match)
 *   bun run brief --per=3                  → picks per day column (default 3)
 *
 * Then: cd list && bun run scripts/send.ts out/brief.html --subject "…"   (dry run; --send to blast)
 *
 * Email-HTML rules kept from the comps: every <tr> a direct child of a <table>; everything
 * load-bearing inline; no flex/grid/variables; two dark paths; under 102 KB; `{{unsub}}` in the footer.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { forecast, realVenue, assignDays, MODE_TINT, type Wx, type WxDay } from './poster'
import { originalOf } from '../src/lib/image'
import { fixWhen, whenMinutes, latestDateOf, upcomingWeekendEnd, whenWeekendDays } from '../src/lib/when'
import { endCleanly } from '../src/lib/blurb'
import type { Pick, Mode } from '../src/types'

const CITY = process.argv.find((a) => a.startsWith('--city='))?.split('=')[1] ?? 'amsterdam'
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
const PER = Number(arg('per') ?? 3)
const APP = 'https://app.wkndr.xyz/?utm_source=brief'
const OUT_DIR = join(import.meta.dir, '..', '..', 'list', 'out')
const FONT = `'Helvetica Neue',Helvetica,Arial,sans-serif`

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const deg = (n: number) => `${Math.round(n)}&deg;`

/** The cover photograph at the email's crop (600 wide, 7:12 → 1200×700), re-cut from the ORIGINAL
 *  so the card's portrait crop is not cropped a second time. The focal point rides along when known. */
function coverImage(p: Pick): string {
  const src = originalOf(p.image!)
  const crop = p.imageFocal ? `a=focal&fpx=${p.imageFocal[0].toFixed(3)}&fpy=${p.imageFocal[1].toFixed(3)}` : 'a=attention'
  return `https://images.weserv.nl/?url=${encodeURIComponent(src)}&w=1200&h=700&fit=cover&${crop}&output=jpg&default=${encodeURIComponent(src)}`
}

/** The deck's own order: the hand pile first, then the stamped serve order — the brief never
 *  advertises a different front than the app deals. */
function deckOrder(picks: Pick[]): Pick[] {
  return [...picks].sort((a, b) => {
    const ap = a.pilePos ?? Infinity, bp = b.pilePos ?? Infinity
    if (ap !== bp) return ap - bp
    return (a.servePos ?? Infinity) - (b.servePos ?? Infinity)
  })
}

/** Dated to this weekend (or running through it) — the brief is about the two days, not the canon. */
function thisWeekend(p: Pick, now: Date): boolean {
  const end = upcomingWeekendEnd(now)
  const sunD = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const satD = new Date(sunD.getFullYear(), sunD.getMonth(), sunD.getDate() - 1)
  const d = whenWeekendDays(p.when, satD, sunD, now)
  return (d.sat || d.sun) && p.freshness !== 'always'
}

/** The slot label down a column: the hour if the card has one, else what its dates say. */
function slot(p: Pick, now: Date): { text: string; accent: boolean } {
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
const clock = (p: Pick) => { const m = whenMinutes(p.when); return /\d{1,2}[:.]\d{2}/.test(p.when) && Number.isFinite(m) ? m : 24 * 60 }

/** One line under a title: the card's own blurb, cut cleanly, or its why. */
const line = (p: Pick, max = 120) => esc(endCleanly(p.blurb || p.why || '', max, (p.blurb || '').length > max))

/** The day's band: how the forecast reads in a short sentence, in the app's own vocabulary. */
function dayWords(d: WxDay): string {
  const pop = d.pop ?? 0, sun = d.sun
  if (pop >= 70) return 'Rain most of the day. Indoors wins.'
  if (pop >= 40) return 'Showers around; keep a dry plan in reserve.'
  if (sun != null && sun >= 0.6) return 'Bright. Go out early and stay out.'
  if (sun != null && sun >= 0.3) return 'Sun and cloud, dry.'
  return 'Cloudy but dry.'
}
/** The claim between the cover and the split — why the weekend has this shape. A draft line. */
function claim(wx: Wx | null): { strong: string; soft: string } {
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
function band(mode: Mode): { bg: string; ink: string } {
  const tint = MODE_TINT[mode]
  const wash: Record<Mode, string> = { HOT: '#fdebe3', WARM: '#fdf0e2', COOL: '#e8f0ee', COLD_WET: '#e7ecf3', VOLATILE: '#efe8f0' }
  return { bg: wash[mode], ink: tint }
}

function item(p: Pick, now: Date, first: boolean, last: boolean): string {
  const s = slot(p, now)
  const meta = [realVenue(p), fixWhen(p.when || '')].filter(Boolean).join(' · ')
  return `
              <tr><td style="padding:${first ? '15px' : '14px'} 17px ${last ? '20px' : '0'};">
                ${first ? '' : `<div class="hair" style="height:1px;background:#eee9dd;line-height:1px;font-size:0;margin-bottom:14px;">&nbsp;</div>`}
                <div class="${s.accent ? '' : 'ink3'}" style="font:400 9px/1 ${FONT};letter-spacing:.13em;text-transform:uppercase;color:${s.accent ? '#ff4d1f' : '#8b8a82'};">${s.text}</div>
                <div class="ink" style="margin-top:7px;font:400 17px/1.2 ${FONT};letter-spacing:-.018em;color:#1a1a1a;">
                  <a href="${esc(p.link)}" class="ink lnk" style="color:#1a1a1a;">${esc(p.title)}</a>
                </div>
                <div class="ink3" style="margin-top:5px;font:400 11px/1.4 ${FONT};color:#8b8a82;">${esc(meta)}</div>
                <div class="ink" style="margin-top:7px;font:400 13px/1.5 ${FONT};color:#1a1a1a;">${line(p)}</div>
              </td></tr>`
}

function column(dayName: string, d: WxDay | undefined, picks: Pick[], now: Date): string {
  const b = band(d?.mode ?? 'WARM')
  const sorted = [...picks].sort((x, y) => clock(x) - clock(y))
  return `
            <td class="stack col" width="48%" valign="top" style="width:48%;background:#fdfcf9;border-radius:10px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:15px 17px 13px;background:${b.bg};border-radius:10px 10px 0 0;">
                <div style="font:400 9px/1 ${FONT};letter-spacing:.18em;text-transform:uppercase;color:${b.ink};">${dayName}</div>
                <div class="day-t" style="margin-top:8px;font:400 34px/1 ${FONT};letter-spacing:-.035em;color:${b.ink};">${d ? deg(d.hi) : '&nbsp;'}</div>
                <div style="margin-top:6px;font:400 12px/1.4 ${FONT};color:${b.ink};">${d ? esc(dayWords(d)) : 'No forecast yet.'}</div>
              </td></tr>${sorted.map((p, i) => item(p, now, i === 0, i === sorted.length - 1)).join('')}
              </table>
            </td>`
}

export function briefHtml(picks: Pick[], wx: Wx | null, opts: { hero?: string; per?: number; now?: Date; weekendLabel?: string } = {}): { html: string; hero: Pick; sat: Pick[]; sun: Pick[]; subject: string } {
  const now = opts.now ?? new Date()
  const per = opts.per ?? PER
  const ordered = deckOrder(picks).filter((p) => thisWeekend(p, now))
  const pinned = opts.hero ? ordered.find((p) => p.title.toLowerCase().includes(opts.hero!.toLowerCase())) : undefined
  const hero = pinned ?? ordered.find((p) => p.image) ?? ordered[0]
  if (!hero) throw new Error('no weekend picks to write a brief from')
  const rest = ordered.filter((p) => p.id !== hero.id)
  const { sat, sun } = assignDays(rest, wx?.days, per, now)
  const c = claim(wx)
  const heroDay = wx?.days.find((d) => { const e = upcomingWeekendEnd(now); const sunD = new Date(e.getFullYear(), e.getMonth(), e.getDate()); const satD = new Date(sunD.getFullYear(), sunD.getMonth(), sunD.getDate() - 1); const w = whenWeekendDays(hero.when, satD, sunD, now); return d.label === (w.sat ? 'Sat' : 'Sun') })
  const kicker = ['The one to book', fixWhen(hero.when || '').split(' · ')[0], heroDay ? `${deg(heroDay.hi)} ${esc(dayWords(heroDay).split('.')[0].toLowerCase())}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')
  const heroMeta = [realVenue(hero), hero.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
  const subject = wx ? `${c.strong.replace(/&deg;|°/g, '°').replace(/&[a-z]+;/g, '')}` : 'Your weekend, one swipe away.'
  const preheader = `${hero.title} — ${c.strong.replace(/&[a-z]+;/g, '')}`
  const cover = hero.image ? `
        <tr><td bgcolor="#f2ede3" style="padding:0;font-size:0;line-height:0;background:#f2ede3;border-radius:14px 14px 0 0;">
          <a href="${esc(hero.link)}" class="lnk" style="display:block;">
            <img src="${esc(coverImage(hero))}" width="600" alt="${esc(hero.title)}${hero.venue ? ' — ' + esc(realVenue(hero)) : ''}"
                 style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:14px 14px 0 0;padding:18px 0;font:400 15px/1.5 ${FONT};color:#8a6a3a;text-align:center;">
          </a>
        </td></tr>` : ''
  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>WKNDR — the Friday brief</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  /* Written by app/scripts/brief.ts from template D (list/templates/d-hybrid.html) — the hybrid:
     the cover is a PICK, then the forecast line, then the two days chronologically, then the deck. */
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;outline:0;line-height:100%;text-decoration:none}
  a{text-decoration:none}
  .lnk:hover{opacity:.75!important}
  @media (max-width:480px){
    .shell{width:100%!important}
    .pad{padding-left:22px!important;padding-right:22px!important}
    .hero-h{font-size:32px!important;line-height:1.06!important}
    .stack{display:block!important;width:100%!important;max-width:100%!important}
    .stack-gap{height:16px!important;line-height:16px!important;font-size:0!important;display:block!important;width:100%!important}
    .day-t{font-size:38px!important}
    .line{font-size:16px!important}
  }
  @media (prefers-color-scheme:dark){
    .bg{background:#141312!important}
    .card{background:#1c1a18!important}
    .col{background:#211f1c!important}
    .ink{color:#f4f1ea!important}
    .ink3{color:#9a978d!important}
    .hair{background:#2e2b27!important}
  }
  [data-ogsc] .bg{background:#141312!important}
  [data-ogsc] .card{background:#1c1a18!important}
  [data-ogsc] .col{background:#211f1c!important}
  [data-ogsc] .ink{color:#f4f1ea!important}
  [data-ogsc] .ink3{color:#9a978d!important}
  [data-ogsc] .hair{background:#2e2b27!important}
</style>
</head>
<body class="bg" style="margin:0;padding:0;width:100%;background:#eceae3;">

<div style="display:none;font-size:1px;color:#eceae3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${esc(preheader)}
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eceae3;" class="bg">
<tr><td align="center" style="padding:26px 12px 40px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="shell" style="width:100%;max-width:600px;">

    <tr><td class="pad" style="padding:0 30px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="left" style="font:700 15px/1 ${FONT};letter-spacing:-.02em;color:#1a1a1a;" class="ink">
          WKNDR<span style="color:#ff4d1f;">&nbsp;&bull;</span>
        </td>
        <td align="right" style="font:400 10px/1 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:#8b8a82;" class="ink3">
          ${esc(wx?.label ?? opts.weekendLabel ?? '')} &nbsp;·&nbsp; Amsterdam
        </td>
      </tr>
      </table>
    </td></tr>

    <tr><td class="card" style="background:#faf8f3;border-radius:14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:14px;overflow:hidden;">
${cover}
        <tr><td class="pad" style="padding:26px 34px 0;">
          <div style="font:400 10px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:#ff4d1f;">${kicker}</div>
          <h1 class="ink hero-h" style="margin:11px 0 0;font:400 38px/1.04 ${FONT};letter-spacing:-.028em;color:#1a1a1a;">
            <a href="${esc(hero.link)}" class="ink lnk" style="color:#1a1a1a;">${esc(hero.title)}</a>
          </h1>
          <div class="ink3" style="margin-top:12px;font:400 13px/1.5 ${FONT};color:#8b8a82;">${esc(heroMeta).replace(/&amp;nbsp;/g, '&nbsp;')}</div>
          <p class="ink" style="margin:14px 0 0;font:400 16px/1.6 ${FONT};color:#1a1a1a;">${line(hero, 240)}</p>
        </td></tr>

        <tr><td class="pad" style="padding:26px 34px 0;">
          <div class="hair" style="height:1px;background:#e7e3d8;line-height:1px;font-size:0;">&nbsp;</div>
        </td></tr>
        <tr><td class="pad" style="padding:22px 34px 0;">
          <div class="ink line" style="font:400 17px/1.45 ${FONT};letter-spacing:-.012em;color:#1a1a1a;">
            <strong style="font-weight:700;">${c.strong}</strong>
            <span class="ink3" style="color:#8b8a82;">${c.soft}</span>
          </div>
        </td></tr>

        <tr><td class="pad" style="padding:20px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>${column('Saturday', wx?.days[0], sat, now)}
            <td class="stack-gap" width="4%" style="width:4%;font-size:0;line-height:0;">&nbsp;</td>${column('Sunday', wx?.days[1] ?? wx?.days[0], sun, now)}
          </tr>
          </table>
        </td></tr>

        <tr><td class="pad" style="padding:28px 34px 34px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" bgcolor="#ff4d1f" style="border-radius:100px;">
            <a href="${APP}" style="display:inline-block;padding:14px 30px;font:400 15px/1 ${FONT};color:#ffffff;letter-spacing:-.01em;">
              ${(() => { const n = ordered.length - 1 - sat.length - sun.length; return n > 0 ? `${n} more, sorted the same way` : 'Open the deck' })()} &nbsp;&rarr;
            </a>
          </td></tr>
          </table>
          <div class="ink3" style="margin-top:14px;font:400 13px/1.5 ${FONT};color:#8b8a82;">
            Send your saves to whoever you'd actually go with. The overlap is the plan.
          </div>
        </td></tr>

      </table>
    </td></tr>

    <tr><td class="pad" style="padding:22px 30px 0;">
      <div class="ink3" style="font:400 12px/1.65 ${FONT};color:#8b8a82;">
        You asked for the WKNDR Friday brief. One email a week, Amsterdam only.<br>
        <a href="{{unsub}}" style="color:#8b8a82;border-bottom:1px solid #cfcbc0;">Unsubscribe</a>
        &nbsp;&mdash;&nbsp; one click, no questions.
      </div>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>
`
  return { html, hero, sat, sun, subject }
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

if (import.meta.main) {
  const dataDir = join(import.meta.dir, '..', 'public', 'data')
  const feed = JSON.parse(await Bun.file(join(dataDir, `picks.${CITY}.json`)).text()) as { picks: Pick[] }
  // THE FEED'S WEEKEND, not the calendar's. The brief is written from a deck the pipeline built FOR a
  // weekend (the Letter names it); on a Monday before the rebuild the deck is still last weekend's, and
  // judging its dates against the coming Saturday would call every card "both days" (a dated card
  // outside the window reads as flexible). `now` is that weekend's Friday; a Friday run is today.
  let satIso: string | null = null, weekendLabel: string | undefined
  try {
    const letter = JSON.parse(await Bun.file(join(dataDir, `letter.${CITY}.json`)).text()) as { weekend?: { sat?: string; label?: string } }
    satIso = letter.weekend?.sat ?? null; weekendLabel = letter.weekend?.label
  } catch { /* no letter */ }
  const satDate = satIso ? new Date(`${satIso}T12:00:00`) : null
  const now = satDate ? new Date(satDate.getFullYear(), satDate.getMonth(), satDate.getDate() - 1, 12) : new Date()
  const stale = satDate ? satDate.getTime() < Date.now() - 36 * 3600e3 : false
  const wx = await forecast(satDate ?? undefined)
  if (stale) console.log(`  note:   the feed is for ${satIso} (already past) — the draft reads as of that Friday; no forecast for a past weekend`)
  const { html, hero, sat, sun, subject } = briefHtml(feed.picks, wx, { hero: arg('hero'), per: PER, now, weekendLabel })
  if (!trsAreLegal(html)) { console.error('✖ a <tr> sits outside a <table> — the email would silently lose a block'); process.exit(1) }
  const kb = Buffer.byteLength(html, 'utf8') / 1024
  if (kb > 100) { console.error(`✖ ${kb.toFixed(1)} KB — Gmail clips past 102 KB and hides the unsubscribe link`); process.exit(1) }
  const key = satIso ?? 'draft'
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `brief-${key}.html`), html)
  writeFileSync(join(OUT_DIR, 'brief.html'), html)
  console.log(`✓ brief ${CITY} · weekend of ${satIso ?? '?'} · ${wx ? wx.span : 'no forecast'} · ${kb.toFixed(1)} KB · tables legal`)
  console.log(`  cover   ${hero.title} (${hero.when})`)
  console.log(`  sat     ${sat.map((p) => p.title).join(' · ')}`)
  console.log(`  sun     ${sun.map((p) => p.title).join(' · ')}`)
  console.log(`  subject ${subject}`)
  console.log(`  → list/out/brief-${key}.html (+ brief.html)`)
  console.log(`  next:   cd list && bun run scripts/send.ts out/brief.html --subject "${subject.replace(/"/g, '\\"')}"`)
}
