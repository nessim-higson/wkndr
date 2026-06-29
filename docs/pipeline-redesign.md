# WKNDR Pipeline & Deck — One Integrated Fix Plan

_Owner: lead eng + product (Ness). Date: 2026-06-29. Status: in progress (uncommitted working tree)._

## Implementation status (2026-06-29)

**Built + verified, not committed:**
- Quick-win bundle — `editorScore` quality term, adaptive RESERVE, `EVERGREEN_FLOOR` knob, `diversify` moved
  onto the served deck (waves: max category run 5 → ≤2), imagery A (event-page JSON-LD/og for generics) +
  imagery C (wsrv.nl portrait crop), Sonnet editorial-scoring pass (`editor.ts`, `ANTHROPIC_JUDGE_MODEL`).
- **Resident Advisor structured adapter** (`scripts/adapters/ra.ts`) — keyless GraphQL pull of the weekend's
  Amsterdam club nights (area 29): exact dates, real flyer images, line-ups, and an `attending` **popularity**
  signal. New `Pick.popularity`, carried through `dedupe`, fed into `rankPicks` as a log-scaled `popBoost`.
  Verified live: 30 nights, popularity drives the `live` ranking, weather-fit still leads.

- **Canon fill-in (`scripts/.../picks.evergreen.ts`)** — 16 evergreen rows filling the genuinely thin
  `always`-pool shelves: **market 0 → 8** (Albert Cuyp, Ten Kate, Waterlooplein, IJ-Hallen, Dappermarkt,
  Lindengracht, Pure Markt, Bloemenmarkt), **daytrip 4 → 9** (Utrecht, Marken & Volendam, Zandvoort, Muiderslot,
  Kinderdijk), **live 2 → 5** (Paradiso, Melkweg, Concertgebouw — flagged: "always-good venues" is Ness's call).
  Every image is a real photo, subject-verified by eye, served through the wsrv.nl portrait proxy (clean tall
  crop + server-side fetch so web-host sources never hotlink-blank). Outdoor markets/day-trips are fair-weather;
  venues all-weather. Verified: local refresh balances the feed to market 8 / live 8(RA), all images HTTP 200.

**Remaining bets (not built):**
- **Ticketmaster adapter** — DECLINED for now: adds mainstream dated concerts but cuts against the
  LBB/I amsterdam/RA editorial lean + the trust filter, and needs a key. RA covers the structured slot.
- Citation-as-link hardening (needs a live web_search fixture); quarterly `canon-health` cron.

Produced by a deep research + adversarial-verify pass over the real code and the served feed. Where the
research conflicted with the code, the **verified code wins** — see the ground-truth table.

## TL;DR

The five asks collapse into **three** real problems:

1. **Quality & diversity are decided where they have no teeth.** "Best events" ranking and de-clustering
   both happen at **build time**, then the frontend `rankPicks()` (`modes.ts:111`) re-sorts the whole pool
   from scratch by `weatherFit + freshBoost + buzzBoost + tasteScore + jitter` — **no quality term, no
   editorial-order term**. So any "best" work at build time is invisible, and `diversify()` is thrown away
   because `App.tsx` re-segments the deck into `[...live, ...canonSlice]` *after* it runs. **The keystone is a
   `Pick.editorScore` field that `rankPicks` actually reads** + running de-clustering on the *served* deck.
2. **Two evergreen shelves are empty, and no algorithm can fill them.** The served feed is already
   category-balanced (max 14%); the problem is the `freshness:'always'` fallback pool has **art 0, market 0,
   live 2** — so on a thin-live weekend those categories vanish. Only hand-authoring fixes that.
3. **The "generic event" image class never gets a real photo.** Festivals/markets/restaurants/exhibitions
   from web-search are excluded (`refresh.ts:138`) from candidate-gather *and* vision verify — they skip
   straight to generic stock, even though each carries a specific event-page link it never uses.

---

## Ground truth (verified against the repo + served feed, 2026-06-29)

These override the original designs where they conflict:

| Assumed | Verified reality |
|---|---|
| Canon skewed art 16 / market 2 → causes waves | **Wrong artifact.** App serves `public/data/picks.amsterdam.json` (already rebalanced). Served feed: out 8, eat 8, drink 8, art 8, shop 8, stage 7, market 4, daytrip 4, live 3 — **max 14%, near-flat.** |
| A build-time "best events" reorder fixes ranking | **No-op.** `App.tsx:322 → rankPicks` re-sorts at runtime; file order is discarded. `rankPicks` has no quality term. |
| `diversify()` is missing | It exists (`modes.ts:127`) but `App.tsx:345-352` re-segments into `[...fresh, ...sample]` after it runs — **the served deck is never de-clustered.** |
| Dated gigs rotate as evergreen | Already fixed — pipeline drops past-dated picks (`refresh.ts:92`). |
| No per-category cap exists | **False** — `balanceByCategory(picks, 8)` at `refresh.ts:258` (when live > 6). |
| Canon is undated → exempt from age-decay | **False** — `latestDateOf` returns event *end-date*; reusing it for decay would *boost* future events. |
| Unit tests are free validation | **No harness exists** (no vitest/jest, no `test` script). Net-new infra. |
| (imagery) `genericWebEvent` is a tuning problem | **Structural** — generics are excluded from any real-photo attempt at `refresh.ts:178`. |

Empty shelves confirmed: **served `always`-pool = art 0, market 0, live 2.** wsrv.nl portrait crop verified
working (landscape → true 800×1200 saliency JPEG, keyless, HTTP 200). I amsterdam pages carry og:image
(per-event JSON-LD varies by page — confirm before JSON-LD-first ordering).

---

## Problem 1 — Very good, highly relevant imagery

**Root cause.** `genericWebEvent = id.startsWith('web-') && !PERFORMER.has(category)` (`refresh.ts:138`) is
excluded from candidate-gather **and** vision verify (`refresh.ts:178`). Festivals/markets/restaurants/
exhibitions get **no real-photo attempt** — straight to Pexels stock / canon bank. But each carries a
*specific event-page link* (the web-search adapter requires the specific page, not a month index —
`websearch.ts:84,93`) whose structured image is the photo the organizer chose for that event. Secondary:
`fetchOgImage` reads only og/twitter:image, never schema.org `Event.image` JSON-LD; and nothing reshapes a
correct landscape photo before the tall `cover` card, so it crops to a band.

**Fix — A + C now, B next.**

1. **A (core, recommended) — give generics their own event-page image, vision-gated.** Extend `fetchOgImage`
   → `fetchEventImage(link)` reading, in order: schema.org `Event`/`ImageObject` `image` from
   `application/ld+json`, then og:image, then twitter:image — each through `isGoodImage`. Remove the
   `!genericWebEvent` exclusion at `refresh.ts:178` so generics gather their page image as a candidate; they
   still pass through `verifyImageForEvent` (the safety net that rejects the Pride-parade case) → Pexels →
   bank. **Zero new keys; ~10-15 extra haiku-vision calls/run (a few cents).**
   - Touchpoints: `pipeline.ts:217-239`, `refresh.ts:178`.
2. **C (recommended add-on) — portrait normalization via wsrv.nl.** `toPortrait(url) =
   https://images.weserv.nl/?url=<enc>&w=800&h=1200&fit=cover&a=attention&output=jpg` applied to every final
   `p.image` (or only landscape sources) just before write. Keyless, free, CDN-cached, saliency-cropped —
   **verified working.** Store the original URL as fallback. Fixes the tall-crop complaint across *all*
   sources at once.
   - Touchpoints: small helper in `pipeline.ts`; one map near `refresh.ts:211`. Card CSS unchanged.
3. **B (next) — Serper `/images` to replace the keyless DuckDuckGo scrape.** DDG `i.js` is vqd-token-fragile
   and silently returns `[]` when it breaks. Serper is a stable Google-Images proxy: 2,500 free credits then
   ~$0.30-1.00/1K (months on free tier at ~60 picks/run). Feeds better candidates into the same vision gate.
   - Touchpoints: new `serperImageCandidates` in `pipeline.ts`; swap `refresh.ts:177`; secret in
     `refresh.yml`. Keep DDG as keyless fallback.

Keep **`claude-haiku-4-5`** for the relevance call (cheap "which image fits" classification it handles well);
**reject** gen-AI imagery (not a real photo of a real event — wrong for a trust product) and a CLIP prefilter
(self-hosting infra for savings that don't matter at this volume). 2026 API context: Bing Image Search API
**retired** (Aug 2025), Google CSE **closed to new customers**, Brave **killed its free tier** (Feb 2026) —
so keyless event-page extraction + wsrv.nl + Serper-on-free-tier is the cost-right stack.

---

## Problem 2 — The best events each weekend

**Root cause.** Facts *and* judgment are both delegated to the cheapest model (`claude-haiku-4-5` web_search,
`websearch.ts:20`), which types its own link (`websearch.ts:192`) instead of using the search citation. The
only downstream "best" signal is `srcRank` (a website-authority tier) — and even that is discarded at runtime
because `rankPicks` has no quality term.

**Fix (sequenced).**

1. **Keystone — quality term in `rankPicks`.** Add `editorScore?: number` to `Pick` (`types.ts:45`); in
   `modes.ts:115-117` add `+ (p.editorScore ?? 0) * QW` **within the weather tier** (sub-term, so the +10
   `weatherFit` invariant at `modes.ts:103-104` holds). Default undefined → pure no-op. *This is what makes
   any quality work visible.*
2. **Producer (bigger bet) — Sonnet editorial pass.** New `scripts/adapters/editor.ts:editorialOrder()`, one
   `claude-sonnet` call after `balanceByCategory` (`refresh.ts:258`) returning per-id `0..10` scores. New
   `ANTHROPIC_JUDGE_MODEL` env (do **not** reuse `ANTHROPIC_MODEL` — it defaults to haiku). Never-throws →
   missing score → 0 → today's behaviour.
3. **Producer (bigger bet) — structured adapters.** `ra.ts` (RA GraphQL, area 28) + `ticketmaster.ts`
   (Discovery, free key) for exact dates, real ticket links, pre-sized flyer images, and a **new
   `Pick.popularity`** field (NOT `buzz` — dedupe clobbers it at `pipeline.ts:34`). Feed `popularity` into the
   quality term. RA is undocumented/ToS-sensitive + JS-gated (returns nothing to plain fetch) → low volume +
   fallback; TM key in CI secrets.
4. **Cheap hardening — citation-as-link.** At `websearch.ts:192`, prefer the web_search citation URL over the
   model-typed link. **Capture a live `web_search_20250305` fixture first** (payload shape unverified); do NOT
   add a date-in-cited_text drop-gate without it (would wrongly drop good picks).

---

## Problem 3 — Evergreen timing (and search)

**Root cause.** The canon-vs-live blend is one hardcoded `RESERVE=14` (`App.tsx:345`), blind to how thin the
live feed is; and `rankPicks` has no tunable evergreen weight.

**Fix.**

1. **Adaptive RESERVE** (`App.tsx:345-352`, verified safe). Replace `const RESERVE = 14` with
   `Math.min(ever.length, Math.max(8, 22 - fresh.length))`, placed **after** the `fresh`/`ever` derivation
   (line 348) and **before** the `ever.length <= RESERVE` guard (line 349). Thin week → ~22 canon; rich week →
   floor of 8. Re-tune the (8..22) band against the measured live count (~22 now). Rotation, bottomless
   reshuffle, and filtered/search paths untouched.
2. **`EVERGREEN_FLOOR` knob** in `rankPicks`: gate on `freshness === 'always'` (NOT id-prefix, NOT
   date-unparseability), applied to recency+buzz+taste **sub-terms only**. **Drop the age-decay idea** — the
   first design reused the event-end-date parser, which boosts future events; the only valid age signal is
   `generatedAt`/`seenLastWeek` novelty (`refresh.ts:45-49`), deferrable.
3. **Deferred:** `lastVerified?: string` + a **separate quarterly** `scripts/canon-health.ts` (Claude flag
   pass + optional Google Places `business_status`) → human review queue + a subtle "Checked <month>" on canon
   cards. Never on the weekly run; never auto-applies.

---

## Problem 4 — What the evergreen list consists of

**Root cause (re-diagnosed).** Not editorial skew in the served feed (it's balanced), but **empty shelves in
the always-pool**: art 0, market 0, live 2. `balanceByCategory` cannot create supply it doesn't have.

**Fix.**

1. **Do NOT flip `App.tsx:346` to a freshness predicate** (regresses the documented live-leads behaviour at
   `App.tsx:340-344` and strips art/market — which have 0 always-canon — from the rotating slice). **Do NOT
   add a second per-category cap** (one already exists). At most, tune the existing `perCat` or the `>6`
   live-gate (`refresh.ts:257`).
2. **Editorial fill-in (the real fix):** author **~12-16 `freshness:'always'` rows** — art (Rijksmuseum, Van
   Gogh, Stedelijk, Moco, H'ART, FOAM standing collections), market (Albert Cuyp, Ten Kate, Noordermarkt,
   IJ-Hallen), optional 1-2 live VENUES (Paradiso/Melkweg as always-good places). Use the existing builder
   shape in `picks.batch2.ts` / `picks.lostin.ts`; tag `weatherFit` so daytrips/markets self-seasonalise via
   the existing +10 term. **Each row needs a hand-verified https image** — the dominant cost. Codify the
   selection rule (target per-category floor) as a comment so it can't silently re-skew.

---

## Problem 5 — Anti-clustering (the "waves")

**Root cause.** `diversify()` runs inside `rankPicks` on the full pool, but `App.tsx:325-352` re-segments into
`[...fresh, ...sample]` afterward — so the **served deck is never de-clustered**. The live block clusters by
the topical web-search facets that produced it; the canon slice is a contiguous ranked window.

**Fix.**

1. **Structural move (mandatory, the real fix):** export `diversify`; make `rankPicks` return pure score order
   (`return sorted`); wrap the `App.tsx:352` return and the early filtered returns (`:339`, `:349`) in
   `diversify(...)` so de-clustering is the **last** transform on the served sequence. Make it **tier-aware**
   (don't lift a non-weather-fit card from a rare category above weather-fit cards — preserves `modes.ts:103-104`)
   and **preserve "live leads"** (de-cluster within the live block and within the canon block, or keep live
   ahead — don't scatter live picks through canon). Verify `savedPicks`/itinerary (`App.tsx:359`, regrouped at
   `:363-376`) is unaffected.
2. **HOLD the count-weighted scheduler.** The served feed is near-flat (max ~14%), so the elaborate scheduler
   solves a smaller problem than first assumed and risks breaking weather-fit dominance and the live-leads
   order. Escalate only if waves persist on the live deck after the structural move.

---

## Sequenced plan (what unblocks what)

| # | Change | Problem | Cost | Depends on |
|---|---|---|---|---|
| 1 | **Quality term in `rankPicks`** + `Pick.editorScore` (no-op default) | 2 | client, free | none — keystone |
| 2 | **Adaptive RESERVE** (`App.tsx:345`) | 3 | client, free | none — parallel |
| 3 | **EVERGREEN_FLOOR** (sub-terms, gated on `always`; no decay) | 3 | client, free | step 1 (same `score()` edit) |
| 4 | **Move `diversify` to served deck** (tier-aware, live-leads) | 5 | client, free | step 1 |
| 5 | **Imagery A** (event-page JSON-LD/og for generics, vision-gated) | 1 | ~cents/run | none |
| 6 | **Imagery C** (wsrv.nl portrait crop) | 1 | free | none — independent |
| 7 | **Editorial canon fill-in** (art + market + venues) | 4 | content sprint | needs Ness scope |
| 8 | **Imagery B** (Serper `/images`) | 1 | free tier→cheap | new key |
| 9 | **Citation-as-link** hardening | 2 | free | a captured web_search fixture |
| 10 | **Sonnet editor pass** (produces `editorScore`) | 2 | few cents/run | step 1; new env |
| 11 | **RA + Ticketmaster adapters** (+ `Pick.popularity`) | 2 | TM key | step 1; ToS call |
| 12 | **`lastVerified` + quarterly health cron** | 3 | separate cron | step 7 |

Steps 1-6 are the "fix it once and for all" core: client + build-time, zero/near-zero cost, fully reversible.

## Quick wins vs bigger bets

**Quick wins (this week):** rankPicks quality term (keystone) · adaptive RESERVE · EVERGREEN_FLOOR ·
diversify-on-served-deck · imagery A (event-page photo) · imagery C (portrait crop).

**Bigger bets (decision-gated):** canon fill-in (the only fix for empty shelves) · Serper image source ·
Sonnet editorial-score pass · RA/Ticketmaster adapters · quarterly canon-health cron.

## Decisions for Ness

1. **Events depth** — runtime quality term + Sonnet editor (recommended), or also the structured RA/Ticketmaster
   adapters (more reliable dates + a real popularity signal, but a TM key + RA ToS risk)?
2. **Imagery key** — A + C now and hold Serper (recommended), or add Serper to replace the fragile keyless
   DuckDuckGo scrape (free tier, then ~$0.30/1K)?
3. **Canon fill-in** — commit to a ~12-16-row content sprint now (the only fix for empty art/market shelves), or
   ship the runtime fixes first and curate later?
4. **Anti-clustering depth** — structural `diversify` move + measure (recommended), or build the count-weighted
   scheduler now (regression risk on a flat feed)?
5. **Test harness** — stand up vitest for the ranking/diversify logic, or verify via `?dev=1` + a local refresh diff?

## Rollout / verification

- Land steps 1-6 as 1-2 PRs; eyeball the unfiltered deck on a thin vs rich week (fake `fresh.length` in dev)
  and confirm: weather-fit still leads, canon backfills wider on quiet weeks, the served deck no longer runs in
  category waves, `savedPicks` itinerary order is unaffected, generic events now carry real photos, no
  landscape band-crop.
- For build-time changes, run `bun run refresh --city=amsterdam --no-images` locally and diff
  `picks.amsterdam.json` before committing.
- All client changes deploy as a normal GitHub Pages push — no pipeline cost, no data regeneration.
