import type { Pick } from '../types'

// EVERGREEN KIDS — Amsterdam family staples (the always-on spine for the Kids filter). These are
// destinations, not dated events, so freshness is 'always' and they're never filtered out by date.
// Images were resolved + eyeballed by hand. A good spread of indoor (rainy-day) and outdoor, plus
// two day-trips. weatherFit puts the indoor ones in EVERY mode so they surface when it's wet.
const ALL_WEATHER: Pick['weatherFit'] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const FAIR: Pick['weatherFit'] = ['HOT', 'WARM', 'COOL']

export const KIDS_AMSTERDAM: Pick[] = [
  {
    id: 'ams-artis-zoo', title: 'ARTIS Royal Zoo', venue: 'ARTIS', area: 'Plantage',
    image: 'https://live.staticflickr.com/65535/51190815707_0c5bcf535a_b.jpg',   // flamingos (artis.nl blocks hotlinking)
    category: 'out', freshness: 'always', outdoor: true, kid: true, price: 'from €25',
    blurb: 'The country’s oldest zoo — big cats, an aquarium and a planetarium across a leafy 19th-century park.',
    why: 'All-day with kids · indoor + outdoor mix', source: 'ARTIS', link: 'https://www.artis.nl/en/',
    weatherFit: FAIR, when: 'Daily · 9:00–18:00',
  },
  {
    id: 'ams-nemo', title: 'NEMO Science Museum', venue: 'NEMO', area: 'Oosterdok',
    image: 'https://cdn.sanity.io/images/49fr30wg/production/8c3e234a4f383d082c43b296435a28da132a52b0-2000x1333.jpg',
    category: 'art', freshness: 'always', outdoor: false, kid: true, price: '€17.50',
    blurb: 'Five floors of hands-on experiments in the big green ship — plus a free rooftop with city views.',
    why: 'Indoor · the rainy-day classic', source: 'NEMO', link: 'https://www.nemosciencemuseum.nl/en/',
    weatherFit: ALL_WEATHER, when: 'Tue–Sun · 10:00–17:30',
  },
  {
    id: 'ams-micropia', title: 'Micropia', venue: 'Micropia', area: 'Plantage',
    image: 'https://media.newyorker.com/photos/5909703aebe912338a376f7e/master/w_2560%2Cc_limit/Yong-Amsterdams-Microbe-Museum.jpg',
    category: 'art', freshness: 'always', outdoor: false, kid: true, price: '€16',
    blurb: 'The world’s only microbe museum — microscopes, a kiss-o-meter and the tiny life all around us.',
    why: 'Indoor · curious kids love it', source: 'Micropia', link: 'https://www.micropia.nl/en/',
    weatherFit: ALL_WEATHER, when: 'Daily · 10:00–17:00',
  },
  {
    id: 'ams-scheepvaartmuseum', title: 'Het Scheepvaartmuseum', venue: 'National Maritime Museum', area: 'Oosterdok',
    image: 'https://media.rememberme.nl/1259155fa3e913814e3_20200612_HSM_033-8974.jpg',
    category: 'art', freshness: 'always', outdoor: false, kid: true, price: '€18',
    blurb: 'Climb aboard a full-size replica of an 18th-century VOC ship, then explore maps, globes and sea tales.',
    why: 'Indoor · the ship is a winner', source: 'Het Scheepvaartmuseum', link: 'https://www.hetscheepvaartmuseum.com/',
    weatherFit: ALL_WEATHER, when: 'Daily · 10:00–17:00',
  },
  {
    id: 'ams-vondelpark-play', title: 'Vondelpark playgrounds', venue: 'Vondelpark', area: 'Zuid',
    image: 'https://www.landezine.com/wp-content/uploads/2010/12/vondelpark-playground-amsterdam-by-carve-landscape-architecture-09.jpg',
    category: 'out', freshness: 'always', outdoor: true, kid: true, price: 'free', status: 'free',
    blurb: 'Amsterdam’s favourite park: open-air playgrounds, the Kinderkookkafé, ducks and room to run.',
    why: 'Free · easy any time with kids', source: 'I amsterdam', link: 'https://www.iamsterdam.com/en/see-and-do/attractions-and-sights/parks/vondelpark',
    weatherFit: FAIR, when: 'Daily · dawn–dusk',
  },
  {
    id: 'ams-ridammerhoeve', title: 'Goat Farm Ridammerhoeve', venue: 'Geitenboerderij Ridammerhoeve', area: 'Amsterdamse Bos',
    image: 'https://www.geitenboerderij.nl/wp-content/uploads/algemeen-54.jpg',
    category: 'out', freshness: 'always', outdoor: true, kid: true, price: 'free entry', status: 'free',
    blurb: 'A working organic goat farm in the forest — bottle-feed the kids (the goat kind), then pancakes on the terrace.',
    why: 'Free · animals + pancakes', source: 'Ridammerhoeve', link: 'https://www.geitenboerderij.nl/',
    weatherFit: FAIR, when: 'Daily exc. Wed · 10:00–17:00',
  },
  {
    id: 'ams-tunfun', title: 'TunFun indoor playground', venue: 'TunFun', area: 'Centrum',
    image: 'https://fastly.4sqi.net/img/general/600x600/28433167_k-v5B3Tz3W76icD-LXkVzoTGHXDnB_JFqUstMIdvOrQ.jpg',
    category: 'out', freshness: 'always', outdoor: false, kid: true, price: '€11.50',
    blurb: 'A giant indoor adventure playground hidden in a former traffic underpass — slides, ball pits, trampolines.',
    why: 'Indoor · saves a wet afternoon', source: 'TunFun', link: 'https://www.tunfun.nl/',
    weatherFit: ALL_WEATHER, when: 'Daily · 10:00–18:00',
  },
  {
    id: 'ams-hortus', title: 'Hortus Botanicus', venue: 'Hortus Botanicus', area: 'Plantage',
    image: 'https://www.dehortus.nl/wp-content/uploads/2025/02/hortus-22-van-75-1920x1440.jpg',
    category: 'out', freshness: 'always', outdoor: true, kid: true, price: '€12',
    blurb: 'One of the world’s oldest botanical gardens — a butterfly greenhouse and three-climate glasshouse to wander.',
    why: 'Greenhouses work rain or shine', source: 'De Hortus', link: 'https://www.dehortus.nl/en/',
    weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET'], when: 'Daily · 10:00–17:00',
  },
  {
    id: 'ams-museumtram', title: 'Heritage Tram rides', venue: 'Electrische Museumtramlijn', area: 'Amsterdamse Bos',
    image: 'https://timelesstravelsteps.com/wp-content/uploads/2021/05/amsterdam-bos-tram-timeless-travel-steps.jpg',
    category: 'out', freshness: 'always', outdoor: true, kid: true, price: '€5',
    blurb: 'Ride a beautifully restored vintage tram from Haarlemmermeerstation out through the Amsterdamse Bos.',
    why: 'A real treat · Sun & holidays', source: 'Museumtramlijn', link: 'https://www.museumtramlijn.org/',
    weatherFit: FAIR, when: 'Sun & holidays · Apr–Oct',
  },
  {
    id: 'ams-madurodam', title: 'Madurodam', venue: 'Madurodam', area: 'The Hague · ~50 min',
    image: 'https://www.madurodam.nl/sites/madurodam_corp/files/2018-07/Madurodam-waterpret-homepage-og.jpg',
    category: 'daytrip', freshness: 'always', outdoor: true, kid: true, price: 'from €21.50',
    blurb: 'The whole of the Netherlands at 1:25 — miniature canals, Schiphol and windmills kids can tower over.',
    why: 'Easy train day-trip · all ages', source: 'Madurodam', link: 'https://www.madurodam.nl/en',
    weatherFit: FAIR, when: 'Daily · ~50 min by train',
  },
  {
    id: 'ams-efteling', title: 'Efteling', venue: 'Efteling', area: 'Kaatsheuvel · ~1h15',
    image: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Efteling_The_House_of_the_Five_Senses.jpg',
    category: 'daytrip', freshness: 'always', outdoor: true, kid: true, price: 'from €44',
    blurb: 'Europe’s oldest fairytale theme park — enchanted forest, dark rides and proper coasters in a storybook world.',
    why: 'The dream kid day-trip', source: 'Efteling', link: 'https://www.efteling.com/en',
    weatherFit: FAIR, when: 'Daily · ~1h15 by car',
  },
]
