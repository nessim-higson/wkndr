// Ported from prototypes/wkndr-aura/index.html (look key `agradient`) — WebGL mesh
// gradient + lens/rim/sheen. UI removed; default P values fixed; weather driven by
// setMode(). Owns its own WebGL canvas (kept separate from the 2D looks).
import type { Mode } from '../../types'
import { modeToKey, type LookRenderer } from './types'

type WKey = 'sunny' | 'overcast' | 'rain' | 'wind' | 'storm' | 'snow'

const MODES: Record<WKey, { label: string; cols: string[] }> = {
  sunny: { label: 'Sunny', cols: ['#ffd23f', '#ff8c42', '#ff5e7e', '#ffb05e', '#ffe29a'] },
  overcast: { label: 'Cloud', cols: ['#94a3b8', '#a5b4cb', '#cbd5e1', '#8b9bb4', '#7d93a8'] },
  rain: { label: 'Rain', cols: ['#1e3a8a', '#2563eb', '#22d3ee', '#3b5bbf', '#67e8f9'] },
  wind: { label: 'Wind', cols: ['#10b981', '#22d3ee', '#a3e635', '#34d399', '#67e8f9'] },
  storm: { label: 'Storm', cols: ['#db2777', '#7c3aed', '#2563eb', '#e11d48', '#22d3ee'] },
  snow: { label: 'Snow', cols: ['#a5f3fc', '#c4b5fd', '#fbcfe8', '#e0f2fe', '#ddd6fe'] },
}

const P = { speed: 0.7, soft: 0.3, travel: 0.36, warp: 0.13, depth: 0.68, sheen: 0.45, rim: 0.85, radius: 0.16, frame: true }

function hexRgb(h: string) {
  h = h.replace('#', '')
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}

const VS = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main(){ vUv = aPosition*0.5+0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }`
const FS = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform float uTime, uSoft, uTravel, uRim, uRadius, uFrame, uWarp, uDepth, uSheen;
  uniform vec3 uCol[5];
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p*=2.0; a*=0.5; } return v; }
  float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r; }
  void main(){
    vec2 uv = vUv;
    vec2 asp = vec2(uRes.x/uRes.y, 1.0);
    float t = uTime;
    float w1 = fbm(uv*2.4 + vec2(0.0, t*0.08));
    float w2 = fbm(uv*2.4 + vec2(3.7, 1.2) - t*0.06);
    vec2 wuv = uv + (vec2(w1, w2) - 0.5) * uWarp;
    vec2 pts[5];
    pts[0] = vec2(0.5 + uTravel*sin(t*0.23),     0.5 + uTravel*cos(t*0.19));
    pts[1] = vec2(0.5 + uTravel*sin(t*0.17+2.1), 0.5 + uTravel*cos(t*0.27+1.0));
    pts[2] = vec2(0.5 + uTravel*sin(t*0.21+4.0), 0.5 + uTravel*cos(t*0.15+3.0));
    pts[3] = vec2(0.5 + uTravel*sin(t*0.13+1.5), 0.5 + uTravel*cos(t*0.23+5.0));
    pts[4] = vec2(0.5 + uTravel*sin(t*0.19+3.5), 0.5 + uTravel*cos(t*0.20+2.5));
    float pulse[5];
    pulse[0]=0.5+0.5*sin(t*0.50);     pulse[1]=0.5+0.5*sin(t*0.37+1.7);
    pulse[2]=0.5+0.5*sin(t*0.43+3.1); pulse[3]=0.5+0.5*sin(t*0.31+4.5);
    pulse[4]=0.5+0.5*sin(t*0.47+0.6);
    vec3 col = vec3(0.0); float wsum = 0.0;
    for (int i=0;i<5;i++){
      vec2 d = (wuv - pts[i]) * asp;
      float w = exp(-dot(d,d)/uSoft) * (0.35 + 0.65*pulse[i]);
      col += uCol[i]*w; wsum += w;
    }
    col /= max(wsum, 0.0001);

    if (uFrame > 0.5){
      vec2 p = (uv - 0.5) * asp * 2.0;
      float sdf = sdRoundBox(p, vec2(asp.x*0.82, 0.86), uRadius);
      float inside = smoothstep(0.0, -0.5, sdf);

      col *= 1.0 - uDepth * inside * (0.15 + 0.85*smoothstep(0.08, 0.95, uv.y));

      vec2 q = (uv - 0.5) * asp;
      float band = q.x*0.78 + q.y*0.62;
      float sheen = exp(-pow((band - 0.4*sin(t*0.18))*2.0, 2.0));
      vec3 sheenCol = mix(vec3(0.75, 0.96, 1.0), col + 0.4, 0.35);
      col += inside * sheen * uSheen * sheenCol * 1.3;

      float core = exp(-abs(sdf)/0.013);
      float glow = exp(-abs(sdf)/0.10);
      float ang  = atan(p.y, p.x);
      float sweep = pow(cos(ang - t*0.55)*0.5 + 0.5, 4.0);
      vec3 rimCol = mix(vec3(0.62, 0.95, 1.0), col + 0.3, 0.45);
      col += (glow*0.5 + core*1.2) * (0.5 + 1.0*sweep) * uRim * rimCol;

      float outm = smoothstep(0.0, 0.32, sdf);
      vec3 amb = mix(col, vec3(dot(col, vec3(0.33))), 0.25) * 0.58;
      col = mix(col, amb, outm);
    }

    col += (hash(gl_FragCoord.xy + t) - 0.5) / 200.0;
    gl_FragColor = vec4(col, 1.0);
  }`

export class AGradientRenderer implements LookRenderer {
  private host!: HTMLElement
  private canvas!: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private prog: WebGLProgram | null = null
  private U: Record<string, WebGLUniformLocation | null> = {}
  private mode: WKey = 'sunny'
  private raf = 0
  private simTime = 0
  private last = performance.now()
  private reduced = false
  private ctxLostHandler = (e: Event) => e.preventDefault()

  mount(host: HTMLElement, mode: Mode) {
    this.host = host
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.mode = modeToKey(mode, { sun: 'sunny', wind: 'wind', cloud: 'overcast', rain: 'rain', storm: 'storm' })
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    host.prepend(this.canvas)   // behind the grain + vignette overlays
    this.canvas.addEventListener('webglcontextlost', this.ctxLostHandler, false)

    const gl = this.canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true })
    if (!gl) { this.gl = null; return }   // WebGL unavailable — base CSS gradient shows through
    this.gl = gl

    const prog = gl.createProgram()!
    gl.attachShader(prog, this.compile(gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, this.compile(gl.FRAGMENT_SHADER, FS))
    gl.bindAttribLocation(prog, 0, 'aPosition')
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog))
    gl.useProgram(prog)
    this.prog = prog

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const names = ['uRes', 'uTime', 'uSoft', 'uTravel', 'uRim', 'uRadius', 'uFrame', 'uWarp', 'uDepth', 'uSheen', 'uCol[0]']
    names.forEach((n) => { this.U[n] = gl.getUniformLocation(prog, n) })

    this.setPalette()
    this.resize()
    document.addEventListener('visibilitychange', this.onVis)
    if (this.reduced) { this.renderOnce(); return }
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  setMode(mode: Mode) {
    this.mode = modeToKey(mode, { sun: 'sunny', wind: 'wind', cloud: 'overcast', rain: 'rain', storm: 'storm' })
    this.setPalette()
    if (this.reduced || document.hidden) this.renderOnce()
  }

  resize() {
    const gl = this.gl; if (!gl) return
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const w = this.host.clientWidth || window.innerWidth
    const h = this.host.clientHeight || window.innerHeight
    this.canvas.width = Math.floor(w * dpr)
    this.canvas.height = Math.floor(h * dpr)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    if (this.reduced || document.hidden) this.renderOnce()
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVis)
    this.canvas.removeEventListener('webglcontextlost', this.ctxLostHandler)
    const gl = this.gl
    if (gl) {
      if (this.prog) gl.deleteProgram(this.prog)
      const ext = gl.getExtension('WEBGL_lose_context')
      if (ext) ext.loseContext()   // free the GL context promptly
    }
    this.gl = null; this.prog = null
    this.canvas.remove()
  }

  private onVis = () => {
    if (document.hidden) cancelAnimationFrame(this.raf)
    else if (!this.reduced) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame) }
  }

  private compile(type: number, src: string) {
    const gl = this.gl!
    const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s))
    return s
  }

  private setPalette() {
    const gl = this.gl; if (!gl) return
    const flat: number[] = []
    MODES[this.mode].cols.forEach((h) => { const c = hexRgb(h); flat.push(c[0], c[1], c[2]) })
    gl.uniform3fv(this.U['uCol[0]'], new Float32Array(flat))
  }

  private setUniforms() {
    const gl = this.gl!
    gl.uniform1f(this.U.uTime, this.simTime)
    gl.uniform2f(this.U.uRes, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.U.uSoft, P.soft)
    gl.uniform1f(this.U.uTravel, P.travel)
    gl.uniform1f(this.U.uWarp, P.warp)
    gl.uniform1f(this.U.uDepth, P.depth)
    gl.uniform1f(this.U.uSheen, P.sheen)
    gl.uniform1f(this.U.uRim, P.rim)
    gl.uniform1f(this.U.uRadius, P.radius)
    gl.uniform1f(this.U.uFrame, P.frame ? 1 : 0)
  }

  private renderOnce() {
    const gl = this.gl; if (!gl) return
    this.setUniforms()
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private frame = (now: number) => {
    const gl = this.gl; if (!gl) return
    const dt = (now - this.last) / 1000; this.last = now
    this.simTime += dt * P.speed
    this.setUniforms()
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.raf = requestAnimationFrame(this.frame)
  }
}
