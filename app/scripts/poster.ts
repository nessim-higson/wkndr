/**
 * THE WEEKEND POSTER — a shareable graphic of this weekend's top picks, regenerated every week.
 *
 * Ness: "I'd love a graphic of some of the top picks for the weekend to share with people. Is that
 * something that could be generated week over week?" This is that: it rides the same weekly cron as
 * the content refresh, so the poster is never staler than the deck.
 *
 * RENDERER — puppeteer-core against the SYSTEM Chrome, deliberately:
 *   · the brand faces are woff2 (Familjen Grotesk 700, the OG/intro voice), which satori and every
 *     other SVG-shaper cannot read — a browser can, so the poster uses the REAL typeface instead of
 *     a metric-compatible stand-in.
 *   · `puppeteer-core` ships no browser (~350KB), so CI installs nothing: GitHub's ubuntu runners
 *     already have Chrome, and macOS has it under /Applications. A full `puppeteer` would re-download
 *     ~170MB of Chromium on every workflow run.
 *
 * OUTPUT — app/public/share/weekend.png (stable "latest" URL, good for a link that never changes)
 * plus app/public/share/<saturday>.png (the dated archive, so an old share still resolves).
 *
 * Run: `bun run poster` (or `bun run scripts/poster.ts --city=amsterdam`). Fails LOUD (exit 1) —
 * a silently-missing poster is worse than a red workflow step.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { classify } from '../src/weather/modes'
import { upcomingWeekend } from './lib/pipeline'
import { fixWhen } from '../src/lib/when'
import type { Mode, Pick } from '../src/types'

const CITY = process.argv.find((a) => a.startsWith('--city='))?.split('=')[1] ?? 'amsterdam'
const COUNT = 5                       // how many picks make the poster
const W = 1080, H = 1350              // 4:5 portrait — the best all-rounder for messages + feeds
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]

/** Chrome, wherever this is running. CI sets PUPPETEER_EXECUTABLE_PATH; otherwise we probe. */
function chromePath(): string {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH
  if (env && existsSync(env)) return env
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ]
  const hit = candidates.find((p) => existsSync(p))
  if (!hit) throw new Error('no Chrome found — set PUPPETEER_EXECUTABLE_PATH')
  return hit
}

/** The weekend, per day — the same read the app makes (see weather/modes.ts). */
async function forecast(): Promise<{ label: string; days: { label: string; hi: number; mode: Mode }[] } | null> {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.37&longitude=4.9&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FAmsterdam&forecast_days=7')
    const j = await r.json() as { daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] } }
    const { sat } = upcomingWeekend()
    const iso = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`
    const i = j.daily.time.indexOf(iso)
    if (i < 0) return null
    const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const days = [i, i + 1].filter((k) => k < j.daily.time.length).map((k) => {
      const d = new Date(`${j.daily.time[k]}T12:00:00`)
      return {
        label: SHORT[d.getDay()],
        hi: Math.round(j.daily.temperature_2m_max[k]),
        mode: classify(j.daily.temperature_2m_max[k], j.daily.precipitation_probability_max[k] ?? 0,
                       j.daily.temperature_2m_max[k] - j.daily.temperature_2m_min[k]),
      }
    })
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const sun = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1)
    const label = sat.getMonth() === sun.getMonth()
      ? `${sat.getDate()}–${sun.getDate()} ${M[sun.getMonth()]}`
      : `${sat.getDate()} ${M[sat.getMonth()]} – ${sun.getDate()} ${M[sun.getMonth()]}`
    return { label, days }
  } catch { return null }
}

/** 8 of 80 live picks carry a `venue` that is just their SOURCE name ("I amsterdam") — an upstream
 *  extraction fallback. On a poster that reads as a place, so drop it rather than print a wrong one. */
export function realVenue(p: Pick): string {
  const v = (p.venue || '').trim()
  return v && !(p.source || '').toLowerCase().includes(v.toLowerCase()) ? v : ''
}

/** The poster leads with the deck's OWN opening order — hand-set pile first, then the stamped serve
 *  order — so the graphic can never advertise a different front than the app deals. Imaged picks only. */
export function topPicks(picks: Pick[], count = COUNT): Pick[] {
  return [...picks]
    .sort((a, b) => {
      const ap = a.pilePos ?? Infinity, bp = b.pilePos ?? Infinity
      if (ap !== bp) return ap - bp
      return (a.servePos ?? Infinity) - (b.servePos ?? Infinity)
    })
    .filter((p) => p.image)
    .slice(0, count)
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** THE THUMBNAIL TREATMENT — `--thumb=<style>`, so the house look is one word rather than a re-cut.
 *  Each variant owns its own row padding: a taller thumb needs tighter rows or the 5 rows blow the
 *  1350px canvas and the footer clips (which is exactly what the first draft did). `rowPad` is sized
 *  so thumb + 2×pad stays under ~176px, the per-row budget for five rows. */
export type ThumbStyle = 'portrait' | 'square' | 'circle' | 'tall' | 'wide' | 'overlay' | 'none'
export const THUMBS: Record<ThumbStyle, { css: string; rowPad: number; onImage?: boolean; note: string }> = {
  portrait: { rowPad: 16, note: 'the shipped default — 4:5, matches the app’s card crop',
    css: 'width:100px;height:125px;border-radius:12px' },
  square:   { rowPad: 19, note: 'a cleaner index grid; crops wide photos hardest',
    css: 'width:116px;height:116px;border-radius:10px' },
  circle:   { rowPad: 19, note: 'softer, editorial; loses the most image to the crop',
    css: 'width:116px;height:116px;border-radius:50%' },
  tall:     { rowPad: 8,  note: 'photo-led — the biggest image the canvas allows',
    css: 'width:112px;height:152px;border-radius:12px' },
  wide:     { rowPad: 22, note: 'magazine/landscape; kindest to scenery, worst to portraits',
    css: 'width:172px;height:108px;border-radius:10px' },
  overlay:  { rowPad: 12, onImage: true, note: 'rank sits ON the photo — frees ~44px for the title',
    css: 'width:118px;height:140px;border-radius:12px' },
  none:     { rowPad: 26, note: 'type-only — no images to go wrong, most editorial',
    css: 'display:none' },
}


/** THE GROUND — the poster's field. `cream` is the landing's #faf8f3; the taupes push the paper
 *  warmer and heavier so the brand carries the graphic rather than the photos. */
export type Ground = 'cream' | 'taupe' | 'clay' | 'orange' | 'ink'
export const GROUNDS: Record<Ground, { bg: string; ink: string; mut: string; acc: string; line: string; scrim: string }> = {
  cream:  { bg: '#faf8f3', ink: '#1a1a1a', mut: '#6a655c', acc: '#ff4d1f', line: '#e7e3d8', scrim: 'rgba(0,0,0,.55)' },
  taupe:  { bg: '#ddd2c0', ink: '#1a1a1a', mut: '#6d6353', acc: '#c2310e', line: '#c6b9a4', scrim: 'rgba(0,0,0,.55)' },
  clay:   { bg: '#b9a992', ink: '#17140f', mut: '#4e463a', acc: '#8a2818', line: '#a5947c', scrim: 'rgba(0,0,0,.5)'  },
  orange: { bg: '#ff4d1f', ink: '#fff6f0', mut: 'rgba(255,246,240,.78)', acc: '#1a1a1a', line: 'rgba(255,246,240,.32)', scrim: 'rgba(0,0,0,.45)' },
  ink:    { bg: '#1a1a1a', ink: '#f4f1e9', mut: 'rgba(244,241,233,.62)', acc: '#ff4d1f', line: 'rgba(244,241,233,.22)', scrim: 'rgba(0,0,0,.5)'  },
}

/** THE LAYOUT — genuinely different posters, not one poster with a different thumbnail.
 *   list = the shipped five-row index · two = the weekend's top TWO, big
 *   one  = a single hero, full-bleed        · bare = no picks at all, pure brand + forecast */
export type Layout = 'list' | 'two' | 'one' | 'bare'
export interface PosterOpts { thumb?: ThumbStyle; layout?: Layout; ground?: Ground }

export function posterHtml(
  picks: Pick[],
  wx: Awaited<ReturnType<typeof forecast>>,
  fontDataUrl: string,
  opts: PosterOpts = {},
): string {
  const { thumb = 'portrait', layout = 'list', ground = 'cream' } = opts
  const T = THUMBS[thumb] ?? THUMBS.portrait
  const G = GROUNDS[ground] ?? GROUNDS.cream
  // a split weekend names both days — same rule the app uses (V.10.18)
  const split = !!wx && wx.days.length > 1 && (wx.days[0].mode !== wx.days[1].mode || Math.abs(wx.days[0].hi - wx.days[1].hi) >= 4)
  const temps = !wx ? ''
    : split ? wx.days.map((d) => `${d.label} ${d.hi}°`).join('<span class="dot">·</span>')
    : `${Math.max(...wx.days.map((d) => d.hi))}°`
  const meta = (p: Pick) => esc([realVenue(p), fixWhen(p.when || '')].filter(Boolean).join(' · '))
  const bg = (p: Pick) => (p.image ? ` style="background-image:url('${esc(p.image)}')"` : '')

  // ── the non-list layouts: a heavier masthead, a stronger ground, and far fewer picks ──────────
  if (layout !== 'list') {
    const shell = (body: string, css: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Familjen Grotesk';font-weight:700;src:url('${fontDataUrl}') format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px}
body{background:${G.bg};color:${G.ink};overflow:hidden;-webkit-font-smoothing:antialiased;
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;flex-direction:column}
.dsp{font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;letter-spacing:-.035em}
/* THE MASTHEAD — the brand at poster scale, not a caption. This is the "heavier branding" lever. */
.mast{flex:none;display:flex;align-items:center;gap:20px;font-size:72px;letter-spacing:-.03em}
.mast .d{width:30px;height:30px;border-radius:50%;background:${G.acc};flex:none}
.temps{flex:none;font-size:32px;font-weight:700;color:${G.acc};display:flex;align-items:center}
.temps .dot{opacity:.4;margin:0 14px;font-weight:400}
.foot{flex:none;display:flex;align-items:baseline;justify-content:space-between;
  border-top:3px solid ${G.ink};padding-top:24px}
.foot .u{font-size:34px}.foot .t{font-size:24px;color:${G.mut}}
${css}</style></head><body>${body}</body></html>`

    // TWO — the weekend's top two, each given a real photograph and a headline-sized title.
    if (layout === 'two') {
      const two = picks.slice(0, 2)
      return shell(`
        <div class="pad">
          <div class="mast dsp"><span class="d"></span>WKNDR</div>
          <div class="hd"><span class="date dsp">${esc(wx?.label ?? 'This weekend')}</span>${temps ? `<span class="temps">${temps}</span>` : ''}</div>
        </div>
        <div class="cards">${two.map((p, i) => `
          <div class="c"${bg(p)}>
            <span class="cn dsp">${i + 1}</span>
            <div class="ct"><div class="ct-h dsp">${esc(p.title)}</div><div class="ct-m">${meta(p)}</div></div>
          </div>`).join('')}
        </div>
        <div class="pad"><div class="foot"><span class="u dsp">app.wkndr.xyz</span><span class="t">Swipe. Save. Match.</span></div></div>`, `
.pad{padding:0 64px}
body{padding:64px 0 54px}
.hd{margin:36px 0 30px;display:flex;align-items:baseline;justify-content:space-between;gap:24px}
.date{font-size:104px;line-height:.9}
.cards{flex:1;min-height:0;display:flex;flex-direction:column;gap:22px;padding:0 64px 34px}
.c{flex:1;position:relative;border-radius:20px;overflow:hidden;background:${G.line} center/cover no-repeat;
  display:flex;flex-direction:column;justify-content:flex-end}
.c:after{content:'';position:absolute;inset:0;background:linear-gradient(to top,${G.scrim} 0%,rgba(0,0,0,.1) 52%,rgba(0,0,0,0) 78%)}
.cn{position:absolute;top:0;left:0;z-index:2;min-width:74px;height:74px;padding:0 18px;background:${G.acc};
  color:${ground === 'orange' ? '#fff6f0' : '#fff'};font-size:44px;display:flex;align-items:center;justify-content:center;
  border-radius:20px 0 20px 0}
.ct{position:relative;z-index:2;padding:34px 36px 32px;color:#fff}
.ct-h{font-size:58px;line-height:1.02;text-shadow:0 2px 18px rgba(0,0,0,.42)}
.ct-m{margin-top:12px;font-size:25px;color:rgba(255,255,255,.9);text-shadow:0 1px 10px rgba(0,0,0,.5)}`)
    }

    // ONE — a single hero. The most striking, and the least informative: one plan, one photograph.
    if (layout === 'one') {
      const p = picks[0]
      return shell(`
        <div class="hero"${bg(p)}><div class="hero-in">
          <div class="mast dsp"><span class="d"></span>WKNDR</div>
        </div></div>
        <div class="body">
          <div class="hd"><span class="date dsp">${esc(wx?.label ?? 'This weekend')}</span>${temps ? `<span class="temps">${temps}</span>` : ''}</div>
          <div class="kick">The one to do</div>
          <div class="title dsp">${esc(p.title)}</div>
          <div class="tmeta">${meta(p)}</div>
          <div class="foot"><span class="u dsp">app.wkndr.xyz</span><span class="t">Swipe. Save. Match.</span></div>
        </div>`, `
.hero{flex:none;height:790px;position:relative;background:${G.line} center/cover no-repeat}
.hero:after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.5) 0%,rgba(0,0,0,0) 42%)}
.hero-in{position:relative;z-index:2;padding:60px 64px;color:#fff}
.hero-in .d{background:${G.acc}}
.body{flex:1;min-height:0;display:flex;flex-direction:column;padding:44px 64px 54px}
.hd{display:flex;align-items:baseline;justify-content:space-between;gap:24px}
.date{font-size:78px;line-height:.92}
.kick{margin:30px 0 10px;font-size:22px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${G.acc}}
.title{font-size:82px;line-height:.98}
.tmeta{margin-top:16px;font-size:27px;color:${G.mut}}
.foot{margin-top:auto}`)
    }

    // BARE — no picks at all. The weekend, the sky, and the brand: a teaser you send on a Thursday.
    return shell(`
      <div class="wrap">
        <div class="mast dsp"><span class="d"></span>WKNDR</div>
        <div class="mid">
          <div>
            <div class="kick">This weekend in Amsterdam</div>
            <div class="date dsp">${esc(wx?.label ?? 'This weekend')}</div>
            ${temps ? `<div class="temps big">${temps}</div>` : ''}
          </div>
          <div class="tag dsp">Nothing left<br>to plan.</div>
        </div>
        <div class="foot"><span class="u dsp">app.wkndr.xyz</span><span class="t">Weather permitting.</span></div>
      </div>`, `
.wrap{flex:1;display:flex;flex-direction:column;padding:70px 64px 54px}
.mid{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between;padding:18px 0 58px}
.kick{font-size:24px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${G.mut};margin-bottom:22px}
.date{font-size:190px;line-height:.84;letter-spacing:-.05em}
.temps.big{margin-top:24px;font-size:54px}
.tag{font-size:96px;line-height:.94;color:${G.acc}}`)
  }
  const rows = picks.map((p, i) => `
    <li class="row">
      ${T.onImage ? '' : `<span class="num">${i + 1}</span>`}
      <span class="thumb"${p.image ? ` style="background-image:url('${esc(p.image)}')"` : ''}>${
        T.onImage ? `<span class="onnum">${i + 1}</span>` : ''}</span>
      <span class="rt">
        <span class="rtitle">${esc(p.title)}</span>
        <span class="rmeta">${esc([realVenue(p), fixWhen(p.when || '')].filter(Boolean).join(' · '))}</span>
      </span>
    </li>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Familjen Grotesk';font-weight:700;src:url('${fontDataUrl}') format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px}
/* overflow:hidden is a GUARD, not the layout: the sizes below are budgeted to fit 1350px with
   room to spare (the first cut overflowed by ~70px and clipped the footer clean off). */
body{background:${G.bg};color:${G.ink};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
  padding:70px 68px 58px;display:flex;flex-direction:column;overflow:hidden;-webkit-font-smoothing:antialiased}
.mark{flex:none;display:flex;align-items:center;gap:14px;font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;
  font-weight:700;font-size:34px;letter-spacing:-.02em}
.mark .d{width:15px;height:15px;border-radius:50%;background:${G.acc}}
.when{flex:none;margin-top:38px;font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;
  font-size:88px;line-height:.94;letter-spacing:-.035em}
.temps{flex:none;margin-top:14px;font-size:30px;font-weight:700;letter-spacing:-.01em;color:${G.acc};display:flex;align-items:center}
.temps .dot{opacity:.35;margin:0 13px;font-weight:400}
.rule{flex:none;margin:30px 0 4px;height:3px;background:${G.ink}}
/* space-between: the rows spread to fill whatever height is left, so the poster stays balanced
   whether it carries 4 picks or 6 */
ul{list-style:none;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between}
.row{display:flex;align-items:center;gap:24px;padding:${T.rowPad}px 0;border-bottom:1px solid ${G.line}}
.row:last-child{border-bottom:0}
.num{flex:none;width:44px;font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;
  font-size:32px;color:${G.acc};letter-spacing:-.02em}
.thumb{flex:none;position:relative;background:${G.line} center/cover no-repeat;${T.css}}
/* the overlay variant's rank — a solid chip so it reads on any photo, light or dark */
.onnum{position:absolute;left:0;top:0;min-width:44px;height:44px;padding:0 10px;border-radius:12px 0 12px 0;
  background:${G.acc};color:#fff;font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;
  font-size:26px;display:flex;align-items:center;justify-content:center;letter-spacing:-.02em}
.rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.rtitle{font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:36px;
  line-height:1.06;letter-spacing:-.026em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rmeta{font-size:22px;line-height:1.25;color:${G.mut};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.foot{flex:none;margin-top:26px;padding-top:22px;border-top:3px solid ${G.ink};display:flex;align-items:baseline;justify-content:space-between}
.foot .u{font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:33px;letter-spacing:-.02em}
.foot .t{font-size:23px;color:${G.mut}}
</style></head><body>
<div class="mark"><span class="d"></span>WKNDR</div>
<div class="when">${esc(wx?.label ?? 'This weekend')}</div>
${temps ? `<div class="temps">${temps}</div>` : ''}
<div class="rule"></div>
<ul>${rows}</ul>
<div class="foot"><span class="u">app.wkndr.xyz</span><span class="t">Swipe. Save. Match.</span></div>
</body></html>`
}

// ── run ───────────────────────────────────────────────────────────────────────
// import.meta.main: importing this module (the unit tests do) must never launch a browser.
if (import.meta.main) {
const root = join(import.meta.dir, '..')
const feed = JSON.parse(readFileSync(join(root, `public/data/picks.${CITY}.json`), 'utf8')) as { picks: Pick[] }

const picks = topPicks(feed.picks)
if (picks.length < COUNT) throw new Error(`only ${picks.length} imaged picks — refusing to publish a thin poster`)

const wx = await forecast()
const font = readFileSync(join(root, 'src/assets/fonts/familjen-grotesk-700.woff2')).toString('base64')
const style = (arg('thumb') ?? 'portrait') as ThumbStyle
const layout = (arg('layout') ?? 'list') as Layout
const ground = (arg('ground') ?? 'cream') as Ground
const page$ = posterHtml(picks, wx, `data:font/woff2;base64,${font}`, { thumb: style, layout, ground })

const browser = await puppeteer.launch({ executablePath: chromePath(), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await page.setContent(page$, { waitUntil: 'networkidle0', timeout: 45_000 })
  await page.evaluateHandle('document.fonts.ready')
  const shot = await page.screenshot({ type: 'png' }) as Buffer

  const dir = join(root, 'public/share')
  mkdirSync(dir, { recursive: true })
  const { sat } = upcomingWeekend()
  const key = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`
  const out = arg('out')
  if (out) {                                        // a one-off render (variant previews) — don't touch the live poster
    writeFileSync(out, shot)
  } else {
    writeFileSync(join(dir, 'weekend.png'), shot)   // the stable link
    writeFileSync(join(dir, `${key}.png`), shot)    // the dated archive
  }
  console.log(`✓ poster ${CITY} ${key} · ${layout}/${ground} · thumb=${style} · ${picks.length} picks · ${(shot.length / 1024).toFixed(0)}KB${out ? ` → ${out}` : ''}`)
  console.log(`  ${picks.map((p) => p.title).join(' · ')}`)
} finally {
  await browser.close()
}
}
