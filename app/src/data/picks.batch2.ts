import type { Pick, Category } from '../types'

// EVERGREEN — "batch 2": a hand-curated city-guide set spanning the new Shops section (design stores,
// bookshops, concept + streetwear), a few museums & galleries, two more eat/drink finds and an arcade
// bar. Every image was eyeballed AND load-tested in-browser (0 hotlink failures). Indoor/year-round →
// all-weather; Maps link for each.
const ALL: Pick['weatherFit'] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const maps = (name: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} Amsterdam`)}`

type Row = {
  slug: string; title: string; area: string; category: Category; tier: 'classic' | 'bespoke'
  price: string; when: string; blurb: string; why: string; image: string
}

const ROWS: Row[] = [
  // ——— SHOPS ———
  { slug: 'vlieger', title: 'Vlieger', area: 'Centrum (Amstel)', category: 'shop', tier: 'bespoke', price: 'browse', when: 'Daily · shop hours',
    blurb: 'A two-floor temple to paper since 1869 — hundreds of colours, handmade sheets and card stacked to the ceiling.',
    why: 'Paper heaven · since 1869', image: 'https://4.bp.blogspot.com/--AHdyrnMcgs/U53ht8RshxI/AAAAAAAAELk/taKnvOilL2Q/s1600/IMG_5588.jpg' },
  { slug: 'athenaeum', title: 'Athenaeum Boekhandel', area: 'Centrum (Spui)', category: 'shop', tier: 'classic', price: 'browse', when: 'Daily · shop hours',
    blurb: 'The intellectual heart of the Spui — a beloved bookshop and an international newsstand packed floor-to-ceiling.',
    why: 'Books + global press · the Spui', image: 'https://whatshotblog.com/wp-content/uploads/2020/03/Athenaeum-Bookshop-Amsterdam.jpg.webp' },
  { slug: 'american-book-center', title: 'The American Book Center', area: 'Centrum (Spui)', category: 'shop', tier: 'classic', price: 'browse', when: 'Daily · shop hours',
    blurb: 'A sprawling three-floor English-language bookshop — a spiral of shelves and a basement of zines and comics.',
    why: 'English books · floors of them', image: 'https://image.parool.nl/265443998/width/2480/the-american-book-center-spui' },
  { slug: 'patta', title: 'Patta', area: 'Centrum', category: 'shop', tier: 'bespoke', price: 'browse', when: 'Daily · shop hours',
    blurb: 'The homegrown streetwear label and culture hub — drops, sneakers and the community that put Amsterdam on the map.',
    why: 'Homegrown streetwear icon', image: 'https://dk.patta.nl/cdn/shop/files/PATTA-AMS-STORE_10.jpg?v=1739810240&width=1280' },
  { slug: 'moise', title: 'Moise', area: 'Zuid (De Pijp)', category: 'shop', tier: 'bespoke', price: 'browse', when: 'Daily exc. Sun–Mon',
    blurb: 'An understated De Pijp boutique with a razor-sharp eye — Acne, Lemaire, Marant and the like, hand-picked and beautifully shown.',
    why: 'Hand-picked designer edit', image: 'https://media.licdn.com/dms/image/v2/C561BAQHDkbg5laBwow/company-background_10000/company-background_10000/0/1585425295198/moise_store_cover?e=2147483647&v=beta&t=balgwACnbBvaLmlVam_9VLjXuYzd4uaGpKFcG_d7uYg' },
  { slug: 'cowboys-to-catwalk', title: 'Cowboys to Catwalk', area: 'Zuid (De Pijp)', category: 'shop', tier: 'bespoke', price: 'browse', when: 'Daily · shop hours',
    blurb: 'A treasure-trove of vintage designer — Margiela, Marc Jacobs and one-off finds rummaged from decades of fashion.',
    why: 'Vintage designer rummage', image: 'https://s3-media0.fl.yelpcdn.com/bphoto/30FegcI5yRNkqtnCFQDdoA/o.jpg' },
  { slug: 'mobilia', title: 'Mobilia', area: 'Centrum (Utrechtsestraat)', category: 'shop', tier: 'classic', price: 'browse', when: 'Daily · shop hours',
    blurb: 'Three floors of high design on the Utrechtsestraat — icons by the masters alongside more attainable covetables.',
    why: 'Design icons · three floors', image: 'https://i.pinimg.com/originals/66/83/a0/6683a0d19052a8cb98cdc5322ae54438.jpg' },
  { slug: 'x-bank', title: 'X Bank', area: 'Centrum', category: 'shop', tier: 'bespoke', price: 'browse', when: 'Daily · shop hours',
    blurb: 'A concept store in a former bank showing 180+ Dutch fashion, design and art labels — couture to hand-thrown ceramics.',
    why: 'Best of Dutch design · one room', image: 'https://i.pinimg.com/originals/dc/ae/d3/dcaed3ee8c10492ce947c821c8de87e1.jpg' },
  { slug: 'friday-next', title: 'Friday Next', area: 'West', category: 'shop', tier: 'bespoke', price: 'browse', when: 'Daily · café + shop',
    blurb: 'A concept store and café in one — young Dutch design to browse, with brunch and coffee while you do it.',
    why: 'Design shop + café', image: 'https://i0.wp.com/www.letstalkbeauty.co.uk/wp-content/uploads/2015/08/Amsterdam-Friday-Next-Cafe-1024x951.jpg' },
  { slug: 'wonderwood', title: 'WonderWood', area: 'Centrum', category: 'shop', tier: 'bespoke', price: 'browse', when: 'Wed–Sat · shop hours',
    blurb: 'A gallery-shop devoted to plywood and mid-century modern — bentwood chairs and design classics since 1999.',
    why: 'Plywood + mid-century · since ’99', image: 'https://www.wonderwood.nl/wp-content/uploads/2016/11/WonderWood-store-amsterdam-gallery-9-960x720.jpg' },

  // ——— EAT & DRINK ———
  { slug: 'rijks', title: 'RIJKS®', area: 'Zuid (Museumkwartier)', category: 'eat', tier: 'classic', price: '€€€', when: 'Lunch & dinner · book ahead',
    blurb: 'Joris Bijdendijk’s Michelin-starred dining room beside the Rijksmuseum — the “cuisine of the Low Countries”, done with flair.',
    why: 'Michelin star · by the Rijks', image: 'https://www.amsterdamnow.com/app/uploads/rijks-restaurant-amsterdam_1.jpg' },
  { slug: 'abraham-kef', title: 'Fromagerie Abraham Kef', area: 'West', category: 'eat', tier: 'bespoke', price: '€€', when: 'Daily · shop + tasting',
    blurb: 'A legendary French cheese shop — sit at the back for a board of raw-milk cheeses and a glass of wine.',
    why: 'French cheese · tasting room', image: 'https://s3-media0.fl.yelpcdn.com/bphoto/GXKq3jKKcBuL78pRfnn3kA/o.jpg' },
  { slug: 'cafe-jakarta', title: 'Café Jakarta', area: 'Oost (Java-eiland)', category: 'eat', tier: 'bespoke', price: '€€€', when: 'Lunch & dinner',
    blurb: 'Indonesian rijsttafel under a soaring, palm-filled atrium at Hotel Jakarta — a jungle dining room out on the IJ.',
    why: 'Rijsttafel · jungle atrium', image: 'https://boutiquehotels.org/wp-content/uploads/HotelJakartaAmsterdamLR-106.jpg' },

  // ——— MUSEUMS & GALLERIES ———
  { slug: 'rijksmuseum', title: 'Rijksmuseum', area: 'Zuid (Museumkwartier)', category: 'art', tier: 'classic', price: 'ticketed', when: 'Daily · 09:00–17:00',
    blurb: 'The Netherlands’ treasure house — Rembrandt’s Night Watch, Vermeer and the Golden Age masters in a cathedral of a building.',
    why: 'The Night Watch · the big one', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/South_facade_of_the_Rijksmuseum_Amsterdam_%28DSCF0528%29.jpg/1280px-South_facade_of_the_Rijksmuseum_Amsterdam_%28DSCF0528%29.jpg' },
  { slug: 'stedelijk', title: 'Stedelijk Museum', area: 'Zuid (Museumkwartier)', category: 'art', tier: 'classic', price: 'ticketed', when: 'Daily · 10:00–18:00',
    blurb: 'Modern and contemporary art behind the “bathtub” facade — Malevich, De Kooning, Appel and bold rotating shows.',
    why: 'Modern + contemporary · the bathtub', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/De_nieuwe_vleugel_van_het_Stedelijk_Museum_Amsterdam.jpg/1280px-De_nieuwe_vleugel_van_het_Stedelijk_Museum_Amsterdam.jpg' },
  { slug: 'foam', title: 'Foam', area: 'Centrum (Keizersgracht)', category: 'art', tier: 'bespoke', price: 'ticketed', when: 'Daily · 10:00–18:00',
    blurb: 'A nimble photography museum in a canal house — big-name retrospectives and emerging talent, always worth the drop-in.',
    why: 'Photography · canal-house museum', image: 'https://aws-tiqets-cdn.imgix.net/images/content/e2b3e203f7524292acea46b5394820b0.jpeg?auto=format&fit=crop&h=800&w=800&q=70' },
  { slug: 'huis-marseille', title: 'Huis Marseille', area: 'Centrum (Keizersgracht)', category: 'art', tier: 'bespoke', price: 'ticketed', when: 'Tue–Sun · 11:00–18:00',
    blurb: 'The city’s first photography museum, across two canal houses with a hidden garden — beautifully curated, never crowded.',
    why: 'Photography · with a secret garden', image: 'https://app.thefeedfactory.nl/api/assets/6756d5230288895796c46430/zomer-in-huis-marseille-amsterdam_copy_2.webp' },
  { slug: 'upstream-gallery', title: 'Upstream Gallery', area: 'Centrum', category: 'art', tier: 'bespoke', price: 'free', when: 'Tue–Sat · gallery hours',
    blurb: 'A contemporary gallery with a digital streak — internet-age artists like Rafaël Rozendaal and Jonas Lund.',
    why: 'Contemporary · digital-native art', image: 'https://res.cloudinary.com/dsvessvkt/image/upload/v1734427020/kuqu5giplep5vw61k13z.png' },

  // ——— PLAY ———
  { slug: 'tonton', title: 'TonTon Club', area: 'Centrum', category: 'out', tier: 'bespoke', price: '€', when: 'Eve · late',
    blurb: 'An arcade bar where you pay to play — pinball, classic cabinets and Japanese games, with beer and gyoza on tap.',
    why: 'Arcade bar · pinball + gyoza', image: 'https://app.thefeedfactory.nl/api/assets/5ff8abbade7e8633a4aba02a/d0a01e0e-b8b0-4ad6-ae51-efeb22a23c85.jpg' },
]

export const BATCH2_AMSTERDAM: Pick[] = ROWS.map((r) => ({
  id: `ams-b2-${r.slug}`,
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
