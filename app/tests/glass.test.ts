import { describe, expect, test } from 'bun:test'
import { glassScene, glassSummary } from '../src/weather/glass'
import { weekendFrom } from '../src/weather/modes'

describe('Glass reads the daily forecast, not imagined conditions', () => {
  test('decisive precipitation wins over a warm cached mode', () => {
    expect(glassScene('WARM', 95)).toBe('rain')
  })
  test('cold but dry does not paint rain', () => {
    expect(glassScene('COLD_WET', 5)).toBe('overcast')
    expect(glassSummary('COLD_WET', null, true, 5)).toBe('A cooler weekend. Bring a layer.')
  })
  test('mixed weather is distinct; fog, snow and evening are never inferred', () => {
    expect(glassScene('VOLATILE', 55)).toBe('mixed')
    expect(glassScene('COOL', 10)).toBe('overcast')
    expect(glassScene('HOT', 5)).toBe('sunny')
  })
  test('unavailable forecast does not present cached or demo figures as current', () => {
    expect(glassSummary('COLD_WET', null, false, 100)).toBe('Waiting for the weekend forecast.')
  })
  test('a split weekend retains each day’s rain chance', () => {
    const wx = weekendFrom([
      { key: 'sat', label: 'Sat', hi: 25, lo: 16, pop: 10, mode: 'HOT' },
      { key: 'sun', label: 'Sun', hi: 16, lo: 12, pop: 90, mode: 'COLD_WET' },
    ], 'VOLATILE')
    expect(glassSummary(wx.mode, wx, true, 90)).toBe('Sat 25° · 10% rain chance / Sun 16° · 90% rain chance')
  })
})
