# Changelog

All notable changes to WKNDR. We're pre-1.0 (0.x = build-for-self validation phase).
Format loosely follows [Keep a Changelog](https://keepachangelog.com/). The version
shown in the app's "What's feeding this" sheet matches the latest tag here.

## [Unreleased]
- (next up — wire the Feedback widget's Formspree endpoint · confirm V.6.2 pull-to-dismiss on device)

> **Versioning note:** from V.1 the app moved off semver to **`V.<major>.<sub>`** (shown in the menu
> footer; `bun run bump`). Whole versions are git tags (`v1.0.0`, `v2.0`, `v3.0`, `v4.0`, `v4.10`,
> `v5.0`, `v6.2`). The per-ship granular history is the **git log** — entries below group it by major
> version. (Entries 0.1.0–0.7.0 are the earlier semver phase, kept for the record.)

## [V.6 → V.6.2] — 2026-06-28 — "Trusted-source engine + endless deck"
- **Ranked trusted sources** — the pipeline now leads with Ness's four: Your Little Black Book ›
  I amsterdam › Resident Advisor (nightlife) › de Volkskrant. Source-scoped search facets + a
  source-priority ranking so every category is led by trusted sources; canon backfills.
- **Trust filter** — drops low-confidence web picks: cheesy club self-promo (Escape), aggregators
  (concerts50), Songkick metro index, AmsterdamTips month-index links (the wrong-date/wrong-image
  "Mirror Floor" class). Narrow enough to keep I amsterdam / Eye real event pages.
- **Reverts after Ness feedback** — the blur-fill "whole photo" card (V.5.19) and the "sets of 7"
  batching (V.5.18) were both **reverted**: back to full-bleed `cover` cards and the **endless deck +
  Shuffle for more** that worked better.
- **V.6.2** — card detail dismisses on a pull **up or down** (was down-only). Frozen reference build
  at `/wkndr/versions/v6-2/` (tag `v6.2`).

## [V.5 → V.5.19] — 2026-06-15 → 06-28 — "MVP trim, freshness pipeline, boomerang, imagery"
- **MVP trim (V.5)** — one view (Stack), one ambient look (Auras), Amsterdam-only; full surface behind
  `?dev=1`. New Orleans later paused in the pipeline.
- **Freshness engine** — web-search deep-research pipeline (Claude `web_search`, grew to **10 facets**),
  novelty-first ranking, weekly evergreen rotation; **canon split fixed** so "new"-tagged canon (De
  Pimpelmees) rotates instead of repeating every week. Anthropic credits + raised tier.
- **Boomerang** — short stable share links; the `&m=1` return leg greets "it's a match" and opens the
  **itinerary list** of matched plans (not the deck).
- **Imagery** — canon-photo bank → Pexels themed stock → **vision-verified real photos**
  (`verifyImageForEvent` downloads candidates and Claude picks/rejects by subject); stock + Canal-Parade
  blocks. Pill reads "Perfect this weekend".
- **Polish** — card sizing dialed to Ness's guide lines; mobile card == header width; canonical look
  forced (no stale dev looks); in-app **tester feedback widget** (Formspree + mailto fallback).

## [V.4 → V.4.11] — 2026-06 — "Match mode, share round-trip, ambient looks"
- **Match mode** — swipe-to-match prototype + the real share-link round-trip; weather pills on cards;
  evergreen batch 2 + a Shops section; 4 new generative ambient looks with knobs/seeds + a 30fps cap.
- **QA + simplify** — quieter cards, ✓/✕ stamps, undo out of the swipe path, faster geolocate, NOLA
  weather fix, match-mode freeze fix; **2 gestures not 4**, coaching overlay dropped, controls shifted
  clear of the deck; short stable 7-char share codes. Pre-MVP build frozen at `/wkndr/versions/v4-10/`.

## [V.2] — 2026-06 — "App Store expand, real imagery, richer cards"
- App-Store-style expand replaces the card flip; the back keeps the photo + carries more info; richer
  front tags; when-stamp moved up with forecast temp on outdoor cards; **every card a real image**
  (logo/placeholder screening in the pipeline); Eater best-restaurants wired; bigger header temp.
- (V.1 = the frozen landmark at `/wkndr/v1/`; V.3 = Coverflow/dimmed-fan + the first live pipeline.)

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
