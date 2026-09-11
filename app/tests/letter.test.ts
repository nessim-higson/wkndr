// THE LETTER — the pipeline writes the board's content (scripts/lib/letter.ts); the board renders it.
// These pin what the letter promises: the front is the deck's projected opening hand through the
// app's default lens, every card carries one why-line built from the facts rankPicks scores, the
// changes are a true diff against the previous letter, and the doubts lane names what deserves a
// glance. The last block audits the SHIPPED letter against the shipped feed, like images.test.ts
// audits the feed — a letter that disagrees with the deck is the drift this design exists to end.
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Pick } from '../src/types'
import {
  buildLetter, whyLine, dayWord, holdReason, twinSuspects, nextBuildAfter, weekendLabel, healthSentence,
  guideShort, FRONT_N, HELD_N, type Letter,
} from '../scripts/lib/letter'
import { JUDGE_FLOOR, NO_PHOTO_CAP } from '../scripts/lib/pipeline'

// Thursday 10 Sep 2026, 12:00 UTC — the weekend is Sat 12 / Sun 13
const NOW = new Date('2026-09-10T12:00:00Z')
const SAT = new Date(2026, 8, 12), SUN = new Date(2026, 8, 13)

let n = 0
const pick = (title: string, extra: Partial<Pick> = {}): Pick => ({
  id: `web-t-${++n}`, title, venue: 'Somewhere', area: '', when: 'Sat 12 Sep · 20:00', category: 'live',
  freshness: 'weekend', outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'Test',
  link: 'https://example.com/x', weatherFit: ['WARM'], image: 'https://img/x.jpg', imageWhy: 'organiser',
  judgeScore: 7, firstSeen: '2026-09-08', ...extra,
})
const canon = (title: string, extra: Partial<Pick> = {}): Pick => pick(title, { id: `ams-${++n}`, freshness: 'always', when: 'Daily', firstSeen: undefined, judgeScore: undefined, ...extra })
const stamp = (picks: Pick[]): Pick[] => picks.map((p, i) => ({ ...p, servePos: i + 1 }))

describe('the why-line', () => {
  it('leads with Ness\'s own call, then the guide, then novelty, then the day — at most four facts', () => {
    const w = whyLine(pick('X', { pilePos: 3, guide: 'I amsterdam weekend guide · LBB weekendtips', buzz: 3, popularity: 900 }), SAT, SUN, NOW)
    expect(w).toBe('your #3 · both weekend guides · new this week · Sat')
    expect(w.split(' · ').length).toBeLessThanOrEqual(4)
  })
  it('a card with nothing to say still says its day', () => {
    expect(whyLine(pick('X', { firstSeen: undefined }), SAT, SUN, NOW)).toBe('Sat')
  })
  it('names the guides the way the card does', () => {
    expect(guideShort('I amsterdam weekend guide')).toBe('I amsterdam guide')
    expect(guideShort('LBB weekendtips')).toBe('LBB weekendtips')
    expect(guideShort('I amsterdam weekend guide · LBB weekendtips')).toBe('both weekend guides')
  })
  it('wallpaper is named as such: a live card in its fourth week says so', () => {
    expect(whyLine(pick('X', { firstSeen: '2026-08-15' }), SAT, SUN, NOW)).toContain('week 4')
    // canon never ages — the shelf is not wallpaper
    expect(whyLine(canon('Foodhallen', { firstSeen: '2026-06-01' }), SAT, SUN, NOW)).not.toContain('week')
  })
  it('the day word reads the dates the way the app does', () => {
    expect(dayWord('Sat 12 Sep · 20:00', SAT, SUN, NOW)).toBe('Sat')
    expect(dayWord('Sun 13 Sep · 14:00', SAT, SUN, NOW)).toBe('Sun')
    expect(dayWord('Sat 12 – Sun 13 Sep', SAT, SUN, NOW)).toBe('Sat + Sun')
    expect(dayWord('Fri 11 Sep · 22:00', SAT, SUN, NOW)).toBe('Fri')
    expect(dayWord('Until Sun 17 Jan', SAT, SUN, NOW)).toBe('on all weekend')
    expect(dayWord('Daily', SAT, SUN, NOW)).toBe('')
    expect(dayWord('Wed 9 Sep · 20:00', SAT, SUN, NOW)).toBe('before the weekend')
  })
})

describe('the hold reason', () => {
  it('names the one fact a ★ would have to overrule', () => {
    expect(holdReason(pick('X', { judgeScore: 3 }))).toBe(`judge 3 — below the bar of ${JUDGE_FLOOR}`)
    expect(holdReason(pick('X', { judgeScore: 7, image: undefined }))).toBe(`no photo — past the cap of ${NO_PHOTO_CAP} on merit`)
    expect(holdReason(pick('X', { judgeScore: undefined }))).toBe('not judged this run')
  })
})

describe('the front', () => {
  it('is the first ten weekend-lens cards in the stamped serve order — the deck\'s opening hand', () => {
    const picks = stamp([
      pick('A'), canon('Evergreen 1'), pick('B'), pick('C'), pick('D'), pick('E'), pick('F'),
      canon('Evergreen 2'), pick('G'), pick('H'), pick('I'), pick('J'), pick('K'), pick('L'),
    ])
    const l = buildLetter({ city: 'amsterdam', generatedAt: 'G1', picks, pending: [], now: NOW })
    expect(l.front.map((x) => x.title)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])
    expect(l.front.length).toBe(FRONT_N)
    // the shelf is in `rest`, tagged by lens, never in the front
    expect(l.rest.map((x) => x.title)).toEqual(['Evergreen 1', 'Evergreen 2', 'K', 'L'])
    expect(l.rest.filter((x) => x.lens === 'always').length).toBe(2)
    expect(l.front.every((x) => x.why.length > 0)).toBe(true)
    expect(l.counts).toMatchObject({ live: 12, canon: 2, front: 10, weekend: 12 })
  })
  it('a hand-ordered pile IS the front, in that order', () => {
    const picks = stamp([pick('First', { pilePos: 1 }), pick('Second', { pilePos: 2 }), pick('Third')])
    const l = buildLetter({ city: 'amsterdam', generatedAt: 'G1', picks, pending: [], now: NOW })
    expect(l.front.map((x) => x.hand)).toEqual([1, 2, undefined])
    expect(l.front[0].why.startsWith('your #1')).toBe(true)
  })
})

describe('the changes', () => {
  const week1 = stamp([pick('Stays'), pick('Leaves for the past', { when: 'Sat 5 Sep · 20:00' }), pick('Gets held'), pick('Gets benched'), pick('Vanishes'), pick('Slides')])
  const prev = buildLetter({ city: 'amsterdam', generatedAt: 'G1', picks: week1, pending: [], now: new Date('2026-09-07T10:00:00Z') })
  it('a first letter has no baseline and says so', () => {
    expect(prev.changes.since).toBeNull()
    expect(prev.changes.in).toEqual([])
    expect(prev.changes.out).toEqual([])
  })
  it('in / out / moved are a true diff against the previous letter, with the reason a card left', () => {
    const stays = week1[0], slides = week1[5]
    const arrives = pick('Arrives')
    const held = { ...week1[2], judgeScore: 2 }, benched = week1[3]
    const week2 = stamp([arrives, slides, stays])
    const l = buildLetter({ city: 'amsterdam', generatedAt: 'G2', picks: week2, pending: [held], bench: [benched], prev, now: NOW })
    expect(l.changes.since).toBe(prev.builtAt)
    expect(l.changes.in.map((x) => x.title)).toEqual(['Arrives'])
    expect(l.changes.out).toEqual([
      { id: week1[1].id, title: 'Leaves for the past', why: 'past' },
      { id: week1[2].id, title: 'Gets held', why: 'held' },
      { id: week1[3].id, title: 'Gets benched', why: 'benched' },
      { id: week1[4].id, title: 'Vanishes', why: 'dropped' },
    ])
    // Stays went 1 → 3, Slides 6 → 2; Arrives is new, so it is in `in`, not `moved`
    expect(l.changes.moved).toEqual([
      { id: slides.id, title: 'Slides', from: 6, to: 2 },
      { id: stays.id, title: 'Stays', from: 1, to: 3 },
    ])
    expect(l.doubts.held[0].hold).toContain('below the bar')
  })
  it('a letter rebuilt on an unchanged feed reports no changes', () => {
    const again = buildLetter({ city: 'amsterdam', generatedAt: 'G1', picks: week1, pending: [], prev, now: NOW })
    expect(again.changes.in).toEqual([])
    expect(again.changes.out).toEqual([])
    expect(again.changes.moved).toEqual([])
  })
  it('a card falling out of the front but staying published is a move to null, not an out', () => {
    const eleven = stamp([pick('Was first'), ...Array.from({ length: 11 }, (_, i) => pick(`P${i}`))])
    const p1 = buildLetter({ city: 'amsterdam', generatedAt: 'G1', picks: eleven, pending: [], now: NOW })
    const rotated = stamp([...eleven.slice(1), eleven[0]])
    const p2 = buildLetter({ city: 'amsterdam', generatedAt: 'G2', picks: rotated, pending: [], prev: p1, now: NOW })
    expect(p2.changes.out).toEqual([])
    expect(p2.changes.moved.find((m) => m.title === 'Was first')).toEqual({ id: eleven[0].id, title: 'Was first', from: 1, to: null })
  })
})

describe('the doubts', () => {
  it('no-photo, venue borrows, the top of the airlock and twin suspects — each named, none decided', () => {
    const picks = stamp([
      pick('Pictured'), pick('Blank', { image: undefined, imageWhy: 'none' }), pick('Borrowed', { imageWhy: 'venue' }),
      pick('Open Monuments Day'), pick('Open Monuments Day Amsterdam'), pick('Jazz at Bimhuis'), pick('Jazz at Paradiso'),
    ])
    const pending = Array.from({ length: 8 }, (_, i) => pick(`Held ${i}`, { judgeScore: 4 }))
    const l = buildLetter({ city: 'amsterdam', generatedAt: 'G1', picks, pending, now: NOW })
    expect(l.doubts.noPhoto.map((x) => x.title)).toEqual(['Blank'])
    expect(l.doubts.borrowed.map((x) => x.title)).toEqual(['Borrowed'])
    expect(l.doubts.held.length).toBe(HELD_N)
    expect(l.airlock.length).toBe(8)
    expect(l.doubts.twins.map((t) => [t.a.title, t.b.title])).toEqual([['Open Monuments Day', 'Open Monuments Day Amsterdam']])
    expect(l.counts).toMatchObject({ noPhoto: 1, borrowed: 1, held: 8 })
  })
  it('twin suspects are loose title matches that survived the dedupe — never the same card twice', () => {
    const a = pick('Kusama'), b = pick('Kusama')
    expect(twinSuspects([a, b, a]).length).toBe(1)
  })
})

describe('the clock', () => {
  it('the next build is the next Mon/Thu 10:00 UTC strictly after now', () => {
    expect(nextBuildAfter(new Date('2026-09-10T12:00:00Z')).toISOString()).toBe('2026-09-14T10:00:00.000Z')   // Thu noon → Mon
    expect(nextBuildAfter(new Date('2026-09-14T09:59:00Z')).toISOString()).toBe('2026-09-14T10:00:00.000Z')   // Mon, just before
    expect(nextBuildAfter(new Date('2026-09-14T10:00:00Z')).toISOString()).toBe('2026-09-17T10:00:00.000Z')   // Mon, on the dot → Thu
  })
  it('labels the weekend, across a month edge too', () => {
    expect(weekendLabel(new Date(2026, 8, 12), new Date(2026, 8, 13))).toBe('Sat 12 – Sun 13 Sep')
    expect(weekendLabel(new Date(2026, 9, 31), new Date(2026, 10, 1))).toBe('Sat 31 Oct – Sun 1 Nov')
  })
  it('the letter is dated to the weekend it serves', () => {
    const l = buildLetter({ city: 'amsterdam', generatedAt: 'G1', picks: stamp([pick('A')]), pending: [], now: NOW })
    expect(l.weekend).toEqual({ sat: '2026-09-12', sun: '2026-09-13', label: 'Sat 12 – Sun 13 Sep' })
    expect(l.feedAt).toBe('G1')
    expect(l.builtAt).toBe(NOW.toISOString())
  })
})

describe('the health sentence', () => {
  const counts = { live: 60, canon: 40, weekend: 50, front: 10, fresh: 12, guide: 9, noPhoto: 3, borrowed: 2, held: 40, bench: 5 }
  it('one sentence, the whole story', () => {
    expect(healthSentence(counts, [])).toEqual({ tag: 'ok', text: '60 live cards, 9 from the weekend guides, 12 new this week, 3 without a photo. 40 held at the door.' })
  })
  it('warns when the guides are missing, the feed is thin, or a source has gone quiet', () => {
    expect(healthSentence({ ...counts, guide: 0 }, []).tag).toBe('warn')
    expect(healthSentence({ ...counts, live: 5 }, []).tag).toBe('warn')
    const h = healthSentence(counts, [{ kind: 'source-quiet', detail: 'RA: 0 picks for 3 runs — broken or blocking us' }])
    expect(h.tag).toBe('warn')
    expect(h.text).toContain('RA: 0 picks for 3 runs')
  })
})

// ─── THE SHIPPED LETTER ─────────────────────────────────────────────────────────────────────
// Like the feed audit in images.test.ts: the file the board will read must agree with the feed it
// describes. Arms only when a letter has been written (the first cron after V.11.12).
describe('the shipped letter agrees with the shipped feed', () => {
  const DATA = join(import.meta.dir, '../public/data')
  let letter: Letter | null = null
  try { letter = JSON.parse(readFileSync(join(DATA, 'letter.amsterdam.json'), 'utf8')) } catch { /* not written yet */ }
  const feed = JSON.parse(readFileSync(join(DATA, 'picks.amsterdam.json'), 'utf8')) as { generatedAt: string; picks: Pick[] }
  const t = letter ? it : it.skip
  t('describes the feed that is live, and only cards that are in it', () => {
    const ids = new Set(feed.picks.map((p) => p.id))
    expect(letter!.feedAt).toBe(feed.generatedAt)
    for (const x of [...letter!.front, ...letter!.rest]) expect(ids.has(x.id), `${x.title} is in the letter but not the feed`).toBe(true)
    expect(letter!.front.length + letter!.rest.length).toBe(feed.picks.length)
  })
  t('the front is the deck\'s projected opening hand — serve order, weekend lens, every card with a why', () => {
    const pos = letter!.front.map((x) => x.pos ?? 1e9)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(letter!.front.every((x) => x.lens === 'weekend')).toBe(true)
    expect(letter!.front.every((x) => x.why.length > 0)).toBe(true)
    expect(letter!.front.length).toBeLessThanOrEqual(FRONT_N)
  })
})
