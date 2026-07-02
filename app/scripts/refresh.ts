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
import { dedupe, balanceByCategory, isGoodImage, isPortraitImage, imageBroken, urlLooksNonPhoto, imageIsCardworthy, fetchEventImage, toPortrait, wikiImage, webImageCandidates, verifyImageForEvent, pexelsImage, whenIsPast, whenBeforeWeekend, upcomingWeekend, linkOk, mapLimit, titleKey } from './lib/pipeline'
import { fixWhen, latestDateOf } from '../src/lib/when'
import { songkickAdapter } from './adapters/songkick'
import { llmExtract } from './adapters/llm'
import { websearchExtract } from './adapters/websearch'
import { editorialScores } from './adapters/editor'
import { raExtract } from './adapters/ra'
import { iamsterdamExtract } from './adapters/iamsterdam'
import { curatedImage } from './curated'
import { heroPicks } from './heroes'
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

  // I AMSTERDAM — the deterministic VARIETY engine: The Feed Factory's schema.org Event JSON-LD across 7
  // categories (exhibitions, festivals, concerts, theatre, food, nightlife, shopping). Keyless. This is what
  // makes week-over-week content varied by construction instead of a web-search lucky draw.
  const iams = await iamsterdamExtract(city.key)
  fromRoster.push(...iams)
  if (iams.length) console.log(`  iams:     ${iams.length} events (I amsterdam · deterministic variety)`)

  // RESIDENT ADVISOR — keyless structured club/electronic listings: exact dates, real flyer images, and an
  // `attending` popularity signal. Ness's #3 trusted source; runs alongside RSS (no API key needed).
  const ra = await raExtract(city.key)
  fromRoster.push(...ra)
  if (ra.length) console.log(`  ra:       ${ra.length} club nights (Resident Advisor)`)

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

  // FRESHNESS FROM DATES — model tags lie ("ENDING SOON" on a run that starts tomorrow and ends in
  // September). Derive the label from the pick's REAL dates instead: a live pick whose run extends
  // more than ~3 weeks out is wallpaper — an always-on listing, not a weekend event — so it's
  // re-labelled 'always' (freshBoost 0.6, ranks below genuine one-offs; the flat/unsurprising-deck
  // fix). And 'ending' is only honest within ~2 weeks of the actual end. Canon is left alone.
  {
    const now = new Date()
    let demoted = 0
    for (const p of picks) {
      if (!isLive(p) || !p.when) continue
      const latest = latestDateOf(p.when, now)
      if (!latest) continue
      const daysOut = (latest.getTime() - now.getTime()) / 864e5
      if (daysOut > 21 && p.freshness !== 'always') { p.freshness = 'always'; demoted++ }
      else if (p.freshness === 'ending' && daysOut > 14) { p.freshness = 'weekend'; demoted++ }
    }
    if (demoted) console.log(`  fresh:    ${demoted} long-run picks re-labelled from real dates (wallpaper ↓, one-offs ↑)`)
  }

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
    // TRUSTED IMAGES — structured sources (I amsterdam, RA) ship the ORGANISER'S real per-event image (a film
    // poster, a flyer — often already portrait + hi-res, ideal for the card). Re-processing them was the
    // sabotage: the resolution floor nulled them and the gather/vision-QA replaced them with SCRAPED junk
    // (Agatha's Almanac's poster → a wide EYE-building sky-crop). So we TRUST these images: skip the null/gather/
    // shared-dedup/vision-QA and just portrait-wrap them. Only the dead-URL sweep still applies (→ bank if 404).
    const trustedImg = (p: Pick) => /^web-(iams|ra)-/.test(p.id) && !!p.image
    const PERFORMER = new Set(['live', 'stage'])
    // EVERY imageless live pick now gathers candidates and is VISION-VERIFIED — including generic web
    // events (festival/market/garden-days). They get their OWN event page's image (schema.org Event
    // JSON-LD → og, via fetchEventImage), which is the organizer's per-event photo, plus open-web hits;
    // the vision verifier (below) rejects the wrong-subject class ("Open Garden Days" → a Pride photo),
    // so only a genuine fit lands. isGoodImage already blocks the I amsterdam "Canal Parade" civic hero.

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
    // A bank photo that ACTUALLY LOADS — scans the category pool (then all canon) from the deterministic
    // index, skipping any dead entry, so a fallback can never itself blank. Returns a wsrv-wrapped URL.
    const workingBankPhoto = async (p: Pick, used?: Set<string>): Promise<string | undefined> => {
      const pool = bank[p.category]?.length ? bank[p.category] : bankPool
      for (let i = 0; i < pool.length; i++) {
        const wrapped = toPortrait(pool[(idHash(p.id) + i) % pool.length])
        if (used?.has(wrapped)) continue               // caller is de-duplicating — never hand out a repeat
        if (!(await imageBroken(wrapped))) return wrapped
      }
      return undefined
    }

    // TRUST, BUT SCREEN FOR THE LOGO CLASS — organisers sometimes upload their LOGO/wordmark instead of a
    // photo ("LOGO___WORDMARK_square_black.webp" → a solid-black card). Trusted images stay untouched on
    // SUBJECT (no re-scraping — that was the old sabotage), but two sanity screens apply: (1) keyless URL
    // smell test (logo/wordmark/stock in the filename), (2) a narrow vision check that rejects ONLY
    // logos/flat graphics/blank frames while KEEPING real posters (the Agatha class). Rejects → bank photo.
    {
      let sane = 0
      await mapLimit(live.filter(trustedImg), 3, async (p) => {
        // isGoodImage = logo/stock URL smell + REAL pixel dims (≥700 shortest side — a low-res organiser
        // upload upscaled to the 1200-tall card is mush: the Amsterdamse Bos class) + sane aspect.
        const bad = !(await isGoodImage(p.image!)) || !(await imageIsCardworthy(p.image!))
        if (bad) { const fb = await workingBankPhoto(p); p.image = fb; if (fb) sane++ }
      })
      if (sane) console.log(`  sanity:   ${sane} organiser logos/blank frames → bank photo`)
    }

    await mapLimit(live.filter((p) => p.image && !trustedImg(p)), 5, async (p) => { if (!(await isGoodImage(p.image!))) p.image = undefined })

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

    // PERFORMER PORTRAITS — for a named live/stage act, a tall Wikipedia portrait crops to the portrait
    // card FAR better than a wide concert/og shot, which the smart-crop severs (it chases the stage lights,
    // not the person — Bruno Mars cut off at the edge). Prefer the wiki portrait when it's portrait-oriented
    // + sharp, EVEN over an image the pick already has — but VERIFY it's really this act first (a festival
    // name like "Wonderfeel" can match a wrong wiki portrait): vision confirms the subject when the key is
    // set; without it we only fill an imageless act, never overwrite. Wikimedia never hotlink-blocks.
    let portraits = 0
    await mapLimit(live.filter((p) => PERFORMER.has(p.category)), 2, async (p) => {
      const wk = await wikiImage(actName(p))
      if (!wk || !(await isPortraitImage(wk))) return
      const use = visionOn ? !!(await verifyImageForEvent([wk], p, city.name)) : !p.image
      if (use) { p.image = wk; portraits++ }
    })
    if (portraits) console.log(`  portrait: ${portraits} performer cards → verified Wikipedia portrait`)

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
      if (!perf && p.link) { const og = await fetchEventImage(p.link); if (og) cands.push(og) }
      if (!cands.length) return
      const best = visionOn ? await verifyImageForEvent(cands, p, city.name) : cands[0]
      if (best) { p.image = best; visGot++ } else if (visionOn) visRej++
    })
    console.log(`  vision:   +${visGot} live picks imaged via verified search${visRej ? ` · ${visRej} rejected → themed stock` : ''}`)

    const seen = new Map<string, number>()
    for (const p of live) if (p.image && !trustedImg(p)) seen.set(p.image, (seen.get(p.image) || 0) + 1)
    for (const p of live) if (p.image && !trustedImg(p) && (seen.get(p.image) || 0) > 1) p.image = undefined   // shared hero = generic

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

    // CURATED OVERRIDES — hand-pinned images for hero/recurring events the auto-pipeline gets wrong, applied
    // LAST so they always win (and rescue an event that would otherwise be dropped imageless). See curated.ts.
    let curated = 0
    for (const p of live) { const c = curatedImage(p.title); if (c) { p.image = c; curated++ } }
    if (curated) console.log(`  curated:  ${curated} hero events → hand-pinned image`)

    // PORTRAIT NORMALIZE — reshape EVERY photo (live AND canon) to a tall portrait via the wsrv.nl proxy.
    // Two wins: (1) a landscape source fills the tall cover-card with its salient region centred instead of
    // cropping to a band; (2) wsrv fetches SERVER-SIDE, so a canon image on a hotlink-protected or
    // rate-limited host (pinterest, linkedin, Wikimedia 429…) can no longer BLANK in the user's browser —
    // it always loads from wsrv's CDN. Idempotent (skips already-wrapped). Heroes are wrapped on injection.
    for (const p of picks) if (p.image) p.image = toPortrait(p.image)

    // NO TWO CARDS SHARE A PHOTO — final dedup on the FINAL urls, across ALL live picks (trusted included:
    // a reseller submits the same photo to several Feed Factory listings, and two web-search picks can land
    // on the same blog image — "Love on the Canals" and "Rembrandt & Life" shipped identical STRAAT shots).
    // Keep the first (feed order = best-ranked), re-image the rest from the bank, never repeating a photo.
    {
      const used = new Set<string>()
      let dupes = 0
      for (const p of picks) {
        if (!p.image) continue
        if (used.has(p.image)) {
          if (isLive(p)) { const fb = await workingBankPhoto(p, used); if (fb) { p.image = fb; dupes++ } else { p.image = undefined } }
        }
        if (p.image) used.add(p.image)
      }
      if (dupes) console.log(`  unique:   ${dupes} duplicate card photos → distinct bank photos`)
    }

    // FINAL VALIDATION — fetch EVERY published image (live + canon) and replace any DEFINITIVELY broken one
    // (a dead source, a wsrv 4xx, a 404 — the things that blank a card) with a bank photo that actually
    // loads. This is the guarantee that the feed never ships a blank card; a transient 429/timeout is kept.
    let revived = 0, lost = 0
    await mapLimit(picks.filter((p) => p.image), 6, async (p) => {
      if (await imageBroken(p.image!)) { const fb = await workingBankPhoto(p); if (fb) { p.image = fb; revived++ } else { p.image = undefined; lost++ } }
    })
    if (revived || lost) console.log(`  validate: ${revived} broken images → working bank photo${lost ? ` · ${lost} unfixable` : ''}`)

    // VISION QA — the image arm of the publish gate, and the end of image whack-a-mole. Look at EVERY live
    // pick's FINAL (portrait-wrapped) image and confirm with Claude vision that it's a real photo that
    // genuinely suits the event. Anything blank / grey-placeholder / watermarked / a poster / a wrong subject
    // is swapped for a bank photo that ALSO passes the same check — so a bad image can't reach a card whatever
    // the failure mode (a class the HTTP-level checks above can't catch). Canon is hand-curated → trusted, not
    // re-judged. Needs ANTHROPIC_API_KEY; never-throws; ~cents/run (one Haiku vision call per live pick).
    if (visionOn) {
      let qa = 0
      await mapLimit(live.filter((p) => p.image && !trustedImg(p)), 3, async (p) => {
        if (await verifyImageForEvent([p.image!], p, city.name)) return   // vision confirms it fits → keep
        // rejected — try bank photos until one both loads AND passes vision (else leave it for the safety net)
        const pool = bank[p.category]?.length ? bank[p.category] : bankPool
        for (let i = 0; i < Math.min(pool.length, 4); i++) {
          const cand = toPortrait(pool[(idHash(p.id) + i) % pool.length])
          if (!(await imageBroken(cand)) && (await verifyImageForEvent([cand], p, city.name))) { p.image = cand; qa++; return }
        }
        // no vision-approved bank photo — fall back to any loading bank photo rather than blank
        const fb = await workingBankPhoto(p); if (fb) { p.image = fb; qa++ }
      })
      if (qa) console.log(`  vision-qa: ${qa} bad final images → vetted bank photo`)
    }

    // safety net: with the bank, no live pick should be imageless; drop any that somehow still is.
    const before = picks.length
    picks = picks.filter((p) => !isLive(p) || p.image)
    console.log(`  images:   ${live.filter((p) => p.image).length}/${live.length} live imaged${before !== picks.length ? ` · dropped ${before - picks.length} imageless` : ''}`)
  }
  // belt-and-suspenders: any remaining http:// image (e.g. an old canon URL) → https, else it's a
  // mixed-content blank card on the https site.
  for (const p of picks) if (p.image && p.image.startsWith('http://')) p.image = 'https://' + p.image.slice(7)

  // HERO EVENTS — GUARANTEE the confirmed must-sees are in the feed. The web-search adapters are
  // non-deterministic, so a flagship (Bruno Mars at the ArenA) can be surfaced one run and gone the next.
  // Inject any hero not already present (by title key), carrying its hand-picked image (portrait-wrapped
  // here, since it skips the auto image pass above); it auto-expires via the date filters and is exempt from
  // the per-category cap below. A hero the adapters DID find keeps its found record + curated image and is
  // simply not re-injected (and is still cap-exempt). See scripts/heroes.ts.
  const heroKeys = new Set(heroPicks(city.key).map((h) => titleKey(h.title)))
  {
    const present = new Set(picks.map((p) => titleKey(p.title)))
    const inject = heroPicks(city.key)
      .filter((h) => !whenIsPast(h.when) && !whenBeforeWeekend(h.when) && !present.has(titleKey(h.title)))
      .map((h) => ({ ...h, when: fixWhen(h.when), image: h.image ? toPortrait(h.image) : h.image }))
    if (inject.length) { picks = [...inject, ...picks]; console.log(`  heroes:   +${inject.length} guaranteed (${inject.map((h) => h.id.replace('web-hero-', '')).join(', ')})`) }
  }

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

  // SOURCE DIVERSITY — no single source may flood a category. I amsterdam ranks high (srcRank 3) and returns
  // ~46 events, so without a cap it takes nearly every live slot and the feed reads as "the I amsterdam app".
  // Cap it at 5 per category (of the 8 balanceByCategory keeps), leaving real room for RA club nights,
  // web-search serendipity and the other editorial finds. Picks are already best-first, so the strongest survive.
  {
    const CAP_PER_SOURCE = 5
    const n: Record<string, number> = {}
    const before = picks.length
    picks = picks.filter((p) => {
      if (!p.id.startsWith('web-iams-')) return true
      const k = p.category
      n[k] = (n[k] ?? 0) + 1
      return n[k] <= CAP_PER_SOURCE
    })
    if (before !== picks.length) console.log(`  variety:  capped I amsterdam to ${CAP_PER_SOURCE}/category (dropped ${before - picks.length})`)
  }

  if (picks.filter(isLive).length > 6) {
    // HERO EVENTS bypass the cap entirely (found OR injected — matched by title), so a must-see can never be
    // capped out of an over-full category; the rest is balanced as before, with heroes leading.
    const heroesInPool = picks.filter((p) => heroKeys.has(titleKey(p.title)))
    // RA LANE — club nights are a distinct slice of Amsterdam (and RA is a ranked trusted source), but RA's
    // srcRank (2) sits below I amsterdam (3) and LBB (4), so its picks kept losing every `live` slot and the
    // feed shipped with ZERO club nights. Reserve the top 2 RA nights (already popularity-led) cap-exempt.
    const raLane = picks.filter((p) => p.id.startsWith('web-ra-')).slice(0, 2)
    const exempt = new Set([...heroesInPool, ...raLane].map((p) => p.id))
    const balanced = balanceByCategory(picks.filter((p) => !exempt.has(p.id)), 8)
    const out = [...heroesInPool, ...raLane, ...balanced]
    console.log(`  ranked:   ${picks.length} → ${out.length} after per-category cap (${heroesInPool.length} hero-exempt · ${raLane.length} RA lane) · ${novelCount} new this week`)
    picks = out
  } else {
    console.log(`  ranked:   ${picks.length} (canon floor) · ${novelCount} new this week`)
  }

  // EDITORIAL SCORE — a stronger judge (ANTHROPIC_JUDGE_MODEL, default Sonnet) rates the live candidates
  // 0..10 on editorial merit; the score rides on each pick as editorScore and becomes a term in the app's
  // rankPicks (src/weather/modes.ts), so the genuinely-BEST events lead the deck. Facts never touched.
  if (LLM_ON) {
    const liveNow = picks.filter(isLive)
    const scores = await editorialScores(liveNow, city.name)
    if (scores.size) {
      let n = 0
      for (const p of picks) { const s = scores.get(p.id); if (s != null) { p.editorScore = s; n++ } }
      console.log(`  editor:   scored ${n}/${liveNow.length} live picks (judge ${process.env.ANTHROPIC_JUDGE_MODEL || 'claude-sonnet-4-6'})`)
    }
  }

  // PUBLISH GATE — refuse to ship a BROKEN feed. A quiet/thin weekend is NOT broken (it just warns); only the
  // things that would actually embarrass us hard-fail. On failure we ABSTAIN — exit(1) WITHOUT writing — so the
  // last-good feed keeps serving and the failed Actions run emails Ness. A one-line HEALTH summary always lands
  // in the run's step-summary (the email he already gets), so the pipeline reports its own health — no need to
  // open the app to find blanks/stale dates/missing flagships. Cheap data-only checks (no extra network).
  {
    const past = picks.filter((p) => whenIsPast(p.when))
    const httpImg = picks.filter((p) => p.image && p.image.startsWith('http://'))
    const imagelessLive = picks.filter((p) => isLive(p) && !p.image)
    const heroesMissing = heroPicks(city.key)
      .filter((h) => !whenIsPast(h.when) && !whenBeforeWeekend(h.when))
      .filter((h) => !picks.some((p) => titleKey(p.title) === titleKey(h.title)))
    const liveN = picks.filter(isLive).length
    const catN = new Set(picks.map((p) => p.category)).size

    const fail: string[] = []
    if (picks.length === 0) fail.push('empty feed')
    if (past.length) fail.push(`${past.length} past-dated`)
    if (httpImg.length) fail.push(`${httpImg.length} http (mixed-content) images`)
    if (imagelessLive.length) fail.push(`${imagelessLive.length} imageless live`)
    if (heroesMissing.length) fail.push(`heroes missing: ${heroesMissing.map((h) => titleKey(h.title)).join(', ')}`)
    const warn: string[] = []
    if (liveN < 8) warn.push(`thin live feed (${liveN})`)

    const tag = fail.length ? '❌ BROKEN' : warn.length ? '⚠️ OK' : '✅ HEALTHY'
    const health = `${tag} · ${city.label} · ${picks.length} picks (${liveN} live · ${catN}/9 cats)${warn.length ? ' · warn: ' + warn.join(', ') : ''}${fail.length ? ' · FAIL: ' + fail.join(', ') : ''}`
    console.log(`\n  ${health}`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      try { const f = Bun.file(process.env.GITHUB_STEP_SUMMARY); const prev = (await f.exists()) ? await f.text() : ''; await Bun.write(process.env.GITHUB_STEP_SUMMARY, `${prev}- ${health}\n`) } catch { /* summary is best-effort */ }
    }
    if (fail.length) {
      console.error(`  ✖ publish gate FAILED — abstaining, NOT writing picks.${city.key}.json (last-good keeps serving)`)
      if (process.env.HEALTHCHECK_URL) { try { await fetch(`${process.env.HEALTHCHECK_URL}/fail`, { method: 'POST', body: health }) } catch { /* ignore */ } }
      process.exit(1)
    }
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
// DEAD-MAN'S SWITCH — ping healthchecks.io on a clean run (gate-passed, feed written). If this ping doesn't
// arrive on the cron's schedule, healthchecks.io pages Ness — catching a SILENT non-run (the failure mode a
// status-in-the-repo can't). Dormant until HEALTHCHECK_URL is set; pages only on regression / no-run.
if (process.env.HEALTHCHECK_URL) { try { await fetch(process.env.HEALTHCHECK_URL, { method: 'POST', body: 'ok' }) } catch { /* ignore */ } }
console.log('\n✓ done')
