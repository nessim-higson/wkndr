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
import { dedupe, balanceByCategory, isGoodImage, fetchOgImage, wikiImage, webImageCandidates, verifyImageForEvent, pexelsImage, whenIsPast, whenBeforeWeekend, upcomingWeekend, linkOk, mapLimit, titleKey } from './lib/pipeline'
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

    // CANDIDATE-GATHER + VISION VERIFY — the agentic image step. For every imageless live pick we
    // gather real-photo CANDIDATES (open-web image search by name; + the act's Wikipedia portrait for
    // performers; + the event page's og:image for non-performer scraped picks), then a Claude VISION
    // call LOOKS at them and picks the one that genuinely depicts the event — or rejects them all, so
    // a wrong subject never lands (Celeste → a Japan travel blog, "Open Garden Days" → a Pride parade).
    // Whatever it can't verify falls through to Pexels themed stock → bank. With no ANTHROPIC_API_KEY
    // it degrades to the old behaviour (top-ranked candidate, unverified).
    const CAT_HINT: Record<string, string> = { eat: 'restaurant', drink: 'bar', art: 'exhibition', market: 'market', daytrip: '', out: '' }
    const ACT_HINT: Record<string, string> = { live: 'live music', stage: 'theatre' }
    const actName = (p: Pick) => p.title.split(/\s*[:–—]\s*/)[0].split(/\s+(?:and|&|\+|x|w\/|ft\.?|feat\.?|with|presents)\s+/i)[0].trim()
    const visionOn = !!process.env.ANTHROPIC_API_KEY
    let visGot = 0, visRej = 0
    await mapLimit(live.filter((p) => !p.image), 2, async (p) => {
      const perf = PERFORMER.has(p.category)
      const q = perf
        ? `${actName(p)} ${ACT_HINT[p.category] ?? ''}`.trim()
        : `${p.title} ${city.name} ${CAT_HINT[p.category] ?? ''}`.replace(/\s+/g, ' ').trim()
      // For performers, lead with the Wikipedia portrait — it's the most reliable + always
      // downloadable (Wikimedia doesn't hotlink-block), so it survives the verifier's 4-candidate
      // download cap even when web hits are on strict hosts (Billboard/Rolling Stone 403 our fetch).
      const cands: string[] = []
      if (perf) { const wk = await wikiImage(actName(p)); if (wk && (await isGoodImage(wk))) cands.push(wk) }
      cands.push(...await webImageCandidates(q, 5))
      if (!perf && !genericWebEvent(p) && p.link) { const og = await fetchOgImage(p.link); if (og) cands.push(og) }
      if (!cands.length) return
      const best = visionOn ? await verifyImageForEvent(cands, p, city.name) : cands[0]
      if (best) { p.image = best; visGot++ } else if (visionOn) visRej++
    })
    console.log(`  vision:   +${visGot} live picks imaged via verified search${visRej ? ` · ${visRej} rejected → themed stock` : ''}`)

    const seen = new Map<string, number>()
    for (const p of live) if (p.image) seen.set(p.image, (seen.get(p.image) || 0) + 1)
    for (const p of live) if (p.image && (seen.get(p.image) || 0) > 1) p.image = undefined   // shared hero = generic

    // THEMED STOCK (Pexels) — the vivid, on-theme layer. For every pick still imageless (generic web
    // events, or a performer the og/web/wiki passes missed) query Pexels by the event's OWN theme,
    // with a category-hint fallback so a too-niche title still resolves. Vibrant + relevant + never a
    // wrong civic subject — this is what replaces the dull/mismatched canon-borrow. Skipped with no
    // PEXELS_API_KEY (the bank below then carries it, so a missing key never blanks a card).
    const PEX_HINT: Record<string, string> = { art: 'art exhibition gallery', live: 'concert crowd lights', stage: 'theatre stage performance', eat: 'restaurant plated food', drink: 'bar cocktails', market: 'open air market stalls', out: 'people outdoors park summer', daytrip: 'dutch landscape countryside' }
    const idHash2 = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }
    const pexQuery = (p: Pick) => `${p.title.split(/\s*[:–—|·]\s*/)[0].replace(/\b(19|20)\d{2}\b/g, '').replace(/\b(editie|edition|vol\.?|#?\d+(st|nd|rd|th)?)\b/gi, '').trim()} ${PEX_HINT[p.category] ?? ''}`.replace(/\s+/g, ' ').trim()
    if (process.env.PEXELS_API_KEY) {
      let pexGot = 0
      await mapLimit(live.filter((p) => !p.image), 3, async (p) => {
        const salt = idHash2(p.id)
        const img = (await pexelsImage(pexQuery(p), salt)) || (await pexelsImage(PEX_HINT[p.category] ?? p.category, salt))
        if (img) { p.image = img; pexGot++ }
      })
      if (pexGot) console.log(`  pexels:   +${pexGot} live picks imaged via themed stock`)
    }

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

  // SOURCE TRUST — Ness's ranked sources (LBB > I amsterdam > Resident Advisor > Volkskrant) lead the
  // feed. First DROP low-confidence web picks: cheesy club self-promo (Escape), generic aggregators
  // (concerts50, Songkick metro index), and items whose only link is a month-listing INDEX rather than
  // a specific event page — that class produced the wrong-date/wrong-image "Mirror Floor" pick.
  const srcRank = (p: Pick) => {
    const s = `${p.source || ''} ${p.link || ''}`.toLowerCase()
    if (/little black book|yourlittleblackbook/.test(s)) return 4
    if (/i ?amsterdam|iamsterdam/.test(s)) return 3
    if (/resident advisor|residentadvisor|\bra\.co\b/.test(s)) return 2
    if (/volkskrant/.test(s)) return 1
    return 0
  }
  // Narrow to genuinely low-value sources only: a cheesy club's self-promo (Escape), generic
  // aggregators (concerts50), the Songkick METRO index (non-specific), and the AmsterdamTips month
  // INDEX (a dead-end /whats-on-amsterdam-<month> page → the wrong-date 'Mirror Floor' culprit).
  // Do NOT match a bare "/whats-on" path — trusted venues (I amsterdam, Eye Filmmuseum) host their
  // REAL event pages under it, and we must keep those.
  const LOW_QUALITY = /escape\.nl|escape amsterdam|concerts50|songkick\.com\/metro|amsterdamtips\.com\/whats-on/i
  {
    const before = picks.length
    picks = picks.filter((p) => !isLive(p) || !LOW_QUALITY.test(`${p.source || ''} ${p.link || ''}`))
    if (before !== picks.length) console.log(`  trust:    dropped ${before - picks.length} low-confidence web picks (self-promo / index links)`)
  }

  // RANK: TRUSTED SOURCE first (Ness's order), then genuinely-new-this-week, then buzz, then freshness.
  // The per-category cap below keeps the top N per category, so each category is LED by the trusted
  // sources; curated canon (source rank 0) backfills behind them.
  const isNew = (p: Pick) => isLive(p) && !seenLastWeek.has(titleKey(p.title))
  const novelCount = picks.filter(isNew).length
  picks.sort((a, b) =>
    srcRank(b) - srcRank(a) ||
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

// PAUSED cities — tabled, not in the live MVP (Amsterdam-only). The pipeline skips them so we don't
// spend API on a city no one sees. Pass --city=new-orleans to build one explicitly (manual override).
const PAUSED = new Set(['new-orleans'])
const targets = CITIES.filter((c) => (ONLY_CITY ? c.key === ONLY_CITY : !PAUSED.has(c.key)))
console.log(`WKNDR refresh · ${targets.length} cit${targets.length === 1 ? 'y' : 'ies'}` +
  `${LLM_ON ? ' · LLM on' : ' · LLM off'}${SK_KEY ? ' · Songkick' : ''}${SKIP_IMAGES ? ' · no images' : ''}`)
for (const c of targets) await buildCity(c)
console.log('\n✓ done')
