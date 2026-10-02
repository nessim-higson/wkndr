import { describe, it, expect } from 'bun:test'
import { placeOf } from '../src/lib/place'
import type { Pick } from '../src/types'

const p = (o: Partial<Pick>) => ({ id: 'web-iams-x', title: 'Museum Market', venue: '', area: 'Museumplein', when: 'Sat', category: 'out', freshness: 'weekend', outdoor: true, kid: false, price: '', blurb: '', why: '', link: '', source: 'I amsterdam', weatherFit: [], ...o } as Pick)

describe('a venue is a place, never a publisher', () => {
  it('blanks the publisher wherever it sits in the venue field', () => {
    expect(placeOf(p({ venue: 'I amsterdam' }))).toBe('')
    expect(placeOf(p({ venue: 'I amsterdam', source: 'I amsterdam · Your Little Black Book' }))).toBe('')
    expect(placeOf(p({ venue: 'Your Little Black Book', source: 'Your Little Black Book' }))).toBe('')
    expect(placeOf(p({ venue: 'i amsterdam ' }))).toBe('')
  })
  it('keeps a venue that publishes its own programme — a museum is a place AND a source', () => {
    expect(placeOf(p({ venue: 'Eye Filmmuseum', source: 'Eye Filmmuseum' }))).toBe('Eye Filmmuseum')
    expect(placeOf(p({ venue: 'Efteling', source: 'Efteling' }))).toBe('Efteling')
    expect(placeOf(p({ venue: 'Concertgebouw', source: 'Concertgebouw · I amsterdam' }))).toBe('Concertgebouw')
  })
  it('keeps a real place, even one the publisher also lists', () => {
    expect(placeOf(p({ venue: 'Nelson Mandelapark' }))).toBe('Nelson Mandelapark')
    expect(placeOf(p({ venue: 'Mozes en Aäronkerk', source: 'Maps' }))).toBe('Mozes en Aäronkerk')
    expect(placeOf(p({ venue: '' }))).toBe('')
  })
})
