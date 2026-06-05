import type { Category } from '../src/types'

// The category-spread source roster — the editorial judgment, made ONCE per city. The pipeline
// reads these every refresh so the pool stays diverse (food + art + free + gigs + films +
// festivals + kids…), not a wall of one thing. `type` routes the source:
//   'llm' → read by the LLM extractor (needs ANTHROPIC_API_KEY) — handles messy editorial pages
//   'rss' → read by the keyless RSS adapter — the always-on floor, rougher
// `facet` is the hint we hand the LLM (what to look for). Some pages are JS-walled; the LLM just
// takes what's in the HTML and we accept the gaps (the canon floor covers the rest).
export interface RosterSource {
  facet: string
  name: string
  url: string
  type: 'llm' | 'rss'
  category?: Category   // a default for RSS items (the LLM tags its own)
}

export const ROSTERS: Record<string, RosterSource[]> = {
  amsterdam: [
    { facet: 'exciting gigs', name: 'Songkick', url: 'https://www.songkick.com/metro-areas/31366-amsterdam', type: 'llm' },
    { facet: 'acclaimed + popular films', name: 'Eye Filmmuseum', url: 'https://www.eyefilm.nl/en/whats-on', type: 'llm', category: 'stage' },
    { facet: 'festivals + what’s on this weekend', name: 'I amsterdam', url: 'https://www.iamsterdam.com/en/whats-on', type: 'llm' },
    { facet: 'the best restaurants in the city (Eater’s essential / best-of list)', name: 'Eater Amsterdam', url: 'https://www.eater.com/maps/best-amsterdam-restaurants-netherlands-guide', type: 'llm', category: 'eat' },
    { facet: 'new + buzzy food & drink openings', name: 'Your Little Black Book', url: 'https://www.yourlittleblackbook.me/en/', type: 'llm', category: 'eat' },
    { facet: 'art shows, especially closing soon', name: 'Stedelijk', url: 'https://www.stedelijk.nl/en/exhibitions', type: 'llm', category: 'art' },
    { facet: 'kid-friendly things', name: 'Kidsproof', url: 'https://www.kidsproof.nl/amsterdam', type: 'llm' },
    { facet: 'members’ events', name: 'Soho House Amsterdam', url: 'https://www.sohohouse.com/houses/soho-house-amsterdam', type: 'llm' }, // members-only; usually sparse publicly
  ],
  'new-orleans': [
    { facet: 'live music + festivals this weekend', name: 'OffBeat', url: 'https://www.offbeat.com/events/', type: 'llm', category: 'live' }, // events page, not the blog feed
    { facet: 'live music tonight/weekend', name: 'WWOZ Livewire', url: 'https://www.wwoz.org/calendar/livewire-music', type: 'llm', category: 'live' },
    { facet: 'festivals + what’s on', name: 'neworleans.com', url: 'https://www.neworleans.com/events/', type: 'llm' },
    { facet: 'acclaimed + popular films', name: 'The Prytania', url: 'https://www.theprytania.com/', type: 'llm', category: 'stage' },
    { facet: 'the best restaurants in the city (Eater’s Essential 38 / best-of list)', name: 'Eater New Orleans', url: 'https://nola.eater.com/maps/best-restaurants-new-orleans-38-map-nola', type: 'llm', category: 'eat' },
    { facet: 'art shows, especially closing soon', name: 'Ogden Museum', url: 'https://ogdenmuseum.org/', type: 'llm', category: 'art' },
  ],
}
