// Ported from prototypes/wkndr-riso/index.html (look key `riso`) — poster grid +
// arcs + a per-weather signature motif. UI removed; default P values fixed; weather
// driven by setMode(); fixed seed (1); variants fixed at default 0.
import type { Mode } from '../../types'
import { modeToKey, type LookRenderer } from './types'

type WKey = 'sun' | 'rain' | 'cloud' | 'wind' | 'storm' | 'snow'
type Ctx = CanvasRenderingContext2D

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function col(hex: string, a: number) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

interface ModeDef {
  label: string; bg: string[]; cols: string[]; lines: string[]; arcs?: number; motif: string
}
const MODES: Record<WKey, ModeDef> = {
  sun: { label: 'Sun', bg: ['#d83218', '#f0701e', '#f4b24a', '#f2e6cf'], cols: ['#e63320', '#f3851f', '#f3c218', '#f2e6cf'], lines: ['#ffffff', '#e63320', '#f3c218'], arcs: 0, motif: 'glow' },
  rain: { label: 'Rain', bg: ['#3f4f68', '#7286a0', '#c2ccd6', '#e3e8ec'], cols: ['#36529a', '#6b8fb8', '#aebccb', '#e7ebef'], lines: ['#ffffff', '#2b4ad6'], motif: 'streaks' },
  cloud: { label: 'Cloud', bg: ['#aab4bf', '#cfd5db', '#eceef0'], cols: ['#8d99a6', '#b4bdc6', '#dfe3e7', '#eceef0'], lines: ['#ffffff', '#7d8893'], motif: 'bands' },
  wind: { label: 'Wind', bg: ['#7aa589', '#b2ceac', '#e7ecdc'], cols: ['#3f6b5e', '#7fae8a', '#cfe0c4', '#e7ecdc'], lines: ['#2f5c44', '#ffffff'], arcs: 0, motif: 'sweep' },
  storm: { label: 'Storm', bg: ['#211a3a', '#3a2c5c', '#544a72'], cols: ['#1d1733', '#4a2d7a', '#e63320', '#8a7fb0'], lines: ['#ffe45e', '#ffffff'], arcs: 0, motif: 'storm' },
  snow: { label: 'Snow', bg: ['#cfe0ef', '#e6eef6', '#f6f9fc'], cols: ['#b8cbe0', '#d4e0ee', '#eef4fa', '#ffffff'], lines: ['#ffffff', '#9fb6d4'], motif: 'rings' },
}

const P = { density: 1, grain: 0.5, motion: 0.6, timeOfDay: 0.5, shimmer: false, seed: 1 }
const VAR = { wind: 0, storm: 0 }   // fixed at default (no reroll/variant in app)

export class RisoRenderer implements LookRenderer {
  private host!: HTMLElement
  private c!: HTMLCanvasElement
  private ctx!: Ctx
  private comp = document.createElement('canvas')
  private cctx!: Ctx
  private W = 1; private H = 1
  private DPR = 1
  private mode: WKey = 'sun'
  private raf = 0
  private t0 = performance.now()
  private reduced = false
  private grainTile: HTMLCanvasElement | null = null

  private rng = mulberry32(1)
  private rr = (a: number, b: number) => a + this.rng() * (b - a)
  private pick = <T,>(arr: T[]): T => arr[(this.rng() * arr.length) | 0]

  mount(host: HTMLElement, mode: Mode) {
    this.host = host
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.c = document.createElement('canvas')
    this.c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    host.prepend(this.c)   // behind the grain + vignette overlays
    this.ctx = this.c.getContext('2d')!
    this.cctx = this.comp.getContext('2d')!
    this.mode = modeToKey(mode, { sun: 'sun', wind: 'wind', cloud: 'cloud', rain: 'rain', storm: 'storm' })
    this.resize()
    document.addEventListener('visibilitychange', this.onVis)
  }

  setMode(mode: Mode) {
    this.mode = modeToKey(mode, { sun: 'sun', wind: 'wind', cloud: 'cloud', rain: 'rain', storm: 'storm' })
    this.render()
  }

  resize() {
    this.DPR = Math.min(1.5, window.devicePixelRatio || 1)
    this.W = this.host.clientWidth || window.innerWidth
    this.H = this.host.clientHeight || window.innerHeight
    this.c.width = Math.floor(this.W * this.DPR); this.c.height = Math.floor(this.H * this.DPR)
    this.buildGrain()
    this.render()
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVis)
    this.c.remove()
  }

  private onVis = () => {
    if (document.hidden) cancelAnimationFrame(this.raf)
    else this.render()
  }

  // ---- modular colour-field panels (the poster grid) ----
  private edges(n: number, total: number) {
    const ws: number[] = []; let s = 0; for (let i = 0; i < n; i++) { const w = 0.55 + this.rng(); ws.push(w); s += w }
    const e = [0]; let acc = 0; for (let i = 0; i < n; i++) { acc += ws[i] / s * total; e.push(acc) } e[n] = total; return e
  }
  private drawGrid(g: Ctx, m: ModeDef) {
    const rng = this.rng, rr = this.rr, pick = this.pick, W = this.W, H = this.H
    const fade = m.bg[m.bg.length - 1]
    const nCols = 2 + (rng() < 0.55 ? 1 : 0)
    const xs = this.edges(nCols, W)
    for (let i = 0; i < nCols; i++) {
      const nRows = 1 + ((rng() * 3 * P.density) | 0) % 3
      const ys = this.edges(Math.max(1, nRows), H)
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i], y0 = ys[j], x1 = xs[i + 1], y1 = ys[j + 1], w = x1 - x0, h = y1 - y0
        const r = rng()
        if (r < 0.38) continue
        const cc = pick(m.cols)
        if (rng() < 0.62) {
          const flip = rng() < 0.5
          const grad = g.createLinearGradient(0, y0, 0, y1)
          grad.addColorStop(0, flip ? cc : fade); grad.addColorStop(1, flip ? fade : cc)
          g.fillStyle = grad; g.fillRect(x0, y0, w, h)
        } else {
          const sw = w * rr(0.25, 0.55), sx = x0 + rng() * (w - sw)
          g.save(); g.filter = `blur(${Math.max(2, w * 0.05)}px)`
          const grad = g.createLinearGradient(0, y0, 0, y1)
          grad.addColorStop(0, cc); grad.addColorStop(1, fade)
          g.fillStyle = grad; g.fillRect(sx, y0, sw, h); g.restore()
        }
      }
    }
  }

  private drawArcs(g: Ctx, m: ModeDef, count: number) {
    const rng = this.rng, rr = this.rr, pick = this.pick, W = this.W, H = this.H
    for (let i = 0; i < count; i++) {
      const cx = rr(-0.2, 1.2) * W, cy = rr(-0.2, 1.2) * H, rad = rr(0.3, 0.8) * W
      g.strokeStyle = col(pick(m.lines), rr(0.5, 0.85)); g.lineWidth = rr(1.4, 2.8) * this.DPR
      g.beginPath()
      if (rng() < 0.5) g.arc(cx, cy, rad, 0, 6.2832)
      else { const a0 = rng() * 6.2832; g.arc(cx, cy, rad, a0, a0 + rr(1.0, 4.2)) }
      g.stroke()
    }
  }

  // ---- wind variants ----
  private windCurves(g: Ctx, m: ModeDef, t: number) {
    const rng = this.rng, rr = this.rr, W = this.W, H = this.H
    const n = Math.round((3 + rng() * 2) * P.density) + 2; g.lineCap = 'round'; g.setLineDash([])
    for (let i = 0; i < n; i++) {
      const baseY = rr(0.1, 0.9) * H, ph = i * 1.3, off = (rng() < 0.5 ? 0 : 0.025) * H
      const bow = (rr(-0.26, 0.26) + 0.09 * Math.sin(t * 0.6 + ph)) * H, updown = rr(-0.12, 0.12) * H
      g.strokeStyle = col(rng() < 0.5 ? m.lines[0] : m.lines[1], rr(0.4, 0.75)); g.lineWidth = rr(2, 5) * this.DPR
      g.beginPath(); g.moveTo(-0.12 * W, baseY + off)
      g.bezierCurveTo(0.34 * W, baseY + bow + off, 0.66 * W, baseY - bow * 0.55 + off, 1.12 * W, baseY + updown + off); g.stroke()
    }
  }
  private windFlecks(g: Ctx, m: ModeDef, t: number) {
    const rng = this.rng, rr = this.rr, W = this.W, H = this.H
    const lanes = Math.round((5 + rng() * 4) * P.density) + 2; g.lineCap = 'round'
    for (let i = 0; i < lanes; i++) {
      const baseY = rr(0.06, 0.94) * H, ph = i * 1.1, bow = (rr(-0.2, 0.2) + 0.06 * Math.sin(t * 0.5 + ph)) * H
      g.setLineDash([rr(2, 5) * this.DPR, rr(10, 26) * this.DPR])
      g.lineDashOffset = -t * 200 * this.DPR - i * 30
      g.strokeStyle = col(rng() < 0.6 ? '#ffffff' : m.lines[0], rr(0.45, 0.8)); g.lineWidth = rr(1.4, 3) * this.DPR
      g.beginPath(); g.moveTo(-0.12 * W, baseY)
      g.bezierCurveTo(0.34 * W, baseY + bow, 0.66 * W, baseY - bow * 0.5, 1.12 * W, baseY + rr(-0.08, 0.08) * H); g.stroke()
    }
    g.setLineDash([])
  }
  private windStreaks(g: Ctx, m: ModeDef, t: number) {
    const rng = this.rng, rr = this.rr, W = this.W, H = this.H
    const n = Math.round((5 + rng() * 4) * P.density) + 2
    for (let i = 0; i < n; i++) {
      const y = rr(0.05, 0.95) * H, lw = rr(4, 12) * this.DPR, lean = rr(-0.05, 0.05) * H
      const drift = (((t * 0.08 + rng()) % 1.5) - 0.25) * W, x0 = -0.25 * W + drift, len = rr(0.5, 1.0) * W
      const cc = rng() < 0.5 ? '#ffffff' : m.lines[0]
      g.save(); g.lineCap = 'round'; g.lineWidth = lw
      const grad = g.createLinearGradient(x0, 0, x0 + len, 0)
      grad.addColorStop(0, col(cc, 0)); grad.addColorStop(0.5, col(cc, rr(0.3, 0.6))); grad.addColorStop(1, col(cc, 0))
      g.strokeStyle = grad; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + len, y + lean); g.stroke(); g.restore()
    }
  }

  // ---- storm variants ----
  private stormShards(g: Ctx, m: ModeDef, t: number) {
    const rng = this.rng, rr = this.rr, pick = this.pick, W = this.W, H = this.H
    g.save(); g.filter = `blur(${H * 0.045}px)`
    const mn = 3 + ((rng() * 3 * P.density) | 0)
    for (let i = 0; i < mn; i++) {
      g.fillStyle = col(m.cols[0], rr(0.25, 0.5))
      const jx = Math.sin(t * 0.8 + i * 2) * 0.03 * W, jy = Math.cos(t * 0.6 + i) * 0.022 * H
      g.beginPath(); g.ellipse(rr(0.05, 0.95) * W + jx, rr(-0.05, 0.5) * H + jy, rr(0.15, 0.42) * W, rr(0.08, 0.2) * H, rr(0, 3.14), 0, 6.2832); g.fill()
    }
    g.restore()
    const sw = (rr(0.05, 0.1) + 0.02 * Math.sin(t * 0.7)) * W, sx = rr(0.3, 0.66) * W
    g.save(); g.filter = `blur(${W * 0.012}px)`
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, col('#e63320', 0.85)); grad.addColorStop(0.5, col('#e63320', 0.3)); grad.addColorStop(1, col('#e63320', 0.6))
    g.fillStyle = grad; g.fillRect(sx + Math.sin(t * 1.1) * 0.01 * W, 0, sw, H); g.restore()
    const sh = 5 + ((rng() * 4 * P.density) | 0); g.lineCap = 'round'
    const SC = [m.lines[0], m.lines[1], '#e63320', '#8a7fb0']
    for (let s = 0; s < sh; s++) {
      const cx = rng() * W, cy = rng() * H, ang = rng() * 3.1416 + 0.18 * Math.sin(t * 2.2 + s * 3), len = rr(0.3, 1.0) * H, jit = Math.sin(t * 3 + s) * 5 * this.DPR
      g.strokeStyle = col(pick(SC), rr(0.35, 0.9)); g.lineWidth = rr(1, 4) * this.DPR
      g.beginPath(); g.moveTo(cx - Math.cos(ang) * len + jit, cy - Math.sin(ang) * len); g.lineTo(cx + Math.cos(ang) * len + jit, cy + Math.sin(ang) * len); g.stroke()
    }
    const fn = 2 + ((rng() * 3) | 0)
    for (let f = 0; f < fn; f++) {
      let x = rng() * W, y = rng() * rr(0, 0.5) * H; const segs = 3 + ((rng() * 4) | 0), step = rr(0.05, 0.12) * H
      g.strokeStyle = col(pick(['#ffe45e', '#ffffff', '#e63320']), rr(0.5, 0.95)); g.lineWidth = rr(1.5, 3) * this.DPR
      g.beginPath(); g.moveTo(x, y)
      for (let k = 0; k < segs; k++) { x += rr(-0.09, 0.09) * W + Math.sin(t * 4 + k) * 3 * this.DPR; y += step; g.lineTo(x, y) } g.stroke()
    }
    const gn = 2 + ((rng() * 3) | 0)
    for (let b = 0; b < gn; b++) {
      const bx = rng() * W, by = rng() * H, bw = rr(0.04, 0.16) * W, bh = rr(0.02, 0.09) * H
      const offx = (Math.sin(t * 1.5 + b) > 0.6) ? rr(4, 12) * this.DPR : 0
      g.globalAlpha = rr(0.3, 0.7); g.fillStyle = pick(['#e63320', '#4a2d7a', '#ffe45e', '#8a7fb0'])
      g.fillRect(bx + offx, by, bw, bh)
    }
    g.globalAlpha = 1
  }
  private stormGlitch(g: Ctx, m: ModeDef, t: number) {
    const rng = this.rng, rr = this.rr, pick = this.pick, W = this.W, H = this.H
    g.save(); g.filter = `blur(${H * 0.05}px)`
    for (let i = 0; i < 3 + ((rng() * 2) | 0); i++) {
      g.fillStyle = col(m.cols[0], rr(0.3, 0.55))
      g.beginPath(); g.ellipse(rng() * W + Math.sin(t * 0.7 + i) * 0.03 * W, rng() * H, rr(0.2, 0.45) * W, rr(0.1, 0.22) * H, 0, 0, 6.2832); g.fill()
    }
    g.restore()
    const slices = Math.round((8 + rng() * 9) * P.density)
    for (let i = 0; i < slices; i++) {
      const sy = rng() * (H - 10), sh = rr(0.008, 0.045) * H, off = (rr(-0.1, 0.1) + Math.sin(t * 2.2 + i * 1.7) * 0.045) * W
      g.globalAlpha = rr(0.55, 0.95)
      g.drawImage(this.comp, 0, sy * this.DPR, this.comp.width, sh * this.DPR, off, sy, W, sh)
    }
    g.globalAlpha = 1
    for (let i = 0; i < 3 + ((rng() * 3) | 0); i++) {
      const bx = rng() * W, by = rng() * H, bw = rr(0.05, 0.22) * W, bh = rr(0.008, 0.05) * H
      g.globalAlpha = rr(0.25, 0.6); g.fillStyle = pick(['#e63320', '#4a2d7a', '#ffe45e', '#8a7fb0', '#ffffff'])
      g.fillRect(bx + Math.sin(t * 1.6 + i) * 0.02 * W, by, bw, bh)
    }
    g.globalAlpha = 1
    for (let f = 0; f < 1 + ((rng() * 2) | 0); f++) {
      let x = rng() * W, y = rng() * 0.5 * H; const segs = 3 + ((rng() * 3) | 0), step = rr(0.05, 0.12) * H
      g.strokeStyle = col(pick(['#ffe45e', '#ffffff']), rr(0.6, 0.95)); g.lineWidth = rr(1.5, 3) * this.DPR; g.lineCap = 'round'
      g.beginPath(); g.moveTo(x, y); for (let k = 0; k < segs; k++) { x += rr(-0.08, 0.08) * W; y += step; g.lineTo(x, y) } g.stroke()
    }
  }

  // ---- signature geometry per weather ----
  private sig(g: Ctx, m: ModeDef, t: number) {
    const rng = this.rng, rr = this.rr, pick = this.pick, W = this.W, H = this.H
    switch (m.motif) {
      case 'glow': {
        const a = ((P.timeOfDay + t * 0.02) % 1 + 1) % 1
        const cx = (0.12 + a * 0.76) * W, cy = (0.58 - Math.sin(a * Math.PI) * 0.44) * H, R = rr(0.18, 0.28) * Math.min(W, H)
        const breathe = 1 + 0.09 * Math.sin(t * 1.1)
        g.save(); g.globalCompositeOperation = 'lighter'
        const gl = g.createRadialGradient(cx, cy, 0, cx, cy, R * 2.1 * breathe)
        gl.addColorStop(0, col('#fff2cf', 0.55 + 0.12 * Math.sin(t * 1.1))); gl.addColorStop(0.45, col('#ffce6e', 0.2)); gl.addColorStop(1, col('#fff2cf', 0))
        g.fillStyle = gl; g.fillRect(0, 0, W, H); g.restore()
        g.strokeStyle = col('#ffffff', 0.7); g.lineWidth = rr(1.6, 2.6) * this.DPR
        g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.stroke()
        break
      }
      case 'streaks': {
        const fade = m.bg[m.bg.length - 1]
        const wn = 2 + ((rng() * 2 * P.density) | 0)
        for (let i = 0; i < wn; i++) {
          const x = rng() * W, w = rr(0.04, 0.11) * W, top = rr(-0.1, 0.1) * H, len = rr(0.7, 1.15) * H
          g.save(); g.filter = `blur(${Math.max(2, w * 0.4)}px)`
          const grad = g.createLinearGradient(0, top, 0, top + len); grad.addColorStop(0, col(pick(m.cols), rr(0.32, 0.55))); grad.addColorStop(1, col(fade, 0))
          g.fillStyle = grad; g.fillRect(x, top, w, len); g.restore()
        }
        const n = Math.round((16 + rng() * 16) * P.density)
        for (let i = 0; i < n; i++) {
          const x = rng() * W, dotted = rng() < 0.55
          g.strokeStyle = col(rng() < 0.35 ? m.lines[1] : m.lines[0], rr(0.18, 0.5)); g.lineWidth = rr(0.6, 1.5) * this.DPR
          if (dotted) { g.setLineDash([rr(2, 6) * this.DPR, rr(5, 20) * this.DPR]); g.lineDashOffset = -t * 90 * this.DPR } else g.setLineDash([])
          g.beginPath(); g.moveTo(x, rr(-0.1, 0.15) * H); g.lineTo(x, rr(0.7, 1.1) * H); g.stroke()
        }
        g.setLineDash([])
        break
      }
      case 'bands': {
        const n = Math.round((3 + rng() * 3) * P.density) + 1
        for (let i = 0; i < n; i++) {
          const y = rr(0.05, 0.92) * H, h = rr(0.05, 0.16) * H, dx = Math.sin(t * 0.18 + i * 1.3) * 0.05 * W
          g.save(); g.filter = `blur(${H * rr(0.02, 0.04)}px)`
          const grad = g.createLinearGradient(0, y, 0, y + h)
          grad.addColorStop(0, col(m.cols[0], 0)); grad.addColorStop(0.5, col(pick(m.cols), rr(0.4, 0.7))); grad.addColorStop(1, col(m.cols[0], 0))
          g.fillStyle = grad; g.fillRect(-0.18 * W + dx, y, 1.36 * W, h); g.restore()
        }
        break
      }
      case 'sweep': {
        const v = VAR.wind % 3
        if (v === 0) this.windCurves(g, m, t); else if (v === 1) this.windFlecks(g, m, t); else this.windStreaks(g, m, t)
        break
      }
      case 'storm': {
        const v = VAR.storm % 2
        if (v === 0) this.stormShards(g, m, t); else this.stormGlitch(g, m, t)
        break
      }
      case 'rings': {
        const n = Math.round((9 + rng() * 9) * P.density)
        for (let i = 0; i < n; i++) {
          const x = rng() * W, baseY = rng() * (H + 120) - 60, rad = rr(5, 30) * this.DPR
          const speed = (10 + rad * 0.7)
          const yy = ((baseY + t * speed) % (H + rad * 4)) - rad * 2
          const soft = rng() < 0.35
          g.save(); if (soft) g.filter = `blur(${rad * 0.55}px)`
          g.strokeStyle = col(rng() < 0.5 ? '#ffffff' : m.lines[1], rr(0.3, 0.65)); g.lineWidth = rr(1, 2) * this.DPR
          g.beginPath(); g.arc(x, yy, rad, 0, 6.2832); g.stroke()
          if (!soft && rng() < 0.3) { g.fillStyle = col('#ffffff', rr(0.3, 0.6)); g.beginPath(); g.arc(x, yy, rad * 0.28, 0, 6.2832); g.fill() }
          g.restore()
        }
        break
      }
    }
  }

  private compose() {
    this.rng = mulberry32(P.seed >>> 0)
    const m = MODES[this.mode]
    this.comp.width = this.c.width; this.comp.height = this.c.height
    const g = this.cctx; g.setTransform(this.DPR, 0, 0, this.DPR, 0, 0); g.clearRect(0, 0, this.W, this.H)
    const bg = g.createLinearGradient(0, 0, 0, this.H)
    m.bg.forEach((s, i) => bg.addColorStop(i / (m.bg.length - 1), s))
    g.fillStyle = bg; g.fillRect(0, 0, this.W, this.H)
    this.drawGrid(g, m)
    g.lineJoin = 'round'
    this.drawArcs(g, m, (m.arcs !== undefined) ? m.arcs : 1 + (this.rng() < 0.6 ? 1 : 0))
  }

  // ---- grain ----
  private buildGrain() {
    const s = 240, t = document.createElement('canvas'); t.width = s; t.height = s
    const p = t.getContext('2d')!, img = p.createImageData(s, s), d = img.data
    for (let i = 0; i < d.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255 }
    p.putImageData(img, 0, 0); this.grainTile = t
  }

  private present(t: number) {
    const ctx = this.ctx, m = MODES[this.mode]
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.c.width, this.c.height)
    ctx.drawImage(this.comp, 0, 0)
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0)
    this.rng = mulberry32((P.seed >>> 0) ^ 0x9e3779b9)
    this.sig(ctx, m, t)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (P.grain > 0.01 && this.grainTile) {
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = P.grain * 0.9
      const pat = ctx.createPattern(this.grainTile, 'repeat')!
      const ox = P.shimmer ? (Math.random() * 240 | 0) : 0, oy = P.shimmer ? (Math.random() * 240 | 0) : 0
      ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(ox, oy, this.c.width, this.c.height); ctx.restore()
    }
    const td = P.timeOfDay
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (td < 0.48) { ctx.globalAlpha = (0.48 - td) / 0.48 * 0.42; ctx.fillStyle = '#eef2f7'; ctx.fillRect(0, 0, this.c.width, this.c.height) }
    else if (td > 0.52) { ctx.globalAlpha = (td - 0.52) / 0.48 * 0.6; ctx.fillStyle = '#14101f'; ctx.fillRect(0, 0, this.c.width, this.c.height) }
    ctx.globalAlpha = 1
  }

  private loop = () => {
    const t = (performance.now() - this.t0) / 1000 * P.motion
    this.present(t)
    this.raf = requestAnimationFrame(this.loop)
  }
  private render() {
    this.compose()
    cancelAnimationFrame(this.raf)
    if (this.reduced || document.hidden) { this.present(0); return }
    if (P.motion > 0.001 || P.shimmer) this.loop(); else this.present(0)
  }
}
