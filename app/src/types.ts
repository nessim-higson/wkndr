// Core domain types for WKNDR (see docs/discovery-direction.md §6, §7)

export type Mode = 'HOT' | 'WARM' | 'COOL' | 'COLD_WET' | 'VOLATILE'

// 9-category taxonomy (kids is a cross-cut lens, not a category — see §6)
export type Category =
  | 'out'      // Out & about
  | 'eat'      // Eat
  | 'drink'    // Drink
  | 'art'      // Art & galleries
  | 'live'     // Live & gigs
  | 'stage'    // Stage & screen
  | 'daytrip'  // Day-trips
  | 'market'   // Markets & one-offs
  | 'shop'     // Shops (design stores, bookshops, concept + streetwear)

// freshness buckets (the time dimension)
export type Freshness = 'new' | 'weekend' | 'always' | 'ending'

// live availability/scarcity signal (from the crawl) — shown as a badge, lifts ranking
export type Status = 'sold-out' | 'selling-fast' | 'final-week' | 'free'

export type SwipeDir = 'like' | 'nope' | 'save' | 'skip'

// Where a live pick's image came from — the provenance vocabulary (V.11.9). Every value is a
// photo OF the event/venue or an explicit absence; there is no "themed" value on purpose.
export type ImageWhy =
  | 'organiser'   // the organiser's own upload (I amsterdam / RA / LBB / scout), sanity-screened
  | 'event-page'  // og:image / JSON-LD off the pick's OWN link, vision-verified
  | 'portrait'    // the act's Wikipedia portrait, vision-verified
  | 'web'         // an open-web candidate, vision-verified against the event
  | 'venue'       // borrowed from the canon entry for the SAME venue (a venue-led event)
  | 'curated'     // hand-pinned in scripts/curated.ts
  | 'none'        // no honest image found — the typographic face ships

export interface Pick {
  id: string
  title: string
  venue: string
  area: string
  when: string         // human date/time, e.g. "Sun 31 May · 20:00" or "Thu–Fri 4–5 Jun"
  category: Category
  freshness: Freshness
  outdoor: boolean
  kid: boolean
  price: string
  image?: string       // a photo OF THE EVENT (or of its venue) — never a stand-in. Absent = the
                       // card renders the typographic no-photo face (V.11.9: an honest blank beats
                       // a plausible wrong photo; the category bank + themed stock are retired).
  imageWhy?: ImageWhy  // THE IMAGE RECEIPT (V.11.9) — where the photo came from, stamped by the
                       // pipeline on every live pick (canon is hand-imaged, unstamped). The board
                       // renders it as a chip so a wrong-photo class is a 2-minute glance, not a
                       // hunt. 'none' = no honest image was found; the card says so by design.
  blurb: string
  why: string          // "why this fits you / now" reasoning
  source: string       // publication credited (signal + link model)
  link: string         // link out to the source/booking page (never republish)
  weatherFit: Mode[]   // modes this pick peaks in
  lat?: number         // venue coordinates (V.11). OPTIONAL and usually absent: today `lib/geo.ts`
  lon?: number         // resolves position from venue/area via its own gazetteer. When the pipeline
                       // starts stamping coords (STATE.md open item 8 — RA's `venue.area`, I amsterdam's
                       // address JSON-LD, PDOK on the cron), resolveGeo prefers these and the
                       // gazetteer becomes the fallback. Nothing else needs to change.
  verify?: boolean     // true = detail (venue/time) needs confirming before relying
  status?: Status      // live availability/scarcity from the crawl
  buzz?: number        // how many independent sources flagged it (the "what's talked about" signal)
  firstSeen?: string   // ISO date (YYYY-MM-DD) the pipeline FIRST saw this title in a feed, carried
                       // forward untouched every run after that. `freshness` is a claim about the
                       // WORLD; this is our record of when the claim started, and a `new` is
                       // honoured only while the record still supports it (lib/freshness.ts).
                       // Absent = we have no record of it arriving, so it cannot claim to be new.
  judgeScore?: number  // 0..10 — the judge's RAW verdict, never overwritten by an approval. editorScore
                       // below is the RANKING score and later passes raise it (★ floors it at 8, 👑 sets
                       // 10), so only this one can be compared across approved and unapproved picks.
                       // The publish bar (JUDGE_FLOOR in refresh.ts) reads this and nothing else.
  editorScore?: number // 0..10 editorial quality from the build-time judge (scripts/adapters/editor.ts);
                       // a term in rankPicks so "best" actually ranks. Live picks only; undefined → 0.
  popularity?: number  // real-draw signal from structured sources (e.g. Resident Advisor "attending"
                       // count); a log-scaled term in rankPicks. Structured-source picks only; undefined → 0.
  inboxScore?: number  // Workstream 2: the composite candidate score (scripts/lib/score.ts) —
                       // orders the board's inbox. Inbox picks only; never read by the app's deck.
  scoreWhy?: string    // the score's own receipt ("seen today · 2 sources · on this weekend"),
                       // shown on the board card so the number can be argued with.
  tier?: 'classic' | 'bespoke'   // evergreen only: well-known staple vs cooler/curated find (browse filter)
  top?: boolean        // Ness's TOP escalation (Curation Board 👑 → corpus.topPicks): leads the served
                       // deck ahead of everything and carries the "Top pick" pill. Stamped by the
                       // pipeline (live picks) and at feed ingestion (canon picks, via feed.topMatches).
  lead?: boolean       // WEEKEND SLATE ▲ (board → taste/weekly.json, THIS weekend only): opens the
                       // deck just under the TOPs; guaranteed into the feed. Auto-expires weekly.
  later?: boolean      // WEEKEND SLATE ▼ (this weekend only): stays in the feed but sinks to the back
                       // of the pile — a "not this week", NOT a kill. Auto-expires weekly.
  pilePos?: number     // WEEKEND SLATE, hand-dragged pile order (board ⠿ → weekly.json `pile`, THIS
                       // weekend only): 1-based; the deck deals these first, in exactly this order,
                       // above every other tier — the human override. Auto-expires weekly.
  servePos?: number    // THE PROJECTED SERVE ORDER, stamped at build/restamp time by running the
                       // app's OWN pipeline (orderServed ∘ diversify ∘ rankPicks — forecast weekend
                       // mode, seed 0, no taste) over the published feed. The Curation Board's
                       // WEEKEND PILE reads this instead of re-deriving an approximation, so board
                       // and deck can't drift (the old mirror ignored pilePos — Ness's own dragged
                       // order). Runtime still nudges the phone: live weather ≠ forecast, on-device
                       // taste, Shuffle seed. The app itself IGNORES this field.
}

export const CATEGORY_LABEL: Record<Category, string> = {
  out: 'Out & about',
  eat: 'Eat',
  drink: 'Drink',
  art: 'Art & galleries',
  live: 'Live & gigs',
  stage: 'Stage & screen',
  daytrip: 'Day-trip',
  market: 'Markets & one-offs',
  shop: 'Shops',
}

// A pick's weather affinity, surfaced as the card's top-left pill. Derived from weatherFit +
// outdoor. When a live mode is passed and the pick peaks in TODAY's weather, it flips to
// "Perfect today" (perfect=true) — the app's weather-brain made visible on the card.
export function weatherPill(p: Pick, live?: Mode): { text: string; perfect: boolean } {
  const fit = p.weatherFit
  const sunny = fit.includes('HOT') || fit.includes('WARM')
  const wet = fit.includes('COLD_WET')
  const allWeather = fit.length >= 5
  let text: string
  if (!p.outdoor && (allWeather || (sunny && wet))) text = 'Rain or shine'
  else if (p.outdoor && sunny && !wet) text = 'Best when sunny'
  else if (wet && !sunny) text = 'Best on a wet day'
  else if (!p.outdoor) text = 'Rain or shine'
  else text = 'Better when dry'
  const sensitive = text !== 'Rain or shine'
  const perfect = !!live && sensitive && fit.includes(live)
  // the app is about the COMING WEEKEND, not today — so the peak pill reads "this weekend"
  // (an event "Perfect today" was misleading when it's actually on Sat/Sun).
  return { text: perfect ? 'Perfect this weekend' : text, perfect }
}

// THE one pill a card front may carry — the single highest-signal fact, or nothing.
// Priority: the live weather peak ("Perfect today") > scarcity (selling fast / final week)
// > cross-source buzz ("Talked about" — 2+ independent publications flagged it, the rare
// everyone's-going signal, ~10% of cards) > time-sensitivity (new / ending). Everything
// quieter — static weather affinity, kids, category — lives on the card's detail, not its face.
export interface CardSignal { text: string; tone: 'accent' | 'red' | 'green' | 'dim'; glow?: boolean }
export function cardSignal(p: Pick, live?: Mode): CardSignal | null {
  if (p.top) return { text: 'Top pick', tone: 'accent', glow: true }   // Ness's escalation outranks everything
  // Name the WEATHER when the weather is the reason (Ness, rainy Sunday 2026-08-30: "the cards
  // should have some indication of best for this rainy day"). A generic "Perfect this weekend"
  // asks to be trusted; "Perfect for a rainy day" explains itself.
  if (weatherPill(p, live).perfect) return { text: live === 'COLD_WET' ? 'Perfect for a rainy day' : 'Perfect this weekend', tone: 'accent', glow: true }
  if (p.status) {
    const tone = p.status === 'final-week' ? 'red' : p.status === 'free' ? 'green' : p.status === 'sold-out' ? 'dim' : 'accent'
    return { text: STATUS_LABEL[p.status], tone }
  }
  if ((p.buzz ?? 0) >= 2) return { text: 'Talked about', tone: 'accent' }
  if (p.freshness === 'new') return { text: FRESHNESS_LABEL.new, tone: 'accent' }
  if (p.freshness === 'ending') return { text: FRESHNESS_LABEL.ending, tone: 'red' }
  return null
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  new: 'New this week',
  weekend: 'This weekend',
  always: 'Always good',
  ending: 'Ending soon',
}

export const STATUS_LABEL: Record<Status, string> = {
  'sold-out': 'Sold out',
  'selling-fast': 'Selling fast',
  'final-week': 'Final week',
  free: 'Free',
}
