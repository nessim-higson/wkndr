# WKNDR — STATE (catch-me-up snapshot)

_Living "where are we right now" doc. Updated 2026-06-18. For strategy + the bigger backlog see
`docs/backlog.md`; for the full version history see `CHANGELOG.md`; for onboarding see `CLAUDE.md`._

## Live right now
- **App: V.5.19** — https://nessim-higson.github.io/wkndr/ (cache-bust `?v=V.5.19`)
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
  the coming weekend's events across **10 facets** (festivals/markets · gigs/club nights · art/theatre
  · open-air cinema/screenings · food openings · rooftop/terrace/canal · late-night/after-hours ·
  workshops/classes · talks/family · neighbourhood/community), one paced "agent" each, `max_uses` 5.
  Real links from search results; signal-+-link, never republish. (Dormant until Anthropic credits.)
- **Novelty-first ranking**: each run reads last week's feed and leads with genuinely-new events; the
  per-category cap (8) means novel events also *survive* over stale repeats. (Weekly cadence assumed.)
- Floor: keyless RSS + hand-authored canon (~84 evergreen); the app rotates the evergreen slice weekly.
- Cron: **Thursday 13:00 UTC** (after LBB / I amsterdam publish weekend guides).
- **Images — vision-verified real photos, then themed fallback (the ladder).** Per imageless live
  pick: **(1) gather real-photo candidates** — open-web image search by name (`webImageCandidates`),
  + the Wikipedia portrait FIRST for performers (Wikimedia is always downloadable), + the event-page
  og for non-performer scraped picks; **(2) VISION VERIFY** (`verifyImageForEvent`) — Claude downloads
  the candidate bytes itself (browser UA — Anthropic's own fetcher 403s on hotlink-protected hosts)
  and LOOKS at them, picking the one that genuinely depicts the event or rejecting all (so Celeste
  never gets a Japan blog, Open Garden Days never gets a Pride parade); **(3) Pexels themed stock**
  for what vision couldn't verify; **(4) canon bank** last resort. Typical run: **~50/61 real verified
  web photos, ~4 Pexels, ~6 canon** — Guns N' Roses shows the band, Open Garden Days the gardens.
  Stock-agency + I amsterdam "Canal Parade" URLs blocked everywhere. Needs `ANTHROPIC_API_KEY` (vision)
  + `PEXELS_API_KEY` (both set); with neither, degrades to top-ranked candidate / canon bank.

### ⚠️ Pipeline ops — read before touching the cron/pipeline
- ✅ **RESOLVED 2026-06-19: credits added + tier raised — the pipeline is LIVE and deep.** A clean run
  fired all 10 facets + scrapers → **62 picks, 62/62 imaged, 37 new this week** for Amsterdam (NOLA
  full too). Per-run cost ≈ **$1–2** (web_search $10/1k + Haiku tokens). NOTE: right after a top-up
  the billing state lags ~2–3 min, so the FIRST run after adding credits may still 401 its early
  facets — just re-run once and it's clean.
- **`open-air cinema / outdoor screenings` facet returned 0 both runs** — either none are dated this
  exact weekend (the big season e.g. Pluk de Nacht starts later) or the facet needs tuning. Worth a
  look if Ness still doesn't see screenings he expects.
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
1. **Research depth — DECIDED 2026-06-19: raise tier + multi-agent deep research.** Code shipped:
   FACETS 6→**10** (added open-air cinema/screenings, rooftop/terrace, late-night/after-hours,
   neighbourhood/community — the gaps Ness flagged), `max_uses` 3→5 per facet, `WEBSEARCH_RPM=3` in
   the workflow. ⚠️ **This assumes the RAISED tier — it stays dormant until Anthropic credits are
   added AND the tier is high enough** (add a deposit at console.anthropic.com; tier rises with
   cumulative deposit). On the lowest tier this many facets at RPM 3 will rate-limit.
2. **Per-event photos — DECIDED: keep Pexels themed stock for now** (vivid, on-theme, licensed; not
   the *literal* event photo). Ness chose to focus effort on content depth over image perfection.
   The agentic real-photo path (event-page hero → name image-search → agent verify) and a paid image
   API (Google/Bing/SerpAPI) are both parked as future upgrades. `PEXELS_API_KEY` secret is set.
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
