import type { Pick } from '../types'
import type { Source } from './sources'
import { PICKS } from './picks'
import { KIDS_AMSTERDAM } from './picks.kids'
import { EAT_AMSTERDAM } from './picks.eat'
import { LOSTIN_AMSTERDAM } from './picks.lostin'
import { BATCH2_AMSTERDAM } from './picks.batch2'
import { EVERGREEN_AMSTERDAM } from './picks.evergreen'
import { CANON2_AMSTERDAM } from './picks.canon2'
import { SOURCE_ROSTER, SOURCE_COUNT } from './sources'
import { PICKS_NOLA } from './picks.nola'
import { SOURCE_ROSTER_NOLA, SOURCE_COUNT_NOLA } from './sources.nola'

// A city is a self-contained feed: its picks + its source roster + a home coordinate.
// Everything downstream (weather classify, rank, itinerary, .ics) is city-agnostic and
// just consumes whichever city is active — so adding a city = adding one of these.
export interface City {
  key: string
  name: string          // matched against reverse-geocoded city names
  label: string         // shown in UI
  lat: number
  lon: number
  picks: Pick[]
  sources: Record<string, Source[]>
  sourceCount: number
  seed?: boolean        // true = hand-seeded proof set, not yet crawled
  songkickMetroId?: number   // for the live gigs adapter (scripts/adapters/songkick.ts)
}

export const CITIES: City[] = [
  {
    key: 'amsterdam', name: 'Amsterdam', label: 'Amsterdam', lat: 52.37, lon: 4.89,
    picks: [...PICKS, ...KIDS_AMSTERDAM, ...EAT_AMSTERDAM, ...LOSTIN_AMSTERDAM, ...BATCH2_AMSTERDAM, ...EVERGREEN_AMSTERDAM, ...CANON2_AMSTERDAM], sources: SOURCE_ROSTER, sourceCount: SOURCE_COUNT, songkickMetroId: 31366,
  },
  {
    key: 'new-orleans', name: 'New Orleans', label: 'New Orleans', lat: 29.95, lon: -90.07,
    picks: PICKS_NOLA, sources: SOURCE_ROSTER_NOLA, sourceCount: SOURCE_COUNT_NOLA, seed: true,
    songkickMetroId: 4968,
  },
]

export const DEFAULT_CITY = CITIES[0]

export const cityByKey = (key: string | null | undefined): City | undefined =>
  CITIES.find((c) => c.key === key)

// Match a reverse-geocoded place name to a city we actually have a feed for (exact-ish
// name match). Returns undefined if we have no feed — the caller keeps the current city
// but can still show that place's live weather.
export function cityByName(name: string | null | undefined): City | undefined {
  if (!name) return undefined
  const n = name.trim().toLowerCase()
  return CITIES.find((c) => c.name.toLowerCase() === n)
}

// Nearest city by great-circle-ish distance (cheap squared-degree proxy) — a fallback
// so a coordinate near a city we cover still snaps to it.
export function nearestCity(lat: number, lon: number, maxDeg = 1.5): City | undefined {
  let best: City | undefined
  let bestD = Infinity
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2
    if (d < bestD) { bestD = d; best = c }
  }
  return best && bestD <= maxDeg ** 2 ? best : undefined
}
