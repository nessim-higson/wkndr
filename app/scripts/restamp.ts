/**
 * RESTAMP — the taste FAST-PATH (`bun run scripts/restamp.ts`, or the restamp.yml workflow).
 *
 * A compile-only change (a kill, a dragged pile order, a star, a resting) does not need a crawl,
 * an image pass or a judge run — but the full refresh does all three (~15 min) just to re-apply
 * taste stamps in its final seconds. This script applies ONLY the taste layer to the LAST
 * PUBLISHED feed and republishes: ~90 seconds from compile to live deck.
 *
 * What it re-applies (mirrors refresh.ts's taste blocks, same matchers):
 *   1. corpus.eventVeto  → matching picks DROPPED (feed AND airlock)
 *   2. corpus.rested     → matching picks DROPPED while `until` is in the future (feed AND airlock)
 *   3. THE AIRLOCK, both directions (the 1:1 rule, Ness 2026-07-10): pending picks that NOW match
 *      an approval (this compile's star/👑/pile) PROMOTE into the feed with image + judge score
 *      intact (deduped by tokKey); live feed picks whose approval lapsed (an expired weekly slate)
 *      DEMOTE back to pending. Same approvalCheck refresh.ts publishes through.
 *   4. corpus.topPicks   → p.top stamped + feed.topMatches refreshed (canon stamping at ingestion)
 *   5. corpus.starredKeeps (★4-5) → editorScore = judge+2 (the ★ boost, see refresh.ts)
 *   6. weekly lead/later/pile (if `weekend` matches the upcoming Saturday) → p.lead / p.later /
 *      p.pilePos (pile via titleLooseMatch — survives retitles)
 *   7. whenIsPast guard  → past picks dropped
 *
 * generatedAt is PRESERVED on BOTH files (the board keys verdict rounds to it — a restamp is not
 * a new round); `restampedAt` records the pass. Abstains (exit 1, no write) if the result would
 * be broken-thin.
 */
import corpus from './taste/corpus.json'
import weekly from './taste/weekly.json'
import { rxOf, titleLooseMatch, tokKey, upcomingWeekend, crownsActive, publishCheck, STAR_BOOST, weekendModes, stampServeOrder, toPortrait, approvalCheck, type TasteCorpus, type WeeklySlate } from './lib/pipeline'
import { curatedImage } from './curated'
import { heroPicks } from './heroes'
import { whenIsPast, whenLooksBroken } from '../src/lib/when'
import { effectiveFreshness } from '../src/lib/freshness'
import type { Pick } from '../src/types'

const CITY = process.argv.find((a) => a.startsWith('--city='))?.split('=')[1] ?? 'amsterdam'
const path = `${import.meta.dir}/../public/data/picks.${CITY}.json`
const pendPath = `${import.meta.dir}/../public/data/pending.${CITY}.json`
const feed = JSON.parse(await Bun.file(path).text()) as { generatedAt: string; restampedAt?: string; topMatches?: string[]; count?: number; picks: Pick[] }
let pendingFile: { generatedAt: string; count?: number; pending: Pick[] } | null = null
try { pendingFile = JSON.parse(await Bun.file(pendPath).text()) } catch { /* no airlock file yet — refresh writes it */ }

const before = feed.picks.length
const today = new Date().toISOString().slice(0, 10)
const vetoRx = (corpus.eventVeto as string[]).map(rxOf)
const restedRx = (corpus.rested as { match: string; until: string }[])
  .filter((r) => r.until >= today).map((r) => rxOf(r.match))
const tasteOk = (p: Pick) =>
  !vetoRx.some((rx) => rx.test(p.title)) && !restedRx.some((rx) => rx.test(p.title)) && !whenIsPast(p.when) && !whenLooksBroken(p.when)

let picks = feed.picks.filter(tasteOk)

// THE AIRLOCK, both directions — kills/stars from the round Ness JUST submitted take effect here.
const isApproved = approvalCheck(corpus as TasteCorpus, weekly as WeeklySlate, heroPicks(CITY).map((h) => h.title))
// THE SAME BAR AS THE SLOW PATH (refresh.ts) — promote/demote must agree with publish or the two
// publishers fight: refresh ships a merit pick on Thursday and the next restamp demotes it back to
// the airlock for lacking an approval it never needed.
//
// `judgeScore ?? editorScore` is a ONE-RUN MIGRATION, and only sound on this side: a pick sitting in
// pending was by definition never approved, so nothing floored its editorScore — it IS the judge's
// verdict. Feeds written after 2026-08-29 carry judgeScore properly and the fallback stops firing.
const mayShip = publishCheck(corpus as TasteCorpus, weekly as WeeklySlate, heroPicks(CITY).map((h) => h.title))
const canPublish = (p: Pick) => mayShip({ ...p, judgeScore: p.judgeScore ?? p.editorScore })
const isLive = (p: Pick) => ['web-', 'llm-', 'rss-', 'sk-'].some((pre) => p.id.startsWith(pre))
let promoted = 0, demoted = 0
const pendingKeep: Pick[] = []
if (pendingFile) {
  // DEMOTE first: a live pick whose approval lapsed (weekly slate rolled, nothing else holds it)
  // returns to the airlock rather than shipping unapproved — the invariant survives between runs.
  const back = picks.filter((p) => isLive(p) && !canPublish(p))
    .map((p) => ({ ...p, top: undefined, lead: undefined, later: undefined, pilePos: undefined }))
  picks = picks.filter((p) => !(isLive(p) && !canPublish(p)))
  demoted = back.length
  // PROMOTE: approved pending picks join the feed, image + judge score intact; tokKey dedupe so a
  // retitled twin of something already published can't double-card. Approved-but-duplicate picks
  // leave the airlock either way (their event is already in the deck).
  const inFeedIds = new Set(picks.map((p) => p.id))
  const inFeedToks = new Set(picks.map((p) => tokKey(p.title)).filter(Boolean))
  for (const p of (pendingFile.pending ?? []).filter(tasteOk)) {
    if (!canPublish(p)) { pendingKeep.push(p); continue }
    const tk = tokKey(p.title)
    if (inFeedIds.has(p.id) || (tk && inFeedToks.has(tk))) continue
    // MATERIALIZE the migration on the way through the door: a legacy pending pick (pre-judgeScore)
    // carries its judge verdict only in editorScore — sound there, nothing ever floored an unapproved
    // pick. Stamp it as judgeScore now or the published feed fails its own airlock audit (the test
    // reads judgeScore, and an unstamped merit pick would look like a rogue).
    picks.push({ ...p, judgeScore: p.judgeScore ?? p.editorScore }); promoted++
    if (tk) inFeedToks.add(tk)
  }
  // demoted picks rejoin the queue at the back (the refresh-authored topical order stays intact)
  const keepToks = new Set(pendingKeep.map((p) => tokKey(p.title)).filter(Boolean))
  const keepIds = new Set(pendingKeep.map((p) => p.id))
  for (const p of back) {
    const tk = tokKey(p.title)
    if (keepIds.has(p.id) || (tk && keepToks.has(tk))) continue
    pendingKeep.push(p)
    if (tk) keepToks.add(tk)
  }
}

// THE BENCH, promote-only — a board ★/👑/▲ can land on a candidates card too (R6: Mokumboot
// ▲LEAD ★5 sat on the bench, unreachable — restamp only knew the airlock). Approved bench cards
// join the feed exactly like pending ones (image + judge score intact, tokKey dedupe) and LEAVE
// the bench file so they can't double-serve. Unapproved bench cards stay put — the bench is the
// board's replacement pool, not a queue; nothing here demotes.
const candPath = `${import.meta.dir}/../public/data/candidates.${CITY}.json`
let benchPromoted = 0
try {
  const candFile = JSON.parse(await Bun.file(candPath).text()) as { candidates: Pick[]; [k: string]: unknown }
  const inFeedIds = new Set(picks.map((p) => p.id))
  const inFeedToks = new Set(picks.map((p) => tokKey(p.title)).filter(Boolean))
  const stay: Pick[] = []
  for (const p of candFile.candidates ?? []) {
    const tk = tokKey(p.title)
    const dupe = inFeedIds.has(p.id) || (!!tk && inFeedToks.has(tk))
    if (isApproved(p) && tasteOk(p) && !dupe) {
      picks.push(p); benchPromoted++
      if (tk) inFeedToks.add(tk)
    } else if (!dupe) stay.push(p)   // a bench twin of a feed card drops either way (published = off the bench)
  }
  if (stay.length !== (candFile.candidates ?? []).length)
    await Bun.write(candPath, JSON.stringify({ ...candFile, count: stay.length, candidates: stay }, null, 2))
} catch { /* no bench file yet — fine */ }

// clear the ephemeral stamps, then re-apply from the CURRENT corpus + weekly
picks = picks.map((p) => ({ ...p, top: undefined, lead: undefined, later: undefined, pilePos: undefined }))
// Crowns expire weekly (refresh.ts owns the law). Mirrored here or the fast path would re-crown
// everything the Thursday run just retired — the two publishers must not disagree about the front.
const crownsLive = crownsActive(corpus as { topPicksWeekend?: string })
const topRx = crownsLive ? (corpus.topPicks as string[]).map(rxOf) : []
const keepRx = (corpus.starredKeeps as { match: string; stars: number }[])
  .filter((k) => k.stars >= 4).map((k) => rxOf(k.match))
for (const p of picks) {
  p.top = topRx.some((rx) => rx.test(p.title)) || undefined   // recompute — a retired crown must CLEAR
  if (keepRx.some((rx) => rx.test(p.title))) p.editorScore = Math.min(10, (p.judgeScore ?? 6) + STAR_BOOST)   // ★ = judge+2, not a floor (see refresh.ts)
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

// ABSTAIN if the result is broken-thin — a bad corpus edit must not hollow the live feed.
// Nothing is written on abstain — the pending file included, so promote/demote can't half-apply.
if (picks.length < 20) { console.error(`✖ restamp abstained: only ${picks.length} picks would remain`); process.exit(1) }

// curated image pins apply on the fast-path too — an img-url verdict (board → curated.ts) lands
// in ~90s instead of waiting for Thursday's image pass. Wrapped like every card image.
for (const p of picks) { const c = curatedImage(p.title); if (c) p.image = toPortrait(c) }

// FRESHNESS DECAY — a restamp republishes the feed, so re-derive the `new` claim against firstSeen
// (src/lib/freshness.ts). Without it a Tuesday compile would re-publish Thursday's labels verbatim
// and hold the bucket open for another cycle; the fast-path would quietly out-live the slow one.
for (const p of picks) p.freshness = effectiveFreshness(p)

// re-stamp the projected serve order — verdicts just moved cards, the board must see the real front
picks = stampServeOrder(picks, await weekendModes())   // per-day: a Sunday pick stamped by Sunday

feed.picks = picks
feed.count = picks.length
feed.topMatches = crownsLive ? (corpus.topPicks as string[]) : []
feed.restampedAt = new Date().toISOString()
await Bun.write(path, JSON.stringify(feed, null, 1))
if (pendingFile) {
  // generatedAt preserved — the airlock belongs to the round it was crawled in
  await Bun.write(pendPath, JSON.stringify({ generatedAt: pendingFile.generatedAt, count: pendingKeep.length, pending: pendingKeep }, null, 2))
}
console.log(`✓ restamped ${CITY}: ${before} → ${picks.length} picks · tops ${picks.filter((p) => p.top).length} · pile ${picks.filter((p) => p.pilePos).length}` +
  `${pendingFile ? ` · airlock: +${promoted} promoted · ${demoted} demoted · ${pendingKeep.length} pending` : ''}` +
  `${benchPromoted ? ` · bench: +${benchPromoted} promoted` : ''} · generatedAt preserved (${feed.generatedAt})`)
