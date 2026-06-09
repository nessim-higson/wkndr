import type { Pick, Category } from '../types'

// EVERGREEN — curated finds from the LOST iN Amsterdam city guide. Mostly the "bespoke" flavour
// (the cooler/quirkier end), spanning cafés, cinemas, a design shop, patisseries, nightlife and a
// design hotel. Each is always-on with a hand-verified image (every one eyeballed + confirmed it
// hotlinks in-browser) and a Maps link. Indoor/year-round → all-weather.
const ALL: Pick['weatherFit'] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const maps = (name: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Amsterdam`)}`

type Row = {
  slug: string; title: string; area: string; category: Category; tier: 'classic' | 'bespoke'
  price: string; when: string; blurb: string; why: string; image: string
}

const ROWS: Row[] = [
  { slug: 'petit-gateau', title: 'Petit Gâteau', area: 'West (Foodhallen)', category: 'eat', tier: 'bespoke', price: '€', when: 'Daily · pastries',
    blurb: 'Jewel-like little tarts — pistachio, lemon, chocolate — from the patisserie counter at the Foodhallen.',
    why: 'Tiny tarts · grab-and-go', image: 'https://www.epicureasia.com/wp-content/uploads/2023/09/Simple-Patisserie-petite-tarts.jpg' },
  { slug: 'frozen-fountain', title: 'The Frozen Fountain', area: 'Centrum', category: 'market', tier: 'classic', price: 'browse', when: 'Daily · shop hours',
    blurb: 'The country’s best-known design store — floors of furniture, lighting and covetable objects to browse.',
    why: 'Design icons · browse for hours', image: 'https://thatdamguide.com/wp-content/uploads/2024/10/Frozen-Fountain-2-1024x768.jpg' },
  { slug: 'homeland', title: 'Brewery Homeland', area: 'Centrum (IJ)', category: 'drink', tier: 'bespoke', price: '€€', when: 'Daily · sunny best',
    blurb: 'A craft brewery and beach bar on the IJ — tank-fresh beer and a waterfront sun-trap terrace.',
    why: 'Tank-fresh beer · waterfront', image: 'https://www.holland-hoch2.de/wp-content/uploads/2017/09/Amsterdam-Bier-August-2017-10.jpg' },
  { slug: 'libertine', title: 'Libertine Petit Café', area: 'Jordaan', category: 'eat', tier: 'bespoke', price: '€€', when: 'All day · exc. Tue',
    blurb: 'A funky canal-side bar-bistro at the Noordermarkt — French classics, oysters and a stellar brunch.',
    why: 'All-day · brunch + wine', image: 'https://assets.website-files.com/60cb306927766412f1496dc3/618b8e526ad84ddb0b1e90df_Rectangle%2012.webp' },
  { slug: 'noorderlicht', title: 'Noorderlicht', area: 'Noord (NDSM)', category: 'drink', tier: 'bespoke', price: '€€', when: 'Daily from 11:00',
    blurb: 'A greenhouse café on the NDSM wharf — string lights, salvaged charm and a big waterside terrace.',
    why: 'Greenhouse café · NDSM terrace', image: 'https://www.amsterdam.style/wp-content/uploads/2016/12/amsterdam-1-29.jpg' },
  { slug: 'cafe-de-tuin', title: 'Café de Tuin', area: 'Jordaan', category: 'drink', tier: 'classic', price: '€€', when: 'All day',
    blurb: 'A quintessential Jordaan brown café — newspapers, good beer and an easy neighbourhood buzz.',
    why: 'Classic brown café', image: 'https://backstreettravel.com/wp-content/uploads/2025/02/Sunny-Cafe-de-Tuin-Jordaan-1024x1024.webp' },
  { slug: 'the-duchess', title: 'The Duchess', area: 'Centrum', category: 'eat', tier: 'classic', price: '€€€', when: 'All day · book ahead',
    blurb: 'An opulent belle-époque brasserie in a former bank — marble, brass and a long oyster-and-champagne bar.',
    why: 'Show-stopping room · book ahead', image: 'https://cache.marriott.com/content/dam/marriott-renditions/AMSWH/amswh-the-duchess-7579-hor-clsc.jpg' },
  { slug: 'mata-hari', title: 'Mata Hari', area: 'Centrum (Wallen)', category: 'drink', tier: 'bespoke', price: '€€', when: 'Dinner & drinks',
    blurb: 'A warm canal-side bar-restaurant on the Wallen — candlelit, characterful and a local antidote to the crowds.',
    why: 'Canal-side · candlelit', image: 'https://redlightinfo.nl/wp-content/uploads/2024/06/MAtihari.jpeg' },
  { slug: 'de-ceuvel', title: 'De Ceuvel', area: 'Noord', category: 'drink', tier: 'bespoke', price: '€€', when: 'Daily · sunny best',
    blurb: 'A café on a reclaimed shipyard — a circular-economy experiment with a ramshackle, plant-filled terrace.',
    why: 'Sustainable · creative Noord', image: 'https://i.pinimg.com/originals/b4/08/ac/b408ac9c5dc7534a2bf4483b9b21352c.jpg' },
  { slug: 'skatecafe', title: 'Skatecafé', area: 'Noord', category: 'drink', tier: 'bespoke', price: '€€', when: 'Eve · check listings',
    blurb: 'A working skate ramp inside a former garage, with a kitchen, bar and DJs — as fun as it sounds.',
    why: 'A skate ramp in a restaurant', image: 'https://www.skateism.com/wp-content/uploads/2017/01/812A4813.jpg' },
  { slug: 'holtkamp', title: 'Patisserie Holtkamp', area: 'Centrum', category: 'eat', tier: 'classic', price: '€', when: 'Daily · pastries',
    blurb: 'A century-old patisserie behind a gorgeous Amsterdam School facade — famous for its kroketten and gateaux.',
    why: 'Heritage patisserie · the kroketten', image: 'https://www.ditisanne.nl/wp-content/uploads/2018/10/Holtkamp-Amsterdam-2.jpg' },
  { slug: 'the-movies', title: 'The Movies', area: 'West', category: 'stage', tier: 'classic', price: 'ticketed', when: 'Eve · check listings',
    blurb: 'Amsterdam’s oldest cinema — a jewel-box Art Deco screen with a candlelit dinner-and-a-film tradition.',
    why: 'Oldest cinema · dinner + film', image: 'https://www.leuketip.nl/images/db/5a327f6dce3e8e690375b1db/original.jpg' },
  { slug: 'de-filmhallen', title: 'De Filmhallen', area: 'West', category: 'stage', tier: 'bespoke', price: 'ticketed', when: 'Daily · check listings',
    blurb: 'A nine-screen arthouse cinema in a converted tram depot — with a bustling food hall right next door.',
    why: 'Arthouse · in the old tram depot', image: 'https://app.thefeedfactory.nl/api/assets/5ff89832de7e8633a4ab3ae8/7de55fa9-f2b2-4663-978c-964fe563eb18.jpg' },
  { slug: 'kriterion', title: 'Kriterion', area: 'Centrum', category: 'stage', tier: 'bespoke', price: 'ticketed', when: 'Daily · check listings',
    blurb: 'A legendary student-run cinema and café since 1945 — arthouse programming with a buzzy terrace.',
    why: 'Student-run · arthouse + café', image: 'https://almostginger.com/wp-content/uploads/2018/10/Filmtheater-Kriterion-Courtesy-of-Amsterdamming-9393843589_cedc6162e2_b-1024x678.jpg' },
  { slug: 'sexyland', title: 'Sexyland World', area: 'Noord', category: 'live', tier: 'bespoke', price: 'ticketed', when: 'Eve · check programme',
    blurb: 'A members’ club owned by 1,000 people — a different host and a different vibe every single night.',
    why: '1,000 owners · nightly surprise', image: 'https://imgproxy.ra.co/_/quality:66/aHR0cHM6Ly9zdGF0aWMucmEuY28vaW1hZ2VzL2NsdWJzL2xnLzM1MC0tc2V4eWxhbmQuanBlZz9kYXRlVXBkYXRlZD0xNjY2MDA4NTI4NTMz' },
  { slug: 'garage-noord', title: 'Garage Noord', area: 'Noord', category: 'live', tier: 'bespoke', price: 'ticketed', when: 'Eve · check programme',
    blurb: 'A club, kitchen and cultural space in a former garage — daytime plates, late-night dancing.',
    why: 'Kitchen by day · club by night', image: 'https://wearebunk.com/wp-content/uploads/2022/10/garage-noord-amsterdam-city-guide.jpeg' },
  { slug: 'conservatorium', title: 'Conservatorium Hotel', area: 'Zuid', category: 'drink', tier: 'classic', price: '€€€', when: 'Daily · lounge & bar',
    blurb: 'The glass-roofed lounge of the city’s grandest design hotel — a stunning spot for a drink or high tea.',
    why: 'Design-hotel lounge · a treat', image: 'https://806d2bf04cf5fa54997a-e7c5344b3b84eec5da7b51276407b19c.ssl.cf1.rackcdn.com/u/conservatorium/TodaysBrew-conservatorium_lounge0139-Advanced-v3.jpg' },
]

export const LOSTIN_AMSTERDAM: Pick[] = ROWS.map((r) => ({
  id: `ams-lostin-${r.slug}`,
  title: r.title,
  venue: r.title,
  area: r.area,
  image: r.image,
  category: r.category,
  freshness: 'always',
  outdoor: false,
  kid: false,
  price: r.price,
  blurb: r.blurb,
  why: r.why,
  source: 'Maps',
  link: maps(r.title),
  weatherFit: ALL,
  when: r.when,
  tier: r.tier,
}))
