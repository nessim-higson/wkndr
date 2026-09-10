import { expect, test } from 'bun:test'
import { glassSignature, titleMark } from '../src/lib/card-material'

test('optical signatures are stable, bounded, and offer all three highlight families', () => {
  const samples = Array.from({ length: 50 }, (_, i) => glassSignature(`event-${i}`))
  expect(new Set(samples.map(s => s.pattern)).size).toBe(3)
  for (let i = 0; i < samples.length; i++) {
    expect(samples[i]).toEqual(glassSignature(`event-${i}`))
    expect(samples[i].angle).toBeGreaterThanOrEqual(118)
    expect(samples[i].angle).toBeLessThanOrEqual(156)
    expect(samples[i].offset).toBeGreaterThanOrEqual(18)
    expect(samples[i].offset).toBeLessThanOrEqual(46)
  }
})

test('pressed mark comes from the title, including the two reference designs', () => {
  expect(titleMark('Museum Market')).toBe('MM')
  expect(titleMark('Nederlands Theater Festival & Amsterdam Fringe Festival')).toBe('&')
  expect(titleMark('  Één podium  ')).toBe('ÉP')
  expect(titleMark('')).toBe('')
})
