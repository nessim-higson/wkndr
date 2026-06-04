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
