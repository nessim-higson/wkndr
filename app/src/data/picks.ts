import type { Pick } from '../types'

/**
 * REAL events for Amsterdam — curated 31 May 2026 for "this weekend" (today,
 * Sun 31 May) + the coming weekend (Thu 4 – Sun 8 Jun).
 *
 * This is a HAND-CURATED SNAPSHOT, not a live feed (see docs/content-pipeline.md
 * for the automated Phase-5 plan). Sources are credited + linked (signal + link,
 * never republished). `verify: true` marks a detail the source didn't confirm —
 * the Thursday cron will HEAD-check + confirm these before any real publish.
 *
 * Sources: Songkick (gigs), Holland Festival, De Nieuwe Kerk / H'ART (exhibitions),
 * I amsterdam (what's on). Images are picsum placeholders until the pipeline pulls
 * real venue imagery.
 */
export const PICKS: Pick[] = [
  // ───────── THIS WEEKEND — today, Sun 31 May ─────────
  {
    id: 'twice',
    title: 'TWICE — READY TO BE world tour',
    venue: 'Ziggo Dome', area: 'Zuidoost', when: 'Sun 31 May · tonight',
    category: 'live', freshness: 'weekend', outdoor: false, kid: false,
    price: 'from €65',
    image: 'https://picsum.photos/seed/twice/900/1200',
    blurb: 'K-pop juggernaut TWICE bring the stadium show to the Ziggo Dome tonight — the loudest, most choreographed night in town.',
    why: 'Happening tonight · indoor, weather-proof · go big or stay home',
    source: 'Songkick', link: 'https://www.songkick.com/metro-areas/31366-amsterdam',
    weatherFit: ['WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'illa-j',
    title: 'Illa J + Jeru the Damaja',
    venue: 'Bitterzoet', area: 'Centrum', when: 'Sun 31 May · tonight',
    category: 'live', freshness: 'weekend', outdoor: false, kid: false,
    price: '~€22',
    image: 'https://picsum.photos/seed/illaj/900/1200',
    blurb: 'Detroit soul-rap (Dilla’s brother) with a 90s boom-bap legend opening, in one of the centre’s best small rooms. Close, warm, low-key.',
    why: 'Tonight · intimate room · the antidote to a stadium show',
    source: 'Songkick', link: 'https://www.songkick.com/metro-areas/31366-amsterdam',
    weatherFit: ['WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },

  // ───────── COMING WEEKEND — Thu 4 – Sun 8 Jun ─────────
  {
    id: 'harry-styles',
    title: 'Harry Styles + Robyn',
    venue: 'Johan Cruijff Arena', area: 'Zuidoost', when: 'Thu–Fri 4–5 Jun',
    category: 'live', freshness: 'weekend', outdoor: false, kid: false,
    price: 'resale only',
    image: 'https://picsum.photos/seed/harrystyles/900/1200',
    blurb: 'Two stadium nights with Robyn opening — the biggest pop event of the Amsterdam summer. Covered arena, so the forecast doesn’t matter.',
    why: 'The weekend’s headline event · both nights · weather-proof',
    source: 'Songkick', link: 'https://www.songkick.com/metro-areas/31366-amsterdam',
    weatherFit: ['HOT', 'WARM', 'COOL', 'VOLATILE'],
  },
  {
    id: 'holland-festival',
    title: 'Holland Festival 2026 opens',
    venue: 'Across the city', area: 'Multi-venue', when: '3–28 Jun',
    category: 'stage', freshness: 'new', outdoor: false, kid: false,
    price: 'varies',
    image: 'https://picsum.photos/seed/hollandfestival/900/1200',
    blurb: 'The 79th Holland Festival — international theatre, music and performance across the city for the whole of June. Opening weekend includes Arooj Aftab & Daniel Wohl and Tomoko Mukaiyama’s WE ARE THE HOUSE.',
    why: 'Just opened · the cultural backbone of June · something every night',
    source: 'Holland Festival', link: 'https://hollandfestival.nl/en/',
    weatherFit: ['WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'fka-twigs',
    title: 'FKA twigs',
    venue: 'Venue TBC', area: 'Amsterdam', when: 'Weekend 6–8 Jun',
    category: 'live', freshness: 'weekend', outdoor: false, kid: false,
    price: 'TBC',
    image: 'https://picsum.photos/seed/fkatwigs/900/1200',
    blurb: 'FKA twigs plays Amsterdam this weekend — art-pop spectacle, full choreography. One of the shows of the season.',
    why: 'Marquee weekend gig · check the listing for venue + time',
    source: 'Songkick', link: 'https://www.songkick.com/metro-areas/31366-amsterdam',
    weatherFit: ['WARM', 'COOL', 'COLD_WET', 'VOLATILE'], verify: true,
  },
  {
    id: 'iron-maiden',
    title: 'Iron Maiden — Run for Your Lives',
    venue: 'Venue TBC', area: 'Amsterdam', when: 'Weekend 6–8 Jun',
    category: 'live', freshness: 'weekend', outdoor: false, kid: false,
    price: 'TBC',
    image: 'https://picsum.photos/seed/ironmaiden/900/1200',
    blurb: 'The metal institution’s 50th-anniversary tour lands in Amsterdam this weekend. Pyro, Eddie, the lot.',
    why: 'Big-room weekend show · confirm venue + date before booking',
    source: 'Songkick', link: 'https://www.songkick.com/metro-areas/31366-amsterdam',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], verify: true,
  },

  // ───────── ONGOING — reliable indoor picks (great for COLD/WET) ─────────
  {
    id: 'world-press-photo',
    title: 'World Press Photo 2026',
    venue: 'De Nieuwe Kerk', area: 'Dam', when: 'Daily 10:00–17:00 · until 27 Sep',
    category: 'art', freshness: 'always', outdoor: false, kid: false,
    price: '€16',
    image: 'https://picsum.photos/seed/worldpressphoto/900/1200',
    blurb: 'The year’s defining photojournalism, hung in the soaring Nieuwe Kerk on Dam Square. An hour that stays with you — the reliable wet-afternoon move.',
    why: 'Indoor · world-class · open every day through summer',
    source: 'I amsterdam', link: 'https://www.iamsterdam.com/en/whats-on',
    weatherFit: ['COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'american-identities',
    title: 'American Identities',
    venue: 'H’ART Museum', area: 'Amstel', when: 'Daily 10:00–17:00 · until 6 Sep',
    category: 'art', freshness: 'always', outdoor: false, kid: false,
    price: '€17.50',
    image: 'https://picsum.photos/seed/americanidentities/900/1200',
    blurb: 'A sweeping show on who gets to be “American,” at the riverside H’ART (the former Hermitage). Big, considered, easy to spend two hours in.',
    why: 'Indoor · substantial · pairs with a canal-side lunch',
    source: 'I amsterdam', link: 'https://www.iamsterdam.com/en/whats-on',
    weatherFit: ['COOL', 'COLD_WET', 'VOLATILE'],
  },

  // ───────── ONGOING — outdoor staples (for HOT / WARM days) ─────────
  {
    id: 'sloterplas',
    title: 'Sloterplas city beach',
    venue: 'Sloterpark', area: 'Nieuw-West', when: 'Daily · season open',
    category: 'out', freshness: 'always', outdoor: true, kid: true,
    price: 'free',
    image: 'https://picsum.photos/seed/sloterplas/900/1200',
    blurb: 'The city’s lake-beach — sand, a roped paddling zone for under-5s, ice cream, no drive required. Open for the swimming season.',
    why: 'Hot-day default · free · paddling area for a four-year-old',
    source: 'I amsterdam', link: 'https://www.iamsterdam.com/en/see-and-do',
    weatherFit: ['HOT', 'WARM'],
  },
  {
    id: 'amsterdamse-bos',
    title: 'Amsterdamse Bos + goat farm',
    venue: 'Amsterdamse Bos', area: 'Amstelveen', when: 'Daily',
    category: 'out', freshness: 'always', outdoor: true, kid: true,
    price: 'free',
    image: 'https://picsum.photos/seed/amsterdamsebos/900/1200',
    blurb: 'A forest the size of a small country on the city’s edge — rowing lake, pancake spots, and the Ridammerhoeve goat farm where kids can bottle-feed kids.',
    why: 'Shade when the city bakes · free · endless for small legs',
    source: 'I amsterdam', link: 'https://www.amsterdamsebos.nl/',
    weatherFit: ['HOT', 'WARM', 'COOL'],
  },
]
