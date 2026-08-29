/**
 * WKNDR ingest — the DAILY poll (Workstream 3 of the 2026-08-28 freshness brief).
 *
 *   bun run ingest                      # keyless daily pull → seen registry + inbox + health
 *   bun run ingest --city=amsterdam
 *
 * Runs DAILY (.github/workflows/ingest.yml) and on demand. Deliberately NOT a small refresh:
 *   · KEYLESS ONLY — the RSS floor + I amsterdam JSON-LD + Resident Advisor. No LLM, no judge,
 *     no image pass, no API spend. A daily run costs nothing and so can never be "too expensive
 *     to keep running", which is how daily jobs die.
 *   · NEVER TOUCHES THE SERVED FEED — writes seen/inbox/health only. Publishing stays Thursday's
 *     job (refresh.ts) through the judge and the publish bar. What the daily poll buys is
 *     ARRIVAL-DATE TRUTH (firstSeen at daily resolution instead of rounded to a Thursday),
 *     an always-current candidate inbox for the board, and a health record that makes a dead
 *     source visible in days instead of whenever someone notices the deck feels thin.
 *   · FAILURES ARE EXPECTED OPERATING CONDITIONS (the brief's own words) — every adapter already
 *     returns [] on any error; a zero simply lands in the health file, where three in a row
 *     raises a visible alert on the curation board. Nothing here throws for a source being down.
 */
import { CITIES, type City } from '../src/data/cities'
import type { Pick } from '../src/types'
import { dedupe, titleKey, tokKey } from './lib/pipeline'
import { fixWhen, whenIsPast, whenLooksBroken } from '../src/lib/when'
import { mergeSightings, pruneRegistry, buildInbox, appendRun, type SeenRegistry, type HealthFile } from './lib/ingest'
import { rssExtract } from './adapters/rss'
import { iamsterdamExtract } from './adapters/iamsterdam'
import { raExtract } from './adapters/ra'
import { ROSTERS } from './roster'

const ONLY_CITY = process.argv.find((a) => a.startsWith('--city='))?.split('=')[1]
const OUT_DIR = `${import.meta.dir}/../public/data`

async function loadJson<T>(path: string, fallback: T): Promise<T> {
  try { return await Bun.file(path).json() } catch { return fallback }
}

async function ingestCity(city: City) {
  console.log(`\n● ${city.label} (daily ingest)`)
  const today = new Date().toISOString().slice(0, 10)

  // PULL — keyless sources only, each logged by name so the health file can tell them apart.
  const bySource: Record<string, Pick[]> = {}
  for (const s of ROSTERS[city.key]?.filter((r) => r.type === 'rss') ?? []) {
    bySource[s.name] = await rssExtract(s)
  }
  bySource['I amsterdam'] = await iamsterdamExtract(city.key)
  bySource['Resident Advisor'] = await raExtract(city.key)

  let pool = Object.values(bySource).flat()
    .map((p) => (p.when ? { ...p, when: fixWhen(p.when) } : p))
    .filter((p) => !whenIsPast(p.when) && !whenLooksBroken(p.when))
  pool = dedupe(pool)   // cross-source fold — corroboration counts as buzz here exactly as in refresh
  for (const [name, picks] of Object.entries(bySource)) console.log(`  ${name.padEnd(18)} ${picks.length}`)

  // THE SEEN REGISTRY — merge today's sightings (min-date rule), prune the tail.
  const regPath = `${OUT_DIR}/seen.${city.key}.json`
  const reg0 = await loadJson<SeenRegistry>(regPath, { v: 1, seen: {} })
  const freshKeys = pool.map((p) => titleKey(p.title)).filter((k) => !reg0.seen[k])
  const reg = pruneRegistry(mergeSightings(reg0, pool.map((p) => titleKey(p.title)), today), today)
  await Bun.write(regPath, JSON.stringify(reg, null, 1))

  // THE INBOX — fresh finds the board can't already see anywhere else.
  const feed = await loadJson<{ picks?: Pick[] }>(`${OUT_DIR}/picks.${city.key}.json`, {})
  const pending = await loadJson<{ pending?: Pick[] }>(`${OUT_DIR}/pending.${city.key}.json`, {})
  const bench = await loadJson<{ candidates?: Pick[] }>(`${OUT_DIR}/candidates.${city.key}.json`, {})
  const known = new Set(
    [...(feed.picks ?? []), ...(pending.pending ?? []), ...(bench.candidates ?? [])].map((p) => titleKey(p.title)),
  )
  // tokKey too: the drop box and the board match on tokKey — a retitled twin must not re-inbox
  const knownTok = new Set([...(feed.picks ?? []), ...(pending.pending ?? [])].map((p) => tokKey(p.title)))
  const inbox = buildInbox(pool, reg, known, titleKey, today).filter((p) => !knownTok.has(tokKey(p.title)))
  await Bun.write(`${OUT_DIR}/inbox.${city.key}.json`, JSON.stringify(
    { generatedAt: new Date().toISOString(), count: inbox.length, inbox }, null, 1))

  // HEALTH — the run's per-source yields + recomputed alerts.
  const healthPath = `${OUT_DIR}/ingest-health.${city.key}.json`
  const health0 = await loadJson<HealthFile>(healthPath, { v: 1, runs: [], alerts: [] })
  const health = appendRun(health0, {
    date: today, kind: 'daily',
    sources: Object.fromEntries(Object.entries(bySource).map(([n, ps]) => [n, ps.length])),
    fresh: freshKeys.length,
  })
  await Bun.write(healthPath, JSON.stringify(health, null, 1))

  console.log(`  → seen ${Object.keys(reg.seen).length} titles (${freshKeys.length} new today) · inbox ${inbox.length} · alerts ${health.alerts.length}`)
  for (const a of health.alerts) console.log(`  ⚠ ${a.detail}`)
}

const PAUSED = new Set(['new-orleans'])
const targets = CITIES.filter((c) => (ONLY_CITY ? c.key === ONLY_CITY : !PAUSED.has(c.key)))
for (const c of targets) await ingestCity(c)
console.log('\n✓ ingest done')
