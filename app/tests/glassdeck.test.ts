import { describe, it, expect } from 'bun:test'
import { neverTwoGlass } from '../src/weather/glassDeck'

const c = (id: string, image?: string) => ({ id, image })
const ids = (d: { id: string }[]) => d.map((x) => x.id).join(' ')

describe('a glass card only ever sits on a photograph', () => {
  it('never deals two imageless cards in a row while a pictured one remains', () => {
    const deck = [c('a', 'x'), c('g1'), c('g2'), c('g3'), c('b', 'x'), c('c', 'x'), c('g4'), c('d', 'x')]
    const out = neverTwoGlass(deck)
    for (let i = 1; i < out.length; i++) expect(!out[i].image && !out[i - 1].image).toBe(false)
    expect(ids(out)).toBe('a g1 b g2 c g3 d g4')
  })
  it('leaves a deck with no touching glass exactly as it was', () => {
    const deck = [c('a', 'x'), c('g1'), c('b', 'x'), c('c', 'x'), c('g2'), c('d', 'x')]
    expect(ids(neverTwoGlass(deck))).toBe(ids(deck))
  })
  it('is a no-op once the photographs run out, and keeps every card', () => {
    const deck = [c('g1'), c('g2'), c('a', 'x'), c('g3'), c('g4')]
    const out = neverTwoGlass(deck)
    expect(ids(out)).toBe('g1 a g2 g3 g4')
    expect(out.length).toBe(deck.length)
    expect(ids(neverTwoGlass([c('g1'), c('g2')]))).toBe('g1 g2')
  })
})
