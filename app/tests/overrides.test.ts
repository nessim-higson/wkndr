import { test, expect } from 'bun:test'
import { applyOverrides, tokKey, type CurateOverrides } from '../src/lib/overrides'
import type { Pick } from '../src/types'

const p = (title: string, servePos: number): Pick => ({ title, servePos } as unknown as Pick)
const GEN = '2026-07-23T15:13:10.162Z'
const feed = [p('WorldPride Amsterdam', 1), p('Kwaku Summer Festival', 2), p('De Parade', 3), p('Bad Card', 4)]

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

test('pile sets the opening order; the rest follow', () => {
  const ov: CurateOverrides = { generatedAt: GEN, pile: ['De Parade', 'WorldPride Amsterdam'] }
  const out = applyOverrides(feed, ov, GEN).sort((a, b) => (a.servePos! - b.servePos!))
  expect(out.slice(0, 2).map((x) => x.title)).toEqual(['De Parade', 'WorldPride Amsterdam'])
  // the non-pile picks come after, in their original serve order
  expect(out.slice(2).map((x) => x.title)).toEqual(['Kwaku Summer Festival', 'Bad Card'])
})

test('pile matches across a retitle (tokKey is word-order/accent blind)', () => {
  const ov: CurateOverrides = { generatedAt: GEN, pile: ['de parade'] }
  const out = applyOverrides(feed, ov, GEN)
  expect(out.find((x) => x.title === 'De Parade')!.servePos).toBe(1)
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
