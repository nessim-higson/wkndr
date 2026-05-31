# WKNDR — Content pipeline (the living-events plan)

> **Status:** architecture sketch, not built. Today the pool is a *hand-curated snapshot*
> in `app/src/data/picks.ts` (last curated 31 May 2026). This doc is the plan for making
> events stay current automatically — the "living content pipeline" that
> `docs/discovery-direction.md` §2 flags as *the actual work and the real risk*.
> Per the build order (§9), this is Phase 5: **do not build it until the core is sticky.**

---

## The problem (named honestly)

Keeping a deep, multi-category Amsterdam pool **fresh, real, and dated** every week is the
hard part — not the design. When I curated this weekend's events by hand I hit exactly the
walls a pipeline must survive:

- Time Out's "things to do" page is **evergreen guides, no dated events**.
- Resident Advisor returned **403** to an unauthenticated fetch.
- I amsterdam's calendar is **JS-rendered** — dates don't appear in raw HTML.
- Songkick gave clean dated gigs; Holland Festival + museum sites gave reliable run-dates.

So: every source has a different shape, reliability, and access posture. The pipeline's job
is to absorb that mess and emit a clean, verified, weather-tagged pool.

---

## The legal spine (non-negotiable — see discovery-direction §12)

**Signal + link, never republish** (the Techmeme model). Scrape *facts* (name, venue, date,
price), write our *own* short blurb, **credit + link out** to the source. Never reproduce a
source's copy. The `source` + `link` fields on every `Pick` are load-bearing — they're the
credibility device and the publisher-relations posture. The Thursday cron **HEAD-checks every
link** before publishing and drops/flags dead ones rather than 404-ing the user.

---

## The pipeline (Thursday cron → `picks.json`)

```
FETCH            NORMALIZE         DEDUPE          ENRICH (LLM)        VERIFY           PUBLISH
per source   →   to raw events  →  across      →   tag + write    →   HEAD-check   →   picks.json
(RSS/API/                          sources         category,          links, date      (the app
 scrape/                           (same gig                          weatherFit,      sanity,          reads this
 LLM-read)                         from RA +                          kid, blurb,      confidence       static file)
                                   Songkick)                          why, price       flag
```

Each stage, concretely:

1. **Fetch** — per-source adapters, each knowing that source's shape:
   - *API/RSS* where it exists (Songkick, Eventbrite, some venue feeds) — cleanest.
   - *Structured scrape* for stable HTML (museum run-dates, Holland Festival programme).
   - *LLM-read* for messy/JS pages: fetch rendered HTML (or a headless render), hand the
     text to an LLM with a strict schema → structured events. **This is the new wedge** —
     the curation labor that used to need staff is now an LLM call costing cents per city/week.
2. **Normalize** — map every source's output to the `Pick` shape (`app/src/types.ts`).
3. **Dedupe** — the same event appears in multiple sources; merge on (title + venue + date),
   keep the richest record, union the source credits.
4. **Enrich (LLM)** — assign `category`, `weatherFit[]`, `kid`, `outdoor`; write the blurb +
   the "why now"; infer `freshness` (new / weekend / always / ending) from dates.
5. **Verify** — HEAD-check `link`; sanity-check dates fall in the target window; set
   `verify: true` on anything low-confidence (mirrors what we hand-flag today).
6. **Publish** — write `picks.json`; the app fetches it (no rebuild needed). Keep the last
   N weeks for the "always good" / taste history.

---

## Sources by category (the ~15-source Amsterdam MVP)

| Category | Candidate sources | Method |
|---|---|---|
| Live & gigs | Songkick ✓, Bandsintown, RA (auth), Paradiso/Melkweg feeds | API / scrape |
| Eat / Drink | Eater Amsterdam (RSS), Het Parool, Little Black Book | RSS / LLM-read |
| Art & galleries | De Nieuwe Kerk ✓, H'ART ✓, Foam, Stedelijk, Eye | scrape run-dates |
| Stage & screen | Holland Festival ✓, Uitkrant, ITA, Eye | scrape / LLM-read |
| Out / Markets | I amsterdam, IJ-Hallen ✓ (dated), Pekmarkt, Gemeente | scrape |
| Day-trips | The Dutch Review, NS, regional sites | LLM-read |
| Weather | Buienradar JSON ✓ + KNMI (already in the app) | API |
| Kids (cross-cut) | Kidsproof, Amsterdam Mamas, I amsterdam family | LLM-read |

(✓ = confirmed reachable during the 31 May hand-curation.)

---

## Phasing (cheap → automated)

1. **Manual snapshot** *(today)* — hand-curate `picks.ts` weekly. Proves the content is good
   before automating. Zero infra.
2. **LLM-assisted run** — a `scripts/refresh.ts` (Bun) I trigger manually: fetch the reachable
   sources, LLM-extract + enrich to `picks.json`, I eyeball it, commit. Half the labor, full control.
3. **Thursday cron** — same script on a schedule (the personal-deployment cron from the
   original plan), web-push the "your weekend brief is ready" + the Saturday weather-pivot alert.
4. **Self-healing** — link-rot detection, source-health dashboard, auto-`verify` flags,
   confidence scoring. Only once it's load-bearing.

**Cost note:** weather feed is free; LLM enrich for one city/week is cents. The thing that
historically made this category expensive (human editorial curation) is now mostly automatable
— that's the timing bet. But "mostly" ≠ "fully": taste-checking output and pruning dead links
stays a human loop. Don't pretend otherwise.

---

## Next concrete step (when Phase 5 is earned)

Build `scripts/refresh.ts`: start with the two cleanest adapters (**Songkick** for gigs,
**museum/Holland-Festival** scrapes for run-dates), LLM-enrich to `picks.json`, point the app
at `picks.json` instead of the hardcoded `picks.ts`. That alone replaces ~half of a manual
weekly curation and proves the spine end-to-end.
