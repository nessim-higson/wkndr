# WKNDR — STATE (catch-me-up snapshot)

_Living "where are we right now" doc. Updated 2026-06-18. For strategy + the bigger backlog see
`docs/backlog.md`; for the full version history see `CHANGELOG.md`; for onboarding see `CLAUDE.md`._

## Live right now
- **App: V.5.14** — https://nessim-higson.github.io/wkndr/ (cache-bust `?v=V.5.14`)
- **`?dev=1`** reveals the full exploration surface (all views, ambient-look switcher, city picker).
- **Full pre-MVP build frozen** at `/wkndr/versions/v4-10/` (git tag `v4.10`) for side-by-side.
- Milestone tag `v5.0` = the MVP baseline.

## Product posture — V.5 is the MVP trim
One view (**Stack** only), one ambient look, **Amsterdam only**, taste engine runs silently (off the
surface). Menu = Your list · Plan together · Filter · Weather. Fan/List/looks/cities all live behind
`?dev=1`. Desktop card geometry is dialed to Ness's guide lines (V.5.10): top rides just under the
nav/undo pill (~13vh), fills down (max-height 70vh, ~594px), with the ✕/★ controls + "Shuffle for
more" lifted ~9vh off the bottom edge. Weather-peak pill reads **"Perfect this weekend"** (not
"today"). Intro: lead
"Tinder your events." + a matching subline.

## The boomerang (share → match → confirm) — no backend, all in the URL
- Share a saved list → short stable link `?w=<7-char codes>&from=<name>` (codes survive the weekly
  feed refresh). Recipient lands in the **match** overlay (branded), swipes your picks; closing it
  drops them onto the **full feed** (never boxed into the shared set).
- Return leg: "Send <name> your matches" sends a link with **`&m=1`** — the confirmation breadcrumb.
  The original sender's app reads it and greets **"It's a match with <name>"** + banner "🎉 You &
  <name> matched · N plans" and does NOT re-launch the swipe (no re-swiping your own picks).
- Limit: it's a *passive* confirmation (you open the link they send back). A true push the moment
  they finish = backend (parked).

## Content pipeline — the freshness engine
- **Web-search-grounded extraction** (the core fix for stale content): Claude's web_search tool finds
  the coming weekend's events across **6 facets** (festivals/markets/outdoor · gigs/club nights ·
  art/theatre/film · food openings · workshops/classes/run-clubs · talks/late-openings/family).
  Real links from search results; signal-+-link, never republish.
- **Novelty-first ranking**: each run reads last week's feed and leads with genuinely-new events; the
  per-category cap (8) means novel events also *survive* over stale repeats. (Weekly cadence assumed.)
- Floor: keyless RSS + hand-authored canon (~84 evergreen); the app rotates the evergreen slice weekly.
- Cron: **Thursday 13:00 UTC** (after LBB / I amsterdam publish weekend guides).
- **Images = every card is a photograph (V.5.9).** Stock-agency URLs (alamy/getty/shutterstock/…)
  and the I amsterdam "Canal Parade" hero are blocked everywhere. Named performers (gigs/shows) get
  real photos (og → web search → wiki). **Generic web-search EVENTS** (festivals/markets/garden-days)
  have no trustworthy per-event photo — open-web search returns wrong subjects ("Open Garden Days" →
  a Pride photo) and the source og:image is often a civic hero — so they (and any pick that loses a
  shared hero to the dedup) borrow a **real, category-tagged photo from the fully-imaged canon bank**,
  picked deterministically by id. Result: no text-on-colour posters, always on-theme, never a wrong
  subject. Trade-off: a borrowed photo is atmospheric/category-right, not the exact event — the
  durable upgrade to true per-event photos is an events/image API (see Open decisions #2).

### ⚠️ Pipeline ops — read before touching the cron/pipeline
- **Anthropic account is on the LOWEST tier: 10k input tokens/min.** Web-search responses are
  token-heavy, so web search is paced to **~1 call/min** (`WEBSEARCH_RPM`, default 1) and facets were
  cut 9→6. Faster = `rate_limit_error` and fresh-event yield collapses. **Durable fix: raise the tier
  (add credits to the Anthropic account behind the `ANTHROPIC_API_KEY` repo secret)** — then bump
  `WEBSEARCH_RPM` + facet count. Runs take ~15-20 min (fine for a weekly cron).
- **Refresh runs were failing** (2026-06-16) on a `git push` race — the workflow pushed a plain
  commit but main had moved; fixed to **rebase-before-push + retry** in `.github/workflows/refresh.yml`.
- **Verify a refresh actually committed**: `gh run list --workflow=refresh.yml`. A green run that
  found no changes won't commit; a failed run means the feed is stale.
- **Last known-good feed: 2026-06-18** (63 picks · **63/63 imaged**, incl. all 22 live + 9 web-search
  picks). Verified: 0 stock, 0 canal-parade, **0 text-on-colour posters** — the V.5.9 canon-photo bank
  fills every imageless live pick with a real category photo. The push-race + rate-limit fixes hold
  (runs 2026-06-17 and 2026-06-18 both green and committed).

## Shipped this arc (V.4.8 → V.5.10)
Quieter card fronts + ✓/✕ swipe stamps · 2-gesture swipe · undo out of the swipe path, nav-width,
reserved strip · faster geolocate · NOLA weather fix · match-mode freeze fixed + branded · short
stable share links · MVP trim · weekly evergreen rotation · bigger cards (fill the screen) · festival
dedup · **web-search pipeline → novelty → facets** · stock + wrong-subject image blocks (posters for
generic events) · **boomerang confirmation (`&m=1`)** · "Perfect this weekend" pill · refresh-run
push-race + rate-limit fixes · **canon-photo bank → every card is a photo (no posters)** · desktop
card sizing dialed to the guide lines.

## Open decisions (need Ness)
1. **Raise the Anthropic tier?** — the single biggest unlock for pipeline throughput/freshness (more
   facets, faster runs). It's a spend decision on the API account.
2. **Per-event photos** — V.5.9 killed posters: generic events now borrow a category-matched canon
   photo (real, on-theme, but not the exact event). Good enough, or invest in a real per-event image
   source (events API like Ticketmaster/Eventbrite that ships images, or a licensed image API)?
3. **Freshness ceiling** — web search is deep but not an exhaustive event DB; comprehensive coverage
   (every gig/screening) = a dedicated events-API integration (bigger build).
4. **Success metric** — agreed: the unit of success is a **completed round-trip that ends in a
   real-world plan**, not "a list was sent." Auto-notify-the-sender = backend (parked).

## Validation status (the real gate)
- Kit + rules: `docs/mom-test-interviews.md`; log: `docs/validation-log.md`.
- So far: **n=1 idea-reaction** (Tiwirayi) + several rounds of Ness's own UX feedback. The
  **behavioral round-trip** (friend opens link → matches → a plan actually gets done) is still the
  open test.
- **Now:** Ness re-sharing with friends this week — the freshness + boomerang-confirmation work is to
  make the return visit feel current and close the loop. Watch: do links come back with matches
  (`&m=1`), and does anything get lived?

## Doc map
`backlog.md` (strategy/handoff) · `moat.md` · `discovery-direction.md` · `content-pipeline.md` ·
`pipeline-freshness.md` (why-stale diagnosis + plan) · `jtbd-analysis.md` · `office-hours-review.md` ·
`market-scan-2026-06.md` · `mom-test-interviews.md` · `validation-log.md` · `feedback-collation-2026-06-13.md`.
