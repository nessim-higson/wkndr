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

export function posterHtml(
  picks: Pick[],
  wx: Awaited<ReturnType<typeof forecast>>,
  fontDataUrl: string,
  thumb: ThumbStyle = 'portrait',
): string {
  const T = THUMBS[thumb] ?? THUMBS.portrait
  // a split weekend names both days — same rule the app uses (V.10.18)
  const split = !!wx && wx.days.length > 1 && (wx.days[0].mode !== wx.days[1].mode || Math.abs(wx.days[0].hi - wx.days[1].hi) >= 4)
  const temps = !wx ? ''
    : split ? wx.days.map((d) => `${d.label} ${d.hi}°`).join('<span class="dot">·</span>')
    : `${Math.max(...wx.days.map((d) => d.hi))}°`
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
body{background:#faf8f3;color:#1a1a1a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
  padding:70px 68px 58px;display:flex;flex-direction:column;overflow:hidden;-webkit-font-smoothing:antialiased}
.mark{flex:none;display:flex;align-items:center;gap:14px;font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;
  font-weight:700;font-size:34px;letter-spacing:-.02em}
.mark .d{width:15px;height:15px;border-radius:50%;background:#ff4d1f}
.when{flex:none;margin-top:38px;font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;
  font-size:88px;line-height:.94;letter-spacing:-.035em}
.temps{flex:none;margin-top:14px;font-size:30px;font-weight:700;letter-spacing:-.01em;color:#8a2818;display:flex;align-items:center}
.temps .dot{opacity:.35;margin:0 13px;font-weight:400}
.rule{flex:none;margin:30px 0 4px;height:3px;background:#1a1a1a}
/* space-between: the rows spread to fill whatever height is left, so the poster stays balanced
   whether it carries 4 picks or 6 */
ul{list-style:none;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between}
.row{display:flex;align-items:center;gap:24px;padding:${T.rowPad}px 0;border-bottom:1px solid #e7e3d8}
.row:last-child{border-bottom:0}
.num{flex:none;width:44px;font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;
  font-size:32px;color:#ff4d1f;letter-spacing:-.02em}
.thumb{flex:none;position:relative;background:#e7e3d8 center/cover no-repeat;${T.css}}
/* the overlay variant's rank — a solid chip so it reads on any photo, light or dark */
.onnum{position:absolute;left:0;top:0;min-width:44px;height:44px;padding:0 10px;border-radius:12px 0 12px 0;
  background:#ff4d1f;color:#fff;font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;
  font-size:26px;display:flex;align-items:center;justify-content:center;letter-spacing:-.02em}
.rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.rtitle{font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:36px;
  line-height:1.06;letter-spacing:-.026em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rmeta{font-size:22px;line-height:1.25;color:#6a655c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.foot{flex:none;margin-top:26px;padding-top:22px;border-top:3px solid #1a1a1a;display:flex;align-items:baseline;justify-content:space-between}
.foot .u{font-family:'Familjen Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:33px;letter-spacing:-.02em}
.foot .t{font-size:23px;color:#6a655c}
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
const page$ = posterHtml(picks, wx, `data:font/woff2;base64,${font}`, style)

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
  console.log(`✓ poster ${CITY} ${key} · thumb=${style} · ${picks.length} picks · ${(shot.length / 1024).toFixed(0)}KB${out ? ` → ${out}` : ''}`)
  console.log(`  ${picks.map((p) => p.title).join(' · ')}`)
} finally {
  await browser.close()
}
}
