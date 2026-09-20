// THE HOURS OF THE WEEKEND — weather/hourly.ts, the contract the time scrubber reads.
import { describe, it, expect } from 'bun:test'
import { decodeHourly, skyForCode, modeForHour, weekendStops, nowStop, WEEKEND_STOPS } from '../src/weather/hourly'

// a synthetic Open-Meteo payload: hourly from Fri 18 Sep 2026 00:00 CEST (UTC+2) for 5 days
const OFF = 7200
const T0 = Date.UTC(2026, 8, 17, 22, 0, 0) / 1000   // Fri 18 Sep 00:00 local
const payload = (n = 120) => ({ utc_offset_seconds: OFF, hourly: {
  time: Array.from({ length: n }, (_, i) => T0 + i * 3600),
  temperature_2m: Array.from({ length: n }, (_, i) => 12 + 8 * Math.sin((i % 24) / 24 * Math.PI)),
  precipitation_probability: Array.from({ length: n }, (_, i) => (i % 24 >= 18 ? 85 : 10)),
  weather_code: Array.from({ length: n }, (_, i) => (i % 24 >= 18 ? 61 : 1)),
} })

describe('decoding', () => {
  it("reads each hour in the CITY's clock, not the browser's", () => {
    const h = decodeHourly(payload())
    expect(h.length).toBe(120)
    expect(h[0].dow).toBe(5); expect(h[0].hour).toBe(0)        // Friday 00:00
    expect(h[30].dow).toBe(6); expect(h[30].hour).toBe(6)      // Saturday 06:00
    expect(decodeHourly(null)).toEqual([]); expect(decodeHourly({ hourly: {} })).toEqual([])
  })
})

describe('the weekend on the track', () => {
  it('is Sat 06:00 → Sun 23:00, 42 stops', () => {
    const s = weekendStops(decodeHourly(payload()), (T0 + 10 * 3600) * 1000)      // asked on the Friday
    expect(s.length).toBe(WEEKEND_STOPS)
    expect(s[0].clock).toBe('Sat 06:00'); expect(s[s.length - 1].clock).toBe('Sun 23:00')
    expect(s.findIndex((x) => x.dow === 0)).toBe(18)                               // Sunday starts 18 stops in
  })
  it('is still THIS weekend on the Sunday, the Saturday included; and gone once Sunday is over', () => {
    const hours = decodeHourly(payload())
    const sundayNoon = (T0 + (48 + 12) * 3600) * 1000
    const s = weekendStops(hours, sundayNoon)
    expect(s[0].clock).toBe('Sat 06:00')
    expect(s[nowStop(s, sundayNoon)].clock).toBe('Sun 12:00')
    expect(weekendStops(hours, (T0 + 73 * 3600) * 1000)).toEqual([])              // Monday 01:00: no next weekend in this payload
    expect(nowStop(s, (T0 + 5 * 3600) * 1000)).toBe(-1)
  })
})

describe('what a stop paints and how it ranks', () => {
  it('maps the code to the scene the live reading would', () => {
    expect(skyForCode(61).scene).toBe('rain'); expect(skyForCode(95).scene).toBe('storm')
    expect(skyForCode(73).scene).toBe('snow'); expect(skyForCode(45).scene).toBe('mist')
    expect(skyForCode(3).scene).toBe('overcast'); expect(skyForCode(0).scene).toBe('sunny')
    expect(skyForCode(2, 10).scene).toBe('sunny'); expect(skyForCode(2, 50).scene).toBe('mixed')
  })
  it('ranks a wet evening as rain and a dry mild afternoon as warm', () => {
    expect(modeForHour({ temp: 17, pop: 85 })).toBe('COLD_WET')
    expect(modeForHour({ temp: 19, pop: 10 })).toBe('WARM')
    expect(modeForHour({ temp: 27, pop: 5 })).toBe('HOT')
    expect(modeForHour({ temp: 12, pop: 20 })).toBe('COOL')
    const s = weekendStops(decodeHourly(payload()), (T0 + 10 * 3600) * 1000)
    expect(s.find((x) => x.clock === 'Sat 20:00')!.mode).toBe('COLD_WET')
    expect(s.find((x) => x.clock === 'Sat 20:00')!.scene).toBe('rain')
  })
})
