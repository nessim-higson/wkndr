import { test, expect } from 'bun:test'
import { applyOverrides, tokKey, type CurateOverrides } from '../src/lib/overrides'
import type { Pick } from '../src/types'

const p = (title: string, servePos: number): Pick => ({ title, servePos } as unknown as Pick)
const GEN = '2026-07-23T15:13:10.162Z'
const feed = [p('WorldPride Amsterdam', 1), p('Kwaku Summer Festival', 2), p('De Parade', 3), p('Bad Card', 4)]
const pp = (x: Pick) => (x as unknown as { pilePos?: number }).pilePos

test('null override → feed untouched', () => {
  expect(applyOverrides(feed, null, GEN)).toEqual(feed)
})

test('stale override (feed rolled past its generatedAt) → untouched', () => {
  const ov: CurateOverrides = { generatedAt: 'OLD', pile: ['De Parade'] }
  expect(applyOverrides(feed, ov, GEN)).toEqual(feed)
})

test('killed titles are dropped', () => {
  const ov: CurateOverrides = { generatedAt: GEN, killed: [{ title: 'Bad Card', reason: 'link' }] }
  const out = applyOverrides(feed, ov, GEN)
  expect(out.map((x) => x.title)).not.toContain('Bad Card')
  expect(out.length).toBe(3)
})

test('pile sets pilePos (the app\'s hand-order); non-pile picks clear', () => {
  const ov: CurateOverrides = { generatedAt: GEN, pile: ['De Parade', 'WorldPride Amsterdam'] }
  const out = applyOverrides(feed, ov, GEN)
  expect(pp(out.find((x) => x.title === 'De Parade')!)).toBe(1)
  expect(pp(out.find((x) => x.title === 'WorldPride Amsterdam')!)).toBe(2)
  // non-pile picks have pilePos cleared so a prior restamp can't linger → they fall to auto-rank
  expect(pp(out.find((x) => x.title === 'Kwaku Summer Festival')!)).toBeUndefined()
})

test('pile matches across a retitle (tokKey is word-order/accent blind)', () => {
  const ov: CurateOverrides = { generatedAt: GEN, pile: ['de parade'] }
  const out = applyOverrides(feed, ov, GEN)
  expect(pp(out.find((x) => x.title === 'De Parade')!)).toBe(1)
})

test('flags attach without dropping', () => {
  const ov: CurateOverrides = { generatedAt: GEN, flags: [{ title: 'Kwaku Summer Festival', reason: 'wrong link' }] }
  const out = applyOverrides(feed, ov, GEN)
  const kwaku = out.find((x) => x.title === 'Kwaku Summer Festival') as unknown as { _flag?: string }
  expect(kwaku._flag).toBe('wrong link')
  expect(out.length).toBe(4)
})

test('tokKey ignores stopwords, accents, years', () => {
  expect(tokKey('Ekō – Japan in twee beeldverhalen 2026')).toBe(tokKey('japan twee beeldverhalen eko'))
})
