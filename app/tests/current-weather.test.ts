import { expect, test } from 'bun:test'
import { decodeCurrentWeather } from '../src/lib/current-weather'
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
