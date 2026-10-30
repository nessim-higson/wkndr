/**
 * THE RADICAL FIVE — five Friday briefs that are NOT the same email in a different arrangement
 * (Ness, 2026-10-30: "give me some radically different email designs"). The seven in
 * `brief-picks.ts` all share one world: paper, Helvetica, a card, numbered picks. These five each
 * take a different OBJECT as the model and build the brief as that object:
 *
 *   poster    a gig poster — black, the hero full-bleed, the picks as a LINEUP in huge uppercase
 *   receipt   a till receipt — thermal paper, everything monospace, a barcode of the weekend
 *   board     a departures board — Swiss timetable: black rules, bold times in red, no pictures
 *   postcard  a postcard — the photo as the front, a handwritten note and a stamp as the back
 *   note      a plain email from a friend — no layout at all, prose with links
 *
 * Same data, same rules (list/README.md): every <tr> in a <table>, everything inline, no flex/grid,
 * under 102 KB, {{unsub}} in the footer, images cut from the original on the focal point. The
 * receipt is the one honest place for monospace at body size: a receipt IS machine output.
 */
import type { Wx, WxDay } from './poster'
import { whenWeekendDays } from '../src/lib/when'
import type { Pick } from '../src/types'
import { APP, FONT, MONO, esc, deg, cut, weekendDays, slot, line, dayWords, band, trace, selectWeekend, realVenue as realVenueOf } from './lib/brief-shared'

const realVenue = (p: Pick) => { const v = realVenueOf(p); return v.trim().length < 3 ? '' : v }

export type RadicalLayout = 'poster' | 'receipt' | 'board' | 'postcard' | 'note'
export const RADICAL_LAYOUTS: Record<RadicalLayout, { name: string; bet: string }> = {
  poster:   { name: 'The Poster',   bet: 'a gig poster — black page, the hero full-bleed, the rest as a lineup in huge uppercase' },
  receipt:  { name: 'The Receipt',  bet: 'a till receipt — thermal paper, all monospace, the weekend as a barcode; the smallest email we can send' },
  board:    { name: 'The Board',    bet: 'a departures board — Swiss timetable, bold times in red, black rules, not one photograph' },
  postcard: { name: 'The Postcard', bet: 'a postcard on a desk — the photo as the front, a handwritten note, a stamp with the temperature' },
  note:     { name: 'The Note',     bet: 'a plain email from a friend — no layout, no card, no numbers; prose with links' },
}
export interface RadicalOpts { hero?: string; per?: number; now?: Date; weekendLabel?: string; layout: RadicalLayout }

const ACCENT = '#ff4d1f', INK3 = '#8b8a82'
const nn = (i: number) => String(i).padStart(2, '0')
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayOf(p: Pick, now: Date): 'Saturday' | 'Sunday' | 'Both days' {
  const { satD, sunD } = weekendDays(now)
  const d = whenWeekendDays(p.when, satD, sunD, now)
  return d.sat && !d.sun ? 'Saturday' : d.sun && !d.sat ? 'Sunday' : 'Both days'
}
/** "12:00" when the card has an hour, else "". */
const hourOf = (p: Pick, now: Date) => { const s = slot(p, now); return /·/.test(s.text) ? s.text.split('·').pop()!.replace(/&nbsp;/g, '').trim() : '' }
/** The slot in lower case words without the hour: "afternoon", "all day", "last day". */
const slotWords = (p: Pick, now: Date) => slot(p, now).text.split('&nbsp;·&nbsp;')[0].replace(/&nbsp;/g, ' ').trim().toLowerCase()
const meta = (p: Pick, sep = ' · ') => [realVenue(p), p.price].filter(Boolean).map(esc).join(sep)
const why = (p: Pick) => (p.why && !/weekend (guide|tips)/i.test(p.why) ? p.why : '')
const stamp = (now: Date) => `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

const select = selectWeekend

/* ───────────────────────────────── the document ───────────────────────────────── */

interface Frame { shell: string; width?: number; dark?: boolean; preheader: string; layout: RadicalLayout; extraCss?: string; footerInk?: string; footerRule?: string }
/** The one HTML document every layout sits in: head, preheader, a centred shell of `width`, the
 *  body rows, then the unsubscribe footer. Dark-mode classes exist only where a layout uses them. */
function frame(rows: string, f: Frame): string {
  const w = f.width ?? 600
  const footerInk = f.footerInk ?? INK3
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="${f.dark ? 'dark' : 'light dark'}">
<meta name="supported-color-schemes" content="${f.dark ? 'dark' : 'light dark'}">
<title>WKNDR — picks of the weekend</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  /* Written by app/scripts/brief-radical.ts — ${RADICAL_LAYOUTS[f.layout].name} (${f.layout}): ${RADICAL_LAYOUTS[f.layout].bet}. */
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;outline:0;line-height:100%;text-decoration:none}
  a{text-decoration:none}
  .lnk:hover{opacity:.75!important}
  @media (max-width:480px){
    .shell{width:100%!important}
    .pad{padding-left:20px!important;padding-right:20px!important}
    .stack{display:block!important;width:100%!important;max-width:100%!important}
    .stack-gap{height:16px!important;line-height:16px!important;font-size:0!important;display:block!important;width:100%!important}
${f.extraCss ?? ''}
  }
  @media (prefers-color-scheme:dark){
    .bg{background:#141312!important}
    .card{background:#1c1a18!important}
    .ink{color:#f4f1ea!important}
    .ink3{color:#9a978d!important}
    .hair{background:#2e2b27!important}
  }
  [data-ogsc] .bg{background:#141312!important}
  [data-ogsc] .card{background:#1c1a18!important}
  [data-ogsc] .ink{color:#f4f1ea!important}
  [data-ogsc] .ink3{color:#9a978d!important}
  [data-ogsc] .hair{background:#2e2b27!important}
</style>
</head>
<body class="${f.dark ? '' : 'bg'}" bgcolor="${f.shell}" style="margin:0;padding:0;width:100%;background:${f.shell};">

<div style="display:none;font-size:1px;color:${f.shell};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${esc(f.preheader)}
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${f.shell}" style="background:${f.shell};" class="${f.dark ? '' : 'bg'}">
<tr><td align="center" style="padding:${f.layout === 'note' ? '28px 12px 40px' : '26px 12px 40px'};">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${w}" class="shell" style="width:100%;max-width:${w}px;">
${rows}
    <tr><td class="pad" style="padding:22px ${f.layout === 'receipt' ? 14 : 30}px 0;${f.footerRule ? `border-top:1px solid ${f.footerRule};` : ''}">
      <div class="${f.dark ? '' : 'ink3'}" style="font:400 ${f.layout === 'receipt' ? `10px/1.7 ${MONO}` : `12px/1.65 ${FONT}`};color:${footerInk};${f.layout === 'receipt' ? 'text-align:center;' : ''}">
        You asked for the WKNDR Friday brief. One email a week, Amsterdam only. Every pick links to the organiser; we never resell a ticket.<br>
        <a href="{{unsub}}" style="color:${footerInk};border-bottom:1px solid ${footerInk};">Unsubscribe</a>
        &nbsp;&mdash;&nbsp; one click, no questions.
      </div>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>
`
}

/* ───────────────────────────────── THE POSTER ───────────────────────────────── */
/** A gig poster. Black page. The hero full-bleed 4:5, then its name at 46px uppercase, the claim as
 *  a black-on-orange strip, and every other pick as a LINEUP line — bold uppercase, sizes falling
 *  by rank the way a festival bill does. No card, no radius, no grey. */
function poster(s: ReturnType<typeof select>): string {
  const { hero, sat, sun, now, c, dSat, dSun, more, span } = s
  const BLACK = '#0a0a0a', WHITE = '#ffffff', DIM = 'rgba(255,255,255,.55)'
  const heroDay = dayOf(hero, now)
  const heroPic = hero.image
    ? `<a href="${esc(hero.link)}" class="lnk" style="display:block;"><img src="${esc(cut(hero, 1200, 1500))}" width="600" alt="${esc(hero.title)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#1a1a1a;color:${WHITE};font:700 20px/1.2 ${FONT};"></a>`
    : `<div style="height:300px;background:${ACCENT};font:700 220px/300px ${FONT};letter-spacing:-.06em;color:${BLACK};text-align:center;">${esc((hero.title.trim()[0] || '·').toUpperCase())}</div>`
  const sizes = [30, 26, 23, 21, 20, 20, 20, 20]
  const bill = (p: Pick, i: number, dayName: string) => {
    const h = hourOf(p, now)
    return `
        <tr><td class="pad" style="padding:0 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #2a2a2a;">
          <tr><td style="padding:14px 0 16px;">
            <div style="font:700 ${sizes[i] ?? 20}px/1 ${FONT};letter-spacing:-.035em;text-transform:uppercase;color:${WHITE};"><a href="${esc(p.link)}" class="lnk" style="color:${WHITE};">${esc(p.title)}</a></div>
            <div style="margin-top:8px;font:400 10px/1.5 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${DIM};">${[dayName.slice(0, 3), h || slotWords(p, now), realVenue(p), p.price].filter(Boolean).map(esc).join(' &nbsp;/&nbsp; ')}</div>
            ${trace(p) ? `<div style="margin-top:6px;font:400 10px/1.4 ${MONO};color:#6b6b6b;">${esc([trace(p), why(p)].filter(Boolean).join(' · '))}</div>` : ''}
          </td></tr>
          </table>
        </td></tr>`
  }
  const dayLabel = (name: string, d: WxDay | undefined) => `
        <tr><td class="pad" style="padding:30px 28px 10px;">
          <div style="font:700 11px/1 ${FONT};letter-spacing:.3em;text-transform:uppercase;color:${ACCENT};">${name}${d ? ` &nbsp;&nbsp;${deg(d.hi)} &nbsp;&nbsp;${esc(dayWords(d).split('.')[0]).toUpperCase()}` : ''}</div>
        </td></tr>`
  const rows = `
    <tr><td style="padding:0 0 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="font:700 14px/1 ${FONT};letter-spacing:-.02em;color:${WHITE};">WKNDR</td>
        <td align="right" style="font:400 10px/1 ${FONT};letter-spacing:.2em;text-transform:uppercase;color:${DIM};">Amsterdam &nbsp;·&nbsp; ${esc(span)}</td>
      </tr>
      </table>
    </td></tr>
    <tr><td bgcolor="${BLACK}" style="background:${BLACK};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td>${heroPic}</td></tr>
        <tr><td class="pad" style="padding:26px 28px 0;">
          <div style="font:400 10px/1 ${FONT};letter-spacing:.2em;text-transform:uppercase;color:${ACCENT};">01 &nbsp;·&nbsp; The one to book &nbsp;·&nbsp; ${heroDay === 'Both days' ? 'Both days' : heroDay}${hourOf(hero, now) ? ` &nbsp;·&nbsp; ${hourOf(hero, now)}` : ''}</div>
          <h1 class="big" style="margin:14px 0 0;font:700 46px/.98 ${FONT};letter-spacing:-.045em;text-transform:uppercase;color:${WHITE};"><a href="${esc(hero.link)}" class="lnk" style="color:${WHITE};">${esc(hero.title)}</a></h1>
          ${meta(hero) ? `<div style="margin-top:14px;font:400 11px/1.5 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${DIM};">${meta(hero, ' &nbsp;/&nbsp; ')}</div>` : ''}
          <p style="margin:14px 0 0;font:400 15px/1.55 ${FONT};color:rgba(255,255,255,.82);">${line(hero, 200)}</p>
          ${trace(hero) ? `<div style="margin-top:10px;font:400 10px/1.4 ${MONO};color:#6b6b6b;">${esc([trace(hero), why(hero)].filter(Boolean).join(' · '))}</div>` : ''}
        </td></tr>
        <tr><td style="padding:28px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${ACCENT}" style="background:${ACCENT};">
          <tr><td class="pad" style="padding:18px 28px;">
            <div class="mid" style="font:700 22px/1.05 ${FONT};letter-spacing:-.035em;text-transform:uppercase;color:${BLACK};">${c.strong}</div>
            <div style="margin-top:8px;font:400 10px/1.5 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:rgba(0,0,0,.7);">${[dSat ? `Sat ${Math.round(dSat.hi)}° ${esc(dayWords(dSat).split('.')[0])}` : '', dSun ? `Sun ${Math.round(dSun.hi)}° ${esc(dayWords(dSun).split('.')[0])}` : '', 'forecast Open-Meteo'].filter(Boolean).join(' &nbsp;/&nbsp; ')}</div>
          </td></tr>
          </table>
        </td></tr>
        ${sat.length ? dayLabel('Saturday', dSat) + sat.map((p, i) => bill(p, i, 'Saturday')).join('') : ''}
        ${sun.length ? dayLabel('Sunday', dSun) + sun.map((p, i) => bill(p, i + Math.min(sat.length, 2), 'Sunday')).join('') : ''}
        <tr><td style="padding:30px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${WHITE}" style="background:${WHITE};">
          <tr><td class="pad" style="padding:22px 28px 24px;">
            <a href="${APP}" style="font:700 18px/1.1 ${FONT};letter-spacing:-.03em;text-transform:uppercase;color:${BLACK};">${more > 0 ? `${more} more on the deck` : 'Open the deck'} &nbsp;&rarr;</a>
            <div style="margin-top:10px;font:400 12px/1.5 ${FONT};color:#555;">Save what you'd go to. Sign in once and it follows you. The overlap with whoever you'd go with is the plan.</div>
          </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`
  return frame(rows, { shell: BLACK, dark: true, preheader: `${hero.title} — ${s.subject}`, layout: 'poster', footerInk: '#6b6b6b', extraCss: `    .big{font-size:36px!important}\n    .mid{font-size:19px!important}` })
}

/* ───────────────────────────────── THE RECEIPT ───────────────────────────────── */
/** A till receipt. A 360px strip of thermal paper on a counter, everything monospace 12px, two
 *  columns (label left, value right) ruled by dashes, the picks as line items with the hour as
 *  the amount, totals, a thank-you, and a barcode built from table cells. No pictures: the
 *  smallest brief we can send. */
function receipt(s: ReturnType<typeof select>): string {
  const { hero, sat, sun, now, dSat, dSun, more, span, c } = s
  const PAPER = '#fdfdfa', INK = '#2b2b2b', T = `font:400 12px/1.55 ${MONO};color:${INK};`
  const rule = (ch = '-') => `<tr><td colspan="2" style="${T}letter-spacing:.05em;overflow:hidden;white-space:nowrap;color:#9a9a9a;">${ch.repeat(60)}</td></tr>`
  const kv = (k: string, v: string) => `<tr><td valign="top" style="${T}padding:1px 0;">${k}</td><td valign="top" align="right" style="${T}padding:1px 0 1px 10px;white-space:nowrap;">${v}</td></tr>`
  const centre = (t: string, extra = '') => `<tr><td colspan="2" align="center" style="${T}${extra}">${t}</td></tr>`
  const item = (p: Pick, k: number, dayName: string) => {
    const h = hourOf(p, now) || slotWords(p, now).toUpperCase()
    const m = [realVenue(p), p.price].filter(Boolean).map(esc).join(' · ')
    return `
      <tr><td valign="top" style="${T}padding:8px 0 0;"><span style="color:#9a9a9a;">${nn(k)}</span>&nbsp; <a href="${esc(p.link)}" style="color:${INK};text-transform:uppercase;border-bottom:1px dotted #9a9a9a;">${esc(p.title)}</a></td><td valign="top" align="right" style="${T}padding:8px 0 0 10px;white-space:nowrap;">${dayName.slice(0, 3).toUpperCase()} ${h}</td></tr>
      ${m ? `<tr><td colspan="2" style="${T}padding-left:30px;color:#6a6a6a;">${m}</td></tr>` : ''}
      ${trace(p) ? `<tr><td colspan="2" style="${T}padding-left:30px;color:#9a9a9a;font-size:10px;">${esc([trace(p), why(p)].filter(Boolean).join(' · '))}</td></tr>` : ''}`
  }
  // the barcode: the weekend's dates as bars — cell widths from the digits, black on paper
  const digits = `${dSat ? '' : ''}${String(now.getFullYear())}${nn(now.getMonth() + 1)}${nn(now.getDate())}3101`.split('').map(Number)
  const bars = digits.flatMap((d) => [1 + (d % 3), 1 + ((d * 7) % 3), 1 + ((d * 3) % 2), 2]).map((w, i) => `<td width="${w}" bgcolor="${i % 2 ? PAPER : INK}" style="width:${w}px;height:38px;background:${i % 2 ? PAPER : INK};font-size:0;line-height:0;">&nbsp;</td>`).join('')
  const total = 1 + sat.length + sun.length
  const rows = `
    <tr><td bgcolor="${PAPER}" style="background:${PAPER};padding:26px 22px 24px;border-top:3px dashed #d2d0c8;border-bottom:3px dashed #d2d0c8;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${centre(`<span style="font:700 18px/1.2 ${MONO};letter-spacing:.2em;">WKNDR</span>`)}
      ${centre('PICKS OF THE WEEKEND')}
      ${centre('AMSTERDAM &nbsp;·&nbsp; NL', 'color:#6a6a6a;')}
      <tr><td colspan="2" style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
      ${rule()}
      ${kv('PRINTED', esc(stamp(now)).toUpperCase())}
      ${kv('WEEKEND', esc(span).toUpperCase())}
      ${kv('FORECAST', 'OPEN-METEO')}
      ${rule()}
      ${dSat ? kv(`SAT &nbsp;${deg(dSat.hi)}`, esc(dayWords(dSat).split('.')[0]).toUpperCase()) : ''}
      ${dSun ? kv(`SUN &nbsp;${deg(dSun.hi)}`, esc(dayWords(dSun).split('.')[0]).toUpperCase()) : ''}
      ${centre(`<span style="font-size:11px;color:#6a6a6a;">${c.strong.toUpperCase()}</span>`, 'padding-top:6px;')}
      ${rule('=')}
      <tr><td style="${T}color:#9a9a9a;font-size:10px;padding-top:4px;">ITEM</td><td align="right" style="${T}color:#9a9a9a;font-size:10px;padding-top:4px;">WHEN</td></tr>
      ${item(hero, 1, dayOf(hero, now) === 'Sunday' ? 'Sunday' : 'Saturday').replace('<span style="color:#9a9a9a;">01</span>', `<span style="color:${ACCENT};">01</span>`)}
      ${sat.map((p, i) => item(p, i + 2, 'Saturday')).join('')}
      ${sun.map((p, i) => item(p, i + 2 + sat.length, 'Sunday')).join('')}
      <tr><td colspan="2" style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
      ${rule('=')}
      ${kv('ITEMS', String(total))}
      ${kv('MORE ON THE DECK', String(Math.max(0, more)))}
      ${kv('RANKED BY', 'THE SKY, THEN THE HOUR')}
      ${kv('<b>TOTAL</b>', `<b>${total} PICKS</b>`)}
      ${kv('PAID BY', 'THE WEATHER')}
      ${rule()}
      ${centre('*** THANK YOU ***', 'padding-top:8px;')}
      ${centre(`<a href="${APP}" style="color:${INK};border-bottom:1px dotted ${INK};">SAVE WHAT YOU'D GO TO &rarr;</a>`, 'padding-top:4px;')}
      ${centre('SIGN IN ONCE, IT FOLLOWS YOU', 'color:#6a6a6a;font-size:10px;')}
      <tr><td colspan="2" align="center" style="padding:18px 0 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${bars}</tr></table>
        <div style="margin-top:6px;${T}font-size:10px;letter-spacing:.35em;color:#6a6a6a;">${digits.join('')}</div>
      </td></tr>
      </table>
    </td></tr>`
  return frame(rows, { shell: '#d9d6cf', width: 360, preheader: `${hero.title} — ${s.subject}`, layout: 'receipt', footerInk: '#8a8a84' })
}

/* ───────────────────────────────── THE BOARD ───────────────────────────────── */
/** A departures board, the Swiss way: white page, black rules, Helvetica bold, times in red, the
 *  sky as a coloured square per row. Not one photograph. The hero is the first line, bigger. */
function board(s: ReturnType<typeof select>): string {
  const { hero, sat, sun, now, dSat, dSun, more, span, c } = s
  const WHITE = '#ffffff', BLACK = '#111111', GREY = '#6b6b6b'
  const rowOf = (p: Pick, big = false) => {
    const h = hourOf(p, now)
    const d = dayOf(p, now) === 'Sunday' ? dSun : dSat
    const b = band(d?.mode ?? 'WARM')
    return `
        <tr>
          <td class="tm" width="86" valign="top" style="width:86px;padding:${big ? 16 : 13}px 0 ${big ? 18 : 14}px;border-top:${big ? 3 : 1}px solid ${BLACK};font:700 ${big ? 26 : 22}px/1 ${FONT};letter-spacing:-.04em;color:${ACCENT};">${h || `<span style="font-size:10px;letter-spacing:.12em;line-height:${big ? 26 : 22}px;text-transform:uppercase;color:${GREY};">${esc(slotWords(p, now))}</span>`}</td>
          <td valign="top" style="padding:${big ? 16 : 13}px 12px ${big ? 18 : 14}px 0;border-top:${big ? 3 : 1}px solid ${BLACK};">
            <div style="font:700 ${big ? 26 : 17}px/1.08 ${FONT};letter-spacing:${big ? '-.035em' : '-.025em'};color:${BLACK};"><a href="${esc(p.link)}" class="lnk" style="color:${BLACK};">${esc(p.title)}</a></div>
            <div style="margin-top:${big ? 8 : 5}px;font:400 11px/1.45 ${FONT};color:${GREY};">${[meta(p), big ? '' : why(p) ? esc(why(p)) : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
            ${big ? `<div style="margin-top:8px;font:400 14px/1.5 ${FONT};color:${BLACK};">${line(p, 160)}</div>` : ''}
            ${trace(p) ? `<div style="margin-top:6px;font:400 10px/1.4 ${MONO};color:#9a9a9a;">${esc(trace(p))}</div>` : ''}
          </td>
          <td width="14" valign="top" align="right" style="width:14px;padding:${big ? 20 : 17}px 0 0;border-top:${big ? 3 : 1}px solid ${BLACK};"><div style="width:12px;height:12px;background:${b.ink};font-size:0;line-height:0;">&nbsp;</div></td>
        </tr>`
  }
  const dayBand = (name: string, d: WxDay | undefined) => `
        <tr><td colspan="3" bgcolor="${BLACK}" style="background:${BLACK};padding:9px 10px 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font:700 13px/1 ${FONT};letter-spacing:.04em;text-transform:uppercase;color:${WHITE};">${name}</td>
            <td align="right" style="font:700 13px/1 ${FONT};letter-spacing:.02em;color:${WHITE};white-space:nowrap;">${d ? `${deg(d.hi)} &nbsp;<span style="font-weight:400;color:rgba(255,255,255,.7);">${esc(dayWords(d).split('.')[0])}</span>` : ''}</td>
          </tr>
          </table>
        </td></tr>`
  const rows = `
    <tr><td bgcolor="${WHITE}" style="background:${WHITE};padding:24px 26px 26px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="padding-bottom:12px;font:700 20px/1 ${FONT};letter-spacing:-.04em;color:${BLACK};">WKNDR</td>
        <td align="right" valign="bottom" style="padding-bottom:12px;font:400 10px/1 ${FONT};letter-spacing:.18em;text-transform:uppercase;color:${GREY};">Departures &nbsp;·&nbsp; Amsterdam</td>
      </tr>
      <tr><td colspan="2" style="border-top:6px solid ${BLACK};padding-top:16px;">
        <div style="font:700 30px/1.02 ${FONT};letter-spacing:-.04em;color:${BLACK};" class="mid">${c.strong}</div>
        <div style="margin-top:10px;font:400 13px/1.5 ${FONT};color:${GREY};">${esc(span)} &nbsp;·&nbsp; ${[dSat ? `Sat ${Math.round(dSat.hi)}°` : '', dSun ? `Sun ${Math.round(dSun.hi)}°` : ''].filter(Boolean).join(', ')} &nbsp;·&nbsp; ${c.soft}</div>
      </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
      <tr>
        <td style="padding-bottom:6px;font:400 9px/1 ${FONT};letter-spacing:.2em;text-transform:uppercase;color:${GREY};">Time</td>
        <td style="padding-bottom:6px;font:400 9px/1 ${FONT};letter-spacing:.2em;text-transform:uppercase;color:${GREY};">Pick &nbsp;·&nbsp; where &nbsp;·&nbsp; price</td>
        <td align="right" style="padding-bottom:6px;font:400 9px/1 ${FONT};letter-spacing:.2em;text-transform:uppercase;color:${GREY};">Sky</td>
      </tr>
      ${dayBand(dayOf(hero, now) === 'Sunday' ? 'Sunday · the one to book' : 'Saturday · the one to book', dayOf(hero, now) === 'Sunday' ? dSun : dSat)}
      ${rowOf(hero, true)}
      ${sat.length ? dayBand('Saturday', dSat) + sat.map((p) => rowOf(p)).join('') : ''}
      ${sun.length ? dayBand('Sunday', dSun) + sun.map((p) => rowOf(p)).join('') : ''}
      <tr><td colspan="3" style="border-top:3px solid ${BLACK};padding-top:16px;">
        <a href="${APP}" style="font:700 15px/1.2 ${FONT};letter-spacing:-.02em;color:${ACCENT};">${more > 0 ? `${more} more on the deck` : 'Open the deck'} &nbsp;&rarr;</a>
        <div style="margin-top:10px;font:400 10px/1.5 ${MONO};color:#9a9a9a;">all times local &nbsp;·&nbsp; forecast open-meteo, read ${esc(stamp(now)).toLowerCase()} &nbsp;·&nbsp; ranked by the sky, then the hour &nbsp;·&nbsp; square = the day's weather mode</div>
      </td></tr>
      </table>
    </td></tr>`
  return frame(rows, { shell: '#e4e4e4', preheader: `${hero.title} — ${s.subject}`, layout: 'board', footerInk: '#6b6b6b', extraCss: `    .tm{width:66px!important;font-size:18px!important}\n    .mid{font-size:25px!important}` })
}

/* ───────────────────────────────── THE POSTCARD ───────────────────────────────── */
/** A postcard on a desk. The front: the hero photograph in a white print border with a caption.
 *  The back: cream card, a handwritten note on the left naming the weekend's picks as a sentence
 *  per day, a stamp with the temperature and a postmark on the right, three address rules. */
function postcard(s: ReturnType<typeof select>): string {
  const { hero, sat, sun, now, dSat, dSun, more, c } = s
  const CARD = '#fbf7ee', INK = '#2a2622', RULE = '#d9d2c2', HAND = `'Snell Roundhand','Apple Chancery','Segoe Script','Bradley Hand',cursive`
  const dHero = dayOf(hero, now) === 'Sunday' ? dSun : dSat
  const bHero = band(dHero?.mode ?? 'WARM')
  const front = hero.image
    ? `<img src="${esc(cut(hero, 1144, 800))}" width="572" alt="${esc(hero.title)}" style="display:block;width:100%;max-width:572px;height:auto;border:0;background:${bHero.bg};color:${bHero.ink};font:400 14px/1.4 ${FONT};">`
    : `<div style="height:300px;background:${bHero.bg};font:400 160px/300px ${FONT};letter-spacing:-.05em;color:${bHero.ink};text-align:center;">${esc((hero.title.trim()[0] || '·').toUpperCase())}</div>`
  const a = (p: Pick) => `<a href="${esc(p.link)}" style="color:${INK};border-bottom:1px solid ${ACCENT};">${esc(p.title)}</a>`
  const sentence = (list: Pick[]) => list.map((p, i) => {
    const h = hourOf(p, now)
    const bit = `${a(p)}${h ? ` at ${h}` : ''}${realVenue(p) ? ` (${esc(realVenue(p))})` : ''}`
    return i === 0 ? bit : i === list.length - 1 ? ` and ${bit}` : `, ${bit}`
  }).join('')
  const noteLines = [
    `Dear you,`,
    `${c.strong.replace(/&deg;/g, '°')} ${c.soft}`,
    `The one I'd book: ${a(hero)}${hourOf(hero, now) ? `, ${dayOf(hero, now) === 'Both days' ? 'either day' : dayOf(hero, now)} at ${hourOf(hero, now)}` : ''}${realVenue(hero) ? ` at ${esc(realVenue(hero))}` : ''}. ${line(hero, 110)}`,
    sat.length ? `Saturday: ${sentence(sat)}.` : '',
    sun.length ? `Sunday: ${sentence(sun)}.` : '',
    `Wish you were here. Well — you are.`,
  ].filter(Boolean)
  const rows = `
    <tr><td style="padding:0 0 14px;font:400 10px/1 ${FONT};letter-spacing:.2em;text-transform:uppercase;color:#6d6659;">WKNDR &nbsp;·&nbsp; a postcard from the weekend</td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:14px 14px 12px;">
      <a href="${esc(hero.link)}" class="lnk" style="display:block;">${front}</a>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:10px;">
      <tr>
        <td style="font:400 11px/1.4 ${FONT};color:#444;">${esc(hero.title)}${realVenue(hero) ? ` &nbsp;·&nbsp; ${esc(realVenue(hero))}` : ''}</td>
        <td align="right" style="font:400 10px/1.4 ${MONO};color:#9a958a;white-space:nowrap;">${esc(trace(hero))}</td>
      </tr>
      </table>
    </td></tr>
    <tr><td style="height:22px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td bgcolor="${CARD}" style="background:${CARD};padding:22px 22px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td class="stack" width="56%" valign="top" style="width:56%;padding-right:18px;">
          ${noteLines.map((l, i) => `<p style="margin:${i ? 10 : 0}px 0 0;font:400 ${i === 0 ? 20 : 17}px/1.45 ${HAND};color:${INK};">${l}</p>`).join('')}
          <p style="margin:16px 0 0;font:400 17px/1.45 ${HAND};color:${INK};">— WKNDR</p>
        </td>
        <td class="stack-gap" width="1" style="width:1px;border-left:1px solid ${RULE};font-size:0;line-height:0;">&nbsp;</td>
        <td class="stack" width="42%" valign="top" style="width:42%;padding-left:18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td align="right">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed #b9ad98;padding:3px;">
            <tr><td bgcolor="${bHero.bg}" align="center" style="background:${bHero.bg};width:66px;height:78px;border:3px solid #ffffff;">
              <div style="font:400 9px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${bHero.ink};">Amsterdam</div>
              <div style="margin-top:8px;font:400 30px/1 ${FONT};letter-spacing:-.04em;color:${bHero.ink};">${dHero ? deg(dHero.hi) : '&nbsp;'}</div>
              <div style="margin-top:8px;font:400 7px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${bHero.ink};">WKNDR post</div>
            </td></tr>
            </table>
          </td></tr>
          <tr><td align="right" style="padding-top:8px;font:400 9px/1.4 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:#8b8577;">Amsterdam &nbsp;·&nbsp; ${esc(stamp(now))}</td></tr>
          <tr><td style="padding-top:26px;font:400 12px/2.4 ${FONT};color:${INK};border-bottom:1px solid ${RULE};">To: you</td></tr>
          <tr><td style="font:400 12px/2.4 ${FONT};color:${INK};border-bottom:1px solid ${RULE};">${esc(s.span)}</td></tr>
          <tr><td style="font:400 12px/2.4 ${FONT};color:${INK};border-bottom:1px solid ${RULE};">${[dSat ? `Sat ${Math.round(dSat.hi)}°` : '', dSun ? `Sun ${Math.round(dSun.hi)}°` : ''].filter(Boolean).join(', ')}${dSat ? `, ${esc(dayWords(dSat).split('.')[0]).toLowerCase()}` : ''}</td></tr>
          <tr><td style="padding-top:22px;font:400 11px/1.5 ${FONT};color:#6d6659;">P.S. <a href="${APP}" style="color:${INK};border-bottom:1px solid ${ACCENT};">${more > 0 ? `${more} more on the deck` : 'the deck'}</a> — save what you'd go to; sign in once and it follows you.</td></tr>
          </table>
        </td>
      </tr>
      </table>
    </td></tr>`
  return frame(rows, { shell: '#cfc6b5', preheader: `${hero.title} — ${s.subject}`, layout: 'postcard', footerInk: '#6d6659', extraCss: `    .stack-gap{border:0!important}` })
}

/* ───────────────────────────────── THE NOTE ───────────────────────────────── */
/** A plain email from a friend. White page, one column, the system font at 16px, no mast, no
 *  card, no numbers, no pictures: the weekend as prose, a line per pick, the links in it. */
function note(s: ReturnType<typeof select>): string {
  const { hero, sat, sun, now, dSat, dSun, more, c } = s
  const SYS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`
  const INK = '#222222', P = `margin:0 0 18px;font:400 16px/1.6 ${SYS};color:${INK};`
  const a = (p: Pick) => `<a href="${esc(p.link)}" class="ink" style="color:${INK};text-decoration:underline;">${esc(p.title)}</a>`
  const pickLine = (p: Pick) => {
    const h = hourOf(p, now)
    const tail = [h || slotWords(p, now), realVenue(p), p.price].filter(Boolean).map(esc).join(', ')
    const l = line(p, 90)
    return `<p class="ink" style="${P}margin-bottom:12px;">${a(p)}${tail ? ` — ${tail}` : ''}.${l ? ` ${l}` : ''}${trace(p) ? ` <span class="ink3" style="color:#777;">(${esc(trace(p))})</span>` : ''}</p>`
  }
  const sky = [dSat ? `${Math.round(dSat.hi)}° on Saturday, ${dayWords(dSat).split('.')[0].toLowerCase()}` : '', dSun ? `${Math.round(dSun.hi)}° on Sunday, ${dayWords(dSun).split('.')[0].toLowerCase()}` : ''].filter(Boolean).join('; ')
  const rows = `
    <tr><td class="pad" style="padding:0 30px;">
      <p class="ink" style="${P}">Hi,</p>
      <p class="ink" style="${P}">${c.strong.replace(/&deg;/g, '°')} ${esc(sky)}${sky ? '.' : ''} ${c.soft}</p>
      <p class="ink" style="${P}">The one I'd book: ${a(hero)}${hourOf(hero, now) ? `, ${dayOf(hero, now) === 'Both days' ? 'either day' : dayOf(hero, now)} at ${hourOf(hero, now)}` : ''}${realVenue(hero) ? ` at ${esc(realVenue(hero))}` : ''}${hero.price ? ` (${esc(hero.price)})` : ''}. ${line(hero, 200)}${trace(hero) ? ` <span class="ink3" style="color:#777;">(${esc(trace(hero))})</span>` : ''}</p>
      ${sat.length ? `<p class="ink" style="${P}margin-bottom:10px;"><b>Saturday</b></p>${sat.map(pickLine).join('')}` : ''}
      ${sun.length ? `<p class="ink" style="${P}margin:${sat.length ? 8 : 0}px 0 10px;"><b>Sunday</b></p>${sun.map(pickLine).join('')}` : ''}
      <p class="ink" style="${P}margin-top:8px;">${more > 0 ? `There are ${more} more on the deck, sorted the same way` : 'The rest is on the deck'}: <a href="${APP}" class="ink" style="color:${INK};text-decoration:underline;">app.wkndr.xyz</a>. Save what you'd go to; sign in once and it follows you.</p>
      <p class="ink" style="${P}margin-bottom:4px;">— WKNDR</p>
      <p class="ink3" style="${P}font-size:13px;color:#777;">Amsterdam, ${esc(stamp(now))}. Forecast from Open-Meteo.</p>
    </td></tr>`
  return frame(rows, { shell: '#ffffff', preheader: `${hero.title} — ${s.subject}`, layout: 'note', footerInk: '#777777', footerRule: '#e6e6e6' })
}

export function radicalHtml(picks: Pick[], wx: Wx | null, opts: RadicalOpts): { html: string; hero: Pick; sat: Pick[]; sun: Pick[]; subject: string; layout: RadicalLayout } {
  const s = select(picks, wx, opts)
  const html = { poster, receipt, board, postcard, note }[opts.layout](s)
  return { html, hero: s.hero, sat: s.sat, sun: s.sun, subject: s.subject, layout: opts.layout }
}
