# WKNDR — STATE (catch-me-up snapshot)

_Living "where are we right now" doc. Updated 2026-06-18. For strategy + the bigger backlog see
`docs/backlog.md`; for the full version history see `CHANGELOG.md`; for onboarding see `CLAUDE.md`._

## Live right now
- **App: V.5.15** — https://nessim-higson.github.io/wkndr/ (cache-bust `?v=V.5.15`)
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
- **Images — the layered ladder (canon bank → Pexels themed stock).** Stock-agency URLs
  (alamy/getty/shutterstock/…) and the I amsterdam "Canal Parade" hero are blocked everywhere. Named
  performers (gigs/shows) get real photos (og → web search → wiki). For everything still imageless
  (generic web events; performers those passes missed) the order is now: **(1) Pexels themed stock**
  — vivid, licensed photography queried by the event's OWN theme ("Queer Power" → queer-art imagery)
  with a category-hint fallback, id-salted so same-theme events vary; **(2) canon-photo bank** —
  borrow a category-tagged photo from the fully-imaged canon, the keyless last resort so a missing
  key never blanks a card. This replaced the old bank-only behaviour that made cards **dull and
  sometimes mismatched** (Queer Power, an art pick, had borrowed the Rijksmuseum). **Needs the
  `PEXELS_API_KEY` repo secret** (free, https://www.pexels.com/api/) — without it the pipeline
  silently falls back to the bank (dull but safe).

### ⚠️ Pipeline ops — read before touching the cron/pipeline
- 🚨 **BLOCKER (2026-06-19): the Anthropic account is OUT OF CREDITS.** Every live pull (scrape +
  web-search) errors `"credit balance is too low"`, so refresh runs find **0 fresh events** and the
  feed collapses to the **canon evergreen floor (88 picks, 0 web)**. **Fresh content is DOWN until
  credits are added** at console.anthropic.com → Plans & Billing (the account behind the
  `ANTHROPIC_API_KEY` secret). Pexels imagery is unaffected but only acts on live events, so with no
  live events it shows nothing new. After topping up: `gh workflow run refresh.yml`.
- **Anthropic account is on the LOWEST tier: 10k input tokens/min.** Web-search responses are
  token-heavy, so web search is paced to **~1 call/min** (`WEBSEARCH_RPM`, default 1) and facets were
  cut 9→6. Faster = `rate_limit_error` and fresh-event yield collapses. **Durable fix: raise the tier
  (add credits to the Anthropic account behind the `ANTHROPIC_API_KEY` repo secret)** — then bump
  `WEBSEARCH_RPM` + facet count. Runs take ~15-20 min (fine for a weekly cron).
- **Refresh runs were failing** (2026-06-16) on a `git push` race — the workflow pushed a plain
  commit but main had moved; fixed to **rebase-before-push + retry** in `.github/workflows/refresh.yml`.
- **Verify a refresh actually committed**: `gh run list --workflow=refresh.yml`. A green run that
  found no changes won't commit; a failed run means the feed is stale.
- **Live feed now: the 2026-06-18 16:32 good feed, manually restored + re-imaged** (63 picks · 63/63
  imaged · 9 weekend web events now on **vivid Pexels stock**). It was hand-restored after the 22:18
  run clobbered it with canon-only (the credit outage). The 9 Pexels images were applied offline of
  Anthropic (the picks already existed) — proof the Pexels layer works; it just needs live events to
  act on. ⚠️ The weekly cron will re-clobber this with canon-only on its next run **unless Anthropic
  credits are restored first.** The push-race + rate-limit fixes hold
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
2. **Per-event photos** — DECIDED: Pexels themed stock (vivid, on-theme, licensed) layered above the
   canon bank. ⚠️ **ACTION: add the free `PEXELS_API_KEY` repo secret** (https://www.pexels.com/api/),
   then re-run refresh — until then cards fall back to the dull-but-safe bank. Still not the *literal*
   event photo; true per-event imagery would need an events API (Ticketmaster/Eventbrite) — see #3.
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
