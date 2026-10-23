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
  price: string; outdoor: boolean; kid?: boolean; blurb: string; why: string; source: string; link: string; image: string
}

const HEROES: Record<string, Hero[]> = {
  amsterdam: [
    // THE ADE WEEKEND, 23–25 Oct 2026. Ness: "it was heavy ADE. Which makes sense. Can we sprinkle in
    // some other relevant events." The deck's umbrella gap (weather/modes.ts) spaces the ADE cards;
    // these four are the OTHER weekend, each read off the organiser's own page on 2026-10-23, each
    // wearing the organiser's own photograph. All are one-weekend cards and fall off on their own.
    // (Also found and left out: ARTIS's Nacht van de Nacht night, sold out; NEMO's Game On closing
    // weekend, which Ness vetoed on the board ("game on" in corpus.eventVeto, so the restamp refused
    // it); Koos Kneus, closed that Sunday; the Marathon, the weekend before.) Bruno Mars (4–5 Jul)
    // retired from this list the same day.
    {
      slug: 'beethoven-fifth-concertgebouw', title: "Beethoven's Fifth with the Concertgebouw Orchestra",
      venue: 'Het Concertgebouw', area: 'Museumplein, Zuid', when: 'Fri 23 Oct · 21:00 / Sun 25 Oct · 14:15',
      category: 'live', price: 'from €20', outdoor: false,
      blurb: 'The orchestra plays the Fifth twice: a 75-minute Essentials night under Riccardo Minasi on Friday, and Sunday afternoon with Mao Fujita in Mozart’s 25th piano concerto. Sunday is on its last tickets.',
      why: 'The other Amsterdam sound this weekend', source: 'Het Concertgebouw',
      link: 'https://www.concertgebouw.nl/en/concerts/45875725-beethovens-fifth-with-the-concertgebouw-orchestra',
      image: 'https://d35w1qwxagl33g.cloudfront.net/production/_2238x1076_crop_center-center_none/Mao-Fujita-c-Dovile-Sermokas.jpg?stamp=2403171926&tag=2xl',
    },
    {
      slug: 'nutcracker-brass-concertgebouw', title: "Tchaikovsky's Nutcracker: Concertgebouw Orchestra Brass",
      venue: 'Het Concertgebouw', area: 'Museumplein, Zuid', when: 'Sun 25 Oct · 11:00',
      category: 'live', price: 'from €21 · last tickets', outdoor: false, kid: true,
      blurb: 'The orchestra’s brass section plays the Nutcracker Suite in a one-hour Sunday-morning concert in the Main Hall, with Lotti’s Crucifixus to open. Done by noon.',
      why: 'A Sunday morning indoors, done by noon', source: 'Het Concertgebouw',
      link: 'https://www.concertgebouw.nl/en/concerts/37473491-concertgebouw-orchestra-brass-section-tchaikovskys-nutcracker',
      image: 'https://d35w1qwxagl33g.cloudfront.net/production/_2238x1076_crop_center-center_none/RCO-Koperenensamble-c-Eduardus-lee.png?stamp=2603111126&tag=2xl',
    },
    {
      slug: 'copenhagen-trilogy-ita', title: 'The Copenhagen Trilogy: ITA / Eline Arbo',
      venue: 'Internationaal Theater Amsterdam', area: 'Leidseplein, Centrum', when: 'Sun 25 Oct · 15:00',
      category: 'stage', price: '€14.50–49 · last tickets', outdoor: false,
      blurb: 'Eline Arbo folds Tove Ditlevsen’s three memoirs (Childhood, Youth, Dependency) into one three-and-a-half-hour afternoon in the Grote Zaal: poverty, fame, addiction. In Dutch; the surtitled shows come later in the run.',
      why: 'Arbo’s big one, a Sunday matinee', source: 'ITA',
      link: 'https://ita.nl/en/shows/the-copenhagen-trilogy',
      image: 'https://media.ita.nl/media/kopenhagen0722-bewerkt-3.jpg?guid=67a06b58-8405-4769-bed2-751e51be4f2a&width=1600&height=1600',
    },
    {
      slug: 'fright-nights-walibi', title: 'Halloween Fright Nights at Walibi Holland',
      venue: 'Walibi Holland', area: 'Biddinghuizen · ~1h by car', when: 'Sat–Sun 24–25 Oct · 10:00–23:00',
      category: 'daytrip', price: 'park ticket + packages from €9.50', outdoor: true,
      blurb: 'The park runs till 23:00 with the haunted houses open from 13:00 and the scare zones after dark; the last weekend before Halloween itself. Not one for small kids, and bring a raincoat.',
      why: 'The Halloween weekend, if you can take the rain', source: 'Walibi Holland',
      link: 'https://www.walibi.nl/halloween/en/halloween-fright-nights',
      image: 'https://www.walibi.nl/content/dam/who/images/events/hfn/2024/HFN_Walibi_Slaughterhouse_1.jpg',
    },
    // Homelanding REMOVED (R2, 2026-07-03): Ness killed it on the board twice — a generic image
    // dragged a hero. Now in the corpus veto; never re-add without a genuinely great card.
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
    kid: h.kid ?? false,
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
