# WKNDR — STATE (catch-me-up snapshot)

_Living "where are we right now" doc. Updated 2026-06-15. For strategy + the bigger backlog see
`docs/backlog.md`; for the full version history see `CHANGELOG.md`; for onboarding see `CLAUDE.md`._

## Live right now
- **App: V.5.5** — https://nessim-higson.github.io/wkndr/ (cache-bust `?v=V.5.5`)
- **`?dev=1`** reveals the full exploration surface (all views, ambient-look switcher, city picker).
- **Full pre-MVP build frozen** at `/wkndr/versions/v4-10/` (git tag `v4.10`) for side-by-side.
- Milestone tag `v5.0` = the MVP baseline.

## Product posture — V.5 is the MVP trim
One view (**Stack** only), one ambient look, **Amsterdam only**, taste engine runs silently (off the
surface). Menu = Your list · Plan together · Filter · Weather. Fan/List/looks/cities all live behind
`?dev=1`. Shared-link recipients go through the **match** overlay, then land on the full feed (never
boxed into the shared set). Cards fill the screen; ✕/★ controls sit tight beneath with a reserved
strip above for the undo pill.

## Content pipeline — the freshness engine
- **Web-search-grounded extraction** (the core fix): Claude's web_search tool finds the coming
  weekend's events across **9 facets** (festivals · gigs · club nights · art/theatre/film · food
  openings · markets/pop-ups · workshops/classes/run-clubs · talks/late openings · family). Real
  links from search results; signal-+-link, never republish.
- **Novelty-first ranking**: each run reads last week's feed and leads with genuinely-new events;
  the per-category cap (8) means novel events also *survive* over stale repeats.
- Floor: keyless RSS + the hand-authored canon (~84 evergreen); the app rotates the evergreen
  slice weekly (V.5.2).
- Cron: **Thursday 13:00 UTC** (after LBB / I amsterdam publish their weekend guides; was Monday).
- Images: stock-agency URLs (alamy/getty/shutterstock/…) blocked everywhere; fresh web picks with
  no clean photo keep a **category poster** rather than being dropped.
- **Latest run (2026-06-15):** 59 picks · 14 fresh web/scrape · 0 stock images · 1 Holland Festival
  (dedup fixed). Was 47 / 3 a run ago.

## Shipped this arc (V.4.8 → V.5.5)
Quieter card fronts + ✓/✕ swipe stamps · 2-gesture swipe · undo moved out of the swipe path then
sized to the nav · faster geolocate · NOLA weather fix · match-mode freeze fixed + branded · short
stable share links (7-char codes) · MVP trim · weekly evergreen rotation · bigger cards · festival
dedup · web-search pipeline → novelty → 9 facets · stock-image block.

## Open decisions (need Ness)
1. **Posters vs photos for fresh events** — more volume = more poster cards (obscure event names are
   hard to photo). Keep the trade, or invest more in image lookup?
2. **Intro line** — ships as "Tinder your events." (default) / "<name> sent you some picks · Match to
   find out what you should do →" (shared). Keep, reword, or also pin a persistent tagline?
3. **Success metric** (the boomerang) — agreed framing: the unit of success is a **completed
   round-trip that ends in a real-world plan**, not "a list was sent." Auto-notify-the-sender needs a
   backend (parked); the return link is the no-backend version, now the primary action on a match.
4. **Freshness ceiling** — web search is deep but not an exhaustive event DB. Truly comprehensive
   coverage (every gig/screening) = a dedicated events-API integration (bigger build).

## Validation status (the real gate)
- Kit + rules: `docs/mom-test-interviews.md`; log: `docs/validation-log.md`.
- So far: **n=1 idea-reaction** (Tiwirayi) + several rounds of Ness's own UX feedback. The
  **behavioral round-trip** (friend opens link → matches → a plan actually gets done) is still the
  open test.
- **Now:** Ness re-sharing with friends this week — the freshness build above is to make the return
  visit feel current. Watch: do links come back with matches, and does anything get lived?

## Doc map
`backlog.md` (strategy/handoff) · `moat.md` · `discovery-direction.md` · `content-pipeline.md` ·
`pipeline-freshness.md` (why-stale diagnosis + plan) · `jtbd-analysis.md` · `office-hours-review.md` ·
`market-scan-2026-06.md` · `mom-test-interviews.md` · `validation-log.md` · `feedback-collation-2026-06-13.md`.
