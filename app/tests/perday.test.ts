// PER-DAY WEATHER — the deck used to rank every pick against ONE mode blended across Sat+Sun
// (a `Math.max` over both days in weekendMode/goLive), so a Sunday-only picnic was judged by
// Saturday's sunshine and a Saturday show by Sunday's rain. These tests pin the fix:
// a pick is scored against the mode of the day(s) it is actually available on.
//
// The single-Mode contract is deliberately preserved (every prior caller and test still passes a
// bare Mode), so there are cases here for BOTH shapes.
import { describe, it, expect } from 'bun:test'
import { rankPicks, daysDiffer, weekendFrom, modeSpecOf, tempForPick, type DayWx } from '../src/weather/modes'
import { whenWeekendDays, upcomingWeekendEnd } from '../src/lib/when'
import type { Mode, Pick } from '../src/types'

const end = upcomingWeekendEnd()
const SUN = new Date(end.getFullYear(), end.getMonth(), end.getDate())
const SAT = new Date(SUN.getFullYear(), SUN.getMonth(), SUN.getDate() - 1)
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateStr = (d: Date) => `${d.getDate()} ${M[d.getMonth()]}`

const pick = (id: string, when: string, fit: Mode[], extra: Partial<Pick> = {}): Pick => ({
  id, title: id, venue: '', area: '', when, category: 'out', freshness: 'weekend',
  outdoor: false, kid: false, price: '', why: '', weatherFit: fit, image: '', blurb: '',
  source: '', link: '', ...extra,
} as Pick)

const day = (key: 'sat' | 'sun', hi: number, pop: number, mode: Mode): DayWx =>
  ({ key, label: key === 'sat' ? 'Sat' : 'Sun', hi, lo: hi - 8, pop, mode })

describe('whenWeekendDays — which day is a pick actually on?', () => {
  it('puts a Saturday-dated pick on Saturday only', () => {
    expect(whenWeekendDays(`Sat ${dateStr(SAT)}`, SAT, SUN)).toEqual({ sat: true, sun: false })
  })
  it('puts a Sunday-dated pick on Sunday only', () => {
    expect(whenWeekendDays(`Sun ${dateStr(SUN)}`, SAT, SUN)).toEqual({ sat: false, sun: true })
  })
  it('spans both days for a range that covers the weekend', () => {
    expect(whenWeekendDays(`${dateStr(SAT)} – ${dateStr(SUN)}`, SAT, SUN)).toEqual({ sat: true, sun: true })
  })
  it('gives BOTH days to undated, recurring and open-run picks', () => {
    for (const w of ['Daily · 9:00–18:00', 'Ongoing', 'Until 30 Aug', 'All summer · evenings', ''])
      expect(whenWeekendDays(w, SAT, SUN)).toEqual({ sat: true, sun: true })
  })
  it('falls back to BOTH when a pick lands on neither day, rather than stripping its weather score', () => {
    const fri = new Date(SAT.getFullYear(), SAT.getMonth(), SAT.getDate() - 1)
    expect(whenWeekendDays(`Fri ${dateStr(fri)} · 23:00`, SAT, SUN)).toEqual({ sat: true, sun: true })
  })
})

describe('rankPicks — each pick against its OWN day', () => {
  // Saturday is the good day; Sunday is washed out.
  const SPLIT = { sat: 'HOT' as Mode, sun: 'COLD_WET' as Mode }

  it('a Sunday-only outdoor pick is judged by SUNDAY, not by Saturday sunshine', () => {
    const sunOutdoor = pick('sun-picnic', `Sun ${dateStr(SUN)}`, ['HOT', 'WARM'], { outdoor: true })
    const sunIndoor = pick('sun-museum', `Sun ${dateStr(SUN)}`, ['COLD_WET'])
    // blended (the OLD behaviour) sees HOT and puts the picnic first…
    expect(rankPicks([sunIndoor, sunOutdoor], 'HOT')[0].id).toBe('sun-picnic')
    // …per-day sees Sunday's COLD_WET and correctly leads with the indoor pick
    expect(rankPicks([sunOutdoor, sunIndoor], SPLIT)[0].id).toBe('sun-museum')
  })

  it('a Saturday-only pick keeps Saturday’s mode even though Sunday is wet', () => {
    const satOutdoor = pick('sat-terrace', `Sat ${dateStr(SAT)}`, ['HOT', 'WARM'], { outdoor: true })
    const satIndoor = pick('sat-cinema', `Sat ${dateStr(SAT)}`, ['COLD_WET'])
    expect(rankPicks([satIndoor, satOutdoor], SPLIT)[0].id).toBe('sat-terrace')
  })

  it('an all-weekend pick takes the BEST day — a wet Sunday must not demote it', () => {
    // available both days and peaks in HOT: Saturday is the day you'd go, so it keeps its +10 fit
    const evergreen = pick('terrace', 'Daily · 12:00–23:00', ['HOT', 'WARM'], { outdoor: true })
    const noFit = pick('cool-only', 'Daily · 12:00–23:00', ['COOL'])
    expect(rankPicks([noFit, evergreen], SPLIT)[0].id).toBe('terrace')
  })

  // The point of a split weekend: an outdoor pick AND an indoor pick are BOTH right — one for
  // Saturday, one for Sunday. Neither should dominate, and both must beat a pick that suits neither.
  it('a split weekend makes both kinds of pick appropriate — and only those', () => {
    const outdoor = pick('terrace', 'Daily · 12:00–23:00', ['HOT', 'WARM'], { outdoor: true })
    const indoor = pick('indoor', 'Daily · 12:00–23:00', ['COLD_WET'])
    const noFit = pick('cool-only', 'Daily · 12:00–23:00', ['COOL'])
    const order = rankPicks([noFit, indoor, outdoor], SPLIT).map((p) => p.id)
    expect(order.slice(0, 2).sort()).toEqual(['indoor', 'terrace'])   // both fit, one per day
    expect(order[2]).toBe('cool-only')                                 // fits neither day
  })

  it('best-of-days is not a blanket pass: kill both days and the outdoor pick loses its fit', () => {
    const outdoor = pick('terrace', 'Daily · 12:00–23:00', ['HOT', 'WARM'], { outdoor: true })
    const indoor = pick('indoor', 'Daily · 12:00–23:00', ['COLD_WET'])
    expect(rankPicks([outdoor, indoor], { sat: 'COLD_WET', sun: 'COLD_WET' })[0].id).toBe('indoor')
  })

  it('the sun bonus follows the day too — no bonus for an outdoor pick on the wet day', () => {
    const sunOutdoor = pick('sun-openair', `Sun ${dateStr(SUN)}`, ['COLD_WET'], { outdoor: true })
    const sunIndoor = pick('sun-inside', `Sun ${dateStr(SUN)}`, ['COLD_WET'])
    // both fit COLD_WET; if the sun bonus leaked across days the outdoor one would win
    expect(rankPicks([sunOutdoor, sunIndoor], SPLIT).map((p) => p.id)).toEqual(['sun-openair', 'sun-inside'])
    const flip = rankPicks([sunIndoor, sunOutdoor], SPLIT).map((p) => p.id)
    expect(flip).toEqual(['sun-inside', 'sun-openair'])   // stable: neither got a weather bonus
  })

  it('a bare Mode still behaves exactly as before (the old contract is intact)', () => {
    const fit = pick('fit', 'Daily', ['WARM'])
    const miss = pick('miss', 'Daily', ['COLD_WET'])
    expect(rankPicks([miss, fit], 'WARM')[0].id).toBe('fit')
  })

  it('two identical days rank the same as the single mode they share', () => {
    const a = pick('a', `Sat ${dateStr(SAT)}`, ['HOT'])
    const b = pick('b', `Sun ${dateStr(SUN)}`, ['COLD_WET'])
    const same = rankPicks([a, b], { sat: 'HOT', sun: 'HOT' }).map((p) => p.id)
    expect(same).toEqual(rankPicks([a, b], 'HOT').map((p) => p.id))
  })
})

describe('the split is only announced when it matters', () => {
  it('flags a genuine split (different modes)', () => {
    expect(daysDiffer(day('sat', 26, 5, 'HOT'), day('sun', 16, 80, 'COLD_WET'))).toBe(true)
  })
  it('flags a big temperature gap even inside one mode', () => {
    expect(daysDiffer(day('sat', 29, 5, 'HOT'), day('sun', 24, 5, 'HOT'))).toBe(true)
  })
  it('flags a rain gap even inside one mode', () => {
    expect(daysDiffer(day('sat', 20, 5, 'WARM'), day('sun', 20, 55, 'WARM'))).toBe(true)
  })
  it('stays quiet on a genuinely uniform weekend — this weekend, 25°/25°', () => {
    expect(daysDiffer(day('sat', 25, 14, 'HOT'), day('sun', 25, 0, 'HOT'))).toBe(false)
    expect(weekendFrom([day('sat', 25, 14, 'HOT'), day('sun', 25, 0, 'HOT')], 'HOT').split).toBe(false)
  })
})

describe('tempForPick — the card shows ITS day’s temperature', () => {
  const split = weekendFrom([day('sat', 27, 5, 'HOT'), day('sun', 14, 95, 'COLD_WET')], 'VOLATILE')
  const uniform = weekendFrom([day('sat', 25, 14, 'HOT'), day('sun', 25, 0, 'HOT')], 'HOT')

  it('a Saturday card shows Saturday’s high', () => {
    expect(tempForPick(pick('a', `Sat ${dateStr(SAT)}`, ['HOT']), split, 27)).toBe(27)
  })
  it('a Sunday card shows SUNDAY’s high, not the weekend max', () => {
    expect(tempForPick(pick('b', `Sun ${dateStr(SUN)}`, ['COLD_WET']), split, 27)).toBe(14)
  })
  it('an all-weekend pick keeps the weekend figure — it isn’t tied to one day', () => {
    expect(tempForPick(pick('c', 'Daily · 12:00–23:00', ['HOT']), split, 27)).toBe(27)
  })
  it('a uniform weekend never splits the number', () => {
    expect(tempForPick(pick('d', `Sun ${dateStr(SUN)}`, ['HOT']), uniform, 25)).toBe(25)
  })
  it('falls back cleanly with no live forecast', () => {
    expect(tempForPick(pick('e', `Sun ${dateStr(SUN)}`, ['HOT']), null, 21)).toBe(21)
  })
})

describe('modeSpecOf — the bridge from state to ranking', () => {
  it('falls back to the single mode when no real forecast has landed (the what-if pills)', () => {
    expect(modeSpecOf(null, 'VOLATILE')).toBe('VOLATILE')
  })
  it('collapses a one-day weekend to that day on both sides', () => {
    const wx = weekendFrom([day('sun', 18, 10, 'WARM')], 'WARM')
    expect(modeSpecOf(wx, 'HOT')).toEqual({ sat: 'WARM', sun: 'WARM' })
  })
  it('passes both days through when the forecast has two', () => {
    const wx = weekendFrom([day('sat', 26, 5, 'HOT'), day('sun', 15, 90, 'COLD_WET')], 'VOLATILE')
    expect(modeSpecOf(wx, 'HOT')).toEqual({ sat: 'HOT', sun: 'COLD_WET' })
  })
})
