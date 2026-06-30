# WKNDR — Content Pipeline Architecture & Roadmap

*Amsterdam → automated, self-sufficient, fresh, visually tight → then mirror.*

**Owner:** Ness · **Status:** architecture step-back (v1) · **Date:** 2026-06-30

---

## 0. The honest framing

We've been patching symptoms. `heroes.ts` and `curated.ts` are weekly hand-edits that exist because the freshness engine (non-deterministic web-search) drops flagships and the image pass picks wrong/low-res/badly-cropped photos. The pipeline can't tell us it's healthy, so problems are discovered by playing the app. This doc steps back and architects the root causes, separating the genuine self-sufficiency wins from the changes that merely *relocate* manual work — and it folds the verifiers' realism checks in honestly.

**What the verifiers caught that this plan respects:**
- The Ticketmaster win is real **only if** the free standard Discovery key covers Amsterdam's venues — an *unchecked* premise. We gate the whole bet on a 30-minute spike.
- The proposed dedupe change (add venue+date to the key) **fights a documented decision** (`pipeline.ts`: *"Venue is NOT part of the key"*) and the weekend-focus filter already neutralises the problem it solves. **Dropped.**
- Auto-deriving heroes from a venue allowlist **relocates** the weekly edit into allowlist-babysitting. Instead, the existing injection logic shrinks `heroes.ts` to near-empty *for free* (a TM-found flagship is never injected).
- A status JSON **nobody reads is not observability.** The health signal must reach Ness in the Actions email he already gets.
- transformers.js/CLIP on **Bun** is the likeliest thing to silently break a Thursday run; a deterministic candidate-reorder gets ~80% of the benefit. **Dropped.**
- Pinning the hero in `rankPicks` **does not** survive `App.tsx`'s `[...diversify(fresh), ...diversify(sample)]` re-segmentation. The pin must also be in `App.tsx`.
- Un-pausing NOLA tests the **expensive** path, not the deterministic backbone (NOLA's roster is all-`llm`, no RA/RSS). Re-scoped.
- The "keyless RSS floor" the multi-city design leans on **doesn't exist as data** — `roster.ts` has 15 `llm` sources and **zero** `rss`. RA is the only deterministic source wired today.

---

## 1. North Star

The Thursday 13:00 UTC cron produces a **complete, self-checked, visually cohesive** weekend feed with **zero hand-tending** — and **refuses to publish** if it isn't shippable. Freshness rides a **deterministic structured spine** (Resident Advisor + Ticketmaster) so flagships never silently vanish; web-search is demoted to long-tail flavour. Every card wears **one palette-keyed design treatment** so a mixed bag of real-but-mismatched photos reads as one intentional WKNDR system. The run **grades itself**, posts a one-line health summary to the Actions log, and pages Ness **only** on a genuine regression or a silent non-run. Because cohesion comes from a runtime treatment and freshness from structured feeds, a second city is **config + sources, not a rebuild**.

---

## 2. The Big Bets (highest leverage first)

| # | Bet | Why it's the lever |
|---|-----|--------------------|
| 1 | **Ticketmaster structured backbone** (spike-gated) | Deterministically captures the flagships web-search drops, with real high-res images. Shrinks `heroes.ts` via *existing* code — not a new allowlist. |
| 2 | **Publish gate + dead-man's-switch** (~50 lines) | Removes the "find problems by playing the app" loop. Abstain-and-hold-last-good is free from the existing commit-only-on-success wiring. |
| 3 | **One house image treatment** (both card faces) | The designer-native cohesion win. Converts "find a better photo" into "force every photo through one designed coat." Free, deterministic, city-portable. |
| 4 | **Editorial that *leads*, not dilutes** (one structured Sonnet call) | Fixes "feels random/filler" and "tight enough to share." Hero pinned end-to-end (rankPicks **and** App.tsx); copy in voice with a fact-preservation guard. |
| 5 | **City-agnostic decoupling — last & small** | Removes the four Amsterdam literals so a new city is a config object. Done only once Amsterdam is locked (YAGNI before). |

---

## 3. Current → Target, by dimension

### 3.1 Sourcing & completeness
- **Now:** Completeness rides non-deterministic web-search (`websearch.ts`, 10 facets, haiku). RA (`ra.ts`, area 29) is the *only* structured live source and covers club/electronic only. Every non-club flagship depends on web-search surfacing it — and it drops them run-to-run. `heroes.ts` is the hand-typed band-aid (`when: 'Sat 4 Jul'` strings retyped weekly).
- **Target:** RA + Ticketmaster are the deterministic backbone; web-search is long-tail flavour. Flagships appear every run with exact dates + real images. `heroes.ts` shrinks to a near-empty safety valve **automatically** (the injection only fires for heroes *not already present*).
- **Move:** `scripts/adapters/ticketmaster.ts` (near-clone of `ra.ts`, id `web-tm-` — already treated as live by `isLive()` since it matches `web-`). **Gated on the 30-min coverage spike.** *Do not* add venue+date to the dedupe key (fights the documented title-only decision; weekend-focus filter already handles recurring titles).

### 3.2 Visual quality
- **Now:** The card **is** the raw source image — `Card.tsx` sets `backgroundImage` on `.card` with a single `.card-scrim` on top; the back (`.cb-media`) is a *second uncoated* surface. The `--field-*` weather palette is live on `<html>` but cards never read it. A 200px Pexels stock, a sharp RA flyer, and a Wikipedia portrait render as three different apps.
- **Target:** Every card wears one palette-keyed coat (tint + grain + scrim + locked portrait crop) so the mix reads as one system and breathes with the weather mode — a signature, not a liability.
- **Move:** `.card-photo` child + `.card-grade` (mix-blend-mode tint off `--field-*`) + `.card-grain` (one cheap noise tile) under the existing scrim, on **both** `.card` and `.cb-media`. SERPER on; reorder image candidates relevance-first before `slice(0,4)` in `verifyImageForEvent`. **No CLIP, no face detector** (Bun/onnxruntime risk for a residual the portrait-preference path already covers).

### 3.3 Editorial curation
- **Now:** `editorScore` is un-anchored and **diluted** — `rankPicks` adds it as `editorScore * 0.5` under a `+10` weather tier (verified `EDITOR_W=0.5`). Copy ships scraped. Nothing names "the one unmissable thing" (that's `heroes.ts`, by hand).
- **Target:** One structured Sonnet call returns `{scores, heroId, copy, nearDupClusters}` with an anchored rubric and cached voice brief. The hero leads the **served** deck; copy is in one voice with facts frozen.
- **Move:** `editorBrief.ts` (portable rubric + voice + exemplars); rewrite `editor.ts` to tool-use + `cache_control`; set `p.hero`; overwrite blurb/why with a **fact-preservation guard** (no new number/date/proper-noun, else fall back). `rankPicks` outer hero tier **and** App.tsx hoist-to-slot-0 after `diversify` (line 364). Fold dedup into this call — no ML dependency.

### 3.4 Self-sufficiency / observability
- **Now:** Rich per-stage counts die as `console.log`. The workflow commits + deploys **unconditionally** on any feed change. Three invisible failure classes: bad feed shipped, silent non-run, model drift.
- **Target:** Each run emits a `RunReport`; ~5 HARD asserts `exit(1)` *before* commit (abstain → last-good keeps serving); a `$GITHUB_STEP_SUMMARY` line reports health in the Actions email; healthchecks.io pings on success (silent non-run **and** repeated abstain both page).
- **Honest scope:** Gate only on *broken* (past-dated at publish, dead link, http image, zero heroes, empty feed) — **never on "thin"** (a quiet weekend is real). **Dropped:** the 5-dimension composite score, the golden set (live = flaps, frozen = blind to misses), LLM-score drift gates (noise).

### 3.5 Multi-city
- **Now:** Architecturally multi-tenant, but four code spots "know it's Amsterdam": `RA_AREA={amsterdam:29}`, `refresh.ts` `srcRank`/`LOW_QUALITY`, `websearch.ts` FACETS/GEO, `curated.ts` `curatedImage(title)` (unkeyed). NOLA is seeded but PAUSED and all-`llm`.
- **Target:** Zero city literals; every Amsterdam value in the extended `City` config. A new city = config + sources + a human-approved canon seed.
- **Move:** Extend `City`, refactor the four leaks, write `health.<city>.json`. **Last**, after Amsterdam is locked.

---

## 4. Sequenced Roadmap

**Phase 0 — Spike + two free wins (this week).** Ticketmaster coverage spike (hard gate); house treatment v1 (both faces); publish gate v1 (~5 hard asserts + `exit(1)` + step-summary); healthchecks.io ping. *Depends on: nothing.*

**Phase 1 — Structured backbone (gated on the spike).** `ticketmaster.ts`; wire into `fromRoster` before the LLM block; let `heroes.ts` shrink via existing injection (no auto-allowlist); trim `curated.ts`; SERPER on + relevance-first candidate reorder; optionally retire `songkick.ts`. *Depends on: Phase 0 spike passing.*

**Phase 2 — Editorial leads + copy in voice.** `editorBrief.ts`; structured `editor.ts` (tool-use + cache); hero tier in `rankPicks` + App.tsx hoist; voice rewrite with fact guard; semantic dedup folded into the call. *Depends on: Phase 1.*

**Phase 3 — City-agnostic decoupling.** Extend `City`; refactor the four leaks; `health.<city>.json`; checklist into `backlog.md`. Amsterdam output unchanged. *Depends on: Phase 2.*

**Phase 4 — Prove the mirror.** Prefer a dense-coverage EU city over un-pausing NOLA as-is; add a manual city switcher (geolocation-only today); bootstrap a human-confirmed ~20-30 canon skeleton. *Depends on: Phase 3 + switcher.*

---

## 5. Quick wins vs bigger bets

**Quick wins (days, mostly free):** the 30-min TM spike; house treatment; publish gate + ping; SERPER on; relevance-first candidate reorder; anchored editor rubric; retire `songkick.ts`.

**Bigger bets (multi-day, sequenced):** the TM backbone; the structured editor call + end-to-end hero pin + voice rewrite; the city-agnostic decoupling; the first real mirror + app switcher.

---

## 6. Mirroring playbook

Once Amsterdam is locked, a new city is a **checklist + one config object + a human approval** — because cohesion now comes from the runtime treatment (city-agnostic) and flagship freshness from structured feeds (RA area + TM market), not per-city photo-hunting or facet-tuning.

1. **Config object** — a `City` entry filling the extended interface (`countryCode`, `tmCity`, `raArea` cached, `srcRank`, `lowQuality`, `neighbourhoods`). The unit of "add a city."
2. **Structured spine for free** — RA + Ticketmaster carry flagship/nightlife completeness with real images; confirm with the same 30-min TM spike per country.
3. **Canon seed** — bootstrap a ~20-30 high-confidence skeleton through link-validation + image pass + an address-exists check, then **human-confirm**. Honestly: an afternoon of *verifying AI claims*, the highest-hallucination step — not hands-free.
4. **Long-tail sources** — point web-search/llm at `city.sources`; add the municipal open-events feed (Datapunt analogue) as a keyless backstop where one exists.
5. **App** — expose it in the manual city switcher (geolocation-only selection makes a new city invisible to anyone not there).
6. **Green-light by number** — `health.<city>.json` + the gate make "ready to share" a number: all HARD gates green, healthy for 2 consecutive weeks.

*Strategic note:* a EUROPEAN city #2 validates the **data sources**; un-pausing NOLA validates only the **plumbing**. Prefer the EU city, or wire NOLA a structured source first.

---

## 7. Decisions for Ness

1. **TM coverage** → *Run the 30-min spike first.* It's the load-bearing premise; the well-covering International Discovery API is closed to new keys.
2. **Gate hardness** → *Hard-block only truly-broken states; "thin" is a soft warning.* A quiet weekend isn't a malfunction.
3. **Treatment intensity** → *Subtle universal grade first, A/B via the dev panel, then key to weather mode.* You rejected blur-fill — your eye decides.
4. **Hero pin** → *Hard pin to slot 0, weather-aware, implemented in App.tsx too* — or the promise breaks at re-segmentation.
5. **ML scaffolding** → *Drop CLIP / face-detector / Batch / prompt-cache-micro-opt.* Keep prompt caching; fold dedup into the Sonnet call.
6. **City #2** → *A dense-coverage EU city, after Amsterdam is locked.* NOLA as-is tests only the expensive path.
7. **Alert cadence** → *Page only on regression/non-run; HEALTHY lands passively in the step-summary.*

---

## 8. What this explicitly does NOT do (and why)

- **No venue+date dedupe key** — fights `pipeline.ts`'s documented title-only decision; weekend-focus filter already neutralises the recurring-title case.
- **No auto-derived hero venue allowlist** — relocates the weekly edit; the existing injection shrinks `heroes.ts` for free.
- **No transformers.js/CLIP, no face detector** — Bun/onnxruntime fragility for a residual already covered; a candidate-reorder gets ~80%.
- **No 5-dimension composite health score, no golden set** — observability theatre / internally contradictory at weekly cadence.
- **No Batch API cost story** — the editor call is awaited inline in a synchronous job; the 24h-SLA discount isn't really available, and at weekly cadence cost is already cents.
- **No multi-city config abstraction before Amsterdam is locked** — YAGNI for a paused city.

*The throughline: every change either removes a manual loop or makes an invisible failure visible. Where a design only relocated manual work, we said so and cut it.*