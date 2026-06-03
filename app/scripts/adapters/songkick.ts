// Songkick adapter — the canonical live source for gigs. Real API shape; activates the
// moment SONGKICK_API_KEY is set in the environment (free key from songkick.com/developer).
// Without a key it returns [] and the run logs that gigs are seed-only.
import type { Pick } from '../../src/types'
import { deriveWeatherFit } from '../lib/pipeline'

interface SongkickEvent {
  id: number
  displayName: string
  type: string
  uri: string
  start: { date: string; time: string | null }
  venue: { displayName: string | null; metroArea?: { displayName?: string } }
  performance: { artist: { displayName: string } }[]
  ageRestriction?: string | null
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-06-06" + "20:00:00" → "Sat 6 Jun · 20:00"
function humanWhen(date: string, time: string | null): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const base = `${WD[dt.getUTCDay()]} ${d} ${MON[m - 1]}`
  return time ? `${base} · ${time.slice(0, 5)}` : base
}

export async function songkickAdapter(metroId: number | undefined, apiKey: string | undefined): Promise<Pick[]> {
  if (!metroId || !apiKey) return []
  const url = `https://api.songkick.com/api/3.0/metro_areas/${metroId}/calendar.json?apikey=${apiKey}&per_page=50`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Songkick ${res.status}`)
  const json = await res.json()
  const events: SongkickEvent[] = json?.resultsPage?.results?.event ?? []
  return events
    .filter((e) => e.venue?.displayName)
    .map((e): Pick => {
      const artists = e.performance?.map((p) => p.artist.displayName) ?? []
      const headliner = artists[0] ?? e.displayName
      return {
        id: `sk-${e.id}`,
        title: e.displayName,
        venue: e.venue.displayName!,
        area: e.venue.metroArea?.displayName ?? '',
        when: humanWhen(e.start.date, e.start.time),
        category: 'live',
        freshness: 'weekend',
        outdoor: false,           // gigs default indoor; a venue map would refine this
        kid: false,
        price: 'ticketed',
        blurb: artists.length > 1 ? `${headliner}, with ${artists.slice(1, 3).join(', ')}.` : `${headliner} live.`,
        why: 'Live gig this weekend · pulled from Songkick',
        source: 'Songkick',
        link: e.uri,
        weatherFit: deriveWeatherFit(false),
        verify: true,             // auto-pulled — confirm before relying
      }
    })
}
