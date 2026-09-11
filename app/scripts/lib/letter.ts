// THE LETTER (V.11.12) — the pipeline writes the Curation Board's content; the board only renders it.
//
// Ness, 2026-09-11, on the board: "simple versus advanced — is it confusing?" It was, and the layout
// was not the reason. The board was built for the 1:1 airlock, when nothing shipped without him, so
// it had to show him EVERYTHING and let him assemble the week by hand. Under auto-by-default
// (V.11.3) his job is REVIEW: see the weekend the pipeline built, see what changed, see what it is
// unsure of, correct the odd thing — and doing nothing is a valid, expected outcome.
//
// So the pipeline now ends every run by writing a LETTER — `data/letter.<city>.json` — with:
//   front    the cards as the deck will deal them (the stamped servePos, through the app's default
//            "This weekend" lens), each with ONE why-line built from the same facts rankPicks scores
//   changes  in / out / moved since the previous letter (the file it overwrites is the baseline)
//   doubts   what deserves a glance: no-photo cards, venue borrows, the top of the airlock with the
//            reason each is held, title pairs the dedupe was not sure about
//   health   one sentence, and when the next build lands
// The board (public/curate/index.html) reads this file and nothing else. It carries no date brain,
// no lens, no tokKey mirror — the drift class STATE.md records (the pile mirror that ignored pilePos,
// the lens that disagreed with datedThisWeekend) is gone by construction: the board cannot disagree
// with the deck because it never derives anything. The old board lives on at /curate/legacy/.
import type { Category, ImageWhy, Pick } from '../../src/types'
import { latestDateOf, whenIsPast, whenStartDate, whenWeekendDays } from '../../src/lib/when'
import { effectiveFreshness, seenAgeDays } from '../../src/lib/freshness'
import { JUDGE_FLOOR, NO_PHOTO_CAP, titleLooseMatch, tokKey, upcomingWeekend } from './pipeline'
import type { HealthFile } from './ingest'

export const LETTER_V = 1 as const
/** How many cards the letter calls "the front" — the opening hand the deck deals. */
export const FRONT_N = 10
/** How many held cards the doubts lane shows (the airlock is sorted best-first by the pipeline). */
export const HELD_N = 5
/** How many twin suspects to show — past this it is a dedupe bug, not a doubt. */
export const TWINS_N = 6
/** The cron, mirrored from .github/workflows/refresh.yml — Mon + Thu 10:00 UTC. */
export const BUILD_DAYS_UTC = [1, 4]
export const BUILD_HOUR_UTC = 10

export type Lens = 'weekend' | 'new' | 'ending' | 'always'

export interface LetterItem {
  id: string
  title: string
  venue: string
  when: string
  category: Category
  link: string
  source: string
  image?: string
  imageWhy?: ImageWhy
  /** ONE line — the facts that put it where it is ("Weekend guide · new this week · Sat"). */
  why: string
  /** the stamped projected serve position (published picks only) */
  pos?: number
  /** which of the app's When lenses it sits under; 'weekend' is the default deck */
  lens: Lens
  live: boolean
  guide?: string
  /** Ness's own calls, carried so the board can show them as his and not the machine's */
  hand?: number
  top?: boolean
  lead?: boolean
  later?: boolean
  judge?: number
  buzz?: number
  /** whole days since the pipeline first met the title (absent = no record) */
  age?: number
}

export interface HeldItem extends LetterItem {
  /** why the airlock is holding it — the one fact that decides whether a ★ is worth it */
  hold: string
}

export interface Letter {
  v: typeof LETTER_V
  city: string
  /** when THIS letter was written */
  builtAt: string
  /** the feed it describes — the overrides contract keys on this exact string */
  feedAt: string
  weekend: { sat: string; sun: string; label: string }
  /** the next scheduled build, ISO — the board turns it into "Mon 14 Sep, 12:00" */
  nextBuild: string
  health: { tag: 'ok' | 'warn'; text: string }
  counts: {
    live: number; canon: number; weekend: number; front: number
    fresh: number; guide: number; noPhoto: number; borrowed: number; held: number; bench: number
  }
  /** the opening hand, in deal order */
  front: LetterItem[]
  /** every other published card, serve order; lens tells the board which shelf it belongs to */
  rest: LetterItem[]
  changes: {
    /** the previous letter's builtAt, or null on a first letter */
    since: string | null
    in: LetterItem[]
    out: { id: string; title: string; why: 'past' | 'held' | 'benched' | 'dropped' }[]
    /** a card that was in the previous front and is published now, with a different slot;
     *  null = outside the front on that side */
    moved: { id: string; title: string; from: number | null; to: number | null }[]
  }
  doubts: {
    noPhoto: LetterItem[]
    borrowed: LetterItem[]
    held: HeldItem[]
    twins: { a: LetterItem; b: LetterItem }[]
  }
  /** the whole airlock (held first) and the bench, for the search box — the board never re-derives a pool */
  airlock: HeldItem[]
  bench: LetterItem[]
}

export interface LetterInput {
  city: string
  generatedAt: string
  picks: Pick[]
  pending: Pick[]
  bench?: Pick[]
  health?: HealthFile | null
  prev?: Letter | null
  now?: Date
}

/** live = crawled (the airlock's own definition, refresh.ts isLive); everything else is canon. */
export const isLiveId = (id: string) => /^(web|llm|rss|sk)-/.test(id)

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** "Sat 12 – Sun 13 Sep", or "Sat 31 Oct – Sun 1 Nov" across a month edge. */
export function weekendLabel(sat: Date, sun: Date): string {
  const sameMonth = sat.getMonth() === sun.getMonth()
  return sameMonth
    ? `Sat ${sat.getDate()} – Sun ${sun.getDate()} ${MON[sun.getMonth()]}`
    : `Sat ${sat.getDate()} ${MON[sat.getMonth()]} – Sun ${sun.getDate()} ${MON[sun.getMonth()]}`
}

/** The next cron firing strictly after `now` (Mon/Thu 10:00 UTC). */
export function nextBuildAfter(now: Date): Date {
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i, BUILD_HOUR_UTC, 0, 0, 0))
    if (BUILD_DAYS_UTC.includes(d.getUTCDay()) && d.getTime() > now.getTime()) return d
  }
  throw new Error('no build day inside a week — BUILD_DAYS_UTC is empty?')
}

/** "I amsterdam guide" / "LBB tips" / "both guides" — the guide field is a display string. */
export function guideShort(guide: string): string {
  const iams = /i amsterdam/i.test(guide), lbb = /lbb|little black book/i.test(guide)
  if (iams && lbb) return 'both weekend guides'
  if (lbb) return 'LBB weekendtips'
  return 'I amsterdam guide'
}

/** Which day(s) of the weekend the card is for, as a word — or '' when it is undated (any day). */
export function dayWord(when: string, sat: Date, sun: Date, now: Date): string {
  const latest = latestDateOf(when, now)
  if (!latest) return ''
  const fri = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() - 1)
  // an end-anchored open run ("Until 17 Jan") is on both days by definition — whenActiveBy's rule
  if (latest.getTime() >= sat.getTime() && /\b(until|through|thru|till|t\/m)\b/i.test(when)) return 'on all weekend'
  if (latest.getTime() < fri.getTime()) return 'before the weekend'
  if (latest.getTime() < sat.getTime()) return 'Fri'
  const start = whenStartDate(when, now)
  const d = whenWeekendDays(when, sat, sun, now)
  const endsThisWeekend = latest.getTime() <= new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59).getTime()
  const day = d.sat && d.sun ? 'Sat + Sun' : d.sat ? 'Sat' : d.sun ? 'Sun' : ''
  if (!day) return ''
  // a run that started weeks ago and goes on past Sunday is not "Sat + Sun", it is open
  if (!endsThisWeekend && start && start.getTime() < fri.getTime()) return 'on all weekend'
  return day
}

/** ONE why-line. The strongest facts first, at most four, each said once. These are the same
 *  facts rankPicks scores (guide, novelty, the day, corroboration, draw) — read, never recomputed. */
export function whyLine(p: Pick, sat: Date, sun: Date, now: Date): string {
  const facts: string[] = []
  if (p.pilePos != null) facts.push(`your #${p.pilePos}`)
  else if (p.top) facts.push('Top pick')
  else if (p.lead) facts.push('your lead')
  else if (p.later) facts.push('pushed later')
  if (p.guide) facts.push(guideShort(p.guide))
  const age = seenAgeDays(p, now)
  if (age !== null && isLiveId(p.id)) {
    if (age <= 0) facts.push('arrived today')
    else if (age <= 7) facts.push('new this week')
    else if (age > 21) facts.push(`week ${Math.ceil((age + 1) / 7)}`)
  }
  const day = dayWord(p.when, sat, sun, now)
  if (day) facts.push(day)
  if ((p.buzz ?? 0) >= 2) facts.push(`${p.buzz} sources`)
  if (p.popularity) facts.push(`${p.popularity.toLocaleString('en-GB')} going`)
  if (p.status === 'selling-fast') facts.push('selling fast')
  else if (p.status === 'final-week') facts.push('final week')
  else if (p.status === 'sold-out') facts.push('sold out')
  else if (p.status === 'free') facts.push('free')
  return facts.slice(0, 4).join(' · ')
}

/** Why the airlock holds a card — the fact a ★ would have to overrule. */
export function holdReason(p: Pick): string {
  if (p.judgeScore == null) return 'not judged this run'
  if (p.judgeScore < JUDGE_FLOOR) return `judge ${p.judgeScore} — below the bar of ${JUDGE_FLOOR}`
  if (!p.image) return `no photo — past the cap of ${NO_PHOTO_CAP} on merit`
  return `judge ${p.judgeScore} — held`
}

function item(p: Pick, sat: Date, sun: Date, now: Date): LetterItem {
  const age = seenAgeDays(p, now)
  const out: LetterItem = {
    id: p.id, title: p.title, venue: p.venue, when: p.when, category: p.category, link: p.link,
    source: p.source, why: whyLine(p, sat, sun, now), lens: effectiveFreshness(p, now), live: isLiveId(p.id),
  }
  if (p.image) out.image = p.image
  if (p.imageWhy) out.imageWhy = p.imageWhy
  if (p.servePos != null) out.pos = p.servePos
  if (p.guide) out.guide = p.guide
  if (p.pilePos != null) out.hand = p.pilePos
  if (p.top) out.top = true
  if (p.lead) out.lead = true
  if (p.later) out.later = true
  if (p.judgeScore != null) out.judge = p.judgeScore
  if ((p.buzz ?? 0) >= 2) out.buzz = p.buzz
  if (age !== null) out.age = age
  return out
}

/** Published pairs whose titles loosely match but were not folded — shown, not decided. */
export function twinSuspects(picks: Pick[]): [Pick, Pick][] {
  const out: [Pick, Pick][] = []
  const seen = new Set<string>()
  for (let i = 0; i < picks.length && out.length < TWINS_N; i++) {
    for (let j = i + 1; j < picks.length && out.length < TWINS_N; j++) {
      const a = picks[i], b = picks[j]
      if (a.id === b.id) continue
      const ka = tokKey(a.title), kb = tokKey(b.title)
      const same = (ka && ka === kb) || titleLooseMatch(a.title, b.title)
      if (!same) continue
      const pair = [a.id, b.id].sort().join('|')
      if (seen.has(pair)) continue
      seen.add(pair)
      out.push([a, b])
    }
  }
  return out
}

/** The one-sentence health line. The tag is the board's colour; the text is the whole story. */
export function healthSentence(c: Letter['counts'], alerts: HealthFile['alerts']): Letter['health'] {
  const bits = [
    `${c.live} live cards`,
    c.guide ? `${c.guide} from the weekend guides` : 'none from the weekend guides',
    `${c.fresh} new this week`,
    c.noPhoto ? `${c.noPhoto} without a photo` : 'every card pictured',
  ]
  const held = `${c.held} held at the door`
  const alert = alerts.length ? alerts.map((a) => a.detail).join('; ') : ''
  const warn = c.live < 8 || !c.guide || alerts.length > 0
  return { tag: warn ? 'warn' : 'ok', text: `${bits.join(', ')}. ${held}.${alert ? ` ${alert}.` : ''}` }
}

export function buildLetter(input: LetterInput): Letter {
  const now = input.now ?? new Date()
  const { sat, sun } = upcomingWeekend(now)
  const prev = input.prev ?? null
  const health = input.health ?? null
  const benchIn = input.bench ?? []

  // the published feed, in the deck's projected order (unstamped picks — canon a restamp never
  // reached — sink behind the stamped ones, stable)
  const published = [...input.picks].sort((a, b) => (a.servePos ?? 1e9) - (b.servePos ?? 1e9))
  const items = published.map((p) => item(p, sat, sun, now))
  // THE FRONT: the app opens on its "This weekend" lens (App.tsx DEFAULT_WHENS = ['weekend']), so
  // the opening hand is the first FRONT_N weekend-lens cards in serve order — not the first ten
  // of the whole feed, which would count the evergreen shelf the default deck never deals.
  const weekend = items.filter((x) => x.lens === 'weekend')
  const front = weekend.slice(0, FRONT_N)
  const frontIds = new Set(front.map((x) => x.id))
  const rest = items.filter((x) => !frontIds.has(x.id))

  const held: HeldItem[] = input.pending.map((p) => ({ ...item(p, sat, sun, now), hold: holdReason(p) }))
  const bench = benchIn.map((p) => item(p, sat, sun, now))

  // CHANGES — against the letter this one overwrites. The previous letter's front/rest ARE its
  // published set, so no separate snapshot is kept: one file, one baseline.
  const prevPub = prev ? [...prev.front, ...prev.rest] : []
  const prevIds = new Set(prevPub.map((x) => x.id))
  const prevFrontPos = new Map(prev ? prev.front.map((x, i) => [x.id, i + 1] as const) : [])
  const nowIds = new Set(items.map((x) => x.id))
  const heldIds = new Set(held.map((x) => x.id))
  const benchIds = new Set(bench.map((x) => x.id))
  const changes: Letter['changes'] = {
    since: prev?.builtAt ?? null,
    in: prev ? items.filter((x) => !prevIds.has(x.id)) : [],
    out: prevPub.filter((x) => !nowIds.has(x.id)).map((x) => ({
      id: x.id, title: x.title,
      why: whenIsPast(x.when, now) ? 'past' : heldIds.has(x.id) ? 'held' : benchIds.has(x.id) ? 'benched' : 'dropped',
    })),
    moved: [],
  }
  if (prev) {
    const nowFrontPos = new Map(front.map((x, i) => [x.id, i + 1] as const))
    for (const x of items) {
      if (!prevIds.has(x.id)) continue
      const from = prevFrontPos.get(x.id) ?? null
      const to = nowFrontPos.get(x.id) ?? null
      if (from === null && to === null) continue
      if (from !== to) changes.moved.push({ id: x.id, title: x.title, from, to })
    }
  }

  const live = items.filter((x) => x.live)
  const counts: Letter['counts'] = {
    live: live.length,
    canon: items.length - live.length,
    weekend: weekend.length,
    front: front.length,
    fresh: live.filter((x) => x.age != null && x.age <= 7).length,
    guide: items.filter((x) => x.guide).length,
    noPhoto: live.filter((x) => !x.image).length,
    borrowed: live.filter((x) => x.imageWhy === 'venue').length,
    held: held.length,
    bench: bench.length,
  }
  const twins = twinSuspects(published).map(([a, b]) => ({ a: item(a, sat, sun, now), b: item(b, sat, sun, now) }))

  return {
    v: LETTER_V,
    city: input.city,
    builtAt: now.toISOString(),
    feedAt: input.generatedAt,
    weekend: { sat: ymd(sat), sun: ymd(sun), label: weekendLabel(sat, sun) },
    nextBuild: nextBuildAfter(now).toISOString(),
    health: healthSentence(counts, health?.alerts ?? []),
    counts,
    front,
    rest,
    changes,
    doubts: {
      noPhoto: live.filter((x) => !x.image),
      borrowed: live.filter((x) => x.imageWhy === 'venue'),
      held: held.slice(0, HELD_N),
      twins,
    },
    airlock: held,
    bench,
  }
}

/** Build + write the letter for a city from the pieces a publisher already holds. The previous
 *  letter (the baseline for `changes`), the ingest health and the bench are read from OUT_DIR so
 *  refresh.ts and restamp.ts call this with one line each. Best-effort on purpose: a letter that
 *  fails to write must never fail a publish — the feed is the product, the letter describes it. */
export async function emitLetter(
  outDir: string, city: string,
  args: { generatedAt: string; picks: Pick[]; pending: Pick[]; bench?: Pick[]; now?: Date; prevFeed?: { generatedAt: string; picks: Pick[] } | null },
): Promise<Letter | null> {
  const path = `${outDir}/letter.${city}.json`
  try {
    let prev = (await Bun.file(path).json().catch(() => null)) as Letter | null
    // a first letter can borrow its baseline from an older feed (scripts/letter.ts --prev=<picks.json>):
    // the synthetic letter is dated to THAT feed, so "since" tells the truth
    if (!prev && args.prevFeed) {
      const at = new Date(args.prevFeed.generatedAt)
      prev = buildLetter({ city, generatedAt: args.prevFeed.generatedAt, picks: args.prevFeed.picks, pending: [], now: Number.isNaN(at.getTime()) ? args.now : at })
      prev.builtAt = args.prevFeed.generatedAt
    }
    const health = (await Bun.file(`${outDir}/ingest-health.${city}.json`).json().catch(() => null)) as HealthFile | null
    const bench = args.bench
      ?? (((await Bun.file(`${outDir}/candidates.${city}.json`).json().catch(() => null)) as { candidates?: Pick[] } | null)?.candidates ?? [])
    const letter = buildLetter({ city, generatedAt: args.generatedAt, picks: args.picks, pending: args.pending, bench, health, prev, now: args.now })
    await Bun.write(path, JSON.stringify(letter, null, 1))
    return letter
  } catch (e) {
    console.error(`  letter:   NOT written — ${(e as Error).message}`)
    return null
  }
}
