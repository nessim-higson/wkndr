// WKNDR ACCOUNT — the first account layer (2026-10-27). A third tiny Cloudflare Worker + KV,
// sibling to `/list` (the Friday brief) and `worker/curate/` (the board's fast-lane), and
// deliberately its OWN worker with its own namespace: the relay keeps no identity past 14 days,
// the list keeps an address until the person leaves, and this one keeps a person's saves and
// taste for as long as they want an account. Three workers, three honest stories.
//
// Ness, 2026-10-26: "I want to look at having an account that I can log into and then have
// saved events and things to do for the future." Decided: FREE, NO PASSWORDS, no Google
// sign-in — a MAGIC LINK on the person's email, mailed through the same Resend account the
// brief uses (`MAIL_API_KEY`), with the list's privacy posture: nothing exists until the link
// is clicked, and no endpoint ever says whether an address is known.
//
// API (JSON; CORS locked to the wkndr.xyz surfaces + localhost):
//   POST /login    {email, return?, hp?}  → mints a one-time 15-minute token, mails the link.
//                                          ALWAYS answers {ok:true} for a well-formed address
//                                          (`delivery:'off'` when no mail key is configured —
//                                          a fact about the deploy, not about the address).
//   GET  /auth/<token>                    → consumes the token, mints a 90-day session and a
//                                          2-minute one-time EXCHANGE CODE, and redirects to
//                                          the app with `#signin=<code>`. The session itself
//                                          never rides in a URL (history, referrers, logs).
//   POST /session  {code}                 → {session, email} — the app swaps the code once.
//   GET  /me                              → {email, since}            (authorization: Bearer <session>)
//   GET  /state                           → the account's state, or an empty v0 one
//   PUT  /state    {version, state}       → 200 {version, updatedAt} when `version` matches the
//                                          stored one (last write wins, then bumps);
//                                          409 {version, state} when another device wrote
//                                          first — the client MERGES and retries. The merge
//                                          rule lives in the app (`app/src/lib/account.ts`);
//                                          the worker only refuses to clobber.
//   POST /logout                          → deletes the session.
//
// KV layout (one namespace, `ACCOUNT`):
//   a:<sha256(email)>   the account record  {email, at, lastLoginAt, logins}
//   t:<token>           login token → {key, ret}      TTL 15 min, deleted on use
//   c:<code>            exchange code → {session, key} TTL 2 min,  deleted on use
//   s:<session>         session → account key          TTL 90 days
//   st:<account key>    the state document
//   rl:<ip hash>        /login counter per IP          TTL 10 min
//   rle:<account key>   /login counter per address     TTL 10 min (over it: silently no mail)

import {
  TOKEN_TTL_S, CODE_TTL_S, SESSION_TTL_S, RATE_WINDOW_S, LOGIN_PER_IP, LOGIN_PER_EMAIL, MAX_LOGIN_BODY, MAX_STATE_BYTES,
  emptyState, normalizeEmail, newToken, tokenOf, bearerOf, sha256, accountKey, ALLOWED_ORIGINS, originOk, returnTarget,
  putDecision, sanitizeState, mailSink,
} from './lib'
import type { AccountState, AccountRecord, KV, Env } from './lib'

/* ─────────────────────────────────── mail adapter ─────────────────────────────────── */

async function sendMail(env: Env, to: string, subject: string, html: string, text: string, link: string): Promise<'sent' | 'off' | 'failed'> {
  const provider = env.MAIL_PROVIDER || 'resend'
  if (provider === 'none') {
    mailSink.last = { to, link }
    console.log(`[mail:none] would send to ${to} — ${subject}\n  ${link}`)
    return 'sent'
  }
  if (!env.MAIL_API_KEY || !env.MAIL_FROM) {
    console.error('[mail] MAIL_API_KEY / MAIL_FROM not set — sign-in mail is off')
    return 'off'
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.MAIL_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, html, text }),
  })
  if (!res.ok) console.error(`[mail] send failed ${res.status}: ${await res.text().catch(() => '')}`)
  return res.ok ? 'sent' : 'failed'
}

/* ─────────────────────────────────── copy + chrome ─────────────────────────────────── */

const PAPER = '#faf8f3', INK = '#1a1a1a', INK3 = '#8b8a82', ACCENT = '#ff4d1f'

/** The sign-in mail. One link, fifteen minutes, nothing else in it. */
function loginMail(link: string) {
  const subject = 'Your WKNDR sign-in link'
  const text = `Tap to sign in to WKNDR.\n\n${link}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, ignore this — nothing happens without the tap.`
  const html = `<!doctype html><html><body style="margin:0;padding:32px 20px;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:${INK}">
<div style="max-width:440px;margin:0 auto">
  <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${INK3}">WKNDR</div>
  <h1 style="font-size:26px;font-weight:600;line-height:1.25;margin:22px 0 14px">Tap to sign in.</h1>
  <p style="font-size:15px;line-height:1.6;color:${INK};margin:0 0 26px">Your saves and your taste will follow you to this device.</p>
  <a href="${link}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;border-radius:999px;padding:13px 26px;font-size:15px">Sign in to WKNDR</a>
  <p style="font-size:13px;line-height:1.6;color:${INK3};margin:30px 0 0">The link works once and expires in 15 minutes. If you didn't ask for it, ignore this — nothing happens without the tap.</p>
</div></body></html>`
  return { subject, text, html }
}

function page(title: string, body: string, origin: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · WKNDR</title>
<meta name="robots" content="noindex"></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:${INK};padding:24px">
<div style="max-width:420px;text-align:center">
  <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${INK3};margin-bottom:26px">WKNDR</div>
  ${body}
  <a href="${origin}" style="display:inline-block;margin-top:28px;font-size:13px;color:${INK3};text-decoration:none;border-bottom:.5px solid currentColor;padding-bottom:1px">back to the app</a>
</div></body></html>`
  return new Response(html, { status, headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } })
}

/* ─────────────────────────────────── the worker ─────────────────────────────────── */

function corsFor(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || ''
  return {
    'access-control-allow-origin': originOk(origin) ? origin : ALLOWED_ORIGINS[2],
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

/** A sliding-ish counter in KV: the first hit opens a window; the count lives as long as it. */
async function bump(kv: KV, key: string): Promise<number> {
  const n = Number((await kv.get(key, 'text')) || 0) + 1
  await kv.put(key, String(n), { expirationTtl: RATE_WINDOW_S })
  return n
}

async function sessionAccount(env: Env, request: Request): Promise<{ session: string; key: string; rec: AccountRecord } | null> {
  const session = bearerOf(request.headers.get('authorization'))
  if (!session) return null
  const key = await env.ACCOUNT.get(`s:${session}`, 'text')
  if (!key) return null
  const rec = (await env.ACCOUNT.get(key, 'json')) as AccountRecord | null
  return rec ? { session, key, rec } : null
}

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const cors = corsFor(request)
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors } })

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    const path = url.pathname
    const appOrigin = env.APP_ORIGIN || 'https://app.wkndr.xyz'

    /* ── POST /login ── */
    if (request.method === 'POST' && path === '/login') {
      const raw = await request.text()
      if (raw.length > MAX_LOGIN_BODY) return json({ error: 'too big' }, 413)
      let body: Record<string, unknown>
      try { body = JSON.parse(raw) } catch { return json({ error: 'bad json' }, 400) }
      if (typeof body.hp === 'string' && body.hp.trim()) return json({ ok: true })   // the honeypot: a bot gets a human's answer
      const email = normalizeEmail(body.email)
      if (!email) return json({ error: 'bad email' }, 400)

      // Per IP: a hard 429 — it says nothing about any address, only about this client.
      const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local'
      if ((await bump(env.ACCOUNT, `rl:${await sha256(ip)}`)) > LOGIN_PER_IP) return json({ error: 'slow down' }, 429)

      const key = await accountKey(email)
      // Per address: over the limit we answer exactly as if we had mailed, and don't. A 429 here
      // would tell a stranger which addresses are being hammered — and that is not theirs to know.
      if ((await bump(env.ACCOUNT, `rle:${key}`)) > LOGIN_PER_EMAIL) return json({ ok: true })

      const token = newToken()
      const ret = returnTarget(body.return, appOrigin)
      await env.ACCOUNT.put(`t:${token}`, JSON.stringify({ key, email, ret }), { expirationTtl: TOKEN_TTL_S })

      const link = `${url.origin}/auth/${token}`
      const mail = loginMail(link)
      // The account record is created ON THE CLICK, not here — a stranger typing your address
      // into the form must not create anything in your name.
      const delivery = await sendMail(env, email, mail.subject, mail.html, mail.text, link).catch(() => 'failed' as const)
      // 'failed' answers like 'sent' on purpose (the mail may still land; a retry is harmless).
      return json(delivery === 'off' ? { ok: true, delivery: 'off' } : { ok: true })
    }

    /* ── GET /auth/<token> ── */
    const token = tokenOf(path, 'auth')
    if (request.method === 'GET' && token) {
      const t = (await env.ACCOUNT.get(`t:${token}`, 'json')) as { key: string; email: string; ret: string } | null
      if (!t) {
        return page('Link expired', `<h1 style="font-size:24px;font-weight:600;line-height:1.3;margin:0 0 12px">That link has expired.</h1>
          <p style="font-size:15px;line-height:1.6;color:${INK3};margin:0">Sign-in links work once and last 15 minutes. Ask for a fresh one from the app's menu.</p>`, appOrigin, 410)
      }
      await env.ACCOUNT.delete(`t:${token}`)   // one-time use, before anything else

      const now = Date.now()
      const prev = (await env.ACCOUNT.get(t.key, 'json')) as AccountRecord | null
      const rec: AccountRecord = prev ? { ...prev, lastLoginAt: now, logins: (prev.logins || 0) + 1 } : { email: t.email, at: now, lastLoginAt: now, logins: 1 }
      await env.ACCOUNT.put(t.key, JSON.stringify(rec))

      const session = newToken()
      await env.ACCOUNT.put(`s:${session}`, t.key, { expirationTtl: SESSION_TTL_S })
      const code = newToken()
      await env.ACCOUNT.put(`c:${code}`, JSON.stringify({ session, key: t.key }), { expirationTtl: CODE_TTL_S })

      return new Response(null, { status: 302, headers: { location: `${t.ret}#signin=${code}`, 'cache-control': 'no-store' } })
    }

    /* ── POST /session  {code} ── */
    if (request.method === 'POST' && path === '/session') {
      let body: Record<string, unknown>
      try { body = JSON.parse(await request.text()) } catch { return json({ error: 'bad json' }, 400) }
      const code = typeof body.code === 'string' && /^[a-f0-9]{32}$/.test(body.code) ? body.code : null
      const c = code ? ((await env.ACCOUNT.get(`c:${code}`, 'json')) as { session: string; key: string } | null) : null
      if (!c) return json({ error: 'expired' }, 401)
      await env.ACCOUNT.delete(`c:${code}`)
      const rec = (await env.ACCOUNT.get(c.key, 'json')) as AccountRecord | null
      if (!rec) return json({ error: 'expired' }, 401)
      return json({ session: c.session, email: rec.email, since: rec.at })
    }

    /* ── everything below needs a session ── */
    const who = await sessionAccount(env, request)

    if (path === '/me' && request.method === 'GET') {
      if (!who) return json({ error: 'unauthorized' }, 401)
      return json({ email: who.rec.email, since: who.rec.at })
    }

    if (path === '/state' && request.method === 'GET') {
      if (!who) return json({ error: 'unauthorized' }, 401)
      const st = (await env.ACCOUNT.get(`st:${who.key}`, 'json')) as AccountState | null
      return json(st ?? emptyState())
    }

    if (path === '/state' && request.method === 'PUT') {
      if (!who) return json({ error: 'unauthorized' }, 401)
      const raw = await request.text()
      if (raw.length > MAX_STATE_BYTES) return json({ error: 'too big' }, 413)
      let body: Record<string, unknown>
      try { body = JSON.parse(raw) } catch { return json({ error: 'bad json' }, 400) }
      const clean = sanitizeState(body.state)
      if (!clean) return json({ error: 'bad state' }, 400)
      const prev = (await env.ACCOUNT.get(`st:${who.key}`, 'json')) as AccountState | null
      if (putDecision(prev, body.version) === 'conflict') return json({ version: prev?.version ?? 0, state: prev ?? emptyState() }, 409)
      const next: AccountState = { ...clean, version: (prev?.version ?? 0) + 1, updatedAt: Date.now() }
      await env.ACCOUNT.put(`st:${who.key}`, JSON.stringify(next))
      return json({ version: next.version, updatedAt: next.updatedAt })
    }

    if (path === '/logout' && request.method === 'POST') {
      if (who) ctx.waitUntil(env.ACCOUNT.delete(`s:${who.session}`))
      return json({ ok: true })   // signing out of nothing is still signed out
    }

    return json({ error: 'not found' }, 404)
  },
}
