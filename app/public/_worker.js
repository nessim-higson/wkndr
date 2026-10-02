// THE OBSERVED SKY — a same-origin relay for Schiphol's routine weather report (METAR), so the app can read
// what the airport's observer and instruments actually saw instead of a forecast model's guess at "now"
// (src/lib/current-weather.ts has the story). aviationweather.gov sends no CORS header; this fetches the
// report server-side and caches it for five minutes, so every visitor together costs at most twelve
// upstream calls an hour. Only /api/* reaches this script (_routes.json); every other path is a static
// asset, served as before.
const SOURCE = 'https://aviationweather.gov/api/data/metar?ids=EHAM&format=raw&hours=2'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname !== '/api/metar') return env.ASSETS.fetch(request)
    const cache = caches.default
    const key = new Request(`${url.origin}/api/metar`)
    const hit = await cache.match(key)
    if (hit) return hit
    let body = ''
    try {
      const up = await fetch(SOURCE, { headers: { 'user-agent': 'wkndr.xyz weather relay' } })
      if (up.ok) body = (await up.text()).trim()
    } catch { /* answered below */ }
    const ok = /\bEHAM \d{6}Z\b/.test(body)
    const res = new Response(ok ? body : 'unavailable', {
      status: ok ? 200 : 502,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': ok ? 'public, max-age=300' : 'no-store', 'access-control-allow-origin': '*' },
    })
    if (ok) ctx.waitUntil(cache.put(key, res.clone()))
    return res
  },
}
