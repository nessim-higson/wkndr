// WKNDR RELAY — the app's first (and only) backend: a tiny Cloudflare Worker + KV that closes
// the boomerang without a manual link-back. The invite link carries a random round id (`&r=`);
// the recipient's app POSTs their matches here under that id as they swipe; the sender's app
// polls GET until they land and then greets them with the same "it's a match" moment the
// manual `&m=1` link produces. Privacy-light by design: no accounts, no cookies, no IPs stored —
// a round is ONLY short pick-codes + a first name, under an unguessable id, gone in 14 days.
//
// API (all JSON, CORS-open — the id is the secret, not the origin):
//   POST /r/<id>  {codes: string[], name?: string, done?: boolean}
//                 → merges into the stored round (codes union, done is sticky). The first
//                   done:true POST forwards a one-line ping to FORWARD_URL (Formspree → Ness's
//                   inbox: "Sanne matched 4 picks") — set FORWARD_URL = "" to disable.
//   GET  /r/<id>  → {codes, name, done, at} or 404.

const TTL_S = 14 * 86_400          // KV expiry — matches ROUND_TTL_MS in app/src/lib/relay.ts
const MAX_CODES = 60               // a match round is ≤30 cards; 60 is already generous
const MAX_BODY = 4096

export interface StoredRound {
  codes: string[]
  name: string
  done: boolean
  at: number        // last-write ms — the sender uses this to spot an abandoned partial round
  pinged?: boolean  // the one-time email ping already went out
}

interface Env {
  ROUNDS: {
    get(key: string, type: 'json'): Promise<StoredRound | null>
    put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
  }
  FORWARD_URL?: string
}

/** /r/<id> → the id, or null. Same shape the app mints (lib/relay newRoundId) + headroom. */
export function roundIdOf(pathname: string): string | null {
  const m = pathname.match(/^\/r\/([a-z0-9]{6,24})$/)
  return m ? m[1] : null
}

/** Hygiene at the door: codes are short base36 tokens, name is a first name, nothing else. */
export function parseRoundPost(raw: unknown): { codes: string[]; name: string; done: boolean } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.codes)) return null
  const codes = o.codes
    .filter((c): c is string => typeof c === 'string' && /^[a-z0-9]{4,16}$/.test(c))
    .slice(0, MAX_CODES)
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 24) : ''
  return { codes, name, done: o.done === true }
}

/** Cumulative merge — POSTs may land out of order on flaky mobile data, so a round only ever
 *  GROWS: codes union (first-seen order = matched order), done is sticky, latest name wins. */
export function mergeRound(
  prev: StoredRound | null,
  post: { codes: string[]; name: string; done: boolean },
  now: number,
): StoredRound {
  return {
    codes: [...new Set([...(prev?.codes ?? []), ...post.codes])].slice(0, MAX_CODES),
    name: post.name || prev?.name || '',
    done: post.done || !!prev?.done,
    at: now,
    ...(prev?.pinged ? { pinged: true } : {}),
  }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } })

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const id = roundIdOf(new URL(request.url).pathname)
    if (!id) return json({ error: 'not found' }, 404)
    const key = `r:${id}`

    if (request.method === 'GET') {
      const round = await env.ROUNDS.get(key, 'json')
      if (!round) return json({ error: 'not found' }, 404)
      return json({ codes: round.codes, name: round.name, done: round.done, at: round.at })
    }

    if (request.method === 'POST') {
      const text = await request.text()
      if (text.length > MAX_BODY) return json({ error: 'too big' }, 413)
      let raw: unknown
      try { raw = JSON.parse(text) } catch { return json({ error: 'bad json' }, 400) }
      const post = parseRoundPost(raw)
      if (!post) return json({ error: 'bad payload' }, 400)

      const prev = await env.ROUNDS.get(key, 'json')
      const round = mergeRound(prev, post, Date.now())

      // the email ping — once per round, the moment it completes. Fire-and-forget: a Formspree
      // hiccup must never fail the POST (the matches themselves are the payload that matters).
      if (round.done && !round.pinged && env.FORWARD_URL) {
        round.pinged = true
        ctx.waitUntil(fetch(env.FORWARD_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            _subject: 'WKNDR — a match round-trip landed',
            note: `${round.name || 'Someone'} finished a match round: ${round.codes.length} match${round.codes.length === 1 ? '' : 'es'}.`,
            name: round.name || 'anon',
            matched: String(round.codes.length),
            round: id,
          }),
        }).catch(() => {}))
      }

      await env.ROUNDS.put(key, JSON.stringify(round), { expirationTtl: TTL_S })
      return json({ ok: true })
    }

    return json({ error: 'method not allowed' }, 405)
  },
}
