// THE HAND PILE MUST REACH THE DECK.
//
// Ness, repeatedly: "I CONSISTENTLY load wkndr and don't see the cards in my top 10 in the app."
// He was right, and it was total — not intermittent. App.tsx's filtered branch returned
// `diversify(filtered)` with no `orderServed`, and `diversify` only knows about categories: it
// throws pilePos, `top` and `lead` away. Because DEFAULT_WHENS is ['weekend'], that branch runs on
// EVERY load before the user touches a filter, so the board's order never reached the deck once.
//
// These tests pin the composition, not the branch: diversify alone loses the order, and
// orderServed(diversify(x)) restores it. Any future path that de-clusters without re-ordering
// fails here.
import { describe, it, expect } from 'bun:test'
import { diversify, orderServed } from '../src/weather/modes'
import type { Pick } from '../src/types'

const p = (title: string, category: Pick['category'], extra: Partial<Pick> = {}): Pick => ({
  id: `x-${title}`, title, venue: '', area: '', when: '', category,
  freshness: 'weekend', outdoor: false, kid: false, price: '', blurb: '', why: '',
  source: '', link: '', weatherFit: ['WARM'], ...extra,
})

// a board round: three hand-placed picks, then the rest of the feed
const deck: Pick[] = [
  p('Loveland Festival', 'live'),
  p('Random Gallery', 'art'),
  p('Chefs in het Bos', 'eat', { pilePos: 1 }),
  p('Cinetree', 'stage', { pilePos: 2 }),
  p('Kaap Amsterdam', 'out', { pilePos: 3 }),
  p('Some Bar', 'drink'),
]

describe('the hand pile reaches the deck', () => {
  it('orderServed deals the pile first, in order', () => {
    const out = orderServed(deck)
    expect(out.slice(0, 3).map((x) => x.title)).toEqual(['Chefs in het Bos', 'Cinetree', 'Kaap Amsterdam'])
  })

  it('diversify ALONE loses the pile — this is the bug that shipped', () => {
    const out = diversify(deck)
    // it de-clusters by category and has no idea pilePos exists
    expect(out[0].title).not.toBe('Chefs in het Bos')
  })

  it('de-clustering THEN ordering keeps both properties', () => {
    const out = orderServed(diversify(deck))
    expect(out.slice(0, 3).map((x) => x.title)).toEqual(['Chefs in het Bos', 'Cinetree', 'Kaap Amsterdam'])
    // and the tail is still de-clustered — no two neighbours share a category
    const tail = out.slice(3)
    for (let i = 1; i < tail.length; i++) expect(tail[i].category).not.toBe(tail[i - 1].category)
  })

  it('a 👑 TOP pick still cannot jump the hand pile', () => {
    const withTop = [...deck, p('A Top Pick', 'market', { top: true })]
    expect(orderServed(diversify(withTop))[0].title).toBe('Chefs in het Bos')
  })
})
