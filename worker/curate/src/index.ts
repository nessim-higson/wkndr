// wkndr-curate — the curation-overrides Worker (Track A: auto-compile fast-lane).
//
// Contract (keyed per city; the latest write wins, scoped to the feed's generatedAt so a stale
// override auto-expires when the feed rolls):
//
//   POST /curate/<city>   body: Overrides (JSON)   → stores it, returns { ok: true, at }
//   GET  /curate/<city>                             → returns the stored Overrides, or null
//
// The app applies these ON TOP of the static picks.<city>.json, mirroring restamp's taste layer:
//   - `pile`   → the opening order (deal these first, in this order)
//   - `killed` → drop these titles from the feed (with the reason, for the audit trail)
//   - `flags`  → soft signals (wrong link / bad image) — surfaced, not dropped
// Everything is title-based (matches the board + restamp's titleLooseMatch). Privacy-light: titles,
// an order, and reasons — no accounts, no personal data. Same posture as the relay.

export interface Env {
  CURATE: KVNamespace
}

type Killed = { title: string; reason?: string }
type Flag = { title: string; reason?: string }
export interface Overrides {
  generatedAt: string // the feed this override targets — the app ignores it if the feed has rolled past it
  pile?: string[] // opening order (titles)
  killed?: Killed[]
  flags?: Flag[]
  at?: number // server stamp (set here, not trusted from the client)
}

const CITY_RE = /^[a-z][a-z0-9-]{1,31}$/
const TTL_SECONDS = 45 * 24 * 60 * 60 // 45 days — a feed rolls weekly, so this is generous slack
const MAX_BYTES = 128 * 1024 // a full board round is a few KB; cap to keep a bad client from bloating KV

const cors = (origin: string | null): Record<string, string> => ({
  // the board + app are same-project (app.wkndr.xyz) and the GH-Pages mirror; allow both, plus local dev.
  'Access-Control-Allow-Origin':
    origin && /^(https:\/\/([a-z0-9-]+\.)*wkndr\.xyz|https:\/\/nessim-higson\.github\.io|http:\/\/localhost:\d+)$/.test(origin)
      ? origin
      : 'https://app.wkndr.xyz',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
})

const json = (body: unknown, status: number, origin: string | null): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  })

function sanitize(raw: unknown): Overrides | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.generatedAt !== 'string' || !o.generatedAt) return null
  const titles = (v: unknown, max: number): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length <= 200).slice(0, max) : []
  const withReason = (v: unknown, max: number): Killed[] =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof (x as { title?: unknown }).title === 'string')
          .slice(0, max)
          .map((x) => {
            const e = x as { title: string; reason?: unknown }
            return { title: e.title.slice(0, 200), ...(typeof e.reason === 'string' ? { reason: e.reason.slice(0, 40) } : {}) }
          })
      : []
  return {
    generatedAt: o.generatedAt.slice(0, 40),
    pile: titles(o.pile, 200),
    killed: withReason(o.killed, 300),
    flags: withReason(o.flags, 300),
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })

    const url = new URL(request.url)
    const m = url.pathname.match(/^\/curate\/([^/]+)\/?$/)
    if (!m) return json({ error: 'not found' }, 404, origin)
    const city = decodeURIComponent(m[1]).toLowerCase()
    if (!CITY_RE.test(city)) return json({ error: 'bad city' }, 400, origin)
    const key = `curate:${city}`

    if (request.method === 'GET') {
      const stored = await env.CURATE.get(key)
      return json(stored ? JSON.parse(stored) : null, 200, origin)
    }

    if (request.method === 'POST') {
      const len = Number(request.headers.get('Content-Length') || 0)
      if (len > MAX_BYTES) return json({ error: 'too large' }, 413, origin)
      let raw: unknown
      try {
        raw = await request.json()
      } catch {
        return json({ error: 'bad json' }, 400, origin)
      }
      const clean = sanitize(raw)
      if (!clean) return json({ error: 'bad payload' }, 400, origin)
      clean.at = Date.now()
      await env.CURATE.put(key, JSON.stringify(clean), { expirationTtl: TTL_SECONDS })
      return json({ ok: true, at: clean.at }, 200, origin)
    }

    return json({ error: 'method not allowed' }, 405, origin)
  },
}
