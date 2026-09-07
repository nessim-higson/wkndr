import { describe, expect, test } from 'bun:test'
import { fieldModes, motionAllowed, VERB_FRAME_MS } from '../src/weather/looks/verb'
import { weekendFrom } from '../src/weather/modes'

describe('verb field keeps weather and motion contracts', () => {
  test('single-mode rendering preserves every classifier result', () => {
    for (const mode of ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'] as const) expect(fieldModes(mode)).toEqual([mode])
  })
  test('split weekend retains day order and both conditions', () => {
    const weekend = weekendFrom([
      { key: 'sat', label: 'Sat', mode: 'HOT', hi: 28, lo: 18, pop: 5 },
      { key: 'sun', label: 'Sun', mode: 'COLD_WET', hi: 17, lo: 12, pop: 95 },
    ], 'VOLATILE')
    expect(fieldModes('VOLATILE', weekend)).toEqual(['HOT', 'COLD_WET'])
  })
  test('motion requires opt-in and both accessibility and visibility permission', () => {
    expect(motionAllowed(0, false, false)).toBe(false)
    expect(motionAllowed(1, true, false)).toBe(false)
    expect(motionAllowed(1, false, true)).toBe(false)
    expect(motionAllowed(NaN, false, false)).toBe(false)
    expect(motionAllowed(1, false, false)).toBe(true)
    expect(VERB_FRAME_MS).toBeGreaterThanOrEqual(1000 / 30)
  })
})
