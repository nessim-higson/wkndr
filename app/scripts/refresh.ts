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
import { dedupe, balanceByCategory, isGoodImage, fetchOgImage, wikiImage, webImage, whenIsPast, whenBeforeWeekend, upcomingWeekend, linkOk, mapLimit, titleKey } from './lib/pipeline'
import { fixWhen } from '../src/lib/when'
import { songkickAdapter } from './adapters/songkick'
import { llmExtract } from './adapters/llm'
import { websearchExtract } from './adapters/websearch'
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

  // NOVELTY — read LAST week's feed (the file we're about to overwrite) so we can lead with what's
  // genuinely NEW this week. Returning users should see fresh content first, not the same deck.
  let seenLastWeek = new Set<string>()
  try {
    const prior = await Bun.file(`${OUT_DIR}/picks.${city.key}.json`).json()
    seenLastWeek = new Set<string>((prior.picks ?? []).map((p: Pick) => titleKey(p.title)))
    console.log(`  novelty:  ${seenLastWeek.size} titles seen last week (new ones will lead)`)
  } catch { /* first run / no prior feed */ }

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
    // WEB SEARCH — the fresh-event engine: finds what's ACTUALLY on this weekend via live search
    // (catches the JS-rendered listings the scrape above can't see). Same key.
    const web = await websearchExtract(city.key, city.name)
    fromRoster.push(...web)
    console.log(`  search:   ${web.length} picks via web search`)
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
  const isLive = (p: Pick) => p.id.startsWith('llm-') || p.id.startsWith('web-')

  // DROP STALE — past-dated picks (hardcoded canon dates that have rolled by, or LLM picks that
  // scraped an already-finished event). Evergreen "Daily"/"Always" whens are kept.
  {
    const before = picks.length
    picks = picks.filter((p) => !whenIsPast(p.when))
    if (before !== picks.length) console.log(`  stale:    dropped ${before - picks.length} past-dated picks`)
  }

  // WEEKEND FOCUS — this is a weekend app. Drop dated weekday one-offs that finish before the
  // coming weekend (evergreen restaurants/museums + weekend-or-later events stay), so a Monday
  // feed points at Sat–Sun, not at today.
  {
    const wk = upcomingWeekend()
    const before = picks.length
    picks = picks.filter((p) => !whenBeforeWeekend(p.when))
    const label = `${wk.sat.toLocaleDateString('en', { day: 'numeric', month: 'short' })}–${wk.sun.toLocaleDateString('en', { day: 'numeric', month: 'short' })}`
    if (before !== picks.length) console.log(`  weekend:  dropped ${before - picks.length} pre-weekend one-offs (focus ${label})`)
  }

  // NORMALIZE WEEKDAYS — recompute the day-of-week in every `when` from its actual date, so a
  // source that wrote "Sun 8 Jun" when the 8th is a Monday is corrected in the stored feed too.
  for (const p of picks) if (p.when) p.when = fixWhen(p.when)

  // VALIDATE LINKS — LLM picks sometimes carry a GUESSED url slug that 404s, which both dead-ends
  // the card's "open at" and starves the og:image pass (→ a wrong web image). Any live link that
  // doesn't resolve falls back to its source page URL (always real).
  {
    const srcUrl = new Map(roster.map((s) => [s.name, s.url]))
    let fixed = 0
    await mapLimit(picks.filter(isLive), 6, async (p) => {
      if (p.link && !(await linkOk(p.link))) { const u = srcUrl.get(p.source); if (u && u !== p.link) { p.link = u; fixed++ } }
    })
    if (fixed) console.log(`  links:    ${fixed} dead LLM links → source URL`)
  }

  // PHOTO-FIRST IMAGE PASS. Every live pick must end up with a real, RELEVANT photo or it's dropped
  // (no category-gradient posters, no generic page-hero fallbacks). Three sources, in order:
  //   1. the page photo the LLM matched to this item (validate it),
  //   2. else the og:image of the pick's OWN link (a Songkick concert page's og = the artist),
  //   3. then drop any image reused across ≥2 live picks (a shared listing banner = generic).
  // Curated canon (all imaged) is the floor, so the deck stays full.
  if (!SKIP_IMAGES) {
    const live = picks.filter(isLive)
    const PERFORMER = new Set(['live', 'stage'])
    // A web-search EVENT (festival/market/garden-days — not a named performer) has NO reliable
    // automated photo. Open-web search returns the wrong subject ("Open Garden Days" → a Pride
    // photo) AND the source's own og:image is often a generic civic hero (I amsterdam serves its
    // Canal Parade shot as the page image). Both pass every quality screen yet are simply WRONG.
    // So these get NO guessed image — they render a clean category poster. Named performers +
    // scraped picks still try og → web → wiki (a disambiguated act name resolves reliably).
    const genericWebEvent = (p: Pick) => p.id.startsWith('web-') && !PERFORMER.has(p.category)

    // THEMED-PHOTO BANK — the hand-authored canon is fully imaged with curated, proven,
    // category-tagged PHOTOGRAPHS. Borrow them, by category, as the final fallback so an imageless
    // live pick renders a real, category-appropriate photo (a market stall, a gig crowd, a gallery)
    // instead of a flat text-on-colour poster. This is the reliable image source for generic web
    // events (festivals/markets/garden-days) that have no trustworthy per-event photo — atmospheric
    // and always on-theme, never a wrong subject (the Pride-on-garden-days class of error). Chosen
    // deterministically by id so a given event keeps the same photo run-to-run.
    const bank: Record<string, string[]> = {}
    for (const p of city.picks) if (p.image && p.image.startsWith('http')) (bank[p.category] ??= []).push(p.image)
    const bankPool = [...new Set(Object.values(bank).flat())]
    const idHash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }
    const themedPhoto = (p: Pick) => { const pool = bank[p.category]?.length ? bank[p.category] : bankPool; return pool.length ? pool[idHash(p.id) % pool.length] : undefined }

    await mapLimit(live.filter((p) => p.image), 5, async (p) => { if (!(await isGoodImage(p.image!))) p.image = undefined })
    await mapLimit(live.filter((p) => !p.image && p.link && !genericWebEvent(p)), 6, async (p) => { const img = await fetchOgImage(p.link); if (img) p.image = img })

    // WEB IMAGE SEARCH (DuckDuckGo, keyless) — subject-accurate photo from the open web for
    // performers/scraped picks. Performers get a DISAMBIGUATING term ("band"/"live") so an
    // ambiguous name resolves to the act; venues → name + city + a category hint.
    const CAT_HINT: Record<string, string> = { eat: 'restaurant', drink: 'bar', art: 'museum gallery', market: 'market', daytrip: '', out: '' }
    const ACT_HINT: Record<string, string> = { live: 'band concert', stage: 'theatre show' }
    let webGot = 0
    await mapLimit(live.filter((p) => !p.image && !genericWebEvent(p)), 2, async (p) => {
      const q = PERFORMER.has(p.category)
        ? `${p.title.split(/\s*[:–—]\s*/)[0].split(/\s+(?:and|&|\+|x|w\/|ft\.?|feat\.?|with|presents)\s+/i)[0].trim()} ${ACT_HINT[p.category] ?? ''}`.trim()
        : `${p.title} ${city.name} ${CAT_HINT[p.category] ?? ''}`.replace(/\s+/g, ' ').trim()
      const img = await webImage(q)
      if (img) { p.image = img; webGot++ }
    })
    if (webGot) console.log(`  web:      +${webGot} live picks imaged via web search`)

    // last-resort backup for named entities the web search missed (clean Wikimedia portraits)
    let wikiGot = 0
    await mapLimit(live.filter((p) => !p.image && PERFORMER.has(p.category)), 2, async (p) => {
      const q = p.title.split(/\s*[:–—]\s*/)[0].split(/\s+(?:and|&|\+|x|w\/|ft\.?|feat\.?|with|presents)\s+/i)[0].trim()
      const img = await wikiImage(q)
      if (img && (await isGoodImage(img))) { p.image = img; wikiGot++ }
    })
    if (wikiGot) console.log(`  wiki:     +${wikiGot} via wikipedia backup`)
    const seen = new Map<string, number>()
    for (const p of live) if (p.image) seen.set(p.image, (seen.get(p.image) || 0) + 1)
    for (const p of live) if (p.image && (seen.get(p.image) || 0) > 1) p.image = undefined   // shared hero = generic

    // BANK FILL — anything still imageless (generic web events, or a pick that just lost a shared
    // hero) gets a real category photo from the canon bank. Runs AFTER the dedup so these curated
    // borrows are never stripped. Result: every live card carries a photograph, none are text-on-colour.
    let banked = 0
    for (const p of live) if (!p.image) { const img = themedPhoto(p); if (img) { p.image = img; banked++ } }
    if (banked) console.log(`  bank:     +${banked} imageless live picks → themed canon photo`)

    // safety net: with the bank, no live pick should be imageless; drop any that somehow still is.
    const before = picks.length
    picks = picks.filter((p) => !isLive(p) || p.image)
    console.log(`  images:   ${live.filter((p) => p.image).length}/${live.length} live imaged${before !== picks.length ? ` · dropped ${before - picks.length} imageless` : ''}`)
  }
  // belt-and-suspenders: any remaining http:// image (e.g. an old canon URL) → https, else it's a
  // mixed-content blank card on the https site.
  for (const p of picks) if (p.image && p.image.startsWith('http://')) p.image = 'https://' + p.image.slice(7)

  // RANK by what's-talked-about (buzz) then freshness. Cap per category only when there's a real
  // live pull to balance — a failed/empty pull must never trim the curated canon.
  // NOVELTY-FIRST rank: genuinely-new-this-week picks lead, THEN buzz, THEN freshness. Because the
  // per-category cap below keeps the top N per category, novel events also SURVIVE over stale
  // repeats — so a returning user gets a feed that actually turned over (the retention lever).
  const isNew = (p: Pick) => isLive(p) && !seenLastWeek.has(titleKey(p.title))
  const novelCount = picks.filter(isNew).length
  picks.sort((a, b) =>
    (isNew(b) ? 1 : 0) - (isNew(a) ? 1 : 0) ||
    (b.buzz ?? 1) - (a.buzz ?? 1) ||
    (FRESH_RANK[b.freshness] - FRESH_RANK[a.freshness]))
  if (picks.filter(isLive).length > 6) {
    const balanced = balanceByCategory(picks, 8)   // a touch higher (was 6) so more fresh events survive
    console.log(`  ranked:   ${picks.length} → ${balanced.length} after per-category cap · ${novelCount} new this week`)
    picks = balanced
  } else {
    console.log(`  ranked:   ${picks.length} (canon floor) · ${novelCount} new this week`)
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
