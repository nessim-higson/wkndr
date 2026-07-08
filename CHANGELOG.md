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
