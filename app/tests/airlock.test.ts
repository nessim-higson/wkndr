// THE AIRLOCK invariant — Ness's decision (2026-07-10): the live deck is 1:1 with his Curation
// Board approvals. No live-id pick (`web-`/`llm-`/`rss-`/`sk-`) may sit in a published feed
// without an approval match: starredKeeps / topPicks / starAnchors ★3+ (word-boundary), this
// weekend's slate (pile loose-match + lead/later), a hero, or buzz≥3. The predicate under test
// is the SAME approvalCheck refresh.ts publishes through and restamp.ts promotes/demotes with —
// so a rogue pick in the data means the pipeline (not just this test) regressed.
//
// The slate is time-gated, so the feed is audited AT ITS OWN timestamps (generatedAt, plus
// restampedAt when it parses) — the moments the pipeline last enforced the split. Auditing at
// "now" instead would go red every time the weekend rolls mid-week, blocking the very cron
// refresh that rebuilds the feed.
import { describe, it, expect } from 'bun:test'
import { approvalCheck, type TasteCorpus, type WeeklySlate } from '../scripts/lib/pipeline'
import corpus from '../scripts/taste/corpus.json'
import weekly from '../scripts/taste/weekly.json'
import { heroPicks } from '../scripts/heroes'
import feed from '../public/data/picks.amsterdam.json'

const LIVE = ['web-', 'llm-', 'rss-', 'sk-']
const heroes = heroPicks('amsterdam').map((h) => h.title)

describe('the airlock invariant', () => {
  it('no live-id pick ships in the published feed without a board approval match', () => {
    const stamps = [feed.generatedAt, (feed as { restampedAt?: string }).restampedAt]
      .map((s) => new Date(s ?? ''))
      .filter((d) => !Number.isNaN(d.getTime()))
    expect(stamps.length).toBeGreaterThan(0)   // a feed with no parseable timestamp is itself broken
    const checks = stamps.map((d) => approvalCheck(corpus as TasteCorpus, weekly as WeeklySlate, heroes, d))
    const rogue = (feed.picks as { id: string; title: string; buzz?: number }[])
      .filter((p) => LIVE.some((pre) => p.id.startsWith(pre)))
      .filter((p) => !checks.some((ok) => ok(p)))
    expect(rogue.map((p) => `${p.id} · ${p.title}`)).toEqual([])
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
