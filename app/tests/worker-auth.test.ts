// THE WRITE GATE (worker V.9.44-era) — every worker POST mutates state, spends the Anthropic key,
// or can INJECT cards into the live deck (`added`), so all of them require X-Curate-Key once the
// CURATE_KEY secret is set. Two properties are pinned:
//   1. NO SECRET = OPEN. A fresh deploy must not lock the board out before the secret exists —
//      the same graceful-absence pattern as ANTHROPIC_API_KEY.
//   2. SECRET = CONSTANT-TIME CHECK. Plain === leaks length/prefix timing on exactly the kind of
//      tiny public endpoint people scan.
import { describe, it, expect } from 'bun:test'
import { authed, timingSafeEq } from '../../worker/curate/src/index'
import type { Env } from '../../worker/curate/src/index'

const req = (key?: string) =>
  new Request('https://x/curate/amsterdam', { method: 'POST', headers: key != null ? { 'X-Curate-Key': key } : {} })
const env = (key?: string) => ({ CURATE_KEY: key }) as Env

describe('worker write gate', () => {
  it('stays open while no secret is set (fresh-deploy grace)', () => {
    expect(authed(req(), env(undefined))).toBe(true)
    expect(authed(req('anything'), env(undefined))).toBe(true)
  })
  it('locks every POST once the secret exists', () => {
    expect(authed(req('right-key'), env('right-key'))).toBe(true)
    expect(authed(req('wrong-key'), env('right-key'))).toBe(false)
    expect(authed(req(), env('right-key'))).toBe(false)
    expect(authed(req(''), env('right-key'))).toBe(false)
  })
  it('compares constant-time, not by prefix', () => {
    expect(timingSafeEq('abc', 'abc')).toBe(true)
    expect(timingSafeEq('abc', 'abd')).toBe(false)
    expect(timingSafeEq('abc', 'abcd')).toBe(false)   // length mismatch must not throw or pass
    expect(timingSafeEq('', '')).toBe(true)
    expect(timingSafeEq('', 'x')).toBe(false)
  })
})
