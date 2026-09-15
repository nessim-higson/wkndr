export type Sky = 'clear' | 'night' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm'
export interface CurrentWeather { sky: Sky; temperature: number; time: number; label: string }
export function decodeCurrentWeather(data: unknown, now = Date.now()): CurrentWeather | null {
  const c = (data as { current?: Record<string, unknown> } | null)?.current
  if (!c || typeof c.time !== 'number' || typeof c.temperature_2m !== 'number' || typeof c.weather_code !== 'number' || ![0, 1].includes(c.is_day as number)) return null
  if (![c.time, c.temperature_2m, c.weather_code].every(Number.isFinite)) return null
  const time = c.time * 1000
  if (now - time > 45 * 60_000 || time - now > 5 * 60_000) return null
  const code = c.weather_code
  let sky: Sky
  if ([95,96,99].includes(code)) sky = 'storm'
  else if ([71,73,75,77,85,86].includes(code)) sky = 'snow'
  else if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) sky = 'rain'
  else if ([45,48].includes(code)) sky = 'fog'
  else if ([2,3].includes(code)) sky = 'cloud'
  else if ([0,1].includes(code)) sky = c.is_day ? 'clear' : 'night'
  else return null
  const labels: Record<Sky,string> = {clear:'Clear skies',night:'Clear night',cloud:'Cloudy',fog:'Fog',rain:'Rain',snow:'Snow',storm:'Thunderstorms'}
  return { sky, temperature:c.temperature_2m, time, label:labels[sky] }
}
