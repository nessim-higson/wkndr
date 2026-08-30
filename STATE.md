# WKNDR — STATE (catch-me-up snapshot)

_Living "where are we right now" doc — a **snapshot, not a history**. **Updated 2026-08-30.** Read this
FIRST in a new chat. For strategy + backlog see `docs/backlog.md`; for the pipeline architecture see
`docs/pipeline-architecture.md` + `docs/source-map.md`; for **who may write to the deck vs to a personal
profile** (board / Tune / airlock — read before touching either) see `docs/curation-surfaces.md`; for the
**board roadmap** (auto-compile tracks) see `docs/board-roadmap.md`; for full **version history** see
`CHANGELOG.md` (current to app **V.11.8** / board V.9.46) and the **git log / tags**. Onboarding:
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
> The **reason→action routing table is now SHIPPED** (board V.9.26) and lives in
> `docs/board-roadmap.md` Track B: every ✕ chip carries a `kind` — `fix` (stays live) / `rest`
> (`corpus.rested {match,until,note}`, carries a REAL return date from the board) / `veto`
> (`corpus.eventVeto`) / `other` (free text). **When compiling: a `REST until <date>` line is NOT a
> kill** — write it to `corpus.rested`, never `eventVeto`. Next per the roadmap: light polling so open
> sessions update (today it's on load).

## Live right now
- **V.11.8 — NO FLASH OF THE WRONG SKY (2026-08-30).** Boot seeds mode+wx from the `wkndr.lastwx.v1` cache (written by goLive, 12h cap, season-guess fallback — never HOT) so a reload opens on the last real weather instead of flashing the amber demo field. What-if pills don't write it.
- **V.11.7 — RAIN SAYS SO + THE EVERGREEN SHELF (2026-08-30).** Field feedback on a 20°/100%-pop
  drizzle Sunday. (1) `classify`: **pop ≥ 80 → COLD_WET at any temperature** (was VOLATILE for
  warm rain — the "sun then storms" field over an actually-raining sky); COLD_WET's copy is now
  **"Rainy"** — the temp beside it carries the cold/mild nuance. Board's inline `cls` mirror
  updated in lockstep — KEEP THEM IN SYNC. (2) Header shows a **droplet** beside any wet day's
  temp; the card peak pill reads **"Perfect for a rainy day"** when the live mode is wet.
  (3) **The evergreen leak:** `effectiveFreshness` now re-files UNDATED 'weekend'/'ending' as
  'always' — "this weekend" is a claim that requires a date (Foodhallen "Daily" was serving as a
  weekend find forever). One rule, three surfaces (refresh/restamp/app). (4) **Board V.9.46:**
  Simple's tail splits into "Up next — this weekend" vs **"The evergreen shelf"** (live ratio:
  20 vs 64 — the mix that read as stale). Same PILE underneath; Submit unchanged. Restamped on
  ship (105→93, weekend 28→17). A pre-ship board session may hold a stale localStorage pile —
  **↺ Reset to the system's order** fixes it in one tap. **341 tests.**
- **V.11.6 — THE SCORED INBOX (2026-08-30, Workstream 2).** The daily poll's candidates now arrive
  scored and ordered: `scripts/lib/score.ts` (novelty-decay top-weighted + buzz + RA draw capped
  below novelty + dated/weekend, × corpus-affinity MULTIPLIER), weights in `taste/weights.json`,
  env-overridable via `WKNDR_WEIGHTS` (JSON blob, no commit needed). Every pick carries
  `inboxScore` + `scoreWhy` (the receipt). Board (V.9.45): **"Fresh from the sources"** section in
  NEW FINDS — inbox cards through the standard `addCard`, so ★/✕/👑/+CANON ride Submit unchanged
  (★ teaches the corpus → Thursday admits+boosts; ✕ vetoes for good). Fixed on the way: ingest now
  applies `eventVeto`/`rested` (10 of 31 first-inbox items were already-killed events re-entering
  daily) + RSS numeric-entity decode. **Engagement velocity deliberately NOT in the score** — no
  data source until Meta business_discovery; layer it in with the watchlist poller. The brief's
  force-rank + zero-input guarantees already existed (WEEKEND PILE `pilePos`; V.11.3 publish bar) —
  mapped in `docs/ingest.md`. **338 tests.**
- **V.11.5 — THE DAILY POLL (2026-08-29, Workstream 3).** Ingest now runs DAILY (`ingest.yml`
  05:30 UTC → `scripts/ingest.ts`): keyless only (new RSS floor: Het Parool PS + Subbacultcha +
  Amsterdam Foodie, all live-tested; + I amsterdam + RA), zero API spend, never touches the served
  feed. Writes three files: **`seen.<city>.json`** (the seen registry — titleKey → first-seen DATE;
  now the authority behind `firstSeen`, min-date merge shared with refresh via
  `scripts/lib/ingest.ts`), **`inbox.<city>.json`** (fresh finds not in feed/airlock/bench —
  Workstream 2's future force-rank feedstock), **`ingest-health.<city>.json`** (per-source yields,
  daily + weekly in one dashboard; source quiet 3 runs or inflow < 3 → amber `#ingestbar` strip on
  the board). Time Out on the LLM lane (no feed); r/Amsterdam + 3voor12 tested and REJECTED —
  don't re-wire without a fresh live test (`docs/ingest.md` has the method). IG watchlist scaffold
  at `scripts/taste/watchlist.json` — polling gated on Meta business_discovery (Ness-side: Meta
  app + IG Business account). Async drop queue deferred with reasoning. **327 tests.**
- **V.11.3 — AUTO IS THE DEFAULT (2026-08-29).** The airlock, inverted. V.11.2 fixed what picks were
  LABELLED; this fixes which picks there ARE. Ness after three untouched weeks: the app should
  auto-populate fresh every week, vetted against the sources, with the board as the adjustment layer
  on top. **It was built on the opposite law.** `approvalCheck` was an ALLOW-LIST — a live pick
  shipped only if it matched something he'd already approved — so zero curation meant zero new
  content, structurally. The crawl was never the problem: 2026-08-27 pulled **227 picks, 95 genuinely
  new, and published 25**; the feed carried 90% → 83% → **99%** week over week and Kaap Amsterdam led
  four Saturdays running.
  - **`publishCheck` (scripts/lib/pipeline.ts) — block-list + junk floor.** Vetoes/rests still kill;
    what survives ships if it clears the judge OR if Ness called it. Approval still admits, it just
    no longer has to. **`JUDGE_FLOOR` = 5**, env-tunable (`WKNDR_JUDGE_FLOOR`), measured against the
    real airlock: 31 of 78 held picks publish, bottom 47 cut.
  - **`Pick.judgeScore`** — the bar needs a score approvals don't write. `editorScore` is the RANKING
    score (★ floors it to 8, 👑 sets 10); `judgeScore` is the judge's own verdict, never overwritten.
    All 25 published live picks were ★-floored — **not one earned its score** — so gating on
    editorScore would have been circular.
  - **Crowns expire weekly** (`crownsActive` + `corpus.topPicksWeekend`). Same law as weekly.json's
    slate, which always expired correctly; topPicks never did, so 31 July's crowns still led on 29
    Aug. Fails closed — a compile that forgets the stamp ships INERT crowns and logs it. **Every
    compile that sets 👑 must stamp `topPicksWeekend` with the Saturday it is for.**
  - **Carry-forward is now a time-critical rescue** (must be dated this weekend), not the weekly
    resurrection of every undated evergreen ★.
  - **restamp publishes through the same bar** so the fast path can't demote what Thursday shipped.
  - **`docs/curation-surfaces.md` carries a dated doctrine revision** — the 1:1 airlock law is
    retired, §5 (only Ness writes to the corpus) is untouched. Read it before "restoring" the airlock.
  - **V.11.4 (same day): the ★ floor is now a BOOST** — `editorScore = min(10, judgeScore + STAR_BOOST)`
    (STAR_BOOST=2, env-tunable). Canon starred = baseline 6 → lands 8, exactly what the floor gave it,
    so the hand-curated library doesn't move; live starred picks scale with the judge. Stale baked 👑
    now CLEAR in both publishers (recompute, not accumulate). restamp stamps judgeScore on promotion.
    Feed regenerated same day via refresh.yml's manual trigger. **318 tests.**
- **V.11.2 — NEW THIS WEEK NOW MEANS THIS WEEK (2026-08-29).** The freshness fix. `New this week`
  was serving weeks-old content after a quiet stretch, and the cause was NOT backfill — **the `new`
  label had no expiry at all.** `freshness` is a bare enum written by whoever touched the record last
  and nothing ever took it back, so all three picks in the bucket were immortal: `east-beach` +
  `de-pimpelmees` are CANON tagged `'new'` since the day they were typed, `web-scout-two-story` is a
  scouted find (`scouted.ts` stamps `'new'` unconditionally) with no date — and `refresh.ts`'s
  date-derived correction opens `if (!isLive(p) || !p.when) continue`, skipping canon and the undated
  entirely. Exactly those three.
  - **`src/lib/freshness.ts` splits the CLAIM from the RECORD.** `freshness: 'new'` stays a claim
    about the world (only a source/scout/human makes one). New **`Pick.firstSeen`** is our record of
    when it started — stamped the first run a title appears, carried forward untouched forever.
    `effectiveFreshness()` honours the claim for `NEW_DAYS = 10`, then falls back to the DATES:
    `weekend` if the pick still has one, `always` if not. **Demote-only** (crawled-first-time ≠
    new-in-Amsterdam, and a weekly refresh meets dozens of first-time titles) and **fails closed**
    (no record = no claim — absence of evidence is why the old bucket never emptied).
  - **Applied at BUILD and at READ time, deliberately.** `refresh.ts` + `restamp.ts` keep the
    published record honest for every consumer (/geo, the poster, the board); `App.tsx` re-derives at
    ingestion so **the label decays on the CALENDAR, not on the cron** — a refresh that silently
    stops can no longer freeze the bucket. The weekend ships whether or not anyone shows up.
  - **The transition trap.** Legacy picks (all 78) predate `firstSeen`. Crediting them with the prior
    feed's `generatedAt` looks like the honest backstop but bounds their AGE, not their arrival — it
    would have put both immortals inside the window and handed them one more week of New. They are
    left UNSTAMPED and fail closed. Stamping today would declare the whole feed new. The airlock
    (`pendingOut`) is stamped too, or restamp's mid-week promotions expire on contact.
  - **The "backfill" was a recycle loop:** `refresh()` cleared `swiped` when the deck was nearly done
    WITHOUT checking `filterActive`, and a 3-pick bucket is nearly-done on arrival — every Shuffle
    re-dealt the same three. In a filter, "more" now only means "more that match".
  - **Empty state needed no design** — `WHEN_FILTERS` already drops a `count === 0` option, the same
    law /geo uses for districts. The When sheet now reads Any time 76 · This weekend 9 · Evergreen
    67/20/24, with no New this week, because there genuinely isn't any.
  - **THE FILTER STRIP IS FLUSH TO THE NAV.** It was never offset — measured dead centre and 27px
    wider (13.5px of overhang per side, the near-miss zone, with the active pill's glow reading as a
    leftward shift). Now shares `--module-w` with `space-between`: outer chips ON the capsule's edges,
    0.00px on desktop and on a 375px phone. **Cost: the carets.** Three chips only fit inside 340px
    without them; the axis ICON survives (it says which control), `aria-haspopup` carries "this
    opens" for screen readers. To reverse, widen `--module-w` to ~380px instead.
  - Full audit — including **three Workstream-1 tasks that were already built** (request-time weekend
    anchoring, read-time expiry, the `corpus.rested` cooldown) — in `docs/pipeline-freshness.md`
    **Part II**. Guarded by `tests/freshness.test.ts`; **309 tests**.
- **V.11 — WHERE COMES TO THE FACE (2026-08-03).** The whole-version roll. Two changes, one
  thesis: **the filters people never found are now ON the deck, and one of them is location.**
  - **THE FILTER STRIP.** `When × What × Where` moved OUT of the ≡ menu onto the face
    (`.filterstrip` under `</header>`, browse-mode only — saved/shared are fixed lists). Ness's
    call, against the recommendation to keep them in the menu: a filter nobody finds is a filter
    that doesn't exist, and the field proved it (a Noord user asked for location filtering the
    app already half-had). Nothing replaces the group in the menu — a control in two places is a
    control you can't trust. **Consequence: the undo pill moved BACK to the bottom** (now floating
    ABOVE the ✕/★ row, not on it — the original sin that got it evicted in V.10), and its motion
    flipped to rise from below.
  - **THE WHERE SHEET.** Same `FilterSheet` component as When/What (it gained `lead`/`note`/`hint`
    slots) so there's no new UI grammar. **Near me first** is a SORT and sits above a rule;
    **districts** below are counted filters. **The counts are cross-axis** — pin `This weekend`
    and Noord's chip drops from 7 to 1, because that is the truth (see the pool-shape constraint
    in the /geo entry). Districts that hold nothing under the current filters are dropped, not
    shown as 0.
  - **THE EVERGREEN ESCAPE.** Where × a dated When empties nearly every district, so that
    dead-end now offers what IS there, by name and count — *"Show all 6 in Noord"* — clearing the
    WHEN axis and keeping the Where. You asked to be in Noord; you only implied you wanted a
    ticketed event. This is the answer to "should there be a THIS WEEKEND toggle?": **no** — a
    weekend-only gate on top of a district gate is how you serve an empty deck.
  - **`src/lib/geo.ts`** — the geo layer, promoted from the /geo prototype to a real tested module
    (25 tests, 272 total). Name-keyed gazetteer → district centroids (marked `≈`) → honestly
    `unknown` (no distance shown, sorts last — **we never guess a place**). Haversine ×1.3 @
    15 km/h + the IJ ferry model, rounded UP to fives. `nearScore` is a **ranking weight capped
    under the +10 weather term**, applied before `orderServed`, so weather stays the thesis and
    👑 TOP / ▲ LEAD / the hand pile still lead the deck by law. `Pick.lat/lon` are optional and
    PREFERRED when present — the day the cron stamps coords (open item 8), the gazetteer becomes
    a fallback and nothing else changes.
  - **One permission, both jobs:** `goLive()` now also sets the distance origin, so the existing
    "Use my location" grant feeds the forecast AND every distance. Toggling near-me without a
    grant asks for one.
- **READ THE LISTINGS (board V.9.35, 2026-08-03) — LIVE, key is set.** **Two carousel shapes:** a
  `listing` (DAY/NIGHT dated agenda — 93 events off one post, NO images: the slide is a wall of text)
  and a `feature` ("Amsterdam's best eats", ONE dish per slide — 8 events, and the slide PHOTO becomes
  the card image). The reader classifies each slide (`cover`/`listing`/`feature`) before reading it;
  the first version only knew listings and returned 2 events from a 10-slide feature post. A read of
  >20 events starts UNTICKED (93 pre-ticked was one click from 93 cards). **What it does:** accounts like **@doubleamagazine** post a weekly Amsterdam
  events carousel with the listings **typeset into the slide images** — the caption has none of them,
  so a plain drop got one card and lost ~20 events. A carousel drop now offers **"📖 Read the N
  slides"**; each listing returns as a tickable row grouped under its printed day heading, and each
  ticked row becomes its own card. **The hard-won bit:** `/media/?size=l` only ever returns slide 1
  and ignores index params, the embed endpoint is dead, and yt-dlp (which does resolve children) is a
  binary that can't run in a Worker — **Instagram server-renders the full carousel JSON ONLY for a
  Googlebot UA**. The parse MUST be scoped to the `carousel_media` array (bracket-matched,
  string-aware): the page also embeds the account's other posts in the same `"code"/"display_uri"`
  shape, and an unscoped parse returned 20 "slides" for an 8-slide post. Vision reads the **full
  1080px** slide — NOT `display_uri` (512×640) and NOT the wsrv portrait render (`fit=cover` crops
  text off). Prompt handles DAY/NIGHT headers (kept as `part`), wrapped venue lines, ragged `|`
  spacing, and returns `[]` for a cover slide. `worker/curate/src/roundup.ts`, `POST /drop/read`,
  12-slide cap, model via `ANTHROPIC_VISION_MODEL` (default `claude-sonnet-5`). Guarded by
  `tests/roundup.test.ts` against a real captured page with the decoy posts still in the fixture.
- **THE DROP BOX (board V.9.32, 2026-08-02)** — paste an Instagram / TikTok / X post link into the
  field at the top of Simple, hit **Pull**, and the pick comes back with its picture and caption in
  ~1s. This closes the long-running content blocker: every pipeline source is a crawlable site, and
  the events Ness actually spots are on Instagram. **No login, no API key** — the Worker reads the
  OpenGraph tags Instagram serves link-preview bots (`facebookexternalhit` UA → `og:description`
  carries likes/comments/author/date/caption). **Full-res is the hard-won bit:** `og:image` is a
  ~640px preview (360px on a reel) that would trip the low-res gate, and the CDN size token is
  signature-covered so it can't be rewritten up (403) — **`/p/<code>/media/?size=l` redirects to the
  NATIVE 1080px image**. Images are `toPortrait()`-wrapped through wsrv (IG's CDN refuses hotlinked
  browser requests — unwrapped renders blank on BOTH board and card). Worker: `POST /drop`
  (`worker/curate/src/extract.ts`); board: `#dropbox`; a drop becomes an `extras` entry marked
  `_drop`, lands at **slot #10** of the Top 10 (same as any New Find — drag it up to lead), and rides
  Submit twice: the fast-lane `added` array AND a `DROPPED IN` line in the GitHub issue.
  **`applyOverrides` now ADDS, not just filters** — pile/killed/flags re-stamp picks the app already
  has, but a pasted pick isn't in the static feed, so drops travel with their own content and are
  injected client-side (deduped vs the feed, skipped if cancelled that round, orderable by the pile).
  Id prefix `drop-` sits deliberately outside the airlock's `web-`/`llm-`/`rss-`/`sk-` audit: a
  hand-paste IS the approval. Guarded by `tests/drop.test.ts` (real captured IG strings — the
  escaped-`&amp;` "Bad URL hash" trap, the truncated-caption-with-no-closing-quote trap).
  **Auto-watching accounts is NOT built:** scraping profiles is shut (logged-out profile = 604KB
  shell, zero post links; public RSS bridges 403). The working route is Meta Graph
  **business_discovery** — free + sanctioned, Business/Creator accounts only, needs a Meta app + a
  WKNDR IG Business account. Deferred until the paste path shows which venues deserve a cron.
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
- **THE WEEKEND POSTER (2026-07-30)** — a shareable 1080×1350 graphic of the top 5, regenerated on the
  same cron as the content: **https://app.wkndr.xyz/share/weekend.png** (stable) + `/share/<sat>.png`
  (dated archive). `app/scripts/poster.ts`, `bun run poster`. Renders with **puppeteer-core against the
  SYSTEM Chrome** (the brand woff2 faces need a real browser; puppeteer-core ships no binary, and CI
  runners already have Chrome). Content = the deck's own front (pilePos → servePos), carries the
  per-day weather, and drops a `venue` that's really the source name. Wired into refresh.yml +
  restamp.yml as `continue-on-error` — it must never block a content publish.
- **PER-DAY WEATHER (V.10.18, 2026-07-30)** — the deck used to rank every pick against ONE mode
  blended across Sat+Sun (`Math.max` in both `weekendMode()` and `goLive()`), so a Sunday-only picnic
  was judged by Saturday's sunshine. `lib/when.ts whenWeekendDays()` now says which day a pick is on;
  `rankPicks` takes `Mode | {sat,sun}` and scores each pick against ITS day (all-weekend picks take the
  best of the two); `stampServeOrder` uses the new `weekendModes()`. The blend is KEPT as the summary
  (ambient field + every single-mode surface). Surfaced only when `daysDiffer` — header reads
  "Sat 27° · Sun 14°", and `tempForPick` prints a dated card's OWN day. Board V.9.30 mirrors it.
- **/GEO — THE HYPER-LOCAL PROTOTYPE SURFACE (geo G.1, PR #23 MERGED 2026-08-02).** **LIVE on
  GH Pages — https://nessim-higson.github.io/wkndr/geo/**; `app.wkndr.xyz/geo/` needs the manual
  wrangler domain deploy (`bun run build:domain` + `wrangler pages deploy`), Ness-only. Field feedback
  (a friend in Noord: location should filter more accurately) answered as a SEPARATE surface on the
  curate-board pattern: `app/public/geo/index.html` ships inside the app build, **reads the LIVE feed**
  (`data/picks.amsterdam.json`, dealt in `servePos` order, real wsrv posters + credited link-outs,
  Open-Meteo weekend temps), writes nothing — the MVP app at `/` untouched. The laws: **near-me is a
  SORT, never a gate** (far picks sink, don't vanish) · **districts are counted filters** ("Noord · 7"
  makes pool thinness visible instead of silently serving an empty deck) · **the event stays the story**
  (getting-there is the detail's quiet last line). Geo = an in-page NAME-KEYED venue gazetteer (62/80
  of the current feed pin; day-trips parse their travel time from the area string; generic "Amsterdam"
  areas stay honestly unmapped and sink) + haversine ×1.3 @ 15 km/h with an explicit IJ ferry model
  (Buiksloterweg/NDSM, half-headway wait), rounded UP to fives; "My location" = real geolocation, with
  Centraal/Noord preset viewpoints. The undo pill sits at the BOTTOM on this surface (the pinned filter
  tabs own the top — the collision Ness spotted). Design record: `experiments/11`–`14` (placement
  comps → clickable prototype → fork → real-feed). **Follow-up is pipeline-side, not UI** (open item 8).
  **THE POOL-SHAPE CONSTRAINT (measured on the 2026-07-30 feed, 80 picks) — read before adding any
  "this weekend only" filter:** the feed is **58 evergreen / 18 weekend-dated / 3 new / 1 ending**, and
  the dated events cluster hard in the centre. Per district, dated-this-weekend vs evergreen:
  **Centrum 5/27 · Zuid 4/7 · Noord 1/6 · West 1/5 · De Pijp 1/3 · Oost 2/2 · Day-trip 0/7.**
  So **Where × This-weekend-only multiplies down to 0–1 picks for every district except Centrum** —
  the two filters must never both hard-gate. The evergreen half is what makes hyper-local viable at
  all (Noord's answer on a 27° Saturday is Pllek, not a dated event), so a weekend-only control belongs
  as a **sort/emphasis with live counts that update as the other axis changes**, never a silent gate.
- **App: V.10.18** — https://app.wkndr.xyz (cache-bust `?v=V.10.18`; GH-Pages mirror at
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
  **Curation Board (board V.9.31, redesigned 2026-07-22→23):** https://app.wkndr.xyz/curate/ (or the
  door `app.wkndr.xyz/?curate2026!` → board on a laptop, Triage deck on a phone; GH-Pages mirror also
  live). Ness's core feedback drove a rebuild: **Helvetica everywhere, dead-simple, one ranked deck.**
  **V.9.25 (2026-07-30) closed two gaps Ness hit:** (1) the board had **no expiry guard** — it rendered
  the feed as-is, so a week-old feed still showed last weekend's picks (Milkshake & co. holding serve
  slots #2/#4/#5/#6); it now mirrors `lib/when.ts` (`isOver`/`looksBroken`/`servable`) and culls once at
  the feed seam, reporting the dropped count in the header. The APP was always correct here — it filters
  `whenIsPast` — so the board was the only surface lying. (2) the **✕ reason picker existed only in
  Advanced** while Simple is the default, so on the working screen a card couldn't be cancelled at all;
  ✕ + the six chips are now on every Simple card, and a kill lands in BOTH views + the Submit payload.
  **V.9.26 (same day) added the verb the picker was missing:** a cancel can now be a **REST** —
  "not on right now" → *Back when?* (in 2 weeks · next month · in 2 months · in 3 months · or a date)
  → `corpus.rested`, so **IJ-Hallen** (runs ONE WEEKEND A MONTH) retires until it's actually on
  instead of being vetoed or opening the deck on a dead weekend. Plus **"something else…"**, a
  free-text escape hatch for reasons not on the chip list. Both views now share ONE `wireReasons()`.
  **V.9.27 inverted the ✕ flow:** the verdict used to BLOCK the removal (✕ opened the picker, card sat
  there until classified), so triage stalled on every card. Now **✕ cancels on the spot** — one click,
  gone — and the pick waits on a **Cancelled this round** shelf (`#cancelbox` in Simple, `#cancelbox2`
  in Advanced, one `renderCancelled()`), where the chips live. Reason is OPTIONAL (no reason = a plain
  KILL); **↩ Put back** undoes into the ORIGINAL slot (cancelled titles stay in `PILE`, filtered at
  render + stripped from the payload); a `fix` reason returns the pick LIVE and flagged.
  Guarded by `tests/board-dates.test.ts` (board↔app date parity + the ✕ vocabulary contract, both
  extracted from the HTML itself).
  Now a **Simple / Advanced toggle** (`#modetoggle`):
  - **SIMPLE (default) = the ONE ranked deck.** "Your top 10 — the cards that open the deck" (numbered,
    drag ⠿ to reorder, − to demote, **✕ to cancel + say why**) + **"Up next"** (the rest, auto-ranked, but
    a DRAGGABLE row list — ↑
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
- **Frozen reference builds:** **`/wkndr/versions/v10-19/` (tag `v10.19`) — THE V.10 FREEZE, cut
  2026-08-03 as the rollback/compare point before the V.11 face-toggle work** (app V.10.19 + board
  V.9.38 + geo G.1, the whole V.10 line as it stood; 247/247 tests green at the cut). Also
  `/wkndr/versions/v6-2/` (tag `v6.2`) and `/wkndr/versions/v4-10/` (tag `v4.10`).
  **Re-cutting one:** `npx vite build --base=/wkndr/versions/<slug>/ --outDir dist-freeze` then copy
  into `versions/<slug>/` — the base MUST match the serve path or every asset 404s.
- **Ship loop:** `cd app && bun run bump` → `bun run build` → commit → push (auto-deploys GH Pages) →
  reply with the `?v=` link. **The two wkndr.xyz surfaces deploy AUTOMATICALLY on push** — `deploy.yml`
  grew a `cloudflare` job that wrangler-deploys BOTH Pages projects (`wkndr-app`, `wkndr-landing`)
  on every push to main, alongside the GH-Pages job (verified green 2026-08-16; this doc said
  "manual wrangler" long after it stopped being true). Manual `npx wrangler pages deploy` still
  works as a fallback (wrangler stays authed on this machine). Verification caveats: bare-URL curls
  may hit stale edge cache — bust with a query param — and `/curate/index.html` 308-redirects on
  Cloudflare, so curl WITHOUT `-L` returns empty; check `/curate/?v=...` instead. The board
  (`app/public/curate/index.html`, bumped via its own `BOARD_V` const + eyebrow) ships inside the app
  build. **Tests:** `bun run test` (**296 logic tests**; CI runs them before every content refresh).
  **Pages deploy flakes** intermittently ("try again later") — re-dispatch `deploy.yml` (there's an
  auto-retry pattern in the ship watchers).
- **Compile fast-path (no crawl):** `cd app && bun run scripts/restamp.ts` re-applies the taste layer
  (veto/rested/topPicks/starredKeeps/weekly pile) to the LAST PUBLISHED feed in ~90s — the way a
  board round or a `weekly.pile` change ships without a full `refresh` (which needs API keys + ~15min).
  **The `wkndr-curate` worker** is deployed separately: `cd worker/curate && npx wrangler deploy`
  (source in-repo, KV id `ea7216a7…` in `wrangler.toml`). **Every worker POST requires
  `X-Curate-Key` since board V.9.44** — the fast-lane write, and worse the `added` array (inject
  arbitrary cards into the live deck), were open to anyone who read the board's public JS (PFD-audit
  finding, 2026-08-16), and `/drop/read` burned the Anthropic key unauthenticated. The secret is
  `CURATE_KEY` (wrangler secret — value NOT in the repo, Ness holds it; rotate with `npx wrangler
  secret put CURATE_KEY`); the board prompts once per browser, keeps it in localStorage
  (`wkndr.curate.key`), and re-prompts on 401 so a rotation self-heals. GET stays public — the app
  reads overrides keyless. Secret unset = everything open (fresh-deploy grace, the
  `ANTHROPIC_API_KEY` pattern). Guarded by `tests/worker-auth.test.ts`.

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
8. **Geo, pipeline-side** (the /geo follow-up, PR #23): stamp venue lat/lon at build time — `ra.ts:82`
   hardcodes `area:''` while the GraphQL already returns `venue.area{name}` (one-line capture);
   `iamsterdam.ts` has `location.address` (+ often `geo`) in the JSON-LD it already parses; PDOK
   Locatieserver (keyless, best-in-NL) geocodes the rest on the cron into a cached
   `venues.amsterdam.json` gazetteer — then /geo (and later the app) reads coords off the feed instead
   of its in-page map. Same sweep: `iamsterdam.ts:109` hardcodes `kid:false` — map its family category
   namespace so the Kids lens sees the live feed (16/80 kid picks today come only from LLM sources).
9. **Two open judgment flags from R3/issue #3:** (a) ARTIS — his ★5/TOP was on the weak bench
  "ARTIS-Aquarium" card; routed to the canon "ARTIS Royal Zoo" entry (offer: build the aquarium its
  own card if he wants it). (b) Future-festival TOPs (Milkshake, Dekmantel) lead the deck NOW though
  they're late-Jul — offer to gate TOP activation to the event's own weekend.

## Doc map
`backlog.md` (strategy) · **`takeovers.md`** (2026-07-28 night memo — guest curators, slot-based
weather, stickiness, model tasking; advances `curation-surfaces.md` §5 from parked to planned) ·
`pipeline-architecture.md` (north star/roadmap) · `source-map.md` (source
registry) · `pipeline-redesign.md` (the 5-problem deep-dive) · `moat.md` · `discovery-direction.md` ·
`content-pipeline.md` · `jtbd-analysis.md` · `market-scan-2026-06.md` · `mom-test-interviews.md` ·
`validation-log.md`.
