# WKNDR — STATE (catch-me-up snapshot)

_Living "where are we right now" doc — a **snapshot, not a history**. **Updated 2026-07-02.** Read this
FIRST in a new chat. For strategy + backlog see `docs/backlog.md`; for the pipeline architecture see
`docs/pipeline-architecture.md` + `docs/source-map.md`; for full **version history** see `CHANGELOG.md`
(current to V.6.20) and the **git log / tags**. Onboarding: `CLAUDE.md`. App lives in `/app` (Vite +
React + TS, run with `bun`); deployed to GitHub Pages._

## Live right now
- **App: V.6.20** — https://nessim-higson.github.io/wkndr/ (cache-bust `?v=V.6.20`)
- **`?dev=1`** reveals the full exploration surface (all views, ambient-look switcher, city picker).
- **Frozen reference builds:** `/wkndr/versions/v6-2/` (tag `v6.2`) and `/wkndr/versions/v4-10/` (tag `v4.10`).
- **Ship loop:** `cd app && bun run bump` → `bun run build` → commit → push (auto-deploys) → reply with
  the `?v=` link. **Tests:** `bun run test` (31 logic tests; CI runs them before every content refresh).

## Product posture — the MVP (unchanged)
One view (**Stack**), one ambient look (**Auras**), **Amsterdam only**; taste engine runs silently.
Endless deck (batching was tried + REVERTED) · full-bleed `cover` cards (blur-fill tried + REVERTED) ·
boomerang share→match→confirm all in the URL (`?w=`, `&m=1`) — see git history/CHANGELOG for details.

## The content pipeline (V.6.4 → V.6.20 — the "pipeline era")
The weekly feed is now **deterministic-varied, self-checking, and largely set-and-forget**. Architecture
docs: `docs/pipeline-architecture.md` (north star + roadmap), `docs/source-map.md` (source registry).

**Sources (adapters in `app/scripts/adapters/`):**
- **I amsterdam (`iamsterdam.ts`) — the deterministic VARIETY engine.** Keyless crawl of The Feed
  Factory's schema.org Event JSON-LD (~1,500 live events, category-namespaced) across 7 of 9 categories.
  **Capped at 5 picks/category** so it can't flood the feed. Links always point at the specific event page
  (or an off-site organiser page when the JSON-LD gives one).
- **Resident Advisor (`ra.ts`)** — keyless GraphQL (Amsterdam area 29): exact dates, flyer images, and an
  `attending` → `popularity` signal. **Protected lane: the top 2 RA nights are cap-exempt** (they
  otherwise lose every `live` slot to higher-ranked sources — Amsterdam must ship club nights).
- **web_search (`websearch.ts`)** — 10 Claude-Haiku facets; now the **serendipity edge**, no longer the
  spine. (Phase 2 = demote to 2–3 facets once a few more deterministic runs look healthy.)
- **`heroes.ts`** — hand-maintained guaranteed must-sees (injected if the adapters missed them, cap-exempt,
  auto-expire via date filters). **`curated.ts`** — hand-pinned images by title for recurring offenders.
- `llm.ts` (static scrape) + `rss.ts` (keyless floor) + `songkick.ts` (key-gated, optional).

**Cross-source identity + "most talked about":** `dedupe()` keys structured picks (`web-iams-`/`web-ra-`)
by **stable id** (distinct instances never collapse), keyless picks by normalized title, then **folds a
keyless duplicate into its structured twin** — corroboration counted as `buzz`, structured facts + flyer
win, `popularity` carried. Ranking **up-levels corroborated events steeply** (buzz 2→+1.5, 3→+3, 4+→+4)
and the Sonnet editorial judge explicitly up-weights multi-publication events.

**Ranking (runtime `rankPicks`):** weatherFit(+10, dominant) + freshness (EVERGREEN_FLOOR 0.6) +
buzzBoost + popBoost(log attending) + editorScore×0.5 (Sonnet judge, `ANTHROPIC_JUDGE_MODEL`) + taste +
seed jitter; `diversify()` de-clusters the **served** deck (and MatchGame) so no category waves.
Adaptive RESERVE widens canon backfill on thin weeks. Runtime `whenIsPast` guard: a stale feed
self-corrects in the browser — past events never render.

**Imagery (the hard-won part):** structured-source images are **trusted-but-screened** — organiser
posters/flyers flow untouched (re-processing them was the great sabotage of V.6.6–6.16), with two sanity
screens: a keyless URL smell-test (logo/wordmark/stock filenames) + a narrow vision check that rejects
ONLY logos/flat graphics/blank frames (keeps real posters). Untrusted (web-scraped) images get the full
gather → vision-verify → Pexels → canon-bank chain. **Every image routes through wsrv.nl** (800×1200
saliency portrait crop + server-side fetch = no hotlink blanks). Dead images self-heal to a verified bank
photo. **House treatment:** a weather-keyed soft-light glaze + film grain on both card faces
(`--card-grade`/`--card-grain`) so mixed sources read as one designed system.

**Self-sufficiency:** the run **grades itself** — a publish gate hard-fails only truly-broken states
(empty/past-dated/http images/imageless live/missing hero) and **abstains** (last-good keeps serving);
thin weekends warn but ship. Health line lands in `$GITHUB_STEP_SUMMARY` (the Actions email); optional
`HEALTHCHECK_URL` dead-man ping catches silent non-runs. **31 logic tests gate the cron** (`app/tests/`).

## Pipeline ops
- Cron **Thu 13:00 UTC** + on-demand (`gh workflow run refresh.yml`). ~$1–2/run. Dispatch race caveat
  still applies (confirm `headSha` matches after a fresh push).
- **Keys set:** `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, `ANTHROPIC_JUDGE_MODEL`. **Pending:**
  `SERPER_API_KEY` (Google-Images candidates, wired + dormant), `HEALTHCHECK_URL` (ping, wired + dormant).
  **Declined for now:** Ticketmaster (Ness: variety > ticketing spine).
- **Last good feed: 2026-07-02** — 76 picks, 9/9 categories, mix ≈ iams 27 · web/llm 13 · RA lane 2 ·
  canon 32 · heroes 2; 42 editor-scored; 7 cross-source-corroborated events up-leveled.

## Evergreen canon
~125 hand-authored picks incl. the V.6.4 fill-in (`picks.evergreen.ts`: markets 0→8, day-trips 4→9,
music venues 2→5 — subject-verified images, wsrv-wrapped). Canon = the imaged floor + search surface.

## Open items / next
1. **Phase 2 — demote web_search** to 2–3 serendipity facets once a few more runs look healthy.
2. **Thin slices:** eat/drink/shop fresh sources — re-run the (stubbed) research sweeps for food/community
   feeds and venue ICS calendars.
3. **"Talked about" pill** — make the buzz up-level visible on the card face, not just the ranking.
4. **Keys:** add `SERPER_API_KEY` + `HEALTHCHECK_URL` repo secrets to activate the dormant layers.
5. **City #2** — a dense-coverage EU city (NOT NOLA as-is), only after Amsterdam feels locked; the
  four remaining Amsterdam literals are mapped in `docs/pipeline-architecture.md` §3.5.
6. **Validation (the real gate, unchanged):** behavioral boomerang round-trip still open — n=1
  idea-reaction + Ness's own UX rounds. Feedback widget live (Formspree). Watch: do links come back
  with matches (`&m=1`), does a plan happen IRL.

## Doc map
`backlog.md` (strategy) · `pipeline-architecture.md` (north star/roadmap) · `source-map.md` (source
registry) · `pipeline-redesign.md` (the 5-problem deep-dive) · `moat.md` · `discovery-direction.md` ·
`content-pipeline.md` · `jtbd-analysis.md` · `market-scan-2026-06.md` · `mom-test-interviews.md` ·
`validation-log.md`.
