// The full roster of publications + feeds WKNDR draws from, by category.
// This is the credibility surface (shown in the "What's feeding this" sheet).
// A given week's brief uses a subset; the pipeline (docs/content-pipeline.md)
// widens coverage over time. Signal + link — never republished.
export const SOURCE_ROSTER: Record<string, string[]> = {
  'Live & gigs': ['Songkick', 'Resident Advisor', 'Bandsintown', 'Paradiso', 'Melkweg', 'Tolhuistuin', 'AFAS Live', 'Ziggo Dome'],
  'Eat & drink': ['Eater Amsterdam', 'Het Parool · PS', 'The Infatuation', 'Your Little Black Book', 'Misset Horeca'],
  'Art & museums': ['Rijksmuseum', 'Van Gogh Museum', 'Stedelijk', 'Moco', 'Foam', 'H’ART', 'Huis Marseille', 'Eye Filmmuseum', 'NEMO', 'Rembrandthuis', 'Anne Frank House', 'De Nieuwe Kerk', 'STRAAT', 'Nxt Museum'],
  'Stage & screen': ['Holland Festival', 'Internationaal Theater A’dam', 'Uitkrant', 'Eye programme'],
  'Out & markets': ['I amsterdam', 'IJ-Hallen', 'Westergas', 'Pekmarkt', 'Gemeente Amsterdam'],
  'Kids': ['Kidsproof', 'Amsterdam Mamas', 'I amsterdam family'],
  'Day-trips': ['The Dutch Review', 'NS', 'regional tourism'],
  'Weather': ['Open-Meteo', 'Buienradar', 'KNMI'],
}

export const SOURCE_COUNT = Object.values(SOURCE_ROSTER).reduce((n, a) => n + a.length, 0)
