// WET GLASS — the renderer (see wetglass.ts for the recipes and the why).
//
// One full-screen triangle, one fragment shader, two textures: the PLATE (the sky) and the DROP
// MAP (a macro photograph of real droplets on a pane, high-passed into R = signed relief and
// G = coverage — see scripts in the 2026-09-12 session, the maps ship pre-baked). The water is not
// drawn: the shader bends the sky by the relief's slope (refraction), shades it by the relief
// itself (the photo's own rims and highlights), and clears the condensation where the drops are.
// Real drops are irregular, clustered and mostly tiny; the photograph carries that for free, which
// is exactly what the first, procedural cut of this file could not.
//
// Static by default: with motion off the frame is drawn ONCE (and on resize / scene change), and
// the RAF loop is never started. Motion on: the SKY breathes (a slow zoom and drift, ~30 s), the
// water stays put — a pane of drops all sliding together is the other way to look fake — capped
// at 30 fps with the FrameCap the other looks use, paused when the tab is hidden, never under
// prefers-reduced-motion. Snow is the one thing still drawn: flakes in the air, never on the pane.
import { FrameCap } from './looks/types'
import type { WetRecipe } from './wetglass'

const VERT = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main(){ gl_Position = vec4(P[gl_VertexID], 0., 1.); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 u_res;      // backing px
uniform float u_px;      // backing px per CSS px — the map is laid out in CSS px so a drop is a drop on every screen
uniform float u_time;
uniform float u_seed;
uniform sampler2D u_tex;
uniform vec2 u_texSize;
uniform sampler2D u_map;
uniform vec2 u_mapSize;
uniform float u_wet, u_mapScale, u_fog, u_snow, u_dim, u_motion;
uniform vec3 u_tint;

vec3 N13(float p){ vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787)); p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x)); }

// cover-map: the plate fills the canvas, anchored a little above centre (a sky reads from its band)
vec2 coverUV(vec2 uv, float zoom){
  float sa = u_res.x / u_res.y, ta = u_texSize.x / u_texSize.y;
  vec2 s = sa > ta ? vec2(1., ta / sa) : vec2(sa / ta, 1.);
  return (uv - .5) * s / zoom + vec2(.5, .46);
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
  // the sky breathes only with motion on: a slow zoom and drift, nothing a still frame would miss
  float breath = u_motion * (.5 + .5 * sin(t * .09));
  vec2 cuv = coverUV(uv, 1. + .025 * breath) + u_motion * vec2(.004 * sin(t * .07), .003 * cos(t * .05));

  // THE WATER — the drop map in CSS px, mirrored at its edges; the seed slides the window so
  // tomorrow's pane is a different patch of the same photograph
  vec2 muv = (p + vec2(u_seed * 3.7, u_seed * 1.3)) / vec2(u_mapScale, u_mapScale * u_mapSize.y / u_mapSize.x);
  vec2 e = 1.5 / u_mapSize;
  vec3 m0 = texture(u_map, muv).rgb;
  vec3 mx1 = texture(u_map, muv + vec2(e.x, 0.)).rgb, mx0 = texture(u_map, muv - vec2(e.x, 0.)).rgb;
  vec3 my1 = texture(u_map, muv + vec2(0., e.y)).rgb, my0 = texture(u_map, muv - vec2(0., e.y)).rgb;
  float relief = (m0.r - .5) * 2.;                  // −1..1, the photo's own rims and highlights
  vec2 gR = vec2(mx1.r - mx0.r, my1.r - my0.r);     // the relief's slope: sharp, at the rims
  vec2 gC = vec2(mx1.g - mx0.g, my1.g - my0.g);     // the coverage's slope: a soft dome per drop, so the
                                                     // WHOLE interior lenses the sky, not just the edge
  float cover = m0.g * u_wet;
  vec2 bend = (gR * .14 + gC * .45) * u_wet;         // slope → refraction, in plate uv

  // the pane: condensation is a real blur of the plate (mip bias) plus a milky cast, cleared where the water sits
  float fog = u_fog * (1. - cover * .9);
  vec3 pane = texture(u_tex, cuv + bend, 3.2 * fog).rgb;
  pane = mix(pane, mix(pane, u_tint, .35), fog);
  // the photo's shading, asymmetric: highlights carry the water, the dark side is kept quiet — a
  // drop's interior photographs dark against a studio wall, and against a sky that reads as a stain
  vec3 col = pane * (1. + (relief > 0. ? relief * .8 : relief * .3) * u_wet);

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
  private map: WebGLTexture | null = null
  private texSize: [number, number] = [1, 1]
  private mapSize: [number, number] = [1, 1]
  private recipe!: WetRecipe
  private seed = 0
  private moving = false
  private reduced = false
  private raf = 0
  private t0 = performance.now()
  private cap = new FrameCap()
  private plateToken = 0
  private mapToken = 0
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
    this.c.addEventListener('webglcontextrestored', () => { this.lost = false; this.setup(); this.loadPlate(this.recipe.plate); this.loadMap(this.recipe.map); this.kick() })
    this.setup()
    this.resize()
    this.loadPlate(recipe.plate)
    this.loadMap(recipe.map)
    this.setMoving(moving)
    document.addEventListener('visibilitychange', this.onVis)
  }

  private blank(unit: number, rgb: [number, number, number], wrap: number): WebGLTexture {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(rgb))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    return t
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
    for (const k of ['u_res', 'u_px', 'u_time', 'u_seed', 'u_tex', 'u_texSize', 'u_map', 'u_mapSize', 'u_wet', 'u_mapScale', 'u_fog', 'u_snow', 'u_dim', 'u_motion', 'u_tint'])
      this.u[k] = gl.getUniformLocation(prog, k)
    // placeholders so the first frame is a flat pane, never a black one: a pale sky, a dry map
    this.tex = this.blank(0, [214, 222, 226], gl.CLAMP_TO_EDGE)
    this.map = this.blank(1, [128, 0, 0], gl.MIRRORED_REPEAT)
    gl.uniform1i(this.u.u_tex, 0)
    gl.uniform1i(this.u.u_map, 1)
  }

  private upload(unit: number, tex: WebGLTexture | null, img: HTMLImageElement, wrap: number) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
  }

  /** Swap the plate. Decoded off-thread; a stale load (the scene changed again) is dropped. */
  private loadPlate(url: string) {
    const token = ++this.plateToken
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (token !== this.plateToken || this.lost) return
      this.upload(0, this.tex, img, this.gl.CLAMP_TO_EDGE)
      this.texSize = [img.naturalWidth, img.naturalHeight]
      this.c.dataset.plate = 'ready'
      this.draw()
    }
    img.src = url
  }

  /** Swap the drop map; a dry scene keeps the 1×1 neutral map (and u_wet is 0 anyway). */
  private loadMap(url: string | null) {
    const token = ++this.mapToken
    if (!url) {
      const gl = this.gl
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.map)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([128, 0, 0]))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      this.mapSize = [1, 1]
      this.draw()
      return
    }
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (token !== this.mapToken || this.lost) return
      this.upload(1, this.map, img, this.gl.MIRRORED_REPEAT)
      this.mapSize = [img.naturalWidth, img.naturalHeight]
      this.draw()
    }
    img.src = url
  }

  setRecipe(recipe: WetRecipe, seed?: number) {
    const plateChanged = recipe.plate !== this.recipe.plate
    const mapChanged = recipe.map !== this.recipe.map
    this.recipe = recipe
    if (seed != null) this.seed = seed
    if (plateChanged) this.loadPlate(recipe.plate)
    if (mapChanged) this.loadMap(recipe.map)
    if (!plateChanged && !mapChanged) this.draw()
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
    gl.uniform2f(this.u.u_mapSize, this.mapSize[0], this.mapSize[1])
    gl.uniform1f(this.u.u_wet, r.map ? r.wet : 0)
    gl.uniform1f(this.u.u_mapScale, r.mapScale)
    gl.uniform1f(this.u.u_fog, r.fog)
    gl.uniform1f(this.u.u_snow, r.snow)
    gl.uniform1f(this.u.u_dim, r.dim)
    gl.uniform1f(this.u.u_motion, this.moving ? 1 : 0)
    gl.uniform3f(this.u.u_tint, r.tint[0], r.tint[1], r.tint[2])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  fps() { return this.cap.fps }

  destroy() {
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVis)
    this.plateToken++; this.mapToken++
    try { this.gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* already gone */ }
    this.c.remove()
  }
}
