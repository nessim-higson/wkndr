/**
 * RESTAMP — the taste FAST-PATH (`bun run scripts/restamp.ts`, or the restamp.yml workflow).
 *
 * A compile-only change (a kill, a dragged pile order, a star, a resting) does not need a crawl,
 * an image pass or a judge run — but the full refresh does all three (~15 min) just to re-apply
 * taste stamps in its final seconds. This script applies ONLY the taste layer to the LAST
 * PUBLISHED feed and republishes: ~90 seconds from compile to live deck.
 *
 * What it re-applies (mirrors refresh.ts's taste blocks, same matchers):
 *   1. corpus.eventVeto  → matching picks DROPPED
 *   2. corpus.rested     → matching picks DROPPED while `until` is in the future
 *   3. corpus.topPicks   → p.top stamped + feed.topMatches refreshed (canon stamping at ingestion)
 *   4. corpus.starredKeeps (★4-5) → editorScore floor 8
 *   5. weekly lead/later/pile (if `weekend` matches the upcoming Saturday) → p.lead / p.later /
 *      p.pilePos (pile via titleLooseMatch — survives retitles)
 *   6. whenIsPast guard  → past picks dropped
 *
 * generatedAt is PRESERVED (the board keys verdict rounds to it — a restamp is not a new round);
 * `restampedAt` records the pass. Abstains (exit 1, no write) if the result would be broken-thin.
 */
import corpus from './taste/corpus.json'
import weekly from './taste/weekly.json'
import { rxOf, titleLooseMatch, upcomingWeekend } from './lib/pipeline'
import { whenIsPast } from '../src/lib/when'
import type { Pick } from '../src/types'

const CITY = process.argv.find((a) => a.startsWith('--city='))?.split('=')[1] ?? 'amsterdam'
const path = `${import.meta.dir}/../public/data/picks.${CITY}.json`
const feed = JSON.parse(await Bun.file(path).text()) as { generatedAt: string; restampedAt?: string; topMatches?: string[]; count?: number; picks: Pick[] }

const before = feed.picks.length
const today = new Date().toISOString().slice(0, 10)
const vetoRx = (corpus.eventVeto as string[]).map(rxOf)
const restedRx = (corpus.rested as { match: string; until: string }[])
  .filter((r) => r.until >= today).map((r) => rxOf(r.match))

let picks = feed.picks
  .filter((p) => !vetoRx.some((rx) => rx.test(p.title)))
  .filter((p) => !restedRx.some((rx) => rx.test(p.title)))
  .filter((p) => !whenIsPast(p.when))

// clear the ephemeral stamps, then re-apply from the CURRENT corpus + weekly
picks = picks.map((p) => ({ ...p, top: undefined, lead: undefined, later: undefined, pilePos: undefined }))
const topRx = (corpus.topPicks as string[]).map(rxOf)
const keepRx = (corpus.starredKeeps as { match: string; stars: number }[])
  .filter((k) => k.stars >= 4).map((k) => rxOf(k.match))
for (const p of picks) {
  if (topRx.some((rx) => rx.test(p.title))) p.top = true
  if (keepRx.some((rx) => rx.test(p.title))) p.editorScore = Math.max(p.editorScore ?? 0, 8)
}
const { sat } = upcomingWeekend()
const satKey = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`
if ((weekly.weekend as string) === satKey) {
  const leads = (weekly.lead as string[]).map(rxOf), laters = (weekly.later as string[]).map(rxOf)
  for (const p of picks) {
    if (leads.some((rx) => rx.test(p.title))) { p.lead = true; p.editorScore = Math.max(p.editorScore ?? 0, 9) }
    else if (laters.some((rx) => rx.test(p.title))) p.later = true
  }
  const missed: string[] = []
  ;((weekly as { pile?: string[] }).pile ?? []).forEach((t, i) => {
    const hit = picks.find((p) => titleLooseMatch(p.title, t))
    if (hit) hit.pilePos = i + 1
    else missed.push(t)
  })
  if (missed.length) console.log(`  pile UNMATCHED: ${missed.join(' | ')}`)
} else {
  console.log(`  slate stale (${weekly.weekend} ≠ ${satKey}) — lead/later/pile skipped`)
}

// ABSTAIN if the result is broken-thin — a bad corpus edit must not hollow the live feed
if (picks.length < 20) { console.error(`✖ restamp abstained: only ${picks.length} picks would remain`); process.exit(1) }

feed.picks = picks
feed.count = picks.length
feed.topMatches = corpus.topPicks as string[]
feed.restampedAt = new Date().toISOString()
await Bun.write(path, JSON.stringify(feed, null, 1))
console.log(`✓ restamped ${CITY}: ${before} → ${picks.length} picks · tops ${picks.filter((p) => p.top).length} · pile ${picks.filter((p) => p.pilePos).length} · generatedAt preserved (${feed.generatedAt})`)
