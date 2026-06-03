import type { Pick } from '../types'

/**
 * NEW ORLEANS — SEED SET (proof of multi-city). Hand-authored, not yet crawled: a
 * starter pool to prove the engine runs on any city once the pipeline feeds it.
 * Signal + link, never republish — facts + our own blurb, credited + linked.
 *
 * Rain-aware on purpose: a NOLA summer weekend is classic VOLATILE (sun, then a 4pm
 * thunderstorm, then sun), so most picks are indoor / covered and tagged for the wet
 * modes. `verify: true` = a specific lineup/date a real crawl would confirm (these are
 * plausible programmes for the venue, flagged honestly until the adapter lands).
 * Images omitted — the typographic poster fallback renders until og:image adapters run.
 */
export const PICKS_NOLA: Pick[] = [
  // ── Live music — the city's heartbeat, almost all indoor ──
  {
    id: 'nola-preservation-hall', title: 'Preservation Hall', venue: 'Preservation Hall', area: 'French Quarter', when: 'Fri–Sun 5–7 Jun · sets nightly',
    category: 'live', freshness: 'always', outdoor: false, kid: true, price: 'from $25',
    blurb: 'Acoustic traditional jazz in a candle-lit 18th-century room — no bar, no mics, three short sets a night.',
    why: 'The definitive NOLA room · indoor · weather-proof',
    source: 'Preservation Hall', link: 'https://www.preservationhall.com/',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-tipitinas', title: 'Tipitina’s — Uptown show', venue: 'Tipitina’s', area: 'Uptown', when: 'Sat 6 Jun · doors 21:00',
    category: 'live', freshness: 'weekend', outdoor: false, kid: false, price: 'ticketed',
    blurb: 'The fabled Napoleon Ave music hall — funk, brass and bounce under the banana-tree banner.',
    why: 'Institution · indoor · a proper Saturday night',
    source: 'WWOZ Livewire', link: 'https://www.tipitinas.com/', verify: true,
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], status: 'selling-fast',
  },
  {
    id: 'nola-spotted-cat', title: 'The Spotted Cat Music Club', venue: 'The Spotted Cat', area: 'Marigny', when: 'Fri–Sun · sets from 16:00',
    category: 'live', freshness: 'always', outdoor: false, kid: false, price: 'no cover (tip the band)',
    blurb: 'A tiny, sweaty Frenchmen Street jazz club — trad and swing bands back-to-back, cash only.',
    why: 'Frenchmen St · indoor · free-ish all weekend',
    source: 'WWOZ Livewire', link: 'https://www.spottedcatmusicclub.com/',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-dba', title: 'd.b.a. — Frenchmen Street', venue: 'd.b.a.', area: 'Marigny', when: 'Fri 5 Jun · 22:00',
    category: 'live', freshness: 'weekend', outdoor: false, kid: false, price: 'small cover',
    blurb: 'A craft-beer bar with one of the best live rooms in the city — brass, blues and the odd legend dropping in.',
    why: 'Frenchmen St · indoor · great sound',
    source: 'WWOZ Livewire', link: 'https://www.dbaneworleans.com/', verify: true,
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-maple-leaf', title: 'Maple Leaf Bar — Uptown brass', venue: 'Maple Leaf Bar', area: 'Carrollton', when: 'Sat 6 Jun · 22:30',
    category: 'live', freshness: 'weekend', outdoor: false, kid: false, price: 'cover',
    blurb: 'A pressed-tin Oak Street room that’s hosted Uptown funk and brass nights for half a century.',
    why: 'Late · indoor · sweaty in the best way',
    source: 'WWOZ Livewire', link: 'https://www.mapleleafbar.com/', verify: true,
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },

  // ── Art & museums — the city's best rainy-day move ──
  {
    id: 'nola-noma', title: 'New Orleans Museum of Art', venue: 'NOMA', area: 'City Park', when: 'Sat–Sun 6–7 Jun · 10:00–17:00',
    category: 'art', freshness: 'always', outdoor: false, kid: true, price: 'admission',
    blurb: 'A Beaux-Arts museum in City Park with a strong modern collection and the free Besthoff Sculpture Garden next door.',
    why: 'Indoor galleries · weather-proof · great with kids',
    source: 'neworleans.com', link: 'https://noma.org/',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-ogden', title: 'Ogden Museum of Southern Art', venue: 'Ogden Museum', area: 'Warehouse District', when: 'Sat–Sun 6–7 Jun',
    category: 'art', freshness: 'always', outdoor: false, kid: false, price: 'admission',
    blurb: 'The South’s art under one roof — folk, self-taught and contemporary — plus a long-running Thursday music night.',
    why: 'Indoor · compact · ideal in a storm',
    source: 'OffBeat', link: 'https://ogdenmuseum.org/',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-wwii', title: 'The National WWII Museum', venue: 'WWII Museum', area: 'Warehouse District', when: 'Daily · 09:00–17:00',
    category: 'art', freshness: 'always', outdoor: false, kid: true, price: 'admission',
    blurb: 'A vast, immersive campus rated among the best museums in the US — easily a half-day, all indoors.',
    why: 'Indoor · half-a-day · the rainy-day default',
    source: 'neworleans.com', link: 'https://www.nationalww2museum.org/',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },

  // ── Stage & screen ──
  {
    id: 'nola-saenger', title: 'Saenger Theatre — touring show', venue: 'Saenger Theatre', area: 'Canal Street', when: 'Sat 6 Jun · 20:00',
    category: 'stage', freshness: 'weekend', outdoor: false, kid: false, price: 'ticketed',
    blurb: 'A restored 1927 atmospheric movie palace — faux-Italian courtyard, ceiling “stars” — now Broadway tours and concerts.',
    why: 'Indoor · grand · a dressed-up night out',
    source: 'neworleans.com', link: 'https://www.saengernola.com/', verify: true,
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-prytania', title: 'The Prytania Theatres — repertory', venue: 'Prytania', area: 'Uptown', when: 'Daily · check programme',
    category: 'stage', freshness: 'always', outdoor: false, kid: true, price: 'ticketed',
    blurb: 'The oldest single-screen cinema in the South still running classics and new releases Uptown.',
    why: 'Indoor · a film while it pours',
    source: 'OffBeat', link: 'https://www.theprytania.com/',
    weatherFit: ['COOL', 'COLD_WET', 'VOLATILE'],
  },

  // ── Eat & drink — covered, cozy, classic ──
  {
    id: 'nola-cafe-du-monde', title: 'Café du Monde — beignets', venue: 'Café du Monde', area: 'French Quarter', when: 'Daily · 24h',
    category: 'eat', freshness: 'always', outdoor: false, kid: true, price: '$',
    blurb: 'Beignets and chicory café au lait under the covered patio by the river — open around the clock since 1862.',
    why: 'Covered · open 24h · duck in between showers',
    source: 'neworleans.com', link: 'https://shop.cafedumonde.com/pages/our-original-cafe',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-commanders', title: 'Commander’s Palace — jazz brunch', venue: 'Commander’s Palace', area: 'Garden District', when: 'Sat–Sun · brunch from 11:00',
    category: 'eat', freshness: 'always', outdoor: false, kid: false, price: '$$$ · 25¢ martinis',
    blurb: 'The turquoise Garden District landmark — turtle soup, bread-pudding soufflé and a roving jazz trio at weekend brunch.',
    why: 'Indoor · the special-occasion brunch · book ahead',
    source: 'neworleans.com', link: 'https://www.commanderspalace.com/', verify: true,
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-turkey-wolf', title: 'Turkey and the Wolf', venue: 'Turkey and the Wolf', area: 'Irish Channel', when: 'Daily · lunch (closed Tue–Wed)',
    category: 'eat', freshness: 'always', outdoor: false, kid: false, price: '$$',
    blurb: 'The deli that put fried-bologna and collard-melt sandwiches on the national map — playful, indoor, lunch-only.',
    why: 'Indoor · cult sandwiches · a great rainy lunch',
    source: 'OffBeat', link: 'https://www.turkeyandthewolf.com/',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },
  {
    id: 'nola-carousel-bar', title: 'Carousel Bar & Lounge', venue: 'Hotel Monteleone', area: 'French Quarter', when: 'Daily · from 11:00',
    category: 'drink', freshness: 'always', outdoor: false, kid: false, price: '$$',
    blurb: 'A literary landmark bar that slowly rotates — a working carousel — inside the grand Hotel Monteleone.',
    why: 'Indoor · a only-in-NOLA cocktail · dry and surreal',
    source: 'neworleans.com', link: 'https://hotelmonteleone.com/entertainment/carousel-bar/',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'],
  },

  // ── Out & markets — the fair-weather options (correctly NOT tagged for rain) ──
  {
    id: 'nola-crescent-market', title: 'Crescent City Farmers Market', venue: 'Crescent City Market', area: 'CBD', when: 'Sat 6 Jun · 08:00–12:00',
    category: 'market', freshness: 'weekend', outdoor: true, kid: true, price: 'free entry',
    blurb: 'Saturday-morning Gulf shrimp, Creole tomatoes and prepared-food stalls — the city’s flagship farmers market.',
    why: 'Outdoor · Saturday morning · go before the afternoon storms',
    source: 'neworleans.com', link: 'https://www.crescentcityfarmersmarket.org/',
    weatherFit: ['HOT', 'WARM', 'COOL'],
  },
  {
    id: 'nola-steamboat-natchez', title: 'Steamboat Natchez — jazz cruise', venue: 'Steamboat Natchez', area: 'Riverfront', when: 'Sat–Sun · 11:30 & 14:30',
    category: 'daytrip', freshness: 'always', outdoor: true, kid: true, price: 'ticketed',
    blurb: 'A genuine steam paddlewheeler down the Mississippi with a live jazz band and an optional Creole lunch.',
    why: 'On the river · covered decks · best on a clear afternoon',
    source: 'neworleans.com', link: 'https://www.steamboatnatchez.com/', verify: true,
    weatherFit: ['HOT', 'WARM', 'COOL'],
  },
]
