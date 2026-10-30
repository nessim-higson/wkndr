import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { forecast, assignDays, type Wx, type WxDay } from './poster'
import { fixWhen, upcomingWeekendEnd, whenWeekendDays } from '../src/lib/when'
import type { Pick, Mode } from '../src/types'
import { APP, FONT, esc, deg, coverImage, deckOrder, thisWeekend, slot, clock, line, dayWords, claim, band, realVenue, trsAreLegal } from './lib/brief-shared'
import { picksHtml, PICKS_LAYOUTS, type PicksLayout } from './brief-picks'
import { radicalHtml, RADICAL_LAYOUTS, type RadicalLayout } from './brief-radical'
export { trsAreLegal }

const CITY = process.argv.find((a) => a.startsWith('--city='))?.split('=')[1] ?? 'amsterdam'
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
const PER = Number(arg('per') ?? 3)
const OUT_DIR = join(import.meta.dir, '..', '..', 'list', 'out')

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
  // THE TEMPLATE. `picks` (E, rows — the default since 2026-10-30), `grid` (E, 2-up), `hybrid` (D),
  // or `all` to write every one side by side for comparing (brief.html = picks).
  const TEMPLATE = arg('template') ?? 'picks'
  const want = TEMPLATE === 'all' ? ['picks', ...Object.keys(PICKS_LAYOUTS).filter((l) => l !== 'rows'), 'hybrid', ...Object.keys(RADICAL_LAYOUTS)] : TEMPLATE === 'radical' ? Object.keys(RADICAL_LAYOUTS) : [TEMPLATE]
  const isRadical = (t: string): t is RadicalLayout => t in RADICAL_LAYOUTS
  const key = satIso ?? 'draft'
  mkdirSync(OUT_DIR, { recursive: true })
  let first: ReturnType<typeof briefHtml> | null = null
  for (const t of want) {
    const out = t === 'hybrid'
      ? briefHtml(feed.picks, wx, { hero: arg('hero'), per: Number(arg('per') ?? 3), now, weekendLabel })
      : isRadical(t) ? radicalHtml(feed.picks, wx, { hero: arg('hero'), per: Number(arg('per') ?? 4), now, weekendLabel, layout: t })
      : picksHtml(feed.picks, wx, { hero: arg('hero'), per: Number(arg('per') ?? 4), now, weekendLabel, layout: t === 'picks' ? 'rows' : t as PicksLayout })
    if (!trsAreLegal(out.html)) { console.error(`✖ ${t}: a <tr> sits outside a <table> — the email would silently lose a block`); process.exit(1) }
    const kb = Buffer.byteLength(out.html, 'utf8') / 1024
    if (kb > 100) { console.error(`✖ ${t}: ${kb.toFixed(1)} KB — Gmail clips past 102 KB and hides the unsubscribe link`); process.exit(1) }
    const name = want.length > 1 ? `brief-${t}.html` : `brief-${key}.html`
    writeFileSync(join(OUT_DIR, name), out.html)
    if (!first) { first = out; writeFileSync(join(OUT_DIR, 'brief.html'), out.html) }
    console.log(`✓ brief ${CITY} · ${t} · weekend of ${satIso ?? '?'} · ${wx ? wx.span : 'no forecast'} · ${kb.toFixed(1)} KB · tables legal → list/out/${name}`)
  }
  if (want.length > 1) {
    // THE VARIATIONS PAGE — every template side by side at phone width, captions from the layouts'
    // own bets. list/out/variations.html; open it in the pane and read across.
    const frameOf = (t: string) => {
      const meta = t === 'hybrid' ? { name: 'The Hybrid (D)', bet: 'one photograph on the cover, then two columns of type' } : isRadical(t) ? RADICAL_LAYOUTS[t] : PICKS_LAYOUTS[t === 'picks' ? 'rows' : t as PicksLayout]
      const html = readFileSync(join(OUT_DIR, `brief-${t}.html`), 'utf8')
      const kb = (Buffer.byteLength(html) / 1024).toFixed(1)
      // Inlined as srcdoc, not linked by path: the page then renders from file:// too (a relative
      // iframe src stays blank when the file is opened straight from the folder, not served).
      const doc = html.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
      return `<div class="v"><div class="cap"><b>${t === 'picks' ? 'rows' : t}</b> — ${meta.name}<span>${kb} KB</span><p>${meta.bet}</p></div><iframe srcdoc="${doc}" title="${meta.name}" onload="this.style.height=Math.max(1200,this.contentDocument.documentElement.scrollHeight)+'px'"></iframe></div>`
    }
    // two rows: the radical five (each a different object — poster, receipt, board, postcard, note)
    // above, the picks family (one world, seven arrangements) below.
    const radical = want.filter(isRadical), family = want.filter((t) => !isRadical(t))
    const frames = (radical.length ? `<div class="bar sub"><b>The radical five</b> each a different object: a poster, a receipt, a departures board, a postcard, a plain note</div>\n<div class="row">\n${radical.map(frameOf).join('\n')}\n</div>\n` : '')
      + (family.length ? `<div class="bar sub"><b>The picks family</b> one world, ${family.length} arrangements</div>\n<div class="row">\n${family.map(frameOf).join('\n')}\n</div>` : '')
    writeFileSync(join(OUT_DIR, 'variations.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WKNDR — brief variations</title>
<style>body{margin:0;background:#dcd8cf;font:400 13px/1.45 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a}
.bar{padding:16px 20px;display:flex;gap:14px;align-items:baseline}.bar.sub{padding:6px 20px 12px;font-size:12px;color:#6a655c}.bar.sub b{font-size:13px;color:#1a1a1a}.bar b{font-size:15px}.bar label{font-size:12px;color:#6a655c;cursor:pointer}
.row{display:flex;gap:18px;padding:0 20px 30px;overflow-x:auto;align-items:flex-start}
.v{flex:0 0 auto}.cap{width:390px;padding:0 2px 10px}.cap b{font-size:14px}.cap span{float:right;font:400 11px/1.6 'SF Mono',Menlo,monospace;color:#6a655c}.cap p{margin:4px 0 0;font-size:12px;color:#6a655c}
iframe{display:block;width:390px;height:1700px;border:0;border-radius:14px;background:#eceae3}body.wide iframe,body.wide .cap{width:620px}</style>
<body><div class="bar"><b>WKNDR</b> the Friday brief — ${want.length} variations · ${wx ? wx.span : ''} <label><input type="checkbox" onchange="document.body.classList.toggle('wide',this.checked)"> 600px (desktop mail)</label></div>
${frames}
</body>`)
    console.log(`  → list/out/variations.html (all ${want.length}, side by side)`)
  }
  const { hero, sat, sun, subject } = first!
  console.log(`  cover   ${hero.title} (${hero.when})`)
  console.log(`  sat     ${sat.map((p) => p.title).join(' · ')}`)
  console.log(`  sun     ${sun.map((p) => p.title).join(' · ')}`)
  console.log(`  subject ${subject}`)
  console.log(`  → list/out/brief.html`)
  console.log(`  next:   cd list && bun run scripts/send.ts out/brief.html --subject "${subject.replace(/"/g, '\\"')}"`)
}
