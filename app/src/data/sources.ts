// The full roster of publications + feeds WKNDR draws from, by category.
// Credibility surface for the "What's feeding this" sheet — each links out
// (signal + link, never republished). A given week uses a subset; the pipeline
// (docs/content-pipeline.md) widens coverage over time.
export interface Source { name: string; url: string }

export const SOURCE_ROSTER: Record<string, Source[]> = {
  'Live & gigs': [
    { name: 'Songkick', url: 'https://www.songkick.com/metro-areas/31366-amsterdam' },
    { name: 'Resident Advisor', url: 'https://ra.co/events/nl/amsterdam' },
    { name: 'Bandsintown', url: 'https://www.bandsintown.com/c/amsterdam-netherlands' },
    { name: 'Paradiso', url: 'https://www.paradiso.nl/' },
    { name: 'Melkweg', url: 'https://www.melkweg.nl/' },
    { name: 'Tolhuistuin', url: 'https://tolhuistuin.nl/' },
    { name: 'AFAS Live', url: 'https://www.afaslive.nl/' },
    { name: 'Ziggo Dome', url: 'https://www.ziggodome.nl/' },
  ],
  'Eat & drink': [
    { name: 'Eater', url: 'https://www.eater.com/' },
    { name: 'Het Parool · PS', url: 'https://www.parool.nl/ps' },
    { name: 'The Infatuation', url: 'https://www.theinfatuation.com/' },
    { name: 'Your Little Black Book', url: 'https://www.yourlittleblackbook.me/en/' },
    { name: 'Misset Horeca', url: 'https://www.missethoreca.nl/' },
  ],
  'Art & museums': [
    { name: 'Rijksmuseum', url: 'https://www.rijksmuseum.nl/en' },
    { name: 'Van Gogh Museum', url: 'https://www.vangoghmuseum.nl/en' },
    { name: 'Stedelijk', url: 'https://www.stedelijk.nl/en' },
    { name: 'Moco', url: 'https://mocomuseum.com/' },
    { name: 'Foam', url: 'https://www.foam.org/' },
    { name: 'H’ART', url: 'https://www.hartmuseum.nl/en/' },
    { name: 'Huis Marseille', url: 'https://huismarseille.nl/en/' },
    { name: 'Eye Filmmuseum', url: 'https://www.eyefilm.nl/en' },
    { name: 'NEMO', url: 'https://www.nemosciencemuseum.nl/en/' },
    { name: 'Rembrandthuis', url: 'https://www.rembrandthuis.nl/en/' },
    { name: 'Anne Frank House', url: 'https://www.annefrank.org/en/' },
    { name: 'De Nieuwe Kerk', url: 'https://www.nieuwekerk.nl/en/' },
    { name: 'STRAAT', url: 'https://straatmuseum.com/en' },
    { name: 'Nxt Museum', url: 'https://nxtmuseum.com/' },
  ],
  'Stage & screen': [
    { name: 'Holland Festival', url: 'https://hollandfestival.nl/en/' },
    { name: 'Internationaal Theater A’dam', url: 'https://ita.nl/en/' },
    { name: 'Uitkrant', url: 'https://www.uitkrant.nl/' },
    { name: 'Eye programme', url: 'https://www.eyefilm.nl/en/whats-on' },
  ],
  'Out & markets': [
    { name: 'I amsterdam', url: 'https://www.iamsterdam.com/en/whats-on' },
    { name: 'IJ-Hallen', url: 'https://ijhallen.nl/en/' },
    { name: 'Westergas', url: 'https://westergas.nl/en' },
    { name: 'Pekmarkt', url: 'https://pekmarkt.nl/' },
    { name: 'Gemeente Amsterdam', url: 'https://www.amsterdam.nl/en/' },
  ],
  'Kids': [
    { name: 'Kidsproof', url: 'https://www.kidsproof.nl/amsterdam' },
    { name: 'Amsterdam Mamas', url: 'https://amsterdam-mamas.nl/' },
    { name: 'I amsterdam family', url: 'https://www.iamsterdam.com/en/see-and-do/things-to-do/family' },
  ],
  'Day-trips': [
    { name: 'The Dutch Review', url: 'https://dutchreview.com/' },
    { name: 'NS', url: 'https://www.ns.nl/en' },
    { name: 'Holland.com', url: 'https://www.holland.com/' },
  ],
  'Weather': [
    { name: 'Open-Meteo', url: 'https://open-meteo.com/' },
    { name: 'Buienradar', url: 'https://www.buienradar.nl/' },
    { name: 'KNMI', url: 'https://www.knmi.nl/' },
  ],
}

export const SOURCE_COUNT = Object.values(SOURCE_ROSTER).reduce((n, a) => n + a.length, 0)
