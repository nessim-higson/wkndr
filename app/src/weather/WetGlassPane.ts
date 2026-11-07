// WET GLASS — the renderer (see wetglass.ts for the recipes and the why).
//
// One full-screen triangle, one fragment shader, four textures: the PLATE (the sky — two of them,
// so a change of sky crossfades instead of popping), the DROP MAP (a macro photograph of real
// droplets on a pane, high-passed into R = signed relief and G = coverage — see scripts in the
// 2026-09-12 session, the maps ship pre-baked; two of those as well, since 2026-10-26, so a change
// of water dissolves too). The water is not drawn: the shader bends the sky by the relief's slope
// (refraction), shades it by the relief itself (the photo's own rims and highlights), and clears
// the condensation where the drops are. Real drops are irregular, clustered and mostly tiny; the
// photograph carries that for free, which is exactly what the first, procedural cut of this file
// could not.
//
// Motion on (the default on the glass build): the SKY moves — clouds drift, a veil of cloud shadow
// passes, the plate breathes — and a few RUNNERS let go and run down the pane, wobbling, leaving a
// trail that dries behind them (2026-09-18, Ness: "the motion on the water — is that achievable?").
// The photographed beads stay put. With motion off the frame is drawn ONCE (and on resize / scene
// change), at a fixed time, so a still pane is the same pane on every draw; only a dissolve runs
// the loop briefly.
//
// THE WEATHER MOVES (2026-10-26, Ness: "the weather app on the iPhone is lovely — it has subtle
// movement that has been beautifully dialed in — can we make sure that the background feels
// equally sophisticated"). Six things, read off the first motion build against iOS Weather:
//   · nothing is a sine wave any more. Drift, breath, the light and the condensation each ride a
//     1-D value noise on their own timescale, so the pane never settles into a rhythm you can feel;
//   · RAIN IN THE AIR: streaks falling behind the glass at three depths, denser in a storm, a few
//     in a passing front, leaning with the wind. The beads on the pane still stay put;
//   · the WIND (weather/air.ts, from the hourly forecast) sets the clouds' pace and direction and
//     the rain's lean. A still day is still; a front moves;
//   · PARALLAX: the phone's tilt and the pointer move the sky a little, the air a little less,
//     eased, never more than a percent or two. Off with motion off;
//   · 60 fps while the sky moves (the runners stuttered at 30 on a 120 Hz phone), 30 as the
//     fallback — a tab that can't hold it, motion off, ?fps=30;
//   · every change DISSOLVES (weather/ease.ts): the plate, the water, the air, the sun's grade and
//     the wind each ease over seconds on a curve at rest at both ends. Nothing lands.
//
// TIME OF DAY (daylight.ts): the sun grades the plate at the end of the pipe — exposure, the warmth
// of a low sun, a rose afterglow, the blue of night — so rain at 22:00 is dark rain, still raining.
import { FrameCap } from './looks/types'
import type { WetRecipe } from './wetglass'
import type { Daylight } from './daylight'
import { STILL_AIR, type Air } from './air'
import { Eased, smoother } from './ease'

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
uniform float u_fade;      // eased on the CPU (weather/ease.ts) — the shader just mixes
uniform sampler2D u_map;   // the drop map
uniform vec2 u_mapSize;
uniform float u_mapScale;
uniform sampler2D u_map2;  // the map before it, while u_mapFade < 1
uniform vec2 u_map2Size;
uniform float u_map2Scale;
uniform float u_mapFade;
uniform float u_wet, u_run, u_fog, u_snow, u_rain, u_dim, u_motion;
uniform vec3 u_tint;
uniform float u_light, u_gold, u_dusk, u_night;   // the sun's grade (daylight.ts)
uniform vec2 u_air;        // x: the wind's push across the window (−1..1, right positive), y: its force (0..1)
uniform vec2 u_par;        // parallax: where you look from (−1..1), eased on the CPU; zero with motion off

// value noise for the cloud veil: large soft cells, four octaves, panning with the wind
float H21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float VN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(H21(i), H21(i + vec2(1., 0.)), f.x), mix(H21(i + vec2(0., 1.)), H21(i + vec2(1., 1.)), f.x), f.y); }
float veil(vec2 p, vec2 pan, float t){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * VN(p + pan * t * (1. + float(i) * .25)); p = p * 2.03 + 7.1; a *= .5; } return v; }
vec3 N13(float p){ vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787)); p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x)); }

// 1-D value noise — THE CLOCK EVERY MOTION RUNS ON (2026-10-26). A sine has a period you learn in
// twenty seconds; this has none. Two octaves so a wander is never one bump. −1..1, smooth.
float H11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float N1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(H11(i), H11(i + 1.), f); }
float wander(float x){ return (N1(x) * .72 + N1(x * 2.63 + 13.1) * .28) * 2. - 1.; }

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

// the drop map in CSS px, mirrored at its edges; the seed slides the window so tomorrow's pane is
// a different patch of the same photograph. Reads the relief, the coverage and both slopes.
void mapRead(sampler2D m, vec2 size, float scale, vec2 p, out float relief, out float cover, out vec2 gR, out vec2 gC){
  vec2 muv = (p + vec2(u_seed * 3.7, u_seed * 1.3)) / vec2(scale, scale * size.y / size.x);
  vec2 e = 1.5 / size;
  vec3 m0 = texture(m, muv).rgb;
  vec3 mx1 = texture(m, muv + vec2(e.x, 0.)).rgb, mx0 = texture(m, muv - vec2(e.x, 0.)).rgb;
  vec3 my1 = texture(m, muv + vec2(0., e.y)).rgb, my0 = texture(m, muv - vec2(0., e.y)).rgb;
  relief = (m0.r - .5) * 2.;                     // −1..1, the photo's own rims and highlights
  cover = m0.g;
  gR = vec2(mx1.r - mx0.r, my1.r - my0.r);       // the relief's slope: sharp, at the rims
  gC = vec2(mx1.g - mx0.g, my1.g - my0.g);       // the coverage's slope: a soft dome per drop, so the
                                                 // WHOLE interior lenses the sky, not just the edge
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

// RAIN IN THE AIR (2026-10-26) — streaks falling behind the glass. One layer: cells in a space
// SHEARED by the wind, so a streak falls straight down in it and leans on screen; the whole layer
// falls at speed (CSS px/s) and each cell holds one streak or none, bright at its head, fading up
// its tail. A cell near the density line fades in rather than appearing, so a change of weather
// sprinkles the air rather than switching it. Three layers at three depths (main) are the parallax.
float rainfall(vec2 p, float t, float cellW, float len, float speed, float slant, float density, float layer){
  vec2 q = vec2(p.x + p.y * slant, p.y + t * speed);
  vec2 cell = vec2(cellW, len * 2.4);
  vec2 id = floor(q / cell);
  vec3 h = N13(id.x * 37.1 + id.y * 113.7 + layer * 59.3 + u_seed);
  float on = 1. - smoothstep(density - .12, density, h.z);
  if (on <= 0.) return 0.;
  vec2 f = (fract(q / cell) - .5) * cell;
  vec2 c = vec2((h.x - .5) * (cellW - 4.), (h.y - .5) * (cell.y - len));
  float dx = abs(f.x - c.x);
  float l = len * (.45 + .55 * fract(h.x * 7.31));                  // no two streaks the same length
  float g = (f.y - c.y) / l + .5;                                   // 0 at the head (below), 1 at the tail's end
  float along = smoothstep(0., .12, g) * (1. - smoothstep(.4, 1., g));   // a soft head, a tail that thins out
  float core = 1. - smoothstep(.3, 1.1, dx);
  return on * core * along * (.3 + .7 * fract(h.y * 5.17));        // and no two the same weight
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
  float sa = u_res.x / u_res.y;
  // THE SKY MOVES (motion on): the clouds wander through the crop's slack on noise — a minute or
  // two per excursion on a still day, faster under a wind — the plate breathes (up to 3.5%) on a
  // clock of its own, and the whole crop is zoomed 2% so the parallax has room at the edges.
  float pace = 1. + 1.4 * u_air.y;
  vec2 drift = u_motion * vec2(wander(t * .011 * pace + u_seed), .6 * wander(t * .008 * pace + u_seed + 41.));
  float breath = .5 + .5 * wander(t * .014 + u_seed + 7.);
  float zoom = (1. + .02 * u_motion) * (1. + .035 * u_motion * breath);
  // PARALLAX: the far sky moves most with your eye (the screen is the window frame), the air less
  vec2 par = u_par * vec2(.011, .008);
  vec2 cuv = coverUV(uv, zoom, drift, u_texSize) - par;

  // THE WATER — the drop map (and, while it dissolves, the one before it)
  float relief, cover0; vec2 gR, gC;
  mapRead(u_map, u_mapSize, u_mapScale, p, relief, cover0, gR, gC);
  if (u_mapFade < 1.) {
    float r2, c2; vec2 gR2, gC2;
    mapRead(u_map2, u_map2Size, u_map2Scale, p, r2, c2, gR2, gC2);
    relief = mix(r2, relief, u_mapFade); cover0 = mix(c2, cover0, u_mapFade);
    gR = mix(gR2, gR, u_mapFade); gC = mix(gC2, gC, u_mapFade);
  }
  float cover = cover0 * u_wet;
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

  // the pane: condensation is a real blur of the plate (mip bias) plus a milky cast, cleared where
  // the water sits — and it breathes, on its own slow noise
  float fog = u_fog * (1. - cover * .9) * (1. + .08 * u_motion * wander(t * .02 + u_seed + 99.));
  float bias = 3.2 * fog;
  vec3 pane = texture(u_tex, cuv + bend, bias).rgb;
  if (u_fade < 1.) {                                 // a change of sky dissolves — never pops
    vec2 cuv2 = coverUV(uv, zoom, drift, u_tex2Size) - par;
    pane = mix(texture(u_tex2, cuv2 + bend, bias).rgb, pane, u_fade);
  }
  pane = mix(pane, mix(pane, u_tint, .35), fog);
  // the photo's shading, asymmetric: highlights carry the water, the dark side is kept quiet — a
  // drop's interior photographs dark against a studio wall, and against a sky that reads as a stain
  vec3 col = pane * (1. + (relief > 0. ? relief * .8 : relief * .3) * u_wet + rshade * 1.1 + rtrail * .1);

  // RAIN IN THE AIR: three depths behind the glass, the nearest the longest and the fastest, all
  // leaning with the wind; the glass lenses them like it lenses the sky; condensation veils them.
  // Composited after the sun's grade (below): a streak is lit relative to the sky it falls through,
  // with a floor the night's exposure cannot crush — rain at night must still read as rain.
  float rain = 0.;
  if (u_rain > 0.) {
    vec2 rp = p;                                     // NOT lensed by the beads: a map's slopes are texel-sharp and shatter a 1 px streak into specks (tried 2026-10-26)
    float slant = u_air.x * .5;
    vec2 pp = u_par * vec2(1., .7) * 10.;            // the air sits between you and the sky: less parallax than the plate
    // PULLED BACK (2026-10-26, Ness: "too often and not believable enough"): a window shows the
    // occasional streak, not a curtain — a third of the cells, half the weight of the first cut
    rain = rainfall(rp - pp * .3, t, 72., 30., 980., slant, .3 * u_rain, 1.) * .15
         + rainfall(rp - pp * .55, t * .92, 52., 20., 700., slant * .9, .3 * u_rain, 2.) * .1
         + rainfall(rp - pp * .8, t * .85, 36., 13., 480., slant * .8, .25 * u_rain, 3.) * .06;
    rain *= 1. - u_fog * .6;
  }
  // snow, in the air
  if (u_snow > 0.) {
    vec2 pp = u_par * vec2(1., .7) * 10.;
    float s = max(flakes(p - pp * .4, 46., t, 1.), flakes(p - pp * .7, 110., t * .7, 2.) * .8);
    col = mix(col, vec3(.97, .98, 1.), s * u_snow * .8);
  }
  // THE CLOUD VEIL: soft shadows of clouds passing over the pane — large, slow, a tenth of the light.
  // This is what reads as movement on a flat overcast plate, where a pan of white on white shows
  // nothing. Frozen with motion off (a fixed, faint mottling); panning WITH THE WIND with it on: a
  // still day barely stirs, a front passes.
  vec2 pan = vec2(sign(u_air.x + 1e-5) * (.006 + .045 * abs(u_air.x)), .003);
  float cv = veil(vec2(uv.x * sa, uv.y) * 2.2 + u_seed * .1 - par * 6., pan, t) - .5;
  col *= 1. + .17 * cv;
  // the scene's light (with motion, a slow sweep of it across the pane — a drifting cell of noise)
  col *= u_dim * (1. + .05 * u_motion * (VN(vec2(uv.x * sa * 1.4 + t * .021, uv.y * 1.2 - t * .012) + u_seed) * 2. - 1.));
  // TIME OF DAY: the sun grades the plate — warm from the horizon up with the sun low, a rose
  // afterglow low and blue above at dusk, the blue of night, and the exposure of the hour.
  float hz = 1. - smoothstep(0., .8, uv.y);                                   // 1 low in the frame
  col *= mix(vec3(1.), vec3(1.1, .9, .66), u_gold * (.3 + .7 * hz));
  col *= mix(vec3(1.), vec3(1.02, .8, .92), u_dusk * hz * .7);
  col *= mix(vec3(1.), vec3(.72, .8, 1.), min(1., u_dusk * (1. - hz) * .7 + u_night * .85));
  col *= u_light;
  col += rain * (vec3(.12, .13, .16) + col * .8);   // the rain in the air, lit by the sky and a little by the city
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
/** the two plate texture units and the two map units, and the dissolves between each pair */
const PLATE_UNITS = [0, 2]
const MAP_UNITS = [1, 3]
/** a change of sky or of water: iOS lets a change take its time — the first plate lands faster,
 *  it has only a flat placeholder to dissolve from */
const FADE_MS = 2800
const FIRST_FADE_MS = 1200
/** the sun moving an hour under the scrubber's thumb, the wind of the next hour, a new recipe's scalars */
const GRADE_MS = 900
/** the parallax ease, seconds — the sky follows your eye, it does not snap to it */
const PAR_TAU = .28
/** frame budgets: 60 fps while the sky moves, 30 otherwise (and when 60 can't be held) */
const BUDGET_MOVING = 16, BUDGET_STILL = 33
/** the still frame's clock — a static pane is the same pane on every draw */
const STILL = 11.7

export interface PaneStats { fps: number; budget: number; degraded: boolean; par: [number, number]; air: Air }

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
  private fadeMs = FADE_MS
  private maps: (WebGLTexture | null)[] = [null, null]
  private mapSizes: [number, number][] = [[1, 1], [1, 1]]
  private mapScales: [number, number] = [700, 700]
  private curMap = 0
  private mapFadeT0 = -1e9
  private recipe!: WetRecipe
  /** the recipe's scalars as shown: wet, run, fog, snow, rain, dim, tint r g b */
  private rec = new Eased([0, 0, 0, 0, 0, 1, 1, 1, 1])
  /** the sun's grade and the air as shown: light, gold, dusk, night, air x, air force */
  private sun = new Eased([1, 0, 0, 0, 0, 0])
  private sunTarget = new Float32Array([1, 0, 0, 0, 0, 0])
  private air: Air = STILL_AIR
  private par: [number, number] = [0, 0]
  private parTarget: [number, number] = [0, 0]
  private seed = 0
  private moving = false
  private raf = 0
  private t0 = performance.now()
  private cap = new FrameCap()
  private slow = 0
  private degraded = false
  private degradedUntil = 0
  private strikes = 0
  private readonly fpsPin = new URLSearchParams(location.search).get('fps') === '30'   // judge the 30 fps fallback on a phone that can do 60
  private plateToken = 0
  private mapToken = 0
  private lost = false

  mount(host: HTMLElement, recipe: WetRecipe, grade: Daylight, seed: number, moving: boolean, air: Air = STILL_AIR) {
    this.host = host
    this.recipe = recipe
    this.seed = seed
    this.air = air
    this.rec.jump(recipeScalars(recipe))
    this.sunTarget.set([grade.light, grade.gold, grade.dusk, grade.night, air.x, air.force])
    this.sun.jump(this.sunTarget)
    this.c = document.createElement('canvas')
    this.c.className = 'wet-glass'
    this.c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    host.prepend(this.c)
    const gl = this.c.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
    if (!gl) throw new Error('no webgl2')
    this.gl = gl
    this.c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; cancelAnimationFrame(this.raf) })
    this.c.addEventListener('webglcontextrestored', () => { this.lost = false; this.setup(); this.loadPlate(this.recipe.plate); this.loadMap(this.recipe.map, this.recipe.mapScale); this.kick() })
    this.setup()
    this.resize()
    this.loadPlate(recipe.plate)
    this.loadMap(recipe.map, recipe.mapScale)
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
    for (const k of ['u_res', 'u_px', 'u_time', 'u_seed', 'u_tex', 'u_texSize', 'u_tex2', 'u_tex2Size', 'u_fade',
      'u_map', 'u_mapSize', 'u_mapScale', 'u_map2', 'u_map2Size', 'u_map2Scale', 'u_mapFade',
      'u_wet', 'u_run', 'u_fog', 'u_snow', 'u_rain', 'u_dim', 'u_motion', 'u_tint', 'u_light', 'u_gold', 'u_dusk', 'u_night', 'u_air', 'u_par'])
      this.u[k] = gl.getUniformLocation(prog, k)
    // placeholders so the first frame is a flat pane, never a black one: a pale sky, a dry map
    this.plates = [this.blank(PLATE_UNITS[0], [214, 222, 226], gl.CLAMP_TO_EDGE), this.blank(PLATE_UNITS[1], [214, 222, 226], gl.CLAMP_TO_EDGE)]
    this.plateSizes = [[1, 1], [1, 1]]
    this.cur = 0
    this.maps = [this.blank(MAP_UNITS[0], [128, 0, 0], gl.MIRRORED_REPEAT), this.blank(MAP_UNITS[1], [128, 0, 0], gl.MIRRORED_REPEAT)]
    this.mapSizes = [[1, 1], [1, 1]]
    this.curMap = 0
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

  /** Swap the plate: the new sky lands on the OTHER plate texture and dissolves in over the one
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
      this.fadeMs = this.plateSizes[this.cur][0] === 1 ? FIRST_FADE_MS : FADE_MS
      this.cur = next
      this.fadeT0 = performance.now()
      this.c.dataset.plate = 'ready'
      this.kick()
    }
    img.src = url
  }

  /** Swap the drop map the same way: the new water lands on the other map texture and dissolves in.
   *  A dry scene lands the 1×1 neutral map (and u_wet eases to 0 anyway). The scale is the map's
   *  own, bound to its slot — easing it would zoom the drops. */
  private loadMap(url: string | null, scale: number) {
    const token = ++this.mapToken
    const land = (img: HTMLImageElement | null) => {
      const gl = this.gl
      const next = 1 - this.curMap
      if (img) {
        this.upload(MAP_UNITS[next], this.maps[next], img, gl.MIRRORED_REPEAT)
        this.mapSizes[next] = [img.naturalWidth, img.naturalHeight]
      } else {
        gl.activeTexture(gl.TEXTURE0 + MAP_UNITS[next]); gl.bindTexture(gl.TEXTURE_2D, this.maps[next])
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([128, 0, 0]))
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        this.mapSizes[next] = [1, 1]
      }
      this.mapScales[next] = scale
      this.curMap = next
      this.mapFadeT0 = this.mapSizes[1 - next][0] === 1 && !img ? -1e9 : performance.now()   // dry to dry: nothing to dissolve
      this.kick()
    }
    if (!url) { land(null); return }
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => { if (token === this.mapToken && !this.lost) land(img) }
    img.src = url
  }

  setRecipe(recipe: WetRecipe, seed?: number) {
    const plateChanged = recipe.plate !== this.recipe.plate
    const mapChanged = recipe.map !== this.recipe.map || recipe.mapScale !== this.recipe.mapScale
    this.recipe = recipe
    if (seed != null) this.seed = seed
    if (plateChanged) this.loadPlate(recipe.plate)
    if (mapChanged) this.loadMap(recipe.map, recipe.mapScale)
    // the scalars dissolve with the plate; alone (the hour moved the grade's native flag, say) they take the short ease
    this.rec.set(recipeScalars(recipe), plateChanged || mapChanged ? FADE_MS : GRADE_MS, performance.now())
    this.kick()
  }

  /** the sun's grade — pushed by the app whenever the minute (or the preview, or the scrubber) changes */
  setGrade(grade: Daylight) {
    this.sunTarget.set([grade.light, grade.gold, grade.dusk, grade.night], 0)
    this.sun.set(this.sunTarget, GRADE_MS, performance.now())
    this.kick()
  }

  /** the wind of this hour (weather/air.ts) — eased in like the grade, so the lean never jumps */
  setAir(air: Air) {
    if (air.x === this.air.x && air.force === this.air.force) return   // the hourly re-read hands over the same wind most minutes
    this.air = air
    this.sunTarget.set([air.x, air.force], 4)
    this.sun.set(this.sunTarget, GRADE_MS, performance.now())
    this.kick()
  }

  /** where you look from, −1..1 on each axis (tilt, pointer); eased toward in the loop, which is
   *  always running while the sky moves. Ignored with motion off. */
  setParallax(x: number, y: number) {
    const clamp = (v: number) => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0))
    this.parTarget = this.moving ? [clamp(x), clamp(y)] : [0, 0]
  }

  setMoving(moving: boolean) {
    this.moving = moving   // App.tsx has already applied prefers-reduced-motion (and the ?motion= override)
    if (!moving) this.parTarget = [0, 0]
    this.kick()
  }

  private fading(now: number) { return now - this.fadeT0 < this.fadeMs || now - this.mapFadeT0 < FADE_MS }
  private parSettled() { return Math.abs(this.par[0] - this.parTarget[0]) < 1e-3 && Math.abs(this.par[1] - this.parTarget[1]) < 1e-3 }
  /** anything to animate? motion, a dissolve, an eased grade or wind, a parallax still on its way */
  private busy(now: number) { return this.moving || this.fading(now) || this.rec.active(now) || this.sun.active(now) || !this.parSettled() }
  private budget() { return this.moving && !this.degraded && !this.fpsPin ? BUDGET_MOVING : BUDGET_STILL }
  /** the loop's budget, re-read each frame: a degraded pane tries 60 again after its rest */
  private rebudget(now: number) {
    if (this.degraded && this.degradedUntil && now > this.degradedUntil) { this.degraded = false; this.slow = 0 }
    this.cap.budget = this.budget()
  }

  /** start the loop if it should run, else draw the still frame. No document.hidden gate: embedded
   *  webviews (the Claude desktop pane, some in-app browsers) report hidden while plainly on screen,
   *  and that gate froze the sky there (2026-09-18). A truly hidden tab gets no animation frames
   *  from the browser anyway, so the loop costs nothing in the background. A dissolve runs the loop
   *  for its few seconds even with motion off, then settles on the still frame. */
  private kick() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this.lost) return
    if (!this.busy(performance.now())) { this.draw(); return }
    this.cap.reset()
    this.cap.budget = this.budget()
    let last = 0
    const loop = (now: number) => {
      if (!this.busy(now)) { this.raf = 0; this.par = [...this.parTarget]; this.draw(); return }
      this.raf = requestAnimationFrame(loop)
      if (!this.cap.tick(now)) return
      const dt = last ? Math.min(.1, (now - last) / 1000) : 0
      last = now
      // the parallax eases toward where you look from — an exponential approach, frame-rate independent
      const k = 1 - Math.exp(-dt / PAR_TAU)
      this.par = [this.par[0] + (this.parTarget[0] - this.par[0]) * k, this.par[1] + (this.parTarget[1] - this.par[1]) * k]
      this.watch(now)
      this.rebudget(now)
      this.draw(this.moving ? (now - this.t0) / 1000 : STILL, now)
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** THE 60 → 30 FALLBACK: a pane that can't hold 60 (an old phone, a busy tab) stutters between 60
   *  and 40, which is worse than a steady 30. After ~90 consecutive slow draws (the EMA says under
   *  42 fps while asked for 60) it drops to the still budget for half a minute, then tries again;
   *  the third strike is for the session — a page-load stutter must not pin a phone at 30, and a
   *  phone that really can't must not be asked every thirty seconds. */
  private watch(now: number) {
    if (this.cap.budget !== BUDGET_MOVING) return
    if (this.cap.fps >= 42) { this.slow = 0; return }
    if (++this.slow <= 90) return
    this.slow = 0
    this.degraded = true
    this.degradedUntil = ++this.strikes >= 3 ? 0 : now + 30_000
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
  private draw(time = STILL, now = performance.now()) {
    if (this.lost) return
    const gl = this.gl
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * SCALE
    const prev = 1 - this.cur, prevMap = 1 - this.curMap
    const r = this.rec.at(now), s = this.sun.at(now)
    gl.useProgram(this.prog)
    gl.uniform2f(this.u.u_res, this.c.width, this.c.height)
    gl.uniform1f(this.u.u_px, dpr)
    gl.uniform1f(this.u.u_time, time)
    gl.uniform1f(this.u.u_seed, this.seed)
    gl.uniform1i(this.u.u_tex, PLATE_UNITS[this.cur])
    gl.uniform2f(this.u.u_texSize, this.plateSizes[this.cur][0], this.plateSizes[this.cur][1])
    gl.uniform1i(this.u.u_tex2, PLATE_UNITS[prev])
    gl.uniform2f(this.u.u_tex2Size, this.plateSizes[prev][0], this.plateSizes[prev][1])
    gl.uniform1f(this.u.u_fade, smoother((now - this.fadeT0) / this.fadeMs))
    gl.uniform1i(this.u.u_map, MAP_UNITS[this.curMap])
    gl.uniform2f(this.u.u_mapSize, this.mapSizes[this.curMap][0], this.mapSizes[this.curMap][1])
    gl.uniform1f(this.u.u_mapScale, this.mapScales[this.curMap])
    gl.uniform1i(this.u.u_map2, MAP_UNITS[prevMap])
    gl.uniform2f(this.u.u_map2Size, this.mapSizes[prevMap][0], this.mapSizes[prevMap][1])
    gl.uniform1f(this.u.u_map2Scale, this.mapScales[prevMap])
    gl.uniform1f(this.u.u_mapFade, smoother((now - this.mapFadeT0) / FADE_MS))
    gl.uniform1f(this.u.u_wet, r[0])
    gl.uniform1f(this.u.u_run, r[1])
    gl.uniform1f(this.u.u_fog, r[2])
    gl.uniform1f(this.u.u_snow, r[3])
    gl.uniform1f(this.u.u_rain, r[4])
    gl.uniform1f(this.u.u_dim, r[5])
    gl.uniform3f(this.u.u_tint, r[6], r[7], r[8])
    gl.uniform1f(this.u.u_motion, this.moving ? 1 : 0)
    gl.uniform1f(this.u.u_light, s[0])
    gl.uniform1f(this.u.u_gold, s[1])
    gl.uniform1f(this.u.u_dusk, s[2])
    gl.uniform1f(this.u.u_night, s[3])
    gl.uniform2f(this.u.u_air, s[4], s[5])
    gl.uniform2f(this.u.u_par, this.par[0], this.par[1])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  fps() { return this.cap.fps }
  /** for the ?hud=1 readout and the console: what the pane is doing right now */
  stats(): PaneStats { return { fps: this.cap.fps, budget: this.cap.budget, degraded: this.degraded, par: [...this.par], air: this.air } }

  destroy() {
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVis)
    this.plateToken++; this.mapToken++
    try { this.gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* already gone */ }
    this.c.remove()
  }
}

/** the recipe's scalars in the order the eased set holds them; `wet` is 0 without a map, whatever the recipe says */
function recipeScalars(r: WetRecipe): number[] {
  return [r.map ? r.wet : 0, r.run, r.fog, r.snow, r.rain, r.dim, r.tint[0], r.tint[1], r.tint[2]]
}
