# WKNDR — ingest (Workstream 3 of the 2026-08-28 freshness brief)

_2026-08-29. The daily poll, the keyless RSS floor, the seen registry, and ingest health.
Companion to `pipeline-freshness.md` (Parts II–III: why the deck froze) and `source-map.md`._

## The shape

**Instagram is a signal booster, not the spine** (the brief's own conclusion). The spine is
feed-based sources that keep flowing when Instagram breaks, polled daily at zero cost:

```
DAILY  (ingest.yml, 05:30 UTC)  scripts/ingest.ts — keyless only, no LLM, no images
   RSS floor + I amsterdam JSON-LD + Resident Advisor
   → seen.<city>.json           arrival-date truth (titleKey → first-seen DATE)
   → inbox.<city>.json          fresh finds the board can't see anywhere else
   → ingest-health.<city>.json  per-source yields + alerts
   never touches picks.<city>.json

WEEKLY (refresh.yml, Thu)       the full pipeline — judge, images, publish bar
   reads the registry for firstSeen (daily resolution beats "which Thursday")
   writes its own sightings + a 'weekly' health run into the same files
```

Both writers share one min-date merge (`scripts/lib/ingest.ts`), so they can only ever make
each other more precise, and either surviving alone keeps the record whole.

## The keyless RSS floor — live-tested 2026-08-29 before wiring

| Source | Feed | Verdict |
|---|---|---|
| Het Parool PS | `parool.nl/ps/rss.xml` | ✅ 37 items, rich city culture |
| Subbacultcha | `subbacultcha.nl/feed/` | ✅ 10 items, independent music/art |
| Amsterdam Foodie | `amsterdamfoodie.nl/feed/` | ✅ 10 items — fills the named eat-source gap |
| Time Out Amsterdam | no feed (404) | → wired on the **LLM lane** instead; may be JS-thin |
| r/Amsterdam | `.rss` answers 200 | ❌ serves a "Blocked" page to scripts — NOT wired |
| 3voor12 | both feed URLs | ❌ 404 — NOT wired |

RSS picks are article-shaped and rough (`verify: true`, coarse `when`). Wiring them only became
safe on 2026-08-29: the publish bar (`publishCheck`) means the Thursday judge scores them and
junk stays below `JUDGE_FLOOR` — before that, anything ingested was one approval away from the
deck, which is why this lane sat empty.

## Ingest health — failures are expected operating conditions

Every adapter returns `[]` on any error; a dead source is a **zero in the health file**, never a
red run. `appendRun` (scripts/lib/ingest.ts) raises two alerts, surfaced as the amber strip on
the curation board (`#ingestbar`): **source-quiet** (0 picks for 3 consecutive runs) and
**inflow-low** (< 3 first-seen titles across 3 runs — the pipeline is starving even though
sources nominally answer). Thresholds live in one place, `appendRun`'s defaults.

## Instagram — the honest constraint, and the sanctioned route

Broad IG crawling is shut and stays shut (verified 2026-08-02: logged-out profile = 604KB shell,
zero post links; RSS bridges 403). The watchlist (`scripts/taste/watchlist.json`) holds the
handles; polling them needs **Meta Graph business_discovery** — free and sanctioned, but gated on
two Ness-only steps: a Meta developer app + a WKNDR IG Business account linked to a Facebook
page. Until then the watchlist is the paste-path checklist and the Drop Box is the IG route.
Handles that aren't Business/Creator accounts can never be read via the API and stay manual.

## The async drop queue — deferred, deliberately

The brief asked for the URL-paste to move into an async queue "so pasting does not block the UI."
Measured: `/drop` is a single ~1s await on a single-user tool, with the slow path (`/drop/read`,
the 12-slide vision read) user-initiated from the board with its own affordance. A KV job queue +
polling would add a worker deploy and a second state machine to shave one second for one user.
The genuinely async workload arrives with the business_discovery poller — which runs on the
worker's cron, not in the UI, so the queue question dissolves there. Revisit only if the drop
path ever grows a multi-URL batch paste.

## The inbox score (Workstream 2, 2026-08-30)

Candidates arrive **already scored and ordered** (`scripts/lib/score.ts`, weights in
`scripts/taste/weights.json`, overridable without a commit via `WKNDR_WEIGHTS`). Terms, and the
honest mapping from the brief's proposed inputs:

| Brief's input | Shipped as | Note |
|---|---|---|
| novelty (first-time-seen) | `firstSeen` decay, top-weighted | fails closed: no record, no novelty |
| mention recency | `buzz` (cross-source corroboration) + arrival recency | dedupe's credit-union |
| engagement velocity | **not yet** | needs the IG business_discovery poller — layers in with the watchlist |
| swipe affinity | corpus token-overlap as a **multiplier** | amplifies signal, never creates it |

Plus a `dated` term: a parseable real date separates events from article-shaped RSS items, with a
bonus for active-by-Sunday. RA's attending count ships as `realDraw`, capped **below** novelty +
one corroborating source — the brief's law, encoded: novelty and corroboration above raw volume,
or the same five famous venues win every week.

**Open question 2 answered:** launch = the composite minus velocity, because velocity is the one
input with no data source yet. Every shipped term is backed by a signal that exists today.

Each pick carries `inboxScore` + `scoreWhy` (the receipt: "seen today · 2 sources · on this
weekend · taste: museum") so the number can be argued with on the board card itself. The board's
**Fresh from the sources** section (NEW FINDS tab) renders them score-descending with full verdict
controls — a ★ teaches the corpus so Thursday's crawl admits and boosts the real event; a ✕
vetoes it out of the inbox and the pipeline for good. The rest of the brief's Workstream 2 already
existed under other names: the force-rank drag is the WEEKEND PILE (`pilePos`, manual, distinct
from computed `servePos`), and "zero manual input still ships a full ordered set" is V.11.3's
publish bar.

## Adding a source later

1. Live-test the feed first (`curl` it — this file's table is the precedent; don't wire hopes).
2. One line in `scripts/roster.ts` (`type: 'rss'` + a default `category`, or `type: 'llm'` + facet).
3. Nothing else: the daily poll, health file, registry, dedupe/buzz, and the Thursday judge all
   pick it up from the roster.
