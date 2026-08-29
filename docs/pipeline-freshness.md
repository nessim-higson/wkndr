# WKNDR — why the feed feels stale, and how to fix it

_2026-06-14. Diagnosis after Ness found fresher Amsterdam events in ChatGPT/Google
(Open Garden Days, Bite of Amsterdam, Bacchus Wine Festival, Holland Festival, Phantogram
+ Celeste gigs) than WKNDR surfaced for the same weekend._

## The complaint (real, measured)

- The feed is ~90% a fixed evergreen library (84 of 93 picks "always good"; only ~9 dated).
- Week over week, ~87 of 93 picks were identical — only ~6 swapped.
- The genuinely-fresh weekend events that competitors surface instantly do not appear.

V.5.2 added weekly rotation of the evergreen slice (band-aid for the bulk). This doc is
the deeper fix: **the pipeline can't actually SEE most fresh dated events.**

## Root cause — proven by a live raw-fetch test (the exact thing the pipeline does)

| Source | Raw fetch result | Verdict |
|---|---|---|
| I amsterdam `/whats-on` | 643 KB HTML, but "Open Garden Days"/"Bite of Amsterdam" = **0 mentions** | listings are JS/API-rendered → scrape gets nav + boilerplate |
| Songkick metro page | **0 bytes returned** (anti-bot block) | no gigs ever come through |
| Your Little Black Book | content present ("weekend" ×75) | scrapeable — BUT see char cap below |

Three compounding causes:

1. **Static-HTML scrape of JS-rendered pages** (`scripts/adapters/llm.ts` does a plain
   `fetch()`). The most important calendars (I amsterdam, Songkick, Kidsproof) render
   events client-side, so the fetch sees an empty shell. *This is the core gap — and it's
   exactly why ChatGPT/Google win: they search the live web; WKNDR reads fixed URLs' raw
   HTML.*
2. **8,500-character cap** — `htmlToText(html).slice(0, 8500)`. Even content-rich pages
   (LBB) get truncated to the top-of-page nav/boilerplate before the events. (Can't just
   raise it — the low-tier Anthropic account caps ~10k input tokens/min; the rate gate
   already runs near that. Raising the cap needs smarter extraction, not just more chars.)
3. **No live gig feed** — Songkick is blocked and `SONGKICK_API_KEY` is unset (Songkick's
   public API is also largely closed now).

Plus the timing bug (now fixed):

4. **Monday cron was too early.** LBB's weekend agenda + I amsterdam's weekend curation
   publish mid-to-late week (Wed–Thu). Monday 06:00 predated them. **Fixed → Thursday
   13:00 UTC** (catches the guides, keeps Fri–Sun planning lead).

## Source cadence (the "when do they publish" answer)

- **Your Little Black Book** — weekly agenda, weekend guides land **Wed–Thu**.
- **I amsterdam** — rolling/continuous; weekend curation firms up Wed–Fri, but API-walled
  so timing alone won't crack it without rendering or search.
- **Gigs (Songkick/Bandsintown)** — real-time; need an API or web search, never a scrape.
- Exact publish hours still want ~2 weeks of observation to nail. Optional: log per-source
  yield each run and watch when LBB/I amsterdam light up.

## The real fix (recommended) — web-search-grounded extraction

Give the LLM extractor the **web_search tool** (Anthropic server tool) and prompt it to
find "what's on in {city} the weekend of {dates}", extracting structured Picks with the
**real source links the search returns**. This is the ChatGPT/Google approach and it is:

- **Source-agnostic** — catches festivals, gigs, openings, free/outdoor, closing-soon, all
  at once, without per-site scraping or rendering.
- **Current** — sees what was published this week, not a stale static shell.
- **Cheap** — Anthropic web_search ≈ $10 / 1,000 searches + tokens. WKNDR does ~16
  source-calls/week; even 2 searches each ≈ ~$0.30/week. Negligible.
- **Link-safe** — links come from real search results, not guessed slugs (keeps the
  signal-+-link, never-republish model; still write our own blurbs).

Keeps the keyless RSS + canon floor as backup. Contained change to `scripts/adapters/llm.ts`.

### Complements (smaller)
- **Songkick/Bandsintown** for clean real-time gigs — web search likely covers this, so
  only worth a dedicated adapter if gigs need to be exhaustive.
- **JSON-LD extraction** — some pages embed `<script type="application/ld+json">` Event
  schema even when the visible list is JS-rendered; cheap to parse when present.
- **Smarter HTML slice** — strip nav/header/footer and prefer the events region before the
  char cap, so the 8,500 budget spends on events not chrome.

## Status
- ✅ Weekly evergreen rotation (V.5.2).
- ✅ Cron Monday → Thursday.
- ◻ Web-search-grounded extraction — **recommended next; awaiting go (tiny recurring cost).**
- ◻ JSON-LD / smarter slice / gig feed — follow-ons.

---

# Part II — why "New this week" was never about this week

_2026-08-28. Audit + fix, from the freshness/auto-curation handoff brief. Part I above is about
the pipeline not SEEING fresh events. This part is about the app mislabelling what it has._

## The complaint

Three weeks without a curation session, and the "This weekend" tab's **New this week** filter
still served content weeks old. Suspected cause in the brief: the bucket backfills with
next-newest content when it runs dry.

## What was actually happening

**Not backfill.** Two separate mechanisms, both worse than backfill because both are silent.

### 1. The bucket could not empty

`New this week` is `p.freshness === 'new'` — a bare enum written onto the record by whoever
touched it last, with nothing anywhere that ever took it back:

| Where `'new'` is stamped | Taken back by | Result |
|---|---|---|
| `src/data/picks.ts` (canon, hand-authored) | nothing | `east-beach`, `de-pimpelmees` — `'new'` since the day they were typed |
| `scripts/adapters/scouted.ts` (every scouted find, unconditionally) | nothing | `web-scout-two-story` — undated ("Now open · daytime"), so immortal |
| `scripts/adapters/llm.ts` / `websearch.ts` (model's own tag) | `refresh.ts` date rule | only when the pick has a parseable date |
| `src/lib/overrides.ts` (every Drop Box paste) | nothing | immortal |

`refresh.ts` DOES correct freshness from real dates — but the loop opens with
`if (!isLive(p) || !p.when) continue`, so it skips canon entirely and skips anything undated.
Those are exactly the three picks in the bucket. **On 2026-08-28 all three members of
"New this week" were structurally incapable of leaving it.**

Freshness was a property of when Ness last edited a file, not a property of the world — exactly
the brief's diagnosis, and the cause is narrower than expected: not that curation and freshness
are fused, but that the `new` label has **no expiry at all**.

### 2. The "backfill" was the same three cards on a loop

The adaptive canon RESERVE (`App.tsx` `shown`) only runs on the UNFILTERED browse branch — a
freshness-filtered deck never backfills. But `refresh()` (the "Shuffle for more" link) cleared
`swiped` whenever `deck.length <= max(3, shown.length * 0.25)` **without checking
`filterActive`**. A three-pick bucket is "nearly done" on arrival, so every Shuffle re-dealt the
same three. Reads exactly like a thin bucket being padded out.

## The fix (shipped)

**`src/lib/freshness.ts`** — one rule, one place:

- `freshness: 'new'` stays a CLAIM ABOUT THE WORLD. Only a source, a scout or a human makes it.
- **`Pick.firstSeen`** (new field) is OUR RECORD of when the claim started — an ISO date stamped
  by `refresh.ts` the first run a title appears, then carried forward untouched forever.
- `effectiveFreshness(p)` honours the claim only while the record supports it (`NEW_DAYS = 10`:
  one weekly cycle plus slack for a late cron). Lapsed → falls back to what the DATES say,
  `weekend` if it still carries one, `always` if it doesn't.
- **Demote-only, never promote.** "First seen by our crawler" ≠ "new in Amsterdam"; a weekly
  refresh meets dozens of titles for the first time, and promoting on `firstSeen` would flood the
  bucket with the merely-newly-crawled.
- **Fails closed.** No `firstSeen` = no claim. Absence of evidence is the whole reason the old
  bucket never emptied.

Applied in three places, deliberately not one: `refresh.ts` (the published record is honest for
every consumer — /geo, the poster, the board), `restamp.ts` (the fast path must not out-live the
slow one), and `App.tsx` at read time — **so the label decays on the calendar rather than on the
cron.** A refresh that silently stops can no longer freeze the bucket.

Also: `refresh()` now refuses to re-deal inside a filter. In a filter, "more" can only honestly
mean "more that match"; when there is none, the deck runs out and the empty state says so.

Guarded by `tests/freshness.test.ts` (13 cases, including the two immortal canon picks by name).

## The honest empty state

**Answering open question 3: it needs no design, because the bucket is never offered empty.**
`WHEN_FILTERS` already ends in `.filter((o) => o.count > 0)` — the same law `/geo` uses for
districts ("districts that hold nothing under the current filters are dropped, not shown as 0").
An empty freshness bucket removes its own pill. Verified live: the When sheet now reads
Any time 76 · This weekend 9 · Evergreen all 67 / classics 20 / bespoke 24, with **no New this
week** — because there genuinely isn't any. A user who swipes an almost-empty bucket dry still
lands on the existing `stack-empty` ("That's everything in this filter" + Clear filters).

## The transition, and the trap inside it

Every pick in the feed predates `firstSeen`, so the first run has to decide what to do with 78
unstamped records. Three cases, and the middle one is the whole design:

| Case | Stamp | Why |
|---|---|---|
| recorded in last week's feed | carry it forward untouched | the record, once made, never moves |
| in last week's feed, unrecorded (legacy) | **none** | we never saw it arrive |
| not in last week's feed | today | this is the run it arrived |

The trap was the middle row. The obvious backstop — credit legacy picks with the prior feed's
`generatedAt`, "the oldest date we can prove" — is wrong in the direction that matters: that date
is a LOWER BOUND on a pick's age, not its arrival. Applying it to the 2026-09-03 run would have
put `east-beach` and `de-pimpelmees` at 14 days old, inside a 10-day window, and handed both
immortals one more week of New. A fix that reproduces the bug seven days later.

Leaving them unstamped instead lets the fail-closed rule answer honestly: whatever a legacy pick
claims, it is demonstrably not new TO US. Dry-run against the live feed confirms it — 78 legacy
picks stay undated and silent, and a genuinely new arrival is the only thing that claims New.
Stamping today was never an option either: that declares the entire feed new on day one.

## What the brief asked for that already exists

Worth recording, because three Workstream-1 tasks are already true:

- **"Anchor this weekend to the upcoming weekend computed at request time."** Already the case.
  `upcomingWeekend()` in the pipeline, `whenIsPast` / `whenLooksBroken` as runtime guards on
  every load, `whenWeekendDays` for per-day weather. Nothing is anchored to its creation weekend.
- **"Add an auto-expiry job, Sunday 23:59."** Already effectively done, and better than a cron:
  `App.tsx cityPicks` drops past-dated picks at READ time, so expiry needs nobody to show up. The
  genuine gap was undated picks, which is what `firstSeen` now closes for the `new` claim.
- **"Evergreen venues return to the pool with a cooldown."** Shipped as `corpus.rested
  {match, until, note}` (board V.9.26), with a real return date from the board — see
  `docs/board-roadmap.md` Track B.
- **Explicit card states** (`candidate → approved → scheduled → surfaced → retired`) mostly exist
  under other names: `pending.<city>.json` (candidate) → `approvalCheck` (approved) →
  `picks.<city>.json` (surfaced) → `rested` / `eventVeto` (retired), with the airlock demoting
  both directions. That is a naming and documentation gap, not a build.

---

# Part III — the deck itself, not just the label

_2026-08-29, same day. Part II fixed what the picks were LABELLED. Ness: "I haven't touched this in
three weeks and the same picks are coming up… it should auto-populate every week with fresh,
relevant picks, vetted against the sources, and the curation tool is how I adjust it on top."_

## Measured

```
08-06 → 08-13:  90% of the feed carried over
08-13 → 08-20:  83%
08-20 → 08-27:  99%   ← one new pick, all week
```

Kaap Amsterdam led the deck four Saturdays running. The crawl was never the problem — the
2026-08-27 run pulled **227 picks, 95 genuinely new**, and published 25.

## Four freezers, in order of grip

1. **The airlock (the big one).** `approvalCheck` was an ALLOW-LIST: a live pick shipped only if it
   matched something Ness had already approved. `airlock: 25 live approved → feed · 78 → pending`.
   Zero curation → zero new content, structurally. **Fixed:** `publishCheck` — block-list plus a
   judge floor (`JUDGE_FLOOR`, default 5, env-tunable). Doctrine change recorded in
   `curation-surfaces.md`.
2. **Crowns never expired.** 12 👑 from 31 July still leading on 29 August. `weekly.json` always
   expired on its `weekend` stamp; `topPicks` had no equivalent. **Fixed:** `crownsActive` +
   `corpus.topPicksWeekend`, same law, fails closed.
3. **Starred carry-forward.** Any date-valid ★ was pulled back from last week's feed when a crawl
   missed it — which in practice meant every undated evergreen one, every week (18 last run).
   **Fixed:** carry-forward is now a time-critical rescue only (must be dated this weekend).
4. **The ★ score floor — NOT fixed, and it decides who LEADS.** A ★4+ pick gets
   `editorScore = max(score, 8)`. Fresh content realistically tops out at judge 7. So:

   > **All 25 published live picks were ★-floored. Zero earned their score. 50 of 76 feed picks
   > carry a floor of 8 against a judge ceiling of 7.**

   Inverting the gate gets fresh picks INTO the deck; this keeps them out of the top of it.

## Simulated against the real pool

Replaying 2026-08-27's own pending queue through the new gate: **31 of 78 held picks clear the
floor** (feed 76 → 107), crowns retire, and 4 of the top 10 change — South East Jazz Festival,
ZeeZout, Indische Buurt Festival and the Hockey World Cup final break in. The top 4 do not move,
because of freezer 4.

## The open decision on freezer 4

A ★ should be a thumb on the scale, not a ceiling nobody else can reach — `judgeScore + 2` rather
than `max(score, 8)`. **The trap:** the judge only scores LIVE picks, so canon has no `judgeScore`
at all and a naive boost would demote the entire hand-curated library to ~2. Canon needs its own
baseline before the floor can become a boost. Not attempted here — getting it wrong demotes the
actual product.

## Status
- ✅ `firstSeen` stamped + carried forward (`refresh.ts`), airlock included.
- ✅ `new` expires against it at build AND read time (`lib/freshness.ts`).
- ✅ No re-deal inside a filtered deck.
- ✅ Empty freshness bucket is never offered (existing count>0 law).
- ◻ `scouted.ts` still stamps `'new'` unconditionally, and two canon entries still hardcode it.
  Harmless now — the rule neutralises them — but the claims are still untrue at the source.
- ✅ Airlock inverted to a block-list + judge floor; crowns expire weekly; carry-forward bounded.
- ◻ **The ★ score floor → a boost.** Needs a canon baseline first. The remaining freezer.
- ◻ Buzz/velocity scoring (Workstream 2) and ingest automation (Workstream 3) — unstarted.
