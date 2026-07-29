// WKNDR LIST — the Friday brief's subscriber store. A second tiny Cloudflare Worker + KV,
// deliberately SEPARATE from the relay: the relay's published privacy claim is "no PII, 14-day
// TTL, gone by itself", and an email list is the exact opposite of that (real PII, kept until
// the person leaves). Two workers, two honest stories, one KV namespace each.
//
// Double opt-in is not optional here. The audience is Amsterdam — GDPR applies — and a
// confirmed list is also the single biggest lever on whether Gmail puts the Friday brief in the
// inbox or the promotions bin. A signup is NOT a subscriber until they click the link.
//
// API (JSON; CORS locked to the wkndr.xyz surfaces — unlike the relay, the payload IS the secret):
//   POST /sub          {email, src?, hp?}  → mints a pending record + mails a confirm link.
//                                            `hp` is the honeypot: filled = silently accepted, never stored.
//   GET  /confirm/<t>  → flips pending → active. Returns an HTML thank-you in WKNDR paper/orange.
//   GET  /unsub/<t>    → flips active → unsubscribed (record kept, so a re-sub can't resurrect
//                        someone who left). Returns an HTML page. One click, no login, no "are you sure".
//   GET  /export       → active addresses for the Friday send script. Header: `authorization: Bearer <ADMIN_KEY>`.
//   GET  /stats        → {pending, active, unsub} counts. Same auth. The opt-in experiment's scoreboard.

const CONFIRM_TTL_S = 7 * 86_400   // an unclicked confirm link expires; the pending record is swept with it
const MAX_BODY = 2048
const EXPORT_PAGE = 1000           // KV list page size — the list is small; this is headroom, not a cap

export type SubStatus = 'pending' | 'active' | 'unsub'

export interface SubRecord {
  email: string
  status: SubStatus
  src: string        // where they signed up: 'landing' | 'app' | 'sticker' … — tells us what actually works
  at: number         // first seen
  confirmedAt?: number
  unsubAt?: number
  unsubToken: string // minted at signup so every send can carry a working one-click link
}

interface Env {
  SUBS: {
    get(key: string, type: 'json'): Promise<unknown>
    get(key: string, type: 'text'): Promise<string | null>
    put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
    delete(key: string): Promise<void>
    list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{
      keys: { name: string }[]
      list_complete: boolean
      cursor?: string
    }>
  }
  ADMIN_KEY: string
  MAIL_PROVIDER?: string   // 'resend' (default) | 'none' — 'none' logs instead of sending, for local dev
  MAIL_API_KEY?: string
  MAIL_FROM?: string       // e.g. 'WKNDR <friday@wkndr.xyz>'
  SITE_ORIGIN?: string     // e.g. 'https://wkndr.xyz' — used to build confirm/unsub links
}

/* ─────────────────────────── pure logic (unit-testable, no I/O) ─────────────────────────── */

/** Deliberately boring validation. Anything clever here rejects real addresses; the confirm
 *  click is the actual proof the mailbox exists, so this only needs to catch obvious junk. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (email.length < 6 || email.length > 254) return null
  if (!/^[^\s@,;:<>()[\]\\]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return null
  return email
}

/** Signup source, clamped. Free text from a public endpoint never reaches KV unbounded. */
export function normalizeSrc(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown'
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
  return s || 'unknown'
}

/** The honeypot is a form field no human sees. A bot fills every input it finds, so any value
 *  here means "not a person" — we return 200 anyway, because telling a bot it failed teaches it. */
export function isBot(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().length > 0
}

/** Unguessable, URL-safe, no dependencies. Same shape as the relay's round ids. */
export function newToken(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('')
}

export function tokenOf(pathname: string, prefix: 'confirm' | 'unsub'): string | null {
  const m = pathname.match(new RegExp(`^/${prefix}/([a-f0-9]{32})$`))
  return m ? m[1] : null
}

/** The KV key for an address. Hashing means `list()`-ing keys for a count never spills the
 *  addresses themselves; the record still holds the plaintext, because we have to mail it. */
export async function emailKey(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email))
  return 'e:' + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')
}

/** Re-subscribing is idempotent and NEVER resurrects someone who left. A pending record just
 *  gets a fresh confirm link (the first mail may have been lost); an active one is a no-op;
 *  an unsubscribed one stays unsubscribed — coming back is a decision they make in their client,
 *  not one a form re-submit makes for them. */
export function subDecision(prev: SubRecord | null): 'create' | 'resend' | 'noop' | 'blocked' {
  if (!prev) return 'create'
  if (prev.status === 'pending') return 'resend'
  if (prev.status === 'active') return 'noop'
  return 'blocked'
}

/* ─────────────────────────────────── mail adapter ─────────────────────────────────── */

/** One seam, one provider today. Swapping Resend for anything else is this function and the
 *  three MAIL_* vars — nothing above or below it knows who sends the mail. */
async function sendMail(
  env: Env,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const provider = env.MAIL_PROVIDER || 'resend'
  if (provider === 'none') {
    console.log(`[mail:none] would send to ${to} — ${subject}`)
    return true
  }
  if (!env.MAIL_API_KEY || !env.MAIL_FROM) {
    console.error('[mail] MAIL_API_KEY / MAIL_FROM not set — cannot send')
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.MAIL_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, html, text }),
  })
  if (!res.ok) console.error(`[mail] send failed ${res.status}: ${await res.text().catch(() => '')}`)
  return res.ok
}

/* ─────────────────────────────────── copy + chrome ─────────────────────────────────── */

const PAPER = '#faf8f3', INK = '#1a1a1a', INK3 = '#8b8a82', ACCENT = '#ff4d1f'

/** Confirm mail. Plain, short, one link — the fewer images and the less markup, the better this
 *  lands in an inbox. The voice is the landing page's, not a template's. */
function confirmMail(link: string) {
  const subject = 'Confirm your WKNDR Friday brief'
  const text = `One click and you're in.\n\nEvery Friday morning: a handful of Amsterdam picks for the weekend ahead, chosen against the forecast.\n\nConfirm: ${link}\n\nIf you didn't ask for this, ignore it — nothing happens without the click.`
  const html = `<!doctype html><html><body style="margin:0;padding:32px 20px;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:${INK}">
<div style="max-width:440px;margin:0 auto">
  <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${INK3}">WKNDR</div>
  <h1 style="font-size:26px;font-weight:600;line-height:1.25;margin:22px 0 14px">One click and you're in.</h1>
  <p style="font-size:15px;line-height:1.6;color:${INK};margin:0 0 26px">Every Friday morning: a handful of Amsterdam picks for the weekend ahead, chosen against the forecast.</p>
  <a href="${link}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;border-radius:999px;padding:13px 26px;font-size:15px">Confirm my email</a>
  <p style="font-size:13px;line-height:1.6;color:${INK3};margin:30px 0 0">If you didn't ask for this, ignore it — nothing happens without the click.</p>
</div></body></html>`
  return { subject, text, html }
}

/** Confirm/unsub landing pages. Self-contained, no fonts to fetch, back to the site in one tap. */
function page(title: string, body: string, origin: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · WKNDR</title>
<meta name="robots" content="noindex"></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:${INK};padding:24px">
<div style="max-width:420px;text-align:center">
  <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${INK3};margin-bottom:26px">WKNDR</div>
  ${body}
  <a href="${origin}" style="display:inline-block;margin-top:28px;font-size:13px;color:${INK3};text-decoration:none;border-bottom:.5px solid currentColor;padding-bottom:1px">wkndr.xyz</a>
</div></body></html>`
  return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } })
}

/* ─────────────────────────────────── the worker ─────────────────────────────────── */

const ALLOWED_ORIGINS = ['https://wkndr.xyz', 'https://www.wkndr.xyz', 'https://app.wkndr.xyz', 'https://nessim-higson.github.io']

function corsFor(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || ''
  const ok = ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost')
  return {
    'access-control-allow-origin': ok ? origin : ALLOWED_ORIGINS[0],
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    vary: 'origin',
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const cors = corsFor(request)
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    const origin = env.SITE_ORIGIN || 'https://wkndr.xyz'
    const path = url.pathname

    /* ── POST /sub ── */
    if (request.method === 'POST' && path === '/sub') {
      const raw = await request.text()
      if (raw.length > MAX_BODY) return json({ error: 'too big' }, 413)
      let body: Record<string, unknown>
      try { body = JSON.parse(raw) } catch { return json({ error: 'bad json' }, 400) }

      // A bot gets the same 200 a human gets. Never store, never mail.
      if (isBot(body.hp)) return json({ ok: true })

      const email = normalizeEmail(body.email)
      if (!email) return json({ error: 'bad email' }, 400)

      const key = await emailKey(email)
      const prev = (await env.SUBS.get(key, 'json')) as SubRecord | null
      const decision = subDecision(prev)

      // Every outcome answers identically. A public endpoint that says "already subscribed"
      // is an address-enumeration oracle — it lets anyone test whether you're on this list.
      if (decision === 'noop' || decision === 'blocked') return json({ ok: true })

      const record: SubRecord = prev ?? {
        email,
        status: 'pending',
        src: normalizeSrc(body.src),
        at: Date.now(),
        unsubToken: newToken(),
      }
      const confirmToken = newToken()
      await env.SUBS.put(key, JSON.stringify(record))
      await env.SUBS.put(`c:${confirmToken}`, key, { expirationTtl: CONFIRM_TTL_S })
      await env.SUBS.put(`u:${record.unsubToken}`, key)

      const mail = confirmMail(`${url.origin}/confirm/${confirmToken}`)
      ctx.waitUntil(sendMail(env, email, mail.subject, mail.html, mail.text).catch(() => false))
      return json({ ok: true })
    }

    /* ── GET /confirm/<token> ── */
    const confirmToken = tokenOf(path, 'confirm')
    if (request.method === 'GET' && confirmToken) {
      // The pointer records (c:/u:) hold a bare KV key, not JSON — read them as text.
      const rawKey = await env.SUBS.get(`c:${confirmToken}`, 'text')
      if (!rawKey) {
        return page('Link expired', `<h1 style="font-size:24px;font-weight:600;line-height:1.3;margin:0 0 12px">That link has expired.</h1>
          <p style="font-size:15px;line-height:1.6;color:${INK3};margin:0">Confirm links last a week. Sign up again and we'll send a fresh one.</p>`, origin)
      }
      const rec = (await env.SUBS.get(rawKey, 'json')) as SubRecord | null
      if (!rec) return page('Link expired', `<h1 style="font-size:24px;font-weight:600;margin:0">That link has expired.</h1>`, origin)

      if (rec.status === 'pending') {
        rec.status = 'active'
        rec.confirmedAt = Date.now()
        await env.SUBS.put(rawKey, JSON.stringify(rec))
      }
      await env.SUBS.delete(`c:${confirmToken}`)   // one-time use
      return page('You\'re in', `<h1 style="font-size:26px;font-weight:600;line-height:1.25;margin:0 0 14px">You're in.</h1>
        <p style="font-size:15px;line-height:1.6;color:${INK3};margin:0">Next Friday morning, a handful of Amsterdam picks for the weekend ahead — chosen against the forecast.</p>`, origin)
    }

    /* ── GET /unsub/<token> ── */
    const unsubToken = tokenOf(path, 'unsub')
    if (request.method === 'GET' && unsubToken) {
      const rawKey = await env.SUBS.get(`u:${unsubToken}`, 'text')
      if (rawKey) {
        const rec = (await env.SUBS.get(rawKey, 'json')) as SubRecord | null
        if (rec && rec.status !== 'unsub') {
          rec.status = 'unsub'
          rec.unsubAt = Date.now()
          await env.SUBS.put(rawKey, JSON.stringify(rec))
        }
      }
      // Always the same page — an invalid token must not reveal that it's invalid.
      return page('Unsubscribed', `<h1 style="font-size:26px;font-weight:600;line-height:1.25;margin:0 0 14px">Done — no more Friday briefs.</h1>
        <p style="font-size:15px;line-height:1.6;color:${INK3};margin:0">No hard feelings. The app is always there when a weekend needs a plan.</p>`, origin)
    }

    /* ── GET /export + /stats (admin) ── */
    if (request.method === 'GET' && (path === '/export' || path === '/stats')) {
      const auth = request.headers.get('authorization') || ''
      if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) return json({ error: 'unauthorized' }, 401)

      const subs: { email: string; unsubToken: string; src: string }[] = []
      const counts = { pending: 0, active: 0, unsub: 0 }
      let cursor: string | undefined
      do {
        const listed = await env.SUBS.list({ prefix: 'e:', limit: EXPORT_PAGE, cursor })
        for (const k of listed.keys) {
          const rec = (await env.SUBS.get(k.name, 'json')) as SubRecord | null
          if (!rec) continue
          counts[rec.status]++
          if (rec.status === 'active') subs.push({ email: rec.email, unsubToken: rec.unsubToken, src: rec.src })
        }
        cursor = listed.list_complete ? undefined : listed.cursor
      } while (cursor)

      return json(path === '/stats' ? counts : { count: subs.length, subs })
    }

    return json({ error: 'not found' }, 404)
  },
}
