// Ported from prototypes/wkndr-forms/index.html (look key `forms`) — gradient-filled
// shapes w/ blend modes. UI removed; default P values fixed; weather driven by
// setMode(); fixed seed (1).
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
function rgba(hex: string, a: number) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

const HALFPI = Math.PI / 2, QPI = Math.PI / 4

interface ModeDef {
  label: string; bg: string; blend?: GlobalCompositeOperation; cols: string[]; shapes: string[]
  place: string; size: [number, number]; aspect: [number, number]
  gAngle: number | null; tilt: number; tiltBias?: number; drift: [number, number]; ht: number
  burst?: number; countMul: number; mo?: number; rainLines?: boolean; flowX?: number; fall?: boolean
}
const MODES: Record<WKey, ModeDef> = {
  sun: {
    label: 'Sun', bg: '#f3ecdf', cols: ['#f4c20d', '#f08a1d', '#e8331f', '#ffce6e', '#ff9ec4'],
    shapes: ['blob', 'circle', 'blob', 'blob'], place: 'high', size: [0.5, 0.95], aspect: [0.85, 1.2],
    gAngle: null, tilt: 0.2, drift: [0, -0.4], ht: 0.2, burst: 0.45, countMul: 1.2, mo: 1.4,
  },
  rain: {
    label: 'Rain', bg: '#eef1f5', cols: ['#1b4dd8', '#2f6ee0', '#5b3fd8', '#9fb6d4', '#1bb3c8'],
    shapes: ['capsule', 'rect', 'capsule', 'rect'], place: 'rainspread', size: [0.4, 0.72], aspect: [0.42, 0.7],
    gAngle: HALFPI, tilt: 0.08, drift: [0, 1.1], ht: 0.4, countMul: 2.0, rainLines: true,
  },
  cloud: {
    label: 'Cloud', bg: '#e9ecef', cols: ['#aebccb', '#c3cdd7', '#cdbfd6', '#9aa6b2', '#e3e7ea'],
    shapes: ['cloud', 'cloud', 'blob'], place: 'band', size: [0.55, 0.95], aspect: [1.0, 1.0],
    gAngle: 0, tilt: 0, drift: [0.7, 0], ht: 0, countMul: 1.3, mo: 1.5, flowX: 0.05,
  },
  wind: {
    label: 'Wind', bg: '#edf1e8', cols: ['#3f6b5e', '#7fae8a', '#cfd98a', '#f0a85a', '#e8e0c8'],
    shapes: ['ribbon', 'ribbon', 'capsule'], place: 'band', size: [0.5, 0.9], aspect: [1.4, 2.2],
    gAngle: QPI, tilt: 0.2, drift: [1.0, 0.1], ht: 0.2, countMul: 1.8,
  },
  storm: {
    label: 'Storm', bg: '#161221', blend: 'screen', cols: ['#5b3fd8', '#1b6de8', '#e8331f', '#f4c20d', '#1bb35a'],
    shapes: ['triangle', 'rect', 'triangle', 'blob'], place: 'scatter', size: [0.4, 0.82], aspect: [0.7, 1.5],
    gAngle: null, tilt: 0.9, drift: [0.5, 0.5], ht: 0.1, countMul: 1.6, mo: 1.8,
  },
  snow: {
    label: 'Snow', bg: '#f4f7fb', cols: ['#cdd9e8', '#dde6f0', '#cfd0ea', '#ffffff', '#b8cbe0'],
    shapes: ['circle', 'circle', 'blob'], place: 'sparse', size: [0.05, 0.18], aspect: [0.9, 1.15],
    gAngle: null, tilt: 0.2, drift: [0.2, 0], ht: 0, countMul: 5, fall: true, mo: 1.3,
  },
}

interface Form {
  type: string; cx: number; cy: number; size: number; aspect: number; rot: number
  cols: string[]; gAngle: number; gSpin: number; rotSpin: number; dphase: number
  dx: number; dy: number; ht: boolean; fallSpeed: number
  lobes?: number[][]; amp?: number; freq?: number; freq2?: number; phase?: number; bandH?: number
}

const P = { shapes: 3, soft: 0.5, half: 0.4, grain: 0.35, motion: 0.7, seed: 1 }

export class FormsRenderer implements LookRenderer {
  private host!: HTMLElement
  private c!: HTMLCanvasElement
  private ctx!: Ctx
  private W = 1; private H = 1
  private DPR = 1
  private mode: WKey = 'sun'
  private raf = 0
  private t0 = performance.now()
  private reduced = false
  private halftone: CanvasPattern | null = null
  private grainTile: CanvasPattern | null = null
  private forms: Form[] = []

  private seed = P.seed
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
    this.mode = modeToKey(mode, { sun: 'sun', wind: 'wind', cloud: 'cloud', rain: 'rain', storm: 'storm' })
    this.resize()
    document.addEventListener('visibilitychange', this.onVis)
  }

  setMode(mode: Mode) {
    this.mode = modeToKey(mode, { sun: 'sun', wind: 'wind', cloud: 'cloud', rain: 'rain', storm: 'storm' })
    this.render()
  }

  reroll() {
    this.seed = (Math.random() * 1e6) >>> 0   // a fresh set of forms
    this.render()
  }

  resize() {
    this.DPR = Math.min(1.5, window.devicePixelRatio || 1)
    this.W = this.host.clientWidth || window.innerWidth
    this.H = this.host.clientHeight || window.innerHeight
    this.c.width = Math.floor(this.W * this.DPR); this.c.height = Math.floor(this.H * this.DPR)
    this.buildHalftone(); this.buildGrain()
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

  // ---- placement per weather composition ----
  private place(kind: string, i: number, N: number): [number, number] {
    const r = this.rr
    if (kind === 'high') return [r(0.3, 0.7), r(0.14, 0.42)]
    if (kind === 'stack') return [r(0.32, 0.68), ((i + 0.5) / N) * 0.86 + 0.07 + r(-0.04, 0.04)]
    if (kind === 'band') return [r(0.2, 0.8), r(0.12, 0.88)]
    if (kind === 'diagonal') { const tt = (i + 0.5) / N; return [0.12 + tt * 0.72 + r(-0.06, 0.06), 0.16 + tt * 0.62 + r(-0.06, 0.06)] }
    if (kind === 'rainspread') return [r(0.02, 0.98), r(-0.05, 0.85)]
    if (kind === 'sparse') return [r(0.12, 0.88), r(0.12, 0.88)]
    return [r(0.15, 0.85), r(0.15, 0.85)]
  }

  private buildForms(m: ModeDef): Form[] {
    const rng = this.rng, rr = this.rr, pick = this.pick
    const N = Math.max(1, Math.round(P.shapes * (m.countMul || 1))), out: Form[] = []
    for (let i = 0; i < N; i++) {
      const p = this.place(m.place, i, N), type = pick(m.shapes)
      const s: Form = {
        type, cx: p[0], cy: p[1],
        size: rr(m.size[0], m.size[1]),
        aspect: rr(m.aspect[0], m.aspect[1]),
        rot: rr(-m.tilt, m.tilt) + (m.tiltBias || 0),
        cols: [pick(m.cols), pick(m.cols), pick(m.cols)],
        gAngle: (m.gAngle == null) ? rr(0, 6.2832) : m.gAngle + rr(-0.35, 0.35),
        gSpin: rr(-0.12, 0.12),
        rotSpin: rr(-0.09, 0.09),
        dphase: rr(0, 6.2832),
        dx: (m.drift ? m.drift[0] : 0) + rr(-0.5, 0.5),
        dy: (m.drift ? m.drift[1] : 0) + rr(-0.5, 0.5),
        ht: rng() < (m.ht != null ? m.ht : 0.4),
        fallSpeed: rr(0.05, 0.14),
      }
      if (m.burst && rng() < m.burst) s.size *= rr(1.5, 2.2)
      if (type === 'cloud') { s.lobes = []; const L = 4 + ((rng() * 3) | 0); for (let k = 0; k < L; k++) s.lobes.push([rr(-0.85, 0.85), rr(-0.32, 0.12), rr(0.42, 0.9), rr(0, 6.2832)]) }
      if (type === 'ribbon') { s.amp = rr(0.04, 0.085); s.freq = rr(0.6, 1.3); s.freq2 = s.freq * rr(1.7, 2.3); s.phase = rr(0, 6.2832); s.bandH = rr(0.14, 0.3) }
      out.push(s)
    }
    return out
  }

  private shapePath(type: string, r: number, aspect: number) {
    const ctx = this.ctx
    const w = r * 2 * Math.sqrt(aspect), h = r * 2 / Math.sqrt(aspect)
    ctx.beginPath()
    if (type === 'rect') { ctx.rect(-w / 2, -h / 2, w, h) }
    else if (type === 'circle') { ctx.arc(0, 0, r, 0, 6.2832) }
    else if (type === 'capsule') { const rad = Math.min(w, h) / 2; this.roundRect(-w / 2, -h / 2, w, h, rad) }
    else if (type === 'triangle') { ctx.moveTo(0, -h * 0.62); ctx.lineTo(w * 0.6, h * 0.5); ctx.lineTo(-w * 0.6, h * 0.5); ctx.closePath() }
  }
  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
  }

  private drawForm(s: Form, t: number, m: ModeDef) {
    const ctx = this.ctx, W = this.W, H = this.H
    const blend = m.blend || 'multiply'
    const tt = t * (m.mo || 1)
    const ang = s.gAngle + tt * s.gSpin
    let cx: number, cy: number
    if (m.flowX) cx = ((((s.cx + tt * m.flowX) % 1.26) + 1.26) % 1.26 - 0.13) * W
    else cx = (s.cx + Math.sin(tt * 0.28 + s.dphase) * s.dx * 0.06) * W
    if (m.fall) cy = (((s.cy + tt * s.fallSpeed) % 1.14) - 0.07) * H
    else cy = (s.cy + Math.cos(tt * 0.24 + s.dphase) * s.dy * 0.06) * H
    const r = s.size * 0.5 * Math.min(W, H)
    ctx.save()
    ctx.globalCompositeOperation = blend
    if (s.type === 'blob') {
      const R = r * (1.0 + P.soft * 0.5) * (1 + 0.1 * Math.sin(tt * 0.9 + s.dphase))
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      g.addColorStop(0, rgba(s.cols[0], 1)); g.addColorStop(0.5, rgba(s.cols[1], 0.92)); g.addColorStop(1, rgba(s.cols[1], 0))
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill()
    } else if (s.type === 'cloud') {
      for (const lo of s.lobes!) {
        const lx = cx + (lo[0] + Math.sin(tt * 0.5 + lo[3]) * 0.2) * r, ly = cy + (lo[1] + Math.cos(tt * 0.43 + lo[3]) * 0.13) * r
        const lr = lo[2] * r * (1 + P.soft * 0.4) * (1 + 0.13 * Math.sin(tt * 0.62 + lo[3]))
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr)
        g.addColorStop(0, rgba(s.cols[0], 0.8)); g.addColorStop(0.5, rgba(s.cols[1], 0.5)); g.addColorStop(1, rgba(s.cols[1], 0))
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, 6.2832); ctx.fill()
      }
    } else if (s.type === 'ribbon') {
      const ph = s.phase! + tt * 0.95, amp = s.amp! * H, half = s.bandH! * Math.min(W, H) * 0.5
      const bob = Math.sin(tt * 0.55 + s.dphase) * 0.04 * H, x0 = -0.14 * W, x1 = 1.14 * W, Nn = 72
      const yAt = (x: number) => { const u = x / W; return cy + bob + (Math.sin(u * 6.2832 * s.freq! + ph) * 0.72 + Math.sin(u * 6.2832 * s.freq2! + ph * 1.3 + 1.7) * 0.28) * amp }
      ctx.beginPath()
      for (let i = 0; i <= Nn; i++) { const x = x0 + (x1 - x0) * i / Nn; i ? ctx.lineTo(x, yAt(x) - half) : ctx.moveTo(x, yAt(x) - half) }
      for (let i = Nn; i >= 0; i--) { const x = x0 + (x1 - x0) * i / Nn; ctx.lineTo(x, yAt(x) + half) }
      ctx.closePath(); ctx.clip()
      const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, s.cols[0]); g.addColorStop(0.5, s.cols[1]); g.addColorStop(1, s.cols[2])
      ctx.fillStyle = g; ctx.fillRect(0, cy + bob - amp - half - 6, W, 2 * (amp + half) + 12)
    } else {
      ctx.translate(cx, cy); ctx.rotate(s.rot + tt * s.rotSpin)
      this.shapePath(s.type, r, s.aspect); ctx.clip()
      const dx = Math.cos(ang) * r, dy = Math.sin(ang) * r
      const g = ctx.createLinearGradient(-dx, -dy, dx, dy)
      g.addColorStop(0, s.cols[0]); g.addColorStop(0.5, s.cols[1]); g.addColorStop(1, s.cols[2])
      ctx.fillStyle = g; ctx.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6)
      if (P.half > 0.01 && s.ht && this.halftone) {
        ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = P.half * 0.55
        ctx.fillStyle = this.halftone; ctx.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6); ctx.globalAlpha = 1
      }
    }
    ctx.restore()
  }

  private drawRainLines(m: ModeDef, t: number) {
    const ctx = this.ctx, rng = this.rng, rr = this.rr, pick = this.pick, W = this.W, H = this.H
    ctx.globalCompositeOperation = 'multiply'
    const n = Math.round(20 + P.shapes * 6)
    for (let i = 0; i < n; i++) {
      const x = rng() * W, dotted = rng() < 0.5
      ctx.strokeStyle = rgba(pick(m.cols), rr(0.12, 0.35)); ctx.lineWidth = rr(0.6, 1.4) * this.DPR
      if (dotted) { ctx.setLineDash([rr(2, 6) * this.DPR, rr(6, 18) * this.DPR]); ctx.lineDashOffset = -t * 85 * this.DPR } else ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(x, rr(-0.1, 0.2) * H); ctx.lineTo(x, rr(0.7, 1.1) * H); ctx.stroke()
    }
    ctx.setLineDash([]); ctx.globalCompositeOperation = 'source-over'
  }

  // ---- textures ----
  private buildHalftone() {
    const s = 9, t = document.createElement('canvas'); t.width = s; t.height = s
    const p = t.getContext('2d')!; p.fillStyle = 'rgba(20,18,16,1)'
    p.beginPath(); p.arc(s / 2, s / 2, s * 0.3, 0, 6.2832); p.fill()
    this.halftone = this.ctx.createPattern(t, 'repeat')
  }
  private buildGrain() {
    const s = 240, t = document.createElement('canvas'); t.width = s; t.height = s
    const p = t.getContext('2d')!, img = p.createImageData(s, s), d = img.data
    for (let i = 0; i < d.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255 }
    p.putImageData(img, 0, 0); this.grainTile = this.ctx.createPattern(t, 'repeat')
  }

  private draw(t: number) {
    const ctx = this.ctx, W = this.W, H = this.H
    this.rng = mulberry32(this.seed >>> 0)
    const m = MODES[this.mode]
    this.forms = this.buildForms(m)
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = m.bg; ctx.fillRect(0, 0, W, H)
    for (const s of this.forms) this.drawForm(s, t, m)
    if (m.rainLines) this.drawRainLines(m, t)
    ctx.globalCompositeOperation = 'overlay'
    if (P.grain > 0.01 && this.grainTile) { ctx.globalAlpha = P.grain * 0.85; ctx.fillStyle = this.grainTile; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
    ctx.globalCompositeOperation = 'source-over'
    const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.8)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,18,15,0.06)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
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
