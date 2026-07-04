import type { Pick, Category, Mode } from '../types'

// EVERGREEN fill-in (V.6.4) — markets, day-trips and music venues for the always-good floor. Targets the
// genuinely thin always-pool shelves the served feed exposed: MARKET (0 always-tagged — the two existing
// market rows are dated 'weekend'), plus DAYTRIP and live VENUES (2). Recurring markets ARE evergreen, so
// they're freshness:'always' with a recurring `when`. Every image is a real photo, subject-verified by eye,
// and served through the wsrv.nl portrait proxy (w=800 h=1200, libvips saliency crop) so any source —
// Commons or web — renders as a clean tall card and resolves server-side (no hotlink/throttle blanks).
// Outdoor markets + day-trips are fair-weather (weatherFit drops the wet modes, so a street market never
// surfaces in pouring rain); indoor halls and venues are all-weather. tier: classic = the icon, bespoke =
// the local / under-the-radar pick. Maps link per row (day-trips link the place itself, not "… Amsterdam").
const ALL: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const FAIR: Mode[] = ['HOT', 'WARM', 'COOL']
const portrait = (url: string) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=800&h=1200&fit=cover&a=attention&output=jpg&default=${encodeURIComponent(url)}`
const mapsOf = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

type Row = {
  slug: string; title: string; area: string; category: Category; tier: 'classic' | 'bespoke'
  price: string; when: string; outdoor: boolean; img: string; blurb: string; why: string; place?: string
}

const ROWS: Row[] = [
  // ——— MARKETS (the empty always-shelf: 0 → 8) ———
  { slug: 'albert-cuyp', title: 'Albert Cuypmarkt', area: 'Zuid (De Pijp)', category: 'market', tier: 'classic', price: 'free', when: 'Mon–Sat · 09:00–17:00', outdoor: true,
    img: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Albert_Cuypmarkt.jpg',
    blurb: 'The Netherlands’ biggest street market — 250-odd stalls of stroopwafels, cheese, fabric and flowers the length of De Pijp.', why: '250 stalls · the big one' },
  { slug: 'ten-kate', title: 'Ten Katemarkt', area: 'West (Oud-West)', category: 'market', tier: 'bespoke', price: 'free', when: 'Mon–Sat · 09:00–17:00', outdoor: true,
    img: 'https://inews.co.uk/wp-content/uploads/2025/03/SEI_243355530.jpg',
    blurb: 'A proper everyday neighbourhood market off the tourist track — heaped produce, street food and Oud-West locals doing the shop.', why: 'Local market · no crowds' },
  { slug: 'waterlooplein', title: 'Waterlooplein Flea Market', area: 'Centrum', category: 'market', tier: 'classic', price: 'free', when: 'Mon–Sat · 09:30–18:00', outdoor: true,
    img: 'https://i.pinimg.com/originals/fb/02/f1/fb02f143ed724aee69433617c2249bae.jpg',
    blurb: 'The city’s oldest flea market — secondhand everything, vintage denim, records and bric-a-brac spread out beside the Stopera.', why: 'Flea market · since 1885' },
  { slug: 'ij-hallen', title: 'IJ-Hallen', area: 'Noord (NDSM)', category: 'market', tier: 'bespoke', price: 'from €6', when: 'Monthly · one weekend', outdoor: false,
    img: 'https://www.happyrichmillennial.com/wp-content/uploads/2020/05/ijhallen-.jpg?w=660',
    blurb: 'Europe’s biggest flea market — 750 stalls across two NDSM shipyard warehouses, a proper treasure-hunt of vintage and junk.', why: 'Europe’s biggest flea · NDSM' },
  { slug: 'dappermarkt', title: 'Dappermarkt', area: 'Oost', category: 'market', tier: 'bespoke', price: 'free', when: 'Mon–Sat · 09:00–17:00', outdoor: true,
    img: 'https://www.volkshotel.nl/content/uploads/2016/02/Amsterdam-Dappermarkt-5-862x575.jpg',
    blurb: 'A buzzing, multicultural Oost street market — spices, textiles and world food at honest neighbourhood prices.', why: 'Multicultural Oost market' },
  // Lindengrachtmarkt REMOVED (R2, 2026-07-03): Ness killed it on the board — also in the corpus veto.
  { slug: 'pure-markt', title: 'Pure Markt', area: 'Oost (Park Frankendael)', category: 'market', tier: 'bespoke', price: 'free', when: 'Select Sundays · 11:00–18:00', outdoor: true,
    // R3 issue #3: Ness flagged the old image bad, gave this replacement (the market's Feed Factory photo)
    img: 'https://app.thefeedfactory.nl/api/assets/600a80ecf21e8920ab28277e/0112feda-7dc2-4d02-93aa-fe4f4f4f4c22.webp',
    blurb: 'An artisan food-and-craft market in a green park — small makers, slow food and a relaxed Sunday-stroll crowd in Frankendael.', why: 'Artisan market · in a park' },
  { slug: 'bloemenmarkt', title: 'Bloemenmarkt', area: 'Centrum (Singel)', category: 'market', tier: 'classic', price: 'free', when: 'Mon–Sat · 09:00–17:30', outdoor: true,
    img: 'https://aboutnl.com/wp-content/uploads/2023/10/floating-market-amsterdam.jpg',
    blurb: 'The world’s only floating flower market — barges of tulips, bulbs and seeds moored along the Singel since 1862.', why: 'Floating flower market · since 1862' },

  // ——— DAY-TRIPS (4 → 9) ———
  { slug: 'utrecht', title: 'Utrecht', area: 'Day-trip · ~25 min by train', category: 'daytrip', tier: 'classic', price: 'train fare', when: 'Daily · ~25 min by train', outdoor: false, place: 'Utrecht Netherlands',
    img: 'https://i.guim.co.uk/img/media/30f7ae0e50398b97474581a1ed4b1056b6bfa268/0_0_5690_3414/master/5690.jpg?width=1200&height=1200&quality=85&auto=format&fit=crop&s=081ae42ca96e2c5818c4868ae025955a',
    blurb: 'Amsterdam’s quieter little sister — wharf-side canals, the soaring Dom Tower and a real café culture, minus the crowds.', why: 'Canal city · 25 min by train' },
  { slug: 'marken-volendam', title: 'Marken & Volendam', area: 'Day-trip · ~30 min by bus', category: 'daytrip', tier: 'bespoke', price: 'bus fare', when: 'Daily · bus ~30 min', outdoor: true, place: 'Volendam Netherlands',
    img: 'https://media.tacdn.com/media/attractions-splice-spp-674x446/06/73/de/1a.jpg',
    blurb: 'Two former Zuiderzee fishing villages — wooden houses, working harbours and smoked eel, an easy half-day from Centraal.', why: 'Fishing villages · old Zuiderzee' },
  { slug: 'zandvoort', title: 'Zandvoort Beach', area: 'Day-trip · ~30 min by train', category: 'daytrip', tier: 'bespoke', price: 'train fare', when: 'Daily · ~30 min by train', outdoor: true, place: 'Zandvoort aan Zee beach',
    img: 'https://images.trvl-media.com/place/6110890/9e2b09e5-f29a-4379-aead-f4b2601547ee.jpg',
    blurb: 'The nearest North Sea beach — wide sands, beach clubs and a direct train from Centraal; in summer half the city decamps here.', why: 'Beach · 30 min by train' },
  { slug: 'muiderslot', title: 'Muiderslot', area: 'Day-trip · ~30 min out', category: 'daytrip', tier: 'bespoke', price: 'ticketed', when: 'Tue–Sun · ~30 min out', outdoor: false, place: 'Muiderslot',
    img: 'https://tassiedevilabroad.com/wp-content/uploads/2018/07/Muiderslot-2-1080x794.jpg',
    blurb: 'A moated medieval castle on the IJmeer — turrets, falconry and a walled garden, the best-preserved fortress in the country.', why: 'Moated medieval castle' },
  { slug: 'kinderdijk', title: 'Kinderdijk Windmills', area: 'Day-trip · ~1h out', category: 'daytrip', tier: 'bespoke', price: 'ticketed', when: 'Daily · ~1h out', outdoor: true, place: 'Kinderdijk windmills',
    img: 'https://cdn.audleytravel.com/5346/3820/79/15989287-windmills-and-tulips-of-kinderdijk.jpg',
    blurb: 'Nineteen 18th-century windmills lined along the polders — the postcard Dutch landscape, a UNESCO site you can walk or cycle.', why: '19 windmills · UNESCO' },

  // ——— MUSIC VENUES (live, 2 → 5) — FLAGGED: "always-good places" vs strictly-dated is Ness's call ———
  { slug: 'paradiso', title: 'Paradiso', area: 'Centrum (Leidsebuurt)', category: 'live', tier: 'classic', price: 'ticketed', when: 'Eve · gig nights', outdoor: false,
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Amsterdam_Paradiso.jpg/1280px-Amsterdam_Paradiso.jpg',
    blurb: 'Amsterdam’s legendary music hall in a converted church — stained glass overhead, a heaving floor below, indie to techno.', why: 'Gigs in a church · legendary' },
  { slug: 'melkweg', title: 'Melkweg', area: 'Centrum (Leidseplein)', category: 'live', tier: 'classic', price: 'ticketed', when: 'Eve · gigs + club', outdoor: false,
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Melkweg_en_Rabozaal.jpg/1280px-Melkweg_en_Rabozaal.jpg',
    blurb: 'A former dairy turned multi-room culture machine — live music, club nights, film and a gallery, all under one roof.', why: 'Live + club · ex-dairy' },
  { slug: 'concertgebouw', title: 'Royal Concertgebouw', area: 'Zuid (Museumkwartier)', category: 'live', tier: 'classic', price: 'ticketed', when: 'Eve · concerts · free Wed lunch', outdoor: false,
    img: 'https://res.klook.com/images/fl_lossy.progressive,q_65/c_fill,w_1295,h_863,f_auto/w_80,x_15,y_15,g_south_west,l_klook_water/activities/vzsaj69cjxg6biod1jwm/AmsterdamTheRoyalConcertgebouwGuidedTour.jpg',
    blurb: 'One of the world’s great concert halls — peerless acoustics, a resident world-class orchestra, and free Wednesday lunch concerts.', why: 'World-class acoustics · free Wed' },
]

export const EVERGREEN_AMSTERDAM: Pick[] = ROWS.map((r) => ({
  id: `ams-ev-${r.slug}`,
  title: r.title,
  venue: r.title,
  area: r.area,
  image: portrait(r.img),
  category: r.category,
  freshness: 'always',
  outdoor: r.outdoor,
  kid: false,
  price: r.price,
  blurb: r.blurb,
  why: r.why,
  source: 'Maps',
  link: mapsOf(r.place ?? `${r.title} Amsterdam`),
  weatherFit: r.outdoor ? FAIR : ALL,
  when: r.when,
  tier: r.tier,
}))
