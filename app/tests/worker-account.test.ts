// THE ACCOUNT WORKER (worker/account) — the magic-link lifecycle and the write rule, driven
// end to end against an in-memory KV with its own clock, the way the relay/list tests drive
// their pure logic. Pinned:
//   1. A login token works ONCE, for 15 minutes, and the redirect carries an exchange code — never
//      the session — in the fragment.
//   2. /login answers the same for a known and an unknown address (no enumeration oracle), and
//      a per-address flood is swallowed silently while a per-IP flood gets a plain 429.
//   3. PUT /state is last-write-wins ON THE VERSION THE CLIENT SAW: a stale version is refused
//      with the stored document (409), never silently overwritten.
//   4. A `return` on /login is honoured only for our own origins (no open redirect).
import { describe, it, expect, beforeEach, beforeAll, spyOn } from 'bun:test'
import worker from '../../worker/account/src/index'
import {
  mailSink, emptyState, putDecision, sanitizeState, returnTarget, bearerOf, tokenOf, normalizeEmail,
  TOKEN_TTL_S, CODE_TTL_S, LOGIN_PER_IP, LOGIN_PER_EMAIL,
} from '../../worker/account/src/lib'
import type { Env, AccountState } from '../../worker/account/src/lib'

/** KV with TTLs and a clock the test can wind forward. */
class FakeKV {
  now = 1_780_000_000_000
  store = new Map<string, { v: string; exp?: number }>()
  private live(k: string) { const e = this.store.get(k); if (!e) return null; if (e.exp && e.exp <= this.now) { this.store.delete(k); return null } return e }
  async get(key: string, type: 'json' | 'text') { const e = this.live(key); if (!e) return null; return type === 'json' ? JSON.parse(e.v) : e.v }
  async put(key: string, value: string, opts?: { expirationTtl?: number }) { this.store.set(key, { v: value, exp: opts?.expirationTtl ? this.now + opts.expirationTtl * 1000 : undefined }) }
  async delete(key: string) { this.store.delete(key) }
  tick(ms: number) { this.now += ms }
}

const ORIGIN = 'https://wkndr-account.test.workers.dev'
let kv: FakeKV
let env: Env
const ctx = { waitUntil(p: Promise<unknown>) { void p } }

const call = (path: string, init: RequestInit & { ip?: string } = {}) => {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  headers.set('cf-connecting-ip', init.ip ?? '10.0.0.1')
  headers.set('origin', 'https://app.wkndr.xyz')
  return worker.fetch(new Request(ORIGIN + path, { ...init, headers }), env, ctx)
}
const post = (path: string, body: unknown, ip?: string) => call(path, { method: 'POST', body: JSON.stringify(body), ip })
const authed = (session: string, path: string, init: RequestInit = {}) =>
  call(path, { ...init, headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${session}` } })

/** the whole front door: ask for a link, follow it, swap the code — returns a live session */
async function signIn(email = 'ness@example.com', ip = '10.0.0.1'): Promise<{ session: string; email: string }> {
  const r = await post('/login', { email }, ip)
  expect(r.status).toBe(200)
  const link = mailSink.last!.link
  const auth = await worker.fetch(new Request(link), env, ctx)
  expect(auth.status).toBe(302)
  const code = new URL(auth.headers.get('location')!).hash.replace('#signin=', '')
  const s = await post('/session', { code })
  expect(s.status).toBe(200)
  return (await s.json()) as { session: string; email: string }
}

beforeAll(() => {   // the 'none' provider prints every link; keep the run's output readable
  spyOn(console, 'log').mockImplementation(() => {})
  spyOn(console, 'error').mockImplementation(() => {})
})
beforeEach(() => {
  kv = new FakeKV()
  env = { ACCOUNT: kv, MAIL_PROVIDER: 'none', APP_ORIGIN: 'https://app.wkndr.xyz' }
  mailSink.last = null
})

describe('the magic link', () => {
  it('login → link → code → session → /me, and the token is spent on the click', async () => {
    const r = await post('/login', { email: 'Ness@Example.com ' })
    expect(await r.json()).toEqual({ ok: true })
    expect(mailSink.last!.to).toBe('ness@example.com')             // normalized before it is mailed
    expect(mailSink.last!.link).toMatch(/^https:\/\/wkndr-account\.test\.workers\.dev\/auth\/[a-f0-9]{32}$/)
    expect([...kv.store.keys()].some((k) => k.startsWith('a:'))).toBe(false)   // nothing exists before the click

    const auth = await worker.fetch(new Request(mailSink.last!.link), env, ctx)
    expect(auth.status).toBe(302)
    const loc = new URL(auth.headers.get('location')!)
    expect(loc.origin + loc.pathname).toBe('https://app.wkndr.xyz/')
    expect(loc.hash).toMatch(/^#signin=[a-f0-9]{32}$/)
    const code = loc.hash.slice(8)

    const again = await worker.fetch(new Request(mailSink.last!.link), env, ctx)
    expect(again.status).toBe(410)                                   // one-time use

    const s = await post('/session', { code })
    const { session, email } = (await s.json()) as { session: string; email: string }
    expect(session).toMatch(/^[a-f0-9]{32}$/)
    expect(email).toBe('ness@example.com')
    expect(loc.hash.includes(session)).toBe(false)                  // the session never rode in the URL

    expect((await post('/session', { code })).status).toBe(401)    // the code is spent too

    const me = await authed(session, '/me')
    expect(me.status).toBe(200)
    expect(((await me.json()) as { email: string }).email).toBe('ness@example.com')
  })

  it('a token older than 15 minutes is gone; a code older than 2 minutes is gone', async () => {
    await post('/login', { email: 'a@b.co' })
    const link = mailSink.last!.link
    kv.tick((TOKEN_TTL_S + 1) * 1000)
    expect((await worker.fetch(new Request(link), env, ctx)).status).toBe(410)

    await post('/login', { email: 'a@b.co' })
    const auth = await worker.fetch(new Request(mailSink.last!.link), env, ctx)
    const code = new URL(auth.headers.get('location')!).hash.slice(8)
    kv.tick((CODE_TTL_S + 1) * 1000)
    expect((await post('/session', { code })).status).toBe(401)
  })

  it('answers identically for a known and an unknown address', async () => {
    await signIn('known@example.com')
    const a = await (await post('/login', { email: 'known@example.com' })).json()
    const b = await (await post('/login', { email: 'nobody@example.com' })).json()
    expect(a).toEqual(b)
  })

  it('rejects junk, swallows a bot, and says when the mail is off', async () => {
    expect((await post('/login', { email: 'not an email' })).status).toBe(400)
    expect((await post('/login', { email: 'x@y.zz', hp: 'filled' })).status).toBe(200)
    expect(mailSink.last).toBeNull()
    env = { ACCOUNT: kv, MAIL_PROVIDER: 'resend' }   // no key set
    expect(await (await post('/login', { email: 'x@y.zz' })).json()).toEqual({ ok: true, delivery: 'off' })
  })

  it('rate-limits: a plain 429 per IP, a silent no-mail per address', async () => {
    for (let i = 0; i < LOGIN_PER_IP; i++) expect((await post('/login', { email: `u${i}@x.io` }, '1.2.3.4')).status).toBe(200)
    expect((await post('/login', { email: 'u99@x.io' }, '1.2.3.4')).status).toBe(429)
    expect((await post('/login', { email: 'u99@x.io' }, '5.6.7.8')).status).toBe(200)   // another client is fine

    for (let i = 0; i < LOGIN_PER_EMAIL; i++) { mailSink.last = null; await post('/login', { email: 'hot@x.io' }, `9.9.9.${i}`); expect(mailSink.last).not.toBeNull() }
    mailSink.last = null
    const r = await post('/login', { email: 'hot@x.io' }, '9.9.9.200')
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })   // looks mailed…
    expect(mailSink.last).toBeNull()               // …wasn't
    kv.tick(11 * 60 * 1000)
    await post('/login', { email: 'hot@x.io' }, '9.9.9.201')
    expect(mailSink.last).not.toBeNull()           // the window passed
  })

  it('honours a return URL only on our origins, and only its path', async () => {
    await post('/login', { email: 'a@b.co', return: 'http://localhost:5173/?dev=1#x' })
    let auth = await worker.fetch(new Request(mailSink.last!.link), env, ctx)
    expect(auth.headers.get('location')).toMatch(/^http:\/\/localhost:5173\/#signin=[a-f0-9]{32}$/)
    await post('/login', { email: 'a@b.co', return: 'https://evil.example/phish' })
    auth = await worker.fetch(new Request(mailSink.last!.link), env, ctx)
    expect(auth.headers.get('location')).toMatch(/^https:\/\/app\.wkndr\.xyz#signin=/)
    expect(returnTarget('https://nessim-higson.github.io/wkndr/', 'x')).toBe('https://nessim-higson.github.io/wkndr/')
    expect(returnTarget('javascript:alert(1)', 'x')).toBe('x')
  })

  it('logout kills the session', async () => {
    const { session } = await signIn()
    expect((await authed(session, '/logout', { method: 'POST' })).status).toBe(200)
    expect((await authed(session, '/me')).status).toBe(401)
    expect((await call('/me')).status).toBe(401)
    expect((await call('/logout', { method: 'POST' })).status).toBe(200)   // signing out of nothing is fine
  })
})

describe('the state', () => {
  const doc = (over: Partial<AccountState> = {}) => ({
    ...emptyState(), saves: [{ id: 'p1', title: 'Foodhallen', when: 'Sat 7 Nov', at: 1, start: '2026-11-07', end: '2026-11-07' }],
    taste: { 'cat:eat': 1.5 }, ...over,
  })

  it('starts empty at v0, accepts a write on the version seen, then bumps', async () => {
    const { session } = await signIn()
    expect(await (await authed(session, '/state')).json()).toEqual(emptyState())

    const put = await authed(session, '/state', { method: 'PUT', body: JSON.stringify({ version: 0, state: doc() }) })
    expect(put.status).toBe(200)
    const { version } = (await put.json()) as { version: number }
    expect(version).toBe(1)

    const got = (await (await authed(session, '/state')).json()) as AccountState
    expect(got.version).toBe(1)
    expect(got.saves[0].title).toBe('Foodhallen')
    expect(got.updatedAt).toBeGreaterThan(0)
  })

  it('refuses a stale version with the stored document — the other device must merge', async () => {
    const { session: phone } = await signIn()
    const { session: laptop } = await signIn()                          // same person, second device
    await authed(phone, '/state', { method: 'PUT', body: JSON.stringify({ version: 0, state: doc() }) })
    const stale = await authed(laptop, '/state', { method: 'PUT', body: JSON.stringify({ version: 0, state: doc({ taste: { 'cat:art': 1 } }) }) })
    expect(stale.status).toBe(409)
    const body = (await stale.json()) as { version: number; state: AccountState }
    expect(body.version).toBe(1)
    expect(body.state.taste).toEqual({ 'cat:eat': 1.5 })               // the phone's write survived
    const retry = await authed(laptop, '/state', { method: 'PUT', body: JSON.stringify({ version: 1, state: doc({ taste: { 'cat:eat': 1.5, 'cat:art': 1 } }) }) })
    expect(retry.status).toBe(200)
    expect(((await retry.json()) as { version: number }).version).toBe(2)
  })

  it('rejects junk and anonymous writes', async () => {
    const { session } = await signIn()
    expect((await authed(session, '/state', { method: 'PUT', body: '{' })).status).toBe(400)
    expect((await authed(session, '/state', { method: 'PUT', body: JSON.stringify({ version: 0, state: 'nope' }) })).status).toBe(400)
    expect((await call('/state', { method: 'PUT', body: JSON.stringify({ version: 0, state: doc() }) })).status).toBe(401)
    expect((await call('/state')).status).toBe(401)
  })
})

describe('pure rules', () => {
  it('putDecision: equal version accepts, anything else conflicts', () => {
    expect(putDecision(null, 0)).toBe('accept')
    expect(putDecision(null, 1)).toBe('conflict')
    expect(putDecision({ ...emptyState(), version: 3 }, 3)).toBe('accept')
    expect(putDecision({ ...emptyState(), version: 3 }, 2)).toBe('conflict')
    expect(putDecision({ ...emptyState(), version: 3 }, '3')).toBe('conflict')
    expect(putDecision({ ...emptyState(), version: 3 }, undefined)).toBe('conflict')
  })
  it('sanitizeState keeps the contract and drops the rest', () => {
    const clean = sanitizeState({
      version: 99, updatedAt: 5,
      saves: [{ id: 'a', title: 'T', when: 'Sat 1 Nov', at: 2, start: '2026-11-01', end: 'bad', link: 'https://x.io/a' }, { id: 'a' }, 'junk', { title: 'no id' }, { id: 'j', link: 'javascript:alert(1)' }],
      declines: { w: 2960, ids: ['x', 3, 'y'] },
      taste: { 'cat:eat': 2, bad: 'x', zero: 0, inf: Infinity },
      later: { a: { seen: 2960 }, b: 'junk' },
      went: { a: { went: true, at: 7 }, b: { went: 'yes' } },
      extra: true,
    })!
    expect(clean).toEqual({
      saves: [{ id: 'a', title: 'T', when: 'Sat 1 Nov', at: 2, start: '2026-11-01', link: 'https://x.io/a' }, { id: 'j', title: '', when: '', at: 0 }],
      declines: { w: 2960, ids: ['x', 'y'] },
      taste: { 'cat:eat': 2 },
      later: { a: { seen: 2960 }, b: {} },
      went: { a: { went: true, at: 7 } },
    })
    expect('version' in clean).toBe(false)
    expect(sanitizeState(null)).toBeNull()
    expect(sanitizeState([])).not.toBeNull()   // an array is an object with no fields → empty, harmless
  })
  it('header + path readers', () => {
    expect(bearerOf('Bearer ' + 'a'.repeat(32))).toBe('a'.repeat(32))
    expect(bearerOf('Bearer short')).toBeNull()
    expect(bearerOf(null)).toBeNull()
    expect(tokenOf('/auth/' + 'b'.repeat(32), 'auth')).toBe('b'.repeat(32))
    expect(tokenOf('/auth/nope', 'auth')).toBeNull()
    expect(normalizeEmail(' A@B.CO ')).toBe('a@b.co')
    expect(normalizeEmail('a@b')).toBeNull()
  })
})
