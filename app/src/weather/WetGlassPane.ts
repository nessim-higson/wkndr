// WET GLASS — the renderer (see wetglass.ts for the recipes and the why).
//
// One full-screen triangle, one fragment shader, one texture (the plate). Everything on the pane
// is procedural and grid-based: each grid cell may hold one bead, placed and sized by a hash of
// the cell id + the session seed, so no per-fragment loop over N drops — a fragment evaluates the
// cell it is in for each of two bead grids, one trail grid and two snow grids. A bead REFRACTS the
// plate: the fragment samples the plate offset by the bead's surface normal (inverted, as a real
// bead does), so a bead over a bright cloud lenses the cloud — that, not a highlight, is what
// reads as water. Condensation is a mip-biased sample of the plate (a real blur at the cost of
// one texture fetch) plus a milky cast; beads and trails cut through it.
//
// Static by default: with motion off the frame is drawn ONCE (and on resize / scene change) at a
// frozen time, and the RAF loop is never started. Motion on: beads drift down their cell with the
// hash-eased fall from Steinrucken's "Heartfelt", capped at 30 fps with the same FrameCap the
// other looks use, paused when the tab is hidden, and never under prefers-reduced-motion.
import { FrameCap } from './looks/types'
import type { WetRecipe } from './wetglass'

const VERT = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main(){ gl_Position = vec4(P[gl_VertexID], 0., 1.); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 u_res;      // backing px
uniform float u_px;      // backing px per CSS px — cells are sized in CSS px so a bead is a bead on every screen
uniform float u_time;
uniform float u_seed;
uniform sampler2D u_tex;
uniform vec2 u_texSize;
uniform float u_drops, u_trails, u_fog, u_snow, u_dim;
uniform vec3 u_tint;

vec3 N13(float p){ vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787)); p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x)); }

// cover-map: the plate fills the canvas, anchored a little above centre (a sky reads from its band)
vec2 coverUV(vec2 uv){
  float sa = u_res.x / u_res.y, ta = u_texSize.x / u_texSize.y;
  vec2 s = sa > ta ? vec2(1., ta / sa) : vec2(sa / ta, 1.);
  return (uv - .5) * s + vec2(.5, .46);
}

// ONE BEAD GRID. p in CSS px. cellW × cellW*tall px cells; returns mask, refraction normal, rim, spec, trail mask.
// A bead never leaves its cell (radius ≤ .17 of the cell width, centre within ±.3), so one cell is enough.
struct Bead { float m; vec2 n; float rim; float spec; float trail; };
Bead beads(vec2 p, float cellW, float tall, float density, float trailShare, float t, float layer){
  Bead b; b.m = 0.; b.n = vec2(0.); b.rim = 0.; b.spec = 0.; b.trail = 0.;
  vec2 cell = vec2(cellW, cellW * tall);
  vec2 id = floor(p / cell);
  vec2 f = fract(p / cell) - .5;
  vec3 h = N13(id.x * 35.2 + id.y * 2376.1 + layer * 91.7 + u_seed);
  if (h.z > density) return b;                      // an empty cell
  float r = mix(.07, .17, h.y * h.y);               // radius in cell widths — many small, few large
  float speed = .12 + h.x * .18;
  float ty = fract(h.y + t * speed);                // 0..1 down the cell (t frozen → the hash alone)
  float x = (h.x - .5) * .6 + sin(ty * 12.566) * .04 * (1. - h.y);
  float y = (.5 - ty) * (tall - 2. * r) * .95;       // in cell-width units, top → bottom
  vec2 dp = (f * vec2(1., tall) - vec2(x, y)) / r;   // bead space: unit circle = the bead
  dp.y *= .9;                                        // beads sit a touch wider than tall
  float d = length(dp);
  float m = smoothstep(1., .86, d);
  b.m = m;
  b.n = dp * sqrt(max(0., 1. - d * d));              // the cap's normal — strongest at the rim
  b.rim = smoothstep(.62, .97, d) * m;
  // the lit side of the rim (upper-left) catches the sky; the far side goes dark — this contrast
  // is what makes a bead read on a flat grey sky, where the lens alone has nothing to bend
  b.spec = smoothstep(.34, 0., length(dp - vec2(-.42, .40))) * m + smoothstep(.2, .9, d) * m * max(0., dot(normalize(dp + 1e-4), vec2(-.7, .7))) * .35;
  // THE TRAIL — a share of beads have run: a streak of small beads above, along the fall line
  if (h.x < trailShare) {
    vec2 tp = f * vec2(1., tall) - vec2((h.x - .5) * .6, 0.);
    float above = step(y + r, tp.y);                 // only above the bead
    float lane = smoothstep(.09, .0, abs(tp.x - sin(tp.y * 3.1) * .03));
    vec2 tf = fract(vec2(tp.x, tp.y * 3.2)) - .5;    // a column of little beads
    float td = length(tf * vec2(6., 2.2));
    float tm = smoothstep(1., .5, td) * above * lane;
    b.trail = max(b.trail, tm * .9);
    b.m = max(b.m, tm * .55);
    b.n += (tf * vec2(6., 2.2)) * tm * .5;
    b.rim = max(b.rim, tm * .3);
  }
  return b;
}

// SNOW — flakes in the air, in front of the plate
float flakes(vec2 p, float cellW, float t, float layer){
  vec2 id = floor(p / cellW); vec2 f = fract(p / cellW) - .5;
  vec3 h = N13(id.x * 17.3 + id.y * 913.7 + layer * 41.1 + u_seed);
  if (h.z > .55) return 0.;
  float ty = fract(h.y + t * (.05 + h.x * .05));
  vec2 c = vec2((h.x - .5) * .8 + sin(ty * 6.28 + h.z * 6.) * .12, .5 - ty);
  float r = mix(.03, .09, h.z * 1.8);
  return smoothstep(r, r * .3, length(f - c)) * (.5 + .5 * h.x);
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = gl_FragCoord.xy / u_px;                   // CSS px, y up
  float t = u_time;
  Bead A = beads(p, 58., 2.4, u_drops * .55, u_trails * .55, t, 1.);   // the big beads
  Bead B = beads(p, 24., 1.7, u_drops * .8,  u_trails * .25, t, 2.);   // the fine beads
  float m = max(A.m, B.m);
  vec2 n = A.m > B.m ? A.n : B.n;
  float rim = max(A.rim, B.rim), spec = max(A.spec, B.spec), trail = max(A.trail, B.trail);

  vec2 cuv = coverUV(uv);
  // the pane: condensation is a real blur of the plate (mip bias) plus a milky cast, cleared by trails
  float fog = u_fog * (1. - trail * .85);
  vec3 pane = texture(u_tex, cuv, 3.2 * fog).rgb;
  pane = mix(pane, mix(pane, u_tint, .35), fog);
  // the bead: the plate lensed through the cap — inverted and magnified, like a real drop
  vec2 px = 1. / u_res;
  vec3 lens = texture(u_tex, cuv - n * px * 84. * u_px * (A.m > B.m ? 1. : .55), 0.).rgb;
  lens = lens * (1.02 + .1 * (1. - length(n)));      // a bead gathers light
  vec3 col = mix(pane, lens, m);
  col *= 1. - rim * .42;                              // the dark rim of the cap
  col += spec * .6;                                   // one highlight, upper-left, and the lit rim
  // snow, in the air
  if (u_snow > 0.) {
    float s = max(flakes(p, 46., t, 1.), flakes(p, 110., t * .7, 2.) * .8);
    col = mix(col, vec3(.97, .98, 1.), s * u_snow * .8);
  }
  // the scene's light, and a breath of vignette top and bottom
  col *= u_dim;
  col *= 1. - .14 * smoothstep(.5, 1., abs(uv.y - .5) * 2.);
  o = vec4(col, 1.);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src); gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`wet glass shader: ${gl.getShaderInfoLog(s) ?? '?'}`)
  return s
}

/** Backing-store scale: cap the DPR at 2 and draw at three quarters — a wet pane is soft, and an
 *  iPhone at 3× would otherwise push ~9 MP of fragment work for a background. */
const DPR_CAP = 2
const SCALE = .75

export class WetGlassPane {
  private host!: HTMLElement
  private c!: HTMLCanvasElement
  private gl!: WebGL2RenderingContext
  private prog!: WebGLProgram
  private u: Record<string, WebGLUniformLocation | null> = {}
  private tex: WebGLTexture | null = null
  private texSize: [number, number] = [1, 1]
  private recipe!: WetRecipe
  private seed = 0
  private moving = false
  private reduced = false
  private raf = 0
  private t0 = performance.now()
  private cap = new FrameCap()
  private plateToken = 0
  private lost = false

  mount(host: HTMLElement, recipe: WetRecipe, seed: number, moving: boolean) {
    this.host = host
    this.recipe = recipe
    this.seed = seed
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.c = document.createElement('canvas')
    this.c.className = 'wet-glass'
    this.c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    host.prepend(this.c)
    const gl = this.c.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
    if (!gl) throw new Error('no webgl2')
    this.gl = gl
    this.c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; cancelAnimationFrame(this.raf) })
    this.c.addEventListener('webglcontextrestored', () => { this.lost = false; this.setup(); this.loadPlate(this.recipe.plate); this.kick() })
    this.setup()
    this.resize()
    this.loadPlate(recipe.plate)
    this.setMoving(moving)
    document.addEventListener('visibilitychange', this.onVis)
  }

  private setup() {
    const gl = this.gl
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`wet glass link: ${gl.getProgramInfoLog(prog) ?? '?'}`)
    gl.useProgram(prog)
    this.prog = prog
    for (const k of ['u_res', 'u_px', 'u_time', 'u_seed', 'u_tex', 'u_texSize', 'u_drops', 'u_trails', 'u_fog', 'u_snow', 'u_dim', 'u_tint'])
      this.u[k] = gl.getUniformLocation(prog, k)
    // a 1×1 placeholder so the first frame is a flat pane, never a black one
    this.tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([214, 222, 226]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(this.u.u_tex, 0)
  }

  /** Swap the plate. Decoded off-thread; a stale load (the scene changed again) is dropped. */
  private loadPlate(url: string) {
    const token = ++this.plateToken
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (token !== this.plateToken || this.lost) return
      const gl = this.gl
      gl.bindTexture(gl.TEXTURE_2D, this.tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      this.texSize = [img.naturalWidth, img.naturalHeight]
      this.c.dataset.plate = 'ready'
      this.draw()
    }
    img.src = url
  }

  setRecipe(recipe: WetRecipe, seed?: number) {
    const plateChanged = recipe.plate !== this.recipe.plate
    this.recipe = recipe
    if (seed != null) this.seed = seed
    if (plateChanged) this.loadPlate(recipe.plate)
    else this.draw()
  }

  setMoving(moving: boolean) {
    this.moving = moving && !this.reduced
    this.kick()
  }

  /** start the loop if it should run, else draw the still frame */
  private kick() {
    cancelAnimationFrame(this.raf)
    if (this.lost) return
    if (this.moving && !document.hidden) {
      this.cap.reset()
      const loop = (now: number) => {
        this.raf = requestAnimationFrame(loop)
        if (this.cap.tick(now)) this.draw((now - this.t0) / 1000)
      }
      this.raf = requestAnimationFrame(loop)
    } else this.draw()
  }

  private onVis = () => this.kick()

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * SCALE
    const w = Math.max(1, Math.round(this.host.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.host.clientHeight * dpr))
    if (this.c.width !== w || this.c.height !== h) {
      this.c.width = w; this.c.height = h
      this.gl.viewport(0, 0, w, h)
    }
    this.draw()
  }

  /** The still frame is drawn at a FIXED time, so a static pane is the same pane on every draw. */
  private draw(time = 11.7) {
    if (this.lost) return
    const gl = this.gl, r = this.recipe
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * SCALE
    gl.useProgram(this.prog)
    gl.uniform2f(this.u.u_res, this.c.width, this.c.height)
    gl.uniform1f(this.u.u_px, dpr)
    gl.uniform1f(this.u.u_time, time)
    gl.uniform1f(this.u.u_seed, this.seed)
    gl.uniform2f(this.u.u_texSize, this.texSize[0], this.texSize[1])
    gl.uniform1f(this.u.u_drops, r.drops)
    gl.uniform1f(this.u.u_trails, r.trails)
    gl.uniform1f(this.u.u_fog, r.fog)
    gl.uniform1f(this.u.u_snow, r.snow)
    gl.uniform1f(this.u.u_dim, r.dim)
    gl.uniform3f(this.u.u_tint, r.tint[0], r.tint[1], r.tint[2])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  fps() { return this.cap.fps }

  destroy() {
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVis)
    this.plateToken++
    try { this.gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* already gone */ }
    this.c.remove()
  }
}
