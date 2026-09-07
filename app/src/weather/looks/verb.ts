import type { Mode } from '../../types'
import { MODE_META, type WeekendWx } from '../modes'
import type { LookParam, LookRenderer } from './types'

export function fieldModes(mode: Mode, weekend?: WeekendWx | null): Mode[] {
  return weekend?.split && weekend.days.length > 1 ? weekend.days.slice(0, 2).map(d => d.mode) : [mode]
}
export function motionAllowed(motion: number, reduced: boolean, hidden: boolean) {
  return Number.isFinite(motion) && motion > 0 && !reduced && !hidden
}
export const VERB_FRAME_MS = 1000 / 30
const scatter = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n) }

// Motion 0 is a composed weather still. A capped, bounded canvas never paints over
// cards; palettes and the live classifier remain the authority for this sky.
export class VerbRenderer implements LookRenderer {
  private host!: HTMLElement
  private canvas!: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null = null
  private mode: Mode = 'COOL'
  private weekend?: WeekendWx | null
  private media?: MediaQueryList
  private motion = 0
  private width = 1
  private height = 1
  private scale = 1
  private time = 0
  private last = 0
  private raf = 0
  private draws = 0
  private sample = 0
  private rate = 0
  mount(host: HTMLElement, mode: Mode) {
    this.host = host; this.mode = mode
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    this.canvas.dataset.look = 'verb'; host.prepend(this.canvas)
    this.ctx = this.canvas.getContext('2d', { alpha: false })
    this.media = matchMedia('(prefers-reduced-motion: reduce)')
    this.media.addEventListener('change', this.restart)
    document.addEventListener('visibilitychange', this.restart)
    this.resize()
  }
  setMode(mode: Mode) { this.mode = mode; this.restart() }
  setWeekend(weekend?: WeekendWx | null) { this.weekend = weekend; this.restart() }
  resize() {
    this.width = this.host.clientWidth || 390; this.height = this.host.clientHeight || 844
    this.scale = Math.min(1.25, window.devicePixelRatio || 1, 1100 / Math.max(this.width, this.height))
    this.canvas.width = Math.ceil(this.width * this.scale); this.canvas.height = Math.ceil(this.height * this.scale)
    this.restart()
  }
  params(): LookParam[] { return [{ key: 'motion', label: 'Motion', min: 0, max: 1, step: .1, value: this.motion }] }
  setParam(key: string, value: number) {
    if (key !== 'motion' || !Number.isFinite(value)) return
    this.motion = Math.max(0, Math.min(1, value)); this.restart()
  }
  fps() { return this.rate }
  destroy() {
    cancelAnimationFrame(this.raf)
    this.media?.removeEventListener('change', this.restart)
    document.removeEventListener('visibilitychange', this.restart)
    this.canvas.remove(); this.ctx = null
  }
  private moving() { return motionAllowed(this.motion, this.media?.matches ?? false, document.hidden) }
  private restart = () => {
    cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; this.rate = 0
    this.draws = 0; this.sample = performance.now()
    if (!this.moving()) this.time = 0
    this.paint()
    if (this.ctx && this.moving()) this.raf = requestAnimationFrame(this.tick)
  }
  private tick = (now: number) => {
    if (!this.moving() || !this.ctx) return
    if (!this.last) this.last = now
    const elapsed = now - this.last
    if (elapsed >= VERB_FRAME_MS) {
      this.time += Math.min(elapsed, 100) / 1000 * this.motion
      this.last = now - elapsed % VERB_FRAME_MS
      this.paint(); this.draws++
      if (now - this.sample >= 1000) { this.rate = Math.round(this.draws * 1000 / (now - this.sample)); this.draws = 0; this.sample = now }
    }
    this.raf = requestAnimationFrame(this.tick)
  }
  private paint() {
    const c = this.ctx; if (!c) return
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    const modes = fieldModes(this.mode, this.weekend), w = this.width / modes.length
    modes.forEach((mode, i) => {
      c.save(); c.beginPath(); c.rect(i * w, 0, w, this.height); c.clip(); c.translate(i * w, 0)
      this.sky(mode, w, this.height); c.restore()
    })
    const shade = c.createLinearGradient(0, 0, 0, this.height)
    shade.addColorStop(0, '#00000038'); shade.addColorStop(.22, '#00000000'); shade.addColorStop(1, '#00000038')
    c.fillStyle = shade; c.fillRect(0, 0, this.width, this.height)
  }
  private sky(mode: Mode, w: number, h: number) {
    const c = this.ctx!, p = MODE_META[mode].field, t = this.time
    const bg = c.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, p.c1); bg.addColorStop(.6, p.c2); bg.addColorStop(1, p.c3)
    c.fillStyle = bg; c.fillRect(0, 0, w, h)
    if (mode === 'HOT' || mode === 'WARM' || mode === 'VOLATILE') {
      const x = w * .82, y = h * .2, r = Math.min(w * .12, 65)
      const halo = c.createRadialGradient(x, y, r * .3, x, y, r * 3)
      halo.addColorStop(0, p.glow); halo.addColorStop(1, p.glow + '00')
      c.fillStyle = halo; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6)
      c.fillStyle = p.glow; c.beginPath(); c.arc(x, y, r * .6, 0, Math.PI * 2); c.fill()
    }
    if (mode === 'COOL' || mode === 'COLD_WET' || mode === 'VOLATILE') {
      // A slow front occludes the sun. No flashes, no unrelated palette cycling.
      const drift = Math.sin(t * (mode === 'VOLATILE' ? .22 : .08)) * w * (mode === 'VOLATILE' ? .55 : .12)
      for (let j = 0; j < 8; j++) {
        const x = w * (j % 4 * .3 - .1) + drift, y = h * (j < 4 ? .19 : .58), r = w * .3
        const g = c.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, p.glow + 'aa'); g.addColorStop(.45, p.c1 + 'cc'); g.addColorStop(1, p.c1 + '00')
        c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2)
      }
    }
    if (mode === 'COLD_WET' || mode === 'VOLATILE') {
      const alpha = mode === 'VOLATILE' ? .16 + .2 * (1 + Math.sin(t * .22)) / 2 : .52
      c.strokeStyle = p.text; c.lineWidth = 1.2; c.lineCap = 'round'
      for (let i = 0; i < 72; i++) {
        const x = scatter(i) * w
        const y = (scatter(i + 100) * (h + 50) + t * (90 + i % 4 * 16)) % (h + 50) - 25
        c.globalAlpha = alpha * (.4 + i % 3 * .25)
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 15 + i % 4 * 4); c.stroke()
      }
      c.globalAlpha = 1
    }
    if (mode === 'HOT' || mode === 'WARM') {
      c.lineWidth = mode === 'HOT' ? 2 : 1.3; c.strokeStyle = p.glow
      for (let i = 0; i < 9; i++) {
        const y = h * (.22 + i * .09)
        c.globalAlpha = mode === 'HOT' ? .22 : .35; c.beginPath()
        for (let x = -20; x <= w + 20; x += 12) {
          const wave = Math.sin(x / (mode === 'HOT' ? 38 : 100) - t * (mode === 'HOT' ? 1.8 : .5) + i) * (mode === 'HOT' ? 5 : 16)
          if (x === -20) c.moveTo(x, y + wave); else c.lineTo(x, y + wave)
        }
        c.stroke()
      }
      c.globalAlpha = 1
    }
  }
}
