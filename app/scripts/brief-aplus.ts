/**
 * A+ — THE FRIDAY BRIEF NESS CHOSE (design review, 4 Nov 2026: "Decided: A, sent as A+"; built into
 * the renderer 22 Nov on his "Yes, build A+"). The comp is `app/public/design/email-a2.html` on the
 * `proto/design-review-nov` branch; this is that page as mail a client will actually render — tables,
 * a photograph as a cell background with a flat colour under it, no flex, no pseudo-elements.
 *
 * The job (the review's words): help someone decide their weekend before they get out of bed. So —
 *   · THE COVER is the weekend's best photograph with the WEATHER HEADLINE on it, the pick named below.
 *   · Weather as three chips: Saturday, Sunday, sunset.
 *   · A short lede in WKNDR's voice.
 *   · EACH DAY opens with ONE LARGE pick, then TWO SMALLER ones — no rows of small thumbnails.
 *   · SATURDAY NIGHT gets its own dark block (which is also how a pick with no photo looks deliberate).
 *   · The sunset line before the night; "If it holds / If it rains" tags on a day the forecast splits.
 *   · Small: the cover + at most seven. The app is the catalogue; this is a decision and a door.
 *   · The weather is the subject line; the picks are the preheader.
 *
 * Left out of v1, on purpose: the "your 3 saves are on this weekend" line (the blast is one document
 * for the whole list; saves live in the account worker, per person) and "Tune what you get" (no such
 * page yet). "Spot on / Not for me" is in: each is a link the app counts on arrival (?fb=up|down&wk=<saturday>; never `w=`, the app's shared-plan parameter).
 *
 * Same data and rules as every other template: the deck's order, this weekend only, each pick once,
 * a source trace on every pick (signal + link, never republish), legal tables, {{unsub}}, under the clip.
 */
import type { Wx, WxDay } from './poster'
import { whenWeekendDays, latestDateOf, firstDateOf, whenMinutes } from '../src/lib/when'
import type { Pick } from '../src/types'
import { APP, FONT, MONO, esc, cut, weekendDays, line, dayWords, band, trace, selectWeekend, deckOrder, clock, realVenue as realVenueOf } from './lib/brief-shared'

const realVenue = (p: Pick) => { const v = realVenueOf(p); return v.trim().length < 3 ? '' : v }

const PAPER = '#faf8f3', INK = '#1a1a1a', INK2 = '#5a5a5a', INK3 = '#9a9a96', HAIR = '#ddd9cf', ACCENT = '#ff4d1f', SHELL = '#f1efe8'
const NIGHT = '#14202a', SLATE = '#2b3b47'
const DISPLAY = `'Clash Display','Helvetica Neue',Helvetica,Arial,sans-serif`
const CLASH = '<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap">'
const W = 600, GUT = 10, TEXT = 22          // the comp's column: cards sit 10px in, type 22px
const CARD = W - GUT * 2                    // 580

export interface AplusOpts { hero?: string; now?: Date; weekendLabel?: string }

/* ───────────────────────────── the words (pure, tested) ───────────────────────────── */

const wet = (d?: WxDay) => (d?.pop ?? 0) >= 60
const iffy = (d?: WxDay) => (d?.pop ?? 0) >= 40
const temp = (hi: number) => (hi < 8 ? 'Cold' : hi < 14 ? 'Cool' : hi < 20 ? 'Mild' : hi < 25 ? 'Warm' : 'Hot')
/** A day in two words for a chip: "dry", "showers", "rain". */
export const skyShort = (d: WxDay) => (wet(d) ? 'rain' : iffy(d) ? 'showers' : 'dry')

/** THE WEATHER HEADLINE — the cover's claim and the subject line. Two short sentences, the weather
 *  first, then what to do about it. No dashes: it is set at 44px over a photograph. */
export function headline(wx: Wx | null): string {
  if (!wx?.days.length) return 'The weekend, by day.'
  const [a, b = a] = wx.days
  const t = temp(Math.max(a.hi, b.hi))
  if (wet(a) && wet(b)) return `${t} and wet. An indoors weekend.`
  if (!iffy(a) && !iffy(b)) return `${t}, dry weekend. ${t === 'Cold' || t === 'Cool' ? 'Go out after dark.' : 'Stay out late.'}`
  if (!iffy(a) && iffy(b)) return `${temp(a.hi)}, dry Saturday. Go out before Sunday’s rain.`   // the named day's own temperature
  if (iffy(a) && !iffy(b)) return `Wet Saturday, dry Sunday. Save the outdoors for Sunday.`
  return `${t} and showery. Pick by the hour.`
}
/** The lede's second sentence: how to spend the two days. */
export function advice(wx: Wx | null): string {
  if (!wx?.days.length) return 'Here is the weekend, a day at a time.'
  const [a, b = a] = wx.days
  if (iffy(a) && iffy(b)) return wet(a) && wet(b) ? 'It is a weekend for warm rooms; go out between the showers.' : 'Keep a roof within reach on both days.'
  if (!iffy(a) && iffy(b)) return 'Spend Saturday out, and keep Sunday for warm rooms.'
  if (iffy(a) && !iffy(b)) return 'Keep Saturday for warm rooms, and get out on Sunday.'
  return 'Both days are dry. Spend them outside and leave the museums for a wet one.'
}
/** A title short enough to sit in a sentence: "Sunday Market comes to Oostenburg: winter pop-up…" →
 *  "Sunday Market comes to Oostenburg". Cuts at the first colon, dash or bracket, never mid-word. */
export function shortTitle(title: string): string {
  const t = title.split(/\s*[:(\[]|\s+[–—-]\s+/)[0].trim().replace(/[\s!?.,;]+$/, '')
  return t.length >= 4 ? t : title.trim().replace(/[\s!?.,;]+$/, '')
}

type Tag = { text: string; accent: boolean }
/** The orange status a pick has earned from its own dates, or null. Never a claim the feed does not
 *  make: "Last days" is a run ending within a week of this Sunday, "Opens this weekend" an "Opens …"
 *  whose first day is Saturday or Sunday. */
export function statusTag(p: Pick, now: Date): Tag | null {
  const { satD, sunD } = weekendDays(now)
  const w = p.when || ''
  const first = firstDateOf(w, now), last = latestDateOf(w, now)
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (/^\s*opens?\b/i.test(w) && first && day(first) >= day(satD) && day(first) <= day(sunD)) return { text: 'Opens this weekend', accent: true }
  if (/\b(until|t\/m|through|thru|till)\b/i.test(w) && last) {
    const left = Math.round((day(last) - day(sunD)) / 864e5)
    if (left <= 0) return { text: 'Last weekend', accent: true }
    if (left <= 7) return { text: 'Last days', accent: true }
  }
  if (p.freshness === 'new') return { text: 'New', accent: true }
  return null
}
const timed = (p: Pick) => /\d{1,2}[:.]\d{2}/.test(p.when || '')
const hhmm = (p: Pick) => { const m = whenMinutes(p.when); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` }
/** The part of the day a pick belongs to. */
export function partOfDay(p: Pick): string {
  if (!timed(p)) return /\b(until|t\/m|through|thru|till)\b|\d\s*[–—-]\s*(?:[a-z]{3}\s+)?\d/i.test(p.when || '') ? 'All weekend' : 'All day'
  const m = whenMinutes(p.when)
  return m < 12 * 60 ? 'Morning' : m < 14 * 60 ? (p.category === 'eat' ? 'Lunch' : 'Midday') : m < 17 * 60 ? 'Afternoon' : m < 20 * 60 ? 'Evening' : 'Night'
}
/** The tag on a pick's picture: its status if it has one; on a day the forecast splits, the plan it
 *  belongs to ("If it holds" outdoors, "If it rains" under a roof); otherwise the part of the day. */
export function pictureTag(p: Pick, d: WxDay | undefined, now: Date, plan: boolean): Tag {
  const s = statusTag(p, now)
  if (s) return s
  if (plan && iffy(d)) return { text: p.outdoor ? 'If it holds' : 'If it rains', accent: false }
  return { text: partOfDay(p), accent: false }
}

/** One day of the brief: an optional night block, one large pick, up to two smaller. From the day's
 *  picks in the DECK's order (best first) — the night is the best timed pick from 18:00, the large
 *  one the best pictured pick left, the two smaller the next two, then set by the clock. */
export function dayPlan(picks: Pick[], withNight: boolean): { hero: Pick | null; two: Pick[]; night: Pick | null } {
  const ordered = deckOrder(picks)
  const night = withNight ? ordered.find((p) => timed(p) && whenMinutes(p.when) >= 18 * 60) ?? null : null
  const rest = ordered.filter((p) => p !== night)
  const hero = rest.find((p) => p.image) ?? rest[0] ?? null
  const two = rest.filter((p) => p !== hero).slice(0, 2).sort((x, y) => clock(x) - clock(y))
  return { hero, two, night }
}

/* ─────────────────────────────────── the pieces ─────────────────────────────────── */

const chip = (t: Tag) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:6px 9px;border-radius:99px;background:${t.accent ? ACCENT : PAPER};font:700 10px/1 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:${t.accent ? '#ffffff' : INK};white-space:nowrap;">${esc(t.text)}</td></tr></table>`
const src = (p: Pick, color = INK3) => (trace(p) ? `<div style="margin-top:6px;font:400 10.5px/1.4 ${MONO};color:${color};">${esc(trace(p))}</div>` : '')
/** A photograph as a cell: the cut as the background, the day's wash under it, a tag top-left. A pick
 *  with no photograph gets its initial on the wash — a type tile, never a grey box. */
function picture(p: Pick, w: number, h: number, tag: Tag, radius: number, cls: string, washOf: WxDay | undefined): string {
  const b = band(washOf?.mode ?? 'COOL')
  const bg = p.image
    ? `background="${esc(cut(p, w * 2, h * 2))}" bgcolor="#e7e4db" style="background:#e7e4db url('${esc(cut(p, w * 2, h * 2))}') center/cover no-repeat;`
    : `bgcolor="${b.bg}" style="background:${b.bg};`
  const initial = p.image ? '' : `<div style="padding:0 14px 12px;font:600 ${Math.round(h * .42)}px/1 ${DISPLAY};color:${b.ink};">${esc((p.title.trim()[0] || '·').toUpperCase())}</div>`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="${cls}" style="border-radius:${radius}px;overflow:hidden;">
            <tr><td class="px" width="${w}" height="${h}" valign="top" ${bg}width:${w}px;height:${h}px;border-radius:${radius}px;overflow:hidden;">
              <a href="${esc(p.link)}" style="display:block;color:${INK};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" height="${h}" class="pxi" style="height:${h}px;">
              <tr><td valign="top" style="padding:12px;">${chip(tag)}</td></tr>
              <tr><td valign="bottom">${initial || '&nbsp;'}</td></tr>
              </table>
              </a>
            </td></tr>
            </table>`
}

/** The cover: the pick's photograph, the weather headline over the top of it, the pick named at the foot. */
function cover(p: Pick, claimText: string, kicker: string, now: Date): string {
  const H = 725   // 4:5 of the 580 card
  const bg = p.image
    ? `background="${esc(cut(p, CARD * 2, H * 2))}" bgcolor="${SLATE}" style="background:${SLATE} url('${esc(cut(p, CARD * 2, H * 2))}') center/cover no-repeat;`
    : `bgcolor="${SLATE}" style="background:${SLATE};`
  // the scrims: a flat tint for a client that drops gradients, the gradient for one that keeps them
  const top = 'background:rgba(20,32,42,.42);background:linear-gradient(180deg,rgba(20,32,42,.72) 0%,rgba(20,32,42,0) 100%);'
  const foot = 'background:rgba(20,32,42,.62);background:linear-gradient(180deg,rgba(20,32,42,0) 0%,rgba(20,32,42,.88) 62%);'
  return `
        <tr><td class="gut" style="padding:0 ${GUT}px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="cv" style="border-radius:24px;overflow:hidden;">
          <tr><td class="px" width="${CARD}" height="${H}" valign="top" ${bg}width:${CARD}px;height:${H}px;border-radius:24px;overflow:hidden;">
            <a href="${esc(p.link)}" style="display:block;color:#ffffff;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" height="${H}" class="pxi" style="height:${H}px;">
            <tr><td valign="top" style="padding:22px 22px 70px;${top}">
              <div class="claim" style="font:600 44px/.98 ${DISPLAY};letter-spacing:-.02em;color:#ffffff;">${esc(claimText)}</div>
            </td></tr>
            <tr><td valign="bottom" style="padding:90px 22px 20px;${foot}">
              <div style="font:700 11px/1.3 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:#ffb199;">${esc(kicker)}</div>
              <div class="cvt" style="margin:5px 0 3px;font:600 26px/1.06 ${DISPLAY};color:#ffffff;">${esc(shortTitle(p.title))}</div>
              <div style="font:400 14px/1.4 ${FONT};color:#e9e6de;">${line(p, 96)}</div>
              ${src(p, 'rgba(255,255,255,.66)')}
            </td></tr>
            </table>
            </a>
          </td></tr>
          </table>
        </td></tr>`
}

const wxChips = (wx: Wx | null) => {
  if (!wx?.days.length) return ''
  const pill = (dot: string, text: string) => `<span class="wxc" style="display:inline-block;margin:0 6px 6px 0;padding:7px 11px;border-radius:99px;background:#e9edef;font:700 12px/1 ${FONT};color:#2c3d4a;white-space:nowrap;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dot};margin-right:6px;vertical-align:1px;font-size:0;line-height:0;">&nbsp;</span>${text}</span>`
  const days = wx.days.slice(0, 2).map((d) => pill('#6f8796', `${d.label} ${Math.round(d.hi)}&deg; &middot; ${skyShort(d)}`))
  const set = wx.days[0].sunset ? pill('#f0a04b', `Sunset ${esc(wx.days[0].sunset)}`) : ''
  return `
        <tr><td class="pad" style="padding:12px 14px 0;">${days.join('')}${set}</td></tr>`
}

const dayHead = (name: string, d: WxDay | undefined) => `
        <tr><td class="pad" style="padding:34px ${TEXT}px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td valign="bottom" class="ink dh" style="font:600 40px/1 ${DISPLAY};letter-spacing:-.02em;color:${INK};">${name}</td>
            <td valign="bottom" align="right" class="ink2" style="font:400 13px/1.3 ${FONT};color:${INK2};">${d ? `${esc(dayWords(d).split('.')[0].toLowerCase())} &middot; ${Math.round(d.hi)}&deg;` : ''}</td>
          </tr></table>
        </td></tr>`

/** When and where, as the line above a title: "10:00 · Stedelijk", "Afternoon · Foam", or the place alone. */
const place = (p: Pick, max: number) => { const v = (realVenue(p) || p.area || '').replace(/\s*\(.*$/, '').trim(); return v.length > max ? '' : v }
const whenWhere = (p: Pick, withHour: boolean, tag?: Tag) => {
  const where = place(p, withHour ? 44 : 30)
  const part = partOfDay(p)
  const when = timed(p) && withHour ? hhmm(p) : part === tag?.text ? '' : part   // never the tag's own words again
  return [when, where].filter(Boolean).map((x) => esc(x)).join(' &middot; ')
}

const big = (p: Pick, d: WxDay | undefined, now: Date) => { const tag = pictureTag(p, d, now, false); const ww = whenWhere(p, true, tag); return `
        <tr><td class="gut" style="padding:0 ${GUT}px;">
          ${picture(p, CARD, 386, tag, 20, 'bg1', d)}
          <div style="padding:12px 12px 0;">
            ${ww ? `<div class="ink2" style="font:700 12px/1.3 ${FONT};color:${INK2};">${ww}</div>` : ''}
            <div class="ink" style="margin:3px 0 4px;font:600 24px/1.08 ${DISPLAY};color:${INK};"><a href="${esc(p.link)}" class="ink" style="color:${INK};">${esc(p.title)}</a></div>
            <div class="ink" style="font:400 15px/1.5 ${FONT};color:#2a2a2a;">${line(p, 130)}</div>
            ${src(p)}
          </div>
        </td></tr>` }

const small = (p: Pick, d: WxDay | undefined, now: Date) => { const tag = pictureTag(p, d, now, true); const ww = whenWhere(p, false, tag); return `${picture(p, 285, 285, tag, 16, 'sm', d)}
              ${ww ? `<div class="ink2" style="margin-top:8px;font:700 11px/1.3 ${FONT};color:${INK2};">${ww}</div>` : ''}
              <div class="ink" style="margin-top:${ww ? 2 : 8}px;font:700 15px/1.25 ${FONT};color:${INK};"><a href="${esc(p.link)}" class="ink" style="color:${INK};">${esc(p.title)}</a></div>
              ${src(p)}` }
const pair = (two: Pick[], d: WxDay | undefined, now: Date) => (two.length ? `
        <tr><td class="gut" style="padding:18px ${GUT}px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="50%" valign="top" style="width:50%;padding-right:5px;">${small(two[0], d, now)}</td>
            <td width="50%" valign="top" style="width:50%;padding-left:5px;">${two[1] ? small(two[1], d, now) : '&nbsp;'}</td>
          </tr></table>
        </td></tr>` : '')

const sunsetLine = (d: WxDay | undefined) => (d?.sunset ? `
        <tr><td class="pad" style="padding:18px ${TEXT}px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="9" style="width:9px;"><div style="width:9px;height:9px;border-radius:50%;background:#f0a04b;font-size:0;line-height:0;">&nbsp;</div></td>
            <td width="1" style="padding:0 8px;font:400 12px/1 ${MONO};color:#a55a1a;white-space:nowrap;">Sunset ${esc(d.sunset)}</td>
            <td><div style="height:1px;background:#f0c896;font-size:0;line-height:0;">&nbsp;</div></td>
          </tr></table>
        </td></tr>` : '')

/** Saturday night, as its own dark block: type only, so it needs no photograph. */
function nightBlock(p: Pick, dayName: string, now: Date): string {
  const title = shortTitle(p.title)
  const size = title.length > 34 ? 26 : title.length > 20 ? 32 : 40
  const { satD, sunD } = weekendDays(now)
  const days = whenWeekendDays(p.when, satD, sunD, now)
  const pills = [days.sat !== days.sun && !/\b(until|t\/m|through)\b/i.test(p.when) ? 'One night only' : '', /€|\d/.test(p.price || '') ? esc(p.price) : /free|gratis/i.test(p.price || '') ? 'Free' : '']
    .filter(Boolean).map((t) => `<span style="display:inline-block;margin:0 8px 0 0;padding:6px 10px;border-radius:99px;border:1px solid #3a4b57;font:700 12px/1 ${FONT};color:${PAPER};white-space:nowrap;">${t}</span>`).join('')
  return `
        <tr><td class="gut" style="padding:18px ${GUT}px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:20px;overflow:hidden;"><tr>
          <td bgcolor="${NIGHT}" style="background:${NIGHT};border-radius:20px;padding:20px;">
            <a href="${esc(p.link)}" style="display:block;color:${PAPER};">
            <div style="font:700 11px/1.3 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:#ffb199;">${dayName} night &middot; ${hhmm(p)}${realVenue(p) ? ` &middot; ${esc(realVenue(p))}` : ''}</div>
            <div class="nt" style="margin:10px 0;font:600 ${size}px/.96 ${DISPLAY};letter-spacing:-.02em;color:${PAPER};">${esc(title)}</div>
            <div style="font:400 15px/1.5 ${FONT};color:#c9d3d9;">${line(p, 150)}</div>
            ${pills ? `<div style="margin-top:14px;">${pills}</div>` : ''}
            ${src(p, '#8fa0ab')}
            </a>
          </td></tr></table>
        </td></tr>`
}

function frame(rows: string, preheader: string, satIso: string): string {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>WKNDR — picks of the weekend</title>
${CLASH}
<!--[if mso]>
<xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  /* Written by app/scripts/brief-aplus.ts — A+, the Friday brief (design review, 4 Nov 2026). */
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;outline:0;line-height:100%;text-decoration:none}
  a{text-decoration:none}
  @media (max-width:480px){
    .shell{width:100%!important}
    .outer{padding:0!important}
    .card{border-radius:0!important}
    .cv td.px{width:100%!important;height:470px!important}
    .cv .pxi{height:470px!important}
    .claim{font-size:36px!important}
    .cvt{font-size:23px!important}
    .bg1 td.px{width:100%!important;height:236px!important}
    .bg1 .pxi{height:236px!important}
    .sm td.px{width:100%!important;height:172px!important}
    .sm .pxi{height:172px!important}
    .dh{font-size:34px!important}
    .nt{font-size:30px!important}
  }
  @media (prefers-color-scheme:dark){
    .bg{background:#141312!important}
    .card{background:#1c1a18!important}
    .ink{color:#f4f1ea!important}
    .ink2{color:#b8b4a9!important}
    .ink3{color:#9a978d!important}
    .wxc{background:#26323a!important;color:#dfe7ec!important}
    .fbb{border-color:#3a3632!important;color:#f4f1ea!important}
  }
  [data-ogsc] .bg{background:#141312!important}
  [data-ogsc] .card{background:#1c1a18!important}
  [data-ogsc] .ink{color:#f4f1ea!important}
  [data-ogsc] .ink2{color:#b8b4a9!important}
  [data-ogsc] .ink3{color:#9a978d!important}
  [data-ogsc] .wxc{background:#26323a!important;color:#dfe7ec!important}
  [data-ogsc] .fbb{border-color:#3a3632!important;color:#f4f1ea!important}
</style>
</head>
<body class="bg" style="margin:0;padding:0;width:100%;background:${SHELL};">
<div style="display:none;font-size:1px;color:${SHELL};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${esc(preheader)}
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SHELL};" class="bg">
<tr><td align="center" class="outer" style="padding:20px 10px 40px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${W}" class="shell" style="width:100%;max-width:${W}px;">
    <tr><td class="card" style="background:${PAPER};border-radius:18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${rows}
        <tr><td class="gut" style="padding:28px ${GUT}px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td align="center" bgcolor="${ACCENT}" style="background:${ACCENT};border-radius:99px;"><a href="${APP}" style="display:block;padding:20px;font:600 18px/1 ${DISPLAY};color:#ffffff;">Swipe the rest of the weekend &nbsp;&rarr;</a></td>
          </tr></table>
        </td></tr>
        <tr><td align="center" class="ink" style="padding:26px 20px 4px;font:400 14px/1.4 ${FONT};color:${INK};">
          Was this a good weekend?<br>
          <a href="${APP}&amp;fb=up&amp;wk=${satIso}" class="fbb" style="display:inline-block;margin:8px 3px 0;padding:8px 14px;border:1px solid ${HAIR};border-radius:99px;font:700 13px/1 ${FONT};color:${INK};">Spot on</a><a href="${APP}&amp;fb=down&amp;wk=${satIso}" class="fbb" style="display:inline-block;margin:8px 3px 0;padding:8px 14px;border:1px solid ${HAIR};border-radius:99px;font:700 13px/1 ${FONT};color:${INK};">Not for me</a>
        </td></tr>
        <tr><td align="center" class="ink3" style="padding:18px ${TEXT}px 34px;font:400 12px/1.6 ${FONT};color:${INK3};">
          Fridays at 07:30. You signed up at wkndr.xyz. Every pick links to its organiser.<br>
          <a href="{{unsub}}" style="color:${INK3};text-decoration:underline;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`
}

/* ─────────────────────────────────── the document ─────────────────────────────────── */

export function aplusHtml(picks: Pick[], wx: Wx | null, opts: AplusOpts = {}): { html: string; hero: Pick; sat: Pick[]; sun: Pick[]; night: Pick | null; subject: string; preheader: string } {
  // a deep read of the deck (eight a day) so the night and the large pick are CHOSEN, not just next in line
  const s = selectWeekend(picks, wx, { ...opts, per: 8 })
  const { hero, now, dSat, dSun } = s
  const satPlan = dayPlan(s.sat, true), sunPlan = dayPlan(s.sun, false)
  const sat = [satPlan.hero, ...satPlan.two].filter((p): p is Pick => !!p)
  const sun = [sunPlan.hero, ...sunPlan.two].filter((p): p is Pick => !!p)
  const subject = headline(wx)
  const names = [hero, satPlan.night ?? satPlan.hero, sunPlan.hero].filter((p): p is Pick => !!p).map((p) => shortTitle(p.title))
  const preheader = names.join(', ')
  const { satD, sunD } = weekendDays(now)
  const heroDays = whenWeekendDays(hero.when, satD, sunD, now)
  const kicker = `The pick · ${heroDays.sat && !heroDays.sun ? 'Saturday' : heroDays.sun && !heroDays.sat ? 'Sunday' : 'all weekend'}${timed(hero) ? `, ${hhmm(hero)}` : ''}`
  const lede = `This weekend: <b>${esc(names[0])}</b>${names.length > 2 ? `, ${esc(names[1])} and ${esc(names[2])}` : names[1] ? ` and ${esc(names[1])}` : ''}. ${esc(advice(wx))}`
  const iso = `${satD.getFullYear()}-${String(satD.getMonth() + 1).padStart(2, '0')}-${String(satD.getDate()).padStart(2, '0')}`

  const rows = `
        <tr><td class="pad" style="padding:16px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td class="ink" style="font:700 18px/1 ${DISPLAY};letter-spacing:.02em;color:${INK};">WKNDR<span style="color:${ACCENT};">.</span></td>
            <td align="right" class="ink2" style="font:400 12px/1 ${FONT};color:${INK2};">Amsterdam &middot; ${esc((wx?.label ?? s.span).replace(/^Sat /, '').replace(/ – (Sun )?/, '–'))}</td>
          </tr></table>
        </td></tr>${cover(hero, subject, kicker, now)}${wxChips(wx)}
        <tr><td class="pad ink" style="padding:22px ${TEXT}px 0;font:400 18px/1.42 ${FONT};color:${INK};">${lede}</td></tr>`
    + (sat.length || satPlan.night ? dayHead('Saturday', dSat) + (satPlan.hero ? big(satPlan.hero, dSat, now) : '') + pair(satPlan.two, dSat, now)
        + (satPlan.night ? sunsetLine(dSat) + nightBlock(satPlan.night, 'Saturday', now) : '') : '')
    + (sun.length ? dayHead('Sunday', dSun) + (sunPlan.hero ? big(sunPlan.hero, dSun, now) : '') + pair(sunPlan.two, dSun, now) : '')
  return { html: frame(rows, preheader, iso), hero, sat, sun, night: satPlan.night, subject, preheader }
}
