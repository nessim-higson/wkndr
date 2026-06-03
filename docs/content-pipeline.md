# WKNDR — Content pipeline (the living-events plan)

> **Status:** architecture sketch, mostly not built. Today each city's pool is a *hand-curated
> snapshot* (`app/src/data/picks.ts` = Amsterdam; `picks.nola.ts` = a New Orleans **seed**).
> This doc is the plan for making events stay current automatically — the "living content
> pipeline" that `docs/discovery-direction.md` §2 flags as *the actual work and the real risk*.
> Per the build order (§9), automation is Phase 5: **do not build it until the core is sticky.**
>
> **What IS built now (v0.9.16):** the app is **city-scoped** — `app/src/data/cities.ts` is a
> registry of `City { picks, sources, lat/lon }`; everything downstream (weather classify,
> rank, diversify, itinerary, .ics) is city-agnostic and consumes whichever city is active.
> You can switch city in the menu or via `?city=new-orleans`, and live geolocation auto-snaps
> to a city we have a feed for. **So the engine is multi-city today; only the *inputs* are
> hand-seeded.** See "Multi-city" below.

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

## What makes it feel *smart* — ranking + the guarantee

Crawling is the easy half. The half that makes it feel like "guaranteed smart things to do"
is **scoring** and a **floor**.

### 1. Cross-source frequency = the popularity signal
The single best, cheapest relevance signal is **how many independent editors are talking about
it this week.** Dedupe already merges the same event across sources — so the *count of distinct
sources* on a merged record becomes its **buzz score**. A show in I amsterdam **and** Time Out
**and** Het Parool is, almost by definition, the thing to know about. We don't need likes or
ticket-sales data we can't get; agreement across trusted editors *is* the popularity proxy.

`relevance = buzz(distinct sources, weighted by source trust)`
`           + editorial flags ("editor's pick", "don't miss")`
`           + freshness (new this week ▸ ending soon ▸ this weekend ▸ evergreen)`
`           + scarcity (final week of a run, last date of a festival, selling fast)`

**Source-trust weights (curated with Ness):** Time Out + Your Little Black Book = highest;
I amsterdam What's On = strong corroborator. A thing in two top sources ranks near the top.

**`status` (scarcity badge).** The crawler reads a live availability signal and the app shows
it as a badge that also lifts ranking:
- `selling-fast` / `almost-gone` / `sold-out` — parsed from ticketing/venue pages.
- `final-week` / `closing-soon` — computed from an exhibition's end date.
- `free` — surfaced positively.

**Instagram is a research lead only, never a scraped source** (see the dedicated section
below): pull the website/newsletter behind the account; use official oEmbed for a single
public post if ever needed.

Then the app's existing per-user pass re-ranks `relevance` by **weather-fit × learned taste**
(and de-clusters by category). So the order is: *what the city agrees is great → filtered to
what suits today's weather → tilted to you.*

### 2. The canon floor = the guarantee
The crawl is the **fresh top layer**; a hand-maintained **evergreen canon** (Rijksmuseum,
Van Gogh, Vondelpark, the markets, the day-trips) is the **floor that's always there.** So the
guarantee isn't "the crawl always finds gold" — it's:

> **Every weekend = the genuinely-buzzy fresh things (multi-source verified) layered on top of a
> always-excellent evergreen base, all matched to the weather.** Never empty, never stale,
> never random — even on a quiet week or if a crawl half-fails.

### 3. Time-sensitive surfacing (the stuff you flagged)
- **Shows ending** — museum/gallery scrapers carry each exhibition's `end date`; in its final
  1–2 weeks it's auto-flagged `ending` ("see it before it's gone" — scarcity ranks it up).
- **Gallery walks / openings** — the I amsterdam art agenda + gallery sites; one-off dates.
- **Festivals** — festival calendars; multi-day, surfaced across their run, ranked by buzz.

### 4. Imagery, solved by construction
Bad-fit images are a *sourcing* problem, fixed in the pipeline: each event page already has an
**`og:image`** (the real photo of that show/venue/artist) — the crawler extracts it, validates
it loads, and uses it. Where there's genuinely no usable image (some new venues), fall back to a
**typographic "poster" card** (bold title on the mode-tinted field, category glyph) rather than a
generic stock photo — designed-on-purpose beats misleading.

---

## Sources by category (the curated Amsterdam roster)

Comprehensive on what matters, **deliberately not infinite** — raw source count is what
kills upkeep; curation + dedup is the moat. Target ~15–20 reliable sources, weighted to the
categories with the most churn (Eat, Art, Live).

| Category | Sources | Method |
|---|---|---|
| Live & gigs | Songkick ✓, Bandsintown, Resident Advisor (auth), Paradiso / Melkweg / Tolhuistuin / AFAS / Ziggo Dome programmes | API / scrape |
| Eat & drink | **Eater Amsterdam** (RSS + the Hit List / new-openings lists) ✓, **Your Little Black Book** (weekend tips, openings), Het Parool PS, The Infatuation | RSS / LLM-read |
| Art & museums | **All majors** — Rijksmuseum, Van Gogh, Stedelijk, Moco, H'ART ✓, Foam, Huis Marseille, Eye, NEMO, Rembrandthuis, Anne Frank, Het Scheepvaartmuseum, Tropenmuseum, Nxt, STRAAT, A'DAM; De Nieuwe Kerk ✓; + the I amsterdam / museum.nl aggregator as a backstop | scrape run-dates |
| Stage & screen | Holland Festival ✓, Internationaal Theater Amsterdam, Uitkrant, Eye programme | scrape / LLM-read |
| Out / Markets | I amsterdam, IJ-Hallen ✓ (dated), Pekmarkt / Nieuwmarkt, Westergas, Gemeente (swim/parks) | scrape |
| Day-trips | The Dutch Review, NS, regional tourism sites | LLM-read |
| Kids (cross-cut) | Kidsproof, Amsterdam Mamas, I amsterdam family | LLM-read |
| Weather | Buienradar JSON ✓ + KNMI (already wired in the app) | API |

(✓ = confirmed reachable during the 31 May hand-curation.)

**Museums are the easiest win:** stable sites, real run-dates, fully signal+link-friendly.
Build the museum scrapers first — high yield, low fragility. Eater's recurring lists are the
best Eat source; LBB is the best cross-category weekend-tips source.

## Instagram & social — the honest constraint (do NOT build a scraper)

Instagram is where a lot of Amsterdam buzz lives, but it should be a **manual
lead-discovery input only**, never an automated source:

- **No legitimate API** for arbitrary accounts (Basic Display API deprecated; Graph API
  reads only accounts you own/manage). There's no sanctioned read path.
- **Scraping / screenshotting violates IG's ToS**, is login-walled + actively blocked, and
  is brittle — it would break constantly and carries real legal risk (Meta litigates scrapers).
- **It breaks our own legal spine.** Screenshotting and displaying a post *is republishing
  their content* — exactly what "signal + link, never republish" forbids. Strategically
  inconsistent, not just risky.

**The compliant value path:** almost every IG-first publisher also has a website/newsletter
(LBB, venues, museums all do) — pull from those. Use IG only as a human research lead: spot
what's buzzing, then enter the underlying *fact* (event/date/venue) sourced + linked to the
primary page. For a specific public post you have a URL for, IG's official **oEmbed** is the
only sanctioned embed — per-post, limited, not a feed.

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

---

## Multi-city (the New Orleans test)

The app is now **city-scoped by construction**, which makes a hard truth obvious: *the engine
travels, the content doesn't.* Switch location to a city with no feed and you'd get the right
**weather** (open-meteo + reverse-geocode are coordinate-driven and portable) but the wrong
**events**. A city is healthy only when its inputs are sourced.

### What a new city needs (the per-city checklist)
A `City` (`app/src/data/cities.ts`) is just: `{ key, name, lat, lon, picks[], sources, sourceCount }`.
To stand one up for real:

1. **A source roster** — the per-city equivalent of `sources.ts`. The *categories* are universal
   (Live, Eat & drink, Art, Stage, Out/Markets, Weather); the *sources* are local. The NOLA seed
   roster (`sources.nola.ts`) shows the shape: **WWOZ Livewire** is the local gold standard for
   live music (the Songkick-equivalent), then OffBeat, neworleans.com, venue sites, the museums.
2. **Adapters** for that roster — same FETCH→NORMALIZE→DEDUPE→ENRICH→VERIFY pipeline, just
   pointed at local sources. Most reuse: an RSS adapter, an "LLM-read a messy listings page"
   adapter, an og:image extractor — all city-agnostic. Only the URLs and a few selectors change.
3. **An evergreen canon** — the floor (NOMA, the WWII Museum, Preservation Hall, Café du Monde,
   the Steamboat Natchez) so the city is never empty even on a quiet week / failed crawl.
4. **Local weather realism** — `classify()` already handles it, but tune copy: a NOLA summer
   weekend is *classic* `VOLATILE` (sun → 4pm thunderstorm → sun), so indoor/covered picks should
   dominate the rain-fit tags. The seed set is tagged that way on purpose.

### What's seeded vs sourced (be honest in-product)
The NOLA set is hand-authored and **flagged `seed: true`** — the menu pill shows `·seed`, the
"what's feeding this" sheet says *seed set (pre-crawl)*, and lineup-specific picks carry
`verify: true`. A real launch replaces the seed with a crawled roster; the schema doesn't change.

### The honest scaling answer
Adding cities is **bounded by sourcing, not engineering.** The marginal engineering cost of a new
city is ~an afternoon (roster + reuse the adapters). The marginal *content* cost is the real one:
finding the 15–20 reliable local sources, weighting their trust, and keeping the canon honest —
per city, every week. That's the moat *and* the cost. The LLM-read adapter is what makes it
plausible at all (curation labor → cents/city/week), but taste-checking and link-pruning stay a
human loop per city. Don't pretend a new city is free; pretend it's cheap-ish and verifiable.
