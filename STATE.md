# WKNDR — STATE (catch-me-up snapshot)

_Living "where are we right now" doc — a **snapshot, not a history**. **Updated 2026-06-28.** Read this
FIRST in a new chat. For strategy + backlog see `docs/backlog.md`; for full **version history** see
`CHANGELOG.md` (current to V.6.2) and the **git log / tags** (every `V.x.x` ship is a commit;
milestones are tags `v4.0`/`v4.10`/`v5.0`/`v6.2`); onboarding `CLAUDE.md`. App lives in `/app` (Vite +
React + TS, run with `bun`); deployed to GitHub Pages._

## Live right now
- **App: V.6.2** — https://nessim-higson.github.io/wkndr/ (cache-bust `?v=V.6.2`)
- **`?dev=1`** reveals the full exploration surface (all views, ambient-look switcher, city picker).
- **Frozen reference builds:** this build at **`/wkndr/versions/v6-2/`** (git tag `v6.2`) and the
  pre-MVP build at `/wkndr/versions/v4-10/` (git tag `v4.10`). Frozen builds live in the repo's
  top-level `versions/<slug>/` (the deploy copies them to `site/versions/`); each is a normal `vite
  build` with `--base=/wkndr/versions/<slug>/`.
- **Ship loop:** `cd app && bun run bump` (V.<major>.<sub>, sub 1–19 then rolls a whole version + a
  milestone tag) → `bun run build` → commit → push (auto-deploys) → reply with the `?v=` link.

## Product posture — the MVP
One view (**Stack**), one ambient look (**Auras**), **Amsterdam only**; taste engine runs silently.
Menu = Your list · Plan together · Filter · Weather. Fan/List/looks/cities all behind `?dev=1`.
- **Cards: full-bleed `cover`.** (A blur-fill "show whole photo" variant was tried and **reverted** —
  Ness preferred clean cover. Landscape photos crop somewhat; accepted.)
- Desktop geometry dialed to Ness's guide lines: top under the nav/undo pill (~14vh), fills to
  `max-height:70vh`, ✕/★ + "Shuffle for more" lifted ~9vh off the bottom. **Mobile card width ==
  header width** exactly (`min(340px,100%)`).
- Weather-peak pill = **"Perfect this weekend"**. Intro lead "Tinder your events." + matching subline.
- **Card detail dismisses on a pull UP or DOWN** (grab the image and fling either way) — V.6.2.

## Deck behaviour — ENDLESS (do not re-add fixed sets)
The deck is **endless**: all un-swiped picks of the current slice; **"Shuffle for more"** bumps the
seed → a new slice. A **"sets of 7" batching model was tried and REVERTED** — it recycled cards and
Ness said the endless deck "functioned a lot better." `shown` (default browse) = the weekend's **LIVE
picks** (pipeline ids `web-`/`llm-`) + a **rotating RESERVE(14) slice** of the deep canon; the slice
advances each WEEK and on each Shuffle. The fresh/canon split is **LIVE-vs-id** (not `freshness`), so
canon tagged `"new"` (e.g. **De Pimpelmees**) rotates too — fixing the "same pick every week" fatigue.

## The boomerang (share → match → confirm) — no backend, all in the URL
- Share a saved list → short stable link `?w=<7-char codes>&from=<name>` (codes survive the weekly
  refresh). Recipient lands in the **match** overlay (branded), swipes; closing drops them on the full
  feed (never boxed into the shared set).
- Return leg: "Send <name> your matches" → link with **`&m=1`**. Sender's app greets **"It's a match
  with <name>"** + banner, and opens the **itinerary LIST** ("Your weekend") of the matched plans —
  not the swipe deck. Passive confirmation (you open the returned link); a true push = backend (parked).

## Content pipeline — the trusted-source engine
- **Ranked TRUSTED SOURCES (Ness's call):** 1. Your Little Black Book · 2. I amsterdam · 3. Resident
  Advisor (the source for club/electronic nights) · 4. de Volkskrant. The web-search adapter leads
  with **source-scoped facets** for these four, then topical breadth; `refresh.ts` ranks picks by this
  **source priority** so every category is LED by trusted sources, with curated canon backfilling.
- **10 facets**, one paced web_search "agent" each, `max_uses` 5, `WEBSEARCH_RPM=3`. Cron **Thu 13:00
  UTC** (after LBB / I amsterdam publish weekend guides).
- **TRUST FILTER** (`LOW_QUALITY` in refresh.ts) drops low-confidence web picks: cheesy club
  self-promo (**Escape**), generic aggregators (concerts50), the **Songkick metro index**, and the
  **AmsterdamTips month-index** `/whats-on-amsterdam-<month>` links — the wrong-date/wrong-image
  "**Mirror Floor**" class. (Narrow on purpose: it does NOT match a bare `/whats-on` path, so I
  amsterdam / Eye Filmmuseum real event pages survive.) Strict end-date checks; prefer specific pages.
- **Novelty-first** within source tiers; per-category cap (8). Floor: keyless RSS + **~109
  hand-authored canon** (all imaged), rotated weekly.

## Images — vision-verified real photos → themed fallback
Per imageless live pick: **(1)** gather real-photo candidates — open-web image search by name
(`webImageCandidates`, biased toward portrait/tall to fit the card) + the **Wikipedia portrait FIRST**
for performers + the event-page og for scraped picks; **(2) VISION VERIFY** (`verifyImageForEvent`) —
Claude **downloads the candidate bytes itself** (browser UA — Anthropic's fetcher 403s on
hotlink-protected hosts) and LOOKS at them, picking the genuine fit or rejecting all (so Celeste≠Japan
blog, Open-Garden-Days≠Pride parade); **(3) Pexels** themed stock; **(4) canon bank** last resort.
Typical run ~50/61 real verified photos. Stock-agency + I amsterdam "Canal Parade" URLs blocked.
Needs `ANTHROPIC_API_KEY` (vision) + `PEXELS_API_KEY` (both set).

## Pipeline ops — read before touching the cron/pipeline
- ✅ **Anthropic credits added + tier raised — pipeline is LIVE and deep.** Per-run cost ≈ **$1–2**
  (web_search $10/1k + Haiku tokens) + ~$0.20 vision. Runs ~7–10 min (Amsterdam only; **New Orleans is
  PAUSED** — `PAUSED` set in refresh.ts; pass `--city=new-orleans` to override).
- **Billing lag:** right after a top-up the first run may 401 its early facets (~2–3 min) — just re-run.
- **Dispatch race:** `gh workflow run` can checkout `main` a beat before a just-pushed commit
  propagates → it once ran pre-fix code. Confirm with `gh run list --workflow=refresh.yml --json
  headSha` and wait for the SHA to match before dispatching.
- **open-air cinema facet returns 0** most weeks (season starts ~July) — not a bug.
- **Last good feed: 2026-06-28** — 58 picks, trusted-source-led (I amsterdam ×6, LBB ×3), `trust:
  dropped 4`, Escape + Mirror-Floor gone. Verify a refresh committed: `gh run list --workflow=refresh.yml`.
- Refresh workflow commits with **rebase-before-push + retry** (fixed an old push race).

## Shipped this arc (V.4.8 → V.6.2)
Quieter card fronts + ✓/✕ stamps · 2-gesture swipe · undo nav-width out of the swipe path · faster
geolocate · match-mode freeze fix · short stable share links · MVP trim · **boomerang confirmation
(`&m=1`) → itinerary list** · "Perfect this weekend" pill · **web-search deep-research pipeline (10
facets)** · **vision-verified imagery** · **trusted-source ranking + trust filter (Escape/Mirror-Floor
gone)** · canon rotation fix (De Pimpelmees) · mobile card == header width · **in-app feedback widget**
· detail pull-to-dismiss both directions · blur-fill tried + reverted · batching tried + reverted to
the endless deck.

## Open items / next (need Ness or pending)
1. **Detail pull-to-dismiss (V.6.2)** — verified by code only; Ness to confirm the gesture on device
   (framer drag/tap can't be exercised in the headless preview).
2. **Feedback widget → Formspree NOT wired yet.** `FORM` in `Feedback.tsx` is still the `REPLACE_ME`
   placeholder, so it falls back to a prefilled **mailto** to ness@. To enable the in-app form: make a
   free form at formspree.io, paste the `https://formspree.io/f/<id>` endpoint into `FORM`, ship.
3. **Card cropping** — full-bleed `cover` crops landscape; blur-fill was rejected. If it keeps bugging,
   the real fix is an "image-top + text-panel" card layout (a deliberate look change).
4. **Per-event photos** — vision-verify gets ~real for most; the rest are Pexels themed. A paid image
   API (Google/Bing/SerpAPI) is the ceiling, parked.
5. **Success metric** — a **completed round-trip that ends in a real-world plan**. Auto-notify-the-
   sender the moment a friend finishes = backend (parked).

## Validation status (the real gate)
- Kit + rules: `docs/mom-test-interviews.md`; log: `docs/validation-log.md`.
- So far: **n=1 idea-reaction** (Tiwirayi) + many rounds of Ness's own UX feedback. The **behavioral
  round-trip** (friend opens link → matches → a plan actually gets lived) is still the open test.
- **Now:** Ness sharing with friends/family — the feedback widget + trusted-source freshness are to
  make that round feel current. Watch: do links come back with matches (`&m=1`), does anything happen IRL.

## Doc map
`backlog.md` (strategy/handoff) · `moat.md` · `discovery-direction.md` · `content-pipeline.md` ·
`pipeline-freshness.md` · `jtbd-analysis.md` · `office-hours-review.md` · `market-scan-2026-06.md` ·
`mom-test-interviews.md` · `validation-log.md` · `feedback-collation-2026-06-13.md`.
