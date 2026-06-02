# Changelog

All notable changes to WKNDR. We're pre-1.0 (0.x = build-for-self validation phase).
Format loosely follows [Keep a Changelog](https://keepachangelog.com/). The version
shown in the app's "What's feeding this" sheet matches the latest tag here.

## [Unreleased]
- (next up — unique card displays · GPU-shader backgrounds · the content pipeline · "Wrapped")

## [0.7.0] — 2026-06-02 — "Floating bar, weather intro, real weekend"
- **Floating command module** — the top bar is now a centered, floating product card
  (WePresent-style) with a drop shadow that expands into a grouped control panel
  (View / Filter / Your list / Weather / Ambient field). Wordmark left, weather to its
  right (live temp + city, hairline divider), hamburger menu right. A Reset control wipes
  saved + taste for cold-start testing. Build tag in the footer.
- **Weather-adaptive intro** — every load opens on the live ambient field with a bold
  value-prop line tuned to the forecast (5 modes), then lifts away as the app rises in.
- **Real weekend content** — listings web-researched for Fri 5–Sun 7 Jun (Amsterdam Open
  Air, FKA twigs + Yves Tumor @ Ziggo, Harry Styles + Robyn, Jungle by Night, Holland
  Festival, Danh Vo @ Stedelijk…); fabricated/past entries removed; feed de-clustered so
  it never serves a run of the same category.
- **Imagery accuracy pass** — real, HTTP-verified Wikimedia photos of the actual places
  (De Nieuwe Kerk, Van Gogh, Foam, Hortus, IJ-Hallen, Zaanse Schans, Haarlem, Volendam…).
- **Ambient field looks** — Aura / Warp / Aurora / Mesh / Metaball, palette-driven, with a
  perf budget; the classifier no longer mislabels warm-wet days as “cold”.
- **Swipe + motion** — two actions (✕ / ★) with a bold red/green top-fade drag tint; card
  detail expands open (menu easing) with a per-card Share; list staggers in; Stack⇄List
  crossfades; cards/list scale up responsively on desktop.

## [0.6.0] — 2026-06-01 — "Living field"
- **Generative ambient field** — a weather-driven canvas backdrop (palette follows the live mode),
  perf-budgeted: low-res buffer GPU-upscaled, ~30fps cap, freezes during swipes, pauses when hidden,
  falls back to the CSS gradient under reduced-motion or if canvas is unavailable.
- **Ambient-field selector** — ⚙ Adjust now lets you switch the look (Aura / Warp / Metaball / Static)
  live; the choice persists per device.
- **WePresent-style nav bar** — wordmark + "weekend brief" descriptor + hairline divider, controls right.
- Fixes: the classifier no longer mislabels a warm-but-wet day as "COLD" (→ VOLATILE, "keep a rain
  layer in the bag"); reduced-motion users now get the correct field palette instead of the boot color.

## [0.5.0] — 2026-06-01 — "Share my weekend"
- **"My Weekend" share card** — tap ★ → Saved → Share → a weather-tinted card of your saved
  picks. **Share with your partner** (Web Share API → iMessage/WhatsApp) or **Copy link**.
- The link encodes the saved pick IDs (`?w=…`), so the partner opens straight into *those* picks
  with a **Save all** option — no backend, no account. The distribution lever (docs/moat.md §5).

## [0.4.0] — 2026-06-01 — "Hosted + unified IA"
- **Hosted on GitHub Pages** via a build-and-deploy Action — auto-redeploys on every push to `main`
  (`nessim-higson.github.io/wkndr/`); the `/experiments` design archive is preserved.
- **Weather defaults to the live forecast** (Open-Meteo) instead of a fake toggle; the mode pills
  moved into a tucked-away "Adjust weather" disclosure.
- **Two-axis filtering**: a **When** pill (Any time / This weekend / New / **Evergreen canon** / Ending)
  and a **What** pill (category / kids / saved). The evergreen canon is a *filter*, not a separate
  view — Stack & List stay cojoined (replaced the bolt-on Guide view).
- Uniform swipe-action buttons; removed the condition phrase under the city/temp.
- Source roster is fully clickable (45 sources).
- Targeted permission allowlist so routine commands stop prompting (dev-side).

## [0.3.0] — "Taste + detail"
- **Taste foundation**: saves + swipe history persist (localStorage) and survive reloads; a light
  tag-weight model folds a `taste` term into ranking (weather × freshness × taste). Saved list view.
- **Card detail** view (tap a card / row → full info + "Open at source" link + source-trace).
- **"What's feeding this"** inputs sheet — exposes the weather feed, source roster, ranking, household.
- Category/Kids filters; refresh gets a clear signal (toast + re-deal animation).

## [0.2.0] — "Real content"
- Replaced sample picks with **real, hand-curated Amsterdam events**; deepened the pool to **48 picks**
  across all categories (gigs, openings, museums, parks, markets, day-trips).
- **Real subject images** pulled from Wikipedia/Wikimedia (the actual venues + artists).
- Tag differentiation (status / classifier / context roles).

## [0.1.0] — "Phase 1 scaffold"
- Vite + React + TypeScript + Framer Motion app (run with Bun).
- Weather-reactive field (5 modes, crossfade), swipe **Stack**, **List**, weather × freshness ranking,
  sample Amsterdam pool, live-weather + demo controls.
