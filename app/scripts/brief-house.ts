/**
 * THE HOUSE FOUR — four Friday briefs in WKNDR's own design language (Ness, 2026-10-30: "the design
 * language for WKNDR is pretty straightforward … the unfurl felt great — you don't need to make this
 * radical. 3–4 designs, mobile and desktop, in the language").
 *
 * The language, as the unfurl (`poster.ts` og/across) and the weekend poster (og/list) set it:
 *   - the wordmark WKNDR with its orange dot
 *   - Clash Display 600 for the one display line (Helvetica bold where the font can't load)
 *   - the weekend's SKY as the field (the atmosphere plate the unfurl uses, a flat colour under it)
 *   - photographs as rounded cards wearing the app's own furniture: the date CHIP top-left, the title
 *     and venue on a dark footer
 *   - orange numbers, cream paper, hairlines, the forecast as "13° and cloudy"
 *
 * Four arrangements of that one language, each with a desktop shape and a phone shape:
 *   list    the weekend poster as mail — the date big, numbered rows with rounded thumbs
 *   sky     the unfurl as mail — the sky field with the display line, three cards across, then rows
 *   deck    the app's own cards — the hero as one big card, the rest two across, all with chips
 *   panel   the brand panel left in the sky's colour, the picks as rows on the right; stacks on a phone
 *
 * Same data and rules as every other template (list/README.md). The plates are served through the
 * same image proxy as the photographs, from the repo's own files, so no deploy is waited on.
 */
import { weekendSky, weekendWords, OG_SKIES, type Wx, type WxDay } from './poster'
import { whenWeekendDays, fixWhen } from '../src/lib/when'
import type { Pick } from '../src/types'
import { APP, FONT, MONO, esc, deg, cut, weekendDays, slot, line, dayWords, band, trace, selectWeekend, realVenue as realVenueOf } from './lib/brief-shared'

const realVenue = (p: Pick) => { const v = realVenueOf(p); return v.trim().length < 3 ? '' : v }

export type HouseLayout = 'list' | 'sky' | 'deck' | 'panel'
export const HOUSE_LAYOUTS: Record<HouseLayout, { name: string; bet: string }> = {
  list:  { name: 'The List',  bet: 'the weekend poster as mail — the date big in the display face, orange numbers, rounded thumbs, one list in the deck\'s order' },
  sky:   { name: 'The Sky',   bet: 'the unfurl as mail — the sky field with the display line, the front three as cards across, the rest as rows' },
  deck:  { name: 'The Deck',  bet: 'the app\'s own cards — the hero as one big card, the rest two across, every one with its date chip and dark footer' },
  panel: { name: 'The Panel', bet: 'a brand panel in the sky\'s colour down the left, the picks as rows on the right; the panel becomes the header on a phone' },
}
export interface HouseOpts { hero?: string; per?: number; now?: Date; weekendLabel?: string; layout: HouseLayout }

const PAPER = '#faf8f3', INK = '#1a1a1a', INK3 = '#8b8a82', HAIR = '#e7e3d8', ACCENT = '#ff4d1f', SHELL = '#eceae3'
const DISPLAY = `'Clash Display','Helvetica Neue',Helvetica,Arial,sans-serif`
const CLASH = '<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap">'
/** The sky plate the unfurl uses, through the image proxy from the repo's own file (jpg for every client). */
const plateUrl = (sky: keyof typeof OG_SKIES, w: number, h: number) =>
  `https://images.weserv.nl/?url=${encodeURIComponent(`raw.githubusercontent.com/nessim-higson/wkndr/main/app/src/assets/atmosphere/${OG_SKIES[sky].plate}`)}&w=${w}&h=${h}&fit=cover&a=center&output=jpg&q=80`

function dayOf(p: Pick, now: Date): 'Saturday' | 'Sunday' | 'Both days' {
  const { satD, sunD } = weekendDays(now)
  const d = whenWeekendDays(p.when, satD, sunD, now)
  return d.sat && !d.sun ? 'Saturday' : d.sun && !d.sat ? 'Sunday' : 'Both days'
}
const hourOf = (p: Pick, now: Date) => { const s = slot(p, now); return /·/.test(s.text) ? s.text.split('·').pop()!.replace(/&nbsp;/g, '').trim() : '' }
/** The app's chip text: "Sat 31 Oct · 12:00". */
const chipText = (p: Pick) => esc(fixWhen(p.when || '').split(' · ').slice(0, 2).join(' · '))
/** The meta line under a title: "Handelsplein · Sat 31 Oct · 12:00". */
const metaLine = (p: Pick) => [realVenue(p), fixWhen(p.when || '')].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')
/** "13° and cloudy" — the unfurl's line. A line per day when the two days differ. */
function skyLine(wx: Wx | null): string {
  if (!wx?.days.length) return ''
  const [a, b] = wx.days
  const split = b && (a.mode !== b.mode || Math.abs(a.hi - b.hi) >= 4)
  return split ? wx.days.map((d) => `${d.label} ${Math.round(d.hi)}° and ${weekendWords([d])}`).join(' · ') : `${Math.round(Math.max(...wx.days.map((d) => d.hi)))}° and ${weekendWords(wx.days)}`
}
/** The wordmark: WKNDR with the orange dot after it, as the unfurl sets it. */
const mark = (color = INK, size = 15) => `<span style="font:700 ${size}px/1 ${FONT};letter-spacing:-.02em;color:${color};">WKNDR</span><span style="display:inline-block;width:${Math.round(size * .4)}px;height:${Math.round(size * .4)}px;border-radius:50%;background:${ACCENT};vertical-align:top;margin:0 0 0 2px;font-size:0;line-height:0;">&nbsp;</span>`

/* ─────────────────────────── the app's card furniture ─────────────────────────── */

/** A pick as the app's card: the photograph as a td background (flat fallback), the date chip
 *  top-left, the title and venue on a dark footer. `w`×`h` is the box; the image is cut at 2×. */
function card(p: Pick, w: number, h: number, now: Date, opts: { title: number; radius?: number; cls?: string; venue?: boolean; n?: number } ): string {
  const r = opts.radius ?? 20
  const b = band((dayOf(p, now) === 'Sunday' ? 'COOL' : 'WARM'))
  const bg = p.image ? `background="${esc(cut(p, w * 2, h * 2))}" style="background:${INK} url('${esc(cut(p, w * 2, h * 2))}') center/cover no-repeat;` : `style="background:${b.bg};`
  const chip = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:5px 9px;border-radius:8px;background:rgba(28,42,51,.82);font:400 11px/1.2 ${FONT};color:#ffffff;white-space:nowrap;">${chipText(p)}</td></tr></table>`
  const num = opts.n != null ? `<span style="color:${ACCENT};">${opts.n}</span>&nbsp; ` : ''
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="${opts.cls ?? ''}" style="border-radius:${r}px;overflow:hidden;">
            <tr><td class="cd" width="${w}" height="${h}" valign="top" ${bg}width:${w}px;height:${h}px;border-radius:${r}px;overflow:hidden;">
              <a href="${esc(p.link)}" style="display:block;color:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" height="${h}" style="height:${h}px;">
              <tr><td valign="top" style="padding:12px;">${chip}</td></tr>
              <tr><td valign="bottom" style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:14px 14px 13px;background:rgba(11,29,56,.78);">
                  <div class="ct" style="font:600 ${opts.title}px/1.1 ${DISPLAY};letter-spacing:-.02em;color:#ffffff;">${num}${esc(p.title)}</div>
                  ${opts.venue !== false && realVenue(p) ? `<div style="margin-top:5px;font:400 12px/1.3 ${FONT};color:rgba(255,255,255,.88);">${esc(realVenue(p))}</div>` : ''}
                </td></tr></table>
              </td></tr>
              </table>
              </a>
            </td></tr>
            </table>`
}

/** The poster's row: orange number, a rounded square thumb, the title in the display face, the meta. */
function row(p: Pick, n: number, now: Date, size: number, titlePx: number, last: boolean, pad = 34): string {
  const thumb = p.image
    ? `<a href="${esc(p.link)}" class="lnk" style="display:block;"><img class="th" src="${esc(cut(p, size * 2, size * 2))}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border:0;border-radius:${Math.round(size * .12)}px;background:${HAIR};"></a>`
    : `<div class="th np" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * .12)}px;background:${band('WARM').bg};font:600 ${Math.round(size * .44)}px/${size}px ${DISPLAY};color:${band('WARM').ink};text-align:center;">${esc((p.title.trim()[0] || '·').toUpperCase())}</div>`
  return `
        <tr><td class="pad" style="padding:0 ${pad}px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${last ? '' : `border-bottom:1px solid ${HAIR};`}" class="${last ? '' : 'hairb'}">
          <tr>
            <td class="num" width="34" valign="middle" style="width:34px;padding:14px 0;font:600 ${Math.round(titlePx * .95)}px/1 ${DISPLAY};color:${ACCENT};">${n}</td>
            <td class="thc" width="${size}" valign="middle" style="width:${size}px;padding:14px 16px 14px 0;">${thumb}</td>
            <td valign="middle" style="padding:14px 0;">
              <div class="ink" style="font:600 ${titlePx}px/1.12 ${DISPLAY};letter-spacing:-.02em;color:${INK};"><a href="${esc(p.link)}" class="ink lnk" style="color:${INK};">${esc(p.title)}</a></div>
              <div class="ink3" style="margin-top:5px;font:400 12.5px/1.4 ${FONT};color:${INK3};">${metaLine(p)}</div>
              ${trace(p) ? `<div class="ink3" style="margin-top:5px;font:400 10px/1.4 ${MONO};color:${INK3};">${esc(trace(p))}</div>` : ''}
            </td>
          </tr>
          </table>
        </td></tr>`
}
/** A thin day marker between rows: "Saturday · 12° cloudy but dry". */
const dayMark = (name: string, d: WxDay | undefined, pad = 34) => `
        <tr><td class="pad" style="padding:22px ${pad}px 2px;">
          <div class="ink3" style="font:400 10px/1 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${INK3};">${name}${d ? ` &nbsp;·&nbsp; <span style="color:${band(d.mode).ink};">${deg(d.hi)} ${esc(dayWords(d).split('.')[0]).toLowerCase()}</span>` : ''}</div>
        </td></tr>`

const ctaRow = (more: number, pad = 34) => `
        <tr><td class="pad" style="padding:26px ${pad}px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:3px solid ${INK};" class="ruleb">
          <tr>
            <td style="padding-top:16px;font:700 15px/1.2 ${FONT};letter-spacing:-.02em;"><a href="${APP}" class="ink" style="color:${INK};">${more > 0 ? `${more} more on the deck` : 'Open the deck'} &nbsp;&rarr;</a></td>
            <td align="right" style="padding-top:16px;font:400 13px/1.2 ${FONT};color:${INK3};" class="ink3">Swipe. Save. Match.</td>
          </tr>
          </table>
        </td></tr>`

/* ─────────────────────────────────── the document ─────────────────────────────────── */

function frame(rows: string, layout: HouseLayout, preheader: string, extraCss = ''): string {
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
  /* Written by app/scripts/brief-house.ts — ${HOUSE_LAYOUTS[layout].name} (${layout}): ${HOUSE_LAYOUTS[layout].bet}. */
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;outline:0;line-height:100%;text-decoration:none}
  a{text-decoration:none}
  .lnk:hover{opacity:.75!important}
  @media (max-width:480px){
    .shell{width:100%!important}
    .pad{padding-left:18px!important;padding-right:18px!important}
    .stack{display:block!important;width:100%!important;max-width:100%!important}
    .stack-gap{height:14px!important;line-height:14px!important;font-size:0!important;display:block!important;width:100%!important}
    .num{width:26px!important}
${extraCss}
  }
  @media (prefers-color-scheme:dark){
    .bg{background:#141312!important}
    .card{background:#1c1a18!important}
    .ink{color:#f4f1ea!important}
    .ink3{color:#9a978d!important}
    .hairb{border-bottom-color:#2e2b27!important}
    .ruleb{border-top-color:#f4f1ea!important}
    .np{background:#262320!important}
  }
  [data-ogsc] .bg{background:#141312!important}
  [data-ogsc] .card{background:#1c1a18!important}
  [data-ogsc] .ink{color:#f4f1ea!important}
  [data-ogsc] .ink3{color:#9a978d!important}
  [data-ogsc] .hairb{border-bottom-color:#2e2b27!important}
  [data-ogsc] .ruleb{border-top-color:#f4f1ea!important}
  [data-ogsc] .np{background:#262320!important}
</style>
</head>
<body class="bg" style="margin:0;padding:0;width:100%;background:${SHELL};">

<div style="display:none;font-size:1px;color:${SHELL};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${esc(preheader)}
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SHELL};" class="bg">
<tr><td align="center" style="padding:26px 12px 40px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="shell" style="width:100%;max-width:600px;">
    <tr><td class="card" style="background:${PAPER};border-radius:16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:16px;overflow:hidden;">
${rows}
      </table>
    </td></tr>

    <tr><td class="pad" style="padding:22px 30px 0;">
      <div class="ink3" style="font:400 12px/1.65 ${FONT};color:${INK3};">
        You asked for the WKNDR Friday brief. One email a week, Amsterdam only. Every pick links to the organiser; we never resell a ticket.<br>
        <a href="{{unsub}}" style="color:${INK3};border-bottom:1px solid #cfcbc0;">Unsubscribe</a>
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

/** The source trace under a card: mono, tiny, the publication(s) — the one line a card's footer has no room for. */
const traceUnder = (p: Pick) => trace(p) ? `<div class="ink3" style="margin:7px 2px 0;font:400 10px/1.4 ${MONO};color:${INK3};">${esc(trace(p))}</div>` : ''

/* ───────────────────────────────── THE LIST ───────────────────────────────── */
function list(s: ReturnType<typeof selectWeekend>, wx: Wx | null): string {
  const { hero, sat, sun, now, dSat, dSun, more } = s
  const dateBig = esc((wx?.label ?? s.span).replace(/^Sat /, '').replace(/ – (Sun )?/, ' – ')).replaceAll(' ', '&nbsp;')
  const head = `
        <tr><td class="pad" style="padding:30px 34px 0;">
          ${mark(INK, 15)}
          <div class="ink big" style="margin-top:26px;font:600 46px/1 ${DISPLAY};letter-spacing:-.015em;color:${INK};">${dateBig}</div>
          <div style="margin-top:10px;font:700 17px/1.2 ${FONT};color:${ACCENT};">${esc(skyLine(wx))}</div>
          <div class="ink3" style="margin-top:8px;font:400 14px/1.5 ${FONT};color:${INK3};">${s.c.strong} ${s.c.soft}</div>
          <div style="height:3px;background:${INK};margin-top:22px;font-size:0;line-height:0;" class="rule">&nbsp;</div>
        </td></tr>`
  let n = 0
  const rowsOf = (listOf: Pick[], lastOfAll: boolean) => listOf.map((p, i) => row(p, ++n, now, 96, 20, lastOfAll && i === listOf.length - 1)).join('')
  const body = row(hero, ++n, now, 96, 20, false)
    + (sat.length ? dayMark('Saturday', dSat) + rowsOf(sat, !sun.length) : '')
    + (sun.length ? dayMark('Sunday', dSun) + rowsOf(sun, true) : '')
  return frame(head + body + ctaRow(more), 'list', `${hero.title} — ${s.subject}`, `    .big{font-size:36px!important}\n    .th{width:72px!important;height:72px!important}\n    .thc{width:72px!important;padding-right:12px!important}`)
}

/* ───────────────────────────────── THE SKY ───────────────────────────────── */
function sky(s: ReturnType<typeof selectWeekend>, wx: Wx | null): string {
  const { hero, sat, sun, now, dSat, dSun, more } = s
  const k = weekendSky(wx?.days)
  const S = OG_SKIES[k]
  const light = S.ink === 'light'
  const ink = light ? '#ffffff' : '#172a35', mute = light ? 'rgba(255,255,255,.78)' : 'rgba(23,42,53,.7)'
  const plate = plateUrl(k, 1200, 640)
  const words = skyLine(wx)
  const field = `
        <tr><td class="field" background="${esc(plate)}" bgcolor="${S.flat}" style="background:${S.flat} url('${esc(plate)}') center/cover no-repeat;padding:30px 34px 34px;">
          ${mark(ink, 15)}
          <div class="disp" style="margin-top:34px;font:600 40px/.98 ${DISPLAY};letter-spacing:-.025em;color:${ink};">Your weekend,<br><span style="color:${ACCENT};">${esc(words.split(' and ')[0] || 'this weekend')}</span> and ${esc(words.split(' and ').slice(1).join(' and ') || 'ready')}.</div>
          <div style="margin-top:16px;font:400 14px/1.45 ${FONT};color:${ink};">Amsterdam &nbsp;·&nbsp; ${esc(s.span)}<br><span style="color:${mute};">${s.c.strong}</span></div>
        </td></tr>`
  const front = [hero, ...sat, ...sun].slice(0, 3)
  const across = `
        <tr><td class="pad" style="padding:18px 18px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>${front.map((p, i) => `
            <td class="stack" width="33%" valign="top" style="width:33%;padding:0 ${i === 2 ? 0 : 6}px 0 ${i === 0 ? 0 : 6}px;">${card(p, 180, 240, now, { title: 15, radius: 18, cls: 'fc' })}${traceUnder(p)}</td>`).join('')}
          </tr>
          </table>
        </td></tr>`
  const rest = [...sat, ...sun].filter((p) => !front.includes(p))
  let n = 3
  const restRows = rest.length ? `
        <tr><td class="pad" style="padding:24px 34px 0;">
          <div class="ink3" style="font:400 10px/1 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${INK3};">Also this weekend</div>
        </td></tr>` + rest.map((p, i) => row(p, ++n, now, 64, 17, i === rest.length - 1)).join('') : ''
  return frame(field + across + restRows + ctaRow(more), 'sky', `${hero.title} — ${s.subject}`, `    .disp{font-size:34px!important}\n    .fc td.cd{width:100%!important;height:200px!important}\n    .stack{padding:0 0 12px!important}\n    .th{width:56px!important;height:56px!important}\n    .thc{width:56px!important;padding-right:12px!important}`)
}

/* ───────────────────────────────── THE DECK ───────────────────────────────── */
function deck(s: ReturnType<typeof selectWeekend>, wx: Wx | null): string {
  const { hero, sat, sun, now, dSat, dSun, more } = s
  const head = `
        <tr><td class="pad" style="padding:28px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td>${mark(INK, 15)}</td>
            <td align="right" class="ink3" style="font:400 12px/1.2 ${FONT};color:${INK3};">${esc(s.span)} &nbsp;·&nbsp; <span style="color:${ACCENT};font-weight:700;">${esc(skyLine(wx))}</span></td>
          </tr>
          </table>
          <div class="ink disp" style="margin-top:22px;font:600 30px/1.05 ${DISPLAY};letter-spacing:-.025em;color:${INK};">${s.c.strong}</div>
        </td></tr>
        <tr><td class="pad" style="padding:18px 34px 0;">${card(hero, 532, 400, now, { title: 26, radius: 22, cls: 'hc', n: 1 })}${traceUnder(hero)}</td></tr>`
  let n = 1
  const pairs = (listOf: Pick[]) => {
    const out: string[] = []
    for (let i = 0; i < listOf.length; i += 2) {
      const a = listOf[i], z = listOf[i + 1]
      out.push(`
        <tr><td class="pad" style="padding:12px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="50%" valign="top" style="width:50%;padding-right:6px;">${card(a, 260, 300, now, { title: 16, radius: 18, cls: 'sc', n: ++n })}${traceUnder(a)}</td>
            <td width="50%" valign="top" style="width:50%;padding-left:6px;">${z ? card(z, 260, 300, now, { title: 16, radius: 18, cls: 'sc', n: ++n }) + traceUnder(z) : '&nbsp;'}</td>
          </tr>
          </table>
        </td></tr>`)
    }
    return out.join('')
  }
  const body = (sat.length ? dayMark('Saturday', dSat) + pairs(sat) : '') + (sun.length ? dayMark('Sunday', dSun) + pairs(sun) : '')
  return frame(head + body + ctaRow(more), 'deck', `${hero.title} — ${s.subject}`, `    .disp{font-size:25px!important}\n    .hc td.cd{width:100%!important;height:300px!important}\n    .sc td.cd{width:100%!important;height:210px!important}\n    .sc .ct{font-size:14px!important}`)
}

/* ───────────────────────────────── THE PANEL ───────────────────────────────── */
function panel(s: ReturnType<typeof selectWeekend>, wx: Wx | null): string {
  const { hero, sat, sun, now, dSat, dSun, more } = s
  const k = weekendSky(wx?.days)
  const S = OG_SKIES[k]
  const light = S.ink === 'light'
  const ink = light ? '#ffffff' : '#172a35', mute = light ? 'rgba(255,255,255,.75)' : 'rgba(23,42,53,.66)'
  const plate = plateUrl(k, 440, 1200)
  const dateBig = esc((wx?.label ?? s.span).replace(/^Sat /, '').replace(/ – (Sun )?/, ' –<br>')).replaceAll(' ', '&nbsp;').replace('&lt;br&gt;', '<br>')
  let n = 0
  const rows = row(hero, ++n, now, 64, 17, false, 22)
    + (sat.length ? dayMark('Saturday', dSat, 22) + sat.map((p, i) => row(p, ++n, now, 64, 17, !sun.length && i === sat.length - 1, 22)).join('') : '')
    + (sun.length ? dayMark('Sunday', dSun, 22) + sun.map((p, i) => row(p, ++n, now, 64, 17, i === sun.length - 1, 22)).join('') : '')
  const body = `
        <tr><td style="padding:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td class="stack pnl" width="200" valign="top" background="${esc(plate)}" bgcolor="${S.flat}" style="width:200px;background:${S.flat} url('${esc(plate)}') center/cover no-repeat;padding:28px 22px 30px;">
              ${mark(ink, 15)}
              <div style="margin-top:26px;font:400 10px/1 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${mute};">This weekend in Amsterdam</div>
              <div class="disp" style="margin-top:12px;font:600 34px/1 ${DISPLAY};letter-spacing:-.015em;color:${ink};">${dateBig}</div>
              <div style="margin-top:14px;font:700 16px/1.3 ${FONT};color:${ACCENT};">${esc(skyLine(wx)).replace(' · ', '<br>')}</div>
              <div style="margin-top:10px;font:400 12.5px/1.5 ${FONT};color:${ink};">${s.c.strong}</div>
              <div style="margin-top:28px;font:700 13px/1 ${FONT};letter-spacing:-.01em;color:${ink};"><a href="${APP}" style="color:${ink};">app.wkndr.xyz</a></div>
            </td>
            <td class="stack" valign="top" style="padding:14px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${rows}
              ${ctaRow(more, 22)}
              </table>
            </td>
          </tr>
          </table>
        </td></tr>`
  return frame(body, 'panel', `${hero.title} — ${s.subject}`, `    .pnl{padding:24px 18px 26px!important}\n    .disp{font-size:30px!important}\n    .disp br{display:none}`)
}

export function houseHtml(picks: Pick[], wx: Wx | null, opts: HouseOpts): { html: string; hero: Pick; sat: Pick[]; sun: Pick[]; subject: string; layout: HouseLayout } {
  const s = selectWeekend(picks, wx, opts)
  const html = { list, sky, deck, panel }[opts.layout](s, wx)
  return { html, hero: s.hero, sat: s.sat, sun: s.sun, subject: s.subject, layout: opts.layout }
}
