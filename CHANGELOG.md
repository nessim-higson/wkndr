# Changelog

All notable changes to WKNDR. We're pre-1.0 (0.x = build-for-self validation phase).
Format loosely follows [Keep a Changelog](https://keepachangelog.com/). The version
shown in the app's "What's feeding this" sheet matches the latest tag here.

## [Unreleased]
- (next up — Phase 2: demote web_search to 2–3 serendipity facets · eat/drink/shop fresh sources ·
  "Talked about" pill on the card face · add SERPER_API_KEY + HEALTHCHECK_URL secrets · city #2 (an EU
  city, not NOLA as-is) once Amsterdam is locked)

> **Versioning note:** from V.1 the app moved off semver to **`V.<major>.<sub>`** (shown in the menu
> footer; `bun run bump`). Whole versions are git tags (`v1.0.0`, `v2.0`, `v3.0`, `v4.0`, `v4.10`,
> `v5.0`, `v6.2`). The per-ship granular history is the **git log** — entries below group it by major
> version. (Entries 0.1.0–0.7.0 are the earlier semver phase, kept for the record.)

## [board V.9.33] — 2026-08-02 — READ THE LISTINGS: a vision pass over roundup carousels
- **The problem the drop box exposed.** Accounts like **@doubleamagazine** post a weekly "Amsterdam
  events" carousel where slide 1 is a cover and slides 2–8 are day-by-day listings **typeset into
  the images**. The caption carries none of it, so dropping the post gave one card titled "PSA -
  Events in Amsterdam this Week!" and silently lost the ~20 real events behind it.
- **A roundup now offers "📖 Read the N slides".** Each listing comes back as its own tickable row,
  grouped under the day heading exactly as printed; tick what you want and each becomes its own card.
- **Getting to slides 2..n was the hard part.** `/media/?size=l` only ever returns the first image and
  ignores every index parameter; the embed endpoint is dead; yt-dlp resolves the children but is a
  binary and can't run in a Worker. **Instagram server-renders the full carousel JSON only for
  Googlebot** — every other UA (facebookexternalhit, a real Chrome string, an iPhone string) gets a
  shell with slide 1. That's the one keyless way in.
- **The parse MUST be scoped to the `carousel_media` array.** The same page embeds the account's other
  recent posts in an identical `"code"/"display_uri"` shape — an unscoped parse returned **20 "slides"
  for an 8-slide post**. Bracket-matched, string-aware (captions contain brackets). Guarded by
  `tests/roundup.test.ts` against a real captured page, with those decoys still in the fixture.
- **Vision reads the FULL 1080px slide**, never the page's own `display_uri` (512×640 — too small for
  dense listings) and never the wsrv portrait render (`fit=cover` **crops**, which cuts off text).
- Prompt is built from the real slides: DAY/NIGHT section headings (captured as `part` — a genuine
  signal, NIGHT is club/gig and it's the difference between a picnic and an afters), day headings
  carried onto each event verbatim, wrapped venue continuation lines rejoined, inconsistent `|`
  spacing, and an explicit instruction to return `[]` for a cover slide rather than invent filler.
- Slides run concurrently and one unreadable slide yields `[]` rather than sinking the batch. Dedupe
  keys on title+date+part so a multi-night run survives but a duplicate print doesn't.
- Worker: `POST /drop/read` (`worker/curate/src/roundup.ts`), capped at 12 slides. **Needs a key** —
  `cd worker/curate && npx wrangler secret put ANTHROPIC_API_KEY`. Without it the endpoint says so
  and everything else keeps working; the drop box itself never needed one. **242 tests.**

## [drop fix] — 2026-08-02 — accept the URL form Instagram actually gives you
- **First real paste failed.** `instagram.com/<username>/p/<code>/?img_index=1` — the form you get
  copying a link **from a profile** — was rejected as "not a single public post". The guard only
  matched `/p/<code>` at the root, which is the form you get from the post page itself. Both resolve
  to the same post; only one was accepted.
- Instagram URLs are now **canonicalised to `/p/<code>/`** whichever form is pasted, so the same post
  pasted two ways dedupes instead of landing as two picks. `?img_index=`, `?igshid=` and utm params
  are stripped (they don't change which post it is).
- Pasting a **profile** now says so — "that looks like a profile, not a post — open the post first,
  then copy its link" — instead of the generic unsupported message.
- Also widened: TikTok `/photo/` and `/t/` short links, X `/statuses/`. **233 tests.**
- Noted while testing: Instagram occasionally flakes a single request (one call in ~six returned
  nothing, the retry succeeded). Worth a retry if the board ever reports a post it can't read.

## [board V.9.32] — 2026-08-02 — THE DROP BOX: paste an Instagram link, get a pick
- **The content blocker, closed.** Every source in the pipeline is a crawlable site; the events Ness
  actually spots are on Instagram, and there was no way in short of describing a post by hand. The
  board now has a **Drop a link** field at the top of Simple: paste an Instagram / TikTok / X post,
  hit **Pull**, and the pick comes back with its picture and caption in about a second.
- **How it reads a post without a login.** The tools that do this don't scrape Instagram — they read
  the OpenGraph tags Instagram serves to link-preview bots. A crawler user-agent
  (`facebookexternalhit`) gets `og:description`, which carries likes, comments, author, date and the
  caption. No cookie, no API key, no proxy. Verified live from the Worker on 2026-08-02.
- **Full resolution, which is the part that nearly didn't work.** `og:image` is a preview capped at
  ~640px (360px on a reel) — under the low-res gate, so drops would have shipped as soft cards. The
  size token in the CDN URL is covered by the `oh=` signature, so it can't be rewritten upward (403).
  **`/p/<code>/media/?size=l` redirects to the NATIVE image** — measured 1080×1920, 1080×1351,
  1080×1043 across real posts. That one extra call is the difference between usable and not.
- **Three traps, each of which fails silently** (all now covered by `tests/drop.test.ts`, real captured
  strings): `og:image` arrives HTML-escaped and a stray `&amp;` makes the signed URL fail with "Bad URL
  hash"; Instagram truncates long captions and **drops the closing quote**, so a greedy match hands the
  deck a title starting "41M likes, 486K comments - …"; and a Worker subrequest sends **no User-Agent**,
  which fxtwitter answers with a 401.
- **Images route through wsrv like every other card.** Instagram's CDN refuses hotlinked browser
  requests, so an unwrapped URL renders as a broken image on both surfaces — the Worker returns a
  `toPortrait()` 800×1200 render (and keeps the original for the loupe).
- **`applyOverrides` learned to ADD.** pile/killed/flags only ever re-stamped picks the app already
  had; a pasted pick isn't in the static feed at all. Drops now ride the fast lane as `added`,
  carrying their own content, and are injected client-side — deduped against the feed, skipped if
  cancelled in the same round, and orderable by the pile like anything else. Id prefix is `drop-`,
  deliberately outside the airlock's `web-`/`llm-`/`rss-`/`sk-` audit: a hand-paste **is** the approval.
- Drops also ride the GitHub issue (`DROPPED IN`) so the durable compile can fold them into
  `taste/scouted.json` — the fast-lane copy expires with the feed.
- Worker: `POST /drop` (`worker/curate/src/extract.ts`). Board: `#dropbox`. **230 tests.**
- **Not built: watching accounts automatically.** Scraping is shut — a logged-out profile page returns
  a 604KB shell with zero post links, and the public RSS bridges now 403. The route that works is
  Meta's Graph **business_discovery** (free, sanctioned, Business/Creator accounts only); it needs a
  Meta app plus a WKNDR IG Business account. Deferred until the paste path shows which venues are
  worth a cron.

## [geo G.1] — 2026-08-02 — /geo: the hyper-local prototype surface (PR #23)
- Field feedback (a friend in Noord: "wish the location filtered more accurately") → a separate surface
  at `app.wkndr.xyz/geo/`, curate-board pattern: ships inside the app build, reads the LIVE feed
  (`servePos` order, real posters + link-outs), writes nothing; the MVP app at `/` untouched.
- The Where sheet: **near-me is a SORT** (re-ranks, never empties the deck) + **counted district chips**
  ("Noord · 7" — pool thinness visible, not embarrassing). Event-first cards + detail (getting-there is
  the quiet last line). Undo pill at the BOTTOM here — the pinned filter tabs own the top. Real
  geolocation via "My location"; Centraal/Noord preset viewpoints.
- Distances: in-page name-keyed venue gazetteer (62/80 current-feed pins; day-trips parse their travel
  time; generic "Amsterdam" areas stay honestly unmapped and sink) + haversine ×1.3 @ 15 km/h + an
  explicit IJ ferry model, rounded UP to fives.
- Design record: `experiments/11-geo-toggle-comps` → `12` (clickable) → `13` (fork: honest distances +
  earned chrome) → `14` (real feed). Next per the PR: pipeline geocoding (`ra.ts:82` area capture ·
  I amsterdam address JSON-LD · PDOK venue cache on the cron) — STATE.md open item 8.


## [board V.9.18] — 2026-07-23 — DEAD SIMPLE: "your 10 opening cards" (default) + Advanced toggle
- Ness: "the setup on the curation board needs to be DEAD simple — here are your top 10 opening cards."
- The board now opens on ONE plain screen: **Your 10 opening cards** — a numbered list seeded from the
  deck's ACTUAL serve order (so the board finally mirrors what the app opens with). Drag ⠿ to reorder,
  − to drop a card (the next-best fills in, always 10), + on a pool card to swap one in (bumps #10 out).
  Submit sends the order (rides pileLine → weekly.pile).
- All the rating/veto/canon/★ machinery moved behind an **Advanced** toggle — untouched, just out of the
  way. Fixes the fidelity gap the V.9.17 build-up pile introduced (it ordered by promotion, not servePos).
- Verified: seed matches app order · remove refills to 10 without boomerang · add enters + bumps · pool
  81 cards · Submit payload carries PILE ORDER · Advanced reveals the full board. No console errors.

## [board V.9.19] — 2026-07-23 — "did my call land?" status panel (close the kill/flag loop)
- Ness: "when I cancel a card (bad image, wrong deep link) — how do I know it's getting ingested?"
- New **Kills & flags status** panel at the top of Advanced: every kill / bad-image / bad-link / note you
  make this session, checked against the LIVE feed. Still in the feed = **● still live — pending ship**;
  gone = **✓ dropped / shipped**. Reload after a compile and watch a pending flip to done. Shows your note
  ("why it's off") on the row. Historical baked verdicts (r1) excluded so it's only calls that haven't landed.
- No backend needed — the board already fetches the feed, so it checks its own work.

## [board V.9.20] — 2026-07-23 — reason picker + upvote-anywhere + auto-ranked "Up next"
- Fixes Ness's three asks in one pass (and respects the caveat: "I don't want to rank 80 cards — automate it").
- **Reason picker.** ✕ no longer means "delete." It asks **"What's wrong with it?"** → chips: wrong link ·
  bad image · low-res · off-brand · seen it too much · duplicate. The reason ROUTES the fix — "keep"
  reasons (wrong link / bad image / low-res) flag the pick for a fix and it STAYS live; the rest remove it.
  Reason rides Submit (`why:<reason>`) so the compile does the right thing. This is the structural fix for
  the R9 Scheepvaartmuseum error (a "wrong link" would never again nuke a crown).
- **Upvote a New Find → it lands in your deck instantly.** ▲ Add on a New Finds card (Advanced) now pulls
  it into the Simple view's top 10 with a NEW badge (via `extras`, persisted) — no more "crown it and it
  just sits there." Rides Submit as a promotion.
- **The tail is now honest.** Below the top 10, "Swap in a card" → **"Up next — auto-ranked"**: the rest of
  the deck viewers see, in the system's order (you don't hand-rank it — the machine does, and it's getting
  automated). Tap ↑ to promote one into your top 10. Answers "are those shown to viewers / can I reorder?"
  in the UI: yes shown, no you don't rank them.
- Verified: keep-reason stays + flags + status shows "wrong link → fixing" · remove-reason drops · New Find
  → top 10 + NEW badge · payload carries why:<reason> · Up next filtered + ↑ promote. No console errors.

## [board V.9.21] — 2026-07-23 — Up next is now reorderable + hawkish · New Find → Top 10 made obvious
- Ness corrected me: he wants auto-compile for SPEED, not to give up CONTROL. So "Up next" is no longer
  inert. It's a **draggable row list** (like the Top 10): drag ⠿ to reorder, ↑ to promote into the Top 10,
  − on a Top-10 card to send it down. Auto-ranked until you touch it — hawkish whenever you want.
  PILE is now the FULL deck order (top 10 + tail), so the whole arrangement rides Submit.
- **New Find → Top 10, made unmissable.** The New Finds ▲ button now reads **↑ Top 10** and flips to
  **✓ In Top 10** on tap; the why-line says "Tap ↑ Top 10 to drop it straight into your deck." Answers
  "how do I get Pride Walk into my Top 10?" — one tap, and it lands (with a NEW badge) in the Simple view.
- Verified: promote (tail→#10) · demote (#10→tail) · both lists drag-reorder · New Find label/feedback ·
  PILE full (81). No console errors.

## [unfurl] — 2026-07-31 — every pasted link now shows THIS weekend's picks
- **Composition: `hero`** (Ness's call, from five rendered alternatives — `split` · `hero` · `trio` ·
  `type` · `band`, all behind `--ogv=`). An unfurl is a thumbnail that gets ONE glance at ~500px in a
  message, and hero is the only composition whose photograph survives that shrink: one image
  full-bleed, brand and date overlaid. Trade-off taken knowingly — it sells one pick instead of
  listing three, and its quality tracks the #1 pick's photo, where `type` would never have a bad week.
- Ness: "where is the poster seen?" Nowhere — nothing referenced it. It was a file at a URL. This
  gives it the surface it was missing, and the highest-leverage one: **the unfurl**.
- **`og:image` was a fixed card** (`og-app.png`) that said the same thing every week. It now points at
  the generated poster, so every WhatsApp / iMessage / Slack / X paste of `app.wkndr.xyz` renders
  this weekend's actual picks, weather and dates.
- **New `og` layout** — 1200×630 (1.91:1, the shape platforms render): brand block left, two picks
  right on full-bleed photographs. Two picks maximum and type sized to survive being shrunk into a
  chat bubble at ~500px.
- **The filename changes weekly, on purpose.** Platforms cache an unfurl BY URL — this repo already
  learned that once (the `og-app.png` vs `og.png` note in index.html). So the poster writes
  `share/og-<saturday>.png` and vite stamps that same dated name into the tag at build time. New
  weekend → new URL → forced re-scrape.
- **`rankOf()` — the number on a pick is now its position in the APP'S DECK**, not its index on the
  poster. Ness: "if we were to have numbers like 1 and 2, it should correspond to what is seen in the
  app." With `--picks=` pinning a hand-chosen pair the old numbering actively lied: Chefs in het Bos
  is 9th in the deck and printed as "2". Applied to every layout that prints a rank.
- Also new: **`--picks="A,B"`** pins the line-up by title (deck rank and photogenic rank are not the
  same thing), and the big-image layouts now **re-crop from the ORIGINAL source** with weserv's
  `a=attention` instead of CSS-cropping the app's 800×1200 portrait a second time — the first render
  of Canal Parade + Chefs in het Bos cut both chefs off at the shoulders.
- **A test caught a real bug before it shipped:** vite and the pipeline computed the weekend date
  independently, and on a SUNDAY `ogImagePath` pointed a week ahead — at a file the poster hadn't
  written — so any link pasted on a Sunday would have unfurled with no image. Now an exact mirror of
  `upcomingWeekend()`, pinned by a test across five dates including both weekend days.
- 205 tests pass.

## [board V.9.31] — 2026-07-31 — one verdict per event, not one per card
- Ness: "yes, make same-title cards one verdict." Round #22 filed the proof — **`Pure Markt | 4* KILL`
  AND `Pure Markt | 4*` in the same payload**, because ✕ on the feed card never touched its library twin.
- `V` was keyed by **pick id**, so an event rendered in two sections held two INDEPENDENT verdicts.
  Now keyed by `vkey(p)` = the word-order-blind title token (the same `tok` the cross-section dupe
  suppressor already used), so twins are a single record and a ★ or ✕ on either lights up both.
  **14 of this feed's events render as twins** — the contradiction was one bad round away at any time.
- A cancel now **sweeps the twins off screen**, not just the clicked card: verified live, one ✕ took
  both Canal Parade cards, left one verdict, one payload entry, one shelf row.
- **Existing rounds migrate rather than vanish.** `rekey()` folds an id-keyed blob onto title keys on
  restore, and `mergeV()` resolves a twin pair so the DECISIVE call survives: a cancel outranks a flag
  outranks nothing, the higher star wins, and a this-round verdict beats a baked prior-round one.
  Order-independent (merge(a,b) === merge(b,a) for the killed case) and idempotent — tested against
  the exact #22 pair.
- 199 tests pass (5 new, including the merge run against the real contradiction).

## [R14 compile] — 2026-07-31 — two promotions out of the airlock, two fatigue rests
- **Issue #21** (68 verdicts). Two new finds crowned, two long-serving picks cancelled.
- **`Chefs in het Bos` (judge 8) and `Horta: Spanish Restaurant Opening` (judge 6) were 👑 TOP ▲ LEAD
  but sitting in the airlock** — both run THIS weekend (Fri 31 Jul – Sun 2 Aug / Sat 1 – Sun 2 Aug) and
  neither would ever have promoted without a `topPicks` match. Added; both now live at #8 and #9.
  Matches are word-boundary safe — checked `horta` against every feed and pending title so it can't
  catch `Hortus Botanicus`.
- **`Pure Markt` (★4 + KILL) and `Bottomless Brunch` (★5 + KILL) → `corpus.rested`, until 2026-08-31.**
  Bottomless Brunch was rated **★5 and its image praised in the same round he cancelled it** — that is
  exposure fatigue, not dislike, so `rested` and never `eventVeto`. Pure Markt had already rested once
  (to 25 Jul), returned, and was killed on sight; its existing entry was EXTENDED rather than
  duplicated. Neither carried a date — `until` is the 1-month default.
- `weekly.pile` ← his 20-deep hand order; `weekly.lead` ← the two named this round.
- **Note on what a round does NOT say.** #21 never mentions Canal Parade, Dekmantel, Pluk de Nacht or
  Mokumboot, but their crowns were left alone: a round that is silent about a pick says nothing about
  it, and his own pile still ranks them #1/#3/#6/#10. Absence is not a demotion.
- restamp: 80 picks, **11 crowns**, airlock +2 promoted. Deck opens Canal Parade 👑 → Kwaku 👑 →
  Dekmantel 👑 → Kaap → VriendenLoterij. 194 tests pass.

## [poster v1] — 2026-07-30 — the weekend poster, generated every week
- Ness: "I'd love a graphic of some of the top picks for the weekend to share with people. Is that
  something that could be generated week over week?" It is — `app/scripts/poster.ts`, on the same cron
  as the content, so the poster is never staler than the deck.
- **1080×1350 (4:5)** — the best all-rounder for messages and feeds. Published to
  **`/share/weekend.png`** (the stable link) and `/share/<saturday>.png` (dated, so old shares keep
  resolving). Ships with the app build.
- **Renderer: `puppeteer-core` against the SYSTEM Chrome.** The brand faces are woff2 (Familjen
  Grotesk 700 — the OG/intro voice), which satori and every other SVG shaper can't read but a browser
  can, so the poster uses the REAL typeface instead of a metric-compatible stand-in. `puppeteer-core`
  ships no browser (~350KB): GitHub's runners already have Chrome, and a full `puppeteer` would
  re-download ~170MB of Chromium on every run.
- **Content is the deck's own front** — hand-set `pilePos` first, then the stamped `servePos` — so the
  graphic can never advertise a different opening than the app deals. Imaged picks only; it refuses to
  publish a thin poster rather than print blank tiles.
- Carries the **per-day weather** from V.10.18: a split weekend prints "Sat 27° · Sun 14°", a uniform
  one prints a single figure, and a dead forecast prints no temperature at all rather than a bogus one.
- **`realVenue()`** — 8 of 80 live picks have a `venue` that is just their SOURCE name ("I amsterdam",
  an upstream extraction fallback). On a poster that reads as a place, so it's dropped. The same bug
  shows on the app's cards; flagged separately for a pipeline fix.
- Wired into **`refresh.yml`** (weekly) and **`restamp.yml`** (after a compile), both
  `continue-on-error` — a poster is a nice-to-have and must never block the content publish. restamp's
  no-op guard deliberately stays on `app/public/data` only: the poster embeds the live forecast, so
  including it would turn "restamp changed nothing" into a churn commit every time the temperature moved.
- 180 tests pass (`tests/poster.test.ts` covers the pure half; the run block is behind
  `import.meta.main` so importing it never launches a browser).

## [V.10.18 / board V.9.30] — 2026-07-30 — PER-DAY WEATHER: Saturday and Sunday stop being one blob
- Ness: "should it do a better job of delineating the days and temps and their differences?" It should —
  and the gap was architectural, not cosmetic. **The app had no per-day weather model at all.**
- `weekendMode()` (build) and `goLive()` (runtime) both took `Math.max` across Sat AND Sun for high,
  wetness and swing, then classified **one** Mode. Every pick's `weatherFit` was matched against that
  single blend, so a **Sunday-only picnic was ranked by Saturday's sunshine** and a Saturday show by
  Sunday's rain. The deck literally could not say "Saturday's the beach day, Sunday's the museum day".
  (The *saves* side already thought in days — `whenDayGroup`, the Itinerary. Only the deck flattened.)
- **`whenWeekendDays()`** (`lib/when.ts`) is the new primitive: which of the weekend's two days is a
  pick actually on? Undated / recurring / open-run → both (you choose when to go); a dated pick → the
  days inside its own interval; lands on neither (a Friday one-off) → both, deliberately, since "no
  day" would strip its weather score entirely.
- **`rankPicks` now takes `Mode | {sat, sun}`.** Each pick scores against the mode of the day(s) it's
  available on; an all-weekend pick takes the **best** of the two (a wet Sunday must not demote a
  terrace you'd visit on Saturday). The sun bonus follows the day too. Passing a bare `Mode` behaves
  exactly as before — every prior caller and test is untouched.
- **`stampServeOrder` ranks per-day** via the new `weekendModes()`, so the board's stamped serve order
  matches the deck the app actually deals.
- **Surfaced, but only when it matters.** `daysDiffer` gates on a different mode, a ≥4° gap, or a ≥40pt
  rain gap — this weekend (25°/25°) correctly stays quiet. On a split weekend the header pill reads
  **"Sat 27° · Sun 14°"**, each in its own mode colour, and the intro headline names both days.
- **`tempForPick`** — a card dated to ONE day now prints THAT day's high. A Sunday card claiming
  Saturday's 27° was the same lie one level down.
- The blended mode is KEPT as the summary: it drives the ambient field and every single-mode surface,
  and a hot Saturday against a wet Sunday genuinely blends to VOLATILE ("it can't decide"). It was only
  ever wrong as a *ranking* input.
- **Board V.9.30** mirrors it — the lens tests each pick against its own day and names both when split.
- 169 tests pass (`tests/perday.test.ts` + board↔app `daysOf` parity, both mutation-checked).

## [R13 compile] — 2026-07-30 — round #20: Dekmantel to #3, three ▲ LEADs
- **Issue #20 filed properly** (71 verdicts) — the V.9.29 half-submit fix worked; this is the first
  round since where the ★/👑 actually reached the durable record.
- **Corpus unchanged.** Every rating in the round reinforces an entry already in `starredKeeps` /
  `starAnchors`, and all four crowns (Canal Parade, Pluk de Nacht, Dekmantel, Mokumboot) are already in
  `topPicks` — the first three from R11/R12, Mokumboot from the #18 compile. Nothing new to add.
- **Weekly slate only:**
  - `lead` 1 → 3: **Pluk de Nacht**, **Dekmantel Festival 2026 - Friday**, **Mokumboot** (the last two
    newly ▲ this round).
  - `pile`: **Dekmantel #11 → #3** (it runs Fri 31 Jul — tomorrow), **BOPS x KIKI #3 → #11**. A straight
    swap; the rest held.
- Deck opens **Canal Parade 👑 → Kwaku 👑 → Dekmantel 👑▲ → Pure Markt → Bottomless Brunch**.
  80 picks, 9 crowns, 3 leads. 142 tests pass.

## [R12 compile / board V.9.29] — 2026-07-30 — the 18:20 reorder live + the half-submit bug it revealed
- **Compiled the 18:20 round.** It arrived on the fast lane only — **no GitHub issue was ever created**
  — so the durable record carried the pile and the cancels but NOT the ★ ratings or 👑 crowns.
  Changes: **ARTIS Royal Zoo demoted #4 → #19**, **Mokumboot promoted into #10**, Dekmantel at #11, no
  new kills. `weekly.pile` now holds **20** entries rather than the usual 10 — he dragged ARTIS well
  past the opening slots, so his hand order is deliberate that deep; 21+ keeps auto-ranking.
- ARTIS keeps its 👑: the crown guarantees a slot, `pilePos` sets the position, and `orderServed` deals
  the hand order above every tier — so a demoted crown is coherent, not a contradiction.

**The half-submit (fixed V.9.29) — why that round lost its ratings:**
- Submit does two writes: POST to the fast lane, then `window.open` to GitHub. But that lands on the
  **prefilled** new-issue form — the issue does not exist until **“Submit new issue”** is pressed
  there. The button nonetheless flashed **“Live ✓ — filed”** the instant the tab opened. It filed
  nothing, said it had, and the flash was gone in 3.5s.
- Now honest about which half is which: **“Live ✓ — finish on GitHub”**, plus a persistent note in the
  bottom bar — *“One more click: press ‘Submit new issue’… your order and cancels are live already;
  ★ ratings and 👑 crowns only travel in the issue.”* It stays until the next Submit rather than
  flashing. A blocked popup (`window.open` → null) is now detected too: the round goes to the
  clipboard and the note says the ★/👑 did **not** file.

## [R11 compile / board V.9.28] — 2026-07-30 — round #19 live, and the two bugs it exposed
- **Compiled issue #19** (69 verdicts, 2026-07-30 16:03). His two cancels were ALREADY live via the
  fast lane; the crowns, stars and slate were not — those need the corpus.
- `weekly.json` was stuck on **last** weekend (`weekend: "2026-07-25"`), so the entire slate was being
  ignored by refresh/restamp. Rolled to **2026-08-01** with #19's pile, `lead: [Pluk de Nacht]`,
  `later: []` (its only entry, Dekmantel, is no longer in the feed).
- `corpus.topPicks` += **canal parade**, **pluk de nacht** (both 👑 TOP this round);
  `starredKeeps` += `canal parade ★5`.
- `corpus.rested` += **roode remise** and **ij-hallen**, both `until 2026-08-29`. Both were ★4 **and**
  KILL in the same round — the documented fatigue/scheduling class, so `rested`, **never** `eventVeto`:
  the taste stays, only the exposure pauses. IJ-Hallen keeps its 👑 crown (rested drops it before
  topPicks stamps, so it returns crowned). **Neither carried a date** — `until` is a 1-month default.
- `restamp` → 79 → 78 picks · deck opens **Canal Parade 👑 (Sat 1 Aug) → Kwaku 👑 → BOPS x KIKI 👑 →
  ARTIS 👑 → Pure Markt**; all three cancelled titles gone (incl. the `IJ-Hallen Flea Market` variant).

**Two board bugs the round exposed — both fixed (V.9.28):**
- **A two-step reason tagged the pick before its second step.** #19 shipped `IJ-Hallen | KILL
  why:other` with **no note**: the "something else…" chip was pressed and the text never typed, so the
  reason was written on the chip click. `rest` had the same hole (a reason with no `until`). Both now
  only ARM the step — the reason is recorded when the date or the text lands, so an abandoned pick
  stays a plain un-reasoned cancel instead of a verdict the compile has to guess at.
- **The issue's PILE-ORDER still listed cancelled titles.** #19 filed a pile with `IJ-Hallen` at #4
  that he had cancelled in the same round. `buildOverrides` stripped them for the fast lane (which is
  why the live override was right) but `pileLine` didn't — so the durable record contradicted itself.
  Both payloads strip now. 142 tests pass (3 new guards).
- **Also compiled the older open round, issue #18** (07:58, against the pre-refresh feed — mostly
  superseded, but three items were still live business):
  - **Dekmantel Festival was ★5 👑 TOP LEAD and NOT being served** — the refresh had split it into two
    RA pickups (`Dekmantel Festival 2026 - Friday`, `Dekmantel At Night - Friday`, judge 8/7) which sat
    in the airlock with no approval to match. `topPicks` += **dekmantel festival** (the tight match —
    a bare `dekmantel` would crown the afterparty too) + `starredKeeps` ★5 → **both promoted, the
    festival crowned**. It runs **Fri 31 Jul**, i.e. tomorrow; without this it would have missed its
    own weekend.
  - `topPicks` += **mokumboot** (his ★5 👑).
  - `Het Scheepvaartmuseum | KILL note:"The link out does not correspond with the card"` — the R9 trap,
    routed as a LINK fix, not a veto. It sits unapproved in the airlock (judge 3) so nothing is being
    served; noted rather than vetoed. ⚠️ Its link is the generic `kidsproof.nl/amsterdam`, and
    **Mokumboot — just crowned — carries the SAME generic link**. Two more live picks share
    `iamsterdam.com/en/whats-on`. Not systemic (3 of 80), but the crowned one wants a real URL.
  - `Pride Walk & Pride Park | TOP LEAD KILL why:seen` — event was 25 Jul, already gone from feed and
    airlock. No action.
- Feed after both compiles: **80 picks, 9 crowns.**


## [board V.9.27] — 2026-07-30 — ✕ cancels on the spot; the reason waits on a shelf
- Ness: "when I ✕ something out, it should be removed immediately from my curation board and maybe put
  to a section where I can elaborate on it later."
- **The verdict was blocking the removal.** ✕ only OPENED the picker — the card stayed in the deck
  until you classified it, so triage stalled on every single card. Inverted: **✕ cancels immediately**
  (one click, card gone, no reason asked) and the pick lands on a new **Cancelled this round** shelf
  below the deck, where the chips live. Classify whenever you feel like it — or never: an un-reasoned
  cancel still submits as a plain `KILL`.
- **↩ Put back restores the ORIGINAL slot.** Cancelled titles now STAY in `PILE` (they were being
  stripped) — `renderOpen` already filters killed titles and `buildOverrides` strips them from the
  payload, so leaving them in place is what makes undo land a card back at #5 instead of at the bottom.
  Undo clears only the cancel fields; stars, image verdicts and prior-round taste survive.
- **A `fix` reason puts the pick back LIVE, flagged.** From the shelf, *wrong link / bad image /
  low-res* returns it to the deck with its green flag — the pick was fine, the data wasn't. The other
  kinds keep it cancelled and record the routing (`rest` + `until`, `veto`, `other` + note).
- The inline picker is gone from both the Advanced card and the Simple row; `wireReasons()` now has a
  single call site — the shelf — which both views render (`#cancelbox` / `#cancelbox2`).
- Verified end-to-end: 3 cards triaged in 3 clicks with zero classification · shelf survives reload ·
  undo restores slot #5 with ★4 intact · rest → `back 2026-08-29` · free text → "venue moved" ·
  un-reasoned cancel still ships. 140 tests pass (5 new shelf/immediacy guards).

## [board V.9.26] — 2026-07-30 — a cancel can now be a REST: "not on right now, back <date>"
- Ness: "what if it's something that is not listed? IJ-Hallen was last weekend — that should be
  retired until next month when it comes back, as it's only one weekend every month."
- **The picker had no way to say "this is fine, it's just not on."** V.9.25 only knew fix-vs-veto, so
  two different things collapsed into "kill": a pick that's WRONG, and a pick that's simply off-cycle.
  IJ-Hallen runs ONE WEEKEND A MONTH (`when: "Monthly · one weekend"`, 👑 TOP, servePos 5) — on the
  other three weekends vetoing it would lose a pick Ness likes, and leaving it means it opens the deck
  on a weekend the market isn't running.
- **Four kinds now, and the kind IS the compile routing instruction:**
  `fix` (wrong link · bad image · low-res) → stays live, flagged · `rest` (**not on right now** · seen
  it too much) → `corpus.rested` · `veto` (off-brand · duplicate) → `corpus.eventVeto` · `other`
  (**something else…**) → free text, the escape hatch for anything unlisted.
- **A rest asks for a return date.** Picking a rest reason does NOT cancel the card — it reveals
  "Back when?" (in 2 weeks · next month · in 2 months · in 3 months · or a date box), and only the date
  finalises it. That date rides Submit as `until`, straight into `corpus.rested {match, until, note}` —
  a mechanism that already existed ("NOT a veto — dropped from the feed AND the bench only until
  `until`") but that the board had no verb to produce. Verified on IJ-Hallen: taste survives the rest
  (its ★4 + image-good stay on the verdict), only the exposure pauses.
- **A REST never reads as a KILL** in either payload — `REST until 2026-08-29 · reason:offcycle`
  (pretty) / `REST:2026-08-29 why:offcycle` (compact) — so the compile can't mistake one for the other.
  Fast-lane drops a rest like a kill (right for THIS weekend) and expires with the feed; only the
  corpus entry holds it off until the date and then brings it back.
- **One implementation for both views.** New `wireReasons()` + `reasonBox()` are shared by the Advanced
  card and the Simple row — the V.9.25 bug (picker shipped to Advanced only) came from two copies.
- Also fixed: `update()` stripped the ✓-ruled border off a card flagged "wrong link" (that reason sets
  neither img nor note, so the toggle's field list missed it).
- Routing table documented in `docs/board-roadmap.md`; guarded by 7 new assertions in
  `tests/board-dates.test.ts` (kinds, the rest-needs-a-date branch, one-implementation, payload shape).
  136 tests pass.

## [board V.9.25] — 2026-07-30 — last weekend falls off the board · ✕ + why on the Simple view
- Ness: "I can't kill selections and explain why. Things like Milkshake are dated last weekend — those
  should fall off the board." Both were real, and independent.
- **Already-over picks now fall off.** The board had NO expiry guard: it rendered `picks.<city>.json`
  as-is, so a feed generated on the 23rd and read on the 30th still showed last weekend's events. On
  that feed four dead picks — Milkshake (26 Jul), IJ-Hallen Flea Market, Kwaku, Wils at the Farm — held
  serve slots **#2/#4/#5/#6**, i.e. the top of the opening deck, plus 37 of 70 New Finds and 19 canon
  entries. The APP was already correct (`App.tsx` filters `whenIsPast`), so none of them ever reached a
  tester — the board was lying about the deck, not the deck about itself.
  New inline `isOver` / `looksBroken` / `servable` mirror `lib/when.ts`; one `cull()` at the seam where
  the feed enters means every list downstream (lens, feed, Simple deck, New Finds, trending, bench,
  library) inherits it. The dropped count is reported in the header — silence would be its own bug.
  Also ported when.ts's year-resolution rule: the old board rolled EVERY >45d-past date forward a year,
  which resurrected a stale feed's finished events as next year's.
- **✕ + why on the Simple view.** The reason picker shipped in V.9.20 — but only in Advanced, while
  Simple is the DEFAULT view. On the screen Ness actually works in, a card could be reordered or demoted
  but never cancelled, and there was nowhere to say why. Every Simple card now carries the same ✕ and the
  same six chips (one shared `REASONS` source, so the two views can't drift): keep-reasons flag-and-fix
  (card stays, turns green, shows "wrong link → fixing"), the rest cancel it.
- **A kill now lands everywhere.** Killing in Advanced used to leave the card sitting in the Simple Top
  10 — which reads exactly like "the kill didn't take". One cancel now drops it from both views, out of
  `PILE`, out of any New-Find extras, and out of the Submit payload's pile (a title in both `pile` and
  `killed` was a contradiction the durable compile had to resolve by hand). Kills survive a reload
  without being re-seeded from the feed.
- Guarded by `tests/board-dates.test.ts` — extracts the board's own helpers from the HTML and asserts
  parity with `when.ts` across every `when` in the shipped data plus adversarial shapes (backwards
  ranges, Dec→Jan wraps, open runs, >45d-stale one-offs). 130 tests pass.
- **Note:** this is a board fix, not a data refresh. The live feed is still `generatedAt 2026-07-23` —
  `bun run refresh` is due, and its own `whenIsPast` pass will clear these at the source.

## [board V.9.24] — 2026-07-23 — Advanced matches Simple's look (kept the grouping)
- Ness: "the Advanced side is still different from the Simple." It was — grids of tall POSTER cards vs
  Simple's compact ordered rows, plus legends still describing the removed pile.
- Restyled Advanced cards into the same **horizontal thumbnail-left row** language as Simple (kept the
  by-category / Lens grouping, which is useful for rating a batch). Fixed the stale legends: dropped
  "▲ Add into this weekend's pile", "drag to reorder the pile", "#n pile position"; ✕ is now "cancel + why",
  ▲ is "↑ Top 10 into your deck (Simple)". Flow line updated to the now-live fast-lane ("live in seconds").

## [V.10.16 / board V.9.23] — 2026-07-23 — auto-compile LIVE: board Submit → deck in seconds
- Track A wired end-to-end. The board's Submit now does TWO writes: (1) POST to the wkndr-curate worker
  (the fast-lane) and (2) file the GitHub issue (the durable corpus record). Button reads "Live ✓ — filed".
- The app reads the overrides on feed load (`fetchOverrides` + `applyOverrides`, App.tsx) and layers them on
  the static feed: `pile` → `pilePos` (the app's hand-order, deals first above every tier), `killed` → dropped.
  Fail-soft: dead worker or stale override (feed rolled) = the feed as-is.
- PROVEN live: POSTed {pile:[De Parade,…], killed:[Milkshake]} → the app deck reopened De Parade #1
  (was #3) and dropped Milkshake, no rebuild/redeploy. `applyOverrides` fixed to stamp `pilePos` (not
  servePos — the runtime deck orders by pilePos). 126 tests green.
- Still human: the durable corpus compile (from the GitHub issue) folds these into corpus.json on the next
  refresh — the fast-lane is the instant layer, the corpus stays source of truth.

## [board V.9.22] — 2026-07-23 — one ranked deck (Simple↔Advanced consistency)
- Ness: "I see a ranked order on Simple, then go to Advanced and it's a different order — confusing."
- Root cause: TWO competing deck concepts. Simple = the ranked deck (top 10 + Up next); Advanced ALSO had
  a "This weekend's pile · your TOPs + upvotes" built a different way, ordered differently.
- Fix: **removed the Advanced pile entirely.** The ranked deck now lives in ONE place — Simple. Advanced is
  purely rate / veto / canon / discover. The ▲ button on EVERY Advanced card is now one verb — **↑ Top 10**
  (→ "✓ In Top 10") — that promotes straight into the Simple deck's Top 10 (feed cards move up; New Finds get
  pulled in). No second, contradictory order anywhere.

## [V.10.15] — 2026-07-23 — the deck opens with The Lens · crowns pruned 18→6
- **Opening order = The Lens** (weekly.pile): WorldPride · Kwaku · De Parade · IJ-Hallen Flea Market ·
  Wils at the Farm · Milkshake · Vondelpark · Pluk de Nacht · Bottomless Brunch · VriendenLoterij.
  The app now deals exactly these ten first, in this order, above every tier. Dated-this-weekend +
  forecast-fit, outdoor first.
- **Crown prune, the ≤6 debt finally paid: 18 → 6.** KEPT: milkshake, 't lemmeke, artis royal zoo, kwaku,
  ij-hallen, worldpride. DEMOTED (still in the feed, most still starredKeeps): dekmantel, queer amsterdam,
  pluk de nacht, kaap amsterdam, strand zuid, jazz @ h'art, pllek urban beach, zomerlicht, pride run,
  phono lake, vondelpark openluchttheater, movies at h'art. "If everything is top, nothing is."
- 119 tests green.

## [V.10.14] — 2026-07-23 — R9b: honour the Scheepvaartmuseum kill (my call was wrong)
- Ness killed "Het Scheepvaartmuseum – Summer Activities" in #17; R9 kept it (link-fix + crown, citing the
  ARTIS precedent). Wrong read: the card ALSO carried a wrong image (a dance photo, not the museum) and,
  crown intact, it was being served as the **#1 card in the deck**. Kill honoured.
- Vetoed narrowly on `summer activities` — veto matches TITLE only, so the canon "Het Scheepvaartmuseum"
  entry and the Ekō show at that venue (Scheepvaartmuseum is its *venue*, not its title) both survive.
- Pulled the `scheepvaartmuseum` crown (19 → 18) so the canon museum entry can't inherit the lead.
- Feed 83 → 82, tops 13 → 12. Deck now opens: WorldPride · IJ-Hallen Flea Market · Milkshake · Vondelpark
  · Kwaku · Kaap · Strand Zuid · ARTIS. 119 tests green.

## [V.10.13] — 2026-07-23 — compile R9 (Curation Board issue #17, 73 verdicts)
- Restamp fast-path (no crawl). **20 star reinforcements** → `starredKeeps` (editorScore floor 8 +
  carry-forward): Droog/MENDO/Moise/Mobilia/Vlieger/De Baanderij/Tacite/Rush Hour/Red Light Records (★5),
  Wils/Utrecht/Strand van Oost/Amsterdamse Bos/Kama/Bar Staal/Rotate/TÊTE/Warung Spang/De Kas/Glou Glou (★4).
- **2 new 👑 TOPs:** `ij-hallen` (flea market) + `worldpride`. Now 19 crowns — **prune debt is overdue**
  (guidance ≤6); a cut is due when the summer crowns expire.
- **`bret x off world` rested** (★4+KILL, wrong-image card) — the specific Off World card drops; the
  `bret` taste stays. Dropped from the feed.
- **Scheepvaartmuseum "Summer Activities" — link FIXED, crown KEPT, not vetoed.** The killed card *is* the
  crowned TOP; its complaint was the generic `kidsproof.nl/amsterdam` link. Per the R8 ARTIS precedent
  (weak kidsproof link → reroute, don't kill the institution), rerouted to the official site. **Flagged
  for Ness** — say the word to fully veto instead.
- **Dekmantel → weekly LATER** (this weekend only; stays in the feed, sinks in the pile). Organ-concert ★4
  reconfirms the R3 reversal (only `lunchconcerten in de westerkerk` stays vetoed). weekly.json weekend
  advanced to 2026-07-25; stale lead/pile cleared. 119 tests green.
- **Not applied (no action possible):** the 5 `img:bad` flags (Milkshake, Nxt Museum, Strand van Oost,
  De Kas, Red Light Records) carry "(R3 scout) image replaced" notes / no replacement URL — informational.

## [board V.9.17] — 2026-07-22 — "This weekend" build-it-up pile (promote + rank in one place)
- Ness: "how do I promote and then rank while sitting here… have The Lens where I can immediately
  upvote and place it in THIS WEEKEND'S PILE, then play with the order." Pile model chosen: **build it up.**
- The pile is no longer the whole projected deck. It's the set you **promote**: it seeds with your 👑
  TOPs, and a card's **▲ Add** (the old LEAD, relabelled + accent-styled as the primary action) drops it
  in live; ✕/▼ removes it; drag ⠿ orders it. Rendered **first** (your working weekend on top), rebuilt on
  every promote via a global `renderPile()` the card handlers call. Empty-state hint when nothing's promoted.
- Verdict wire format unchanged (LEAD/TOP flags + PILE hand-order still ride Submit) — verified: add →
  pile grows + payload carries ▲LEAD · remove → pile shrinks · 14 lens cards all show ▲ Add · drag armed.

## [board V.9.16] — 2026-07-22 — Helvetica + declutter pass
- Ness: "the type on the entire tool should be Helvetica and cleaner — there is so much happening."
- One typeface everywhere (`--sans` Helvetica stack); killed all the `ui-monospace` ALL-CAPS/wide-track
  labels that made the board read as noise.
- Section headers rewritten from long ALL-CAPS run-on sentences to a short **Title Case label + one
  light detail line** ("This weekend · 25–26 Jul · 26°" / "This weekend's pile · 24 cards" / "This
  weekend's feed · 81 live — what the deck keeps serving as you swipe"). Category sub-heads lightened.
- (Still open, per Ness: the lens→promote→pile→reorder flow should be one live workspace — next pass.)

## [board V.9.15] — 2026-07-22 — curation board clarity pass (words + trust)
- Ness's read: the board was confusing — you couldn't tell what you were looking at. Two fixes.
- **Words:** the ~250-word jargon-wall header (a dozen named concepts before a single card) is gone —
  replaced by a plain "what this is" (IN ROTATION = live / NEW FINDS = not live yet), the pipeline
  spelled out (rule → Submit → GitHub → compiled & shipped → testers see it), and two chip **legends**
  (verdict glyphs · badges), one idea each.
- **Trust:** every card now carries a **"why it's here"** line keyed to its section (lens / pile / new /
  approved), and ruling a card lights it green with **"✓ your call — rides Submit"** — the same pick's
  twins in the lens/pile/feed light up together, so "a verdict counts everywhere" is now visible, not
  just asserted. Board-only static change; no app-version bump.

## [V.10.12] — 2026-07-21 — field-feedback reliability pass (persist declines · intro once · honest LBB links)
- **Declines now survive a refresh.** The `swiped` set was memory-only, so a reload reset the deck to
  card one — re-serving everything, including picks you'd already declined (saved ★ picks persisted, so
  the mismatch was glaring). Now persisted to `localStorage` (`wkndr.swiped.v1`, `taste.ts`
  `loadSwiped`/`persistSwiped`) on the same contract as saved; a refresh resumes where you left off, and
  the bottomless recycle still clears it so you never dead-end. (Field report, 2026-07-21.)
- **The full-screen intro is now a first-run / arrival moment, not an every-load wall.** It replayed on
  every refresh, walling the listings off behind the splash each time. Now: the first visit gets the full
  line once, a shared-link arrival always gets its personal greeting, and a returning/refreshing visitor
  lands straight on the deck. `App.tsx` (`visits <= 1 || isArrival`); tunable back up (`<= 3`).
- **LBB "View event details" no longer lands on a generic roundup.** When the extractor found no
  per-event outbound link, the adapter fell back to the monthly *agenda article* — so a card promising one
  exhibition (Ekō @ Scheepvaartmuseum) opened a museum-agenda page. Fallback is now a scoped search for the
  exact title + venue (`adapters/lbb.ts`); the 4 live picks already carrying the agenda link were patched
  in `public/data/picks.amsterdam.json` so the reship fixes them immediately.

## [V.10.11] — 2026-07-17 — pin the intro's four returns (Your / weekend, / one swipe / away.)
- Explicit `<br>` in `DEFAULT_LEAD` so the V.10.10 −25% resize can't let `text-wrap:balance` reflow
  the intro lead to two lines; override leads (shared-visit greetings) still balance-wrap.

## [V.10.10] — 2026-07-17 — intro lead −25% size / −20% leading
- `clamp(52px,15.5vw,124px)` → `clamp(39px,11.6vw,93px)`; line-height 1.0 → 0.8.

## [V.10.9] — 2026-07-17 — the intro + cream OG card set in Familjen Grotesk (the actual face)
- Self-hosted latin 700 woff2 (~12KB, `src/assets/fonts` — no Google CDN hit, per the privacy posture;
  Vite rebases the url for both deploy bases). Intro lead → Familjen Grotesk 700, tracking −0.02em.
- `landing/og.png` redrawn in Familjen (headline, sub, wordmark, pill). **The app's orange `og-app.png`
  card is untouched** (see the landing entry below).

## [V.10.8] — 2026-07-17 — intro lead in the OG card's Helvetica-bold voice (inverted)
- The 'cream' type treatment from `og.png` — white + accent over the field instead of ink-on-paper.
  Clash Display poster scale → Helvetica bold `clamp(52px,15.5vw,124px)`, −0.025em, lh 1.0; the
  wordmark stays Clash (the logo keeps its voice).

## [landing] — 2026-07-17 — two surfaces, two cards: the unfurl split + a copy de-dupe pass
_Landing + OG surface, shipped across the V.10.8–10.10 window (commits `1310e5a` copy · `d8962d6`
unfurl split) — no version tag of its own. The parallel 10.8/10.9 OG work restyled the **cream**
marketing card's type; this split off the app's **orange** card and rewrote the landing copy._
- **The two shared links now unfurl as different things.** Before, `wkndr.xyz` (marketing) and
  `app.wkndr.xyz` (the app) served the **same** cream OG card — the only difference was the URL line.
  Now the app gets its own **cover-orange** 1200×630 card ("**Swipe. Save. Match.**", *Match* in black,
  white wordmark + 27° pill) at a **new filename `og-app.png`** — the rename forces WhatsApp/iMessage to
  re-scrape past the cached cream card. `og.png` on the app also carries the orange card for stale
  refetches. Landing keeps the cream poster. Card art rendered from `landing/fonts` via headless Chrome
  at exactly 1200×630 so both read as one system, split by surface. App meta: title "WKNDR — the app",
  description "Swipe. Save. Match. This weekend in Amsterdam — no account, right in the browser."
- **Landing copy de-dupe — one idea per beat.** The scroll deck drew from one small word pool
  ("weekend" ×5 headlines, "sorted/ranked" ×3, "save" ×4, three straight endings opening "Your
  weekend…"). Each beat now owns one idea: cover → "**Weather permitting.**" (the hero tagline "Your
  weekend, one swipe away." now lands **once**, on the reveal behind it); weather card → "Ranked by the
  forecast." / terraces-climb-museums-rise; feed → "**Right is a yes.**"; bento → "Every kind of
  Saturday."; matching → "**The overlap is the plan.**" (revived from the Site 02 prototype); payoff →
  "**Nothing left to plan.**" (stops the third consecutive "Your weekend…"). Closing dropped the doubled
  "No account required" bullet. Landing `<meta>` description + JSON-LD now speak the new voice
  ("Amsterdam plans, rearranged by the sky…"). Mock app-UI strings left app-authentic.

## [V.10.7] — 2026-07-17 — the deck knows when you're done (interruption budget: ONE)
- **The checkpoint**: the save that makes THREE fires a calm overlay — "★★★ That's a weekend." →
  Share with a friend / See my list / keep swiping. Fires 700ms after the fling (the card finishes
  leaving first), once per weekend (`wkndr.checkpoint.<sun>` rolls with the feed), never on a shared
  match-round visit. An overlay, NOT a bar: the deck never shifts.
- **The persistent share-nudge banner is gone.** It fired at save #1, sat until dismissed, and
  displaced the deck on every appearance — Ness hit it stacked with the intent prompt and called it
  "a lot to take on". Matching's journey entry now rides the checkpoint (a win), not a nag.
- **The intent prompt ("Would you actually do any of these?") moved to the deck's end** — still
  armed at swipe #10, but only shows on the "That's the weekend" pause, where the honest answer
  lives and there are no cards left to displace. Mid-deck interruptions: exactly one.
- **The intro finally drops "Tinder your events."** — now "Your weekend, **one swipe** away."
  (accent swap, matching the landing hero verbatim; the V.10.1 retirement finally reaches the app).
  Titles/OG were already correct — the intro default lead was the last survivor.

## [V.10.6] — 2026-07-17 — compile R8 (issue #16): six summer crowns, one via the tram
- **Six 👑 TOP ★5 escalations, all promoted from the airlock** (75 → 81 picks): Zomerlicht
  Restaurant on Pampus Island, Amsterdam Pride Run, Phono Lake's Second Night At The Lake,
  Het Scheepvaartmuseum — Summer Programme, Vondelpark Openluchttheater, Movies at H'ART
  (open-air cinema — word-boundary keeps it apart from the `jazz @ h'art` crown).
- **Zomerlicht is the first pick to ride the full new loop**: triage deck (phone) → board →
  Submit → compile → live. The V.10.5 machinery works end to end.
- **The rest of the 73-verdict round was baked re-submission** (0 star changes vs corpus; the
  img:bad notes were R3-scout work already done; the organ-veto reversal already compiled in R3).
  R7's weekly slate correctly went stale (weekend rolled to 07-18) — lead/later/pile skipped.
- **⚠️ topPicks is now 17 against the ≤6 guidance** — prune debt flagged at R6 and R7 is urgent;
  most are dated summer runs, cut back when they expire. 13 of 17 currently match live cards.
- First content ship through the **auto-deploy** pipeline — no manual wrangler step.

## [V.10.5] — 2026-07-16 — Triage: the board's notebook (dev prototype, ?dev=1) + the domain deploys itself
- **The stale-domain bug, fixed.** `refresh.yml` (Thu 13:00 UTC) committed a fresh feed and
  auto-deployed to **GitHub Pages only** — both Cloudflare Pages projects are `Git Provider: No`,
  i.e. manual `wrangler pages deploy`. So every Thursday the *real* domain served last week's
  events until someone remembered. `deploy.yml` now has a **`cloudflare` job** (build:domain →
  `wkndr-app` + `wkndr-landing`) running **parallel** to the Pages job, so a GitHub Pages incident
  can't hold up wkndr.xyz. Needs repo secrets `CLOUDFLARE_API_TOKEN` (Pages:Edit) + `CLOUDFLARE_ACCOUNT_ID`.
- **Triage** (menu → `Taste · dev` → ⚖️ Triage airlock): the airlock queue as a deck. The board
  (`public/curate/`) is a *studio* grid built to COMPARE — pile order, tiers, canon library — and
  on a phone it measures **203 screens of scroll** (620 card els, 329 items). That's not a CSS bug:
  comparing-many and deciding-one are different jobs. Triage is the other job — `pending.<city>.json`
  one card at a time, ★ waves it in / ✕ kills it, on the tram. The board stays the desk.
- **One deck component, two sinks** (the law — `docs/curation-surfaces.md` §2): Triage reuses
  SwipeStack exactly as `Calibrate` does, but Tune writes YOUR on-device profile (`taste.ts`) while
  Triage writes the board's verdict store. Same gesture, different blast radius. A user may never
  write to the airlock — that's the product ("Not another events feed").
- **No payload code was written.** Rather than re-implement the board's `payloadCompact()` wire
  format (two implementations = drift), Triage writes the board's OWN localStorage record
  (`wkndr.curate.<generatedAt>` → `{V, PILE}`) and the board's own Submit reads it — `/curate/` is
  same-origin with the app. Verified end-to-end: 2 swipes moved the board's tally
  `67 starred · 0 killed` → `68 starred · 1 killed` and appeared in its payload as
  `- Zomerlicht… | 3*` / `- Liefde op de Grachten… | KILL`. Same-device only (localStorage).
- `stars: 3` on a right-swipe is load-bearing, not arbitrary: `approvalCheck` only honours star
  anchors at `>= 3`, so a lower value would compile to nothing and a tram "yes" would silently not
  be one. **Triage still can't ship anything** — verdict → issue → *human compile* → restamp → deck.
- **The door** (`app.wkndr.xyz/?curate2026!`): one memorable URL that opens the right instrument for
  the screen — ≥720px → the board grid (`/curate/`), <720px → Triage on the phone (intro skipped).
  Width, not user-agent: the question is "room to compare?". `curateDoor.ts`, fired before render so
  the app never flashes. Separate from `?dev=1` (the design surface). A shortcut, not a lock.
- **Docs**: new `docs/curation-surfaces.md` (who may write to the deck vs a personal profile; the
  mobile finding; method-public/verdicts-private; guest curators parked). STATE.md header corrected
  — it still claimed "deployed to GitHub Pages" alone. 119 tests green.

## [V.10.4] — 2026-07-16 — Thursday pile hardened (the share-ready pass)
- **Restamped the fresh cron feed** (76 → 75): Jazz @ H'ART shipped AGAIN with its reversed
  "Sun 28 – Sun 12 Jul" range — it re-entered through a post-drop stage (👑 TOP pull-back).
  The pipeline now re-runs the broken-range sweep at the choke point RIGHT BEFORE the publish
  gate, so no late door (adapters, heroes, pull-backs) can ship one.
- **fixWhen corrects BOTH ends of expanded ranges** ("Fri 15 – Fri 17 Jul" → "Wed 15 – Fri 17
  Jul"; cross-month "Sat 30 Jul – Mon 2 Aug" → "Thu 30 Jul – Sun 2 Aug"): only the dash's right
  side was being recomputed, so a source's wrong weekday on a range START shipped as written.
  +2 tests (119).

## [V.10.3] — 2026-07-16 — "Tune WKNDR" calibration micro-deck (dev prototype, ?dev=1)
- **The prototype**: menu → `Taste · dev` → ✨ Tune WKNDR opens a paper veil with 8 archetype
  weekends (typographic poster cards, one per category lever) swiped in the app's own deck:
  ★ = "that's me" (+3/token, a more-like), ✕ = "not me" (−2). Done panel reads the model back
  ("Leaning into being outdoors · eat · drink") → **Deal my deck** commits + re-deals, re-ranked
  on-device, instantly. Discard/✕/Esc = nothing written. DEVUI-gated; invisible without ?dev=1.
- Archetypes speak ONLY the taste model's vocabulary (category / outdoor / weatherFit); empty
  area/src keep venue-neighbourhood + publication tokens inert. 👑 TOPs still lead the deck by
  law — calibration bends everything beneath them.
- **Double-fire guard** (real bug, all decks): a fling on a card already mid-exit (hammered
  arrows, double-tapped ✕) fired onSwipe twice → double taste writes. `flying` ref in SwipeStack
  now makes commit exits one-shot; Calibrate also dedupes by pick id.
- `topTastes` no longer renders blank labels for empty tags; `track('calibrate')` funnel event.

## [V.10.2] — 2026-07-16 — OG refresh + solid detail chips
- **og.png** (both surfaces) redrawn for the new proposition: "Your weekend, one swipe away." +
  "Swipe what's on in Amsterdam · share one link · see where you match" — same paper/pill design.
- **Detail-sheet chips solidified**: the translucent glass chips (cat 0.16 / outdoor 0.22 / kid
  0.28 / always 0.55) washed out over bright header photos (mobile drops their backdrop blur for
  perf). Now: paper chip w/ ink text (category), deep green (outdoor), blue (kids), 0.8 dark (always).

## [V.10.1] — 2026-07-16 — "The finish pass" (dates · keyboard · trust)
_The dependable-product optimisation sweep — correctness + access first, discovery + trust second:_
- **whenLooksBroken** (`lib/when.ts`): malformed date ranges are DROPPED, never displayed — a
  descending day-pair with one month token ("Sun 28 – Sun 12 Jul", the real Jazz @ H'ART offender)
  or an explicit start–end running backwards (year-wraps still pass). Filtered at runtime
  (App ingestion), in the pipeline drop-stale pass, and in restamp; +5 tests (117).
- **Freshness surfaced**: the detail's trace line adds "listing checked N hours/days ago" on live
  picks (feed `restampedAt ?? generatedAt`); the menu's "Built from N sources" now DERIVES N from
  the live feed instead of the hand-set roster count.
- **Keyboard + SR deck**: the top card is a real focusable button (Enter/Space opens details,
  full aria-label, focus ring); ←/→ skip/save app-wide when nothing overlays the deck; an
  aria-live line announces each new top card. Save is a ★ everywhere now (button + drag stamp;
  the ✓/+ ambiguity is gone — the card's corner glyph is an expand icon, not a plus).
- **Dialog discipline** (`lib/useDialogA11y`): CardDetail, ShareSheet, both FilterSheets, the
  Inputs sheet and Feedback trap focus, close on Escape, and return focus to their opener;
  the closed header menu is `inert` (out of tab order + a11y tree); ShareSheet gained a ✕.
- **Reduced motion**: MotionConfig `reducedMotion="user"` app-wide; the deck's deal-in/exit
  tumble/nudge collapse to steps under `prefers-reduced-motion` (the ambient field already froze).
- **Matching in the main journey**: the share nudge fires from the FIRST save ("Plan together?" →
  "Share N picks"), not the third; ShareSheet states the privacy promise in-flow ("your link
  contains only your picks · matching data expires after ~14 days") linked to /privacy.
- **Actionable detail**: the organiser CTA is specific ("View event details" / "Check opening
  hours" by datedness); the `verify` flag reads "check with organiser"; Skip/Save labels sit
  under the deck buttons on desktop; forecast chips grew to ~40px targets; Feedback goes
  icon-only ≤480px so it can't crowd "Shuffle for more".
- **Landing (wkndr.xyz)**: hero → "Your weekend, one swipe away." (Tinder framing gone from
  copy + title/OG); section copy per the weather→discover→save→share→match story; closing canvas
  → "Your weekend starts here." + trust line (no account · saves in your browser · links expire);
  LOOK switcher dev-gated (`?dev=1`); stage progress dots (clickable/focusable); full keyboard
  paging (arrows/PageUp/Down/Home/End); reduced-motion = stable stages, no spring flight, frozen
  field (taps still switch forecasts); canonical + JSON-LD.
- **App shell**: canonical link, aligned OG copy, and a web-app manifest (installable; crisp
  redrawn 192/512 icons).

## [V.9.15] — 2026-07-12 — "Compile R7: his 23-card deal"
_Issue #13 — the first drag over the widened pile, compiled + restamped same-hour:_
- **PILE-ORDER, 23 titles**: Kwaku opens (was World Press), then Kaap, Jazz @ H'ART, Hannekes…
  all matched (0 unmatched), stamped 1–23; Pllek Urban Beach & Cinema 👑 deals #24 right after.
- **3 new 👑s**: Kwaku (★4), Jazz @ H'ART (★5), Pllek Urban Beach & Cinema (★4 — the cinema
  card; the canon waterfront-hang stays a keep). topPicks now ELEVEN vs the ≤6 guidance — all
  his explicit calls; prune round due when the summer crowns expire.
- **Stoornis of my life: ★4 + KILL = RESTED** (fatigue ≠ taste, the R3 law) until 26 Jul —
  past the show's close, so the run ends before it returns. Feed 79 → 78.

## [V.9.14] — 2026-07-12 — "The pile pool widens"
- Ness: "can we add more fresh elements I have liked so I can reorder." The WEEKEND PILE grows
  from the 10 projected openers to **24 draggable cards**: the openers + everything LIVE in the
  feed (all of it his by definition — the airlock law), in serve order. His ⠿ drag over the
  wider pool becomes the next opening sequence, exactly as before.

## [V.9.13] — 2026-07-12 — "Compile R6: the hot-weekend slate goes live"
_Issue #12 (79 verdicts) — Ness's selects on the summer supply, compiled + restamped same-hour:_
- **3 new 👑 TOPs from the airlock**: Pluk de Nacht Film Festival (open-air cinema),
  Kaap Amsterdam, Strand Zuid — promoted into the feed with keeps ★5; topPicks now 8
  (the ≤6 guidance is breached on Ness's own call — prune when the summer TOPs expire).
- **Hannekes Boom ★4** promoted, wearing the exact image URL Ness supplied (curated pin).
- **Mokumboot ▲ LEAD ★5 — from the BENCH**: restamp gains a promote-only bench path
  (approved candidates join the feed like pending ones and leave the bench file; nothing
  demotes). It sat unreachable — restamp only knew the airlock.
- **Curated pins now apply on the 90-second fast-path** (restamp wraps + overrides), so an
  img-url verdict lands immediately: BRET's night shot + Hannekes are live now, not Thursday.
- **Removed a stale second BRET pin** (a parallel ship had pinned the bret.bar garden og:image —
  the exact photo rejected three rounds running; first-match-wins had masked it).
- **Waterkant**: img:bad, left unstarred — stays in the airlock; exemplar records why.
- Feed 74 → 79 · deck: dragged pile #1–10 → Kaap/Strand Zuid/Pluk de Nacht 👑 #11–13 → Mokumboot ▲ #14.

## [V.9.12] — 2026-07-12 — "Summer runs in the lens + the big-screen facet"
_Ness: "Where are the outdoor cinema picks and world cup watching picks?? The lens is serving
mainly indoor activities." Two real content gaps:_
- **SUMMER RUNS join the lens**: the dated-only rule was excluding the entire outdoor seasonal
  supply (20 outdoor picks in the feed, nearly all "All summer"/"Until 30 Aug"/"Daily" — on a
  28° HOT weekend the weather-right slice was screening out the weather-right cards). On
  HOT/WARM the lens now adds a second tier after the dated slice: outdoor + active + seasonal
  `when` (a "summer" token or an until/through run) — open-air cinema, urban beaches, terrace
  programmes, badged `LENS · SUMMER RUN`. Year-round outdoor staples (markets "Mon–Sat",
  Efteling "Daily") stay out; the lens stays tight. Live result: 7 dated + 7 summer runs.
- **The big-screen facet (websearch)**: the 2026 World Cup final is Sun 19 Jul and the pipeline
  had NOTHING for it — no facet hunts screenings. New static facet: World Cup public viewing /
  watch parties / fan zones + major sport screenings (evergreen phrasing — outlives the Cup).
  Lands cards in the airlock with Thursday's cron, which builds exactly the final's weekend.
- Board eyebrow now carries its own version (V.9.10) — GitHub Pages caches the board HTML for
  10 min, and a stale open tab reads as "the board is wrong"; the eyebrow makes it visible.

## [V.9.9] — 2026-07-12 — "The board reads the deck, not a mirror"
_Ness: "why is my curation board STILL different from the app" — root cause found and killed:_
- **The bug:** the board's WEEKEND PILE was an inline tier-mirror (tier → judge → buzz) that
  **ignored `pilePos`** — Ness's own compiled ⠿ drag (weekly.json, R4) ruled the actual app deck
  (World Press #1 → NL–Japan #10) while the board projected a phantom order. It also knew
  nothing of weather fit, the sun bonus, freshness weights or `diversify`.
- **The fix (structural, kills the drift class):** the pipeline now **stamps `servePos`** on
  every published pick by running the app's OWN serve pipeline (`orderServed ∘ diversify ∘
  rankPicks` — forecast weekend mode, seed 0, no taste) at build/restamp time
  (`stampServeOrder` in lib/pipeline; `weekendMode` moved there so refresh + restamp share the
  lens). The board just reads the stamp — one code path, one truth. Fallback to the old
  projection for pre-stamp feeds. The app ignores the field.
- **Still divergent on purpose (runtime realities):** live weather at open ≠ forecast, the
  on-device taste profile, the Shuffle seed, and the past-midnight `whenIsPast` runtime guard.
- Tests 98 → **101** (stamp completeness · pilePos rules the stamp · null-mode fallback).

## [V.9.8] — 2026-07-12 — "Compile R5 + the lost verdicts of #8/#9"
- **R5 (issue #11, 73 verdicts, all ★3–5 — the confirmation sweep, no kills):** most ★4–5 were
  already carried in canon2/corpus (the pool has converged); the gaps got ~15 new `starredKeeps`
  (the un-starred evergreen floor: markets, day-trips, Pllek, Café Chris, Patta, X Bank,
  Brouwerij 't IJ…) and 5 ★3 `starAnchors` (Muiderslot, Dappermarkt, Mr. Watson, Chef's Evening,
  Cinair Europe).
- **The lost verdicts:** issues #8/#9 (filed 7/09–7/10) were never read; #10's compile superseded
  all but FOUR — **Île de Bisous KILL** (filed twice, yet it was *leading the airlock*; now vetoed,
  with an ascii twin), **Hortus Summer Tour KILL** (title-scoped — the Hortus itself stays ★5),
  **Martin Parr: Very Modern and Rather Ugly +CANON** (Foam, `Until 12 Aug` — canon2's one dated
  entry, auto-retires via whenIsPast), and **Queer Amsterdam: The Pink City 👑 TOP ★5** (the
  WorldPride flagship at the Nieuwe Kerk — crown armed; the 7/11 crawl dropped the card, it
  activates when an adapter re-surfaces it).
- **BRET image, third strike:** the "venue's own photo" fallback resolved to bret.bar's og:image —
  a sunny garden-café shot, the wrong story for a club night. BRET is now PINNED in `curated.ts`
  to I amsterdam's in-the-booth night shot (DJ, crowd, hanging plants — checked by eye);
  the imageExemplar records the escalation.

## [V.9.5] — 2026-07-11 — "The lens: this weekend × this weather"
_Ness's board-IA call (2026-07-11): the Curation Board's first section is the tight slice._
- **THE LENS leads IN ROTATION** (before THE WEEKEND PILE): only picks with a concrete date
  INSIDE the coming weekend window (happens, opens, or closes Fri–Sun — deliberately tighter
  than the pipeline's `datedThisWeekend`, which also admits any "until <far future>" run; 16 of
  23 on the 2026-07-10 feed were long-run exhibitions) AND fitting the forecast mode — the same
  open-meteo weekend read as `weekendMode()`, through an inline mirror of `classify`, so lens,
  airlock order and deck ranking agree on what the weekend IS. Header names it ("THIS WEEKEND
  (11–12 JUL) · 27° HOT — the dated, weather-right slice"); on HOT/WARM the outdoor picks lead.
  Full verdict controls; cards also ride the pile/feed below — the badge marks the pile overlap
  (`LENS · PILE #n`), verdicts share `V[p.id]` so a ★ here counts everywhere. Forecast fetch
  fails soft → dated-only lens.
- **Seasonal-venue carve-out in web-search** (the open-air-cinema zero): the systemPrompt's
  exact-date rule was discarding venue-class seasonal finds — the armed open-air facet returned
  0 picks. New rule: a confirmed-running seasonal venue ships with an honest `when` like
  "All summer · evenings" (freshness `always`), never an invented date.
- **The sun bonus in `rankPicks`**: on a HOT/WARM weekend an OUTDOOR pick dated THIS weekend
  (mirrors the pipeline's `datedThisWeekend`) gets +3 inside its weather tier, so the deck front
  matches the lens. Seasonal "All summer" venues stay evergreen — no bonus without a concrete
  date. Scores now computed once per pick (decorate-sort), not per comparison.
- Tests +2 (sun-bonus invariants: HOT-only lift, no bonus without a date) — suite at **98**
  alongside V.9.4's relay tests.

## [V.8.16] — 2026-07-10 — "The airlock: nothing ships unapproved"
_Ness's call (2026-07-10): the live deck is 1:1 with his Curation Board approvals. The morning's
stopgap (hand-filtering the feed to approved-only) becomes pipeline law:_
- **The split**: after the FULL funnel (balance, slate, tops — pending cards are exactly what
  would have shipped), refresh divides live picks by one shared `approvalCheck` (lib/pipeline —
  refresh, restamp and the test all use the same predicate, so it can't drift): starredKeeps /
  topPicks / ★3+ anchors / this weekend's slate (pile loose-match + lead/later) / a hero / buzz≥3
  publish with canon as before; everything else waits in `pending.<city>.json` — full cards,
  already imaged + judge-scored, nothing wasted.
- **The queue is topical first (his explicit ask)**: dated-this-weekend → fits the weekend
  forecast mode (open-meteo run through the app's OWN `classify`, so "weather-related" agrees
  with the deck's ranking) → judge score → buzz. Backfilled from the 2026-07-10 crawl: **71
  pending**, HOT weekend → Île de Bisous / Queer Market XXL lead.
- **Board: NEW FINDS opens with THE AIRLOCK** — pending cards render with the full verdict flow
  (★/👑/kill/note ride Submit like any card); bench/trending hide airlock twins.
- **Restamp promotes — and demotes**: a compile's new star/👑/pile moves matching pending picks
  into the feed with image + judge score intact (tokKey-deduped); a lapsed approval (an expired
  weekly slate, nothing else holding the pick) returns it to the queue, so the invariant holds
  BETWEEN refreshes too. `generatedAt` preserved on both files (board rounds don't reset); an
  abstain writes neither.
- **Invariant test** (`tests/airlock.test.ts`): no live-id pick in a published feed without an
  approval match — audited at the feed's own timestamps, so a mid-week weekend roll can't
  false-red the cron gate. Tests 75 → 80.
- Bycatch: the restamp pass enforced a veto the stopgap had let through (Hortus summer evenings —
  vetoed AND anchor-approved; the kill wins over the star): live feed 75 → 74 picks.

## [V.8.15] — 2026-07-10 — "The weather lens + the 90-second restamp"
- **Weather-aware facets**: the pipeline now checks the weekend forecast (open-meteo, keyless)
  before searching — ≥22° & dry arms 'open-air cinema' + 'swimming/urban beaches/terraces on the
  water'; wet weekends arm the cosy-indoor pack. Fixes the R4 complaint receipt: a 29° weekend
  with ONE open-air cinema in the feed while YLBB's front page led with 8 (the Phase 2 trim had
  cut the seasonal facet — wrong lesson; season it, don't kill it). Fails soft.
- **restamp.yml — the taste fast-path**: re-applies corpus + weekly slate (kills, stars, tops,
  dragged pile) to the LAST published feed and republishes in ~90s — no crawl/LLM/images. Compile
  → live drops from ~15 min to ~2. `generatedAt` preserved (a restamp is not a new board round);
  abstains if the result would be broken-thin. rxOf moved to lib/pipeline (shared).
- Known gap, backlogged: the LBB adapter reads the 4 agenda articles only — editorial shortlists
  ("8 X openlucht bioscopen") never enter deterministically; the weather facet now catches their
  content via search.

## [V.8.14] — 2026-07-10 — "Pile order survives retitles"
- R4's dragged order stamped only 7/10: exact title matching lost Kwaku ("- Weekend 1" →
  "Opening Weekend" on re-crawl), Nara Nara and Jollof (descriptive suffixes trimmed). New
  `titleLooseMatch` in the pipeline (normalized containment, else ≥75% token overlap on the
  tokKey stoplist) replaces rxOf for PILE-ORDER; unmatched pile entries are now named in the
  slate log line instead of vanishing. Tests pin all three real losses. Tests 71 → 75.

## [V.8.13] — 2026-07-10 — "R4 compiled: the first dragged pile order goes live"
_Round 4 = issue #10 (78 verdicts, filed 24 min after the V.8.12 fresh-mix feed — his first round
on the new deck, and the first with a hand-dragged PILE-ORDER). Compiled per his "most recent
round only" call; #8/#9 left open (superseded — most of their verdicts recur in #10):_
- **PILE-ORDER → weekly.json `pile`** (weekend 2026-07-11): World Press Photo opens, Kwaku #2,
  ARTIS hand-demoted to #9 — stamped as `pilePos` next run; the deck deals it verbatim.
- **2 vetoes**: Pink Dance's dance, Mengelmoes Amsterdam.
- **2 ★5 +CANON** → picks.canon2.ts: **ARTIS-Aquarium gets its own card** (closes STATE flag 8a —
  R3 had routed the star to the Royal Zoo entry) + **Wild swimming: Gaasperplas & co** (free,
  outdoor, the hot-weather ace). Both authored from their live feed cards' verified images.
- **Milkshake resolved**: the KILL from #8/#9 is GONE in this round — compiled as ★3, crown kept,
  image already scout-replaced. Anchor records the 3★-on-a-crowned-pick signal.
- **Kwaku image pinned** to the exact URL Ness supplied on the board (first img-url verdict
  through the new one-click path) · **BRET flyer mismatch** taught to the vision pass ·
  new keeps: Nxt Museum ★4, Museum Van Loon ★4 · ~70 other stars confirmed carry-forward.

## [V.8.12] — 2026-07-10 — "Freshness: the weekend is never capped out"
_Diagnosis: the crawl was never stale (30 RA nights + 31 LBB agenda items on 2026-07-09) — the
funnel compressed it to 45 live and the app diluted with 43 evergreen (61%). Three levers:_
- **Dated-this-weekend = cap-exempt** (pipeline): a pick whose dates overlap Fri→Sun bypasses the
  per-source cap AND the category balancer — caps exist to stop source floods, not to throttle the
  weekend. Keyless dry-run: 218 crawled → 93 live kept (was 45), 80 weekend-dated exempt.
- **Phase 2 shipped** (roadmap item): web_search demoted from spine to serendipity edge — 10 → 3
  facets (Volkskrant, the one trusted source without an adapter + new eat/drink openings + big
  outdoor one-offs). The YLBB/iams/RA facets were re-finding what their deterministic adapters
  already crawl; retired facets stay commented for one-line re-enable.
- **Serve-time evergreen trim** (app): canon backfill floor 8 → 5 on rich weeks, and the timely-vs-
  evergreen freshness gap widened (weekend 1 → 1.5, new 1.5 → 2, ending 1.2 → 1.6, floor 0.6 → 0.5)
  so starred canon can no longer outrank dated events on editorScore alone.
- Dry-run bonus: the publish gate correctly ABSTAINED on the local no-images run — the V.8.6
  safety tail observed working.

## [V.8.11] — 2026-07-10 — "Drag the pile"
- **The WEEKEND PILE is draggable** — grab the ⠿ grip on any pile card and hand-set the opening
  order. Badges renumber live (crowns ride along), the order persists per round (localStorage,
  same feedKey as verdicts), and it rides Submit → GitHub as a `PILE-ORDER |` line. The full loop:
  drag → submit → compile writes `taste/weekly.json.pile` → refresh stamps `pilePos` → the app's
  `orderServed` deals those cards FIRST, in exactly that order, above every tier (the human
  override — time gates don't apply to a hand-placed card). Expires weekly with the slate, like
  LEAD/LATER. Native DnD from the grip only, so card inputs/links stay usable (desktop-first).

## [V.8.10] — 2026-07-10 — "The board's pile projects what the app actually serves"
- The Curation Board's WEEKEND PILE had its own ungated copy of the serve order (TOPs always
  first, live-crawled picks only) — so after V.8.7–V.8.9 it disagreed with the deck: the app led
  with ARTIS while the board still crowned Milkshake #1 and could never show canon TOPs at all.
  The pile now mirrors `orderServed` (inline `activeBy` mirror of the date brain — keep in step)
  and pools live + TOP-stamped canon. Board explainer copy updated ("leads always" → "leads on
  its own weekend").

## [V.8.9] — 2026-07-09 — "The horizon: the whole deck front is THIS weekend"
- V.8.7's TOP gate generalized: ANY pick not active by the served weekend — TOPped or not — now
  sinks to the **horizon** at the back of the endless deck (was: only TOPs were kept from
  *leading*; WorldPride/Milkshake/Dekmantel still surfaced at positions 3–5). Still in the deck
  and the list for ticket-buyers; future TOPs head the horizon so they resurface first as their
  weekend arrives. `orderServed` tiers: 👑active → ▲LEAD → middle → ▼LATER → horizon (TOPs first).

## [V.8.8] — 2026-07-08 — "Batch-share readiness: the unfurl, the funnel, the first 45 seconds"
_Prep for the first larger share round (the weekend batch). The app is the stimulus; this ship
makes the experiment produce data:_
- **The unfurl** — og:title/description/image + twitter card + favicon + apple-touch-icon
  (`public/og.png`, generated in the brand language: cream, Helvetica, dot + wordmark, temp pill).
  A WKNDR link in WhatsApp/iMessage now lands as a designed card, not a naked URL.
- **Funnel metrics, dormant** — `lib/metrics.ts`: GoatCounter beacon (cookieless, no banner) with
  the validation-log's exact columns as events: `link-open` → `first-swipe` → `save` →
  `match-slam` → `plan-sent` → `return-leg` (+ `intent-yes/no`). **No-op until the site code is
  set in metrics.ts** — create the goatcounter.com site, paste the code, ship.
- **The intent prompt** — the mom-test question, in-flow: after 10 stack swipes, once ever per
  device, the under-header bar asks "Would you actually do any of these?" 👍/👎 → same Formspree
  inbox as the feedback widget (`prompt: weekend-intent`). Yields to the undo pill + share nudge.
- **First-run swipe nudge** — 0.9s after the deal-in settles, the top card leans 34px and springs
  back (rides the real drag MotionValue, so tilt/wash react true). Once per device, on whichever
  deck a user meets first (browse stack or match game). Aborts if they're already dragging.
- **The moat, said out loud** — once the live forecast lands, the intro sub reads
  "29° this weekend — these picks are ranked for it." instead of generic swipe copy.
- **Cold-eye copy** — detail sheet: "Open at Fresh find" → "Open the page" (provenance stays in
  the trace line); venue line no longer repeats the title for venue-is-the-pick rows.
- (Tier-3 items — deal-in stagger, match haptics — turned out to already exist. Good sign.)

## [V.8.7] — 2026-07-08 — "TOPs wait their turn + the feed boundary hardens"
_The rest of the review's recommendations, done in one pass:_
- **👑 TOP weekend gate**: a TOP keeps its permanent status + "Top pick" pill, but only OPENS the
  deck once its event is active by the end of the weekend being served (`whenActiveBy` +
  `upcomingWeekendEnd` in the date brain; `orderServed` moved to `weather/modes.ts` and gated).
  Milkshake (25–26 Jul) and Dekmantel (30 Jul–2 Aug) no longer lead the 11–12 Jul deck — they ride
  the ranked middle until their own weekends. "Opens 8 Jul" / "Daily" / "Until …" TOPs still lead.
  Closes STATE open item 8b.
- **Feed boundary hardened** (the V.7.11 class, closed at the blast radius this time):
  `sanePicks` (`lib/feed.ts`) drops rows missing id/title at ingestion instead of letting them
  corrupt React keys + the save/swipe Sets; a FAILED feed fetch no longer memoizes as fetched (one
  boot-time network blip used to pin the whole session to the stale bundled snapshot); and a
  branded ErrorBoundary turns any remaining render crash into "reload — your saves are safe"
  instead of a white screen.
- **README truth pass**: root README + root package.json described the pre-V5 experiments era;
  both now describe the shipped app (STATE.md first, bun workflow, repo map as it actually is).
- Tests 54 → 69 (orderServed gate, whenActiveBy, upcomingWeekendEnd, sanePicks).

## [V.8.6] — 2026-07-08 — "Review hardening: one date brain + CI that can't fake green"
_The 2026-07-07 full-build review (both halves graded B+) produced four fix PRs; all landed (#4 #5 #7,
then #6 rebased over #7 — they rewrote the same `datesIn` lines):_
- **CI can't fake green** (#4): the weekly refresh's push-retry loop now fails RED when all 3 attempts
  are exhausted (it used to fall through and exit 0 — feed built, never published, run green), and the
  healthchecks.io "ok" ping moved from refresh.ts to the workflow's LAST step, so it vouches for
  pipeline → commit/push → deploy-trigger, not just the pipeline. `isLive` lists every live id prefix
  (llm/web/**rss/sk**) so a future source can't skip the image pass + imageless gate.
- **Undo un-teaches** (#5): `revertSwipe` = exact inverse of `applySwipe` (zeroed tokens dropped, so
  `hasTaste` stays honest) — a mis-swipe no longer biases ranking forever. And a share-sheet cancel
  (`AbortError`) is a decision, not a failure: it no longer overwrites the clipboard + flashes "copied".
- **One date brain** (#7): `weekend.ts`/Itinerary/.ics and the pipeline's stale-filter all parse `when`
  through `src/lib/when.ts` now — kills the split-brain where "Fri–Sun 5–7 Jun" grouped under Friday in
  the saves dock, "Anytime" in the Itinerary, and vanished from the exported .ics. The >45-day
  next-year rollover is now gated to open-run phrasings ("Until 15 Jan") or near year-wrap, so a
  stale feed's events die as past instead of resurrecting as next year's. Bonus: all-day .ics DTEND
  rolls month boundaries (31 Jul + 1 = 1 Aug, not 32 Jul).
- **Expanded ranges date on their START day** (#6): "Sat 25 – Sun 26 Jul" (the live Milkshake card's
  phrasing) only matched its second day — the weekday after the dash broke the range pattern, dating
  the whole weekend by its END day. An optional dash+weekday hop in `datesIn` fixes it. Tests 32 → 54.

## [V.8.5] — 2026-07-04 — "First round compiled from a GitHub issue"
_Ness filed curation rounds via the Submit → GitHub button (issue #3, the compact one-click format).
Net-new decisions beyond R3, compiled:_
- **4 👑 TOP escalations** → `corpus.topPicks`: Milkshake + Dekmantel (future festivals — armed for
  their late-Jul weekends), 't Lemmeke (current), and ARTIS (routed to the canon **ARTIS Royal Zoo**
  entry — Ness starred the weak bench "ARTIS-Aquarium" card; same visit, real link, guaranteed).
- **2 +CANON approvals** → `picks.canon2.ts`: Le Petit Bouillon d'Amsterdam (★4) + Fyka (★5, graduated
  out of `scouted.json`). Both images floor-verified.
- **2 more RESTED** (★4+KILL fatigue): Pure Markt (+ image swapped to his replacement for its return)
  and TREK Foodfestival (the variant the "festival trek" match missed).
- **VriendenLoterij Summer Concerts** ★4 → starredKeep.

## [V.8.4] — 2026-07-04 — "Submit → GitHub is truly one-click"
- **Compact ASCII payload for the prefill URL** — the pretty payload (★, 👑▲▼, ·—"") ballooned once
  URL-encoded (each ★ = 9 chars), so any real 80+ verdict round overflowed GitHub's ~8KB URL cap and
  fell to clipboard-+-paste. A separate `payloadCompact()` uses plain ASCII (`4*`, `TOP`, `KILL`, `-`);
  `img:good` (the no-action case) is omitted from the URL for headroom but stays in Copy/Email. A
  128-verdict worst-case round now encodes to ~7.3KB — one click, fully prefilled, no paste. Clipboard
  fallback still catches an extreme round; nothing can silently truncate.
- Dropped the stale hardcoded "R3" round label (Copy/Email/Formspree subject now date-based).

## [V.8.3] — 2026-07-04 — "The loupe on the board + no more crop-of-a-crop"
- **Board loupe** — click any card photo on the Curation Board → the ORIGINAL, uncropped, full-screen
  with true dimensions (and a "LOW RES for the card" verdict when it can't survive the render). The
  judging tool now shows the whole frame — Ness's actual ask.
- **Detail-sheet double-crop fixed** — the sheet's 3/2 landscape header was fed the card's 800×1200
  PORTRAIT render: a crop OF a crop showing the middle ~44% ("the crop is too tight"). The header now
  re-derives a 3/2 render from the ORIGINAL via the same wsrv pipeline — one crop, right aspect.

## [V.8.2] — 2026-07-04 — "Submit → GitHub + the focus view"
- **Submit → GitHub (board)** — one click files the verdict round as a labeled issue on the repo
  (prefilled issue URL, no token, Ness is already signed in): durable, versioned, and the canonical
  inbox Claude compiles from. Payloads past GitHub's ~8KB URL cap auto-fallback to
  clipboard-+ -paste-ready issue. Formspree demoted to "Email" backup.
- **FOCUS view (app)** — the card's detail sheet now carries a ⤢ button on the photo: full-screen
  lightbox showing the ORIGINAL, uncropped image (unwraps the wsrv proxy's baked 800×1200 crop),
  true dimensions captioned, tap to dismiss. The only place the whole photo is visible — the
  curator's loupe, and the vibe-check before committing an evening.

## [V.8.1] — 2026-07-04 — "Round 3: the REST tier + fatigue ≠ taste"
_81 verdicts converted. R3's new signal: ★4+KILL = "good event, seen it enough" — a third kill class._
- **`corpus.rested`** — fatigue-benched events (Festival TREK, Museum Market, Land Art Weekend, until
  25 Jul): dropped from feed AND bench while active, then eligible again. Anchors/keeps stay — taste
  intact, only exposure rests. Runs after starredKeeps so carry-forward can't resurrect.
- **Taste reversal honored** — 'lunchtime organ concert' veto REMOVED (Ness ★4'd the Waterlooplein
  series); Westerkerk lunchconcerten veto stands. Anchor records the nuance: the R1 kill was about
  church self-promo listings, not the format.
- **Wynand Fockink deleted at source** — ★1 twice; the R2 veto couldn't touch the static row (it kept
  haunting the board library + bundled fallback). `export-canon` now applies the veto too — 6 more
  R1-killed statics stopped haunting the library.
- **6 images replaced via scout** (all verified, 3 native portrait): Strand van Oost (own-site
  golden hour 1707×2560), De Kas (greenhouse at dusk 2500×3764), Nxt Museum (Motherflock installation
  w/ visitors), Red Light Records (pink-neon shop interior 1536×2048), Milkshake (real crowd, not the
  campaign graphic), BRET (venue pinned — its RA flyers were wrong twice).

## [V.8] — 2026-07-04 — "Low-res detection + dupe suppression, everywhere" (tag `v8.0`)
_Ness: "detect resolution / flag low res — I still see bitmapped images. And I still see dupes." Both
root-caused and closed at every layer._
- **The low-res back door, shut** — `isGoodImage` used to PASS any image whose dimensions it couldn't
  parse (the tiny-organiser-upload class slipped the 700px floor unverified). Now: 256KB probe range
  (EXIF-heavy JPEGs), WEBP-lossless parsing, and **unparseable = reject** (fallbacks: gather → bank).
- **Render-aware upscale guard** — the card renders 800×1200 cover; any source stretching >1.6×
  (e.g. landscape 1200×720 — passed the old floor on width!) is rejected. Vision screens now also
  reject visibly pixelated / upscaled / compression-wrecked images.
- **LOW RES flags on the board** — every fresh-facing card probes its ORIGINAL image (unwrapping the
  wsrv proxy that masks true size) and wears a red `LOW RES · w×h` tag when it would stretch >1.6×.
  First pass flagged 22 — including several of Ness's own picks (MENDO 480×634, IJ-Hallen 660×440):
  fine as thumbnails, mush at card size. The better-image field is the fix lever.
- **Dupes: 43 cross-surface twins found and closed** — (a) board sections now suppress token-set twins
  shown in an earlier section (canon-in-feed no longer double-renders; TRENDING festivals no longer
  re-appear on the bench) with "N hidden" counts; (b) `dedupe()` PASS 2.5: word-order/punctuation
  twins collapse ("Openluchttheater Vondelpark" ⇄ "Vondelpark Openluchttheater"); (c) bench filter:
  token-set + ≥8-char prefix vs published; (d) canon-candidates pruned of the 12 already-approved;
  (e) veto: Hortus-Botanicus-summer-evenings EN variants + "Live at Amsterdamse Bos" (killed
  Bostheater programming under another name).

## [V.7.19] — 2026-07-03 — "THE WEEKEND PILE — weekly slate controls"
- **Board opens with THE WEEKEND PILE** — the 10 projected opening cards, numbered in serve order
  (top → lead → editorScore → buzz), so Ness SEES the top of the pile before users do.
- **▲ LEAD / ▼ LATER** — ephemeral weekly controls on every card: LEAD puts a card in the pile THIS
  weekend only (guaranteed into the feed, opens the deck just under 👑 TOPs, score floor 9); LATER
  sinks it to the back without killing it. Live in `taste/weekly.json` keyed to the upcoming Saturday —
  a stale file is ignored, so weekend calls auto-expire. Permanent taste stays in corpus.json.
- **Deck pile order** (served deck + match deck): 👑 TOP → ▲ LEAD → ranked middle → ▼ LATER, stable
  partition preserving the de-clustered order within each tier.
- The full ladder: kill → ★1-3 → ★4-5 (protected) → +CANON (library) → ▲/▼ (this weekend) → 👑 (always).

## [V.7.18] — 2026-07-03 — "👑 TOP escalation"
- **Board 👑 TOP button** — the tier above stars: escalates a pick to guaranteed deck-lead. Verdict
  flows → `corpus.topPicks` → pipeline stamps `top` + editorScore 10 and GUARANTEES the pick into the
  feed (pulled back from the pre-publish pool / bundled canon if the balance stages cut it) →
  `feed.topMatches` re-stamps canon picks at app ingestion → the served deck (and the match deck)
  stable-partitions tops to the front → the card wears a glowing **"Top pick"** pill (outranks every
  other signal). Verified live in preview: a topped pick led the deck with the pill on.
- **Veto patch** — "De Hortus Summer Evenings" (EN twin of the killed Zomeravonden) leaked the feed;
  both EN forms vetoed.

## [V.7.17] — 2026-07-03 — "Board v4: rotation vs. trending, real links"
- **Curation Board tabs** — `IN ROTATION` (this weekend's feed + the full 147-pick canon library, green
  ✓ APPROVED badges on Ness's 23) vs `NEW FINDS` (TRENDING inbox → bench → canon candidates).
- **TRENDING inbox** — Volkshotel's summer-festival guide scouted + audited: 5 future festivals flowed in
  (De Parade, Het Landjuweel/Ruigoord, Milkshake, WorldPride Amsterdam, Dekmantel — all images + links
  verified); 3 skipped as already-past (Lentekabinet, Festifest, Keti Koti), OLT skipped as already known.
  Also appended to `scouted.json` so they enter the live feed when their weekends arrive.
- **Real links, not discovery links** — 15 places re-pointed from magazine roundups to their own sites
  (canon2 ×8: misterwatson.nl, bouillondamsterdam.nl, rotate.nl, rem.amsterdam… + scouted ×7). Board card
  titles now link out (↗) so bad links get caught on sight.
- **`export-canon.ts`** — dumps the full rotation library to `data/canon.amsterdam.json` on every build
  (wired into `bun run build`), so the board can never drift from the code.

## [V.7.16] — 2026-07-03 — "Round 2: the canon doubles by hand"
_Curation Board round 2 — 115 verdicts — converted into product. The Taste Engine loop closed a second
time: his approvals became code, his kills became law._
- **22 canon approvals → `src/data/picks.canon2.ts`** — 23 rows, the hand-trained half of the
  evergreen canon: De Kas, Droog, Rush Hour, MENDO, Red Light Records, De Baanderij, REM Eiland,
  Tacite, TÊTE, Glou Glou, Brouwerij 't IJ, Museum Van Loon, Nxt Museum, Amsterdamse Bos… Each
  scout-verified image + 4 of Ness's own replacements; `stars` field carried. 11 canonized places
  graduated OUT of `scouted.json` (no live/canon duplicate cards).
- **The club-night purge** — 20 generic weekly nights killed in one pass while BRET + POISED got ★4:
  new corpus rule ("club nights need a curatorial identity"), 30+ new veto entries.
- **Word-boundary taste matchers** — veto + starredKeeps now match on `\b` bounds ("Monne" can't hit
  "Monnickendam", "BAK" can't hit "bakkerij"; non-ASCII edges like "ekō"/"jøase" keep matching).
- **Kills honored in code** — Homelanding hero removed; Lindengrachtmarkt out of the evergreen file;
  Monne/Oatly/Bostheater/Hortus-Zomeravonden vetoed; stale pins (homelanding, bostheater — which also
  shadowed "Amsterdamse Bos" — hortus) deleted. EN "Netherlands–Japan" twin removed from scouting
  (dupe of the starred Dutch-titled show, not a taste kill).
- **Verdicts baked** — board now shows all 144 merged R1+R2 judgments as badges.

## [V.6.3 → V.7] — 2026-06-29 → 07-02 — "The pipeline era: deterministic variety, self-checking feed, house look"
_The arc: two deep-research passes (docs/pipeline-redesign.md → docs/pipeline-architecture.md +
docs/source-map.md) turned the scrape-and-pray refresh into a deterministic, self-checking content
engine. Sixteen ships in four days; the granular story is the git log._
- **V.6.3** — Feedback widget wired to Formspree (confirmed live).
- **Ranking that reaches the user (V.6.4)** — `editorScore` (a Sonnet editorial judge,
  `ANTHROPIC_JUDGE_MODEL`) + `popularity`/`popBoost` + `EVERGREEN_FLOOR` as real terms in `rankPicks`;
  `diversify()` moved onto the SERVED deck (the old call was discarded by re-segmentation → category
  waves); adaptive RESERVE (canon backfill widens on thin weeks).
- **Resident Advisor adapter (V.6.4)** — keyless GraphQL, exact dates + flyers + `attending`;
  **protected 2-slot lane (V.6.19)** so club nights never rank out of the feed.
- **Runtime date guard (V.6.5)** — `whenIsPast` filters the deck in the browser: last weekend's events
  can never render, however stale the feed.
- **Imagery, the long war (V.6.6–V.6.18)** — performer portraits + resolution floor + stricter vision
  verify (V.6.6); curated pins (V.6.7–6.8); Serper wired-dormant (V.6.9); wsrv.nl portrait wrap for
  every image + stock/watermark/malformed-URL screens + dead-image self-healing (V.6.11–6.14); vision
  QA net (V.6.15); **the root-cause fix (V.6.17): TRUST structured-source images** — the safety layers
  were discarding organiser posters and re-scraping junk; now they flow untouched, **screened only for
  the logo/blank class** (V.6.18, keyless URL smell-test + narrow vision sanity). House treatment
  (V.6.12): weather-keyed soft-light glaze + grain on both card faces.
- **Guaranteed heroes (V.6.10)** — hand-maintained must-sees injected + cap-exempt (web-search is
  non-deterministic; Bruno Mars vanished between runs). Auto-expire via date filters.
- **Publish gate + observability (V.6.12)** — the run grades itself: hard-fail only truly-broken
  states, abstain → last-good keeps serving; health line in `$GITHUB_STEP_SUMMARY`; optional
  healthchecks.io dead-man ping.
- **I amsterdam adapter — the variety engine (V.6.16)** — keyless schema.org Event JSON-LD crawl of The
  Feed Factory (~1,500 live events, 7 of 9 categories, real per-event images); multi-source dedupe:
  structured picks key by stable id, keyless dups FOLD INTO their structured twin (corroboration =
  buzz, structured facts win).
- **Variety + talked-about (V.6.18–6.19)** — I amsterdam capped 5/category; steeper cross-source
  buzzBoost + the editorial judge up-weights multi-publication events; specific event links (never the
  generic index); evergreen canon fill-in (markets 0→8, day-trips 4→9, venues 2→5).
- **Tests + living docs (V.7 — the roll)** — 31-test `bun test` guard over `when.ts`/`dedupe`/`rankPicks`,
  gating the CI refresh; STATE.md + this changelog brought current.

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
