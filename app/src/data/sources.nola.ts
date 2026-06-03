import type { Source } from './sources'

// New Orleans source roster — the feeds a NOLA crawl would draw on. Same signal+link
// model. WWOZ Livewire is the local gold standard for live music listings.
export const SOURCE_ROSTER_NOLA: Record<string, Source[]> = {
  'Live & gigs': [
    { name: 'WWOZ Livewire', url: 'https://www.wwoz.org/calendar/livewire-music' },
    { name: 'OffBeat', url: 'https://www.offbeat.com/events/' },
    { name: 'Preservation Hall', url: 'https://www.preservationhall.com/' },
    { name: 'Tipitina’s', url: 'https://www.tipitinas.com/' },
    { name: 'd.b.a.', url: 'https://www.dbaneworleans.com/' },
    { name: 'Maple Leaf Bar', url: 'https://www.mapleleafbar.com/' },
  ],
  'Eat & drink': [
    { name: 'Eater New Orleans', url: 'https://nola.eater.com/' },
    { name: 'The Infatuation', url: 'https://www.theinfatuation.com/new-orleans' },
    { name: 'Gambit · best of', url: 'https://www.nola.com/gambit/' },
  ],
  'Art & museums': [
    { name: 'NOMA', url: 'https://noma.org/' },
    { name: 'Ogden Museum', url: 'https://ogdenmuseum.org/' },
    { name: 'WWII Museum', url: 'https://www.nationalww2museum.org/' },
    { name: 'CAC New Orleans', url: 'https://cacno.org/' },
  ],
  'Stage & screen': [
    { name: 'Saenger Theatre', url: 'https://www.saengernola.com/' },
    { name: 'The Prytania', url: 'https://www.theprytania.com/' },
  ],
  'Out & markets': [
    { name: 'neworleans.com', url: 'https://www.neworleans.com/events/' },
    { name: 'Crescent City Farmers Market', url: 'https://www.crescentcityfarmersmarket.org/' },
    { name: 'Steamboat Natchez', url: 'https://www.steamboatnatchez.com/' },
  ],
  'Weather': [
    { name: 'Open-Meteo', url: 'https://open-meteo.com/' },
    { name: 'National Weather Service · LIX', url: 'https://www.weather.gov/lix/' },
  ],
}

export const SOURCE_COUNT_NOLA = Object.values(SOURCE_ROSTER_NOLA).reduce((n, a) => n + a.length, 0)
