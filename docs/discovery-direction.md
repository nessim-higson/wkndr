# WKNDR — Discovery Engine Direction (Handoff)

> **Status:** Concept locked, ready to validate then build. This document captures the
> pivot from "weekend brief" to "weather-aware, swipe-trained discovery engine."
> Hand this to Claude Code (to build) and Claude Design (to explore visuals).
> Amsterdam only. Build for self + partner first; validate before adding depth.

---

## 1. What WKNDR is now

A **weather-aware discovery app for Amsterdam** that learns your taste through a
swipe interaction and surfaces what's alive in the city right now — events, food,
galleries, day-trips — re-ranked by the weather and by what it's learned about you.

It started as a curated weekend *brief* (3 picks, editorial voice). It's grown into a
**living discovery engine** where the weekend brief is one *view* among several, the
weather is the sharpest *ranking lens* (not the entire thesis), and a Tinder-style swipe
is the *training layer* that personalizes everything.

**The one-line pitch:** *Tinder for your weekend — but it knows the weather and gets
smarter every time you use it.*

---

## 2. Why this is defensible

- **The wedge is weather.** Every competitor (Bigfoot, dammie, Time Out, Fever, I
  amsterdam) is either a weather-blind event aggregator or a community play. None
  re-rank the city by what the sky is about to do. That lane is open.
- **The swipe is a taste engine disguised as a fun interaction.** Every swipe is a
  labeled signal. Within a few weekends WKNDR actually *knows* you. The product gets
  sharper the more you use it — the thing generic AI-discovery (Bigfoot) couldn't do.
- **Craft is the amplifier.** The category leaders look generic. A considered,
  weather-reactive, beautifully-built product wins on taste in a field that has none.
- **The honest risk (write this down):** the hard part is NOT design — it's the
  **living content pipeline**. Keeping a deep, multi-category Amsterdam pool fresh and
  *real* (not stale, not closed-down, not touristy) is the actual work. This is the wall
  Bigfoot hit — they couldn't sustain growth without paid marketing. So: go deep in ONE
  city, hand-curated, validated on ourselves, before any thought of breadth.

---

## 3. The machine (how it all connects)

```
  SWIPE ROUND          TASTE PROFILE         THE POOL            WEATHER × TASTE        VIEWS
  (onboarding)    →    (derived)        →    (content)      →    RANK (engine)     →   (output)
  20–40 cards          categories,           everything           the pool, filtered     LIST + STACK
  across all           vibe, distance,       alive in             by today's weather     (two postures
  categories.          price, kid-           Amsterdam now,       mode, re-ranked by      on the same
  L/R/up/down.         context.              9 cats, fresh,       your taste. Core IP.    ranked pool)
                                             tagged + dated.

  ↻ THE LOOP: every swipe — in onboarding AND steady-state — feeds back into the taste
    profile. The swipe never fully goes away; it's how you keep teaching it and how you
    expand when the curated view isn't enough.
```

The weather engine did NOT disappear in the pivot. It went from being the whole thesis
to being the sharpest **ranking lens** on a broader pool.

---

## 4. The list / stack duality (the key UX unlock)

The brief/list view and the swipe/stack view are **two ways of consuming the same ranked
pool.** Not two apps, not "which is home" — a **toggle** the user flips per session.

- **LIST view** — "show me everything, I'll scan and decide." Considered, scannable,
  brief-like. Good when you know what you want or want an overview.
- **STACK view** — "show me one at a time, I'll react." Swipe mode. Good when undecided,
  want to be surprised, or want to train the engine.

Same content, same ranking, two postures. A small toggle in the corner flips between
them. Some sessions you scan a list; some you lean back and swipe. The user decides.

---

## 5. The swipe interaction

Onboarding is a meaty round (~30 cards, not 3 — three can't train a model). Steady-state
swiping continues lighter: new openings surface for a verdict, "show me more" in any
category drops into a swipe stack.

**Gestures:**
- **← Left** = not for me (negative signal)
- **→ Right** = yes / like (positive signal)
- **↑ Up** = save it (strong positive + adds to saved/plan)
- **↓ Down** = skip / unsure (neutral, show me something else)

Each card is tagged: category, vibe, price, distance, indoor/outdoor, kid-suitability,
weather-fit. Every swipe is a labeled training signal.

**Right-swipe needs a destination.** Likes/saves must land in a real "Saved" / "your
weekend" plan that the user acts on — not just a pile of likes. (Calendar draft,
itinerary, leave-by reminders are later upgrades.)

---

## 6. Taxonomy — 9 categories (Amsterdam)

Each carries a default weather-relationship.

| # | Category | What's in it | Peaks in |
|---|----------|-------------|----------|
| 1 | **Out & about** | Parks, water, forest, markets, city wandering | HOT · WARM |
| 2 | **Eat** | Restaurants — established + newly opened (the churn) | any · COLD_WET |
| 3 | **Drink** | Cafés, natural-wine bars, terraces, coffee, openings | terraces HOT · cosy COLD |
| 4 | **Art & galleries** | Museums, gallery openings, exhibitions, project spaces | COLD_WET · COOL |
| 5 | **Live & gigs** | Concerts, club nights, DJ sets, live music | weather-agnostic |
| 6 | **Stage & screen** | Theatre, cinema, film festivals, performance, talks | COLD_WET |
| 7 | **With kids** | *Cross-cut* — family-suitable picks from every category | weather-ranked |
| 8 | **Day-trips** | Worth-leaving-the-city-for; the ≤3h radius | HOT · WARM |
| 9 | **Markets & one-offs** | Festivals, fairs, pop-ups, seasonal, genuinely temporary | HOT · WARM |

**Open questions on taxonomy (still to settle):**
- Eat/Drink split or merge into one "Food & drink"?
- Is "With kids" correctly a cross-cut rather than a peer category? (Current thinking:
  yes — it pulls family-suitable picks from all categories and weather-ranks them, so the
  original kids use-case lives inside the bigger structure without being ghettoized.)
- Is "Markets & one-offs" too much of a junk drawer?

### Crossed with freshness buckets (the time dimension)

Every category sorts into these:

- **New this week** — just opened/announced. *The reason to return.* (cafés, galleries,
  pop-ups — the churn that makes you open it on a random Tuesday)
- **This weekend** — time-bound to the coming Sat/Sun. *The decisive view.* The original
  weather-brief lives here.
- **Always good** — evergreen spots matched to your taste. *The safety net.*
- **Ending soon** — exhibitions closing, last weekends, seasonal vanishing. *The urgency
  nudge.*

---

## 7. The weather-reactive background

The space *behind* the stack is the weather, made visible. Not decoration — information.
HOT = warm orange field; COLD_WET = cool grey-blue; etc. Aurō-style soft aura that shifts
with conditions. You glance at the app and the color tells you the weather before you read
a word. This is the home for the earlier "generative cover" art-direction work.

**Weather modes** (from the existing engine):
- `HOT` ≥24°, <30% rain
- `WARM` 16–23°, <40% rain
- `COOL` 8–14°, dry
- `COLD_WET` <10° or >65% rain
- `VOLATILE` big day-swing or borderline

Data: Buienradar (`https://data.buienradar.nl/2.0/feed/json`,
`https://gpsgadget.buienradar.nl/data/raintext?lat={lat}&lon={lon}`) + KNMI. Free,
non-commercial, attribution required, no API key.

---

## 8. Tech decisions

### Platform: PWA (web app), not native iOS
- One codebase, instant updates, no App Store tax/review, zero install friction for the
  self+partner validation phase. Installs to home screen, runs full-screen, supports web
  push (for the Saturday weather-pivot alert).
- Link-out model (tap pick → venue page) is inherently web-native.
- **Caveat to verify:** iOS PWA web-push reliability for the pivot-alert feature
  (supported since iOS 16.4 for home-screen PWAs, but confirm the UX is good enough).
- Don't build native to solve a problem we don't have yet. If swipe-feel ever becomes the
  ceiling, *then* consider a thin native wrapper — not before.

### Swipe interaction: DOM + gesture library (NOT WebGL)
- A card swipe is a 2D interaction (translate, rotate, scale, fade). DOM + **Framer
  Motion** (or `react-spring` + `@use-gesture`) gives excellent momentum/spring/fling
  feel and keeps cards as **real HTML** — real text, links, images, accessibility,
  copy-paste. Critical for a link-out discovery product.
- WebGL for the cards themselves is overkill and turns content into textures (text +
  links + a11y get harder). Don't.

### Weather background: THIS is where WebGL/Three.js earns its place
- A full-screen **fragment shader** behind everything — gradients that flow, grain that
  shimmers, light that moves like weather. CSS can fake a static gradient; a shader makes
  it *breathe*. Parameterized by weather mode; connects to the Midjourney art-direction.
- **Architecture:** WebGL canvas layer (atmosphere) + DOM layer (cards/swipe/content) on
  top. Each tool does what it's uniquely good at.
- **Caution:** the shader is the most seductive rabbit hole in the project. It's a
  *polish-phase* task. When you get there, hand Claude Code a bounded spec ("full-screen
  fragment shader, these 5 mode palettes from my Midjourney refs, slow flow, subtle
  grain, parameterized by mode") — don't build it open-endedly.

---

## 9. Build order (simplest first — validate before depth)

**Keep it simple. Don't build the deep version before proving anyone uses it.**

1. **Phase 1 — Validate.** Weekend-only swipe stack for Amsterdam. CSS gradient weather
   background, basic DOM pointer-event swipe, list/stack toggle stubbed. Weather-ranked
   picks for the coming weekend. **Goal: do I + partner actually open and use it for ~8
   weekends?** This is the only question that matters right now.
2. **Phase 2 — Polish the feel.** Swap basic swipe for Framer Motion / react-spring.
   Make it buttery. (Only once it's sticky.)
3. **Phase 3 — Polish the atmosphere.** Add the WebGL shader weather-field behind the DOM
   cards. The "wow." (Only once the feel is right.)
4. **Phase 4 — The training loop.** Swipes start shaping the ranking. Taste profile
   becomes real.
5. **Phase 5 — The depth.** Add categories + freshness buckets. The living multi-category
   pool. (Only once the core is sticky and the content pipeline is proven sustainable.)

Every step is shippable and testable. Never build the expensive depth until the cheap
core has earned it.

---

## 10. For Claude Design — what to explore

Design directions to generate and compare (the visual language is still open):
- The **stack/card** treatment — how a pick looks as a swipeable card. Image-led,
  weather-fit visible, category + freshness tags, the "why this fits you" reasoning.
- The **weather-reactive background** per mode — 5 atmospheric fields (HOT/WARM/COOL/
  COLD_WET/VOLATILE). Abstract, Aurō-inspired, flowing. (These become shader specs later.)
- The **list ↔ stack toggle** — how the two postures share one screen and flip.
- The **onboarding swipe round** — the ~30-card training flow, the gestures, progress.
- **Established aesthetic:** Helvetica body (this instinct keeps winning); off-white paper
  `#fafaf7` or warm Muji paper `#faf8f3`; single accent (energetic `#ff4d1f` OR quiet
  Hara brick-red `#8a2818`); monospace (JetBrains Mono) reserved for receipts/timestamps
  only; real images; weather as central variable; visible "why this fits" reasoning;
  publication chips (credibility + the signal-not-republish legal model).
- **References:** Linear / Arc / Dia (native-web feel), Kenya Hara / Muji (ma, restraint,
  image-as-substance), WePresent (every-piece-its-own-design), Aurō (the glowing gradient).
- Prior exploration to build from lives in the `wkndr` repo `/experiments` — v5 is the
  working base; the Hara and cover-helvetica directions are the most recent threads.

---

## 11. Competitive note (for context, verify current state)

- **Bigfoot / Littlefoot** (thebigfoot.com; iOS `id1641556281`; Android
  `com.thebigfoot.Bigfoot`) — ex-Airbnb team, 160 cities, AI concierge ("Littlefoot" is
  the in-app chat, not a separate app), 60+ sources. Peaked ~30k MAU, needed funding,
  iOS still on v1.2 since 2023 → slow velocity. **Closest competitor by concept.** No
  weather hook. Chose chat-first; we chose feed/stack-first. Their stall teaches: a wedge
  is why we'd avoid their ceiling; craft is our edge.
- **dammie** — single-city Amsterdam, iOS-only, no personalization, no weather, low
  footprint. Proves single-city-events alone isn't a strong enough wedge.
- **Incumbents** (I amsterdam, Time Out, Fever, Your Little Black Book) — all
  weather-blind. I amsterdam already has a "with kids" filter worth studying.
- **The whitespace:** nobody combines weather-ranking + swipe-trained taste + living
  multi-category local pool + list/stack duality + craft, in one opinionated product.

---

## 12. Standing decisions (don't re-litigate without reason)

- WKNDR is a **standalone product**, separate from iaah-site. Own repo, own history.
- **Amsterdam only** until validated. Go deep in one city before breadth.
- **Build for self + partner first.** ~8–12 weeks personal validation before product
  ambitions.
- **Legal model: signal + link, not republish** (Techmeme model). Scrape facts, name +
  credit + link out the source publication. The source-trace (naming Buienradar, Little
  Black Book, etc.) is both credibility and publisher-relations posture.
- **PWA, not native iOS.**
- **List + stack coexist as a toggle**, not an either/or.
- **Weather = ranking lens** on a broad pool, not the entire thesis anymore.
