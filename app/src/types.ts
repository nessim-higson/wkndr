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
  image?: string       // real og:image; when absent the card renders a typographic poster
  blurb: string
  why: string          // "why this fits you / now" reasoning
  source: string       // publication credited (signal + link model)
  link: string         // link out to the source/booking page (never republish)
  weatherFit: Mode[]   // modes this pick peaks in
  verify?: boolean     // true = detail (venue/time) needs confirming before relying
  status?: Status      // live availability/scarcity from the crawl
  buzz?: number        // how many independent sources flagged it (the "what's talked about" signal)
  tier?: 'classic' | 'bespoke'   // evergreen only: well-known staple vs cooler/curated find (browse filter)
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
  return { text: perfect ? 'Perfect today' : text, perfect }
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
