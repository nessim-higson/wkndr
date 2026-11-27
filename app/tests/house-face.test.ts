import { describe, expect, it } from 'bun:test'
import {
  HOUSE_MOVES, barLines, dealHouseMoves, emphasisIndex, forcedMove, houseDateLine, houseDay, houseHash, houseMove,
  isLongTitle, longestRun, moveFits, resolveFace, shortPlace, titleTokens, type HouseMove,
} from '../src/lib/house-face'

// Fixed inputs only: ids, titles and `when` strings written here. No clock, no feed file.
const SHORT = 'Museum Market'                                              // 13 characters
const LONG = 'Proper Sunday Roast at Café Iep in the Zeeheldenbuurt'       // 53
const card = (id: string, title = SHORT, when = 'Sat 21 Nov · 10:00', image?: string) => ({ id, title, when, image })
/** the first id of the form `<prefix>-<n>` whose own hash lands on `move` */
function idFor(move: HouseMove, prefix = 'card'): string {
  for (let n = 0; n < 5000; n++) if (HOUSE_MOVES[houseHash(`${prefix}-${n}`) % HOUSE_MOVES.length] === move) return `${prefix}-${n}`
  throw new Error(`no id for ${move}`)
}

describe('the move dealer', () => {
  it('is the hash of the id, modulo the number of moves: the same card gets the same move every time', () => {
    expect(HOUSE_MOVES.length).toBe(9)
    expect(HOUSE_MOVES as readonly string[]).not.toContain('refl')   // Reflected was dropped, 27 Nov 2026
    expect(houseHash('web-lbb-tips-noordermarkt')).toBe(houseHash('web-lbb-tips-noordermarkt'))
    for (let n = 0; n < 200; n++) {
      const c = card(`event-${n}`)
      expect(houseMove(c)).toBe(houseMove(c))
      expect(houseMove(c)).toBe(HOUSE_MOVES[houseHash(c.id) % HOUSE_MOVES.length])   // a short, dated card takes its own move
    }
  })

  it('reaches every move', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, n) => houseMove(card(`event-${n}`))))
    expect([...seen].sort()).toEqual([...HOUSE_MOVES].sort())
  })

  it('never repeats the move of the no-photo card before it', () => {
    const deck = Array.from({ length: 300 }, (_, n) => card(`event-${n}`))
    const moves = [...dealHouseMoves(deck).values()]
    expect(moves.length).toBe(300)
    for (let i = 1; i < moves.length; i++) expect(moves[i]).not.toBe(moves[i - 1])
  })

  it('steps a would-be repeat on to the next move, and leaves the first card its own', () => {
    const a = idFor('ledger', 'a'), b = idFor('ledger', 'b')
    const dealt = dealHouseMoves([card(a), card(b)])
    expect(dealt.get(a)).toBe('ledger')
    expect(dealt.get(b)).toBe('margin')   // the move after Ledger
  })

  it('counts a repeat across the photographs between two no-photo cards, and deals none to a photograph', () => {
    const a = idFor('rule', 'a'), b = idFor('rule', 'b')
    const dealt = dealHouseMoves([card(a), card('photo-1', SHORT, 'Sat 21 Nov', 'https://x/y.jpg'), card(b)])
    expect(dealt.has('photo-1')).toBe(false)
    expect(dealt.get(a)).toBe('rule')
    expect(dealt.get(b)).toBe('light')
  })

  it('is the same deal for the same order, whatever was dealt before', () => {
    const deck = Array.from({ length: 40 }, (_, n) => card(`event-${n}`))
    expect([...dealHouseMoves(deck)]).toEqual([...dealHouseMoves(deck.map((c) => ({ ...c })))])
  })

  it('?move= sets one move across the deck, except on a card that cannot carry it', () => {
    expect(forcedMove('ledger')).toBe('ledger')
    expect(forcedMove('Numeral')).toBe('num')
    expect(forcedMove('nonsense')).toBeNull()
    expect(forcedMove(null)).toBeNull()
    const deck = [card('a'), card('b', LONG), card('c')]
    expect([...dealHouseMoves(deck, 'ledger').values()]).toEqual(['ledger', 'ledger', 'ledger'])
    const up = dealHouseMoves(deck, 'up')
    expect(up.get('a')).toBe('up')
    expect(up.get('c')).toBe('up')
    expect(up.get('b')).toBe(houseMove(card('b', LONG)))   // its own move, which is never Up
  })

  it('a long title skips Up', () => {
    expect(isLongTitle(SHORT)).toBe(false)
    expect(isLongTitle('x'.repeat(24))).toBe(false)
    expect(isLongTitle('x'.repeat(25))).toBe(true)
    const id = idFor('up')
    expect(houseMove(card(id, SHORT))).toBe('up')
    expect(houseMove(card(id, LONG))).toBe('bars')   // the move after Up
    for (let n = 0; n < 300; n++) expect(houseMove(card(`event-${n}`, LONG))).not.toBe('up')
    const moves = [...dealHouseMoves(Array.from({ length: 300 }, (_, n) => card(`event-${n}`, LONG))).values()]
    expect(moves).not.toContain('up')
    for (let i = 1; i < moves.length; i++) expect(moves[i]).not.toBe(moves[i - 1])
  })

  it('a pick with no start day skips Numeral', () => {
    const id = idFor('num')
    expect(houseMove(card(id, SHORT, 'Sun 22 Nov · 12:00-22:30'))).toBe('num')
    for (const when of ['This weekend', 'Every Saturday', 'Until Sun 13 Dec', 'Now open · aperitivo hours', '']) {
      expect(moveFits('num', card(id, SHORT, when))).toBe(false)
      expect(houseMove(card(id, SHORT, when))).toBe('strip')   // the move after Numeral
    }
  })
})

describe('the date a card carries', () => {
  it('reads a start day, and refuses an end date', () => {
    expect(houseDay('Sat 21 Nov – Sun 22 Nov')).toEqual({ dow: 'Sat', day: '21', mon: 'Nov' })
    expect(houseDay('Sun 22 Nov · 12:00-22:30')).toEqual({ dow: 'Sun', day: '22', mon: 'Nov' })
    expect(houseDay('Until Sat 16 Jan')).toBeNull()
    expect(houseDay('This weekend')).toBeNull()
  })
  it('prints the short date, or the feed\'s own words when there is none', () => {
    expect(houseDateLine('Sun 22 Nov · 12:00-22:30')).toBe('Sun 22 Nov')
    expect(houseDateLine('Sat 12 Dec – Sun 13 Dec')).toBe('Sat 12 Dec')
    expect(houseDateLine('Until Sun 13 Dec')).toBe('Until Sun 13 Dec')
    expect(houseDateLine('This weekend')).toBe('This weekend')
    expect(houseDateLine('Now open · aperitivo hours')).toBe('Now open')
  })
})

describe('the text rules', () => {
  const subject = (t: string) => titleTokens(t)[emphasisIndex(t)]
  it('Emphasis finds the subject of a title', () => {
    expect(subject(LONG)).toBe('Roast')
    expect(subject('Café Pietertje opens in Westerpark')).toBe('Pietertje')
    expect(subject('Agaar (IDFA 2026)')).toBe('Agaar')
    expect(subject('Candlelight: Michael Jackson, Ed Sheeran & Coldplay in De Waalse Kerk')).toBe('Candlelight:')
    expect(subject('Must see: major Yayoi Kusama exhibition at the Stedelijk')).toBe('exhibition')
    expect(subject('The ice rink on Museumplein is open again.')).toBe('rink')
    expect(subject("There's a horse in the garden! Sinterklaas performance at Puppet Theatre Koos Kneus")).toBe('horse')
    expect(subject('SCIM Amsterdam 2026 – Settimana della Cucina Italiana nel Mondo')).toBe('Amsterdam')
    expect(subject('Vermut')).toBe('Vermut')
    expect(emphasisIndex('')).toBe(-1)
  })
  it('Bars sets two words to a line, one when the pair is too long, and never drops a word', () => {
    expect(barLines('Proper Sunday Roast at Café Iep')).toEqual(['Proper Sunday', 'Roast at', 'Café Iep'])
    expect(barLines('Christian Tschida and Pieksman at Neighborhood Café De Tros'))
      .toEqual(['Christian', 'Tschida and', 'Pieksman at', 'Neighborhood', 'Café De', 'Tros'])
    expect(barLines("Play, Share, Swap & Recycle Festival: swap toys and children's clothing in De Hallen").join(' '))
      .toBe("Play Share Swap & Recycle Festival swap toys and children's clothing in De Hallen")
    for (const line of barLines(LONG)) expect(line.length).toBeLessThanOrEqual(16)
    expect(barLines('')).toEqual([])
  })
  it('measures the longest unbreakable run; a hyphen is a break', () => {
    expect(longestRun('noordermarkt')).toBe(12)
    expect(longestRun('Vermut in Oud-West')).toBe(6)
    expect(longestRun(['Proper Sunday', 'Roast at'])).toBe(13)
    expect(longestRun('')).toBe(1)
  })
  it('prints a venue as a name, not an address', () => {
    expect(shortPlace('Café Pietertje, Van Limburg Stirumplein 4-6, Amsterdam-West')).toBe('Café Pietertje')
    expect(shortPlace('Centrale Markthal, Jan van Galenstraat 4, Amsterdam-West <st')).toBe('Centrale Markthal')
    expect(shortPlace('Tolhuistuin')).toBe('Tolhuistuin')
    expect(shortPlace('')).toBe('')
  })
})

describe('bars keeps a price whole', () => {
  it('"€3" is not punctuation', () => {
    expect(barLines('Japanese tamago sandos for €3 at the KEWPIE x Chun Café pop-up').join(' / ')).toContain('€3')
    expect(barLines('"Half price": 50% off, 21+ only!').join(' ')).toBe('Half price 50% off 21+ only')
  })
})

describe('which face is on', () => {
  it('is the house face unless asked', () => {
    expect(resolveFace({})).toEqual({ face: 'house', remember: undefined })
    expect(resolveFace({ face: 'nonsense', stored: 'nonsense' }).face).toBe('house')
  })
  it('?face=<name> wears a study face for this load and remembers nothing', () => {
    expect(resolveFace({ face: 'glass-opal' })).toEqual({ face: 'glass-opal', remember: undefined })
    expect(resolveFace({ face: 'glass-smoked', stored: 'glass-opal' }).face).toBe('glass-smoked')
  })
  it('?house=0 puts this device back on glass; ?house=1 forgets that', () => {
    expect(resolveFace({ house: '0' })).toEqual({ face: 'glass-opal', remember: 'glass-opal' })
    expect(resolveFace({ stored: 'glass-opal' })).toEqual({ face: 'glass-opal', remember: undefined })
    expect(resolveFace({ house: '1', stored: 'glass-opal' })).toEqual({ face: 'house', remember: null })
    expect(resolveFace({ house: '0', face: 'house' })).toEqual({ face: 'house', remember: 'glass-opal' })
  })
})
