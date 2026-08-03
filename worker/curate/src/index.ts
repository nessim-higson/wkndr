// wkndr-curate — the curation-overrides Worker (Track A: auto-compile fast-lane).
//
// Contract (keyed per city; the latest write wins, scoped to the feed's generatedAt so a stale
// override auto-expires when the feed rolls):
//
//   POST /curate/<city>   body: Overrides (JSON)   → stores it, returns { ok: true, at }
//   GET  /curate/<city>                             → returns the stored Overrides, or null
//   POST /drop            body: { url }             → { ok, drop } — a pasted social link, extracted
//
// The app applies these ON TOP of the static picks.<city>.json, mirroring restamp's taste layer:
//   - `pile`   → the opening order (deal these first, in this order)
//   - `killed` → drop these titles from the feed (with the reason, for the audit trail)
//   - `flags`  → soft signals (wrong link / bad image) — surfaced, not dropped
//   - `added`  → THE DROP BOX: picks Ness pasted in from Instagram/TikTok/X that aren't in the
//                static feed at all. Unlike the other three (which re-stamp picks the app already
//                has), these are injected — so the app half had to learn to ADD, not just filter.
// Everything else is title-based (matches the board + restamp's titleLooseMatch). Privacy-light:
// titles, an order, and reasons — no accounts, no personal data. Same posture as the relay.

import { extractDrop, carouselSlides, DropError } from './extract'
import { readRoundup, RoundupError } from './roundup'

export interface Env {
  CURATE: KVNamespace
  /** Optional. Set with `npx wrangler secret put ANTHROPIC_API_KEY`. Absent → /drop/read says so
   *  and everything else keeps working; the drop box itself never needed a key. */
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_VISION_MODEL?: string
}

type Killed = { title: string; reason?: string }
type Flag = { title: string; reason?: string }
/** A pasted pick. Deliberately a thin slice of the app's Pick — the app fills the rest with defaults. */
export type Added = {
  title: string
  link: string
  image?: string
  blurb?: string
  venue?: string
  when?: string
  /** One of the app's 9 categories. Without it every drop lands as "out" — which meant a seeded
   *  deck of 90 roundup picks rendered 90 identical posters and diversify() had nothing to spread. */
  category?: string
  source?: string
}
export interface Overrides {
  generatedAt: string // the feed this override targets — the app ignores it if the feed has rolled past it
  pile?: string[] // opening order (titles)
  killed?: Killed[]
  flags?: Flag[]
  added?: Added[] // pasted picks, injected into the feed
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
  // Pasted picks carry URLs, so they get a stricter screen than the title-only fields: https only,
  // and a cap on how many can ride one round.
  const httpsOnly = (v: unknown): string | undefined => {
    if (typeof v !== 'string' || !v) return undefined
    try {
      const u = new URL(v)
      return u.protocol === 'https:' ? u.toString().slice(0, 600) : undefined
    } catch {
      return undefined
    }
  }
  const str = (v: unknown, max: number): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
  const added = (v: unknown): Added[] =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof (x as { title?: unknown }).title === 'string')
          .slice(0, 50)
          .map((x) => {
            const e = x as Record<string, unknown>
            const link = httpsOnly(e.link)
            if (!link) return null
            return {
              title: String(e.title).slice(0, 200),
              link,
              image: httpsOnly(e.image),
              blurb: str(e.blurb, 400),
              venue: str(e.venue, 120),
              when: str(e.when, 120),
              category: str(e.category, 20),
              source: str(e.source, 60),
            }
          })
          .filter((x): x is Added => x !== null)
      : []

  return {
    generatedAt: o.generatedAt.slice(0, 40),
    pile: titles(o.pile, 200),
    killed: withReason(o.killed, 300),
    flags: withReason(o.flags, 300),
    added: added(o.added),
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })

    const url = new URL(request.url)

    // THE DROP BOX — paste a social link, get a pick back. Stateless: this reads the post and
    // returns it; nothing is stored until the board Submits it as part of `added`.
    if (url.pathname === '/drop' || url.pathname === '/drop/') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin)
      let body: { url?: unknown }
      try {
        body = (await request.json()) as { url?: unknown }
      } catch {
        return json({ error: 'bad json' }, 400, origin)
      }
      if (typeof body.url !== 'string') return json({ error: 'no url' }, 400, origin)
      try {
        const drop = await extractDrop(body.url)
        // Count the slides so the board can offer "read the listings" on a roundup. Best-effort:
        // a failed count just means the button doesn't appear, never a failed drop.
        const slides = await carouselSlides(drop.url)
        return json({ ok: true, drop: { ...drop, slides: slides.length } }, 200, origin)
      } catch (e) {
        // A DropError carries a message written for Ness; anything else is a genuine surprise.
        const known = e instanceof DropError
        return json(
          { error: known ? e.message : 'Could not read that post.', code: known ? e.code : 'unknown' },
          known ? 422 : 502,
          origin,
        )
      }
    }

    // READ THE LISTINGS — vision pass over a roundup carousel, where the events are typeset into
    // the slides and the caption says nothing. Stateless, like /drop.
    if (url.pathname === '/drop/read' || url.pathname === '/drop/read/') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin)
      let body: { url?: unknown }
      try {
        body = (await request.json()) as { url?: unknown }
      } catch {
        return json({ error: 'bad json' }, 400, origin)
      }
      if (typeof body.url !== 'string') return json({ error: 'no url' }, 400, origin)
      if (!env.ANTHROPIC_API_KEY) {
        return json(
          { error: 'The reader is not switched on yet — the server needs an ANTHROPIC_API_KEY.', code: 'no-key' },
          503, origin,
        )
      }
      try {
        const drop = await extractDrop(body.url)
        const slides = await carouselSlides(drop.url)
        if (slides.length < 2) {
          return json({ error: 'That post is a single image — there are no listing slides to read.', code: 'not-carousel' }, 422, origin)
        }
        const read = await readRoundup(slides, env.ANTHROPIC_API_KEY, env.ANTHROPIC_VISION_MODEL)
        return json({ ok: true, source: drop, slides: slides.length, ...read }, 200, origin)
      } catch (e) {
        const known = e instanceof DropError || e instanceof RoundupError
        return json(
          { error: known ? e.message : 'Could not read that post.', code: known ? e.code : 'unknown' },
          known ? 422 : 502, origin,
        )
      }
    }

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
