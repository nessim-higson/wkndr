# WKNDR — V2 plan (refined from partner feedback, 2026-06-04)

v1.0.0 is frozen at `/wkndr/v1/`. This is the V2 working set.

## 1. Weekend-weather framing
Weather currently describes **today**; the app is about the **coming weekend**. Show the
weekend outlook (Fri–Sun), not the current hour. Mid-week → show the *next* weekend, labelled.
Touches: `weather/modes.ts` (classify on the weekend days), `App.goLive` (fetch the weekend
window, not forecast_days=1), topbar + InputsSheet copy, intro line.

## 2. Richer cards
- More **image-led** (full-bleed like the fan cards).
- **Hero the date** on the face (date/time prominent, not buried).
- **"Closing soon" / scarcity badge** when relevant (we already compute `freshness:'ending'`
  + `status` — surface them).
- More on tap (see #5).

## 3. Pipeline — broad, trustworthy, low-verify, multi-category
**Not just music.** Find the "go-to" sources for *everything* worth doing in **Amsterdam**
*and* **New Orleans** — eat/drink, art, stage/screen, markets, out, day-trips, kids. The
pipeline should pull genuinely-good content **without Ness verifying** each item: trust comes
from cross-source agreement + source-trust weights (content-pipeline.md §"What makes it
smart"). Flow: powers **our own discovery + planning** first; once *we* judge a weekend is
good, **then** share it out.
- Per-city rosters across all categories; more adapters (RSS / LLM-read / og:image);
  dedupe → buzz-score → rank; the canon floor as the guarantee.
- Growth lever: a live **Songkick / WWOZ** key + the **Thursday cron** to keep feeds current.

## 4. Card auto-play felt forced → REMOVE (keep the dynamic throw)
Partner felt the fan auto-advance was forced. Remove the fan's timed auto-advance; the fan
becomes purely user-driven (spin/drag). The dynamic throw (swipe/exit) stays.

## 5. Rich card backside / detail
The detail should feel rich with info. Notably: **listen to the artist there & then** — a
Spotify / Apple Music link-out (or inline preview) on music picks. More structured detail
overall (lineup, price, why-now, map).

## 6. Weather effect — a new, more *weather-legible* background
Like the abstract quality, but it's not clearly **weather**. Explore (comps first, then
motion). Cast a wide net:
- **A · Hockney-inspired** — flat, bold, bright graphic weather (sun, sky, clouds, water).
- **B · Huge Helvetica** — the weather stated in giant Helvetica that drifts subtly (type IS
  the field).
- **C · Aura dots** — plays off the WKNDR dot: soft weather-coloured gradient orbs (the
  reference images — Apple-aura / Turrell glow).

## 7. Typography on cards
**Helvetica Neue for all copy on the cards.** Keep **WKNDR** (the wordmark) in the display
typeface (Clash Display).
