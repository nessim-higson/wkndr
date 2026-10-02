import { describe, expect, test } from 'bun:test'
import { decodeCurrentWeather, decodeModel, fuseSky, latestSunHour, modelGrey, parseMetar, sunClass, type Metar, type ModelNow, type SunHour } from '../src/lib/current-weather'
const now = Date.UTC(2026,8,10,12)
const payload = (code:number, day=1, age=0) => ({current:{time:(now-age)/1000,temperature_2m:19,weather_code:code,is_day:day}})
test('current sky follows the reported code, including warm rain and nighttime',()=>{
  for (const [code,sky] of [[0,'clear'],[3,'cloud'],[45,'fog'],[61,'rain'],[85,'snow'],[95,'storm']] as const) expect(decodeCurrentWeather(payload(code),now)?.sky).toBe(sky)
  expect(decodeCurrentWeather(payload(0,0),now)?.sky).toBe('night')
  expect(decodeCurrentWeather(payload(61,0),now)?.sky).toBe('rain')
})
test('stale, future, malformed and unknown readings cannot claim current weather',()=>{
  for (const data of [null,{},payload(100),payload(0,1,46*60_000),payload(0,1,-6*60_000),{current:{time:null,weather_code:0,is_day:1,temperature_2m:20}}]) expect(decodeCurrentWeather(data,now)).toBeNull()
  expect(decodeCurrentWeather(payload(61,1,44*60_000),now)?.sky).toBe('rain')
})

// ─── THE OBSERVED SKY (2026-10-02) ────────────────────────────────────────────
// Ness, under a blue sky: "Why is this returning a cloudy sky?" The moment itself is the fixture: 17:14 CEST,
// the forecast model saying code 3 with 87% low cloud, Schiphol reporting FEW029, the satellite measuring
// 349.5 W/m² (251 of it direct) under 515 at the top of the atmosphere.
const AT = Date.UTC(2026, 9, 2, 15, 14)
const REPORT = 'METAR EHAM 021455Z 22006KT 180V250 9999 FEW029 20/12 Q1031 NOSIG\nMETAR EHAM 021425Z 19005KT 160V220 9999 FEW028 20/10 Q1031 NOSIG'
const model = (o: Partial<ModelNow> = {}): ModelNow => ({ time: AT - 14 * 60_000, temperature: 20.4, code: 3, isDay: true, low: 87, mid: 0, ...o })
const metar = (o: Partial<Metar> = {}): Metar => ({ station: 'EHAM', time: AT - 19 * 60_000, cover: 1, wx: null, raw: '', ...o })
const sun = (cls: SunHour['cls']): SunHour => ({ time: Date.UTC(2026, 9, 2, 15), cls })

describe("Schiphol's report", () => {
  const at = (line: string) => parseMetar(line, AT)
  test('the newest line of the official block, and the bare form a mirror serves', () => {
    const m = parseMetar(REPORT, AT)!
    expect(m.station).toBe('EHAM')
    expect(m.time).toBe(Date.UTC(2026, 9, 2, 14, 55))
    expect(m.cover).toBe(1)
    expect(m.wx).toBeNull()
    expect(at('EHAM 021455Z 22006KT 180V250 9999 FEW029 20/12 Q1031 NOSIG')?.cover).toBe(1)
  })
  test('the heaviest layer wins; no significant cloud is none', () => {
    expect(at('EHAM 021455Z 24012KT 9999 FEW012 SCT025 BKN040 12/09 Q1002')?.cover).toBe(3)
    expect(at('EHAM 021455Z 24012KT 6000 SCT008 OVC015 12/11 Q1002')?.cover).toBe(4)
    expect(at('EHAM 021455Z 24012KT 9999 FEW020CB 12/11 Q1002')?.cover).toBe(1)
    for (const none of ['CAVOK', '9999 NSC', '9999 NCD']) expect(at(`EHAM 021455Z 18007KT ${none} 14/12 Q1016 NOSIG`)?.cover).toBe(0)
  })
  test('weather is what is falling AT the station, now', () => {
    expect(at('EHAM 021455Z 24012KT 6000 -RA BKN008 12/11 Q1002')?.wx).toBe('rain')
    expect(at('EHAM 021455Z 24012KT 4000 SHRA BKN012 12/11 Q1002')?.wx).toBe('rain')
    expect(at('EHAM 021455Z 24012KT 3000 +TSRA BKN012CB 12/11 Q1002')?.wx).toBe('storm')
    expect(at('EHAM 021455Z 05008KT 2000 -SN OVC006 M01/M02 Q1002')?.wx).toBe('snow')
    expect(at('EHAM 021455Z 00000KT 0200 FG VV001 04/04 Q1022')).toMatchObject({ wx: 'fog', cover: 4 })
  })
  test('not the trend, not the vicinity, not what has stopped, not a patch of fog', () => {
    expect(at('EHAM 021455Z 22006KT 9999 FEW029 20/12 Q1031 TEMPO 4000 SHRA BKN012')).toMatchObject({ wx: null, cover: 1 })
    expect(at('EHAM 021455Z 22006KT 9999 FEW029 20/12 Q1031 BECMG 3000 RA OVC008')).toMatchObject({ wx: null, cover: 1 })
    expect(at('EHAM 021455Z 22006KT 9999 VCSH SCT030 14/10 Q1012 RERA')).toMatchObject({ wx: null, cover: 2 })
    for (const patch of ['MIFG', 'BCFG', 'PRFG', 'BR', 'HZ']) expect(at(`EHAM 021455Z 00000KT 5000 ${patch} NSC 04/04 Q1022`)?.wx).toBeNull()
  })
  test('a report older than 75 minutes, or anything that is not a report, is no observation', () => {
    expect(parseMetar(REPORT, AT + 60 * 60_000)).toBeNull()
    expect(parseMetar(REPORT, AT + 20 * 60_000)?.cover).toBe(1)
    for (const junk of ['<!doctype html><html><head><title>WKNDR</title>', 'unavailable', '', 'EHAM']) expect(parseMetar(junk, AT)).toBeNull()
  })
  test('a report from the last day of the month, read on the first', () => {
    expect(parseMetar('EHAM 302355Z 18007KT CAVOK 14/12 Q1016', Date.UTC(2026, 9, 1, 0, 10))?.time).toBe(Date.UTC(2026, 8, 30, 23, 55))
  })
})

describe('the sun, measured', () => {
  test('strong direct sun, dim diffuse light, and the in-between', () => {
    expect(sunClass(349.5, 251, 515)).toBe('sunny')        // that afternoon, 16:00–17:00
    expect(sunClass(100, 5, 500)).toBe('overcast')
    expect(sunClass(260, 20, 520)).toBe('overcast')        // bright, but no disc of the sun: a milky deck
    expect(sunClass(305, 123, 518)).toBe('mixed')          // that morning, under high cloud
  })
  test('a low sun: the sunny line is lower, and below about 13° the reading is not trusted at all', () => {
    expect(sunClass(197, 98.3, 342.7)).toBe('sunny')       // that evening, 17:00–18:00, under FEW030
    expect(sunClass(265, 130, 449)).toBe('sunny')          // a cloudless September morning: 0.59 and 0.49
    expect(sunClass(55, 0, 284.5)).toBeNull()              // a clear dusk the satellite measured as no sun at all
    expect(sunClass(82, 16, 190)).toBeNull()               // CAVOK, measured direct share 0.2
    expect(sunClass(60, 40, 120)).toBeNull()
    expect(sunClass(100, 4, 400)).toBe('overcast')         // a grey late afternoon is still grey
  })
  const hourly = (rows: [number, number | null, number | null, number][]) => ({ hourly: { time: rows.map((r) => r[0] / 1000), shortwave_radiation: rows.map((r) => r[1]), direct_radiation: rows.map((r) => r[2]), terrestrial_radiation: rows.map((r) => r[3]) } })
  const H = (h: number) => Date.UTC(2026, 9, 2, h)
  test('the last COMPLETE hour, not the empty rows ahead of it', () => {
    const d = hourly([[H(13), 446, 301, 647], [H(14), 446.2, 301.5, 647.5], [H(15), 349.5, 251, 515], [H(16), null, null, 342]])
    expect(latestSunHour(d, AT)).toEqual({ time: H(15), cls: 'sunny' })
  })
  test('older than 2h10 it describes another sky; a low sun or no data is no reading', () => {
    expect(latestSunHour(hourly([[H(12), 400, 210, 650], [H(13), null, null, 700]]), AT)).toBeNull()
    expect(latestSunHour(hourly([[H(15), 40, 10, 90]]), AT)).toBeNull()
    for (const junk of [null, {}, { hourly: {} }, { hourly: { time: 'x' } }]) expect(latestSunHour(junk, AT)).toBeNull()
  })
})

describe('one reading from the forecast, the report and the sun', () => {
  test('THAT AFTERNOON: the model says overcast, Schiphol says a few clouds, the satellite says sun', () => {
    const r = fuseSky(model(), parseMetar(REPORT, AT), latestSunHour({ hourly: { time: [Date.UTC(2026, 9, 2, 15) / 1000], shortwave_radiation: [349.5], direct_radiation: [251], terrestrial_radiation: [515] } }, AT))
    expect(r.sky).toBe('clear')
    expect(r.label).toBe('Sunny')
    expect(r.basis).toBe('observed')
    expect(r.note).toBe('Observed: Schiphol 16:55 · satellite sunshine to 17:00')
    expect(decodeCurrentWeather({ current: { time: model().time / 1000, temperature_2m: 20.4, weather_code: 3, is_day: 1, cloud_cover_low: 87, cloud_cover_mid: 0 } }, AT)?.sky).toBe('cloud')   // what the forecast alone would have shown
  })
  test('broken or overcast low cloud at Schiphol is a grey sky, whatever the forecast hoped', () => {
    expect(fuseSky(model({ code: 0, low: 0 }), metar({ cover: 3 }), sun('sunny')).sky).toBe('cloud')
    expect(fuseSky(model({ code: 0, low: 0 }), metar({ cover: 4 }), null).label).toBe('Cloudy')
  })
  test('a deck the airport cannot see: no low cloud, but the sun is not getting through', () => {
    expect(fuseSky(model({ code: 1, low: 0 }), metar({ cover: 0 }), sun('overcast')).sky).toBe('cloud')
  })
  test('an in-between hour is the only time the forecast is asked — and about its low and mid layers', () => {
    expect(fuseSky(model({ code: 3, low: 80, mid: 0 }), metar({ cover: 2 }), sun('mixed')).sky).toBe('cloud')
    expect(fuseSky(model({ code: 3, low: 5, mid: 10 }), metar({ cover: 0 }), sun('mixed'))).toMatchObject({ sky: 'clear', label: 'Partly cloudy' })   // high cloud only
    expect(fuseSky(model({ code: 2, low: 60 }), metar({ cover: 1 }), sun('mixed')).sky).toBe('clear')
  })
  test('rain is the observer’s call when there is a report; the forecast’s only when there is none', () => {
    expect(fuseSky(model({ code: 61 }), metar({ cover: 2 }), sun('mixed')).sky).not.toBe('rain')
    expect(fuseSky(model({ code: 0 }), metar({ wx: 'rain', cover: 3 }), null)).toMatchObject({ sky: 'rain', label: 'Rain', basis: 'observed' })
    expect(fuseSky(model({ code: 61 }), null, null)).toMatchObject({ sky: 'rain', basis: 'forecast', note: 'Forecast estimate' })
    expect(fuseSky(model({ code: 95 }), null, sun('sunny')).sky).toBe('storm')
  })
  test('at night the sun has nothing to say: the report first, then the forecast’s layers', () => {
    const night = { isDay: false }
    expect(fuseSky(model({ ...night, code: 1, low: 0 }), metar({ cover: 0 }), null)).toMatchObject({ sky: 'night', label: 'Clear night' })
    expect(fuseSky(model({ ...night, code: 1, low: 0 }), metar({ cover: 2 }), null)).toMatchObject({ sky: 'night', label: 'Partly cloudy' })
    expect(fuseSky(model({ ...night, code: 0 }), metar({ cover: 3 }), null).sky).toBe('cloud')
    expect(fuseSky(model({ ...night, code: 3, low: 90 }), metar({ cover: 1 }), null).sky).toBe('cloud')
    expect(fuseSky(model({ ...night, code: 3, low: 0, mid: 20 }), metar({ cover: 1 }), null).sky).toBe('night')
  })
  test('the forecast alone: code 3 needs a real deck behind it once the layers are known', () => {
    expect(modelGrey(model({ code: 3, low: 87 }))).toBe(true)
    expect(modelGrey(model({ code: 3, low: 0, mid: 0 }))).toBe(false)          // total cover was all high cloud
    expect(modelGrey(model({ code: 3, low: null, mid: null }))).toBe(true)     // layers unknown: the code stands
    expect(modelGrey(model({ code: 2, low: 90 }))).toBe(false)
    expect(fuseSky(model({ code: 3, low: 0, mid: 0 }), null, null)).toMatchObject({ sky: 'clear', label: 'Partly cloudy', basis: 'forecast' })
    expect(fuseSky(model({ code: 0, low: 0 }), null, null).label).toBe('Clear skies')
  })
  test('the model payload carries its layers when asked for them', () => {
    expect(decodeModel({ current: { time: AT / 1000, temperature_2m: 20.4, weather_code: 3, is_day: 1, cloud_cover_low: 87, cloud_cover_mid: 0 } }, AT)).toMatchObject({ code: 3, isDay: true, low: 87, mid: 0 })
    expect(decodeModel({ current: { time: AT / 1000, temperature_2m: 20.4, weather_code: 3, is_day: 1 } }, AT)).toMatchObject({ low: null, mid: null })
  })
})
