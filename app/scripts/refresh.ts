/**
 * WKNDR refresh — the living-content pipeline.
 *
 *   bun run refresh                      # all cities: canon + roster (LLM/RSS) → dedupe → buzz
 *                                        #   → balance → og:image → picks.json
 *   bun run refresh --city=amsterdam
 *   bun run refresh --no-images          # skip the network og:image pass
 *   ANTHROPIC_API_KEY=… bun run refresh  # turns ON the LLM extractor (the diverse/interesting pull)
 *   SONGKICK_API_KEY=…  bun run refresh  # also pull clean dated gigs from Songkick
 *
 * Runs ON DEMAND (this command, or the workflow's "Run workflow" button) and WEEKLY (the cron in
 * .github/workflows/refresh.yml). Writes app/public/data/picks.<city>.json, which the app fetches
 * at runtime — so the feed updates with no code change.
 *
 * Sources are the category-spread roster in roster.ts: gigs, films, festivals, food, art (closing
 * soon), kids, members' events… The LLM reads each and extracts the most interesting / timely /
 * exciting items, tagged to our taxonomy. Ranked by BUZZ (how many independent sources flag it).
 * The hand-authored canon (city.picks) is the floor so it's never empty or one-note.
 */
import { CITIES, type City } from '../src/data/cities'
import type { Pick } from '../src/types'
import { dedupe, balanceByCategory, fetchOgImage, mapLimit } from './lib/pipeline'
import { songkickAdapter } from './adapters/songkick'
import { llmExtract } from './adapters/llm'
import { rssExtract } from './adapters/rss'
import { ROSTERS } from './roster'

const args = process.argv.slice(2)
const SKIP_IMAGES = args.includes('--no-images')
const ONLY_CITY = args.find((a) => a.startsWith('--city='))?.split('=')[1]
const SK_KEY = process.env.SONGKICK_API_KEY
const LLM_ON = !!process.env.ANTHROPIC_API_KEY
const OUT_DIR = `${import.meta.dir}/../public/data`

const FRESH_RANK: Record<string, number> = { new: 3, ending: 3, weekend: 2, always: 1 }

async function buildCity(city: City) {
  console.log(`\n● ${city.label}`)
  const roster = ROSTERS[city.key] ?? []

  // FETCH + NORMALIZE — every adapter emits Pick[] in our shape.
  const canon = city.picks                                          // hand-authored floor (always)
  const fromRoster: Pick[] = []

  // keyless RSS sources (the always-on floor) + LLM sources (the interesting/diverse pull)
  const rssSrc = roster.filter((s) => s.type === 'rss')
  const llmSrc = roster.filter((s) => s.type === 'llm')

  for (const r of (await mapLimit(rssSrc, 4, (s) => rssExtract(s)))) fromRoster.push(...r)
  console.log(`  rss:      ${rssSrc.length} feeds → ${fromRoster.length} picks (keyless)`)

  if (LLM_ON) {
    const got = await mapLimit(llmSrc, 1, (s) => llmExtract(city.name, s))   // sequential — the gate paces the API calls
    const n = got.reduce((a, b) => a + b.length, 0)
    got.forEach((g) => fromRoster.push(...g))
    console.log(`  llm:      ${llmSrc.length} sources → ${n} picks`)
  } else {
    console.log(`  llm:      skipped (no ANTHROPIC_API_KEY) — set it to pull the diverse feed`)
  }

  // optional clean gigs
  if (SK_KEY) {
    try { const g = await songkickAdapter(city.songkickMetroId, SK_KEY); fromRoster.push(...g); console.log(`  songkick: ${g.length} gigs`) }
    catch (e) { console.log(`  songkick: failed — ${(e as Error).message}`) }
  }
  console.log(`  canon:    ${canon.length} bundled picks (floor)`)

  // DEDUPE (sets buzz = distinct sources) — roster first so live picks win the merge over canon.
  let picks = dedupe([...fromRoster, ...canon])

  // RANK by what's-talked-about (buzz) then freshness. Only cap per category when there's a real
  // live pull to balance — never trim the curated canon when running keyless.
  picks.sort((a, b) => (b.buzz ?? 1) - (a.buzz ?? 1) || (FRESH_RANK[b.freshness] - FRESH_RANK[a.freshness]))
  if (fromRoster.length > 8) {   // only cap when there's a real live pull to balance — a failed/empty pull must NOT trim the canon
    const balanced = balanceByCategory(picks, 6)
    console.log(`  ranked:   ${picks.length} deduped → ${balanced.length} after per-category cap`)
    picks = balanced
  } else {
    console.log(`  ranked:   ${picks.length} (canon floor; no live pull to balance)`)
  }

  // ENRICH — fill MISSING images from each source page's og:image.
  if (!SKIP_IMAGES) {
    const missing = picks.filter((p) => !p.image && p.link)
    let got = 0
    if (missing.length) await mapLimit(missing, 6, async (p) => { const img = await fetchOgImage(p.link); if (img) { p.image = img; got++ } })
    console.log(`  og:image: filled ${got}/${missing.length} missing`)
  }

  // PUBLISH — the app reads this at runtime.
  const feed = { city: city.key, label: city.label, generatedAt: new Date().toISOString(), live: LLM_ON, count: picks.length, picks }
  await Bun.write(`${OUT_DIR}/picks.${city.key}.json`, JSON.stringify(feed, null, 2))
  console.log(`  → wrote picks.${city.key}.json (${picks.length} picks)`)
}

const targets = CITIES.filter((c) => !ONLY_CITY || c.key === ONLY_CITY)
console.log(`WKNDR refresh · ${targets.length} cit${targets.length === 1 ? 'y' : 'ies'}` +
  `${LLM_ON ? ' · LLM on' : ' · LLM off'}${SK_KEY ? ' · Songkick' : ''}${SKIP_IMAGES ? ' · no images' : ''}`)
for (const c of targets) await buildCity(c)
console.log('\n✓ done')
