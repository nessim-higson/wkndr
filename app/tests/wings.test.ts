// THE WINGS + THE CARD IMAGE (V.11.10) — the deck's honest "more", and the one-crop card face.
import { describe, it, expect } from 'bun:test'
import { mergeWings } from '../src/lib/wings'
import { cardImageOf, headerImageOf, originalOf, focalPosition } from '../src/lib/image'
import { holdBackImageless } from '../src/weather/modes'
import type { Pick } from '../src/types'

const P = (o: Partial<Pick> & { id: string; title: string }): Pick => ({
  venue: 'V', area: '', when: 'Sat 12 Sep', category: 'out', freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'S', link: 'https://x.example/e',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...o,
})

describe('mergeWings — the bench and the merit airlock, behind the feed, never twice', () => {
  const feed = [P({ id: 'web-iams-a', title: 'Amsterdam Wine Festival' }), P({ id: 'canon-x', title: 'Foodhallen' })]
  it('dedupes by id and by title (word-order/punctuation blind), bench first, airlock by judge', () => {
    const bench = [P({ id: 'web-lbb-b', title: 'Sleazefest' }), P({ id: 'web-iams-a', title: 'Amsterdam Wine Festival' }), P({ id: 'web-x', title: 'Wine Festival Amsterdam 2026' })]
    const pending = [
      P({ id: 'web-p1', title: 'Low one', judgeScore: 3 }),
      P({ id: 'web-p2', title: 'Good one', judgeScore: 7 }),
      P({ id: 'web-p3', title: 'Better one', judgeScore: 8 }),
      P({ id: 'web-lbb-b', title: 'Sleazefest', judgeScore: 9 }),
    ]
    expect(mergeWings(feed, bench, pending).map((p) => p.id)).toEqual(['web-lbb-b', 'web-p3', 'web-p2'])
  })
  it('below the judge floor is not "more"', () => {
    expect(mergeWings(feed, [], [P({ id: 'web-junk', title: 'Junk', judgeScore: 2 })])).toEqual([])
  })
  it('a blank from the wings still never opens the deck', () => {
    const list = [P({ id: 'n', title: 'n' }), P({ id: 'p', title: 'p', image: 'https://i/x.jpg' })]
    expect(holdBackImageless(list, 1).map((p) => p.id)).toEqual(['p', 'n'])
  })
})

describe('the card face — one crop, positioned by the focal point', () => {
  const render = 'https://images.weserv.nl/?url=https%3A%2F%2Fapp.thefeedfactory.nl%2Fa%2Ffringe.webp&w=800&h=1200&fit=cover&a=focal&fpx=0.200&fpy=0.350&output=jpg&default=x'
  it('cardImageOf asks for the uncropped source (fit=inside), never the portrait render', () => {
    const face = cardImageOf(render)
    expect(face).toContain('fit=inside')
    expect(face).not.toContain('fit=cover')
    expect(originalOf(face)).toBe('https://app.thefeedfactory.nl/a/fringe.webp')
  })
  it('a non-wsrv image (bundled) is used as-is', () => {
    expect(cardImageOf('/img/local.jpg')).toBe('/img/local.jpg')
  })
  it('the detail header crops 3:2 on the focal point when known', () => {
    expect(headerImageOf(render, [0.2, 0.35])).toContain('w=1200&h=800&fit=cover&a=focal&fpx=0.200&fpy=0.350')
    expect(headerImageOf(render)).toContain('a=attention')
  })
  it('focalPosition → CSS, centre-high by default', () => {
    expect(focalPosition(P({ id: 'a', title: 'a', imageFocal: [0.2, 0.35] }))).toBe('20% 35%')
    expect(focalPosition(P({ id: 'b', title: 'b' }))).toBe('50% 40%')
    expect(focalPosition(null)).toBe('50% 40%')
  })
})
