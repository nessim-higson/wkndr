// INGEST LIB — the pure half of the daily poll (Workstream 3). Everything here is deliberately
// network-free so tests can pin the semantics; scripts/ingest.ts owns the fetching and the files.
//
// Three artifacts, three jobs:
//   seen.<city>.json          — the SEEN REGISTRY: titleKey → the DATE we first met that title,
//                               at daily resolution. This is the authoritative source for
//                               `firstSeen` (lib/freshness.ts): the weekly refresh previously
//                               only knew "was it in last week's feed", which rounds every
//                               arrival to a Thursday. The registry knows the actual day.
//   inbox.<city>.json         — the CANDIDATE INBOX: fresh finds not yet anywhere (feed, airlock,
//                               bench), for the board. Workstream 2's force-rank UI will consume
//                               this; until then it surfaces as a count.
//   ingest-health.<city>.json — per-source yield history + computed alerts. The brief's rule:
//                               failures are expected operating conditions — so a source going
//                               quiet must be VISIBLE (in the board), never a silent gap.
import type { Pick } from '../../src/types'

export interface SeenRegistry { v: 1; seen: Record<string, string> }
export interface HealthRun { date: string; kind: 'daily' | 'weekly'; sources: Record<string, number>; fresh: number }
export interface HealthAlert { kind: 'source-quiet' | 'inflow-low'; detail: string }
export interface HealthFile { v: 1; runs: HealthRun[]; alerts: HealthAlert[] }

/** How many days back the registry remembers a title. Long enough that a returning event is
 *  recognised as OLD (a 6-week festival re-crawl must not read as a fresh arrival), short enough
 *  that the file stays small and last year's edition of an annual reads as new again. */
export const REGISTRY_DAYS = 180

/** Merge one day's sightings into the registry. The rule is MIN — the registry records when a
 *  title FIRST appeared, so a later sighting can never move the date forward, and a backfilled
 *  earlier date (the weekly refresh inheriting from a prior feed) is allowed to move it back. */
export function mergeSightings(reg: SeenRegistry, titleKeys: string[], date: string): SeenRegistry {
  const seen = { ...reg.seen }
  for (const k of titleKeys) {
    if (!k) continue
    if (!seen[k] || date < seen[k]) seen[k] = date
  }
  return { v: 1, seen }
}

/** Drop registry entries older than REGISTRY_DAYS so the file can't grow without bound. */
export function pruneRegistry(reg: SeenRegistry, today: string): SeenRegistry {
  const cutoff = new Date(new Date(today + 'T00:00:00Z').getTime() - REGISTRY_DAYS * 864e5).toISOString().slice(0, 10)
  const seen: Record<string, string> = {}
  for (const [k, d] of Object.entries(reg.seen)) if (d >= cutoff) seen[k] = d
  return { v: 1, seen }
}

/** The inbox rule: first seen within `windowDays`, and not already living anywhere the board can
 *  see it (the feed, the airlock queue, the bench). Sorted newest-arrival first, then buzz. */
export function buildInbox(
  pool: Pick[], reg: SeenRegistry, knownKeys: Set<string>, keyOf: (t: string) => string,
  today: string, windowDays = 10, cap = 60,
): Pick[] {
  const cutoff = new Date(new Date(today + 'T00:00:00Z').getTime() - windowDays * 864e5).toISOString().slice(0, 10)
  return pool
    .filter((p) => !knownKeys.has(keyOf(p.title)))
    .filter((p) => (reg.seen[keyOf(p.title)] ?? today) >= cutoff)
    .map((p) => ({ ...p, firstSeen: reg.seen[keyOf(p.title)] ?? today }))
    .sort((a, b) => (b.firstSeen! < a.firstSeen! ? -1 : b.firstSeen! > a.firstSeen! ? 1 : (b.buzz ?? 1) - (a.buzz ?? 1)))
    .slice(0, cap)
}

/** Append a run and recompute alerts. Two conditions, both from the handoff brief's monitoring task:
 *  a SOURCE quiet for `quietDays` consecutive runs (it broke, or it blocked us — either way, look),
 *  and total fresh INFLOW under `minInflow` across the same window (the feed is starving even if
 *  every source nominally answers). Runs are capped so the file stays a dashboard, not an archive. */
export function appendRun(health: HealthFile, run: HealthRun, quietDays = 3, minInflow = 3, keepRuns = 45): HealthFile {
  const runs = [...health.runs.filter((r) => !(r.date === run.date && r.kind === run.kind)), run]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-keepRuns)
  const alerts: HealthAlert[] = []
  const recent = runs.slice(-quietDays)
  if (recent.length >= quietDays) {
    const sources = new Set(recent.flatMap((r) => Object.keys(r.sources)))
    for (const s of sources) {
      if (recent.every((r) => (r.sources[s] ?? 0) === 0)) {
        alerts.push({ kind: 'source-quiet', detail: `${s}: 0 picks for ${quietDays} runs — broken or blocking us` })
      }
    }
    const inflow = recent.reduce((a, r) => a + r.fresh, 0)
    if (inflow < minInflow) {
      alerts.push({ kind: 'inflow-low', detail: `only ${inflow} fresh finds across the last ${quietDays} runs — the pipeline is starving` })
    }
  }
  return { v: 1, runs, alerts }
}
