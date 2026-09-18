// WET GLASS — the renderer (see wetglass.ts for the recipes and the why).
//
// One full-screen triangle, one fragment shader, three textures: the PLATE (the sky — two of them,
// so a change of sky crossfades instead of popping) and the DROP MAP (a macro photograph of real
// droplets on a pane, high-passed into R = signed relief and G = coverage — see scripts in the
// 2026-09-12 session, the maps ship pre-baked). The water is not drawn: the shader bends the sky by
// the relief's slope (refraction), shades it by the relief itself (the photo's own rims and
// highlights), and clears the condensation where the drops are. Real drops are irregular, clustered
// and mostly tiny; the photograph carries that for free, which is exactly what the first, procedural
// cut of this file could not.
//
// Motion on (the default on the glass build): the SKY moves — clouds drift, a veil of cloud shadow
// passes, the plate breathes — and a few RUNNERS let go and run down the pane, wobbling, leaving a
// trail that dries behind them (2026-09-18, Ness: "the motion on the water — is that achievable?").
// The photographed beads stay put. Capped at 30 fps with the FrameCap the other looks use. With
// motion off the frame is drawn ONCE (and on resize / scene change), at a fixed time, so a still
// pane is the same pane on every draw; only a plate crossfade runs the loop briefly.
//
// TIME OF DAY (daylight.ts): the sun grades the plate at the end of the pipe — exposure, the warmth
// of a low sun, a rose afterglow, the blue of night — so rain at 22:00 is dark rain, still raining.
import { FrameCap } from './looks/types'
import type { WetRecipe } from './wetglass'
import type { Daylight } from './daylight'

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
uniform sampler2D u_tex;   // the plate
uniform vec2 u_texSize;
uniform sampler2D u_tex2;  // the plate before it, while u_fade < 1
uniform vec2 u_tex2Size;
uniform float u_fade;
uniform sampler2D u_map;
uniform vec2 u_mapSize;
uniform float u_wet, u_mapScale, u_run, u_fog, u_snow, u_dim, u_motion;
uniform vec3 u_tint;
uniform float u_light, u_gold, u_dusk, u_night;   // the sun's grade (daylight.ts)

// value noise for the cloud veil: large soft cells, four octaves, drifting at their own pace
float H21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float VN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(H21(i), H21(i + vec2(1., 0.)), f.x), mix(H21(i + vec2(0., 1.)), H21(i + vec2(1., 1.)), f.x), f.y); }
float veil(vec2 p, float t){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * VN(p + vec2(t * .032 * (1. + float(i) * .25), t * .007)); p = p * 2.03 + 7.1; a *= .5; } return v; }
vec3 N13(float p){ vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787)); p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x)); }

// cover-map: the plate fills the canvas, anchored a little above centre (a sky reads from its band).
// drift pans the crop inside the plate's SLACK — the part of the plate the crop does not show —
// so the sky moves without ever showing an edge: a portrait plate on a phone has room sideways,
// a landscape window has room up and down. Zoom adds a little slack of its own.
vec2 coverUV(vec2 uv, float zoom, vec2 drift, vec2 texSize){
  float sa = u_res.x / u_res.y, ta = texSize.x / texSize.y;
  vec2 s = sa > ta ? vec2(1., ta / sa) : vec2(sa / ta, 1.);
  vec2 slack = max(vec2(0.), (1. - s / zoom) * .5);
  return (uv - .5) * s / zoom + vec2(.5, .46) + drift * slack * vec2(.9, .6);
}

// SNOW — flakes in the air, in front of the plate
float flakes(vec2 p, float cellW, float t, float layer){
  vec2 id = floor(p / cellW); vec2 f = fract(p / cellW) - .5;
  vec3 h = N13(id.x * 17.3 + id.y * 913.7 + layer * 41.1 + u_seed);
  if (h.z > .55) return 0.;
  float ty = fract(h.y + t * (.05 + h.x * .05));
  vec2 c = vec2((h.x - .5) * .8 + sin(ty * 6.28 + h.z * 6.) * .12, .5 - ty);
  float r = mix(.03, .09, h.z * 1.8);
  return (1. - smoothstep(r * .3, r, length(f - c))) * (.5 + .5 * h.x);
}

// RUNNERS — drops that let go and run down the pane. Laid out in tall cells of CSS px; a cell may
// hold one runner, on its own clock and its own lane, so the pane never runs in step. A run is not
// a slide: the drop hesitates and wobbles, and the trail it leaves dries (fades) behind it, with a
// few small beads left standing. Returns x = the drop's coverage, y = its rim shade, z = the trail;
// the lens bend (in plate uv) goes out through bend.
vec3 runner(vec2 p, float t, vec2 cell, float seed, out vec2 bend){
  bend = vec2(0.);
  vec2 id = floor(p / cell);
  vec3 h = N13(id.x * 91.7 + id.y * 17.3 + seed);
  if (h.z > .5) return vec3(0.);
  vec2 f = fract(p / cell);
  float speed = .03 + h.y * .045;                                  // cells per second: 13–33 s per cell
  float ty = fract(h.x * 7.3 + t * speed);
  ty += .05 * sin(ty * 23. + h.z * 9.);                             // hesitate, then slide
  float x = .5 + (h.x - .5) * .5 + (h.y - .5) * .1 + sin(ty * 19. + h.z * 6.) * .022;   // the wobble
  vec2 d = (f - vec2(x, 1. - ty)) * cell;                           // px from the drop, y up
  float rad = 7. + h.y * 6.;                                        // 14–26 px across: the size of the bigger beads
  vec2 dd = vec2(d.x, d.y * .7);                                    // a running drop is tall
  float l = length(dd);
  float inside = 1. - smoothstep(rad * .8, rad, l);                // (edges in order: reversed smoothstep is undefined in GLSL ES)
  float r = min(l / rad, 1.);
  bend = inside * (dd / max(l, .001)) * r * r * .14;                // the lens: strongest at the rim, none at the crown
  float rim = smoothstep(rad * .45, rad * .92, l) * inside;
  float shade = rim * (.7 + .5 * d.y / rad) + inside * (1. - rim) * -.22;   // a bright rim, brightest where the sky above refracts in; a darker core
  float trail = (1. - smoothstep(1.2, 3.6, abs(d.x))) * step(0., d.y) * (1. - smoothstep(20., 240., d.y)) * (1. - inside);
  float beads = trail * smoothstep(.7, .95, fract(d.y / 13. + h.x * 3.)) * (1. - smoothstep(1., 2.6, abs(d.x)));
  bend += vec2(sign(d.x) * .03, 0.) * trail * (1. - smoothstep(1., 3.6, abs(d.x)));   // the wet streak lenses sideways
  return vec3(inside + beads * .8, shade, trail);
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = gl_FragCoord.xy / u_px;                   // CSS px, y up
  float t = u_time;
  // THE SKY MOVES (motion on): the clouds drift across the window — a slow pan through the crop's
  // slack, ~85 s edge to edge — the plate breathes (a 4.5% zoom) and the light sweeps slowly.
  float breath = u_motion * (.5 + .5 * sin(t * .08));
  vec2 drift = u_motion * vec2(sin(t * .075), .5 * sin(t * .05 + 1.3));
  float zoom = 1. + .045 * breath;
  vec2 cuv = coverUV(uv, zoom, drift, u_texSize);

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

  // THE RUNNERS — two layers of lanes, on different clocks
  float run = u_run * u_wet;
  vec3 r1 = vec3(0.), r2 = vec3(0.); vec2 b1 = vec2(0.), b2 = vec2(0.);
  if (run > 0.) {
    r1 = runner(p + vec2(u_seed * 5.1, u_seed * .7), t, vec2(46., 1300.), u_seed, b1);
    r2 = runner(p + vec2(23. + u_seed * 2.9, 0.), t * .85 + 37., vec2(72., 1700.), u_seed + 7., b2);
  }
  float rdrop = max(r1.x, r2.x) * run, rtrail = max(r1.z, r2.z) * run, rshade = (r1.y + r2.y) * run;
  bend += (b1 + b2) * run;
  cover = max(cover, rdrop + rtrail * .6);

  // the pane: condensation is a real blur of the plate (mip bias) plus a milky cast, cleared where the water sits
  float fog = u_fog * (1. - cover * .9) * (1. + .1 * u_motion * sin(t * .07));   // condensation breathes too
  float bias = 3.2 * fog;
  vec3 pane = texture(u_tex, cuv + bend, bias).rgb;
  if (u_fade < 1.) {                                 // a change of sky crossfades — never pops
    vec2 cuv2 = coverUV(uv, zoom, drift, u_tex2Size);
    pane = mix(texture(u_tex2, cuv2 + bend, bias).rgb, pane, smoothstep(0., 1., u_fade));
  }
  pane = mix(pane, mix(pane, u_tint, .35), fog);
  // the photo's shading, asymmetric: highlights carry the water, the dark side is kept quiet — a
  // drop's interior photographs dark against a studio wall, and against a sky that reads as a stain
  vec3 col = pane * (1. + (relief > 0. ? relief * .8 : relief * .3) * u_wet + rshade * 1.1 + rtrail * .1);

  // snow, in the air
  if (u_snow > 0.) {
    float s = max(flakes(p, 46., t, 1.), flakes(p, 110., t * .7, 2.) * .8);
    col = mix(col, vec3(.97, .98, 1.), s * u_snow * .8);
  }
  // THE CLOUD VEIL: soft shadows of clouds passing over the pane — large, slow, a tenth of the light.
  // This is what reads as movement on a flat overcast plate, where a pan of white on white shows
  // nothing. Frozen with motion off (a fixed, faint mottling); drifting at its own pace with it on.
  float sa = u_res.x / u_res.y;
  float cv = veil(vec2(uv.x * sa, uv.y) * 2.2 + u_seed * .1, t) - .5;
  col *= 1. + .17 * cv;
  // the scene's light (with motion, a slow sweep of it across the pane)
  col *= u_dim * (1. + .055 * u_motion * sin(t * .13 + uv.y * 2.4 + uv.x * .8));
  // TIME OF DAY: the sun grades the plate — warm from the horizon up with the sun low, a rose
  // afterglow low and blue above at dusk, the blue of night, and the exposure of the hour.
  float hz = 1. - smoothstep(0., .8, uv.y);                                   // 1 low in the frame
  col *= mix(vec3(1.), vec3(1.1, .9, .66), u_gold * (.3 + .7 * hz));
  col *= mix(vec3(1.), vec3(1.02, .8, .92), u_dusk * hz * .7);
  col *= mix(vec3(1.), vec3(.72, .8, 1.), min(1., u_dusk * (1. - hz) * .7 + u_night * .85));
  col *= u_light;
  // a breath of vignette
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
/** the two plate texture units (the map sits on 1) and the crossfade between them */
const PLATE_UNITS = [0, 2]
const FADE_MS = 1600
/** the still frame's clock — a static pane is the same pane on every draw */
const STILL = 11.7

export class WetGlassPane {
  private host!: HTMLElement
  private c!: HTMLCanvasElement
  private gl!: WebGL2RenderingContext
  private prog!: WebGLProgram
  private u: Record<string, WebGLUniformLocation | null> = {}
  private plates: (WebGLTexture | null)[] = [null, null]
  private plateSizes: [number, number][] = [[1, 1], [1, 1]]
  private cur = 0
  private fadeT0 = -1e9
  private map: WebGLTexture | null = null
  private mapSize: [number, number] = [1, 1]
  private recipe!: WetRecipe
  private grade: Daylight = { alt: 45, phase: 'day', rising: false, light: 1, gold: 0, dusk: 0, night: 0 }
  private seed = 0
  private moving = false
  private raf = 0
  private t0 = performance.now()
  private cap = new FrameCap()
  private plateToken = 0
  private mapToken = 0
  private lost = false

  mount(host: HTMLElement, recipe: WetRecipe, grade: Daylight, seed: number, moving: boolean) {
    this.host = host
    this.recipe = recipe
    this.grade = grade
    this.seed = seed
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
    for (const k of ['u_res', 'u_px', 'u_time', 'u_seed', 'u_tex', 'u_texSize', 'u_tex2', 'u_tex2Size', 'u_fade', 'u_map', 'u_mapSize',
      'u_wet', 'u_mapScale', 'u_run', 'u_fog', 'u_snow', 'u_dim', 'u_motion', 'u_tint', 'u_light', 'u_gold', 'u_dusk', 'u_night'])
      this.u[k] = gl.getUniformLocation(prog, k)
    // placeholders so the first frame is a flat pane, never a black one: a pale sky, a dry map
    this.plates = [this.blank(PLATE_UNITS[0], [214, 222, 226], gl.CLAMP_TO_EDGE), this.blank(PLATE_UNITS[1], [214, 222, 226], gl.CLAMP_TO_EDGE)]
    this.plateSizes = [[1, 1], [1, 1]]
    this.cur = 0
    this.map = this.blank(1, [128, 0, 0], gl.MIRRORED_REPEAT)
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

  /** Swap the plate: the new sky lands on the OTHER plate texture and crossfades in over the one
   *  showing. Decoded off-thread; a stale load (the scene changed again) is dropped. */
  private loadPlate(url: string) {
    const token = ++this.plateToken
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (token !== this.plateToken || this.lost) return
      const next = 1 - this.cur
      this.upload(PLATE_UNITS[next], this.plates[next], img, this.gl.CLAMP_TO_EDGE)
      this.plateSizes[next] = [img.naturalWidth, img.naturalHeight]
      this.cur = next
      this.fadeT0 = performance.now()
      this.c.dataset.plate = 'ready'
      this.kick()
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

  /** the sun's grade — pushed by the app whenever the minute (or the preview) changes */
  setGrade(grade: Daylight) {
    this.grade = grade
    this.draw()
  }

  setMoving(moving: boolean) {
    this.moving = moving   // App.tsx has already applied prefers-reduced-motion (and the ?motion= override)
    this.kick()
  }

  private fading() { return performance.now() - this.fadeT0 < FADE_MS }

  /** start the loop if it should run, else draw the still frame. No document.hidden gate: embedded
   *  webviews (the Claude desktop pane, some in-app browsers) report hidden while plainly on screen,
   *  and that gate froze the sky there (2026-09-18). A truly hidden tab gets no animation frames
   *  from the browser anyway, so the loop costs nothing in the background. A plate crossfade runs
   *  the loop for its 1.6 s even with motion off, then settles on the still frame. */
  private kick() {
    cancelAnimationFrame(this.raf)
    if (this.lost) return
    if (this.moving || this.fading()) {
      this.cap.reset()
      const loop = (now: number) => {
        if (!this.moving && !this.fading()) { this.draw(); return }
        this.raf = requestAnimationFrame(loop)
        if (this.cap.tick(now)) this.draw(this.moving ? (now - this.t0) / 1000 : STILL)
      }
      this.raf = requestAnimationFrame(loop)
    } else this.draw()
  }

  /** A tab that opened in the background measured 0×0 at mount and would keep a 1×1 pane until a
   *  window resize; re-measure whenever we come back into view, then resume or redraw. */
  private onVis = () => { this.resize(); this.kick() }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * SCALE
    const w = Math.max(1, Math.round((this.host.clientWidth || window.innerWidth) * dpr))
    const h = Math.max(1, Math.round((this.host.clientHeight || window.innerHeight) * dpr))
    if (this.c.width !== w || this.c.height !== h) {
      this.c.width = w; this.c.height = h
      this.gl.viewport(0, 0, w, h)
    }
    this.draw()
  }

  /** The still frame is drawn at a FIXED time, so a static pane is the same pane on every draw. */
  private draw(time = STILL) {
    if (this.lost) return
    const gl = this.gl, r = this.recipe, g = this.grade
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * SCALE
    const prev = 1 - this.cur
    gl.useProgram(this.prog)
    gl.uniform2f(this.u.u_res, this.c.width, this.c.height)
    gl.uniform1f(this.u.u_px, dpr)
    gl.uniform1f(this.u.u_time, time)
    gl.uniform1f(this.u.u_seed, this.seed)
    gl.uniform1i(this.u.u_tex, PLATE_UNITS[this.cur])
    gl.uniform2f(this.u.u_texSize, this.plateSizes[this.cur][0], this.plateSizes[this.cur][1])
    gl.uniform1i(this.u.u_tex2, PLATE_UNITS[prev])
    gl.uniform2f(this.u.u_tex2Size, this.plateSizes[prev][0], this.plateSizes[prev][1])
    gl.uniform1f(this.u.u_fade, Math.min(1, (performance.now() - this.fadeT0) / FADE_MS))
    gl.uniform2f(this.u.u_mapSize, this.mapSize[0], this.mapSize[1])
    gl.uniform1f(this.u.u_wet, r.map ? r.wet : 0)
    gl.uniform1f(this.u.u_mapScale, r.mapScale)
    gl.uniform1f(this.u.u_run, r.run)
    gl.uniform1f(this.u.u_fog, r.fog)
    gl.uniform1f(this.u.u_snow, r.snow)
    gl.uniform1f(this.u.u_dim, r.dim)
    gl.uniform1f(this.u.u_motion, this.moving ? 1 : 0)
    gl.uniform3f(this.u.u_tint, r.tint[0], r.tint[1], r.tint[2])
    gl.uniform1f(this.u.u_light, g.light)
    gl.uniform1f(this.u.u_gold, g.gold)
    gl.uniform1f(this.u.u_dusk, g.dusk)
    gl.uniform1f(this.u.u_night, g.night)
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
