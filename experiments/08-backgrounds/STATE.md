# WKNDR — Background Engines · STATE

Generative ambient-background R&D for the WKNDR weather field. The goal: a
distinctive, abstract, weather‑by‑inference background that makes the app feel
unique (a potential moat). Each engine is a self‑contained, tunable playground
that maps the six conditions — **sun · rain · cloud · wind · storm · snow** — to
colour, shape, and motion.

_Last updated: 2026-06-10_

---

## Where it lives & how it deploys

- **Repo:** `github.com/nessim-higson/wkndr` (public), branch `main`.
- **Source of truth (published):** `experiments/08-backgrounds/<engine>/index.html`.
- **Deploy:** `.github/workflows/deploy.yml` runs on every push to `main` — it
  builds the app to the site root and copies `experiments/*` + `iterations/*`
  **verbatim**. So: edit a file under `experiments/08-backgrounds/`, push to
  `main`, and ~2–3 min later the live URL updates.
- **Live gallery:** https://nessim-higson.github.io/wkndr/experiments/08-backgrounds/

### Working model (important)
There are **two copies** of each engine:
1. **Working copies** — `~/CLAUDE/projects/prototypes/wkndr-<engine>/index.html`
   (each has a local dev server in `prototypes/.claude/launch.json`). This is
   where iteration happens.
2. **Published snapshots** — `~/Code/wkndr/experiments/08-backgrounds/<engine>/`
   (committed + deployed).

When iterating: edit the working copy → `cp` into the repo folder → commit/push.
Keep them in sync. (Long‑term it may be cleaner to work directly in the repo.)

All engines are **single self‑contained HTML files** — Canvas 2D or WebGL, no
build step, no external dependencies, no network calls. They drop into the
static `experiments/` archive as‑is.

---

## The engines

Status legend: **● contender** · ○ kept/aesthetic · ◐ parked · ✕ retired

| Engine | Status | Live URL (under gallery base) | Local | Port |
|---|---|---|---|---|
| **Weather Auras** (`seasons`) | ● contender | `/seasons/` | `wkndr-seasons` | 4187 |
| **Weather Risograph** (`riso`) | ● contender | `/riso/` | `wkndr-riso` | 4182 |
| **Gradient Forms** (`forms`) | ● contender | `/forms/` | `wkndr-forms` | 4185 |
| **Fluid Watercolor** (`fluid`) | ○ keeper | `/fluid/` | `wkndr-fluid` | 4179 |
| **Aura Gradient** (`aura`) | ○ aesthetic | `/aura/` (+ `/aura/classic.html`) | `wkndr-aura` | 4181 |
| **Weather Spirits** (`spirit`) | ◐ parked | `/spirit/` | `wkndr-spirit` | 4186 |
| **Polygon Watercolor** (`watercolor`) | ✕ retired | (not in gallery) | `wkndr-watercolor` | 4178 |

Gallery base = `https://nessim-higson.github.io/wkndr/experiments/08-backgrounds`

### Weather Auras — `seasons/`  ● contender _(most refined)_
Big soft "aura poster" fields — one vast form per condition, mapped from
ultra‑refined gradient references. Finesse comes from **18‑stop smoothstep‑eased
radial falloffs** (solid plateau → long silky dissolve, kills banding) plus a
fine grain dither. Sun = haloed orb radiating heat rings; rain = soft veils
descending into a deep pool of light; cloud = a pale sun shrouded in a grey
veil; wind = long elongated breaths crossing a celadon field; storm = a charged
sphere arcing past the frame, churning interior + flickering ember rim; snow =
light dissolved in cold hush. Primitives: `orb()`, `orbEll()`, `ringOrb()`.
Controls: Scale, Movement, Grain, Reroll. _(Folder is named `seasons/` for URL
stability — it began as a seasons concept before being remapped to weather.)_

### Weather Risograph — `riso/`  ● contender
An abstract shape‑language: heavy print grain + colour‑field panels + crisp
line geometry, one signature motif per condition (sun = glow + ring; rain = thin
+ dotted falling lines; cloud = soft horizontal bands; wind = flowing
streamlines; storm = clashing shards + glitch; snow = scattered rings). Static
base + animated motif layer, time‑of‑day wash, per‑mode motion. Most
"system‑like / brandable." Controls: Density, Time of day, Motion, Grain.

### Gradient Forms — `forms/`  ● contender
Bauhaus‑meets‑gradient: bold overlapping geometric forms (circle/capsule/
rect/triangle/blob) with airbrushed gradient fills, multiply blending, halftone
+ grain. Weather‑driven composition: sun = warm radial blooms / sunbursts; rain
= cool tall blocks + rain lines; cloud = feathered lobed masses; wind = wavy
ribbons; storm = dark colliding shards (screen blend); snow = falling snowballs.
Controls: Forms, Softness, Halftone, Grain, Motion.

### Fluid Watercolor — `fluid/`  ○ keeper
Real GPU Navier‑Stokes solver (forked from PavelDoGreat, MIT) driven by
weather‑programmed splats; bleeds into wet‑on‑wet forms then freezes, or stays
"alive." Has a Drama event vocabulary (contrasting cores, statement blooms,
speckle, tide lines). Tap canvas to inject pigment. Gorgeous but the standalone
fluid look is less weather‑legible than the three contenders.

### Aura Gradient — `aura/`  ○ aesthetic
Continuously‑morphing WebGL mesh gradient with a glowing rounded‑rect "lens"
(Apple‑Intelligence / Siri‑glow family). Domain‑warped, travelling rim
highlight, Hobbs→Mierlo‑style dials. **Not weather‑mapped** — palette presets
only. `aura/classic.html` is a saved earlier version.

### Weather Spirits — `spirit/`  ◐ parked
The weather personified as a soft, barely‑there airbrushed creature with a faint
face + mood (sun awake, storm startled, snow asleep…) drifting among fireflies.
Charming but the user felt it "wasn't working." Parked — files retained, not
under active development.

### Polygon Watercolor — `watercolor/`  ✕ retired
Tyler‑Hobbs polygon‑deformation watercolor (crisp blooms, colour interleaving,
capillary fringe, Wetness dial). The first engine; removed from the gallery
lineup. Working copy retained locally; archived in the repo for backup.

---

## How we got here (brief)
Started from watercolor (Tyler Hobbs → wet‑on‑wet → fringe), explored a fluid
sim, then pivoted to abstract/geometric directions (riso, gradient forms),
tried a personified "spirits" direction (parked), and landed on the refined
"aura" fields. Recurring principles: **abstract, inference‑not‑literal**;
**alive but solid** motion; **restraint**. Three weather‑mapped contenders now
stand: Auras (refined/soft), Risograph (graphic/system), Forms (bold/geometric).

## Open threads / next steps
- Pick the lead contender (Auras / Riso / Forms) for the real app background.
- Tune the newest Aura modes (Rain veils could be more present; Wind a third colour).
- Consider a shared **time‑of‑day** light layer across engines (Riso already has one).
- Wire the chosen engine into the actual app at the `AmbientField` / `WeatherField` seam.
