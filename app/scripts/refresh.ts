/**
 * WKNDR refresh — the living-content pipeline (Phase 2: LLM-assisted manual run).
 *
 *   bun run refresh                # all cities: seed + live adapters → og:image enrich → picks.json
 *   bun run refresh --no-images    # skip the network og:image pass (fast, offline)
 *   bun run refresh --city=amsterdam
 *   SONGKICK_API_KEY=xxx bun run refresh   # also pull live gigs from Songkick
 *
 * Writes app/public/data/picks.<city>.json, which the app fetches at runtime (so events can
 * update without a code change / rebuild). With no key + --no-images it's fully offline and
 * just republishes the bundled seed through the real pipeline — proving the spine end to end.
 */
import { CITIES, type City } from '../src/data/cities'
import type { Pick } from '../src/types'
import { dedupe, fetchOgImage, mapLimit } from './lib/pipeline'
import { songkickAdapter } from './adapters/songkick'

const args = process.argv.slice(2)
const SKIP_IMAGES = args.includes('--no-images')
const ONLY_CITY = args.find((a) => a.startsWith('--city='))?.split('=')[1]
const KEY = process.env.SONGKICK_API_KEY
const OUT_DIR = `${import.meta.dir}/../public/data`

async function buildCity(city: City) {
  console.log(`\n● ${city.label}`)

  // FETCH + NORMALIZE — every adapter emits Pick[] in our shape.
  const seed = city.picks                                   // bundled canon (always available)
  let live: Pick[] = []
  try {
    live = await songkickAdapter(city.songkickMetroId, KEY)
    console.log(`  songkick: ${KEY ? `${live.length} live gigs` : 'skipped (no SONGKICK_API_KEY)'}`)
  } catch (e) {
    console.log(`  songkick: failed — ${(e as Error).message} (continuing on seed)`)
  }
  console.log(`  seed:     ${seed.length} bundled picks`)

  // DEDUPE across adapters (same gig from seed + Songkick → one record, credits unioned).
  let picks = dedupe([...seed, ...live])

  // ENRICH — fill MISSING images from each source page's og:image (keeps the ones we have).
  if (!SKIP_IMAGES) {
    const missing = picks.filter((p) => !p.image && p.link)
    if (missing.length) {
      let got = 0
      await mapLimit(missing, 6, async (p) => {
        const img = await fetchOgImage(p.link)
        if (img) { p.image = img; got++ }
      })
      console.log(`  og:image: filled ${got}/${missing.length} missing`)
    }
  }

  // PUBLISH — the app reads this at runtime.
  const feed = {
    city: city.key,
    label: city.label,
    generatedAt: new Date().toISOString(),
    seed: !!city.seed,
    count: picks.length,
    picks,
  }
  await Bun.write(`${OUT_DIR}/picks.${city.key}.json`, JSON.stringify(feed, null, 2))
  console.log(`  → wrote picks.${city.key}.json (${picks.length} picks)`)
}

const targets = CITIES.filter((c) => !ONLY_CITY || c.key === ONLY_CITY)
console.log(`WKNDR refresh · ${targets.length} cit${targets.length === 1 ? 'y' : 'ies'}${KEY ? ' · Songkick live' : ''}${SKIP_IMAGES ? ' · no images' : ''}`)
for (const c of targets) await buildCity(c)
console.log('\n✓ done')
