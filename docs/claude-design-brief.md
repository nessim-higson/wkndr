# WKNDR — Claude Design brief

> ⚠️ **Partly superseded.** WKNDR pivoted to a swipe-trained discovery engine — for the
> *current* Claude Design exploration list (stack/card, weather-field, list↔stack toggle,
> onboarding swipe), use **§10 of `docs/discovery-direction.md`**. The token system, type
> rules, and source-trace notes below are still accurate; the "hybrid weekend-brief page"
> framing is now just one view within the engine.

> Paste this into a fresh Claude Design session to start from WKNDR's real design
> language instead of a blank page. It distills the locked direction, the token
> system, the page anatomy, and exactly what to explore. Reference prototype:
> `experiments/06-hybrid/01-hybrid-cover-restraint.html` (deploy it and hand
> Claude Design the URL so it can ingest the live design).

---

## What WKNDR is (one paragraph)

A personalized weekly **weekend brief** for a city, re-ranked by the weather, in an
editorial voice. It synthesizes a city's existing publications (event guides, kids
listings, blogs) and re-presents the best options for *this* weekend, *this* weather,
*this* household — a considered brief, not an infinite feed. **Weather is the organizing
principle.** First user: Ness + partner + 4-year-old in Amsterdam. Discovery, not community.

---

## The locked design direction — "the hybrid"

Three prior threads, married (this is the chosen base — explore *on top of* it, don't replace it):

1. **The generative cover** (from `cover-helvetica`) — a weather-derived gradient cover
   that *is* the forecast. Big centered city name, temp + mode anchored at the bottom.
   The cover **replaces** any separate weather banner. The cover IS the weather.
2. **The source-trace band** (from `cover-helvetica`) — a JetBrains Mono "BUILT FROM"
   strip under the cover naming every data source. This is the credibility device AND
   the legal posture (signal + link, never republish). It earns its place; keep it.
3. **The v5-kids content model** — the resolved part: 3 hero picks with "Why now"
   reasoning + publication chips, an "Also on today" compact list, a parent "after-hours"
   block, a colophon. This content system is the most validated thing in the project.
4. **Hara restraint applied below the fold** — warm Muji paper, generous *ma* (negative
   space), quieter type, accent used sparingly. The emotional condition phrase is
   preserved as ONE restrained line (brick-red), not a loud banner.

**The tension to tune:** v5's energy ↑ vs. Hara's restraint ↓. The hybrid sits in the
middle. This is the #1 thing to explore with a slider (see below).

---

## Design tokens (the hybrid set)

```
/* Ink */
--ink:        #1a1a1a   /* softened from v5's #0a0a0a, toward Hara */
--ink-3:      #5a5a5a   /* body text */
--ink-4:      #9a9a96   /* meta / labels */

/* Paper (warm Muji) */
--paper:      #faf8f3
--paper-2:    #f1efe8
--rule:       #ddd9cf

/* Accents */
--accent:      #ff4d1f  /* v5 energetic orange — PRIMARY, used sparingly */
--accent-deep: #8a2818  /* Hara brick-red — the QUIET accent (condition phrase, chips) */
--kid:         #4a5a7a  /* muted kid-context blue (Hara variant) */
```

**Type:**
- **Body + headlines: Helvetica Neue.** This instinct keeps winning. NO Fraunces, no
  italic "editorial costume" — that was explicitly removed.
- **JetBrains Mono is reserved for the source-trace / receipts / timestamps ONLY.** It
  reads as "machine output, showing the work." Never let mono into headlines.
- Headline scale is deliberately restrained (h1 ≈ 34px, not 40px+). City name on the
  cover is the one place type goes big (≈ 96px).

---

## Page anatomy (top → bottom)

```
TOP BAR        WKNDR mark · "Sunday brief · for Ness" · save/share/settings
FILTER STRIP   When (Today / Mon / Next wknd) · Who (Me+kids) · Range (City+1h / ≤3h)
COVER          generative weather gradient · big city name · temp + mode (the hero)
SOURCE-TRACE   mono "BUILT FROM" band naming every source · "N sources · ranked · time"
CONDITION      one restrained line, the emotional hero, brick-red accent
HEADLINE       Sunday-brief lede (Helvetica, restrained)
THREE PICKS    image cards · venue · snippet · publication chips · "Why now" · footer
SHUFFLE        "none of these hit? roll one weighted for HOT + 4yo"
ALSO ON TODAY  compact list, 7 more, kid-safe
AFTER-HOURS    dark block, "for after the kids are down"
COLOPHON       sources read this week + how the brief was generated
```

---

## The 5 weather modes (the cover must shift per mode)

The cover gradient, accent temperature, and condition phrase all change with the mode.
The reference prototype shows **HOT**. The other four need their own palettes — a great
thing to generate directions for in Claude Design.

| Mode      | Trigger                       | Cover feeling (to art-direct)                |
|-----------|-------------------------------|----------------------------------------------|
| HOT       | ≥24°, <30% rain               | warm orange→brick→amber glow (built)         |
| WARM      | 16–23°, <40% rain             | soft gold / green, gentle, flexible          |
| COOL      | 8–14°, dry                    | cool grey-green, crisp, clear                |
| COLD_WET  | <10° or >65% rain             | deep blue-grey, moody, indoor-leaning        |
| VOLATILE  | big day-swing / borderline    | split / shifting, two-tone, "it'll change"   |

---

## The live adaptive header (built — `experiments/06-hybrid/02-weather-header-live.html`)

A working, weather-adaptive version of the masthead header. It is the reference for
"a header that adapts fluidly to the weather wherever you are":

- **Geolocation → Open-Meteo (free, no key) → BigDataCloud reverse-geocode** pulls the
  live temp / hi-lo / wind / precip and the city name for *the user's actual location*.
- The 5-mode classifier picks HOT / WARM / COOL / COLD_WET / VOLATILE, and the **gradient,
  temperature, condition line, and phrase all crossfade over ~1.2s** when the mode changes
  (two stacked gradient layers, opacity crossfade — radial-gradients can't tween directly).
- Demo buttons flip all five modes without waiting on live weather; the "use my weather"
  button does the real geolocation call (allow location when prompted).
- Per-mode palettes live in the `[data-mode="…"]` blocks; per-mode copy in the `PHRASES`
  map (production swaps this for LLM narration).

Hand this file to Claude Design as the live header component to refine. Good things to
push there: the WARM/VOLATILE palettes (hardest to get right), the crossfade timing/easing,
and whether the temperature block or the city name leads the eye.

## What to explore in Claude Design (ask it for these)

1. **A restraint slider** — generate the page at 3 points: "v5 energetic," "balanced
   hybrid" (the current prototype), "Hara quiet." Tune live. This resolves the project's
   open question #1.
2. **The 5 weather-mode covers** — give it the table above; ask for a cover-gradient
   direction per mode, holding the layout constant. (Later these get art-directed in
   Midjourney, then encoded — but rough directions now are useful.)
3. **Accent balance** — orange-primary vs. brick-red-primary. Two directions, compare.
4. **Cover typography** — city name centered (current) vs. bottom-left vs. baseline-grid.
   Inline-comment on each.
5. **Card density** — current rich cards vs. a quieter Hara "image + caption plate" for
   the picks.

---

## Hard rules (do not re-litigate)

- **Weather is the USP.** The cover and the re-ranking must always foreground it.
- **Helvetica for everything readable; mono only for the source-trace.**
- **Signal + link, never republish.** The source-trace naming publications is load-bearing
  — it's both credibility and the legal model. Never reproduce a source's content.
- **Feed-first with toggles, chat as escape hatch.** Not chat-first.
- The condition phrase is the *emotional* hero; the cover is the *visual* hero. Keep both.

---

## After Claude Design

Export the chosen direction's code and bring it back into this repo. The build phase
(wiring the design to the weather engine, the Thursday cron, real data, deploy) happens
in Claude Code — see `docs/SETUP.md`. Claude Design replaces the old Figma round-trip:
it both explores AND outputs code, so the Figma step in SETUP.md can be skipped.
