import type { Pick, Category, Mode } from '../src/types'

// HERO EVENTS — confirmed must-see events for the coming weekend, GUARANTEED into the feed every refresh
// regardless of the non-deterministic web-search adapters. (A flagship like Bruno Mars at the ArenA was
// surfaced one run and silently gone the next — a curated image can't help an event that isn't there.)
//
// Each hero is injected as a pick, EXEMPT from the per-category cap, carrying a hand-verified portrait image.
// They flow through the normal date filters, so a hero whose weekend has passed auto-drops — keep this list
// current to the coming weekend; stale entries fall off on their own (no harm if left a week). id prefix
// `web-hero-` so the app + pipeline treat them as LIVE (they lead the deck and get editor-scored).
//
// This is the reliability layer for the events that MUST be right. Maintain ~5-10 entries for the weekend.

type Hero = {
  slug: string; title: string; venue: string; area: string; when: string; category: Category
  price: string; outdoor: boolean; blurb: string; why: string; source: string; link: string; image: string
}

const HEROES: Record<string, Hero[]> = {
  amsterdam: [
    {
      slug: 'bruno-mars', title: 'Bruno Mars – The Romantic Tour', venue: 'Johan Cruijff ArenA',
      area: 'Southeast (Bijlmer)', when: 'Sat 4 Jul · 20:00 / Sun 5 Jul · 20:00', category: 'live',
      price: 'ticketed', outdoor: false,
      blurb: 'GRAMMY-winning pop sensation brings his first full stadium tour to Amsterdam, with DJ Pee Wee and Victoria Monét.',
      why: 'Huge global tour · both nights', source: 'I amsterdam',
      link: 'https://www.iamsterdam.com/en/whats-on/calendar',
      image: 'https://i.wfolio.com/x/uZ-vrbqj2EegGiEP2PkuXsznqV8gaoGg/cNtZ_MSjbOEP2eLU2__oPeAAQGn0NK35/yXhfxlFmzf7IvhdXN8iX4vDLlxP5xcQj/zZ_QPu5Xm6ghtzaTGdROz0Rerda5lFNq/vxJ3owfZMHQBHB-EggWsoA.jpg',
    },
    {
      slug: 'homelanding', title: 'Homelanding', venue: 'Marineterrein', area: 'Centrum (Marineterrein)',
      when: 'Wed 1 Jul – Sun 5 Jul', category: 'out', price: 'free', outdoor: true,
      blurb: 'A free summer festival on the waterfront Marineterrein — food, music, a swim spot and design across the old naval yard.',
      why: 'Free · waterside summer festival', source: 'Your Little Black Book',
      link: 'https://www.marineterrein.nl/en/',
      image: 'https://www.amsterdamnow.com/app/uploads/marineterrein-amsterdam3.jpg',
    },
  ],
}

const FAIR: Mode[] = ['HOT', 'WARM', 'COOL']
const ALL: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']

/** Hero events for a city as Pick[] (RAW images — the caller wsrv-wraps). id `web-hero-*` → treated as live. */
export function heroPicks(cityKey: string): Pick[] {
  return (HEROES[cityKey] ?? []).map((h) => ({
    id: `web-hero-${h.slug}`,
    title: h.title,
    venue: h.venue,
    area: h.area,
    when: h.when,
    category: h.category,
    freshness: 'weekend',
    outdoor: h.outdoor,
    kid: false,
    price: h.price,
    image: h.image,
    blurb: h.blurb,
    why: h.why,
    source: h.source,
    link: h.link,
    weatherFit: h.outdoor ? FAIR : ALL,
    verify: false,
    buzz: 2,
  }))
}
