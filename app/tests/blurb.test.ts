import { describe, it, expect } from 'bun:test'
import { stripGallery, endCleanly, tidyBlurb } from '../src/lib/blurb'

describe('a blurb is a sentence about the event', () => {
  it('drops a leading photo carousel: caption, credit, controls, counter', () => {
    const raw = 'Keerweer Image from Konstantin Sonnenkind Previous slide Next slide 1 / 2 Slide 1 of 2 There’s nothing like a lakeside setting to add some drama to your cinema '
    expect(stripGallery(raw).trim()).toBe('There’s nothing like a lakeside setting to add some drama to your cinema')
    expect(tidyBlurb(raw)).toBe('There’s nothing like a lakeside setting to add some drama to your cinema…')
    expect(stripGallery('A quiet garden in the middle of town.')).toBe('A quiet garden in the middle of town.')
  })
  it('ends a guillotined blurb on a sentence when one ends in reach, else on a whole word', () => {
    // the real one: cut at 160 by the old adapter, mid-word
    expect(tidyBlurb('A moment of music in the middle of the day Step inside the Moses and Aaron Church and leave the hustle and bustle of the city behind for a moment. These luncht'))
      .toBe('A moment of music in the middle of the day Step inside the Moses and Aaron Church and leave the hustle and bustle of the city behind for a moment.')
    expect(tidyBlurb('Browse forty stalls of vintage clothing, ceramics, records and books along the water with coffee and natural wine from the neighbours and a long table of thi'))
      .toBe('Browse forty stalls of vintage clothing, ceramics, records and books along the water with coffee and natural wine from the neighbours and a long table of…')
    expect(tidyBlurb('Open every Saturday.')).toBe('Open every Saturday.')
    expect(tidyBlurb('A lovely little market')).toBe('A lovely little market')   // short and never cut: as written
  })
  it('is idempotent, and cuts to a length without splitting a word', () => {
    const long = 'One sentence that runs on and on about the many pleasures of the market, the people, the food, the music and the weather, without ever really arriving anywhere in particular at all, honestly.'
    const once = tidyBlurb(long, 120)
    expect(once.length).toBeLessThanOrEqual(121)
    expect(once.endsWith('…')).toBe(true)
    expect(tidyBlurb(once)).toBe(once)
    expect(tidyBlurb('')).toBe('')
  })
})
