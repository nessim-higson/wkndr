# City two: a feasibility scan

_Research memo, 2026-10-05. Research only: no app code changed, nothing deployed, no pipeline run,
no API key used. Every claim below about a source comes from a page fetched that evening (times in
the evidence log at the end). Ness's stated preference going in: New Orleans._

## The answer

New Orleans is feasible, and it is a better candidate than the repo's own docs assumed. It is not
the cheapest city, though. Ranked by the effort it takes to reach Amsterdam's quality, it sits fifth
of eight: Rotterdam, Berlin, Utrecht and Lisbon are cheaper. The extra cost of New Orleans is
concentrated in three places, and none of them is the event data.

1. **The weather lens has to be re-cut for the Gulf.** Run through the app's own `classify()`, 243
   days of 2025 in New Orleans were HOT (high of 24° or more), against 27 in Amsterdam. Every weekend
   day from April to October but three would have read HOT, and on 105 days the feels-like
   temperature was 35° or more. In Amsterdam HOT means go outside (the deck lifts outdoor picks by
   +3); in New Orleans in July it means the opposite. The thesis survives, the thresholds do not.
2. **There is no club spine.** Resident Advisor, the one source that is already global, lists 0
   events in New Orleans for the coming weekend and 12 in the next eight weeks (Amsterdam: 66 and
   1,106). The city's live-music listing is WWOZ's Livewire (97 shows at 64 venues this Saturday),
   and WWOZ's site terms forbid robots and systematic collection. Music is the heart of a New Orleans
   deck, so this needs a yes from WWOZ, or a music spine built another way, before launch.
3. **US plumbing.** Fahrenheit, dollars, a 12-hour clock, America/Chicago, a car and streetcar
   travel model instead of bike minutes, and no satellite sunshine reading (Open-Meteo's satellite
   API does not cover North America).

What makes New Orleans workable anyway: `neworleans.com` (the tourism board) turns out to be a real
I amsterdam equivalent. Its 2,429 event pages carry schema.org Event JSON-LD with typed categories,
dates, images and, on every page sampled, coordinates (which I amsterdam's records only sometimes
have). The city also has three readable weekly guides (the board's own Weekend Picks, Where Y'at,
and Gambit's Sunday roundup), which is more than Rotterdam, Utrecht, Antwerp or Copenhagen offer.

The recommendation (section 4): go with New Orleans, as a one-weekend deck on a preview branch, shown
to five locals, and only after two cheap checks that do not need code: a named local curator who will
build the starter library, and an email to WWOZ and to New Orleans & Company. If the question is only
"does the pipeline generalise", Rotterdam answers it in about a week because it runs on the same
national data platform as I amsterdam, but it does not test any of the things New Orleans tests.

One more thing stated plainly: `docs/takeovers.md` gates city two on a guest curator completing a
second week voluntarily (Gate B), and `STATE.md` on Amsterdam feeling locked. Nothing in the repo
records either gate as passed. This memo does not argue them away; it says what city two costs when
they are.

---

## 1. What is Amsterdam-only in the code today

The app is partly multi-city already: `src/data/cities.ts` has a `City` record with coordinates,
picks and a source roster, the deck ranks against whichever city is active, `?city=new-orleans`
boots the paused deck (`App.tsx:129`), the hourly scrubber and the daylight grade take the city's
coordinates, and the curate worker is keyed per city (`worker/curate/src/index.ts:63, :278`). The
pipeline writes every data file as `<name>.<city>.json`. Below is everything that still assumes
Amsterdam, grouped, with a rough cost to make it per-city. Line numbers are from `main` at `edfdad8`.

### 1a. Adapters gated to one city

| Where | What | To make it per-city |
| --- | --- | --- |
| `app/scripts/adapters/iamsterdam.ts:134` (`if (cityKey !== 'amsterdam') return []`), `:24` BASE URL, `:29-37` the seven calendar namespaces, `:95` `locality !== 'Amsterdam'`, `:97` `from €` | The variety engine, bound to one host | The JSON-LD parser (`parseEventPage`, `:75-130`) is already generic. Lift host, category map, currency and locality into the `City` record: about a day. Any new city then needs its own listing discovery (sitemap or category pages). |
| `app/scripts/adapters/guides.ts:278, :287` (same gate), `:24-25` the two guide URLs, `:95-99` section map, `:149-197` LBB page-shape parser, `:200, :214-227` resolve via I amsterdam's sitemap | The two weekend guides, read deterministically | Each guide is a page-shape parser (about 100 lines plus a fixture and tests). A new city needs one parser per guide, roughly half a day to a day each, plus a resolver pointed at that city's organiser records. |
| `app/scripts/adapters/ra.ts:14` (`RA_AREA = { amsterdam: 29 }`), `:57` and `:119` referer `ra.co/events/nl/...` | Resident Advisor | One line per city: area ids resolved live for all eight candidates (see 2c). Hours. |
| `app/scripts/adapters/lbb.ts:90`, `eye.ts:145`, `scouted.ts:16` (+ `:36` fallback link to iamsterdam.com) | LBB agenda, Eye Filmmuseum, the scouted slate | These are Amsterdam sources; keep the gates, key the scouted slate per city. Hours. |
| `app/scripts/adapters/websearch.ts:44-47` GEO (has a `new-orleans` entry already), `:63-70` FACETS (Volkskrant, World Cup), `:90-94` the trusted-source list in the prompt, `:152` Open-Meteo call at 52.37/4.9, Europe/Amsterdam | The serendipity lane | Facets, trusted sources and the weather call move into the city record: a day. |
| `app/scripts/roster.ts:18-46` | LLM/RSS rosters (Amsterdam 12 entries, New Orleans 6) | Already keyed by city. The New Orleans entries need re-verifying: OffBeat's `/events/` is now an archive page (its calendar moved to a CitySpark widget), and WWOZ's terms forbid robots (section 2). |
| `app/scripts/heroes.ts:20`, `app/scripts/curated.ts` (title-matched image pins, not keyed) | Hand pins | Heroes are keyed; curated pins are title-only and would need a city scope so a pin never fires in the wrong city. Hours. |

### 1b. Coordinates, stations and the weather lens

| Where | What | To make it per-city |
| --- | --- | --- |
| `app/src/components/useCurrentWeather.ts:13` (`LAT = 52.3676, LON = 4.9041, STATION = 'EHAM'`), `:14-16` the model, satellite and METAR URLs built from them | The "now" sky in the header | Take lat/lon/station from the active city: half a day. The satellite call returns nothing for North America, so the fuse falls back to report plus forecast layers (it already degrades softly, `current-weather.ts:174`). |
| `app/public/_worker.js:7` (`ids=EHAM`) and `:23` (the `EHAM` regex) | The METAR relay on Cloudflare Pages | Accept `?station=` from an allow-list and cache per station: half a day. |
| `app/src/lib/current-weather.ts:145` (`timeZone: 'Europe/Amsterdam'`), `:150` ("Schiphol" in the tooltip) | Reading time and station name | Pass the city's zone and station label: hours. |
| `app/scripts/lib/pipeline.ts:489` and `:510` (`weekendMode` / `weekendModes`), `app/scripts/poster.ts:62`, `app/public/curate/legacy/index.html:577` | Build-time Open-Meteo calls at 52.37/4.9, Europe/Amsterdam | Pass the city's coordinates and zone: hours each. `upcomingWeekend()` (`pipeline.ts:462`) uses the runner's local date; fine on a UTC runner for Europe, needs a zone for a US city once the cron runs near midnight Central. |
| `app/src/weather/modes.ts:136-145` (`classify`: HOT at 24°, WARM 16, COOL 10, COLD_WET under 10 or rain 80%+), `:211` SUN_BONUS +3 for outdoor on HOT/WARM, `:83-121` the five modes' copy ("Layer up and the whole city is walkable") | The weather thesis, tuned to Amsterdam's climate | This is design work, not plumbing. A per-city threshold table is a day; deciding what HOT means in a Gulf summer (a sixth state where outdoor sinks at midday, a storm or hurricane-watch state, afternoon thunderstorm patterns) is a design pass with Ness, then two to four days. Also `App.tsx:163-167` (the DEMO figures say Amsterdam) and `:193-196` (`seasonMode`, Amsterdam seasons). |
| `App.tsx:1040-1041, :1102, :1107, :1118`, `Card.tsx:46`, `GlassForecast.tsx:33`, `glass.ts:24`, `TimeScrub.tsx:28`, `InputsSheet.tsx:53` | Every temperature prints `°` with a Celsius value; no unit switch exists | A `city.units` flag and one formatter: a day across app, poster and tests. Open-Meteo takes `temperature_unit=fahrenheit`, but the classifier must keep working in Celsius. |

### 1c. Geo

| Where | What | To make it per-city |
| --- | --- | --- |
| `app/src/lib/geo.ts:21-27` (the `District` type and order: Noord, Centrum, West...), `:46` `IJ_LAT`, `:50-53` origin presets (Centraal, Noord), `:58-107` the name-keyed gazetteer (about 100 Amsterdam venues), `:110-114` district centroids, `:125-138` `districtOf` (Dutch place tokens), `:211-212` 15 km/h bike speed and detour, `:226-229` the two IJ ferries, `:258-271` the "bike" and "bike + ferry" labels | The whole geo layer is one city's geography | Split into a `CityGeo` object (districts, centroids, gazetteer, travel model, water crossings): two to three days plus the existing 25 geo tests re-pointed. New Orleans needs far less gazetteer: `neworleans.com` records carry coordinates on every sampled page, so `resolveGeo`'s first branch (`:174`, "the feed knows") would do the work. The travel model (walk, streetcar, bike, car) and the Algiers ferry are a curator question. |
| `app/public/geo/index.html:209` ("Amsterdam"), `:270-300` an in-page copy of the gazetteer | The /geo prototype | Leave it; it is a frozen prototype surface. |
| `app/tests/geo.test.ts:155-161` | The live-feed coverage test (a collapse line for the Amsterdam feed) | Per-city threshold or skip for a seed city: hours. |

### 1d. Rosters, publishers and the taste layer

| Where | What | To make it per-city |
| --- | --- | --- |
| `app/src/data/sources.ts:7-70`, `sources.nola.ts` | The "what's feeding this" roster | Already per city; the New Orleans list needs the same re-verification as the pipeline roster. Hours. |
| `app/src/lib/place.ts:19-23` (`PUBLISHERS`: I amsterdam, LBB, Het Parool, Kidsproof...) | "A venue is a place, never a publisher" | Per-city list, or one global list that includes every city's publishers: hours. |
| `app/scripts/refresh.ts:609-618` (`srcRank`: LBB over I amsterdam over RA over Volkskrant), `:626` `LOW_QUALITY`, `:418` the venue stoplist, `:1172` `PAUSED = new Set(['new-orleans'])`; `app/scripts/ingest.ts:48, :109` | Source trust and the pause | Trust ranks belong in the city record; the pause flips when a city is ready. A day, mostly tests. |
| `app/scripts/lib/pipeline.ts:28, :36` (city tokens in the title key and stoplist), `:656` `NOT_OWN_PAGE` (LBB, I amsterdam, amsterdamtips...), `:807` Serper `gl: 'nl'`, `:1108-1117` the "which adapter" regexes, `:1129-1136` index-leaf and language-root tests, `:1146-1152` I amsterdam language twins, `:1178, :1212, :1251, :1278-1279` the Dutch/English stop and generic lists | Dedupe and image-gather heuristics with Dutch and Amsterdam words baked in | Each is a small list; move the city-specific words into the city record and keep the shared ones. One to two days with the dedupe tests. |
| `app/scripts/taste/corpus.json` (one global file, imported at `pipeline.ts:9`, `editor.ts:19`, `refresh.ts:41-42`, `restamp.ts:26-27`, `ingest.ts:24`, `export-canon.ts:8`), `taste/weekly.json`, `taste/scouted.json`, `taste/weights.json`, `taste/watchlist.json`; `app/scripts/lib/score.ts:42` (`amsterdam` in the STOP set) | One person's taste file for one city; Amsterdam vetoes would be applied to a New Orleans crawl, and the judge would be briefed with Amsterdam exemplars | `taste/<city>/corpus.json` and friends, loaded by city key: a day. The content of a second corpus is the curator's work (section 3). |
| `app/scripts/export-canon.ts:10, :22` (hard-wired to `amsterdam`), `restamp.ts:38`, `letter.ts:16`, `poster.ts:31` (default city) | Build and ops scripts | Loop over cities or take `--city`: hours. `.github/workflows/restamp.yml:26` and `refresh.yml:61` (poster) pass or assume Amsterdam; the crons (`refresh.yml:16-17`) are timed for the feed to land at 15:00 Amsterdam, which is 08:00 in New Orleans. |

### 1e. Copy, surfaces and the unfurl

| Where | What | To make it per-city |
| --- | --- | --- |
| `app/index.html:12, :16, :39` ("This weekend's Amsterdam plans"; the page title names Amsterdam), `app/public/manifest.webmanifest` description, `landing/index.html:7, :12, :28-29, :689, :699, :707` (areaServed Amsterdam) | Page metadata and the landing | Per-city metadata is a build-time template; the landing is one city's story. A day, plus a decision about whether the landing names two cities at all. |
| `App.tsx:763-764` ("Most of Amsterdam's best is simply always good"), `:1084` (the glass header literally says Amsterdam), `:1114` (tooltip), `MatchGame.tsx:272` ("Explore Amsterdam"), `GlassForecast.tsx:40, :44`, `SwipeStack.tsx:397` (a comment), `weekend.ts:40` (the .ics PRODID) | Copy that names the city | Use `city.label`: hours. |
| `app/scripts/poster.ts:343` and `:670` ("This weekend in Amsterdam"), `:386` ("Amsterdam ·" in the meta line), `:744` reads `picks.${CITY}.json` | The weekend poster and the unfurl | `CITY` is already a flag; the kick lines need the label and the sky plates need a check against a Gulf sky (the `OG_SKIES` photographs are Amsterdam skies). Hours, plus a look. |
| `app/public/curate/index.html:176` (`const CITY='amsterdam'`), `:473`, `:495` | The letter (curation board) reads `letter.amsterdam.json` | A `?city=` switch: hours. The legacy board (`curate/legacy/index.html:567-577, :989-990, :1461`) hard-codes eight file names and the Open-Meteo call; leave it parked. |
| `app/src/taste.ts:9-11` (`wkndr.saved.v1`, `wkndr.swiped.v1`, `wkndr.taste.v1`) | Swipes, saves and the on-device taste profile are not scoped by city | Ids are distinct across cities so nothing breaks, but a taste profile learned in Amsterdam would weigh New Orleans cards. Decide whether that is wanted; scoping the keys is hours. |
| `worker/curate/src/findimage.ts:89, :132, :155-156`, `roundup.ts:89` | The drop box's prompts and image searches say "Amsterdam" | Pass the city label into the worker: hours. |
| `list/src/index.ts:146, :151, :256`, `list/templates/*.html` | The Friday brief (unshipped) is written as Amsterdam-only | Leave until it ships. |
| 24 of 40 test files use Amsterdam fixtures | Tests | Fixtures stay; new cities add fixtures. The gate is that `bun test tests` keeps passing for Amsterdam while a second city's data files exist. |

**Total for the plumbing alone**, before any new city's adapters: roughly two weeks of focused work
(a `City` record that carries coordinates, station, zone, units, currency, climate thresholds,
districts and travel model, source trust, publisher list, dedupe stop-words; the taste files keyed
per city; the ops scripts and workflows looping over cities). This matches `docs/pipeline-architecture.md`
section 3.5, which listed four leaks; the count today is nearer forty small ones, because fourteen
weeks of Amsterdam-specific fixes landed since it was written. None of them is hard. The hard parts
are what the plumbing cannot supply: a city's sources, its climate reading, and a curator.

---

## 2. Candidate cities

The yardstick is Amsterdam's own record, measured with the same probe on the same evening:
I amsterdam's events sitemap holds 3,097 pages (1,162 English). Of 12 sampled, 10 had Event JSON-LD
(two were gone), 10 of 10 carried a start time, 8 of 10 coordinates, and 10 of 10 images were card-size
(the pipeline's line: shortest side 500 px or more, and no more than 1.6x upscale into the 800 by 1200
portrait card). Resident Advisor lists 66 Amsterdam nights for the weekend of 10 and 11 October.

### 2a to 2f, city by city

#### New Orleans

- **(a) Structured source: yes, and good.** `https://www.neworleans.com/` (New Orleans & Company, the
  tourism board, on the Simpleview platform). `https://www.neworleans.com/sitemap.xml` lists 13,664
  pages, 2,429 of them `/event/<slug>/<id>/`. All 16 event pages sampled carried Event JSON-LD with a
  typed class (Festival, MusicEvent, TheaterEvent, ExhibitionEvent, SportsEvent), `startDate` and
  `endDate`, a venue with a postal address, and GeoCoordinates on 16 of 16. Weak spots: no start
  times (dates only, 0 of 16), no prices, and the sitemap keeps past events (one sampled page was
  from August 2025), so the dates in the record do the filtering. Example records:
  `https://www.neworleans.com/event/crescent-city-blues-%26-bbq-festival/3205/` (Festival, 9 to 11
  Oct, Lafayette Square, 1200 by 800 image) and `https://www.neworleans.com/event/andy-j-forest/204096/`
  (MusicEvent, The Maison on Frenchmen St). The listing pages that filter by date are rendered in
  the browser from an internal endpoint (`/includes/rest_v2/plugins_events_events_by_date/`), which
  answers a scripted request with 403 Access Denied: it is deliberately closed and should stay
  closed to us. Discovery therefore runs off the sitemap: event ids are sequential (1,881 of the
  2,429 are above 200000), so a daily poll can fetch only the new ids, with a one-off backfill of
  about 80 minutes at the site's stated crawl delay of two seconds.
- **(b) Editorial weekend guides: three, all readable server-side.**
  `https://www.neworleans.com/blog/post/weekend-picks/` is a standing URL retitled each week
  ("New Orleans Weekend Picks (October 9-11, 2026)", modified Monday 5 Oct 14:31Z), eight items
  this week, each linking its own `/event/` record, so items resolve by link without any title
  matching. `https://www.whereyat.com/best-things-to-do-in-new-orleans-this-weekend` (Where Y'at, a
  free local monthly) is also a standing URL, by a named writer, updated Monday 5 Oct 07:12, ten
  items as h3 headings each with an organiser link and a photograph: the same page shape the guides
  adapter already parses. Gambit (the alt-weekly, on `nola.com`) publishes "New Orleans events: ..."
  every Sunday (4 Oct, 27 Sep, 20 Sep), about 18 items with 24 organiser and ticket links; the URL
  changes weekly and is found from `https://www.nola.com/gambit/events/`. Axios New Orleans has a
  Friday things-to-do column but serves a JavaScript challenge to scripts (403). The DMO guide is
  tourist-board taste (festivals, the Saints game, WWE); Gambit and Where Y'at are the local voice.
- **(c) Resident Advisor: effectively none.** Area 606 (New Orleans): 0 listings for 9 to 11 Oct and
  12 in the eight weeks to 30 Nov; area 65 (Louisiana): 1 and 14. The live-music listing that
  matters is WWOZ's Livewire, `https://www.wwoz.org/calendar/livewire-music?date=2026-10-10`: 64
  venues and 97 shows on Saturday 10 Oct, server-rendered, with times but no images and no
  structured data. OffBeat's `/events/` page is now an archive; its calendar moved to a CitySpark
  widget (`hub.cityspark.com`), so the roster entry at `roster.ts:39` is dead.
- **(d) Photographs at card size: half, mostly landscape.** Of 16 `neworleans.com` records, 8
  images were card-size as served (1200 wide), 9 when the CDN was asked for a larger rendition
  (`c_limit,h_2400,w_2400` returns up to the original), 4 were too small (960 to 1084 wide) and 3
  unreadable. Nearly all are 3:2 landscape, so the photo-band card proposed in `STATE.md` (open item
  00 b) matters more here than in Amsterdam. Where Y'at's guide photos: 7 of 10 card-size once the
  CDN prefix is stripped for the original.
- **(e) robots and terms: mixed, and this is where the real risk sits.**
  `https://www.neworleans.com/robots.txt` allows everything but one tracking path, with
  `Crawl-delay: 2`; no terms-of-use page was found at `/terms-of-use/` (404), so the board's terms
  are unknown and should be asked for. `https://www.wwoz.org/wwozorg-site-terms` grants personal,
  non-commercial use only and says the grant does not include the right to "systematically collect
  and use any data or content including the use of any data mining, robots, or similar data gathering
  and extraction methods" or to make commercial use; `https://www.wwoz.org/robots.txt` also names
  Claude, GPT and other AI agents with `Disallow: /` and sets `Crawl-delay: 10` for everyone else.
  The current New Orleans roster reads WWOZ through the LLM lane (`roster.ts:40`), and the June 2026
  feed on production carries two cards credited to it; that lane should not run again without
  WWOZ's permission. `https://www.nola.com/robots.txt` names 30 AI and scraper agents (ClaudeBot,
  Claude-Web, anthropic-ai, GPTBot, CCBot...) with `Disallow: /`, and `https://www.nola.com/site/terms.html`
  permits personal, non-commercial use only and says "We do not allow other web sites to republish
  our content under any circumstances." Signal plus link is not republishing, but the posture is
  clear: read Gambit's roundup for which events it names, never its words, and ask. Where Y'at's
  `/terms-and-conditions` forbids republishing and copying; it permits linking by some classes of
  site. The web_search lane cannot legitimately read nola.com at all (Claude's crawler is named).
- **(f) Weather reading: workable, with one gap.** METAR: KNEW (Lakefront, about 11 km from the
  French Quarter), KMSY (Armstrong, about 21 km) and KNBG (Belle Chasse, about 14 km) all reported
  on `https://aviationweather.gov/api/data/metar?ids=KMSY,KNEW,KNBG&format=json`; US reports are
  hourly rather than Schiphol's half-hourly, but they carry full cloud layers (FEW020 SCT047 OVC055)
  where European AUTO stations often report NCD or VV///. Open-Meteo's forecast answers for
  29.95/-90.07 with `timezone=auto` → America/Chicago, daily rain chance and hourly layers present.
  The satellite call the header makes (`satellite-api.open-meteo.com ... models=satellite_radiation_seamless`)
  returns no rows for New Orleans, Chicago, New York and Miami, and the API's documentation page says
  solar radiation from GOES "has not been integrated yet, so data is currently unavailable for North
  America". The sky reading would stand on the report and the forecast layers alone. Climate, from
  the 2025 archive: 243 HOT days, 105 with feels-like 35° or more, 7 at 40° or more; HOT on 57 of
  the 60 weekend days from April to October.
- **Already in the repo:** a `City` entry at `cities.ts:35-39`, 16 hand-written seed picks in
  `src/data/picks.nola.ts`, a roster of six (`roster.ts:38-45`, one dead), a web_search GEO entry
  with the right zone, and `app/public/data/picks.new-orleans.json`: 29 picks built on 2026-06-19
  from the LLM and web-search lanes, still served by production at
  `https://app.wkndr.xyz/data/picks.new-orleans.json` and reachable in the app with `?city=new-orleans`.
  Its 19 dated June picks would fall to the runtime past-date guard; the 10 evergreen ones would deal.

#### Rotterdam

- **(a) Yes, on I amsterdam's platform.** `https://www.rotterdam.info/` (Rotterdam Partners).
  `https://www.rotterdam.info/sitemap-finder.xml`: 3,447 pages, 827 Dutch and 421 English event
  pages under `/visit/finder-events/`. 12 of 12 sampled pages carried Event JSON-LD; 11 of 12 images
  were served from `app.thefeedfactory.nl/api/assets/`, the same national platform I amsterdam's
  adapter reads (confirmed by the asset host, e.g.
  `https://www.rotterdam.info/en/visit/finder-events/architects-of-the-after-hours-affr-x-nousklaer-audio-x-operator-radio`,
  10 Oct, LantarenVenster, price 12 EUR with a ticket URL, 1440 by 1226 image). Dates only, no
  start times (0 of 12). `https://www.uitagendarotterdam.nl/en/` (Rotterdam Festivals' Uitagenda)
  has 1,348 English agenda pages but no JSON-LD and 1200 by 630 share images; a second-class source.
- **(b) No weekly guide found.** Your Little Black Book has no Rotterdam weekend page
  (`/en/weekendtips-rotterdam/` and `/nl/` both 404; LBB is Amsterdam only). Uitagenda Rotterdam runs
  a "De uittips van <local>" series (personal tips from residents, irregular), not a weekly guide.
  `indebuurt.nl` answers scripts with 403. The "front of the deck is what the city's guides say"
  law has nothing to stand on here; the curator is the guide.
- **(c) RA:** area 174, 18 nights for the weekend, 59 in eight weeks, top attendance 10. Flyers 6 of
  6 card-size.
- **(d) Photographs:** 7 of 12 card-size from Feed Factory (two were under 500 px).
- **(e)** `https://www.rotterdam.info/robots.txt` allows everything except admin paths (Yandex and
  Baidu are blocked). Terms were not read.
- **(f)** EHRD (Rotterdam The Hague) reports, about 4 km from the centre. Open-Meteo and the
  satellite reading work. Same climate, zone, language, currency and units as Amsterdam.

#### Utrecht

- **(a) Weak.** `https://www.uitagendautrecht.nl/evenement/<id>/<slug>` pages carry Event JSON-LD,
  but on all 8 sampled `startDate` equalled `endDate` equalled today's date (the next occurrence,
  not the run), the address was empty and no image was in the record; images sit in the HTML on
  `assets.plaece.nl` (a different platform from Feed Factory), 1 of 3 card-size. Dates would have to
  be parsed from Dutch text ("25 september 2026"). `https://www.discover-utrecht.com/agenda/` is a
  Next.js front end over `backend.ontdek-utrecht.nl`, rendered in the browser; its event sitemap lists
  three tours from 2023 and 2024.
- **(b) No weekly guide found.** LBB has no Utrecht page (404), `indebuurt.nl` blocks scripts,
  `duic.nl`'s agenda path was 404, the Uitagenda's articles page has no weekend series.
- **(c) RA:** area 175, 12 for the weekend, 56 in eight weeks.
- **(e)** Both sites' robots allow everything.
- **(f) No station.** EHDB (De Bilt) issues no METAR through aviationweather.gov; the nearest
  reporting civil station is Schiphol, about 34 km away. Open-Meteo works.

#### Antwerp

- **(a) Walled.** `https://visit.antwerpen.be/` answers scripts with 403 Access Denied (Akamai),
  including `/robots.txt`. `https://www.uitinvlaanderen.be/` answers with a "Human Verification"
  page (AWS WAF). The national database behind both, publiq's UiTdatabank, answers
  `https://search.uitdatabank.be/offers/` with 401: it needs a registered client key, as
  `docs/source-map.md` noted in July. `thisisantwerp.be` failed its TLS handshake.
- **(b)** Nothing readable was found.
- **(c) RA:** area 404, 12 for the weekend, 58 in eight weeks; flyers 5 of 6.
- **(f)** EBAW (Antwerp) reports, about 5 km from the centre; at night it is an AUTO station with
  no cloud reading (`VV///`). Open-Meteo works. Climate close to Amsterdam.

#### Berlin

- **(a) Strong, three ways.** `https://www.visitberlin.de/en/event/<slug>` pages carry Event JSON-LD
  with start times, postal address and coordinates (2 of 2; e.g. `/en/event/supercity-3000`,
  Deutsches Technikmuseum); images are served at 792 px wide (1 of 2 card-size; larger renditions
  exist behind `og:image`). `https://api-v2.kulturdaten.berlin/api/events` is an open, keyless JSON
  API: 13,419 events, 213 for `startDate=2026-10-10&endDate=2026-10-11`; records carry dates,
  admission and references to attraction and location objects, but no images in the event record
  and a strong district-calendar flavour. `https://www.berlin.de/en/weekend-tips/` embeds Event
  JSON-LD for its featured events (seven on 5 Oct, with coordinates and 1200 px images) and offers
  RSS.
- **(b) Three readable guides.** `berlin.de/wochenend-tipps/` (German and English, weekly, RSS),
  `https://www.visitberlin.de/en/blog/weekend-tips-berlin` (ItemList JSON-LD), and The Berliner's
  `https://www.the-berliner.com/berlin/what-to-do-this-weekend-best-events/` (English, published
  Wednesday 30 Sep for the weekend, nine items grouped Friday to Sunday, organiser links including one
  to RA). `tip-berlin.de` serves a 950-byte JavaScript shell to scripts.
- **(c) RA:** area 34, 197 nights for the weekend, top attendance 784; flyers 6 of 6.
- **(e)** `visitberlin.de`, `berlin.de` and `the-berliner.com` robots allow general crawling.
- **(f)** EDDB (Brandenburg), about 18 km from Mitte. Open-Meteo and satellite work. Climate fits
  the current thresholds (50 HOT days in 2025).
- **The cost that is not in the sources:** Berlin is 3.7 million people and a dozen Kiez
  identities; an Amsterdam-size deck is a slice, and the curator decides which.

#### Lisbon

- **(a) The cleanest API of the eight, in Portuguese.** `https://www.agendalx.pt/wp-json/agendalx/v1/events?per_page=50`
  (Agenda Cultural de Lisboa, the city's cultural agenda) is open and keyless: title, subtitle,
  `occurences` as a list of ISO dates, venue, categories, tags such as "gratuito", a `featured_media_large`
  image on 50 of 50, prices and a link; 42 of the first 50 fall on the coming weekend; `?lang=en`
  returns English titles. 50 per page. Images 6 of 8 card-size. `https://www.visitlisboa.com/en/events/<slug>`
  pages carry Event JSON-LD with dates only and no coordinates; the image URL in the record points
  at a host that does not answer, and `/en/sitemap.xml` returned 500.
- **(b)** `https://lisboasecreta.co/o-que-fazer-em-lisboa-fim-de-semana/` (Fever's Secret Media
  network, Portuguese, updated Friday 2 Oct, eight-plus items). Time Out Lisboa's standing
  "esta semana" page reports a last modification in May 2025 and reads as an evergreen list; the
  English Time Out Lisbon has no weekend page at the expected URL (404). Readable guides exist but
  are thinner and in Portuguese.
- **(c) RA:** area 53, 26 for the weekend, top 351; flyers 5 of 6.
- **(e)** `agendalx.pt` has no robots.txt (404); `visitlisboa.com`'s is empty. Terms not read.
- **(f)** LPPT about 6.5 km from Baixa. Open-Meteo and satellite work. 141 HOT days and 24 days of
  feels-like 35°+ in 2025: the thresholds need a retune, smaller than New Orleans's.

#### Copenhagen

- **(a) No keyless structured source found.** `visitcopenhagen.com` product pages (1,826 with a
  GuideDanmark id, e.g. `/copenhagen/planning/copenhagen-light-festival-gdk1098085`) embed an Event
  JSON-LD object with no dates, no place and no image (2 of 2); the data lives in GuideDanmark, an
  API that needs registration. `https://www.kultunaut.dk/perl/arrlist/type-nynaut?Area=Kbh` is a
  server-rendered Perl listing with 12 event ids on the page and no structured data; its RSS link
  returned no items to a keyless call.
- **(b) Thin.** Mig & København's "Ugens tip" is one tip a week; Politiken's iBYEN runs a weekly
  "the week in Copenhagen" piece behind a paywall publisher; `cphpost.dk` answered 403; AOK no
  longer resolves.
- **(c) RA:** area 402, 25 for the weekend.
- **(f)** EKCH about 8.5 km. Open-Meteo and satellite work. Six HOT days in 2025: the HOT mode
  would almost never fire, which is fine.

#### London

- **(a) The DMO is closed to scripts.** `https://www.visitlondon.com/things-to-do/whats-on` serves a
  Cloudflare challenge (403); its robots.txt carries `Content-Signal: ai-train=no, search=yes, ai-input=yes`.
  Time Out's items are articles (NewsArticle JSON-LD), not Event records. IanVisits publishes a
  calendar with a feed, but its robots names `anthropic-ai` and `Claude-Web` with `Disallow: /`.
  Structured coverage would come from keyed APIs (Skiddle, Ticketmaster UK, DICE), not tested.
- **(b) The strongest single guide of the eight.** `https://www.timeout.com/london/things-to-do-in-london-this-weekend`:
  31 numbered items, published Sunday night for the weekend, original images 8 of 8 card-size,
  robots naming no AI agents. Londonist's weekend page answers 403; Secret London's is Fever
  affiliate content.
- **(c) RA:** area 13, 249 for the weekend, top 1,730.
- **(f)** EGLC (City) about 13 km from the West End. Climate fits.
- **The cost that is not in the sources:** nine million people; an Amsterdam-size deck is a
  borough.

### 2g. One number across all eight

| City | Structured source (keyless) | Weekly guides readable | RA nights, 10 and 11 Oct | Card-size photos in sample | Station, distance | Climate vs current thresholds |
| --- | --- | --- | --- | --- | --- | --- |
| Amsterdam (yardstick) | I amsterdam JSON-LD, times, often geo | 2 | 66 | 10/10 | EHAM, 10 km | tuned |
| Rotterdam | rotterdam.info JSON-LD (same platform), no times | 0 | 18 | 7/12 | EHRD, 4 km | fits |
| Utrecht | JSON-LD present but dates unusable; HTML parsing | 0 | 12 | 1/3 | none (EHAM 34 km) | fits |
| Antwerp | walled; UiTdatabank needs a key | 0 | 12 | n/a | EBAW, 5 km | fits |
| Berlin | visitBerlin JSON-LD with times and geo; open Kulturdaten API; berlin.de JSON-LD | 3 | 197 | 1/2 (small sample) | EDDB, 18 km | fits |
| Lisbon | Agenda LX open API, Portuguese | 1 to 2 | 26 | 6/8 | LPPT, 6.5 km | retune (141 HOT days) |
| Copenhagen | none keyless | 0 to 1 | 25 | n/a | EKCH, 8.5 km | fits |
| London | DMO closed; keyed APIs only | 1 strong | 249 | 8/8 (Time Out) | EGLC, 13 km | fits |
| New Orleans | neworleans.com JSON-LD, geo on all, no times | 3 | 0 | 8/16 (9/16 larger rendition) | KNEW, 11 km | re-cut (243 HOT days, 105 at 35°+ feels-like) |

---

## 3. Ranking by effort to reach Amsterdam's quality

"Amsterdam's quality" means: a deterministic organiser spine covering most categories, two or more
weekly guides read as guides, a club or music spine, honest photographs on most cards, a trusted
weather reading, and a library of about 150 evergreen cards with one person's taste behind them.
The last item costs the same in every city and no source supplies it; the ranking below is about
everything else.

1. **Rotterdam.** About a week beyond the shared plumbing: the I amsterdam parser reads
   `rotterdam.info` almost unchanged (listing discovery from the sitemap instead of category pages),
   RA is one line, weather needs nothing. What effort cannot buy: a weekly guide (none exists in a
   readable form) and start times. The deck would open on the curator's word, not a guide's.
2. **Berlin.** One to two weeks: a visitBerlin JSON-LD adapter, a Kulturdaten adapter for breadth,
   and three guide parsers (two of them with their own JSON-LD, so the parsers are small). German
   handling is light because the records are structured and English versions exist. What effort
   cannot buy: deciding which Berlin.
3. **Utrecht.** One to one and a half weeks, but a lower ceiling: dates and images have to be
   parsed out of HTML, there is no guide, RA is thin, and there is no weather station in the city.
4. **Lisbon.** Two to three weeks: the Agenda LX API adapter is a day, but guides are Portuguese
   and thin, the Visit Lisboa images need a workaround, the zone differs by an hour, and the
   weather thresholds need a modest retune.
5. **New Orleans.** Three to four weeks plus two conversations: a `neworleans.com` adapter with an
   id-based daily poll (two to three days), three guide parsers (two to three days), US units, clock,
   zone and travel model (three to four days), the station and satellite fallbacks (a day), a Gulf
   cut of the weather lens (a design pass with Ness, then two to four days), and the music spine,
   which depends on WWOZ's answer. What effort cannot buy: WWOZ's permission, and a curator on the
   ground.
6. **Copenhagen.** No keyless structured source; GuideDanmark registration and Kultunaut parsing
   before anything else; thin guides. Four weeks or more.
7. **Antwerp.** Everything behind a wall or a key. Needs publiq registration and a relationship with
   the city before a line of code.
8. **London.** The DMO is closed, structured data means keyed ticketing APIs (which Ness declined
   for Amsterdam on taste grounds), and the city is too big for one deck.

Two honest notes on the order. First, cheapest is not the same as most useful: Rotterdam proves
that the plumbing generalises and little else, because it reuses Amsterdam's platform, climate,
language and currency. Second, New Orleans sits where it does because of the weather lens and the
music rights, not because of the event data; on event data alone it would rank second or third.

### What a local curator has to supply that no source can

For every city, before the first weekend: about 40 evergreen cards to start (places, not events,
each with a photograph the curator vouches for), growing toward 150; a taste file in the shape of
`taste/corpus.json` (what is tourist bait, which venues are stars, which recurring things are
rested); the neighbourhood names and the order they are offered in; the travel model; the ranked
list of trusted local publications; and twenty minutes a week on the letter for at least two weeks
(`docs/takeovers.md`, Gate B). That is the part this memo cannot shorten.

**Rotterdam** (cheapest to build): the guide, because there is none. A Rotterdammer who will name
the weekend's ten things every week is the whole product here. The library would lean on the Maas,
Katendrecht, Delfshaven, the Witte de With strip, the Kop van Zuid and the markets; the travel model
is bike plus the water taxi and the Erasmusbrug, which the current geo code models well.

**Berlin** (second): which Berlin. The curator names the Kieze the deck serves (a Neukölln, Kreuzberg,
Friedrichshain deck is a different product from a Mitte, Prenzlauer Berg one), the club policy (RA
has 197 nights; the corpus's "curatorial identity" rule has to be rewritten for a city where generic
club nights are the norm), and the German-language judgment the English guides do not carry.

**New Orleans** (the recommendation): the music, first and most. With RA empty and WWOZ off-limits
until it says otherwise, the curator supplies the standing nights and rooms (the Frenchmen Street
clubs, Preservation Hall's sets, the Maple Leaf, d.b.a., Tipitina's, Bacchanal, the Saturn Bar, the
Music Box Village), the Sunday second-line calendar (Gambit publishes a season schedule), and the
rule for what counts as a night out versus a tourist trap. Then the library (City Park and the
sculpture garden, the Fly, Crescent Park, Algiers Point and its ferry, the markets at St. Roch and
Crescent City Farmers Market, the museums, the po-boy and sno-ball places that are places, not
events). Then the geography: French Quarter, Marigny, Bywater, Tremé, CBD and the Warehouse District,
Garden District, Uptown and Carrollton, Mid-City and Bayou St. John, Gentilly, Algiers, the Northshore
as the day-trip ring; how people actually move (walk, streetcar, bike, car) and what the river does
to the distance model. Then the climate reading: ten past weekends labelled by a local ("a 24° day
in January is glorious; a 24° day in July is a cool one"), hurricane-season behaviour, when an
afternoon storm cancels a plan and when it does not, and the hours people go out in August. Then the
kids lens (the Children's Museum, the Audubon zoo and aquarium, Storyland), price conventions (cover
versus tip the band, cash only), and the two Instagram accounts that beat every publication.

---

## 4. Recommendation and the smallest test

**City two: New Orleans, as Ness said, on three conditions.** None of them is code.

1. **A named curator in the city** who will supply the starter library and taste file and re-rank
   one weekend on the letter, and then do it again the following week (that second week is Gate B
   from `docs/takeovers.md`, applied to the new city). If that person does not exist, pick Rotterdam
   or Berlin instead: a city with a curator beats a city with better feeds, because the feeds were
   never the scarce resource.
2. **Two emails before any crawl runs on a schedule**: to WWOZ (ask for permission to read the
   Livewire calendar daily with credit and a link, or for a feed), and to New Orleans & Company (tell
   them what WKNDR does with their event records, ask for their terms and whether a feed exists). A
   third, to Gambit, before its roundup is read on a schedule. Until the answers come, the test
   below uses only neworleans.com's public pages at its stated crawl delay, Where Y'at's and the
   board's guides, and the curator.
3. **A Gulf cut of the weather lens agreed on paper first**, because a New Orleans deck that lifts a
   midday outdoor festival on a 36° August weekend would fail the thesis in front of its first
   users. The minimum is a per-city threshold table and a rule that HOT above a feels-like line
   sinks outdoor picks between late morning and early evening.

**The smallest test that would prove it: one weekend's deck, built once, shown to five locals.**

- **Where:** a branch `proto/nola-weekend` with its own preview, under the prototype protocol. The
  preview workflow points every branch at production's data (`VITE_DATA_ORIGIN`), so this branch
  needs one exception: serve its own `picks.new-orleans.json`. `main` is not touched; no cron runs.
- **What is in the deck:** the organiser records for one weekend from `neworleans.com` (the Weekend
  Picks' linked events plus the sitemap's new ids for that weekend, read once, at the crawl delay,
  no LLM), the Where Y'at items resolved to those records where they match, the curator's 40
  evergreen cards and five additions with a one-line "why" each, and the 16 seed picks in
  `picks.nola.ts` re-verified or dropped. No WWOZ reading. Music comes from the curator and from the
  MusicEvent records the board already carries (The Maison, Preservation Hall and others publish
  there). Target: 60 to 80 cards, 9 of 9 categories, photographs on the first ten.
- **What is plumbed, minimally:** `?city=new-orleans` as the entry; the header reading on KNEW;
  Fahrenheit on the face; a New Orleans threshold table behind the city record; coordinates read
  off the records so the Where sheet works without a gazetteer; the poster and the unfurl left as
  they are.
- **Who judges:** five residents, not visitors, spread across at least three neighbourhoods, on their
  phones, Thursday or Friday before the weekend, with a follow-up on Sunday evening. Ness watches
  one of the five sessions live.
- **What counts as passing:** (1) of each person's first ten cards, six or more are things they
  would actually do, for at least three of the five; (2) when asked "what is missing that every local
  would expect this weekend", the five name no more than three distinct misses in total; (3) on
  Sunday, four of five say the weather line read true for the day; (4) at least two people save
  three or more cards and one sends a share link; (5) the curator agrees to do the next weekend.
  Any one failure says something specific: (1) is taste or the library, (2) is sources, (3) is the
  weather cut, (4) is the product, (5) is the whole premise.
- **Cost:** about a week of build on the branch after the shared plumbing (or two if the plumbing is
  done at the same time), one afternoon of the curator's time, five phone sessions, and no spend on
  the paid lanes (the test is keyless by design; the LLM judge is not needed for 70 cards a human has
  looked at).

If the test passes, the next step is the real one: the daily id poll on neworleans.com, the guide
parsers under the publish bar, the WWOZ answer, and the Monday and Thursday crons timed for Central
afternoon. If it fails on (2) or (3), Rotterdam and Berlin are the cities where the same week of
work would land further, and this memo's section 2 is the brief for either.

---

## What this scan did not do

Every source was fetched once, on the evening of 2026-10-05 (22:15 to 23:40 UTC), with a browser
user agent and a single GET per page, the way the adapters do. Samples are small (12 to 16 pages per
structured source, six flyers per RA area). Keyed or registered APIs (UiTdatabank, GuideDanmark,
Skiddle, Ticketmaster, DICE) were not tried. Terms pages were read for WWOZ, NOLA.com and Where Y'at;
for neworleans.com, rotterdam.info, agendalx.pt and visitberlin.de they were not found or not read.
The paused New Orleans pipeline was not run and no model was called. The repo's own position
("City #2: a dense-coverage EU city, not NOLA as-is", `docs/pipeline-architecture.md` sections 3.5
and 7, `STATE.md` open item 5) was written when New Orleans's roster was six pages read by an LLM;
the deterministic spine on neworleans.com changes "as-is", and nothing else in that position.

## Evidence log

All fetched 2026-10-05, 22:15 to 23:40 UTC, from a residential connection, browser user agent.

- Weather: `https://aviationweather.gov/api/data/metar?ids=EHAM,EHRD,EHDB,EHLE,EBAW,EBBR,EDDB,LPPT,EKCH,EKRK,EGLC,EGLL,KMSY,KNEW,KNBG&format=json&hours=2` (EHDB: no report; all others reporting). Open-Meteo forecast, current and hourly for nine coordinates (all 200, `timezone=auto` correct). `https://satellite-api.open-meteo.com/v1/archive?latitude=29.9511&longitude=-90.0715&hourly=shortwave_radiation&models=satellite_radiation_seamless&past_days=1&forecast_days=1` returned `latitude: nan` and no rows; `https://open-meteo.com/en/docs/satellite-radiation-api` states GOES data is not yet integrated and North America is unavailable. `https://archive-api.open-meteo.com/v1/archive?...start_date=2025-01-01&end_date=2025-12-31&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max` for the climate counts.
- Resident Advisor: `POST https://ra.co/graphql`, `area(areaUrlName, countryUrlCode)` to resolve ids (Amsterdam 29, Rotterdam 174, Utrecht 175, Antwerp 404, Berlin 34, Lisbon 53, Copenhagen 402, London 13, New Orleans 606, Louisiana 65), then the adapter's own `GET_EVENT_LISTINGS` for `listingDate` 2026-10-09 to 2026-10-12 and for 2026-10-05 to 2026-11-30.
- New Orleans: `https://www.neworleans.com/robots.txt`, `/sitemap.xml`, `/events/`, `/events/upcoming-events/?filter_daterange[start]=2026-10-09&filter_daterange[end]=2026-10-11` (0 server-rendered event links), `/plugins/core/get_simple_token/` (200) then `/includes/rest_v2/plugins_events_events_by_date/find/` (403 Access Denied; not retried), `/blog/post/weekend-picks/`, 20 `/event/.../<id>/` pages, `/terms-of-use/` (404), `/privacy-policy/`. `https://www.wwoz.org/robots.txt`, `/calendar/livewire-music`, `/calendar/livewire-music?date=2026-10-10`, `/livewire-music-calendar-policy`, `/wwozorg-site-terms`. `https://www.offbeat.com/robots.txt`, `/events/`, `/wp-json/tribe/events/v1/events` (404). `https://www.nola.com/robots.txt`, `/gambit/events/`, one roundup article, `/site/terms.html`. `https://www.whereyat.com/robots.txt`, `/events`, `/best-things-to-do-in-new-orleans-this-weekend`, `/terms-and-conditions`. `https://www.axios.com/local/new-orleans` (200) and one column (403 challenge). `https://www.verylocal.com/new-orleans/` (streaming landing). `https://antigravitymagazine.com/robots.txt` (403). `https://app.wkndr.xyz/data/picks.new-orleans.json` (29 picks, 2026-06-19).
- Rotterdam: `https://www.rotterdam.info/robots.txt`, `/sitemap.xml`, `/sitemap-finder.xml`, `/en/agenda` (redirects to `/en/visit/finder-events`), 13 `/en/visit/finder-events/<slug>` pages. `https://www.uitagendarotterdam.nl/robots.txt`, `/en/`, `/agenda/`, `/sitemap.xml`, `/en/sitemap.xml`, two `/en/agenda/<slug>/` pages. `https://www.yourlittleblackbook.me/en/weekendtips-rotterdam/` and `/nl/weekendtips-rotterdam/` (404). `https://indebuurt.nl/rotterdam/doen/` (403). `https://weekendsinrotterdam.nl/` (TLS error).
- Utrecht: `https://www.uitagendautrecht.nl/robots.txt`, `/`, `/agenda/`, `/artikelen/`, `/sitemap_index.xml`, `/wp/events-sitemap.xml` (404), nine `/evenement/<id>/<slug>` pages. `https://www.discover-utrecht.com/robots.txt`, `/sitemap.xml`, `/event-sitemap.xml`, `/page-sitemap.xml`, `/agenda/`, one `/event/<id>/<slug>` (404). LBB Utrecht pages (404). `https://www.duic.nl/uit-agenda/` (404). `https://indebuurt.nl/utrecht/doen/` (403).
- Antwerp: `https://visit.antwerpen.be/robots.txt` and `/en/events` (403). `https://www.uitinvlaanderen.be/robots.txt` and `/agenda/alle/antwerpen` (405, human verification). `https://search.uitdatabank.be/offers/?addressLocality=Antwerpen` (401). `https://docs.publiq.be/docs/uitdatabank/search-api/introduction` (200). `https://thisisantwerp.be/` (TLS error). `https://www.antwerpen.be/robots.txt` (200).
- Berlin: `https://www.visitberlin.de/robots.txt`, `/en/event-calendar-berlin`, `/en/event/supercity-3000`, `/en/event/berlin-sculpture-discovery`, `/en/weekend-tips` (redirects to `/en/blog/weekend-tips-berlin`). `https://www.berlin.de/robots.txt`, `/wochenend-tipps/`, `/en/weekend-tips/`, `/en/events/` (empty body). `https://api-v2.kulturdaten.berlin/api/events?pageSize=3` and `?startDate=2026-10-10&endDate=2026-10-11&pageSize=1`. `https://www.the-berliner.com/` and `/berlin/what-to-do-this-weekend-best-events/`. `https://www.tip-berlin.de/` and `/wochenend-tipps/` (950-byte shell). `https://mitvergnuegen.com/`.
- Lisbon: `https://www.visitlisboa.com/robots.txt`, `/en/events`, `/en/events/fado-in-chiado`, `/en/events/open-storage`, `/en/sitemap.xml` (500). `https://www.agendalx.pt/` and `/robots.txt` (404), `/wp-json/agendalx/v1/events` with `per_page=2`, `3`, `50`, `100` (capped at 50), `&lang=en`. `https://www.timeout.com/lisbon/things-to-do`, `https://www.timeout.pt/lisboa/pt/coisas-para-fazer` and `/as-melhores-coisas-para-fazer-em-lisboa-esta-semana`; the "this weekend" URLs in both languages (404). `https://lisboasecreta.co/` and `/o-que-fazer-em-lisboa-fim-de-semana/`. `https://www.nit.pt/fora-de-casa`.
- Copenhagen: `https://www.visitcopenhagen.com/robots.txt`, `/sitemap.xml`, two `-gdk` festival pages, three guessed what's-on URLs (404). `https://www.kultunaut.dk/robots.txt`, `/perl/arrlist/type-nynaut?Area=Kbh`, `/perl/mini/type-rss?Area=Kbh&periode=` (HTML, no items). `https://ibyen.dk/` (redirects to `politiken.dk/ibyen/`). `https://migogkbh.dk/` and `/kategori/ugens-tip/`. `https://www.scandinaviastandard.com/`. `https://cphpost.dk/` (403). `https://www.aok.dk/` (no DNS).
- London: `https://www.visitlondon.com/robots.txt` and `/things-to-do/whats-on` (403 challenge). `https://www.timeout.com/robots.txt`, `/london/things-to-do-in-london-this-weekend`, one item page. `https://londonist.com/robots.txt` and `/things-to-do-in-london-this-weekend` (403 challenge). `https://secretldn.com/robots.txt` and `/things-to-do-in-london-weekend/`. `https://www.ianvisits.co.uk/robots.txt` and `/calendar/`. `https://www.thenudge.com/robots.txt`, `https://www.skiddle.com/robots.txt`.
- Amsterdam yardstick: `https://www.iamsterdam.com/robots.txt`, `/sitemap.xml`, `/sitemap/events.xml`, 12 `/en/whats-on/calendar/...` pages; `https://www.yourlittleblackbook.me/en/weekendtips-amsterdam/` (modified 2026-10-05).
