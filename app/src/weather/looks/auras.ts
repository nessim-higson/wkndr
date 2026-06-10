// Ported from prototypes/wkndr-seasons/index.html (look key `auras`) — layered
// radial-gradient "orb / ringOrb" compositions per weather. UI removed; default P
// values are fixed constants; weather driven by setMode(); fixed seed (1).
import type { Mode } from '../../types'
import { modeToKey, type LookRenderer } from './types'

type WKey = 'sun' | 'rain' | 'cloud' | 'wind' | 'storm' | 'snow'

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const sm = (t: number) => t * t * (3 - 2 * t)

function rgba(hex: string, a: number) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
function mix(a: string, b: string, t: number) {
  a = a.replace('#', ''); b = b.replace('#', '')
  const c = [0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

interface Veil { x: number; y: number; sp: number }
interface Stream { x: number; y: number; len: number; th: number; tilt: number; sp: number; col: string; a: number }
interface Layout {
  sun: { cx: number; cy: number; r: number; halos: number; hx: number; hy: number }
  rain: { veils: Veil[]; px: number; py: number }
  cloud: { cx: number; cy: number; ring: number; core: number; lean: number }
  wind: { streams: Stream[] }
  storm: { edge: number; rW: number; cy: number; th0: number; fcx: number; fcy: number }
  snow: { ax: number; ay: number; bx: number; by: number; wx: number; wy: number }
}

const P = { scale: 1, motion: 0.6, grain: 0.12, seed: 1 }

export class AurasRenderer implements LookRenderer {
  private host!: HTMLElement
  private c!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private W = 1; private H = 1
  private DPR = 1
  private mode: WKey = 'sun'
  private raf = 0
  private t0 = performance.now()
  private reduced = false
  private grainTile: CanvasPattern | null = null
  private L!: Layout

  private rng = mulberry32(1)
  private rr = (a: number, b: number) => a + this.rng() * (b - a)

  mount(host: HTMLElement, mode: Mode) {
    this.host = host
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.c = document.createElement('canvas')
    this.c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    host.prepend(this.c)   // behind the grain + vignette overlays
    this.ctx = this.c.getContext('2d')!
    this.mode = modeToKey(mode, { sun: 'sun', wind: 'wind', cloud: 'cloud', rain: 'rain', storm: 'storm' })
    this.layout()
    this.resize()
    document.addEventListener('visibilitychange', this.onVis)
    this.render()
  }

  setMode(mode: Mode) {
    this.mode = modeToKey(mode, { sun: 'sun', wind: 'wind', cloud: 'cloud', rain: 'rain', storm: 'storm' })
    this.render()
  }

  resize() {
    this.DPR = Math.min(1.5, window.devicePixelRatio || 1)
    this.W = this.host.clientWidth || window.innerWidth
    this.H = this.host.clientHeight || window.innerHeight
    this.c.width = Math.floor(this.W * this.DPR)
    this.c.height = Math.floor(this.H * this.DPR)
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

  // ---- seeded per-weather layout (positions/sizes; t animates only) ----
  private layout() {
    const rng = this.rng = mulberry32(P.seed >>> 0)
    const rr = this.rr
    const veils: Veil[] = []; for (let i = 0; i < 3; i++) veils.push({ x: rr(0.12, 0.88), y: rr(0, 1), sp: rr(0.7, 1.3) })
    const streams: Stream[] = []; const ns = 3 + (rng() < 0.5 ? 1 : 0)
    for (let i = 0; i < ns; i++) streams.push({
      x: rng() * 1.5, y: 0.12 + (i + rr(0.1, 0.5)) / (ns + 0.6) * 0.8, len: rr(0.55, 0.9), th: rr(0.08, 0.18),
      tilt: rr(-0.07, -0.02), sp: rr(0.6, 1.4), col: ['#2f5c48', '#5a8c6e', '#8fae7a', '#f6f8ec'][(rng() * 4) | 0], a: rr(0.6, 0.9),
    })
    this.L = {
      sun: { cx: rr(0.34, 0.52), cy: rr(0.34, 0.48), r: rr(0.5, 0.62), halos: 2 + ((rng() * 2) | 0), hx: rr(-0.06, 0.02), hy: rr(-0.06, 0.02) },
      rain: { veils, px: rr(0.38, 0.62), py: rr(0.78, 0.92) },
      cloud: { cx: rr(0.42, 0.58), cy: rr(0.42, 0.58), ring: rr(0.92, 1.1), core: rr(0.5, 0.62), lean: rr(-0.04, 0.04) },
      wind: { streams },
      storm: { edge: rr(0.35, 0.55), rW: rr(1.3, 1.8), cy: rr(0.45, 0.6), th0: rr(0, 6.28), fcx: rr(0.05, 0.25), fcy: rr(0.15, 0.4) },
      snow: { ax: rr(0.2, 0.4), ay: rr(0.2, 0.4), bx: rr(0.6, 0.85), by: rr(0.3, 0.55), wx: rr(0.1, 0.35), wy: rr(0.7, 0.9) },
    }
  }

  // ---- finesse primitives (eased multi-stop gradients) ----
  private orb(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, aMax: number, p?: number) {
    p = p == null ? 0.32 : p
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    for (let i = 0; i <= 18; i++) {
      const t = i / 18
      const a = t <= p ? aMax : aMax * (1 - sm((t - p) / (1 - p)))
      gr.addColorStop(t, rgba(c, a))
    }
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill()
  }
  private orbEll(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: string, aMax: number, p: number, rot?: number) {
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(1, ry / rx)
    this.orb(g, 0, 0, rx, c, aMax, p); g.restore()
  }
  private ringOrb(g: CanvasRenderingContext2D, x: number, y: number, rIn: number, rOut: number, c: string, aMax: number) {
    const gr = g.createRadialGradient(x, y, 0, x, y, rOut)
    const tIn = Math.max(0.001, rIn / rOut)
    for (let i = 0; i <= 20; i++) {
      const t = i / 20; let a = 0
      if (t > tIn) { const u = (t - tIn) / (1 - tIn); a = u < 0.45 ? aMax * sm(u / 0.45) : aMax * (1 - sm((u - 0.45) / 0.55)) }
      gr.addColorStop(t, rgba(c, a))
    }
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rOut, 0, 6.2832); g.fill()
  }

  private bgFill(top: string, bottom: string) {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, this.H)
    for (let i = 0; i <= 12; i++) { const t = i / 12; g.addColorStop(t, mix(top, bottom, sm(t))) }
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H)
  }

  // ---- weather compositions (one vast form each) ----
  private weather(t: number) {
    const ctx = this.ctx, W = this.W, H = this.H, L = this.L
    switch (this.mode) {
      case 'sun': {
        const s = L.sun, u = Math.min(W, H) * P.scale
        this.bgFill('#a9cde9', '#c2dcee')
        const cx = W * s.cx, cy = H * s.cy, R = u * s.r
        const breathe = 1 + 0.015 * Math.sin(t * 0.6)
        for (let i = 0; i < s.halos; i++) {
          const ph = (t * 0.12 + i / s.halos) % 1
          const hr = R * (1.25 + ph * 1.1)
          this.ringOrb(ctx, cx, cy, hr * 0.86, hr, '#f5b06e', 0.16 * (1 - sm(ph)))
        }
        this.orb(ctx, cx, cy, R * 1.5 * breathe, '#f0a0a0', 0.42, 0.1)
        this.orb(ctx, cx, cy, R * 1.05 * breathe, '#f57f22', 0.95, 0.22)
        this.orb(ctx, cx + W * s.hx, cy + H * s.hy, R * 0.62 * breathe, '#ffd24a', 0.95, 0.2)
        break
      }
      case 'rain': {
        const s = L.rain, u = Math.min(W, H) * P.scale
        this.bgFill('#6d8aa6', '#33506b')
        for (const v of s.veils) {
          const y = ((((v.y + t * 0.03 * v.sp) % 1.4) + 1.4) % 1.4 - 0.2) * H
          this.orbEll(ctx, W * v.x, y, u * 0.3, u * 0.62, '#c9dcec', 0.32, 0.05)
        }
        const pb = 1 + 0.02 * Math.sin(t * 0.5)
        this.orb(ctx, W * s.px, H * s.py, u * 0.8, '#1d3a6e', 0.85, 0.15)
        this.orb(ctx, W * s.px, H * (s.py + 0.03), u * 0.42 * pb, '#7fc4d8', 0.55, 0.15)
        break
      }
      case 'cloud': {
        const s = L.cloud, u = Math.min(W, H) * P.scale
        this.bgFill('#e9e8e3', '#d4d7da')
        const glow = 1 + 0.025 * Math.sin(t * 0.4)
        const cx = W * (s.cx + s.lean * Math.sin(t * 0.15)), cy = H * s.cy
        this.ringOrb(ctx, cx, cy, u * s.ring * 0.42, u * s.ring * 1.08, '#76838f', 0.85)
        this.orb(ctx, cx, cy, u * s.core * 0.75 * glow, '#f2efe6', 0.95, 0.2)
        this.orb(ctx, cx + u * 0.05, cy - u * 0.04, u * s.core * 0.4 * glow, '#ecdcb4', 0.5, 0.2)
        break
      }
      case 'wind': {
        const s = L.wind, u = Math.min(W, H) * P.scale
        this.bgFill('#c9dcc4', '#e9efdd')
        for (const k of s.streams) {
          const x = ((((k.x + t * 0.035 * k.sp) % 1.6) + 1.6) % 1.6 - 0.3) * W
          this.orbEll(ctx, x, H * k.y, u * k.len, u * k.th, k.col, k.a, 0.22, k.tilt)
        }
        break
      }
      case 'storm': {
        const s = L.storm, u = Math.min(W, H) * P.scale
        this.bgFill('#241c48', '#0d0922')
        this.orb(ctx, W * s.fcx, H * s.fcy + H * 0.02 * Math.sin(t * 0.3), u * 0.85, '#3a2c6e', 0.5, 0.1)
        this.orb(ctx, W * (s.fcx - 0.05), H * (s.fcy + 0.5), u * 0.7, '#1f4458', 0.45, 0.1)
        const R = W * s.rW, cx = W * s.edge + R, cy = H * s.cy
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip()
        const ig = ctx.createLinearGradient(0, 0, 0, H)
        const bands: [string, number][] = [['#1a1440', 0], ['#3a1e6e', 0.35], ['#7a2360', 0.6], ['#c2452a', 0.82], ['#f2b03a', 1]]
        for (let i = 0; i < bands.length - 1; i++) for (let k = 0; k <= 6; k++) {
          const t2 = k / 6
          ig.addColorStop(bands[i][1] + (bands[i + 1][1] - bands[i][1]) * t2, mix(bands[i][0], bands[i + 1][0], sm(t2)))
        }
        ctx.fillStyle = ig; ctx.fillRect(0, 0, W, H)
        const th = s.th0 + t * 0.05
        const zone = (ang: number, dist: number, r: number, c: string, a: number) =>
          this.orb(ctx, cx + Math.cos(th + ang) * R * dist, cy + Math.sin(th + ang) * R * dist, r * R, c, a, 0.2)
        zone(2.6, 0.7, 0.55, '#2336b0', 0.55)
        zone(3.6, 0.75, 0.45, '#d8336e', 0.5)
        zone(4.4, 0.7, 0.5, '#ffd24a', 0.45)
        ctx.restore()
        this.ringOrb(ctx, cx, cy, R * 0.965, R * 1.035, '#f08a1d', 0.6 + 0.2 * Math.sin(t * 1.7))
        this.ringOrb(ctx, cx, cy, R * 0.985, R * 1.012, '#ffe45e', 0.55 + 0.25 * Math.sin(t * 2.3 + 1))
        break
      }
      case 'snow': {
        const s = L.snow, u = Math.min(W, H) * P.scale
        this.bgFill('#eef2f7', '#dde7f0')
        const breath = 1 + 0.008 * Math.sin(t * 0.35)
        this.orb(ctx, W * s.bx, H * s.by, u * 0.95, '#7fa8d0', 0.5, 0.05)
        this.orb(ctx, W * s.ax, H * s.ay, u * 0.85 * breath, '#ffffff', 0.95, 0.15)
        this.orb(ctx, W * s.wx, H * s.wy, u * 0.6, '#f0b48a', 0.34, 0.05)
        this.orb(ctx, W * (s.ax + 0.05), H * (s.ay + 0.3), u * 0.5 * breath, '#ffffff', 0.6, 0.1)
        break
      }
    }
  }

  // ---- grain (fine, uniform — also dithers the gradients) ----
  private buildGrain() {
    const s = 220, t = document.createElement('canvas'); t.width = s; t.height = s
    const p = t.getContext('2d')!, img = p.createImageData(s, s), d = img.data
    for (let i = 0; i < d.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255 }
    p.putImageData(img, 0, 0); this.grainTile = this.ctx.createPattern(t, 'repeat')
  }

  private draw(t: number) {
    const ctx = this.ctx
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    this.weather(t)
    if (P.grain > 0.005 && this.grainTile) {
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = P.grain
      ctx.fillStyle = this.grainTile; ctx.fillRect(0, 0, this.W, this.H); ctx.restore()
    }
  }

  private loop = () => {
    const t = (performance.now() - this.t0) / 1000 * P.motion
    this.draw(t)
    this.raf = requestAnimationFrame(this.loop)
  }
  private render() {
    cancelAnimationFrame(this.raf)
    if (this.reduced || document.hidden) { this.draw(0); return }
    if (P.motion > 0.001) this.loop(); else this.draw(0)
  }
}
