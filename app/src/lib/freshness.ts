/**
 * FRESHNESS — the decay rule for the `new` bucket.
 *
 * The bug this exists to kill: `freshness` was a bare enum written onto the record by whoever
 * touched it last (the LLM extractor, the scout slate, a hand-authored canon entry), and nothing
 * ever took it back. `east-beach` and `de-pimpelmees` have carried `freshness: 'new'` in
 * src/data/picks.ts since they were written; every scouted find is stamped `'new'` on ingest;
 * the pipeline's date-derived correction skips canon entirely (`if (!isLive(p)) continue`). So
 * "New this week" was never about this week — it was about the last time someone edited a file.
 * Three weeks without a curation session and the bucket still said New.
 *
 * The split that fixes it:
 *   - `freshness: 'new'` stays a CLAIM ABOUT THE WORLD — a venue that just opened, a run that
 *     just announced. Only a source or a human gets to make that claim; we never invent it.
 *   - `firstSeen` is OUR RECORD of when the claim started — stamped by the pipeline the first run
 *     a title appears, carried forward untouched after that (scripts/refresh.ts).
 *
 * A claim is honoured only while our record still supports it. That makes the bucket decay on the
 * CALENDAR rather than on curation activity: if nobody shows up for a month, "New this week"
 * empties itself and stops lying, which is the point. Read-time, so it decays between refreshes
 * too — a dead cron can no longer freeze the label.
 *
 * NOT symmetrical: firstSeen can only DEMOTE, never promote. "First seen by our crawler" and
 * "new in Amsterdam" are different facts, and a weekly refresh meets dozens of titles for the
 * first time — promoting on firstSeen would flood the bucket with things that are merely
 * newly-crawled and drain the word of meaning.
 *
 * See docs/pipeline-freshness.md.
 */
import type { Freshness, Pick } from '../types'
import { latestDateOf } from './when'

/** How long a `new` claim survives its first sighting. TEN days, not seven: the feed rebuilds
 *  weekly (Thursday), so a strict week would expire the whole cohort hours before its
 *  replacement lands and blink the bucket empty every Thursday morning. Ten covers one cycle
 *  plus three days of slack for a late cron, and still can't stretch to cover a second week. */
export const NEW_DAYS = 10

/** WHOLE CALENDAR DAYS since we first saw this title, or null when we have no record.
 *  Calendar days, not elapsed milliseconds: firstSeen is a DATE (midnight) while `now` carries a
 *  clock time, so a straight subtraction made every pick half a day older than it is and expired
 *  the last cohort before lunch on its final day. Both sides are floored to their own local
 *  midnight and compared in UTC, which also keeps the answer stable across the CEST/CET flip. */
export function seenAgeDays(p: Pick, now: Date = new Date()): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.firstSeen ?? '')
  if (!d) return null
  const seen = Date.UTC(+d[1], +d[2] - 1, +d[3])
  return (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - seen) / 864e5
}

/** The freshness the pick may actually claim right now. Everything but `new` passes through —
 *  `weekend` / `ending` are already date-derived in the pipeline, and `always` is a standing
 *  fact. A `new` with no record of arriving CANNOT be new: absence of evidence is the whole
 *  reason the old bucket never emptied, so it fails closed. */
export function effectiveFreshness(p: Pick, now: Date = new Date()): Freshness {
  if (p.freshness !== 'new') return p.freshness
  const age = seenAgeDays(p, now)
  if (age !== null && age <= NEW_DAYS) return p.freshness
  // The claim has lapsed. Fall back to what the DATES say rather than to another claim: a pick
  // that still carries a real date is this weekend's; one that doesn't is a standing listing.
  return latestDateOf(p.when, now) ? 'weekend' : 'always'
}
