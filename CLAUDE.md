# CLAUDE.md — WKNDR

> Read this first. It is the working memory for the WKNDR project. It exists so any
> fresh Claude Code session can be productive immediately without re-onboarding.
> Update it as decisions are made. Treat it the way `moms-library` treats its own CLAUDE.md.

---

## ⚠️ DIRECTION UPDATE (current source of truth: `docs/discovery-direction.md`)

**WKNDR pivoted from "curated weekend brief" → "weather-aware, swipe-trained discovery
engine for Amsterdam."** Read [`docs/discovery-direction.md`](docs/discovery-direction.md)
first — it is the locked, canonical product direction. The sections below this banner are
still valid as the **design-lineage history** (the visual exploration that got us here),
but where the *product thesis* differs, the discovery-direction doc wins.

What changed, in one breath:
- **Swipe is the taste engine.** Tinder-style L/R/up/down; every swipe is a labeled
  training signal; onboarding is a meaty ~30-card round (not 3).
- **List ↔ Stack duality.** Same weather×taste-ranked pool, two postures, a per-session toggle.
- **Weather is demoted from *thesis* to *sharpest ranking lens*** over a broad pool
  (9 categories × 4 freshness buckets). The weather engine did NOT disappear.
- **Tech: PWA (not native iOS) · DOM + Framer Motion for cards · WebGL shader for the
  weather-field only (polish-phase, bounded spec).**
- **Build order: validate before depth.** Phase 1 = weekend-only swipe stack, CSS gradient
  bg, basic swipe, list/stack toggle stubbed. Goal: do Ness + partner open it for ~8 weekends?
- **The honest risk is the living content pipeline, not design.** Go deep in ONE city first.
- **Amsterdam only. Build for self + partner.** New Orleans / multi-city is shelved until validated.

---

## The build (`/app`) — Phase 1, in progress

The product lives in **`/app`** — a **Vite + React + TypeScript + Framer Motion** app
(run with **Bun**: `cd app && bun install && bun run dev`). Plain CSS with the design-token
system (no utility framework). Chosen for slick animation/micro-interaction headroom; wraps
cleanly to iOS via Capacitor later if ever needed. `/experiments` stays as the design archive.

Phase 1 (validate) is built and working:
- `weather/WeatherField.tsx` — full-screen weather-reactive background, crossfades between
  modes (~1.2s) + slow breathing drift. The seam where the WebGL shader drops in at Phase 3.
- `weather/modes.ts` — 5-mode classifier + palettes + `rankPicks()` (weather × freshness;
  taste term arrives Phase 4).
- `components/SwipeStack.tsx` — Framer Motion drag deck, L/R/up/down = like/nope/save/skip,
  drag indicators + action buttons.
- `components/ListView.tsx` + the `App.tsx` Stack↔List toggle — the list/stack duality.
- `data/picks.ts` — **hand-curated real Amsterdam events** (snapshot 31 May 2026: this
  weekend + coming weekend, from Songkick / Holland Festival / museums / I amsterdam, each
  credited + linked). A manual snapshot — the automated refresh is `docs/content-pipeline.md`
  (Phase 5). `verify:true` marks details (venue/time) still to confirm. Images still picsum.
- Live weather via Open-Meteo + BigDataCloud reverse-geocode ("use my weather"); demo mode
  pills flip all 5 modes.

Verified: boots, swipe + buttons work, ranking visibly re-ranks per mode, saved count
persists across mode changes, crossfade works. Next per discovery-direction §9: Phase 2
(polish the swipe feel) only once it's proven sticky.

## What WKNDR was (the original brief framing — now one *view* within the engine)

A personalized weekly **weekend brief** for a city, re-ranked by the weather, written
with an editorial voice. It synthesizes the city's existing publications (event guides,
listings, blogs) and re-presents the best options for *this* weekend, *this* weather,
*this* household — as a considered brief, not an infinite feed. **This now lives as the
"This weekend" freshness view inside the discovery engine** (see discovery-direction.md §6).

**The wedge: weather.** Every competitor (Bigfoot, dammie, Time Out, Fever, I amsterdam)
is either a weather-blind event aggregator or a community play. WKNDR's defensible angle is
**weather as the organizing ranking lens** + a swipe-trained taste profile + craft.

**First user: Ness + partner in Amsterdam** (the ~4yo kid use-case is now a *cross-cut*
"With kids" lens, not the whole product). Build-for-self first (~8–12 weeks validation).

---

## Core strategic decisions (do not re-litigate without reason)

- **Weather is the USP.** The condition phrase is the emotional hero. The whole brief
  re-ranks on the weather.
- **Legal model: signal + link, not republish** (the Techmeme model). Scrape facts,
  name + credit the source publication, link out. Never reproduce their content. The
  "source trace" (naming Buienradar, KNMI, Little Black Book, Kidsproof, etc.) is both a
  credibility device and a publisher-relations posture.
- **UX: feed-first with toggles, chat as escape hatch** — NOT chat-first.
- **Build the personal version first** via a Thursday cron. Paid acquisition is the wrong
  tool at this stage.
- **v5 is the chosen working base.** Clean top bar + filter strip + weather banner +
  editorial lede + picks. Everything since v5 is exploration *on top of* v5, not
  replacement of it.

---

## The design lineage (what's in /experiments and why)

The folder order IS the chronology. Each folder is a chapter of the exploration.

### 01-foundations
Early hunting for the right base.
- `01-v1-editorial-dark` — Fraunces, dark paper. Too magazine.
- `02-v2-helvetica` — Helvetica pivot. The typographic instinct that keeps returning.
- `03-v3-appstore-cards` — bigger logo, app-store-style cards.
- `04-v4-clean-topbar` — clean top bar, CSS gradients, publication chips. **This layout
  became v5.**
- `05-weather-modes` — standalone comparison of the 5 weather modes (HOT/WARM/COOL/
  COLD_WET/VOLATILE). Reference for the engine's visual states.

### 02-v5-family (the working base + its offshoots)
- `01-v5-base` — **THE BASE.** v4 layout + weather engine folded in. Everything else
  refines or re-skins this.
- `02-v6-weather-hero-rejected` — weather blown up to full hero (96px temp). **Rejected**
  as too big. Kept as a "we tried this" marker.
- `03-v7-settings-drawer` — back to v5 proportions + a settings drawer.
- `04-v8-auro-aura` — Aurō-inspired soft radial gradient orb behind the city name,
  color-shifting by mode. Seed of the later "generative cover" idea.
- `05-v5-kids` — **v5 focused on the real use case:** Sunday 24 May 2026, 24°C sunny,
  Ness + 4yo, Whitsun weekend. Real today-content (Muiderslot medieval days, Fluistervink
  silent boat, Vondelpark + pancake boat). **This is the current favourite.**
- `06-v5-kids-clickable-refresh` — v5-kids with every link wired to real venue URLs +
  a big REFRESH button cycling 3 pre-built pick-sets (today-only / water+active /
  quieter-indoor).

### 03-visual-languages (four different skins, same content)
- `01-editorial-sunday` — printed Sunday-supplement, Fraunces, restrained. Air Mail energy.
- `02-bold-index` — Apartamento/KIOSK indie-magazine, Inter Tight 900 + Instrument Serif.
- `03-scrollytelling` — WePresent-style; each pick a full-screen chapter with its own
  colour world; mix-blend-mode nav; scroll-triggered reveals.
- `04-postcards` — picks as tilted postcards on a textured desk; postmarks, stamps,
  handwritten Caveat captions; hover-parallax.

### 04-header-directions
- `01-six-headers-compared` — six static header treatments side by side:
  I Live Weather Scene · II Clock-Driven · III Generative Cover · IV Reveals Itself ·
  V Control Surface · VI The Moment. (See "Header thinking" below.)

### 05-cover-hara (most recent thread)
- `01-cover-resolved-editorial` — directions III + IV combined: a generative cover that
  *is* the weather data, with a source-trace band beneath it showing the work. Editorial
  styling (Fraunces, issue numbers).
- `02-cover-helvetica` — same, **de-editorialized**: Helvetica throughout, issue numbers
  and coordinates removed, cover reads as product not print. Includes a "later today"
  time-window affordance (the rescued-useful part of direction V).
- `03-hara` — **most recent.** Kenya Hara visual language: warm Muji paper, single quiet
  photograph as cover, tiny precise type, generous *ma* (negative space), one deep-red
  accent, picks as paired image+caption plates. The "publication you sit with" extreme.

---

## Header thinking (the live design question)

The header is where Ness wants "the most interesting moment" to happen. Six directions
were mapped (see 04). Working conclusions:
- **II (clock) and VI (the moment)** are the most "WKNDR" — they lean into time + voice,
  which the product already wants to be.
- **III (generative cover)** is the most defensible long-term — every weekend gets a
  unique cover, so the product never stops looking interesting.
- **III + IV together** is the promising combo: the cover *composes itself* from named
  data sources (Buienradar → KNMI → mode → sources → cover), so IV's "show the work"
  isn't a one-shot loading screen — it's the signature of every brief.
- **V (control surface)** mostly failed the "what does dragging weather actually do?"
  test. Its one good idea — *time-shifting the day* ("what's good at 3pm?") — was rescued
  as a small "later today" toggle that lives WITH the picks, not as a header slider.
- **IV as resting state** is wrong (a loading bar that expires); IV as *first-load into
  III* is right.

**Current direction of travel:** generative cover (III) + source-trace (IV resolved),
de-editorialized toward Helvetica, with the open question of how far to push toward Hara
restraint vs. keeping v5's energy.

---

## The generative cover + Midjourney plan

The cover should be **art-directed in Midjourney first, then encoded generatively** —
NOT procedurally guessed in code. Workflow:
1. Generate 20–50 Midjourney reference stills per weather mode (HOT/WARM/COOL/COLD_WET/
   VOLATILE). Establish palette, light quality, grain, shape language, energy per mode.
2. Extract the visual rules into a spec (palette hexes, gradient behaviour, grain density,
   typographic placement).
3. **Path A (recommended):** code reproduces the rules (CSS/Canvas/SVG) — cheap, infinite,
   ownable. Path B (pre-generated library, premium) and Path C (real-time AI gen, Flux/
   Imagen/SD on the Thursday cron) are later upgrades.

When Midjourney references exist, the next Claude task is: translate them into the
generative spec and build the cover renderer.

---

## Weather mode engine

Lives in `/engine/weather-engine.ts`. Rule-based classifier + ranker + LLM narration.

**5 modes:**
- `HOT` — ≥24°, <30% rain
- `WARM` — 16–23°, <40% rain
- `COOL` — 8–14°, dry
- `COLD_WET` — <10° or >65% rain
- `VOLATILE` — big day-swing or borderline values

Each venue carries `weatherFit` scores per mode. Ranking = rule-based filter + LLM
narration for the prose.

**Data sources (free, non-commercial, attribution required):**
- Buienradar — 5-min precipitation, 2hr ahead:
  `https://gpsgadget.buienradar.nl/data/raintext?lat={lat}&lon={lon}`
- Buienradar full forecast JSON: `https://data.buienradar.nl/2.0/feed/json`
- KNMI — official forecast. No API key needed for the above.

---

## Amsterdam source list (the ~15-source MVP)

Resident Advisor (scrape) · Paradiso/Melkweg · Songkick API · Eater Amsterdam (RSS) ·
Welike Amsterdam (Substack) · Time Out · I amsterdam · Eventbrite API · Kidsproof ·
Stedelijk/Foam/Eye · KNMI/Buienradar · Spotify (OAuth) · Little Black Book (weekend
tips) · Mommy Poppins (kids).

Real venue URLs used in the kids prototypes are in `/docs/sources.md`.

---

## Design tokens (the recurring system)

```
--ink:        #0a0a0a   (Hara variant: #1a1a1a)
--paper:      #fafaf7   (Hara variant: #faf8f3 warm Muji)
--accent:     #ff4d1f   (energetic orange-red — the default)
--accent-hara:#8a2818   (deep brick-red — quiet, for the Hara direction)
--kid:        #2d5b8a   (kid-context blue; Hara variant #4a5a7a muted)
```

- **Body type: Helvetica Neue.** This instinct keeps winning. Fraunces was the
  "editorial costume" that Ness asked to remove (26 May).
- **Monospace (JetBrains Mono) is reserved for receipts/timestamps/source-traces only** —
  it reads as "machine output / showing the work." Do not let it bleed into headlines.
- Off-white paper, single accent, real images (Unsplash CDN with proper params works).
- Weather as central variable; visible "Why this fits" reasoning builds trust;
  publication chips on cards (legal model + credibility).

---

## Established aesthetic references
Roger Deakins / Robbie Ryan cinematography · Park Chan-wook composition · UniQlock
(ambient clock) · WePresent (every-story-its-own-design) · Kenya Hara / Muji (ma,
emptiness, image-as-substance) · Aurō (the glowing-orb gradient). 35mm, cool grey-green
palettes, 16:9 also recur in Ness's broader work.

---

## Open questions (pick up here)

1. **Which direction wins** — v5-helvetica (energetic product) vs. Hara (quiet
   publication)? Or a hybrid keeping v5's energy with Hara's restraint?
2. **The generative cover** — do the Midjourney art-direction pass, then build the
   renderer from the extracted spec.
3. **Animation** — the cover-compose-in behaviour (III+IV) is still un-built. Tabled
   until a static direction is locked. Decisions pending: length (~2.5s?), step count,
   skippable.
4. **"Later today" affordance** — could be proactive (page detects it's 2pm and offers
   the afternoon cut) rather than a manual toggle.
5. **The pivot-notification UX** — Saturday morning Plan A → Plan B push when Buienradar
   updates. Un-built.
6. **New Orleans variant** — to prove the multi-city moat (Mardi Gras / hurricane /
   swamp-humidity modes). Un-built.
7. **Runnable Thursday cron** — the actual personal-deployment script. Un-built.

---

## How to work in this repo

- `npm run dev` (or `python3 -m http.server 8000`) → preview at localhost.
- `index.html` at the root lists every experiment with notes — start there.
- New experiments go in a dated/numbered subfolder under `/experiments`. Don't overwrite
  old ones; the progression is the design record.
- When a direction is chosen, that's the moment to do the one-way handoff to Figma
  (see `/docs/SETUP.md`). Figma owns the design during refinement; code owns it again
  when building for real.
