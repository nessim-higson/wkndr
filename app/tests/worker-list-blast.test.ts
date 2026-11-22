// THE FRIDAY SEND (list/src/index.ts POST /blast + POST /test) — driven against an in-memory KV with
// MAIL_PROVIDER 'none', so nothing leaves the test. Pinned:
//   1. Both doors are admin-gated.
//   2. A blast goes to CONFIRMED subscribers only — never pending, never unsubscribed.
//   3. ONE BLAST A WEEKEND: the same Saturday key is refused the second time (409); `force` is the
//      only way through, and a dry run never marks the weekend.
//   4. An empty list sends nothing and marks nothing, so the first real subscriber still gets that week.
//   5. Each recipient's `{{unsub}}` is their own link; a brief without the placeholder gets the footer.
import { describe, it, expect, beforeEach, spyOn } from 'bun:test'
import worker, { renderFor, blastKey, emailKey, type SubRecord } from '../../list/src/index'

class FakeKV {
  store = new Map<string, string>()
  async get(key: string, type: 'json' | 'text') { const v = this.store.get(key); if (v == null) return null; return type === 'json' ? JSON.parse(v) : v }
  async put(key: string, value: string) { this.store.set(key, value) }
  async delete(key: string) { this.store.delete(key) }
  async list(opts: { prefix: string }) { return { keys: [...this.store.keys()].filter((k) => k.startsWith(opts.prefix)).map((name) => ({ name })), list_complete: true } }
}

const ORIGIN = 'https://wkndr-list.test.workers.dev'
const ADMIN = 'test-admin-key'
let kv: FakeKV
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let env: any
const ctx = { waitUntil(p: Promise<unknown>) { void p } }
const post = (path: string, body: unknown, key: string | null = ADMIN) =>
  worker.fetch(new Request(ORIGIN + path, {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
  }), env, ctx)
const add = async (email: string, status: SubRecord['status']) => {
  const rec: SubRecord = { email, status, src: 'landing', at: 1, unsubToken: `tok-${email.split('@')[0]}` }
  kv.store.set(await emailKey(email), JSON.stringify(rec))
}
// only the worker's own would-send lines: in the full suite other files log through the same console
const mailed = (log: { mock: { calls: unknown[][] } }) => log.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('[mail:none]'))
const BRIEF = { key: '2026-11-28', subject: 'Cold, dry Saturday.', html: '<p>picks</p><a href="{{unsub}}">Unsubscribe</a>' }

beforeEach(() => { kv = new FakeKV(); env = { SUBS: kv, ADMIN_KEY: ADMIN, MAIL_PROVIDER: 'none', MAIL_FROM: 'WKNDR <friday@wkndr.xyz>', SITE_ORIGIN: 'https://wkndr.xyz' } })

describe('POST /blast', () => {
  it('is admin-gated, and wants a Saturday key, a subject and a body', async () => {
    expect((await post('/blast', BRIEF, null)).status).toBe(401)
    expect((await post('/blast', BRIEF, 'wrong')).status).toBe(401)
    expect((await post('/blast', { ...BRIEF, key: 'this-friday' })).status).toBe(400)
    expect((await post('/blast', { ...BRIEF, subject: '' })).status).toBe(400)
  })
  it('an empty list sends nothing and does not mark the weekend', async () => {
    const r = await post('/blast', BRIEF)
    expect(await r.json()).toEqual({ ok: true, sent: 0, failed: 0, audience: 0 })
    expect(kv.store.has('sent:2026-11-28')).toBe(false)
  })
  it('goes to confirmed subscribers only, once a weekend', async () => {
    await add('ness@example.com', 'active'); await add('katya@example.com', 'active')
    await add('maybe@example.com', 'pending'); await add('gone@example.com', 'unsub')
    const log = spyOn(console, 'log').mockImplementation(() => {})
    log.mockClear()
    const dry = await (await post('/blast', { ...BRIEF, dry: true })).json()
    expect(dry).toMatchObject({ ok: true, dry: true, audience: 2, already: null })
    expect(kv.store.has('sent:2026-11-28')).toBe(false)                       // a dry run marks nothing
    expect(mailed(log)).toEqual([])

    const first = await post('/blast', BRIEF)
    expect(await first.json()).toEqual({ ok: true, sent: 2, failed: 0, audience: 2 })
    const told = mailed(log)
    expect(told.filter((l) => l.includes('would blast')).length).toBe(2)
    expect(told.join('\n')).not.toMatch(/maybe@|gone@/)

    const again = await post('/blast', BRIEF)                                  // the re-run, the retry
    expect(again.status).toBe(409)
    expect((await again.json()).already).toMatchObject({ sent: 2 })
    expect((await post('/blast', { ...BRIEF, force: true })).status).toBe(200) // on purpose
    expect((await post('/blast', { ...BRIEF, key: '2026-12-05' })).status).toBe(200)   // next weekend is its own key
    log.mockRestore()
  })
})

describe('POST /test', () => {
  it('is admin-gated, capped at three addresses, and never reads the list', async () => {
    await add('ness@example.com', 'active')
    const log = spyOn(console, 'log').mockImplementation(() => {})
    log.mockClear()
    expect((await post('/test', { to: ['a@example.com'], subject: 's', html: 'h' }, null)).status).toBe(401)
    expect((await post('/test', { to: ['a@x.co', 'b@x.co', 'c@x.co', 'd@x.co'], subject: 's', html: 'h' })).status).toBe(400)
    const r = await post('/test', { to: ['a@example.com'], subject: 's', html: 'see {{unsub}}' })
    expect(await r.json()).toEqual({ ok: true, sent: 1, of: 1 })
    expect(mailed(log).length).toBe(1)
    expect(mailed(log).join('\n')).not.toContain('ness@example.com')
    log.mockRestore()
  })
})

describe('the pure parts', () => {
  it('renderFor points {{unsub}} at the recipient, or appends the footer', () => {
    expect(renderFor('a {{unsub}} b {{unsub}}', 'https://l/unsub/t1')).toBe('a https://l/unsub/t1 b https://l/unsub/t1')
    const out = renderFor('<p>no footer</p>', 'https://l/unsub/t2')
    expect(out).toContain('href="https://l/unsub/t2"'); expect(out).toContain('Unsubscribe')
  })
  it('blastKey takes a date and nothing else', () => {
    expect(blastKey('2026-11-28')).toBe('2026-11-28')
    for (const bad of ['28 Nov', '2026-11-28T07:30', '', null, 20261128]) expect(blastKey(bad)).toBeNull()
  })
})
