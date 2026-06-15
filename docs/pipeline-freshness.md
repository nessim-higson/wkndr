# WKNDR — why the feed feels stale, and how to fix it

_2026-06-14. Diagnosis after Ness found fresher Amsterdam events in ChatGPT/Google
(Open Garden Days, Bite of Amsterdam, Bacchus Wine Festival, Holland Festival, Phantogram
+ Celeste gigs) than WKNDR surfaced for the same weekend._

## The complaint (real, measured)

- The feed is ~90% a fixed evergreen library (84 of 93 picks "always good"; only ~9 dated).
- Week over week, ~87 of 93 picks were identical — only ~6 swapped.
- The genuinely-fresh weekend events that competitors surface instantly do not appear.

V.5.2 added weekly rotation of the evergreen slice (band-aid for the bulk). This doc is
the deeper fix: **the pipeline can't actually SEE most fresh dated events.**

## Root cause — proven by a live raw-fetch test (the exact thing the pipeline does)

| Source | Raw fetch result | Verdict |
|---|---|---|
| I amsterdam `/whats-on` | 643 KB HTML, but "Open Garden Days"/"Bite of Amsterdam" = **0 mentions** | listings are JS/API-rendered → scrape gets nav + boilerplate |
| Songkick metro page | **0 bytes returned** (anti-bot block) | no gigs ever come through |
| Your Little Black Book | content present ("weekend" ×75) | scrapeable — BUT see char cap below |

Three compounding causes:

1. **Static-HTML scrape of JS-rendered pages** (`scripts/adapters/llm.ts` does a plain
   `fetch()`). The most important calendars (I amsterdam, Songkick, Kidsproof) render
   events client-side, so the fetch sees an empty shell. *This is the core gap — and it's
   exactly why ChatGPT/Google win: they search the live web; WKNDR reads fixed URLs' raw
   HTML.*
2. **8,500-character cap** — `htmlToText(html).slice(0, 8500)`. Even content-rich pages
   (LBB) get truncated to the top-of-page nav/boilerplate before the events. (Can't just
   raise it — the low-tier Anthropic account caps ~10k input tokens/min; the rate gate
   already runs near that. Raising the cap needs smarter extraction, not just more chars.)
3. **No live gig feed** — Songkick is blocked and `SONGKICK_API_KEY` is unset (Songkick's
   public API is also largely closed now).

Plus the timing bug (now fixed):

4. **Monday cron was too early.** LBB's weekend agenda + I amsterdam's weekend curation
   publish mid-to-late week (Wed–Thu). Monday 06:00 predated them. **Fixed → Thursday
   13:00 UTC** (catches the guides, keeps Fri–Sun planning lead).

## Source cadence (the "when do they publish" answer)

- **Your Little Black Book** — weekly agenda, weekend guides land **Wed–Thu**.
- **I amsterdam** — rolling/continuous; weekend curation firms up Wed–Fri, but API-walled
  so timing alone won't crack it without rendering or search.
- **Gigs (Songkick/Bandsintown)** — real-time; need an API or web search, never a scrape.
- Exact publish hours still want ~2 weeks of observation to nail. Optional: log per-source
  yield each run and watch when LBB/I amsterdam light up.

## The real fix (recommended) — web-search-grounded extraction

Give the LLM extractor the **web_search tool** (Anthropic server tool) and prompt it to
find "what's on in {city} the weekend of {dates}", extracting structured Picks with the
**real source links the search returns**. This is the ChatGPT/Google approach and it is:

- **Source-agnostic** — catches festivals, gigs, openings, free/outdoor, closing-soon, all
  at once, without per-site scraping or rendering.
- **Current** — sees what was published this week, not a stale static shell.
- **Cheap** — Anthropic web_search ≈ $10 / 1,000 searches + tokens. WKNDR does ~16
  source-calls/week; even 2 searches each ≈ ~$0.30/week. Negligible.
- **Link-safe** — links come from real search results, not guessed slugs (keeps the
  signal-+-link, never-republish model; still write our own blurbs).

Keeps the keyless RSS + canon floor as backup. Contained change to `scripts/adapters/llm.ts`.

### Complements (smaller)
- **Songkick/Bandsintown** for clean real-time gigs — web search likely covers this, so
  only worth a dedicated adapter if gigs need to be exhaustive.
- **JSON-LD extraction** — some pages embed `<script type="application/ld+json">` Event
  schema even when the visible list is JS-rendered; cheap to parse when present.
- **Smarter HTML slice** — strip nav/header/footer and prefer the events region before the
  char cap, so the 8,500 budget spends on events not chrome.

## Status
- ✅ Weekly evergreen rotation (V.5.2).
- ✅ Cron Monday → Thursday.
- ◻ Web-search-grounded extraction — **recommended next; awaiting go (tiny recurring cost).**
- ◻ JSON-LD / smarter slice / gig feed — follow-ons.
