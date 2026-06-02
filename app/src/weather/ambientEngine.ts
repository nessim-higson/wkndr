// Ambient weather-field engine — the generative layer that sits UNDERNEATH the
// experience. Vanilla canvas (no deps), palette-driven from MODE_META, engineered
// to never bottleneck the main thread that the swipe deck needs:
//   • renders into a low-res buffer, GPU-upscales to fullscreen (16–36× less pixel work)
//   • DPR clamped to 1 (it's a blurred backdrop — retina is wasted)
//   • throttled to ~30fps and freezes entirely during an active pointer gesture
//   • pauses when the tab is hidden; renders a single static frame under reduced-motion
//   • falls back to nothing if 2D context is unavailable (the CSS base gradient shows)
import type { Mode } from '../types'
import { MODE_META } from './modes'

export type Look = 'off' | 'aura' | 'warp' | 'metaball' | 'aurora' | 'mesh'
export interface FieldStats { fps: number; ms: number; res: string }

interface RGB { r: number; g: number; b: number }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => ({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) })
const sstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

function hexToRgb(h: string): RGB { const n = parseInt(h.replace('#', ''), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 } }
// palette as a dark→bright ramp for the current mode
function modeColors(mode: Mode): RGB[] {
  const f = MODE_META[mode].field
  return [hexToRgb(f.c3), hexToRgb(f.c2), hexToRgb(f.c1), hexToRgb(f.glow)]
}
function rampAt(c: RGB[], t: number): RGB {
  t = Math.max(0, Math.min(0.99999, t)) * (c.length - 1)
  const i = Math.floor(t)
  return lerpRGB(c[i], c[Math.min(c.length - 1, i + 1)], t - i)
}

// ---- seeded gradient noise (Perlin-style) ----
function makeNoise(seed: number) {
  let s = seed >>> 0
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  const perm = [...Array(256).keys()]
  for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0;[perm[i], perm[j]] = [perm[j], perm[i]] }
  const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255]
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const grad = (h: number, x: number, y: number) => ((h & 1 ? x : -x) + (h & 2 ? y : -y))
  const n = (x: number, y: number) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y)
    const u = fade(x), v = fade(y)
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1]
    return (lerp(lerp(grad(aa, x, y), grad(ba, x - 1, y), u), lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u), v) + 1) / 2
  }
  return Object.assign(n, { rand })
}
type Noise = ReturnType<typeof makeNoise>
const fbm = (n: Noise, x: number, y: number, oct = 3) => {
  let a = 0, amp = 0.5, f = 1, tot = 0
  for (let i = 0; i < oct; i++) { a += amp * n(x * f, y * f); tot += amp; amp *= 0.5; f *= 2 }
  return a / tot
}

interface Ball { px: number; py: number; sx: number; sy: number; ph: number; ci: number }

export class FieldEngine {
  private ctx: CanvasRenderingContext2D | null
  private buf = document.createElement('canvas')
  private bctx: CanvasRenderingContext2D
  private img: ImageData | null = null
  private W = 1; private H = 1; private bw = 1; private bh = 1
  private look: Look = 'warp'
  private cur: RGB[]; private tgt: RGB[]
  private t = 0
  private raf = 0; private running = false
  private last = 0; private acc = 0
  private interacting = false
  private reduced = false
  private n = makeNoise(20260601)
  private balls: Ball[] = []
  private emaDelta = 33; private statsAt = 0
  onStats?: (s: FieldStats) => void

  constructor(canvas: HTMLCanvasElement, mode: Mode) {
    this.ctx = canvas.getContext('2d')
    this.bctx = this.buf.getContext('2d')!
    this.cur = modeColors(mode); this.tgt = this.cur.map((c) => ({ ...c }))
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.canvas = canvas
  }
  private canvas: HTMLCanvasElement

  private div() {
    return this.look === 'metaball' ? 6
      : this.look === 'warp' || this.look === 'aurora' ? 5
      : this.look === 'mesh' ? 4
      : 2
  }

  resize(cssW: number, cssH: number) {
    this.W = Math.max(1, Math.round(cssW)); this.H = Math.max(1, Math.round(cssH))
    this.canvas.width = this.W; this.canvas.height = this.H   // DPR clamped to 1 on purpose
    this.alloc()
  }
  private alloc() {
    const d = this.div()
    this.bw = Math.max(2, Math.ceil(this.W / d)); this.bh = Math.max(2, Math.ceil(this.H / d))
    this.buf.width = this.bw; this.buf.height = this.bh
    this.img = this.bctx.createImageData(this.bw, this.bh)
    this.balls = []
    for (let i = 0; i < 7; i++) this.balls.push({ px: this.n.rand(), py: this.n.rand(), sx: this.n.rand() - 0.5, sy: this.n.rand() - 0.5, ph: this.n.rand() * 6.28, ci: 1 + (i % 3) })
  }

  setMode(mode: Mode) {
    this.tgt = modeColors(mode)                                    // crossfades over ~1s while visible
    // If the animation loop can't advance the crossfade right now (reduced-motion,
    // tab hidden, or not yet started) it would otherwise stay stuck on the boot
    // palette — snap to the real mode and paint one correct frame.
    if (this.reduced || document.hidden || !this.running) {
      this.cur = this.tgt.map((c) => ({ ...c }))
      this.renderFrame()
    }
  }
  setLook(look: Look) {
    if (look === this.look) return
    this.look = look
    if (look === 'off') { this.stop(); this.ctx?.clearRect(0, 0, this.W, this.H); return }
    this.alloc()
    if (!this.running) this.start()
  }

  start() {
    if (this.look === 'off' || this.running) return
    this.running = true
    document.addEventListener('visibilitychange', this.onVis)
    window.addEventListener('pointerdown', this.onDown, { passive: true })
    window.addEventListener('pointerup', this.onUp, { passive: true })
    if (this.reduced) { this.renderFrame(); this.running = false; return }  // one static frame
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }
  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVis)
    window.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointerup', this.onUp)
  }

  private onVis = () => {
    if (document.hidden) { cancelAnimationFrame(this.raf) }
    else if (this.running && !this.reduced) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop) }
  }
  private onDown = () => { this.interacting = true }   // yield the main thread to the gesture
  private onUp = () => { this.interacting = false }

  private loop = (ts: number) => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = ts - this.last; this.last = ts
    this.emaDelta = this.emaDelta * 0.9 + dt * 0.1
    if (this.interacting) return                         // frozen while dragging — zero compute
    this.acc += dt
    if (this.acc < 33) return                            // ~30fps cap
    this.acc = this.acc % 33
    this.t += 0.006
    this._fps = Math.round(1000 / this.emaDelta)
    for (let i = 0; i < this.cur.length; i++) this.cur[i] = lerpRGB(this.cur[i], this.tgt[i], 0.06)
    this.renderFrame(ts)
  }

  private present() {
    if (!this.ctx) return
    this.ctx.imageSmoothingEnabled = true
    this.ctx.drawImage(this.buf, 0, 0, this.bw, this.bh, 0, 0, this.W, this.H)
  }

  private renderFrame(ts = performance.now()) {
    if (!this.ctx) return
    const t0 = performance.now()
    if (this.look === 'warp') this.renderWarp()
    else if (this.look === 'aura') this.renderAura()
    else if (this.look === 'metaball') this.renderMetaball()
    else if (this.look === 'aurora') this.renderAurora()
    else if (this.look === 'mesh') this.renderMesh()
    const ms = performance.now() - t0
    if (this.onStats && ts - this.statsAt > 400) {
      this.statsAt = ts
      this.onStats({ fps: this._fps || Math.round(1000 / this.emaDelta), ms: +ms.toFixed(1), res: `${this.bw}×${this.bh}` })
    }
  }
  private _fps = 0

  private renderWarp() {
    const d = this.img!.data, n = this.n, sc = 0.012, t = this.t
    for (let y = 0; y < this.bh; y++) for (let x = 0; x < this.bw; x++) {
      const fx = fbm(n, x * sc, y * sc, 3), fy = fbm(n, x * sc + 5.2, y * sc + 1.3, 3)
      const v = fbm(n, x * sc + 3.0 * fx + t, y * sc + 3.0 * fy, 3)
      const c = rampAt(this.cur, v * 1.15)
      const i = (y * this.bw + x) * 4
      d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = 255
    }
    this.bctx.putImageData(this.img!, 0, 0); this.present()
  }

  private renderAura() {
    const b = this.bctx, W = this.bw, H = this.bh, t = this.t
    const c0 = this.cur[0]
    b.globalCompositeOperation = 'source-over'
    b.fillStyle = `rgb(${c0.r | 0},${c0.g | 0},${c0.b | 0})`; b.fillRect(0, 0, W, H)
    const blobs = 6
    for (let i = 0; i < blobs; i++) {
      const a = i / blobs * 6.28 + t * (i % 2 ? 0.6 : -0.6)
      const cx = W * (0.5 + Math.cos(a + i) * 0.42), cy = H * (0.5 + Math.sin(a * 1.3 + i) * 0.48)
      const r = Math.max(W, H) * (0.5 + 0.18 * Math.sin(t + i))
      const c = this.cur[1 + (i % 3)]
      const g = b.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0, `rgba(${c.r | 0},${c.g | 0},${c.b | 0},0.5)`)
      g.addColorStop(1, `rgba(${c.r | 0},${c.g | 0},${c.b | 0},0)`)
      b.fillStyle = g; b.fillRect(0, 0, W, H)
    }
    this.present()
  }

  private renderMetaball() {
    const d = this.img!.data, W = this.bw, H = this.bh, t = this.t
    const base = this.cur[0]
    for (const bl of this.balls) {
      ;(bl as Ball & { cx: number; cy: number }).cx = (0.5 + 0.42 * Math.sin(t * 0.7 * bl.sx + bl.ph)) * W
      ;(bl as Ball & { cx: number; cy: number }).cy = (0.5 + 0.42 * Math.cos(t * 0.7 * bl.sy + bl.ph * 1.7)) * H
    }
    const R2 = (Math.min(W, H) * 0.30) ** 2
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let f = 0, r = 0, g = 0, bb = 0
      for (const bl of this.balls as (Ball & { cx: number; cy: number })[]) {
        const dx = x - bl.cx, dy = y - bl.cy, w = R2 / (dx * dx + dy * dy + 1)
        const c = this.cur[bl.ci]; f += w; r += w * c.r; g += w * c.g; bb += w * c.b
      }
      const cov = sstep(0.7, 1.5, f), i = (y * W + x) * 4
      d[i] = (r / f) * cov + base.r * (1 - cov)
      d[i + 1] = (g / f) * cov + base.g * (1 - cov)
      d[i + 2] = (bb / f) * cov + base.b * (1 - cov)
      d[i + 3] = 255
    }
    this.bctx.putImageData(this.img!, 0, 0); this.present()
  }

  // vertical light curtains drifting sideways, brighter up top — northern-lights feel
  private renderAurora() {
    const d = this.img!.data, n = this.n, W = this.bw, H = this.bh, t = this.t
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = x * 0.014, sy = y * 0.004
      const flow = fbm(n, sx + t * 0.4, sy, 3)
      const curtain = fbm(n, sx * 0.5 + flow * 0.7 + t * 0.2, sy * 0.4, 2)
      const vert = 1 - y / H
      const v = curtain * 1.1 * (0.45 + vert * 0.75)
      const c = rampAt(this.cur, v)
      const i = (y * W + x) * 4
      d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = 255
    }
    this.bctx.putImageData(this.img!, 0, 0); this.present()
  }

  // smooth flowing gradient mesh — soft diagonal bands, no noise texture
  private renderMesh() {
    const d = this.img!.data, W = this.bw, H = this.bh, t = this.t
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H
      const a = Math.sin(u * 2.3 + t * 0.6) * 0.5 + 0.5
      const b = Math.cos(v * 2.1 - t * 0.5) * 0.5 + 0.5
      const m = a * 0.5 + b * 0.45 + Math.sin((u + v) * 3.0 + t * 0.8) * 0.18 + 0.1
      const c = rampAt(this.cur, m)
      const i = (y * W + x) * 4
      d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = 255
    }
    this.bctx.putImageData(this.img!, 0, 0); this.present()
  }
}
