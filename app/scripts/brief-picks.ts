/**
 * TEMPLATE E — THE PICKS. "Picks of the weekend" as an email (Ness, 2026-10-30: "the design of a
 * picks of the weekend — develop out the email design").
 *
 * What it keeps from D (list/README.md): the cover is a PICK, not a mood image; the forecast line
 * explains the weekend's shape; the days run chronologically, so reading order is doing order; every
 * email-HTML rule (every <tr> in a <table>, everything load-bearing inline, no flex/grid/variables,
 * two dark paths, under 102 KB, {{unsub}} in the footer).
 *
 * What it changes: the weekend's picks are PICTURED — the app's front is fully pictured and the
 * brief was a wall of type after the cover. Each pick is a numbered row with a square focal-point
 * thumb (the app's card crop, re-cut from the original), the day and hour as the kicker, the title,
 * venue · price, one line of the card's own copy, and a monospace SOURCE TRACE ("via LBB · I
 * amsterdam") — the signal-and-link model made visible on every row, and the only place mono is
 * allowed. A card with no honest photo gets the typographic face (its initial on the day's wash),
 * never a stand-in. The weather sits at the top as a BAND — the condition phrase big, the two days
 * as two tinted cells, the forecast's own receipt under them — so the first screen on a phone is
 * the sky, then the cover.
 *
 * Two layouts from the same data, for comparing: `rows` (thumb + text, holds on a phone without
 * stacking) and `grid` (2-up pictured cards, 3:2, stacking to one column under 480px).
 */
import { assignDays, type Wx, type WxDay } from './poster'
import { fixWhen, whenWeekendDays } from '../src/lib/when'
import type { Pick, Mode } from '../src/types'
import { APP, FONT, MONO, esc, deg, cut, deckOrder, thisWeekend, weekendDays, slot, clock, line, dayWords, claim, band, trace, realVenue as realVenueOf } from './lib/brief-shared'

/** The venue as the row names it; a one- or two-letter venue is a crawl artefact ("Am"), not a place. */
const realVenue = (p: Pick) => { const v = realVenueOf(p); return v.trim().length < 3 ? '' : v }

export type PicksLayout = 'rows' | 'grid' | 'index' | 'plates' | 'cover' | 'split' | 'blocks'
export const PICKS_LAYOUTS: Record<PicksLayout, { name: string; bet: string }> = {
  rows:   { name: 'The Picks',   bet: 'thumb + text rows under a sky band; holds on a phone without stacking' },
  grid:   { name: 'The Sheet',   bet: '2-up 3:2 cards, a contact sheet; stacks on a phone' },
  index:  { name: 'The Index',   bet: 'type only after the cover — hanging numerals, the writing sells it (Bold Index lineage)' },
  plates: { name: 'The Plates',  bet: 'every pick a quiet full-width photograph with a caption; brick-red accent, generous space (Hara lineage)' },
  cover:  { name: 'The Cover',   bet: 'the weekend\'s weather as a tinted cover in the mode\'s own colour, then a dense list with round thumbs' },
  split:  { name: 'The Split',   bet: 'Saturday | Sunday as two pictured columns — D\'s structure, every card pictured' },
  blocks: { name: 'The Blocks',  bet: 'each pick its own colour world — a full-width block in the day\'s wash, picture right, type left (scrollytelling lineage)' },
}
export interface PicksOpts { hero?: string; per?: number; now?: Date; weekendLabel?: string; layout?: PicksLayout }
const PAPER = '#faf8f3', INK = '#1a1a1a', INK3 = '#8b8a82', HAIR = '#e7e3d8', ACCENT = '#ff4d1f', SHELL = '#eceae3'
const nn = (i: number) => String(i).padStart(2, '0')
const DAYNAME: Record<string, string> = { Sat: 'Saturday', Sun: 'Sunday' }

/** The day a pick belongs to, as the kicker names it. */
function dayOf(p: Pick, now: Date): 'Saturday' | 'Sunday' | 'Both days' {
  const { satD, sunD } = weekendDays(now)
  const d = whenWeekendDays(p.when, satD, sunD, now)
  return d.sat && !d.sun ? 'Saturday' : d.sun && !d.sat ? 'Sunday' : 'Both days'
}

/** The typographic no-photo face: the title's initial on the day's wash. An honest blank beats a
 *  plausible wrong photo (V.11.9) — the email keeps the app's rule. */
function face(p: Pick, b: { bg: string; ink: string }, size: number, radius: number): string {
  const ch = (p.title.trim()[0] || '·').toUpperCase()
  return `<div class="th np" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${b.bg};font:400 ${Math.round(size * 0.46)}px/${size}px ${FONT};letter-spacing:-.04em;color:${b.ink};text-align:center;">${esc(ch)}</div>`
}

function thumb(p: Pick, b: { bg: string; ink: string }): string {
  if (!p.image) return face(p, b, 150, 10)
  return `<a href="${esc(p.link)}" class="lnk" style="display:block;"><img class="th" src="${esc(cut(p, 300, 300))}" width="150" height="150" alt="${esc(p.title)}" style="display:block;width:150px;height:150px;border:0;border-radius:10px;background:${b.bg};font:400 11px/1.3 ${FONT};color:${b.ink};text-align:center;"></a>`
}

/** The source trace: mono, tiny, the publication and the card's own "why". */
function traceLine(p: Pick, cls = '', tail = ''): string {
  const parts = [trace(p), p.why && !/weekend (guide|tips)/i.test(p.why) ? p.why : '', tail].filter(Boolean)
  if (!parts.length) return ''
  return `<div class="ink3 ${cls}" style="margin-top:9px;font:400 10px/1.4 ${MONO};letter-spacing:.01em;color:${INK3};">${esc(parts.join(' · '))}</div>`
}

/** One numbered row: thumb left, the text right. Holds at 390px by shrinking the thumb, never stacking. */
function row(p: Pick, n: number, b: { bg: string; ink: string }, now: Date, last: boolean): string {
  const s = slot(p, now)
  const meta = [realVenue(p), p.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
  return `
        <tr><td class="pad" style="padding:18px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td class="thc" width="150" valign="top" style="width:150px;padding-right:18px;">${thumb(p, b)}</td>
            <td valign="top">
              <div style="font:400 10px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${s.accent ? ACCENT : INK3};" class="${s.accent ? '' : 'ink3'}"><span style="color:${ACCENT};">${nn(n)}</span>&nbsp;&nbsp;${s.text}</div>
              <div class="ink" style="margin-top:8px;font:400 19px/1.18 ${FONT};letter-spacing:-.02em;color:${INK};"><a href="${esc(p.link)}" class="ink lnk" style="color:${INK};">${esc(p.title)}</a></div>
              ${meta ? `<div class="ink3" style="margin-top:5px;font:400 11.5px/1.4 ${FONT};color:${INK3};">${meta}</div>` : ''}
              <div class="ink" style="margin-top:7px;font:400 13px/1.5 ${FONT};color:${INK};">${line(p, 110)}</div>
              ${traceLine(p)}
            </td>
          </tr>
          </table>
          ${last ? '' : `<div class="hair" style="height:1px;background:${HAIR};line-height:1px;font-size:0;margin-top:18px;">&nbsp;</div>`}
        </td></tr>`
}

/** One grid card: a 3:2 picture over the text. Two to a row; stacks under 480px. */
function cell(p: Pick, n: number, b: { bg: string; ink: string }, now: Date): string {
  const s = slot(p, now)
  const meta = [realVenue(p), p.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
  const pic = p.image
    ? `<a href="${esc(p.link)}" class="lnk" style="display:block;"><img src="${esc(cut(p, 560, 374))}" width="100%" alt="${esc(p.title)}" style="display:block;width:100%;height:auto;border:0;border-radius:10px;background:${b.bg};padding:0;font:400 11px/1.3 ${FONT};color:${b.ink};text-align:center;"></a>`
    : `<div class="np" style="height:150px;border-radius:10px;background:${b.bg};font:400 64px/150px ${FONT};letter-spacing:-.04em;color:${b.ink};text-align:center;">${esc((p.title.trim()[0] || '·').toUpperCase())}</div>`
  return `
            <td class="stack" width="48%" valign="top" style="width:48%;">
              ${pic}
              <div style="margin-top:12px;font:400 10px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${s.accent ? ACCENT : INK3};" class="${s.accent ? '' : 'ink3'}"><span style="color:${ACCENT};">${nn(n)}</span>&nbsp;&nbsp;${s.text}</div>
              <div class="ink" style="margin-top:7px;font:400 17px/1.2 ${FONT};letter-spacing:-.018em;color:${INK};"><a href="${esc(p.link)}" class="ink lnk" style="color:${INK};">${esc(p.title)}</a></div>
              ${meta ? `<div class="ink3" style="margin-top:4px;font:400 11px/1.4 ${FONT};color:${INK3};">${meta}</div>` : ''}
              <div class="ink" style="margin-top:6px;font:400 13px/1.5 ${FONT};color:${INK};">${line(p, 90)}</div>
              ${traceLine(p)}
            </td>`
}

/** A day's header: the name in the day's tint over a 2px rule, the temperature and the words. */
function dayHead(d: WxDay | undefined, name: string, b: { bg: string; ink: string }, first: boolean): string {
  return `
        <tr><td class="pad" style="padding:${first ? 26 : 30}px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:2px solid ${b.ink};">
          <tr>
            <td style="padding-top:10px;font:400 10px/1 ${FONT};letter-spacing:.18em;text-transform:uppercase;color:${b.ink};">${name}</td>
            <td align="right" style="padding-top:10px;font:400 10px/1 ${FONT};letter-spacing:.06em;color:${b.ink};white-space:nowrap;">${d ? `${deg(d.hi)} &nbsp;·&nbsp; ${esc(dayWords(d).replace(/\.$/, ''))}` : ''}</td>
          </tr>
          </table>
        </td></tr>`
}

export function picksHtml(picks: Pick[], wx: Wx | null, opts: PicksOpts = {}): { html: string; hero: Pick; sat: Pick[]; sun: Pick[]; subject: string; layout: PicksLayout } {
  const now = opts.now ?? new Date()
  const per = opts.per ?? 4
  const layout: PicksLayout = opts.layout ?? 'rows'
  const ordered = deckOrder(picks).filter((p) => thisWeekend(p, now))
  const pinned = opts.hero ? ordered.find((p) => p.title.toLowerCase().includes(opts.hero!.toLowerCase())) : undefined
  const hero = pinned ?? ordered.find((p) => p.image) ?? ordered[0]
  if (!hero) throw new Error('no weekend picks to write a brief from')
  const rest = ordered.filter((p) => p.id !== hero.id)
  const { sat, sun } = assignDays(rest, wx?.days, per, now)
  const satSorted = [...sat].sort((x, y) => clock(x) - clock(y)), sunSorted = [...sun].sort((x, y) => clock(x) - clock(y))
  const c = claim(wx)
  const dSat = wx?.days[0], dSun = wx?.days[1] ?? wx?.days[0]
  const bSat = band(dSat?.mode ?? 'WARM'), bSun = band(dSun?.mode ?? 'WARM')
  const heroDay = dayOf(hero, now)
  const bHero = heroDay === 'Sunday' ? bSun : bSat
  const dHero = heroDay === 'Sunday' ? dSun : dSat
  const heroKicker = [`<span style="color:${ACCENT};">01</span>`, 'The one to book', heroDay === 'Both days' ? fixWhen(hero.when || '').split(' · ')[0] : heroDay, (() => { const s = slot(hero, now); return /·/.test(s.text) ? s.text.split('·').pop()!.trim() : '' })()].filter(Boolean).join(' &nbsp;·&nbsp; ')
  const heroMeta = [realVenue(hero), hero.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
  const more = ordered.length - 1 - sat.length - sun.length
  const subject = c.strong.replace(/&deg;/g, '°').replace(/&[a-z]+;/g, '')
  const preheader = `${hero.title} — ${subject}`
  const readAt = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()]} ${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  /* the weather band: the condition phrase big, the two days as two tinted cells, the receipt */
  const dayCell = (d: WxDay | undefined, name: string, b: { bg: string; ink: string }, right: boolean) => `
            <td width="50%" valign="top" style="width:50%;padding:${right ? '0 0 0 8px' : '0 8px 0 0'};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="wash" style="background:${b.bg};border-radius:10px;">
              <tr><td style="padding:12px 14px 13px;">
                <div style="font:400 9px/1 ${FONT};letter-spacing:.18em;text-transform:uppercase;color:${b.ink};">${name}</div>
                <div style="margin-top:6px;font:400 26px/1 ${FONT};letter-spacing:-.03em;color:${b.ink};">${d ? deg(d.hi) : '&nbsp;'}</div>
                <div style="margin-top:6px;font:400 11px/1.35 ${FONT};color:${b.ink};">${d ? esc(dayWords(d)) : 'No forecast yet.'}</div>
              </td></tr>
              </table>
            </td>`
  const weather = `
        <tr><td class="pad" style="padding:28px 34px 0;">
          <div class="ink3" style="font:400 10px/1 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${INK3};">The weekend &nbsp;·&nbsp; ${esc(wx?.span ?? opts.weekendLabel ?? '')}</div>
          <div class="ink sky" style="margin-top:12px;font:400 30px/1.1 ${FONT};letter-spacing:-.028em;color:${INK};">${c.strong}</div>
          <div class="ink3" style="margin-top:8px;font:400 14px/1.5 ${FONT};color:${INK3};">${c.soft}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;">
          <tr>${dayCell(dSat, 'Saturday', bSat, false)}${dayCell(dSun, 'Sunday', bSun, true)}</tr>
          </table>
          <div class="ink3" style="margin-top:10px;font:400 10px/1.4 ${MONO};color:${INK3};">forecast Open-Meteo &nbsp;·&nbsp; read ${esc(readAt)} &nbsp;·&nbsp; ranked by the sky, then the hour</div>
        </td></tr>`

  /* the cover: pick 01, pictured 3:2 (or its face), then the kicker, the title, the line, the trace */
  const cover = hero.image ? `
        <tr><td class="pad" style="padding:24px 34px 0;">
          <a href="${esc(hero.link)}" class="lnk" style="display:block;">
            <img src="${esc(cut(hero, 1064, 710))}" width="532" alt="${esc(hero.title)}${hero.venue ? ' — ' + esc(realVenue(hero)) : ''}"
                 style="display:block;width:100%;max-width:532px;height:auto;border:0;border-radius:12px;background:${bHero.bg};padding:0;font:400 15px/1.5 ${FONT};color:${bHero.ink};text-align:center;">
          </a>
        </td></tr>` : `
        <tr><td class="pad" style="padding:24px 34px 0;">${face(hero, bHero, 150, 12)}</td></tr>`
  const heroBlock = `${cover}
        <tr><td class="pad" style="padding:18px 34px 0;">
          <div class="ink3" style="font:400 10px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${INK3};">${heroKicker}</div>
          <h1 class="ink hero-h" style="margin:10px 0 0;font:400 34px/1.06 ${FONT};letter-spacing:-.028em;color:${INK};">
            <a href="${esc(hero.link)}" class="ink lnk" style="color:${INK};">${esc(hero.title)}</a>
          </h1>
          ${heroMeta ? `<div class="ink3" style="margin-top:10px;font:400 13px/1.5 ${FONT};color:${INK3};">${heroMeta}</div>` : ''}
          <p class="ink" style="margin:12px 0 0;font:400 16px/1.55 ${FONT};color:${INK};">${line(hero, 220)}</p>
          ${traceLine(hero, '', dHero ? `${heroDay === 'Both days' ? 'both days' : heroDay.toLowerCase()} ${Math.round(dHero.hi)}°, ${dayWords(dHero).split('.')[0].toLowerCase()}` : '')}
        </td></tr>`

  /* ────────────────────────────── the layouts ────────────────────────────── */
  let n = 1
  const dayBlock = (d: WxDay | undefined, name: string, b: { bg: string; ink: string }, list: Pick[], first: boolean) => {
    if (!list.length) return ''
    if (layout === 'grid') {
      const pairs: string[] = []
      for (let i = 0; i < list.length; i += 2) {
        const a = list[i], z = list[i + 1]
        pairs.push(`
        <tr><td class="pad" style="padding:18px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>${cell(a, ++n, b, now)}
            <td class="stack-gap" width="4%" style="width:4%;font-size:0;line-height:0;">&nbsp;</td>${z ? cell(z, ++n, b, now) : `<td class="stack" width="48%" style="width:48%;">&nbsp;</td>`}
          </tr>
          </table>
        </td></tr>`)
      }
      return dayHead(d, name, b, first) + pairs.join('')
    }
    return dayHead(d, name, b, first) + list.map((p, i) => row(p, ++n, b, now, i === list.length - 1)).join('')
  }

  /* THE INDEX — after the cover, type only: a hanging numeral, the title big, the meta, the trace. */
  const indexRow = (p: Pick, k: number, b: { bg: string; ink: string }, last: boolean) => {
    const s = slot(p, now)
    const meta = [realVenue(p), p.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
    return `
        <tr><td class="pad" style="padding:16px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="64" valign="top" style="width:64px;padding-top:2px;font:400 36px/1 ${FONT};letter-spacing:-.05em;color:${ACCENT};">${nn(k)}</td>
            <td valign="top">
              <div class="${s.accent ? '' : 'ink3'}" style="font:400 10px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${s.accent ? ACCENT : INK3};">${s.text}</div>
              <div class="ink" style="margin-top:7px;font:400 22px/1.12 ${FONT};letter-spacing:-.025em;color:${INK};"><a href="${esc(p.link)}" class="ink lnk" style="color:${INK};">${esc(p.title)}</a></div>
              ${meta ? `<div class="ink3" style="margin-top:5px;font:400 12px/1.4 ${FONT};color:${INK3};">${meta}</div>` : ''}
              <div class="ink" style="margin-top:6px;font:400 13px/1.5 ${FONT};color:${INK};">${line(p, 120)}</div>
              ${traceLine(p)}
            </td>
          </tr>
          </table>
          ${last ? '' : `<div class="hair" style="height:1px;background:${HAIR};line-height:1px;font-size:0;margin-top:16px;">&nbsp;</div>`}
        </td></tr>`
  }
  const indexDay = (d: WxDay | undefined, name: string, b: { bg: string; ink: string }, list: Pick[], first: boolean) =>
    list.length ? dayHead(d, name, b, first) + list.map((p, i) => indexRow(p, ++n, b, i === list.length - 1)).join('') : ''

  /* THE PLATES — every pick a full-width photograph with a caption, generous space, no rules. */
  const plate = (p: Pick, k: number, b: { bg: string; ink: string }) => {
    const s = slot(p, now)
    const meta = [realVenue(p), p.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
    const pic = p.image
      ? `<a href="${esc(p.link)}" class="lnk" style="display:block;"><img src="${esc(cut(p, 1064, 710))}" width="532" alt="${esc(p.title)}" style="display:block;width:100%;max-width:532px;height:auto;border:0;background:${b.bg};font:400 12px/1.4 ${FONT};color:${b.ink};text-align:center;"></a>`
      : face(p, b, 150, 0)
    return `
        <tr><td class="pad" style="padding:34px 34px 0;">
          ${pic}
          <div class="ink3" style="margin-top:14px;font:400 10px/1.4 ${MONO};color:${INK3};">${nn(k)} &nbsp;·&nbsp; ${s.text.replace(/&nbsp;/g, ' ').toLowerCase()}${dayOf(p, now) !== 'Both days' ? ` &nbsp;·&nbsp; ${dayOf(p, now).toLowerCase()}` : ''}</div>
          <div class="ink" style="margin-top:8px;font:400 21px/1.2 ${FONT};letter-spacing:-.02em;color:${INK};"><a href="${esc(p.link)}" class="ink lnk" style="color:${INK};">${esc(p.title)}</a></div>
          ${meta ? `<div class="ink3" style="margin-top:5px;font:400 12px/1.4 ${FONT};color:${INK3};">${meta}</div>` : ''}
          <div class="ink" style="margin-top:8px;font:400 14px/1.55 ${FONT};color:${INK};">${line(p, 140)}</div>
          ${traceLine(p)}
        </td></tr>`
  }
  const plateDay = (name: string, d: WxDay | undefined, b: { bg: string; ink: string }, list: Pick[]) =>
    list.length ? `
        <tr><td class="pad" style="padding:40px 34px 0;">
          <div style="font:400 10px/1 ${FONT};letter-spacing:.22em;text-transform:uppercase;color:${b.ink};">${name}${d ? ` &nbsp;·&nbsp; ${deg(d.hi)} &nbsp;·&nbsp; ${esc(dayWords(d).split('.')[0])}` : ''}</div>
        </td></tr>` + list.map((p) => plate(p, ++n, b)).join('') : ''

  /* THE COVER — the weekend's weather as a field in the mode's own tint, then a dense list. */
  const dominant = (dSat && dSun && (dSat.pop ?? 0) > (dSun.pop ?? 0)) ? dSat : (dSun ?? dSat)
  const tint = dominant ? band(dominant.mode).ink : ACCENT
  const coverField = `
        <tr><td class="field" bgcolor="${tint}" style="padding:30px 34px 32px;background:${tint};border-radius:14px 14px 0 0;">
          <div style="font:400 10px/1 ${FONT};letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.72);">The weekend &nbsp;·&nbsp; ${esc(wx?.span ?? opts.weekendLabel ?? '')} &nbsp;·&nbsp; Amsterdam</div>
          <div class="sky" style="margin-top:14px;font:400 36px/1.06 ${FONT};letter-spacing:-.03em;color:#ffffff;">${c.strong}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
          <tr>
            <td style="padding-right:28px;"><div style="font:400 10px/1 ${FONT};letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.72);">Saturday</div><div style="margin-top:6px;font:400 44px/1 ${FONT};letter-spacing:-.04em;color:#ffffff;">${dSat ? deg(dSat.hi) : '&nbsp;'}</div><div style="margin-top:6px;font:400 12px/1.4 ${FONT};color:rgba(255,255,255,.85);">${dSat ? esc(dayWords(dSat).split('.')[0]) : ''}</div></td>
            <td style="padding-left:28px;border-left:1px solid rgba(255,255,255,.3);"><div style="font:400 10px/1 ${FONT};letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.72);">Sunday</div><div style="margin-top:6px;font:400 44px/1 ${FONT};letter-spacing:-.04em;color:#ffffff;">${dSun ? deg(dSun.hi) : '&nbsp;'}</div><div style="margin-top:6px;font:400 12px/1.4 ${FONT};color:rgba(255,255,255,.85);">${dSun ? esc(dayWords(dSun).split('.')[0]) : ''}</div></td>
          </tr>
          </table>
          <div style="margin-top:20px;font:400 10px/1.4 ${MONO};color:rgba(255,255,255,.7);">forecast Open-Meteo &nbsp;·&nbsp; read ${esc(readAt)} &nbsp;·&nbsp; ranked by the sky, then the hour</div>
        </td></tr>`
  const denseRow = (p: Pick, k: number, b: { bg: string; ink: string }, last: boolean) => {
    const s = slot(p, now)
    const meta = [realVenue(p), p.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
    const pic = p.image
      ? `<a href="${esc(p.link)}" class="lnk" style="display:block;"><img src="${esc(cut(p, 160, 160))}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;border:0;border-radius:36px;background:${b.bg};"></a>`
      : `<div class="np" style="width:72px;height:72px;border-radius:36px;background:${b.bg};font:400 30px/72px ${FONT};color:${b.ink};text-align:center;">${esc((p.title.trim()[0] || '·').toUpperCase())}</div>`
    return `
        <tr><td class="pad" style="padding:14px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="72" valign="top" style="width:72px;padding-right:16px;">${pic}</td>
            <td valign="top">
              <div class="${s.accent ? '' : 'ink3'}" style="font:400 10px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${s.accent ? ACCENT : INK3};"><span style="color:${ACCENT};">${nn(k)}</span>&nbsp;&nbsp;${s.text}</div>
              <div class="ink" style="margin-top:6px;font:400 17px/1.2 ${FONT};letter-spacing:-.018em;color:${INK};"><a href="${esc(p.link)}" class="ink lnk" style="color:${INK};">${esc(p.title)}</a></div>
              <div class="ink3" style="margin-top:4px;font:400 11.5px/1.4 ${FONT};color:${INK3};">${[meta, trace(p)].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
            </td>
          </tr>
          </table>
          ${last ? '' : `<div class="hair" style="height:1px;background:${HAIR};line-height:1px;font-size:0;margin-top:14px;">&nbsp;</div>`}
        </td></tr>`
  }
  const denseDay = (d: WxDay | undefined, name: string, b: { bg: string; ink: string }, list: Pick[], first: boolean) =>
    list.length ? dayHead(d, name, b, first) + list.map((p, i) => denseRow(p, ++n, b, i === list.length - 1)).join('') : ''

  /* THE SPLIT — Saturday | Sunday as two pictured columns (D's structure, every card pictured). */
  const colCard = (p: Pick, k: number, b: { bg: string; ink: string }, first: boolean) => {
    const s = slot(p, now)
    const meta = [realVenue(p), p.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
    const pic = p.image
      ? `<a href="${esc(p.link)}" class="lnk" style="display:block;"><img src="${esc(cut(p, 500, 375))}" width="100%" alt="${esc(p.title)}" style="display:block;width:100%;height:auto;border:0;border-radius:8px;background:${b.bg};font:400 11px/1.3 ${FONT};color:${b.ink};text-align:center;"></a>`
      : `<div class="np" style="height:120px;border-radius:8px;background:${b.bg};font:400 54px/120px ${FONT};letter-spacing:-.04em;color:${b.ink};text-align:center;">${esc((p.title.trim()[0] || '·').toUpperCase())}</div>`
    return `
              <tr><td style="padding:${first ? 14 : 18}px 14px 0;">
                ${pic}
                <div class="${s.accent ? '' : 'ink3'}" style="margin-top:10px;font:400 9px/1 ${FONT};letter-spacing:.13em;text-transform:uppercase;color:${s.accent ? ACCENT : INK3};"><span style="color:${ACCENT};">${nn(k)}</span>&nbsp;&nbsp;${s.text}</div>
                <div class="ink" style="margin-top:6px;font:400 16px/1.2 ${FONT};letter-spacing:-.018em;color:${INK};"><a href="${esc(p.link)}" class="ink lnk" style="color:${INK};">${esc(p.title)}</a></div>
                ${meta ? `<div class="ink3" style="margin-top:4px;font:400 11px/1.4 ${FONT};color:${INK3};">${meta}</div>` : ''}
                ${traceLine(p)}
              </td></tr>`
  }
  const column = (name: string, d: WxDay | undefined, b: { bg: string; ink: string }, list: Pick[]) => `
            <td class="stack col" width="48%" valign="top" style="width:48%;background:#fdfcf9;border-radius:10px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td class="wash" style="padding:14px 14px 12px;background:${b.bg};border-radius:10px 10px 0 0;">
                <div style="font:400 9px/1 ${FONT};letter-spacing:.18em;text-transform:uppercase;color:${b.ink};">${name}</div>
                <div style="margin-top:7px;font:400 30px/1 ${FONT};letter-spacing:-.035em;color:${b.ink};">${d ? deg(d.hi) : '&nbsp;'}</div>
                <div style="margin-top:5px;font:400 11px/1.4 ${FONT};color:${b.ink};">${d ? esc(dayWords(d)) : 'No forecast yet.'}</div>
              </td></tr>${list.map((p, i) => colCard(p, ++n, b, i === 0)).join('')}
              <tr><td style="padding:0 0 6px;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>`

  /* THE BLOCKS — each pick its own colour world: a full-width block in the day's wash, picture right. */
  const block = (p: Pick, k: number, b: { bg: string; ink: string }, dayName: string) => {
    const s = slot(p, now)
    const meta = [realVenue(p), p.price].filter(Boolean).join(' &nbsp;·&nbsp; ')
    const pic = p.image
      ? `<a href="${esc(p.link)}" class="lnk" style="display:block;"><img class="bk" src="${esc(cut(p, 360, 480))}" width="180" height="240" alt="" style="display:block;width:180px;height:240px;border:0;border-radius:0 12px 12px 0;"></a>`
      : `<div class="bk" style="width:180px;height:240px;border-radius:0 12px 12px 0;background:${b.ink};font:400 72px/240px ${FONT};color:${b.bg};text-align:center;">${esc((p.title.trim()[0] || '·').toUpperCase())}</div>`
    return `
        <tr><td class="pad" style="padding:14px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="wash" bgcolor="${b.bg}" style="background:${b.bg};border-radius:12px;">
          <tr>
            <td valign="top" style="padding:20px 18px 20px 22px;">
              <div style="font:400 10px/1.5 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${b.ink};">${nn(k)} · ${dayName.slice(0, 3)} · ${/·/.test(s.text) ? s.text.split('·').pop()!.replace(/&nbsp;/g, '').trim() : s.text}</div>
              <div class="ink" style="margin-top:10px;font:400 21px/1.15 ${FONT};letter-spacing:-.022em;color:${INK};"><a href="${esc(p.link)}" class="ink lnk" style="color:${INK};">${esc(p.title)}</a></div>
              ${meta ? `<div style="margin-top:6px;font:400 11.5px/1.4 ${FONT};color:${b.ink};">${meta}</div>` : ''}
              <div class="ink" style="margin-top:8px;font:400 13px/1.5 ${FONT};color:${INK};">${line(p, 100)}</div>
              <div style="margin-top:10px;font:400 10px/1.4 ${MONO};color:${b.ink};">${esc([trace(p), p.why && !/weekend (guide|tips)/i.test(p.why) ? p.why : ''].filter(Boolean).join(' · '))}</div>
            </td>
            <td class="bkc" width="180" valign="top" style="width:180px;">${pic}</td>
          </tr>
          </table>
        </td></tr>`
  }

  let opening = weather, picksBody = '', cta = ''
  const dayNameOf = (p: Pick) => dayOf(p, now) === 'Both days' ? 'Both days' : dayOf(p, now)
  switch (layout) {
    case 'rows':
    case 'grid':
      picksBody = heroBlock + dayBlock(dSat, 'Saturday', bSat, satSorted, true) + dayBlock(dSun, 'Sunday', bSun, sunSorted, !satSorted.length)
      break
    case 'index':
      picksBody = heroBlock + indexDay(dSat, 'Saturday', bSat, satSorted, true) + indexDay(dSun, 'Sunday', bSun, sunSorted, !satSorted.length)
      break
    case 'plates':
      opening = `
        <tr><td class="pad" style="padding:30px 34px 0;">
          <div class="ink3" style="font:400 10px/1.6 ${MONO};color:${INK3};">${esc(wx?.span ?? opts.weekendLabel ?? '')} &nbsp;·&nbsp; amsterdam${dSat && dSun ? ` &nbsp;·&nbsp; sat ${Math.round(dSat.hi)}° ${esc(dayWords(dSat).split('.')[0].toLowerCase())} &nbsp;·&nbsp; sun ${Math.round(dSun.hi)}° ${esc(dayWords(dSun).split('.')[0].toLowerCase())}` : ''}</div>
          <div class="ink sky" style="margin-top:18px;font:400 26px/1.25 ${FONT};letter-spacing:-.02em;color:${INK};">${c.strong}</div>
        </td></tr>`
      picksBody = plate(hero, 1, bHero) + plateDay('Saturday', dSat, bSat, satSorted) + plateDay('Sunday', dSun, bSun, sunSorted)
      cta = `
        <tr><td class="pad" style="padding:44px 34px 40px;">
          <a href="${APP}" class="ink" style="font:400 15px/1.4 ${FONT};color:${INK};border-bottom:1px solid ${ACCENT};">${more > 0 ? `${more} more, sorted the same way` : 'Open the deck'} &nbsp;&rarr;</a>
          <div class="ink3" style="margin-top:16px;font:400 12px/1.6 ${FONT};color:${INK3};">Save the ones you'd go to; sign in once and they follow you. The overlap with whoever you'd go with is the plan.</div>
        </td></tr>`
      break
    case 'cover':
      opening = coverField
      picksBody = `
        <tr><td class="pad" style="padding:22px 34px 0;">
          <div class="ink3" style="font:400 10px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${INK3};"><span style="color:${ACCENT};">01</span>&nbsp;&nbsp;The one to book &nbsp;·&nbsp; ${heroDay}</div>
          <h1 class="ink hero-h" style="margin:10px 0 0;font:400 30px/1.08 ${FONT};letter-spacing:-.028em;color:${INK};"><a href="${esc(hero.link)}" class="ink lnk" style="color:${INK};">${esc(hero.title)}</a></h1>
          ${heroMeta ? `<div class="ink3" style="margin-top:8px;font:400 12px/1.5 ${FONT};color:${INK3};">${heroMeta}</div>` : ''}
          <p class="ink" style="margin:10px 0 0;font:400 15px/1.55 ${FONT};color:${INK};">${line(hero, 180)}</p>
          ${traceLine(hero)}
        </td></tr>` + denseDay(dSat, 'Saturday', bSat, satSorted, true) + denseDay(dSun, 'Sunday', bSun, sunSorted, !satSorted.length)
      break
    case 'split':
      picksBody = heroBlock + `
        <tr><td class="pad" style="padding:26px 34px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>${column('Saturday', dSat, bSat, satSorted)}
            <td class="stack-gap" width="4%" style="width:4%;font-size:0;line-height:0;">&nbsp;</td>${column('Sunday', dSun, bSun, sunSorted)}
          </tr>
          </table>
        </td></tr>`
      break
    case 'blocks':
      picksBody = heroBlock + `
        <tr><td class="pad" style="padding:28px 34px 0;">
          <div class="hair" style="height:1px;background:${HAIR};line-height:1px;font-size:0;">&nbsp;</div>
        </td></tr>` + [...satSorted.map((p) => block(p, ++n, bSat, 'Saturday')), ...sunSorted.map((p) => block(p, ++n, bSun, 'Sunday'))].join('')
      break
  }
  if (!cta) cta = `
        <tr><td class="pad" style="padding:30px 34px 0;">
          <div class="hair" style="height:1px;background:${HAIR};line-height:1px;font-size:0;">&nbsp;</div>
        </td></tr>
        <tr><td class="pad" style="padding:24px 34px 34px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" bgcolor="${ACCENT}" style="border-radius:100px;">
            <a href="${APP}" style="display:inline-block;padding:14px 30px;font:400 15px/1 ${FONT};color:#ffffff;letter-spacing:-.01em;">
              ${more > 0 ? `${more} more, sorted the same way` : 'Open the deck'} &nbsp;&rarr;
            </a>
          </td></tr>
          </table>
          <div class="ink3" style="margin-top:14px;font:400 13px/1.5 ${FONT};color:${INK3};">
            Save the ones you'd go to; sign in once and they follow you to every device. Send them to whoever you'd go with — the overlap is the plan.
          </div>
        </td></tr>`

  const mast = layout === 'plates'
    ? `
    <tr><td class="pad" style="padding:0 30px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="left" style="font:400 13px/1 ${FONT};letter-spacing:.08em;color:${INK};" class="ink">WKNDR</td>
        <td align="right" style="font:400 10px/1 ${MONO};color:${INK3};" class="ink3">picks of the weekend</td>
      </tr>
      </table>
    </td></tr>`
    : `
    <tr><td class="pad" style="padding:0 30px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="left" style="font:700 15px/1 ${FONT};letter-spacing:-.02em;color:${INK};" class="ink">
          WKNDR<span style="color:${ACCENT};">&nbsp;&bull;</span>
        </td>
        <td align="right" style="font:400 10px/1 ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${INK3};" class="ink3">
          Picks of the weekend &nbsp;·&nbsp; Amsterdam
        </td>
      </tr>
      </table>
    </td></tr>`

  let html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>WKNDR — picks of the weekend</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  /* Written by app/scripts/brief-picks.ts — template E, ${PICKS_LAYOUTS[layout].name} (${layout}):
     ${PICKS_LAYOUTS[layout].bet}. */
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;outline:0;line-height:100%;text-decoration:none}
  a{text-decoration:none}
  .lnk:hover{opacity:.75!important}
  @media (max-width:480px){
    .shell{width:100%!important}
    .pad{padding-left:20px!important;padding-right:20px!important}
    .sky{font-size:27px!important}
    .hero-h{font-size:29px!important;line-height:1.08!important}
    .thc{width:104px!important;padding-right:14px!important}
    .th{width:104px!important;height:104px!important;font-size:46px!important;line-height:104px!important}
    .bkc{width:120px!important}
    .bk{width:120px!important;height:160px!important;font-size:48px!important;line-height:160px!important}
    .stack{display:block!important;width:100%!important;max-width:100%!important}
    .stack-gap{height:18px!important;line-height:18px!important;font-size:0!important;display:block!important;width:100%!important}
  }
  @media (prefers-color-scheme:dark){
    .bg{background:#141312!important}
    .card{background:#1c1a18!important}
    .col{background:#211f1c!important}
    .ink{color:#f4f1ea!important}
    .ink3{color:#9a978d!important}
    .hair{background:#2e2b27!important}
    .wash{background:#262320!important}
    .np{background:#262320!important}
  }
  [data-ogsc] .bg{background:#141312!important}
  [data-ogsc] .card{background:#1c1a18!important}
  [data-ogsc] .col{background:#211f1c!important}
  [data-ogsc] .ink{color:#f4f1ea!important}
  [data-ogsc] .ink3{color:#9a978d!important}
  [data-ogsc] .hair{background:#2e2b27!important}
  [data-ogsc] .wash{background:#262320!important}
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
${mast}
    <tr><td class="card" style="background:${PAPER};border-radius:14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:14px;overflow:hidden;">
${opening}
${picksBody}
${cta}
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
  // THE PLATES wear the Hara palette — the same markup in the brick accent (docs/ design tokens:
  // --accent-hara #8a2818), the orange exists nowhere in that one.
  if (layout === 'plates') html = html.replaceAll(ACCENT, '#8a2818')
  return { html, hero, sat: satSorted, sun: sunSorted, subject, layout }
}
