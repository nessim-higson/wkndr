// THE GEO LAYER (V.11) — where a pick is, and how far that is from you.
//
// Ported from the /geo prototype (app/public/geo/index.html, geo G.1) and made a real,
// tested module. Two jobs:
//   1. RESOLVE a pick to a place — a venue pin, else a district, else honestly nothing.
//   2. ROUTE from you to it — bike minutes, with the IJ ferry modelled explicitly.
//
// THE LAWS (see STATE.md /geo entry + docs the experiment series 11–14):
//   · Near-me is a SORT, never a gate. Far picks sink; they never vanish.
//   · A district is a counted filter — the count must be honest BEFORE the tap.
//   · What we don't know, we don't guess: an area of just "Amsterdam" resolves to
//     `unknown`, shows no distance, and sinks. A wrong number is worse than no number.
//
// The gazetteer is NAME-KEYED, not index-keyed, so it survives every feed refresh. The
// permanent fix is pipeline-side (STATE.md open item 8: RA's discarded `venue.area`,
// I amsterdam's address JSON-LD, PDOK geocode → a cached venues file); when the feed
// starts carrying `lat`/`lon`, resolveGeo prefers them and this table becomes a fallback.

import type { Pick } from '../types'

export type District =
  | 'Noord' | 'Centrum' | 'West' | 'Oost' | 'Zuid' | 'De Pijp' | 'Zuidoost' | 'Day-trip' | 'Citywide'

/** The order districts are offered in — Noord first because that's the field ask. */
export const DISTRICTS: District[] = [
  'Noord', 'Centrum', 'West', 'Oost', 'Zuid', 'De Pijp', 'Zuidoost', 'Day-trip',
]

export type PlaceKind = 'pin' | 'approx' | 'train' | 'citywide' | 'unknown'

export interface Place {
  kind: PlaceKind
  district: District | null
  lat?: number
  lon?: number
  /** north of the IJ — the ferry test. Not derivable from latitude alone near the banks. */
  north?: boolean
  /** day-trips only: minutes by train, parsed from the feed's own area string. */
  train?: number
}

export interface Origin { lat: number; lon: number; north: boolean }

/** Rough IJ line for a *user* position (venues carry an explicit flag instead). Between the
 *  Centraal side (~52.379) and the northern bank (~52.383); only used for "my location". */
export const IJ_LAT = 52.3815
export const originAt = (lat: number, lon: number): Origin => ({ lat, lon, north: lat > IJ_LAT })

/** Two presets so the deck can be judged from someone else's doorstep (Ness's friend lives north). */
export const ORIGIN_PRESETS = {
  centraal: { lat: 52.3789, lon: 4.9003, north: false, label: 'Centraal' },
  noord: { lat: 52.3903, lon: 4.9022, north: true, label: 'Noord' },
} as const

// ─── the gazetteer ────────────────────────────────────────────────────────────────────
// [needle, lat, lon, northOfIJ?]. Matched against "venue | title", lowercased + de-accented.
// Needles must be ≥4 chars (short ones collide — "as", "bak" go in GAZ_EXACT instead).
const GAZ: [string, number, number, 1?][] = [
  ['nieuwe kerk', 52.3736, 4.8925], ['mandelapark', 52.3163, 4.9569],
  ['scheepvaart', 52.3714, 4.9147], ['maritime museum', 52.3714, 4.9147],
  ["h'art", 52.3653, 4.9024], ['hart museum', 52.3653, 4.9024], ['hermitage', 52.3653, 4.9024],
  ['carré', 52.3625, 4.9040], ['carre', 52.3625, 4.9040],
  ['de hallen', 52.3669, 4.8686], ['foodhallen', 52.3669, 4.8686], ['filmhallen', 52.3669, 4.8686],
  ['concertgebouw', 52.3563, 4.8790], ['rijksmuseum', 52.3600, 4.8852],
  ['waterlooplein', 52.3679, 4.9010], ['bret', 52.3893, 4.8372],
  ['pllek', 52.4013, 4.8916, 1], ['café chris', 52.3739, 4.8790], ['cafe chris', 52.3739, 4.8790],
  ['sauna deco', 52.3757, 4.8901], ['vondelpark', 52.3580, 4.8686],
  ['the movies', 52.3839, 4.8853], ['two story', 52.3690, 4.8890],
  ['stedelijk', 52.3581, 4.8798], ['foam', 52.3641, 4.8937], ['fyka', 52.3707, 4.8896],
  ['droog', 52.3690, 4.8965], ['mendo', 52.3690, 4.8840], ['patta', 52.3743, 4.9000],
  ['x bank', 52.3720, 4.8890], ['melkweg', 52.3648, 4.8811], ['mobilia', 52.3630, 4.8990],
  ['vlieger', 52.3665, 4.8985], ['micropia', 52.3665, 4.9126], ['paradiso', 52.3622, 4.8836],
  ['kriterion', 52.3628, 4.9078], ['nxt museum', 52.3900, 4.9060, 1],
  ['tonton', 52.3737, 4.8975], ['dappermarkt', 52.3622, 4.9297],
  ['garage noord', 52.3906, 4.9296, 1], ['bloemenmarkt', 52.3671, 4.8910],
  ['gaasperplas', 52.3120, 4.9920], ['eye film', 52.3843, 4.9006, 1],
  ['sexyland', 52.3990, 4.8930, 1], ['albert cuyp', 52.3559, 4.8955],
  ['huis marseille', 52.3675, 4.8880], ['koninklijk paleis', 52.3731, 4.8913],
  ['hortus', 52.3663, 4.9080], ['straat', 52.4005, 4.8930, 1], ['ndsm', 52.4005, 4.8930, 1],
  ['van loon', 52.3646, 4.8946], ['stenen hoofd', 52.3900, 4.8880],
  ['kaap amsterdam', 52.3745, 4.9600], ['strand zuid', 52.3390, 4.8890],
  ['hannekes boom', 52.3735, 4.9095], ['artis', 52.3663, 4.9163],
  ['amsterdamse bos', 52.3110, 4.8360], ['isoamsterdam', 52.4010, 4.9030, 1],
  ['oedipus', 52.3947, 4.9271, 1], ['skatecafé', 52.3921, 4.9251, 1], ['skatecafe', 52.3921, 4.9251, 1],
  ['tolhuistuin', 52.3846, 4.9033, 1], ['westergas', 52.3862, 4.8768], ['muziekgebouw', 52.3767, 4.9124],
  ['bimhuis', 52.3767, 4.9124], ['de school', 52.3599, 4.8290], ['radion', 52.3565, 4.8305],
  ['lofi', 52.3568, 4.8283], ['de kas', 52.3517, 4.9331], ['frankendael', 52.3517, 4.9331],
  ['tropenmuseum', 52.3626, 4.9223], ['nemo', 52.3738, 4.9123], ['rembrandthuis', 52.3694, 4.9012],
  ['anne frank', 52.3752, 4.8840], ['begijnhof', 52.3690, 4.8899], ['moco', 52.3585, 4.8830],
  ['noorderlicht', 52.4004, 4.8925, 1], ['ij-hallen', 52.4009, 4.8933, 1], ['ijhallen', 52.4009, 4.8933, 1],
  ['pakhuis de zwijger', 52.3757, 4.9145], ['de brakke grond', 52.3714, 4.8934],
  ['de balie', 52.3639, 4.8817], ['eye', 52.3843, 4.9006, 1],
]
/** Venue names too short/common to substring-match — exact (normalized) match only. */
const GAZ_EXACT: Record<string, [number, number, (1 | undefined)?]> = {
  as: [52.3460, 4.8770], bak: [52.3902, 4.8858], 'tête': [52.3655, 4.9330], tete: [52.3655, 4.9330],
}

/** District centroids — the ≈ fallback when we know the neighbourhood but not the door. */
const CENTROIDS: Record<Exclude<District, 'Day-trip' | 'Citywide'>, [number, number, boolean]> = {
  Noord: [52.395, 4.920, true], West: [52.375, 4.855, false], Oost: [52.360, 4.940, false],
  Zuid: [52.350, 4.870, false], 'De Pijp': [52.355, 4.895, false], Centrum: [52.370, 4.895, false],
  Zuidoost: [52.315, 4.955, false],
}

export const norm = (s: string | undefined): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Area string → district. Returns null for anything that isn't actually a place —
 * a bare "Amsterdam" is NOT a district, and guessing one would put a Zuidoost gig in
 * Centrum's count. Specific Centrum landmarks are tested BEFORE the generic compass
 * tokens, because "Oosterdok" and "Amstel" are Centrum, not Oost.
 */
export function districtOf(area: string | undefined): District | null {
  const a = norm(area)
  if (!a || a === 'amsterdam' || a === 'citywide') return null
  if (a.includes('zuidoost')) return 'Zuidoost'
  if (a.includes('pijp')) return 'De Pijp'
  if (a.includes('noord')) return 'Noord'
  if (/(centrum|centre|jordaan|canals|singel|gracht|leidseplein|leidsebuurt|spui|plantage|nieuwmarkt|haarlemmer|oosterdok|waterloo|negen str|rembrandtplein|staalstraat|berenstraat|utrechtsestraat|zeedijk|kattenburg|dam\b)/.test(a)) return 'Centrum'
  if (/(museumplein|museumkwartier|amstelveen|buitenveldert|zuidas|beatrixpark|concertgebouw)/.test(a) || /\brai\b/.test(a)) return 'Zuid'
  if (/(oost|zeeburg|dapper|watergraafsmeer|indische|javastraat|wibaut)/.test(a)) return 'Oost'
  if (/(west|houthaven|sloterdijk|bos en lommer)/.test(a)) return 'West'
  if (a.includes('zuid')) return 'Zuid'
  if (a.includes('amstel')) return 'Centrum'
  return null
}

const nearestDistrict = (lat: number, lon: number): District => {
  let best: District = 'Centrum', bd = Infinity
  for (const [name, c] of Object.entries(CENTROIDS)) {
    const d = (c[0] - lat) ** 2 + (c[1] - lon) ** 2
    if (d < bd) { bd = d; best = name as District }
  }
  return best
}

/** Day-trip travel time, read out of the feed's OWN area string ("~30 min by train", "~1h15"). */
export function trainMinutes(area: string | undefined): number {
  const a = norm(area)
  const h = a.match(/~?(\d)h(\d{2})?/)
  if (h) return Number(h[1]) * 60 + (h[2] ? Number(h[2]) : 0)
  const m = a.match(/~?(\d{2,3})\s?min/)
  if (m) return Number(m[1])
  return 45
}

/**
 * Where is this pick? Prefers coordinates off the feed (forward-compatible with the
 * pipeline geocode), then the venue gazetteer, then the district, then honestly nothing.
 */
export function resolveGeo(p: Pick): Place {
  // 1. the feed knows (once the cron stamps coords — STATE.md open item 8)
  if (typeof p.lat === 'number' && typeof p.lon === 'number') {
    const d = districtOf(p.area) ?? nearestDistrict(p.lat, p.lon)
    return { kind: 'pin', lat: p.lat, lon: p.lon, north: p.lat > IJ_LAT, district: d }
  }
  const hay = `${norm(p.venue)} | ${norm(p.title)}`
  const areaN = norm(p.area)

  if (p.category === 'daytrip' || /day-?trip/.test(areaN)) {
    return { kind: 'train', train: trainMinutes(p.area), district: 'Day-trip' }
  }
  if (/citywide|diverse locat|various|multiple locat/.test(`${hay} ${areaN}`)) {
    return { kind: 'citywide', district: 'Citywide' }
  }
  const exact = GAZ_EXACT[norm(p.venue)]
  if (exact) {
    return { kind: 'pin', lat: exact[0], lon: exact[1], north: !!exact[2],
      district: districtOf(p.area) ?? nearestDistrict(exact[0], exact[1]) }
  }
  for (const [needle, lat, lon, north] of GAZ) {
    if (needle.length >= 4 && hay.includes(needle)) {
      return { kind: 'pin', lat, lon, north: !!north,
        district: north ? 'Noord' : (districtOf(p.area) ?? nearestDistrict(lat, lon)) }
    }
  }
  const d = districtOf(p.area)
  if (d && d !== 'Day-trip' && d !== 'Citywide') {
    const c = CENTROIDS[d]
    return { kind: 'approx', lat: c[0], lon: c[1], north: c[2], district: d }
  }
  return { kind: 'unknown', district: null }
}

// ─── the distance model ───────────────────────────────────────────────────────────────
// Crow-flies × a detour factor at an effective cycling speed. Amsterdam is the best case
// for this: flat, dense grid, no hills. Good to ±2–3 min for intra-city trips — which is
// the tolerance the number is FOR ("round the corner" vs "a trek"), hence the display
// rounds UP to fives rather than pretending to the minute.
export const KMH = 15
export const DETOUR = 1.3

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
export const bikeMinutes = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number =>
  (haversineKm(a, b) * DETOUR) / KMH * 60

/** THE IJ. Crow-flies lies hardest here: Centraal→Tolhuistuin is ~700m and ~10 real minutes.
 *  So the crossing gets its own model — ride to a landing, wait half a headway, cross, ride on. */
const FERRIES = [
  { name: 'Buiksloterweg', s: { lat: 52.3803, lon: 4.9000 }, n: { lat: 52.3826, lon: 4.9020 }, wait: 3, cross: 4 },
  { name: 'NDSM', s: { lat: 52.3803, lon: 4.9000 }, n: { lat: 52.4009, lon: 4.8933 }, wait: 7, cross: 14 },
]

export interface Route {
  /** minutes; Infinity when unknowable, so it sorts last without pretending to a number. */
  mins: number
  /** short form for a card face: "~10 min · bike + ferry". Empty when unknown. */
  label: string
  /** long form for the detail sheet. Null when unknown. */
  detail: string | null
  ferry?: string
}

/** Round UP to fives — the model doesn't deserve single-minute precision, so don't claim it. */
export const displayMinutes = (m: number): string => `~${Math.max(5, Math.ceil(m / 5) * 5)} min`

export function routeTo(place: Place, from: Origin | null): Route {
  if (!from || place.kind === 'unknown') return { mins: Infinity, label: '', detail: null }
  if (place.kind === 'train') {
    const t = place.train ?? 45
    return { mins: 800 + t, label: `~${t} min · train`, detail: `~${t} min by train — a day-trip` }
  }
  if (place.kind === 'citywide') {
    return { mins: 900, label: 'citywide', detail: 'citywide — it comes to you' }
  }
  const to = { lat: place.lat!, lon: place.lon! }
  const approx = place.kind === 'approx' ? '≈ ' : ''
  const est = place.kind === 'approx' ? ' (district estimate)' : ''
  if (from.north === !!place.north) {
    const m = bikeMinutes(from, to)
    return { mins: m, label: `${approx}${displayMinutes(m)} · bike`,
      detail: `${approx}${displayMinutes(m)} by bike${est}` }
  }
  let best: { tot: number; name: string } | null = null
  for (const f of FERRIES) {
    const board = from.north ? f.n : f.s
    const land = from.north ? f.s : f.n
    const tot = bikeMinutes(from, board) + f.wait + f.cross + bikeMinutes(land, to)
    if (!best || tot < best.tot) best = { tot, name: f.name }
  }
  return {
    mins: best!.tot,
    label: `${approx}${displayMinutes(best!.tot)} · bike + ferry`,
    detail: `${approx}${displayMinutes(best!.tot)} — bike + the ${best!.name} ferry${est}`,
    ferry: best!.name,
  }
}

/** One call for the common case. */
export const routeFor = (p: Pick, from: Origin | null): Route => routeTo(resolveGeo(p), from)

/**
 * The ranking term for "near me first" (V.11). Deliberately a SORT WEIGHT, not a filter:
 * a far pick loses points, never its place in the deck. Capped just under the weather
 * term (10) so weather stays the thesis, and applied before orderServed so 👑 TOP / ▲ LEAD
 * / the hand-dragged pile still lead the deck by law — proximity reorders the middle.
 * Day-trips, citywide and unknown score 0: they aren't near, and they aren't punished either.
 */
export const NEAR_W = 8
export function nearScore(p: Pick, from: Origin | null): number {
  if (!from) return 0
  const r = routeFor(p, from)
  if (!isFinite(r.mins) || r.mins >= 60) return 0
  return NEAR_W * Math.max(0, 1 - r.mins / 30)   // full weight at the door, zero by ~30 min
}
