// The relay boomerang's PURE logic — client bookkeeping (src/lib/relay.ts) and the worker's
// payload hygiene + merge (relay/src/index.ts). The network/storage edges are thin wrappers
// around these, so the round-trip's decisions stay testable without a browser or a Worker
// runtime. Guards the invariants the field failure taught us to care about: a round only ever
// GROWS (out-of-order POSTs can't drop a match), done is sticky, an abandoned partial round
// still surfaces, and garbage never reaches KV.
import { describe, it, expect } from 'bun:test'
import {
  newRoundId, addRound, dropRound, pruneRounds, roundReady, ROUND_TTL_MS, ROUND_STALE_MS,
} from '../src/lib/relay'
import { roundIdOf, parseRoundPost, mergeRound } from '../../relay/src/index'

const NOW = 1_752_200_000_000

describe('newRoundId', () => {
  it('mints 10-char base36 ids the worker will accept', () => {
    const r = newRoundId()
    expect(r).toMatch(/^[a-z0-9]{10}$/)
    expect(roundIdOf(`/r/${r}`)).toBe(r)
  })
  it('is (overwhelmingly) unique per mint', () => {
    expect(newRoundId()).not.toBe(newRoundId())
  })
})

describe('sent-round bookkeeping', () => {
  it('addRound appends once — re-arming the same round (copy then share) stays one entry', () => {
    const list = addRound(addRound([], 'abc123defg', NOW), 'abc123defg', NOW + 5)
    expect(list).toEqual([{ r: 'abc123defg', at: NOW }])
  })
  it('dropRound removes only the resolved round', () => {
    const list = addRound(addRound([], 'aaaaaaaaaa', NOW), 'bbbbbbbbbb', NOW)
    expect(dropRound(list, 'aaaaaaaaaa').map((s) => s.r)).toEqual(['bbbbbbbbbb'])
  })
  it('pruneRounds forgets rounds past the KV TTL (nothing left to poll for)', () => {
    const list = [{ r: 'old0000000', at: NOW - ROUND_TTL_MS - 1 }, { r: 'live000000', at: NOW - 1 }]
    expect(pruneRounds(list, NOW).map((s) => s.r)).toEqual(['live000000'])
  })
})

describe('roundReady — when does the sender get the match moment?', () => {
  it('a completed round with matches → ready', () => {
    expect(roundReady({ codes: ['1a2b3c4'], name: 'Sanne', done: true, at: NOW }, NOW)).toBe(true)
  })
  it('a mid-round partial (fresh write) → keep waiting', () => {
    expect(roundReady({ codes: ['1a2b3c4'], name: '', done: false, at: NOW - 5_000 }, NOW)).toBe(false)
  })
  it('an ABANDONED partial (the 2026-07-11 field failure) → ready once stale', () => {
    expect(roundReady({ codes: ['1a2b3c4'], name: '', done: false, at: NOW - ROUND_STALE_MS - 1 }, NOW)).toBe(true)
  })
  it('done with zero matches → never "a match" (resolved silently elsewhere)', () => {
    expect(roundReady({ codes: [], name: 'Sanne', done: true, at: NOW }, NOW)).toBe(false)
  })
})

describe('worker roundIdOf', () => {
  it('accepts /r/<base36 id>, rejects everything else', () => {
    expect(roundIdOf('/r/abc123defg')).toBe('abc123defg')
    expect(roundIdOf('/r/ABC123DEFG')).toBeNull()   // case matters — ids are minted lowercase
    expect(roundIdOf('/r/tiny')).toBeNull()          // too short to be unguessable
    expect(roundIdOf('/x/abc123defg')).toBeNull()
    expect(roundIdOf('/r/abc123defg/extra')).toBeNull()
  })
})

describe('worker parseRoundPost', () => {
  it('keeps a well-formed post, clipping the name to a first-name-ish 24 chars', () => {
    const p = parseRoundPost({ codes: ['1a2b3c4', '0zzzzzz'], name: '  Sanne  ', done: true })
    expect(p).toEqual({ codes: ['1a2b3c4', '0zzzzzz'], name: 'Sanne', done: true })
  })
  it('drops non-code garbage but keeps the good codes around it', () => {
    const p = parseRoundPost({ codes: ['1a2b3c4', 'DROP TABLE', 42, 'https://x', '0zzzzzz'] })
    expect(p?.codes).toEqual(['1a2b3c4', '0zzzzzz'])
  })
  it('rejects shapes with no codes array at all', () => {
    expect(parseRoundPost({ name: 'x' })).toBeNull()
    expect(parseRoundPost('codes')).toBeNull()
    expect(parseRoundPost(null)).toBeNull()
    expect(parseRoundPost(['1a2b3c4'])).toBeNull()
  })
})

describe('worker mergeRound', () => {
  const prev = { codes: ['1a2b3c4'], name: 'Sanne', done: false, at: NOW - 60_000 }
  it('a round only grows: codes union in matched order, out-of-order POSTs drop nothing', () => {
    const m = mergeRound(prev, { codes: ['0zzzzzz', '1a2b3c4'], name: 'Sanne', done: false }, NOW)
    expect(m.codes).toEqual(['1a2b3c4', '0zzzzzz'])
    expect(m.at).toBe(NOW)
  })
  it('done is sticky and the email ping stays once-only (pinged carried forward)', () => {
    const donePrev = { ...prev, done: true, pinged: true }
    const m = mergeRound(donePrev, { codes: [], name: '', done: false }, NOW)
    expect(m.done).toBe(true)
    expect(m.pinged).toBe(true)
    expect(m.name).toBe('Sanne')   // a later anonymous POST doesn't erase the name
  })
  it('first write of a round stands on its own', () => {
    const m = mergeRound(null, { codes: ['1a2b3c4'], name: '', done: true }, NOW)
    expect(m).toEqual({ codes: ['1a2b3c4'], name: '', done: true, at: NOW })
  })
})
