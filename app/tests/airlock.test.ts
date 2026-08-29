// THE PUBLISH BAR — the invariant that replaced the airlock (2026-08-29).
//
// The old law was Ness's 2026-07-10 decision: the live deck is 1:1 with his Curation Board approvals,
// no live-id pick may ship without one. It held for seven weeks and then showed its cost — with no
// board session since 31 July, the 2026-08-27 run crawled 95 genuinely-new picks and published 25,
// because nothing unapproved CAN publish. Auto-by-default was impossible by construction.
//
// The law now: a live-id pick (`web-`/`llm-`/`rss-`/`sk-`) may ship only if it clears the judge
// (`judgeScore >= JUDGE_FLOOR`) or matches an explicit approval — starredKeeps / topPicks /
// starAnchors ★3+, this weekend's slate, a hero, or buzz≥3. Vetoes and rests kill upstream and
// never reach here. The predicate under test is the SAME publishCheck refresh.ts publishes through,
// so a rogue pick in the data means the pipeline regressed, not that this test drifted.
//
// The slate is time-gated, so the feed is audited AT ITS OWN timestamps (generatedAt, plus
// restampedAt when it parses) — the moments the pipeline last enforced the split. Auditing at
// "now" instead would go red every time the weekend rolls mid-week, blocking the very cron
// refresh that rebuilds the feed.
import { describe, it, expect } from 'bun:test'
import { approvalCheck, publishCheck, crownsActive, JUDGE_FLOOR, type TasteCorpus, type WeeklySlate } from '../scripts/lib/pipeline'
import corpus from '../scripts/taste/corpus.json'
import weekly from '../scripts/taste/weekly.json'
import { heroPicks } from '../scripts/heroes'
import feed from '../public/data/picks.amsterdam.json'

const LIVE = ['web-', 'llm-', 'rss-', 'sk-']
const heroes = heroPicks('amsterdam').map((h) => h.title)

describe('the publish bar', () => {
  it('no live-id pick ships in the published feed below the bar AND unapproved', () => {
    const stamps = [feed.generatedAt, (feed as { restampedAt?: string }).restampedAt]
      .map((s) => new Date(s ?? ''))
      .filter((d) => !Number.isNaN(d.getTime()))
    expect(stamps.length).toBeGreaterThan(0)   // a feed with no parseable timestamp is itself broken
    const checks = stamps.map((d) => publishCheck(corpus as TasteCorpus, weekly as WeeklySlate, heroes, d))
    const rogue = (feed.picks as { id: string; title: string; buzz?: number; judgeScore?: number }[])
      .filter((p) => LIVE.some((pre) => p.id.startsWith(pre)))
      .filter((p) => !checks.some((ok) => ok(p)))
    expect(rogue.map((p) => `${p.id} · ${p.title}`)).toEqual([])
  })
})

describe('publishCheck — merit admits without approval', () => {
  const now = new Date('2026-07-08T12:00:00Z')
  const empty: TasteCorpus = { starredKeeps: [], topPicks: [], starAnchors: [] }
  const noSlate: WeeklySlate = { weekend: '1970-01-01', lead: [], later: [], pile: [] }
  const bar = publishCheck(empty, noSlate, [], now)

  it('publishes a pick nobody approved once it clears the judge', () => {
    expect(bar({ title: 'South East Jazz Festival', judgeScore: JUDGE_FLOOR })).toBe(true)
  })
  it('holds one that does not', () => {
    expect(bar({ title: 'Some Random Gallery Night', judgeScore: JUDGE_FLOOR - 1 })).toBe(false)
  })
  it('holds a pick the judge never scored — an unjudged pick has not earned anything', () => {
    expect(bar({ title: 'Unscored Thing' })).toBe(false)
  })
  it('still admits an explicit approval that the judge rated poorly', () => {
    // Ness outranks the judge, in both directions: this is the override the board exists to be.
    const withStar = publishCheck({ ...empty, starredKeeps: [{ match: 'jollof', stars: 4 }] }, noSlate, [], now)
    expect(withStar({ title: 'The Jollof Club', judgeScore: 1 })).toBe(true)
  })
  it('reads judgeScore, never editorScore — the bar must not be circular', () => {
    // editorScore carries the ★ floor of 8 and the 👑 10, so gating on it would let an approval
    // clear a bar its own approval had set. Passing one must change nothing.
    expect(bar({ title: 'Floored By Approval', editorScore: 10 } as { title: string; editorScore: number })).toBe(false)
  })
})

describe('approvalCheck semantics', () => {
  const now = new Date('2026-07-08T12:00:00Z')            // Wed → upcoming Sat = 2026-07-11
  const corpusMin: TasteCorpus = {
    starredKeeps: [{ match: 'jollof', stars: 4 }],
    topPicks: ['dekmantel'],
    starAnchors: [
      { title: 'Hortus Botanicus (the place)', stars: 5 }, // annotation must not break the match
      { title: 'Bostheater', stars: 2 },                   // below ★3 → NOT an approval
    ],
  }
  const slate: WeeklySlate = { weekend: '2026-07-11', lead: ['candlelight'], later: [], pile: ['Kwaku Summer Festival - Weekend 1'] }
  const ok = approvalCheck(corpusMin, slate, ['Bruno Mars – The Romantic Tour'], now)

  it('matches starredKeeps / topPicks / ★3+ anchors with word boundaries', () => {
    expect(ok({ title: 'The Jollof Club West-African restaurant' })).toBe(true)
    expect(ok({ title: 'Dekmantel Festival 2026' })).toBe(true)
    expect(ok({ title: 'Hortus Botanicus Summer Evenings' })).toBe(true)
    expect(ok({ title: 'Bostheater open-air Shakespeare' })).toBe(false)      // ★2 anchor ≠ approval
    expect(ok({ title: 'Unjollofish cooking class' })).toBe(false)            // boundary holds
  })
  it('matches the weekly pile loosely (retitle-proof) and heroes by title key', () => {
    expect(ok({ title: 'Kwaku Summer Festival — Opening Weekend' })).toBe(true)
    expect(ok({ title: 'Bruno Mars – The Romantic Tour' })).toBe(true)
  })
  it('buzz≥3 (corroborated) approves; an unknown single-source pick does not', () => {
    expect(ok({ title: 'Some Random Gallery Night', buzz: 3 })).toBe(true)
    expect(ok({ title: 'Some Random Gallery Night', buzz: 2 })).toBe(false)
  })
  it('a stale slate approves nothing', () => {
    const stale = approvalCheck(corpusMin, { ...slate, weekend: '2026-07-04' }, [], now)
    expect(stale({ title: 'Kwaku Summer Festival — Opening Weekend' })).toBe(false)
    expect(stale({ title: 'The Jollof Club' })).toBe(true)   // permanent corpus tiers unaffected
  })
})

describe('crownsActive — a 👑 is a call about ONE weekend', () => {
  // The asymmetry this closes: weekly.json's ▲▼ slate always expired on its `weekend` stamp, but
  // topPicks never did. The 2026-07-31 crowns still led the deck on 2026-08-29 — Kaap Amsterdam
  // opened the app four Saturdays running, which is exactly what "it's the same stuff I left
  // several weeks ago" looks like from the inside.
  const wed = new Date('2026-07-08T12:00:00Z')   // Wed → upcoming Sat = 2026-07-11

  it('honours crowns stamped for the upcoming Saturday', () => {
    expect(crownsActive({ topPicksWeekend: '2026-07-11' }, wed)).toBe(true)
  })
  it('retires last weekend’s crowns', () => {
    expect(crownsActive({ topPicksWeekend: '2026-07-04' }, wed)).toBe(false)
  })
  it('fails CLOSED on a missing stamp — a compile that forgets it ships inert crowns, not eternal ones', () => {
    expect(crownsActive({}, wed)).toBe(false)
  })
  it('the shipped corpus retires its 31 July crowns against a later weekend', () => {
    expect(crownsActive(corpus as { topPicksWeekend?: string }, new Date('2026-08-29T12:00:00Z'))).toBe(false)
  })
})
