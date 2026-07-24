# WKNDR — STATE (catch-me-up snapshot)

_Living "where are we right now" doc — a **snapshot, not a history**. **Updated 2026-07-23.** Read this
FIRST in a new chat. For strategy + backlog see `docs/backlog.md`; for the pipeline architecture see
`docs/pipeline-architecture.md` + `docs/source-map.md`; for **who may write to the deck vs to a personal
profile** (board / Tune / airlock — read before touching either) see `docs/curation-surfaces.md`; for the
**board roadmap** (auto-compile tracks) see `docs/board-roadmap.md`; for full **version history** see
`CHANGELOG.md` (current to app V.10.17 / board V.9.23) and the **git log / tags**. Onboarding:
`CLAUDE.md`. App lives in `/app` (Vite + React + TS, run with `bun`); ships to **Cloudflare Pages**
(`wkndr.xyz` + `app.wkndr.xyz`) **and** GitHub Pages (legacy, keeps old share links alive)._

> **START-OF-SESSION for WKNDR:** check `gh issue list --label curation` — the Curation Board's
> **Submit** button files Ness's verdict rounds as repo issues. That's the canonical inbox:
> read the open ones, compile into the taste engine (below), ship, then close the issue.
>
> **NEW (2026-07-23) — the FAST-LANE.** Submit now ALSO POSTs the round (pile order + kills) to the
> `wkndr-curate` worker (`worker/curate/`, KV-backed, `wkndr-curate.ness-13b.workers.dev`). The app
> reads it on load (`lib/overrides.ts` `fetchOverrides` + `applyOverrides`) and layers `pile` → `pilePos`
> (deals first) + `killed` → dropped ON TOP of the static feed — so a reorder/kill goes live in seconds,
> no compile, no redeploy. **The GitHub-issue compile is still the DURABLE record** you fold into
> `corpus.json`/`weekly.json` on the next refresh (fast-lane = instant layer, corpus = source of truth).
> Next per `docs/board-roadmap.md`: light polling so open sessions update (today it's on load); a
> reason→action routing table for the ✕ reason picker.

## Live right now
- **Web presence (wkndr.xyz):** Ness registered **wkndr.xyz** through Cloudflare (domain + DNS in
  his CF account). Two surfaces ship from this repo to **Cloudflare Pages**: the **landing** at
  `wkndr.xyz` (self-contained static site in `landing/` — hero + 3 steps + one "Open WKNDR" CTA +
  `/privacy`, WKNDR paper/orange voice) and the **app** at `app.wkndr.xyz`. The app gained a second
  build target — `bun run build:domain` (`WKNDR_DEPLOY=domain`) serves at base `/` and bakes the
  canonical origin `https://app.wkndr.xyz` into the unfurl (`app/index.html` `%OG_ORIGIN%`) + share
  links (`lib/share.ts` `shareBase()`); the default `bun run build` is UNCHANGED (base `/wkndr/`,
  GH Pages origin) so **old share links in the wild keep resolving**. The GitHub Pages deploy stays
  live. Custom-domain attach + DNS are Ness-only CF-dashboard steps (checklist handed off). Pages
  projects: `wkndr-landing` + `wkndr-app`.
- **The two surfaces now unfurl as different things (2026-07-17, landing-only, no app bump).** The
  app card is **cover-orange** ("Swipe. Save. Match.", *Match* in black) at `app/public/og-app.png`
  (new filename forces WhatsApp/iMessage re-scrape past the cached cream card; `og.png` also carries
  the orange card for stale refetches); the **landing keeps the cream poster**. Landing scroll copy
  got a **de-dupe pass** — one idea per beat, the "Your weekend, one swipe away." tagline lands once
  (on the reveal), cover = "Weather permitting.", feed = "Right is a yes.", payoff = "Nothing left to
  plan.", "The overlap is the plan." revived from Site 02; landing meta/JSON-LD now in the new voice
  ("Amsterdam plans, rearranged by the sky"). See CHANGELOG `[landing] 2026-07-17`.
- **App: V.10.17** — https://app.wkndr.xyz (cache-bust `?v=V.10.17`; GH-Pages mirror at
  nessim-higson.github.io/wkndr/). **Recent arc (2026-07-21→23):** V.10.12 = field-feedback reliability
  (persist declines so a refresh doesn't re-deal them → `wkndr.swiped.v1`; intro is now first-run/arrival
  only, not every load; LBB "View event details" links fixed — reject LBB self-links → scoped event
  search, see `adapters/lbb.ts`). V.10.13–10.15 = **compile R9 + R10 prune** (73-verdict round #17: 20 star
  reinforcements, crowns pruned **18→6**, `weekly.pile` set to THE LENS so the deck opens on this weekend's
  dated+weather slice; R9b honoured the Scheepvaartmuseum kill I first got wrong). **V.10.16 = the FAST-LANE
  wired end-to-end** (board Submit → app deck in seconds, see the START-OF-SESSION box + `lib/overrides.ts`).
  V.10.17 = checkpoint "Keep swiping" is a white pill. **Note:** the app now orders the deck by `pilePos`
  (the hand/override order in `weather/modes.ts orderServed`), which `applyOverrides` + restamp both stamp.
  **(V.10.3 = "Tune WKNDR"** — the calibration micro-deck DEV PROTOTYPE (`?dev=1` → menu → Taste · dev):
  8 archetype poster cards swiped in the app's own deck seed the on-device taste profile heavy
  (★ +3/token, ✕ −2) and re-deal instantly; 👑 TOPs still lead by law. Also: SwipeStack
  flying-guard (mid-exit re-fling can't double-write taste). **V.10.2** = og.png redrawn to the
  new headline (both surfaces) + solid detail chips. **V.10.1 =
  "the finish pass"** (2026-07-16): `whenLooksBroken` drops malformed date ranges runtime+pipeline
  (the "Sun 28 – Sun 12 Jul" class), detail shows "listing checked N hours ago", keyboard/SR deck
  (top card = focusable button, ←/→ skip/save, ★ = save everywhere), dialog focus discipline
  (`lib/useDialogA11y` + inert closed menu), reduced-motion support, match nudge from the FIRST
  save, ShareSheet privacy/expiry line → /privacy, canonical + web-app manifest. Landing got the
  same sweep: hero = "Your weekend, one swipe away." (Tinder framing retired), LOOK switcher
  dev-gated, progress dots + keyboard paging + reduced-motion stable stages, closing trust canvas.
  (V.9.17 notes: V.8.16 = **THE
  AIRLOCK** — Ness's 2026-07-10 call made law: the live deck is 1:1 with his board approvals. A live
  pick ships only on an approval match (starredKeeps/tops/★3+ anchors/slate/hero/buzz≥3 — one shared
  `approvalCheck` in lib/pipeline); everything else waits imaged+scored in `pending.<city>.json`,
  weekend-topical first (dated-this-weekend → forecast-mode fit → judge). Board verdicts promote via
  restamp; invariant test `tests/airlock.test.ts` guards it — **112 tests**. V.9–V.9.2 = button-fling
  exit polish; V.9.3 = weather tint on card faces; V.9.4 = the relay (below); V.9.5 = **THE LENS** +
  the seasonal-venue websearch fix + the deck's sun bonus; V.9.6 = boomerang return gate; V.9.7 =
  the relay LIVE; V.9.8 = **compile R5 + the lost #8/#9 verdicts** — Île de Bisous veto, Queer
  Amsterdam 👑, Martin Parr canon, BRET image pinned; V.9.9 = **the board reads the deck** — the
  pipeline stamps `servePos` (the app's own serve order, dragged pile included) and the WEEKEND
  PILE renders the stamp instead of the old drifting tier-mirror; V.9.10–V.9.12 = board version in the eyebrow (Pages caches 10 min), SUMMER RUNS join the lens on hot weekends + the big-screen / World Cup websearch facet) ·
  **Curation Board (board V.9.23, redesigned 2026-07-22→23):** https://app.wkndr.xyz/curate/ (or the
  door `app.wkndr.xyz/?curate2026!` → board on a laptop, Triage deck on a phone; GH-Pages mirror also
  live). Ness's core feedback drove a rebuild: **Helvetica everywhere, dead-simple, one ranked deck.**
  Now a **Simple / Advanced toggle** (`#modetoggle`):
  - **SIMPLE (default) = the ONE ranked deck.** "Your top 10 — the cards that open the deck" (numbered,
    drag ⠿ to reorder, − to demote) + **"Up next"** (the rest, auto-ranked, but a DRAGGABLE row list — ↑
    to promote into the Top 10, drag to reorder; Ness wants to stay hawkish). `PILE` is now the FULL deck
    order and rides Submit (→ `weekly.pile` / the fast-lane `pile`). Seeds from the live serve order so the
    board mirrors the app.
  - **ADVANCED = rate / veto / canon / discover only** (NO competing pile — that was the confusing bit,
    removed). At top: a **"Your kills & flags — did they land?"** status panel (checks each kill/flag vs the
    live feed → "● pending ship" / "✓ dropped"). Then THE LENS (dated + forecast-fit slice), the feed by
    category, canon library, and the `NEW FINDS` tab (THE AIRLOCK). Every card's **↑ Top 10** button
    (`promoteToDeck`) drops it straight into the Simple deck (New Finds get pulled in as `extras`).
  - **✕ is a REASON PICKER now**, not a blind delete: "What's wrong?" → wrong link / bad image / low-res
    (keep + flag for a fix, pick STAYS) · off-brand / seen it / duplicate (remove). The reason rides Submit
    (`why:<reason>`) and is meant to ROUTE the compile action (link-fix vs image-swap vs rest vs veto) —
    the structural fix for the R9 Scheepvaartmuseum error (a "wrong link" must never veto a crown again).
  - **Submit = two writes** (see the fast-lane box): POST to `wkndr-curate` (live in seconds) + the GitHub
    issue (durable compile record). Card titles link OUT to the real page; photo → the loupe (uncropped +
    LOW-RES verdict). "Email"/Formspree is the backup.
- **Curation ladder (the whole instrument):** ✕ kill (permanent veto) → ★1-3 → ★4-5 (editorScore
  floor 8 + carry-forward) → **★4+KILL = RESTED** (fatigue ≠ taste: benched from feed+bench until a
  date, then returns; `corpus.rested`) → +CANON (`picks.canon2.ts`, permanent library) → **▲ LEAD /
  ▼ LATER** (`taste/weekly.json`, keyed to the upcoming Saturday, auto-expires — this weekend's slate)
  → **👑 TOP** (`corpus.topPicks`, permanent: guaranteed into the feed + leads the deck + "Top pick"
  pill; keep ≤6). Deck pile order everywhere: TOP → LEAD → ranked middle → LATER.
- **App-side image polish (V.8.x):** the detail sheet's 3/2 header is re-derived from the ORIGINAL
  (killed the crop-of-a-crop) + a full-screen ⤢ FOCUS lightbox.
- **`?dev=1`** reveals the full exploration surface (all views, ambient-look switcher, city picker).
- **Frozen reference builds:** `/wkndr/versions/v6-2/` (tag `v6.2`) and `/wkndr/versions/v4-10/` (tag `v4.10`).
- **Ship loop:** `cd app && bun run bump` → `bun run build` → commit → push (auto-deploys GH Pages) →
  reply with the `?v=` link. **The two wkndr.xyz surfaces are MANUAL wrangler deploys** (no CF git
  integration): `cd landing && npx wrangler pages deploy . --project-name=wkndr-landing` and
  `cd app && bun run build:domain && npx wrangler pages deploy dist --project-name=wkndr-app`
  (wrangler already authed on this machine; bare-URL curl checks may show stale edge cache — bust
  with a query param, or verify against the immutable `*.wkndr-app.pages.dev` deploy URL). The board
  (`app/public/curate/index.html`, bumped via its own `BOARD_V` const + eyebrow) ships inside the app
  build. **Tests:** `bun run test` (**126 logic tests**; CI runs them before every content refresh).
  **Pages deploy flakes** intermittently ("try again later") — re-dispatch `deploy.yml` (there's an
  auto-retry pattern in the ship watchers).
- **Compile fast-path (no crawl):** `cd app && bun run scripts/restamp.ts` re-applies the taste layer
  (veto/rested/topPicks/starredKeeps/weekly pile) to the LAST PUBLISHED feed in ~90s — the way a
  board round or a `weekly.pile` change ships without a full `refresh` (which needs API keys + ~15min).
  **The `wkndr-curate` worker** is deployed separately: `cd worker/curate && npx wrangler deploy`
  (source in-repo, KV id `ea7216a7…` in `wrangler.toml`).

## Product posture — the MVP (unchanged)
One view (**Stack**), one ambient look (**Auras**), **Amsterdam only**; taste engine runs silently.
Endless deck (batching was tried + REVERTED) · full-bleed `cover` cards (blur-fill tried + REVERTED) ·
boomerang share→match→confirm all in the URL (`?w=`, `&m=1`) — see git history/CHANGELOG for details.
**V.9.4 added WKNDR's first backend — the relay** (`/relay`: a tiny Cloudflare Worker + KV) so the
return leg no longer needs a manual link-back (field failure 2026-07-11: partner finished her round,
never sent it back). Invite links carry a round id (`&r=`); the recipient's matches POST to the relay;
the sender's app polls and jumps to the same `&m=1` confirm. Privacy-light (short pick-codes + first
name, 14-day TTL, no accounts); optional Formspree email ping on round completion. **LIVE since
V.9.7** — worker at `https://wkndr-relay.nessimhigson.workers.dev` (Ness's CF account, deployed
2026-07-12), `RELAY_URL` set in `app/src/lib/relay.ts` (empty = relay off, old behavior). It stacks
with V.9.6's ReturnGate: the gate pushes the manual send, the relay delivers even if the recipient
bails; on a confirm page the poll only absorbs (never reloads). Funnel: `relay-return`. **WKNDR's
SECOND backend (2026-07-23) is `wkndr-curate`** — the curation fast-lane worker (Cloudflare Worker +
KV, source in-repo at `worker/curate/`, live at `wkndr-curate.ness-13b.workers.dev`). Board Submit
POSTs the round (pile order + kills, scoped to the feed's `generatedAt`); the app GETs + `applyOverrides`
on load. Same privacy posture as the relay (titles/order/reasons, no accounts). See the START-OF-SESSION
box + `app/src/lib/overrides.ts`.

## The content pipeline (V.6.4 → V.7 pipeline era → V.8 taste-engine era)
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
(`--card-grade`/`--card-grain`) so mixed sources read as one designed system. **Low-res hardening
(V.8):** `isGoodImage` now parses more formats (WEBP-lossless, 256KB probe range) and **rejects
unparseable dims** (the old benefit-of-the-doubt pass was the low-res back door) + a render-aware
1.6×-upscale cap; the board shows `LOW RES · w×h` flags. **Dupe suppression (V.8):** `dedupe()` PASS 2.5
collapses word-order/punctuation twins (token-set key `tokKey`); the board hides cross-section twins.

**Self-sufficiency:** the run **grades itself** — a publish gate hard-fails only truly-broken states
(empty/past-dated/http images/imageless live/missing hero) and **abstains** (last-good keeps serving);
thin weekends warn but ship. Health line lands in `$GITHUB_STEP_SUMMARY` (the Actions email); optional
`HEALTHCHECK_URL` dead-man ping catches silent non-runs. **45 logic tests gate the cron** (`app/tests/`).
**The date brain is unified in `src/lib/when.ts`** — build (pipeline), runtime (dock/deck), and the
itinerary/.ics export all parse `when` strings through that one module.

## Pipeline ops
- Cron **Thu 13:00 UTC** + on-demand (`gh workflow run refresh.yml`). ~$1–2/run. Dispatch race caveat
  still applies (confirm `headSha` matches after a fresh push).
- **Keys set:** `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, `ANTHROPIC_JUDGE_MODEL`. **Pending:**
  `SERPER_API_KEY` (Google-Images candidates, wired + dormant), `HEALTHCHECK_URL` (ping, wired + dormant).
  **Declined for now:** Ticketmaster (Ness: variety > ticketing spine).
- **Last good feed: 2026-07-04** — 72 picks, 49 live, 9/9 categories; 4 👑 TOP escalated to deck-lead,
  3 fatigue-benched (rested until 25 Jul), 19 vetoed, 14 ★-floored + 22 carried forward.

## Evergreen canon
~149 hand-authored picks in the pool (the board's canon library ≈ 141 after the veto filter). Two
halves: the V.6.4 fill-in (`picks.evergreen.ts`: markets, day-trips, music venues) + **`picks.canon2.ts`
(V.7.16→): 25 places Ness +CANON-approved on the board** (De Kas, Droog, Rush Hour, Red Light Records,
REM Eiland, Tacite, Le Petit Bouillon, Fyka… — image-verified, `stars` carried). `export-canon.ts`
dumps the pool to `data/canon.amsterdam.json` on every build (applying the veto), so the board's library
can't drift from code or show killed rows. Canon = the imaged floor + search surface.

## Taste Engine (the closed loop)
Curation Board (`/curate/`) → **Submit → GitHub issue** → Claude compiles → ship → close. Verdicts land
in `scripts/taste/corpus.json` (rules + anchors + veto + starredKeeps + **rested** + **topPicks**) +
`taste/weekly.json` (LEAD/LATER slate) + `taste/scouted.json` (fresh finds) + `picks.canon2.ts` (canon)
→ injected into the Sonnet editor judge + vision prompts every run. **Five rounds compiled** (R1–R3:
86 + 115 + 81/84 verdicts · R4 = issue #10 · R5 = issue #11's 73-verdict all-stars confirmation sweep,
plus the four LOST #8/#9 verdicts late-compiled in V.9.8 — the lesson: close issues on compile, an
open one means unread). Veto/keeps/rested/top all match with WORD BOUNDARIES (refresh.ts `rxOf`). Signals
that shaped the corpus: R2 — 20 generic club nights killed while BRET/POISED passed → "curatorial
identity" rule. R3 — **★4+KILL = fatigue, not hate** → the `rested` tier (bench, then return); the
organ-concert veto REVERSED (community-authentic wins). The pipeline stamps `top`/`lead`/`rested` and
GUARANTEES topped/led picks into the feed (pull-back from prePool/canon if the balancer cut them).

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
7. **Offered, not built — scheduled auto-compile:** a cron agent could pull the week's `curation`
  issues, compile, and ship unattended. Ness leaning keep-me-in-the-loop until the corpus feels
  settled (he sees each taste call reasoned through); revisit once stable.
8. **Two open judgment flags from R3/issue #3:** (a) ARTIS — his ★5/TOP was on the weak bench
  "ARTIS-Aquarium" card; routed to the canon "ARTIS Royal Zoo" entry (offer: build the aquarium its
  own card if he wants it). (b) Future-festival TOPs (Milkshake, Dekmantel) lead the deck NOW though
  they're late-Jul — offer to gate TOP activation to the event's own weekend.

## Doc map
`backlog.md` (strategy) · `pipeline-architecture.md` (north star/roadmap) · `source-map.md` (source
registry) · `pipeline-redesign.md` (the 5-problem deep-dive) · `moat.md` · `discovery-direction.md` ·
`content-pipeline.md` · `jtbd-analysis.md` · `market-scan-2026-06.md` · `mom-test-interviews.md` ·
`validation-log.md`.
