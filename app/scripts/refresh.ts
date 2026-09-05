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
import { dedupe, balanceByCategory, isGoodImage, isPortraitImage, imageBroken, urlLooksNonPhoto, imageIsCardworthy, fetchEventImage, toPortrait, wikiImage, webImageCandidates, verifyImageForEvent, venueMatchImage, venueBook, linkIsIndex, NO_PHOTO_CAP, whenBeforeWeekend, upcomingWeekend, weekendMode, weekendModes, stampServeOrder, publishCheck, crownsActive, JUDGE_FLOOR, STAR_BOOST, linkOk, mapLimit, rxOf, titleKey, titleLooseMatch, tokKey, approvalCheck, type TasteCorpus, type WeeklySlate } from './lib/pipeline'
import { fixWhen, latestDateOf, whenActiveBy, whenIsPast, whenLooksBroken } from '../src/lib/when'
import { effectiveFreshness, NEW_DAYS } from '../src/lib/freshness'
import { mergeSightings, pruneRegistry, appendRun, type SeenRegistry, type HealthFile } from './lib/ingest'
import { songkickAdapter } from './adapters/songkick'
import { llmExtract } from './adapters/llm'
import { websearchExtract } from './adapters/websearch'
import { editorialScores } from './adapters/editor'
import { raExtract } from './adapters/ra'
import { iamsterdamExtract, upgradeViaIamsterdam } from './adapters/iamsterdam'
import { lbbExtract } from './adapters/lbb'
import { scoutedExtract } from './adapters/scouted'
import { curatedImage } from './curated'
import { heroPicks } from './heroes'
import corpus from './taste/corpus.json'
import weekly from './taste/weekly.json'
import { rssExtract } from './adapters/rss'
import { ROSTERS } from './roster'

// TASTE MATCHERS — corpus veto + starredKeeps entries match with WORD BOUNDARIES, not raw substring:
// R2 added short venue names ("Monne", "BAK") that a substring test would find inside unrelated words
// ("Monnickendam", "bakkerij"). A \b is only asserted when the entry's edge char is ASCII-alphanumeric —
// JS \b is \w-based, so a trailing \b after "ekō"/"jøase" would silently never match.
// rxOf moved to lib/pipeline.ts (shared with scripts/restamp.ts — the taste fast-path)
const VETO_RX = (corpus.eventVeto as string[]).map(rxOf)
const isVetoed = (title: string) => VETO_RX.some((rx) => rx.test(title))

const args = process.argv.slice(2)
const SKIP_IMAGES = args.includes('--no-images')
const ONLY_CITY = args.find((a) => a.startsWith('--city='))?.split('=')[1]
const SK_KEY = process.env.SONGKICK_API_KEY
const LLM_ON = !!process.env.ANTHROPIC_API_KEY
const OUT_DIR = `${import.meta.dir}/../public/data`

const FRESH_RANK: Record<string, number> = { new: 3, ending: 3, weekend: 2, always: 1 }

// WEEKEND FORECAST MODE — now shared: scripts/lib/pipeline.ts weekendMode() (restamp.ts stamps
// the serve order through the same lens, so the two publishers can't disagree on the weekend).

async function buildCity(city: City) {
  console.log(`\n● ${city.label}`)
  const roster = ROSTERS[city.key] ?? []

  // NOVELTY — read LAST week's feed (the file we're about to overwrite) so we can lead with what's
  // genuinely NEW this week. Returning users should see fresh content first, not the same deck.
  let seenLastWeek = new Set<string>()
  let priorPicks: Pick[] = []
  // titleKey → the date we first met that title, carried forward from the prior feed. ONLY a date
  // that feed actually RECORDED is carried: a legacy pick from before firstSeen existed is left
  // unstamped rather than credited with the prior feed's build date. That date is a lower bound on
  // its age, not its arrival — using it would hand every immortal 'new' one more week of newness,
  // which is the bug, seven days later. Unstamped picks fail closed in effectiveFreshness, and
  // that is the right answer: whatever they claim, they are demonstrably not new TO US.
  const firstSeenOf = new Map<string, string>()
  try {
    const prior = await Bun.file(`${OUT_DIR}/picks.${city.key}.json`).json()
    priorPicks = prior.picks ?? []
    seenLastWeek = new Set<string>((prior.picks ?? []).map((p: Pick) => titleKey(p.title)))
    for (const p of priorPicks) if (p.firstSeen) firstSeenOf.set(titleKey(p.title), p.firstSeen)
    console.log(`  novelty:  ${seenLastWeek.size} titles seen last week (new ones will lead)`)
  } catch { /* first run / no prior feed */ }
  // THE SEEN REGISTRY (scripts/ingest.ts, daily) outranks the prior-feed record: it knows the
  // actual DAY a title arrived, where the feed only knows Thursdays — and it heals the legacy
  // hole, because a pick that predates firstSeen but was later sighted by the daily poll now HAS
  // a record. Min-date rule, same as the registry's own merge: first sighting wins, ever.
  let registry: SeenRegistry = { v: 1, seen: {} }
  try {
    registry = await Bun.file(`${OUT_DIR}/seen.${city.key}.json`).json()
    for (const [k, d] of Object.entries(registry.seen)) {
      const prior = firstSeenOf.get(k)
      if (!prior || d < prior) firstSeenOf.set(k, d)
    }
  } catch { /* no registry yet — the daily poll hasn't run */ }

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

  // SCOUTED FINDS — the agent-scouted new-openings/pop-ups slate (scripts/taste/scouted.json), curated
  // through the board. Fresh by definition; they graduate to canon, get killed, or expire.
  const scout = scoutedExtract(city.key)
  fromRoster.push(...scout)
  if (scout.length) console.log(`  scout:    ${scout.length} fresh finds (new openings · pop-ups)`)

  if (LLM_ON) {
    // YOUR LITTLE BLACK BOOK — Ness's #1 source, read DIRECTLY from its RSS agenda articles (weekendtips +
    // museum/theatre/film agendas): LBB's own curation, editorial images, and per-event outbound links —
    // no more hoping web_search stumbles on LBB's picks and scrapes random photos for them.
    const lbb = await lbbExtract(city.key)
    fromRoster.push(...lbb)
    if (lbb.length) console.log(`  lbb:      ${lbb.length} picks (Your Little Black Book · direct from the agenda)`)

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

  // STRUCTURED UPGRADE ON CONTACT (V.11.9) — before dedupe, every KEYLESS live pick (web-search, LLM
  // scrape, RSS) is offered to I amsterdam's own record: its link when that is an event page, else the
  // events sitemap matched by title (keyless, ~2,900 locs, fetched once). A hit replaces Haiku's guessed
  // category, paraphrased date and missing image with the organiser's — and re-ids the pick `web-iams-`,
  // so dedupe folds it onto the crawl's twin by stable id and the image pass trusts its flyer. A page
  // whose dates say "not this weekend" DROPS the pick: the keyless claim was wrong. The 2026-09-03 feed
  // shipped a tattoo convention filed as `market` wearing the Bloemenmarkt, while its own event page
  // (linked from the card!) carried two real flyers.
  {
    const keyless = fromRoster.filter((p) => /^(web|llm|rss)-/.test(p.id) && !/^web-(iams|ra|lbb|scout)-/.test(p.id))
    let up = 0, off = 0
    const offIds = new Set<string>()
    const who: string[] = []
    await mapLimit(keyless, 4, async (p) => {
      const r = await upgradeViaIamsterdam(p)
      if (r === 'off-weekend') { offIds.add(p.id); off++ }
      else if (r) { if (who.length < 8) who.push(p.title.slice(0, 26)); Object.assign(p, r); up++ }
    })
    if (off) for (let i = fromRoster.length - 1; i >= 0; i--) if (offIds.has(fromRoster[i].id)) fromRoster.splice(i, 1)
    if (up || off) console.log(`  upgrade:  ${up} keyless picks → I amsterdam's own record (dates · category · flyer)${off ? ` · ${off} dropped: organiser says not this weekend` : ''}${who.length ? ` (${who.join(' · ')})` : ''}`)
  }

  // DEDUPE (sets buzz = distinct sources) — roster first so live picks win the merge over canon.
  let picks = dedupe([...fromRoster, ...canon])
  // EVERY live-adapter id prefix must be listed (llm/web + rss/songkick): a missed prefix means those
  // picks skip the image pass AND the gate's imageless check the day the source is switched on.
  const isLive = (p: Pick) => ['llm-', 'web-', 'rss-', 'sk-'].some((pre) => p.id.startsWith(pre))

  // DROP STALE — past-dated picks (hardcoded canon dates that have rolled by, or LLM picks that
  // scraped an already-finished event). Evergreen "Daily"/"Always" whens are kept.
  {
    const before = picks.length
    picks = picks.filter((p) => !whenIsPast(p.when))
    if (before !== picks.length) console.log(`  stale:    dropped ${before - picks.length} past-dated picks`)
  }

  // DROP BROKEN RANGES — a `when` whose range runs backwards ("Sun 28 – Sun 12 Jul") lost its
  // first month somewhere upstream. We can't reconstruct what the source meant; omit it rather
  // than publish a claim that may be wrong.
  {
    const before = picks.length
    picks = picks.filter((p) => !whenLooksBroken(p.when))
    if (before !== picks.length) console.log(`  broken:   dropped ${before - picks.length} malformed date ranges`)
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

  // INDEX-ONLY WEB-SEARCH PICKS (V.11.9) — an UNCORROBORATED web-search pick whose only link is a
  // listing index (/whats-on, /weekend-guide, /annual-event-calendar…): its date was never read off
  // an event page, it has no organiser image, and "open at" dead-ends. The upgrade above already
  // rescued everything I amsterdam could name; what remains is the lowest-trust object in the pool.
  // A second source vouching for it (buzz ≥ 2) keeps it — corroboration is evidence, a link is not.
  {
    const websearch = (p: Pick) => /^web-/.test(p.id) && !/^web-(iams|ra|lbb|scout|hero)-/.test(p.id)
    const before = picks.length
    const gone = picks.filter((p) => websearch(p) && (p.buzz ?? 1) < 2 && (!p.link || linkIsIndex(p.link)))
    picks = picks.filter((p) => !gone.includes(p))
    if (before !== picks.length) console.log(`  trust:    dropped ${before - picks.length} uncorroborated web-search picks with index-only links (${gone.slice(0, 5).map((p) => p.title.slice(0, 24)).join(' · ')}${gone.length > 5 ? ' …' : ''})`)
  }

  // THE IMAGE PASS — HONEST IMAGES (V.11.9). A live card's photo is OF the event (or of its venue),
  // or the card has none. The chain, in order, each step stamping its receipt (`imageWhy`):
  //   organiser  — a structured source's own upload (iams / RA / LBB / scout), sanity-screened
  //   event-page — og:image / JSON-LD off the pick's OWN link, vision-verified
  //   portrait   — a named act's Wikipedia portrait, vision-verified
  //   web        — an open-web candidate, vision-verified against the event
  //   venue      — the canon photo of the SAME venue (a venue-led event) — the one honest borrow
  //   curated    — a hand pin (scripts/curated.ts), applied last, always wins
  //   none       — nothing honest found: the card ships its typographic face (Card.tsx)
  // RETIRED HERE, deliberately: the category-bank borrow and Pexels themed stock. Both produced a real
  // photograph of a DIFFERENT place — the 2026-09-03 feed had a tattoo convention wearing the
  // Bloemenmarkt and a Concertgebouw open day wearing Haarlem, 9 of 53 live cards — and a plausible
  // wrong photo is the one failure a stranger can't spot; only someone who knows the event can. The
  // old law ("every live card carries a photograph") made the bank load-bearing; the new law is that a
  // blank is allowed and RANKED DOWN (modes.ts NO_PHOTO_PENALTY + holdBackImageless, the NO_PHOTO_CAP
  // below). Canon is hand-imaged → never re-judged, never borrowed FROM except by its own venue.
  if (!SKIP_IMAGES) {
    const live = picks.filter(isLive)
    for (const p of live) p.imageWhy = undefined                     // every receipt is earned THIS run
    const trustedImg = (p: Pick) => /^web-(iams|ra|lbb|scout)-/.test(p.id) && !!p.image
    const PERFORMER = new Set(['live', 'stage'])
    const visionOn = !!process.env.ANTHROPIC_API_KEY

    // THE VENUE BOOK — the canon's evergreen, PLACE-shaped entries (hand-imaged); venue-match borrows
    // from these only. Event-shaped canon titles are excluded — see venueBook in lib/pipeline.
    const places = venueBook(city.picks)

    // TRUST, BUT SCREEN FOR THE LOGO CLASS — organisers sometimes upload their LOGO/wordmark instead of a
    // photo ("LOGO___WORDMARK_square_black.webp" → a solid-black card). Trusted images stay untouched on
    // SUBJECT (no re-scraping — that was the old sabotage), but two sanity screens apply: (1) keyless URL
    // smell test (logo/wordmark/stock in the filename), (2) a narrow vision check that rejects ONLY
    // logos/flat graphics/blank frames while KEEPING real posters (the Agatha class). A reject now simply
    // DROPS the image — the pick re-enters the gather below like any imageless one (was: → bank).
    {
      let sane = 0
      await mapLimit(live.filter(trustedImg), 3, async (p) => {
        // isGoodImage = logo/stock URL smell + REAL pixel dims (≥700 shortest side — a low-res organiser
        // upload upscaled to the 1200-tall card is mush: the Amsterdamse Bos class) + sane aspect.
        const bad = !(await isGoodImage(p.image!)) || !(await imageIsCardworthy(p.image!))
        if (bad) { p.image = undefined; sane++ } else p.imageWhy = 'organiser'
      })
      if (sane) console.log(`  sanity:   ${sane} organiser logos/blank frames dropped → re-gathered below`)
    }
    // an untrusted image that ARRIVED with the pick (the LLM lane's matched page photo) must at least be
    // a real photo of card-worthy size; its SUBJECT is judged by the vision QA at the end of the pass
    await mapLimit(live.filter((p) => p.image && !trustedImg(p)), 5, async (p) => {
      if (!(await isGoodImage(p.image!))) p.image = undefined
      else p.imageWhy = 'event-page'
    })

    // CANDIDATE-GATHER + VISION VERIFY — the agentic image step. For every imageless live pick we
    // gather real-photo CANDIDATES (the event page's own og:image / JSON-LD image FIRST; the act's
    // Wikipedia portrait for performers; open-web image search by name), then a Claude VISION call
    // LOOKS at them and picks the one that genuinely depicts the event — or rejects them all, so a
    // wrong subject never lands (Celeste → a Japan travel blog, "Open Garden Days" → a Pride parade).
    // What it can't verify stays imageless. With no ANTHROPIC_API_KEY it degrades to the old behaviour
    // (top-ranked candidate, unverified).
    const CAT_HINT: Record<string, string> = { eat: 'restaurant', drink: 'bar', art: 'exhibition', market: 'market', daytrip: '', out: '' }
    const ACT_HINT: Record<string, string> = { live: 'live music', stage: 'theatre' }
    const actName = (p: Pick) => p.title.split(/\s*[:–—]\s*/)[0].split(/\s+(?:and|&|\+|x|w\/|ft\.?|feat\.?|with|presents)\s+/i)[0].trim()

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
      if (use) { p.image = wk; p.imageWhy = 'portrait'; portraits++ }
    })
    if (portraits) console.log(`  portrait: ${portraits} performer cards → verified Wikipedia portrait`)

    let visGot = 0, visRej = 0
    await mapLimit(live.filter((p) => !p.image), 2, async (p) => {
      const perf = PERFORMER.has(p.category)
      // VENUE-AWARE QUERY — Ness's manual test proved it: "Martine Gutierrez Huis Marseille" returns the
      // museum's own images of the actual show, where "title + Amsterdam" returned junk. The venue is the
      // highest-signal token; include it whenever the pick carries a real one.
      const vtok = p.venue && p.venue.length > 2 && !/^(amsterdam|the web|i amsterdam|your little black book)$/i.test(p.venue.trim()) ? p.venue : ''
      const q = perf
        ? `${actName(p)} ${vtok} ${ACT_HINT[p.category] ?? ''}`.replace(/\s+/g, ' ').trim()
        : `${p.title} ${vtok} ${vtok ? '' : city.name} ${CAT_HINT[p.category] ?? ''}`.replace(/\s+/g, ' ').trim()
      // For performers, lead with the Wikipedia portrait — it's the most reliable + always
      // downloadable (Wikimedia doesn't hotlink-block), so it survives the verifier's 4-candidate
      // download cap even when web hits are on strict hosts (Billboard/Rolling Stone 403 our fetch).
      const cands: string[] = []
      let wiki: string | null = null, og: string | null = null
      if (perf) { wiki = await wikiImage(actName(p)); if (wiki && (await isGoodImage(wiki))) cands.push(wiki); else wiki = null }
      // ORGANISER FIRST: the event page's own image leads the candidate list — when it and a web hit both
      // "fit", vision tie-breaks toward the honest source (a Hamburg guide's japanese-food photo "fits" a
      // japanese restaurant; only the restaurant's OWN photo is true). Web hits fill in behind it.
      if (p.link) { og = await fetchEventImage(p.link); if (og) cands.push(og) }
      cands.push(...await webImageCandidates(q, 5))
      if (!cands.length) return
      const best = visionOn ? await verifyImageForEvent(cands, p, city.name) : cands[0]
      if (best) { p.image = best; p.imageWhy = best === og ? 'event-page' : best === wiki ? 'portrait' : 'web'; visGot++ }
      else if (visionOn) visRej++
    })
    console.log(`  vision:   +${visGot} live picks imaged via verified search${visRej ? ` · ${visRej} rejected → no photo` : ''}`)

    const seen = new Map<string, number>()
    for (const p of live) if (p.image && !trustedImg(p)) seen.set(p.image, (seen.get(p.image) || 0) + 1)
    for (const p of live) if (p.image && !trustedImg(p) && (seen.get(p.image) || 0) > 1) { p.image = undefined; p.imageWhy = undefined }   // shared hero = generic

    // VENUE MATCH — the one honest borrow (replaces Pexels themed stock + the category bank). A pick AT a
    // canon place wears that place's photo: true for "Concertgebouw Open" at Het Concertgebouw, and only
    // for a PERFORMER card when the title itself names the place (a venue-led night, not an act wearing
    // the hall — corpus imageRules: "never a stand-in, never another venue"). See venueMatchImage.
    {
      let venued = 0
      const who: string[] = []
      for (const p of live) {
        if (p.image) continue
        const m = venueMatchImage(p, places)
        if (m) { p.image = m.image; p.imageWhy = 'venue'; venued++; if (who.length < 6) who.push(`${p.title.slice(0, 26)} ← ${m.place}`) }
      }
      if (venued) console.log(`  venue:    +${venued} imageless picks → their own venue's canon photo (${who.join(' · ')})`)
    }

    // CURATED OVERRIDES — hand-pinned images for hero/recurring events the auto-pipeline gets wrong, applied
    // LAST so they always win (and rescue an event that would otherwise ship without a photo). See curated.ts.
    let curated = 0
    for (const p of live) { const c = curatedImage(p.title); if (c) { p.image = c; p.imageWhy = 'curated'; curated++ } }
    if (curated) console.log(`  curated:  ${curated} hero events → hand-pinned image`)

    // PORTRAIT NORMALIZE — reshape EVERY photo (live AND canon) to a tall portrait via the wsrv.nl proxy.
    // Two wins: (1) a landscape source fills the tall cover-card with its salient region centred instead of
    // cropping to a band; (2) wsrv fetches SERVER-SIDE, so a canon image on a hotlink-protected or
    // rate-limited host (pinterest, linkedin, Wikimedia 429…) can no longer BLANK in the user's browser —
    // it always loads from wsrv's CDN. Idempotent (skips already-wrapped). Heroes are wrapped on injection.
    for (const p of picks) if (p.image) p.image = toPortrait(p.image)

    // NO TWO CARDS SHARE A PHOTO — final dedup on the FINAL urls, across ALL live picks (trusted included:
    // a reseller submits the same photo to several Feed Factory listings; two venue-matched picks at the
    // same hall would wear the same facade). Keep the first (feed order = best-ranked); the later live
    // twin goes without — an honest blank, not a borrowed photo.
    // CANON FIRST, and a VENUE-BORROW MAY SHARE WITH ITS OWNER: the rule exists for the generic classes
    // (a reseller's one photo on five listings, two web picks on the same blog image). "Concertgebouw
    // Open" wearing the Concertgebouw while the Royal Concertgebouw canon card also carries it is not
    // that — both are the Concertgebouw, and the second live run blanked the open day for it. So: a
    // place's own card always keeps its photo; a venue-borrow may share with THAT card; two live cards
    // may still never share (two Melkweg nights: the better-ranked keeps the facade).
    {
      const owner = new Map<string, 'canon' | 'live'>()
      let dupes = 0
      for (const p of [...picks.filter((p) => !isLive(p)), ...picks.filter(isLive)]) {
        if (!p.image) continue
        const o = owner.get(p.image)
        if (o) {
          if (isLive(p) && !(o === 'canon' && p.imageWhy === 'venue')) { p.image = undefined; p.imageWhy = undefined; dupes++ }
          continue
        }
        owner.set(p.image, isLive(p) ? 'live' : 'canon')
      }
      if (dupes) console.log(`  unique:   ${dupes} duplicate card photos → the later card goes without (a place's own card keeps its photo; its own event may share it)`)
    }

    // FINAL VALIDATION — fetch EVERY published image (live + canon) and DROP any DEFINITIVELY broken one
    // (a dead source, a wsrv 4xx, a 404 — the things that blank a card). No replacement from anywhere: a
    // live pick ships its typographic face; a CANON loss is logged by name so the URL gets fixed in
    // src/data. A transient 429/timeout is kept (imageBroken is conservative).
    {
      let lost = 0
      const gone: string[] = []
      await mapLimit(picks.filter((p) => p.image), 6, async (p) => {
        if (await imageBroken(p.image!)) { p.image = undefined; p.imageWhy = undefined; lost++; if (!isLive(p)) gone.push(p.title) }
      })
      if (lost) console.log(`  validate: ${lost} broken images dropped${gone.length ? ` · CANON lost: ${gone.join(', ')} — fix the URL in src/data` : ''}`)
    }

    // VISION QA — the image arm of the publish gate. Look at every live pick's FINAL (portrait-wrapped)
    // image and confirm with Claude vision that it's a real photo that genuinely suits the event. Anything
    // blank / watermarked / a wrong subject is DROPPED — not swapped for a bank photo that "also passes".
    // Organiser uploads (trusted on subject), venue borrows and hand pins (both human-verified) are not
    // re-judged. Needs ANTHROPIC_API_KEY; never-throws; ~cents/run (one Haiku vision call per live pick).
    if (visionOn) {
      let qa = 0
      await mapLimit(live.filter((p) => p.image && !trustedImg(p) && p.imageWhy !== 'venue' && p.imageWhy !== 'curated'), 3, async (p) => {
        if (await verifyImageForEvent([p.image!], p, city.name)) return
        p.image = undefined; p.imageWhy = undefined; qa++
      })
      if (qa) console.log(`  vision-qa: ${qa} final images rejected → no photo`)
    }

    // THE RECEIPT — every live pick carries one; 'none' is the honest blank the board and the app read.
    for (const p of live) { if (!p.image) p.imageWhy = 'none'; else if (!p.imageWhy) p.imageWhy = trustedImg(p) ? 'organiser' : 'web' }
    const census: Record<string, number> = {}
    for (const p of live) census[p.imageWhy!] = (census[p.imageWhy!] ?? 0) + 1
    const imaged = live.filter((p) => p.image).length
    console.log(`  images:   ${imaged}/${live.length} live imaged · ${live.length - imaged} honest blanks (no bank, no stock) · receipts: ${Object.entries(census).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
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
      .map((h) => ({ ...h, when: fixWhen(h.when), image: h.image ? toPortrait(h.image) : h.image, imageWhy: (h.image ? 'curated' : 'none') as Pick['imageWhy'] }))
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

  // Snapshot the full ranked, imaged pool BEFORE the caps — everything dropped from here on is a
  // perfectly good event that simply lost a slot. The Curation Board serves these as REPLACEMENTS:
  // when Ness kills a card, the next candidate of that category deals in.
  const prePool = picks.filter(isLive)

  // THIS-WEEKEND EXEMPTION — a pick explicitly dated the coming weekend (Fri run-up → Sun) never
  // loses a slot to an undated one. The caps below exist to stop source FLOODS, not to throttle the
  // actual weekend: the 2026-07-09 run crawled 30 RA nights + 31 LBB agenda items and shipped a feed
  // that was 61% evergreen — dated-event density is the whole freshness feel. Shared date brain.
  const { sun: wkSun, cutoff: wkFri } = upcomingWeekend()
  const wkEnd = new Date(wkSun.getFullYear(), wkSun.getMonth(), wkSun.getDate(), 23, 59, 59)
  const datedThisWeekend = (p: Pick) => {
    const latest = latestDateOf(p.when)
    return !!latest && latest.getTime() >= wkFri.getTime() && whenActiveBy(p.when, wkEnd)
  }

  // SOURCE DIVERSITY — no single source may flood a category. Applies to EVERY high-volume source family
  // (I amsterdam flooded first; then LBB's 29 picks made the deck read "the LBB app"). Cap each at 4 per
  // category (of the 8 balanceByCategory keeps) so the mix stays a MIX: iams + LBB + RA + web-search
  // serendipity + canon. Picks are already best-first, so each source's strongest survive.
  {
    const CAP_PER_SOURCE = 4
    const FAMILIES = ['web-iams-', 'web-lbb-']
    const n: Record<string, number> = {}
    const before = picks.length
    picks = picks.filter((p) => {
      if ((p.buzz ?? 1) >= 2) return true   // corroborated ("talked about") events are cap-EXEMPT — the caps
                                            // once ate BOTH language-twins of the H'ART Canal Parade show
      if (datedThisWeekend(p)) return true  // dated THIS weekend = cap-exempt (see above)
      const fam = FAMILIES.find((f) => p.id.startsWith(f))
      if (!fam) return true
      const k = fam + p.category
      n[k] = (n[k] ?? 0) + 1
      return n[k] <= CAP_PER_SOURCE
    })
    if (before !== picks.length) console.log(`  variety:  per-source cap ${CAP_PER_SOURCE}/category (dropped ${before - picks.length})`)
  }

  if (picks.filter(isLive).length > 6) {
    // HERO EVENTS bypass the cap entirely (found OR injected — matched by title), so a must-see can never be
    // capped out of an over-full category; the rest is balanced as before, with heroes leading.
    const heroesInPool = picks.filter((p) => heroKeys.has(titleKey(p.title)))
    // RA LANE — club nights are a distinct slice of Amsterdam (and RA is a ranked trusted source), but RA's
    // srcRank (2) sits below I amsterdam (3) and LBB (4), so its picks kept losing every `live` slot and the
    // feed shipped with ZERO club nights. Reserve the top 2 RA nights (already popularity-led) cap-exempt.
    const raLane = picks.filter((p) => p.id.startsWith('web-ra-')).slice(0, 2)
    // dated-this-weekend picks bypass the category balance too — the weekend itself is never
    // "over-represented"; the balancer's job is taming undated/evergreen floods
    const laneIds = new Set([...heroesInPool, ...raLane].map((p) => p.id))
    const wkndExempt = picks.filter((p) => isLive(p) && datedThisWeekend(p) && !laneIds.has(p.id))
    const exempt = new Set([...heroesInPool, ...raLane, ...wkndExempt].map((p) => p.id))
    const balanced = balanceByCategory(picks.filter((p) => !exempt.has(p.id)), 8)
    const out = [...heroesInPool, ...raLane, ...wkndExempt, ...balanced]
    console.log(`  ranked:   ${picks.length} → ${out.length} after per-category cap (${heroesInPool.length} hero-exempt · ${raLane.length} RA lane · ${wkndExempt.length} dated-this-weekend exempt) · ${novelCount} new this week`)
    picks = out
  } else {
    console.log(`  ranked:   ${picks.length} (canon floor) · ${novelCount} new this week`)
  }

  // EDITORIAL SCORE — a stronger judge (ANTHROPIC_JUDGE_MODEL, default Sonnet) rates the live candidates
  // 0..10 on editorial merit; the score rides on each pick as editorScore and becomes a term in the app's
  // rankPicks (src/weather/modes.ts), so the genuinely-BEST events lead the deck. Facts never touched.
  if (LLM_ON) {
    const liveNow = picks.filter(isLive)
    const { scores, dupes } = await editorialScores(liveNow, city.name)
    if (scores.size) {
      let n = 0
      // TWO SCORES, deliberately. `editorScore` is the RANKING score and later passes raise it —
      // starredKeeps floors it at 8, a 👑 sets it to 10. `judgeScore` is the judge's own verdict and
      // NOTHING overwrites it, because the publish bar reads it. Fusing them made the scale a liar:
      // approved picks wore a manufactured 8-10 while unapproved ones were judged on merit and
      // topped out at 7, so no threshold could compare them. Keep them apart.
      for (const p of picks) { const s = scores.get(p.id); if (s != null) { p.editorScore = s; p.judgeScore = s; n++ } }
      console.log(`  editor:   scored ${n}/${liveNow.length} live picks (judge ${process.env.ANTHROPIC_JUDGE_MODEL || 'claude-sonnet-4-6'})`)
    }
    // SEMANTIC DEDUP — the judge names clusters that are the SAME real-world event under different
    // titles/languages ("Festival TREK" ×3, "Love on the Canals"/"Liefde op de Grachten") — the class
    // titleKey/prefix rules can't catch. Merge each cluster into ONE card: structured id preferred,
    // then best editor score, then has-image; credits union into buzz (a triple-listed event IS the
    // talked-about signal); strongest popularity carried.
    if (dupes.length) {
      let mergedAway = 0
      for (const cluster of dupes) {
        const members = picks.filter((p) => cluster.includes(p.id))
        if (members.length < 2) continue
        members.sort((a, b) =>
          (Number(/^web-(iams|ra)-/.test(b.id)) - Number(/^web-(iams|ra)-/.test(a.id))) ||
          ((b.editorScore ?? 0) - (a.editorScore ?? 0)) ||
          (Number(!!b.image) - Number(!!a.image)))
        const keep = members[0]
        const credits = new Set(members.flatMap((m) => (m.source || '').split(' · ')).filter(Boolean))
        keep.source = [...credits].join(' · ')
        keep.buzz = Math.max(keep.buzz ?? 1, credits.size)
        const pop = Math.max(...members.map((m) => m.popularity ?? 0))
        if (pop > 0) keep.popularity = pop
        const drop = new Set(members.slice(1).map((m) => m.id))
        picks = picks.filter((p) => !drop.has(p.id))
        mergedAway += drop.size
      }
      if (mergedAway) console.log(`  semdupe:  merged ${mergedAway} same-event cards (cross-language/phrasing)`)
    }
  }

  // NESS VETO — events killed on the Curation Board (taste kills, not dupe-kills) never ship again,
  // from any source, any run. The list lives in scripts/taste/corpus.json and grows with each round.
  {
    const before = picks.length
    picks = picks.filter((p) => !isVetoed(p.title))
    if (before !== picks.length) console.log(`  veto:     dropped ${before - picks.length} Ness-killed events`)
  }

  // STARRED KEEPS — events Ness rated ★4-5 on the Curation Board. Two guarantees: (a) a ★ BOOSTS the
  // ranking score two points over the judge's verdict, and (b) a time-critical miss is carried forward
  // (below). The boost REPLACED a flat floor of 8 (2026-08-29): the floor made every starred pick wear
  // 8-10 against a judge ceiling of ~7 on fresh content — a ceiling nothing new could reach, so the
  // same starred venues led every week regardless of merit. judge+2 keeps a ★ a real thumb on the
  // scale (a starred 7 → 9 tops the deck) without letting it lift a judged-3 above fresh merit.
  // Canon starred picks carry no judgeScore (the judge only reads live picks) — they take a baseline
  // of 6, landing on 8: exactly the value the floor gave them, so the hand-curated library does not
  // move an inch. Only live starred picks change: they now scale with what the judge actually saw.
  {
    const keeps = (corpus.starredKeeps as { match: string; stars: number }[])
      .filter((k) => k.stars >= 4)
      .map((k) => ({ ...k, rx: rxOf(k.match) }))
    let floored = 0, carried = 0
    for (const p of picks) if (keeps.some((k) => k.rx.test(p.title))) { p.editorScore = Math.min(10, (p.judgeScore ?? 6) + STAR_BOOST); floored++ }
    // CARRY-FORWARD IS NOW A TIME-CRITICAL RESCUE ONLY — it must be dated THIS weekend. It used to
    // pull back any date-valid star, which quietly meant every undated evergreen one ("Now open"),
    // every week, forever: 18 picks last run, and a third of why the deck read identical three weeks
    // running. A starred event happening in two days that the crawl dropped is worth rescuing; a
    // starred venue that no source lists any more is not news, and if it should be permanent it
    // belongs in canon (+CANON on the board), which is the escape hatch that already exists.
    for (const k of keeps) {
      if (picks.some((p) => k.rx.test(p.title))) continue
      const prior = prePool.find((p) => k.rx.test(p.title))
        ?? priorPicks.find((p) => k.rx.test(p.title))
      if (!prior || whenIsPast(prior.when) || whenBeforeWeekend(prior.when)) continue
      if (!datedThisWeekend(prior)) continue
      const pin = curatedImage(prior.title)
      if (pin) prior.image = toPortrait(pin)
      picks.push(prior); carried++
    }
    if (floored || carried) console.log(`  starred:  ${floored} ★-boosted (judge+${STAR_BOOST}) · ${carried} carried forward from the prior feed`)
  }

  // RESTED — the ★4+KILL class from the board: events Ness LIKES but is tired of seeing. Not a veto:
  // dropped only until each entry's `until` date, then they may surface fresh again. Taste stays intact
  // (anchors + keeps remain). Runs AFTER the starredKeeps pass so carry-forward can't resurrect them.
  {
    const today = new Date().toISOString().slice(0, 10)
    const active = ((corpus as { rested?: { match: string; until: string }[] }).rested ?? []).filter((r) => r.until > today)
    if (active.length) {
      const rx = active.map((r) => rxOf(r.match))
      const before = picks.length
      picks = picks.filter((p) => !rx.some((x) => x.test(p.title)))
      if (before !== picks.length) console.log(`  rested:   ${before - picks.length} fatigue-benched (back after ${active.map((r) => r.until).sort().at(-1)})`)
    }
  }

  // CROWNS EXPIRE WEEKLY — same law as the ▼▲ slate directly below, and for the same reason. A 👑 is
  // a call about THIS weekend, not a permanent fact, but topPicks had no expiry while weekly.json did:
  // the 2026-07-31 crowns were still leading the deck on 2026-08-29, so Kaap Amsterdam opened the app
  // four Saturdays running. A compile that sets crowns must stamp `topPicksWeekend` with the Saturday
  // they are for; anything else is inert and says so loudly in the log rather than failing dark.
  const crownsLive = crownsActive(corpus as { topPicksWeekend?: string })

  // TOP PICKS — Ness's 👑 escalations (the tier above starredKeeps): stamped `top` + editorScore 10.
  // A topped pick is GUARANTEED into the feed — if the balance stages cut it (or it's a canon place the
  // selection skipped), it's pulled back from the pre-publish pool / bundled canon. The match list also
  // ships as feed.topMatches so the app re-stamps at ingestion (belt and braces). Tops lead the deck.
  {
    const tops = crownsLive ? (corpus.topPicks as string[]).map(rxOf) : []
    // RECOMPUTE, don't accumulate: a carried-forward pick can arrive with `top` baked from the week
    // it was crowned. Stale crowns must fall off here or they lead the deck from beyond the grave.
    for (const p of picks) if (p.top && !tops.some((rx) => rx.test(p.title))) p.top = undefined
    if (!crownsLive) console.log(`  top:      ${(corpus.topPicks as string[]).length} 👑 EXPIRED (stamped ${(corpus as { topPicksWeekend?: string }).topPicksWeekend ?? 'never'}, this weekend is not) — re-crown on the board to lead the deck`)
    let stamped = 0, pulled = 0
    for (const p of picks) if (tops.some((rx) => rx.test(p.title))) { p.top = true; p.editorScore = 10; stamped++ }
    for (const rx of tops) {
      if (picks.some((p) => rx.test(p.title))) continue
      const extra = prePool.find((p) => rx.test(p.title)) ?? canon.find((p) => rx.test(p.title))
      if (!extra || whenIsPast(extra.when)) continue
      extra.top = true; extra.editorScore = 10
      picks.push(extra); pulled++
    }
    if (stamped || pulled) console.log(`  top:      ${stamped + pulled} 👑 escalated to deck-lead${pulled ? ` (${pulled} pulled back in)` : ''}`)
  }

  // WEEKEND SLATE — Ness's ephemeral ▲ LEAD / ▼ LATER calls (taste/weekly.json). Applies ONLY while
  // the file's `weekend` matches the upcoming Saturday — stale calls are ignored, so a lead can never
  // drag into next week. LEAD opens the deck just under the 👑 TOPs and is guaranteed into the feed
  // (same pull-back as tops); LATER stays published but sinks to the back of the pile (not a kill).
  {
    const { sat } = upcomingWeekend()
    const satKey = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`
    const leadList = weekly.lead as string[], laterList = weekly.later as string[]
    const pileList = ((weekly as { pile?: string[] }).pile ?? []) as string[]
    if ((weekly.weekend as string) === satKey) {
      const leads = leadList.map(rxOf), laters = laterList.map(rxOf)
      let l = 0, d = 0
      for (const p of picks) {
        if (leads.some((rx) => rx.test(p.title))) { p.lead = true; p.editorScore = Math.max(p.editorScore ?? 0, 9); l++ }
        else if (laters.some((rx) => rx.test(p.title))) { p.later = true; d++ }
      }
      for (const rx of leads) {
        if (picks.some((p) => rx.test(p.title))) continue
        const extra = prePool.find((p) => rx.test(p.title)) ?? canon.find((p) => rx.test(p.title))
        if (!extra || whenIsPast(extra.when)) continue
        extra.lead = true; extra.editorScore = Math.max(extra.editorScore ?? 0, 9)
        picks.push(extra); l++
      }
      // PILE-ORDER — the hand-dragged opening sequence from the board. Stamped 1-based; the app
      // deals pilePos picks first, in exactly this order (orderServed). Same expiry as lead/later.
      // LOOSE matching (not rxOf): the board stores titles verbatim at drag time, and this week's
      // crawl may have retitled the event — R4 lost 3/10 positions to exact matching.
      let po = 0
      const missed: string[] = []
      pileList.forEach((t, i) => {
        const hit = picks.find((p) => titleLooseMatch(p.title, t))
        if (hit) { hit.pilePos = i + 1; po++ } else missed.push(t)
      })
      if (l || d || po) console.log(`  slate:    ${l} ▲ lead this weekend · ${d} ▼ pushed later${po ? ` · pile order hand-set (${po}/${pileList.length})` : ''}${missed.length ? ` · pile UNMATCHED: ${missed.join(' | ')}` : ''}`)
    } else if (leadList.length || laterList.length || pileList.length) {
      console.log(`  slate:    stale (${weekly.weekend} ≠ ${satKey}) — ignored`)
    }
  }

  // THE AIRLOCK — the live deck is 1:1 with Ness's Curation Board approvals (his call, 2026-07-10;
  // the stopgap that hand-filtered the feed becomes pipeline law here). AFTER the whole funnel
  // (balance, slate, tops — so pending cards are exactly what WOULD have shipped), live picks
  // split: APPROVED (a starredKeeps/topPicks/starAnchors★3+ match, this weekend's slate, a hero,
  // or buzz≥3 — the shared approvalCheck) publish with canon/evergreen as before; everything else
  // — full cards, already imaged + judge-scored — waits in pending.<city>.json for the board's
  // NEW FINDS tab. A star/👑/pile there promotes it into the feed via restamp's fast-path.
  // Queue order is Ness's explicit requirement — topical first, weather-related if possible:
  // (a) dated THIS weekend, (b) fits the weekend-forecast mode, (c) judge score, (d) buzz.
  // HONEST CARRY (V.11.9) — picks that re-entered AFTER the image pass (the starred carry-forward from
  // the PRIOR feed, 👑/▲ pull-backs) skipped it: their photo is last week's, chosen under last week's
  // law — possibly a bank borrow — and they carry no receipt (the first live run shipped "DKMNTL at
  // BRET" that way). A structured source's own image is still its own image; anything else without an
  // honest receipt goes blank. One choke point, so no future door can leak an unreceipted photo.
  {
    const HONEST = new Set<string>(['organiser', 'event-page', 'portrait', 'web', 'venue', 'curated'])
    let stripped = 0, relabelled = 0
    for (const p of picks) {
      if (!isLive(p)) continue
      if (p.image && !HONEST.has(p.imageWhy ?? '')) {
        if (/^web-(iams|ra|lbb|scout)-/.test(p.id)) { p.imageWhy = 'organiser'; relabelled++ }
        else { p.image = undefined; stripped++ }
      }
      if (!p.image) p.imageWhy = 'none'
    }
    if (stripped || relabelled) console.log(`  carry:    ${relabelled} re-entered structured picks keep their organiser photo · ${stripped} unreceipted photos dropped`)
  }

  let pendingOut: Pick[] = []
  let noPhotoShare = 0, liveBeforeCap = 0
  {
    // THE BAR, INVERTED (2026-08-29). This gate used to be an ALLOW-LIST: a live pick published only
    // if it matched something Ness had already approved on the board. That made the app structurally
    // incapable of running on its own — stop curating and nothing new can ever ship. The 2026-08-27
    // run crawled 227 picks, 95 of them genuinely new, and published 25: a jazz festival, a craft
    // festival and a Concertgebouw night all sat in pending while the deck served its fourth
    // consecutive week of the same cards.
    //
    // Now it is a BLOCK-LIST with a junk floor. Vetoes and rests still kill (they ran above). What
    // remains publishes if it clears the judge, OR if Ness explicitly called it — approval still
    // admits, it just no longer has to. His taste ranks the survivors instead of choosing them.
    //
    // The floor reads `judgeScore`, never `editorScore`: the latter carries the ★ floor of 8 and the
    // 👑 10, so gating on it would be circular — approved picks passing a bar their approval set.
    const heroTitles = heroPicks(city.key).map((h) => h.title)
    const isApproved = approvalCheck(corpus as TasteCorpus, weekly as WeeklySlate, heroTitles)
    const clearsBar = publishCheck(corpus as TasteCorpus, weekly as WeeklySlate, heroTitles)
    const held = (p: Pick) => isLive(p) && !clearsBar(p)
    const merit = picks.filter((p) => isLive(p) && !isApproved(p) && clearsBar(p)).length
    pendingOut = picks.filter(held)
    picks = picks.filter((p) => !held(p))
    const mode = await weekendMode()
    const topical = (p: Pick) => (datedThisWeekend(p) ? 1 : 0)
    const wx = (p: Pick) => (mode && Array.isArray(p.weatherFit) && p.weatherFit.includes(mode) ? 1 : 0)
    // THE NO-PHOTO CAP (V.11.9) — imageless picks that cleared the bar publish on merit only up to
    // NO_PHOTO_CAP (best judge first, dated-this-weekend breaking ties); the rest wait in the airlock
    // for a human call (an approval is exempt — if Ness called it, it ships, photo or not; restamp
    // mirrors this). The share BEFORE the cap is what the publish gate reads: if MOST of the crawl
    // lost its photo, the image pass broke and the run must abstain rather than ship a 3-card deck.
    {
      const noPhoto = picks.filter((p) => isLive(p) && !p.image)
      liveBeforeCap = picks.filter(isLive).length
      noPhotoShare = liveBeforeCap ? noPhoto.length / liveBeforeCap : 0
      const onMerit = noPhoto.filter((p) => !isApproved(p))
        .sort((a, b) => (b.judgeScore ?? 0) - (a.judgeScore ?? 0) || topical(b) - topical(a))
      const overflow = new Set(onMerit.slice(NO_PHOTO_CAP).map((p) => p.id))
      if (overflow.size) {
        pendingOut.push(...picks.filter((p) => overflow.has(p.id)))
        picks = picks.filter((p) => !overflow.has(p.id))
      }
      if (noPhoto.length) console.log(`  no-photo: ${noPhoto.length} live picks without a photo (${Math.round(noPhotoShare * 100)}% of ${liveBeforeCap}) · ${Math.min(onMerit.length, NO_PHOTO_CAP)} publish on merit (cap ${NO_PHOTO_CAP}) · ${noPhoto.length - onMerit.length} on approval · ${overflow.size} → airlock`)
    }
    pendingOut.sort((a, b) =>
      topical(b) - topical(a) ||
      wx(b) - wx(a) ||
      (b.editorScore ?? 0) - (a.editorScore ?? 0) ||
      (b.buzz ?? 1) - (a.buzz ?? 1))
    console.log(`  airlock:  ${picks.filter(isLive).length} live → feed (${merit} on judge merit alone, floor ${JUDGE_FLOOR}) · ${pendingOut.length} held below the bar${mode ? ` (weekend mode ${mode})` : ''}`)
    // THE PROJECTED SERVE ORDER — stamped with the app's own pipeline (same mode read), so the
    // board's WEEKEND PILE shows the deck's actual front, not a re-derived approximation.
    // Stamped PER DAY (the airlock sort above keeps the blended mode — it's ranking candidates for
    // the weekend as a whole, not placing them on a day).
    picks = stampServeOrder(picks, (await weekendModes()) ?? mode)
  }

  // FINAL BROKEN-RANGE SWEEP — picks join the pool at many stages AFTER the early drop
  // (fresh adapter crawls, hero merges, TOP/slate pull-backs), so re-run the malformed-range
  // filter at the choke point: a range the date brain can't trust ("Sun 28 – Sun 12 Jul")
  // must never publish, whichever door it came in through. (2026-07-16: Jazz @ H'ART, a 👑
  // TOP, re-entered exactly this way.)
  {
    const before = picks.length
    picks = picks.filter((p) => !whenLooksBroken(p.when))
    if (before !== picks.length) console.log(`  broken:   dropped ${before - picks.length} malformed date range(s) at the gate`)
  }

  // FIRST SEEN — stamp the one fact that makes "New this week" mean this week. `freshness: 'new'`
  // is a claim (a source's, a scout's, a canon author's) and nothing ever took it back, so the
  // bucket aged into a lie: two canon picks have carried 'new' since the day they were typed. Now
  // every pick gets the date we FIRST met its title, carried forward untouched once set, and
  // effectiveFreshness() honours the claim only while that date is recent (src/lib/freshness.ts).
  //
  // The backstop matters as much as the stamp: a title already in last week's feed with no
  // firstSeen inherits that feed's generatedAt, NOT today. Without it the first run after this
  // change would stamp all ~78 picks with today's date and declare the entire feed new — the exact
  // failure we're removing, dressed as a fix.
  // Stamps the AIRLOCK too, not just the feed: pendingOut is a disjoint slice of the same crawl,
  // and restamp.ts promotes out of it mid-week. An unstamped promotion would arrive with a `new`
  // claim and no record behind it, which expires on contact — the airlock would quietly launder
  // fresh finds into stale ones.
  //
  // Three cases, and the middle one is the whole transition:
  //   recorded last week      → carry that date forward, untouched, forever
  //   in last week's feed but unrecorded (legacy) → leave ABSENT; we never saw it arrive
  //   not in last week's feed → today; this is the run it arrived
  {
    const today = new Date().toISOString().slice(0, 10)
    for (const p of [...picks, ...pendingOut]) {
      const k = titleKey(p.title)
      p.firstSeen = firstSeenOf.get(k) ?? (seenLastWeek.has(k) ? undefined : today)
      p.freshness = effectiveFreshness(p)
    }
    // write this run's sightings back so the registry stays whole even if the daily poll dies —
    // the two writers share one min-date merge, so they can only ever make each other more precise
    registry = pruneRegistry(mergeSightings(registry, [...picks, ...pendingOut].map((p) => titleKey(p.title)), today), today)
    await Bun.write(`${OUT_DIR}/seen.${city.key}.json`, JSON.stringify(registry, null, 1))
    const arrived = picks.filter((p) => p.firstSeen === today).length
    const legacy = picks.filter((p) => !p.firstSeen).length
    console.log(`  seen:     ${arrived} first seen today · ${legacy} undated legacy · ${picks.filter((p) => p.freshness === 'new').length} claim New (≤${NEW_DAYS}d)`)
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
    const malformed = picks.filter((p) => !Array.isArray(p.weatherFit) || !p.freshness)
    if (malformed.length) fail.push(`${malformed.length} schema-broken picks`)
    if (past.length) fail.push(`${past.length} past-dated`)
    if (httpImg.length) fail.push(`${httpImg.length} http (mixed-content) images`)
    // (V.11.9) a card without a photo is HONEST, not broken — the gate no longer fails on one. What IS
    // broken: an image pass that lost MOST of the crawl (keys/network down) — abstain rather than ship a
    // deck of blanks. Read at the pre-cap share, or the cap would hide the outage behind a thin feed.
    if (liveBeforeCap >= 8 && noPhotoShare > 0.5) fail.push(`${Math.round(noPhotoShare * 100)}% of ${liveBeforeCap} live picks imageless — image pass broken?`)
    if (heroesMissing.length) fail.push(`heroes missing: ${heroesMissing.map((h) => titleKey(h.title)).join(', ')}`)
    const warn: string[] = []
    if (liveN < 8) warn.push(`thin live feed (${liveN})`)
    if (noPhotoShare > 0.25) warn.push(`${Math.round(noPhotoShare * 100)}% of the crawl imageless before the cap`)

    const tag = fail.length ? '❌ BROKEN' : warn.length ? '⚠️ OK' : '✅ HEALTHY'
    const health = `${tag} · ${city.label} · ${picks.length} picks (${liveN} live · ${catN}/9 cats · ${imagelessLive.length} no-photo)${warn.length ? ' · warn: ' + warn.join(', ') : ''}${fail.length ? ' · FAIL: ' + fail.join(', ') : ''}`
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
  const feed = { city: city.key, label: city.label, generatedAt: new Date().toISOString(), live: LLM_ON, count: picks.length, topMatches: crownsLive ? (corpus.topPicks as string[]) : [], picks }
  await Bun.write(`${OUT_DIR}/picks.${city.key}.json`, JSON.stringify(feed, null, 2))
  console.log(`  → wrote picks.${city.key}.json (${picks.length} picks)`)

  // PENDING — the airlock queue, same generatedAt as the feed (the board keys verdict rounds to
  // it; the queue belongs to this round). Written AFTER the gate on purpose: an abstaining run
  // must not touch the pending pool either.
  await Bun.write(`${OUT_DIR}/pending.${city.key}.json`, JSON.stringify({ generatedAt: feed.generatedAt, count: pendingOut.length, pending: pendingOut }, null, 2))
  console.log(`  → wrote pending.${city.key}.json (${pendingOut.length} picks in the airlock)`)

  // INGEST HEALTH — the weekly run reports into the same dashboard the daily poll writes, so the
  // board's one strip covers both cadences. Live picks only: canon is bundled, not ingested.
  {
    const healthPath = `${OUT_DIR}/ingest-health.${city.key}.json`
    const health0: HealthFile = await Bun.file(healthPath).json().catch(() => ({ v: 1, runs: [], alerts: [] }))
    const counts: Record<string, number> = {}
    for (const p of [...picks, ...pendingOut].filter(isLive)) counts[p.source] = (counts[p.source] ?? 0) + 1
    const today = new Date().toISOString().slice(0, 10)
    const health = appendRun(health0, { date: today, kind: 'weekly', sources: counts, fresh: picks.filter((p) => p.firstSeen === today).length + pendingOut.filter((p) => p.firstSeen === today).length })
    await Bun.write(healthPath, JSON.stringify(health, null, 1))
    for (const a of health.alerts) console.log(`  ⚠ ingest: ${a.detail}`)
  }

  // CANDIDATES — the date-valid live events that lost a slot to the caps (never junk: they passed every
  // screen; pictured ones first, honest blanks behind them). The Curation Board deals these in as replacements when Ness KILLS a card. Excluded:
  // anything published OR in the airlock (a pending card must not double-show on the bench), and
  // title-twins of published picks (the semantic-dedup class).
  {
    const shown = [...picks, ...pendingOut]
    const pubIds = new Set(shown.map((p) => p.id))
    const pubKeys = new Set(shown.map((p) => titleKey(p.title)))
    const pubToks = new Set(shown.map((p) => tokKey(p.title)).filter(Boolean))
    const benchToks = new Set<string>()   // no word-order twins WITHIN the bench either
    const cands = prePool
      .filter((p) => {
        if (pubIds.has(p.id) || whenIsPast(p.when)) return false   // V.11.9: imageless allowed (sorted last)
        const k = titleKey(p.title)
        if (pubKeys.has(k)) return false
        // near-match twins of published cards stay off the bench (killing "Festival TREK" must not deal
        // "TREK Amstelpark" back in) — the dedupe's prefix rule, at a LOWER ≥8 threshold: the bench is
        // alternatives, so over-filtering a borderline twin ("Julidans" vs "Julidans Festival") beats
        // showing Ness the same event twice. The published feed keeps the conservative 12.
        for (const pk of pubKeys) if ((pk.length >= 8 && k.startsWith(pk)) || (k.length >= 8 && pk.startsWith(k))) return false
        // word-order/punctuation twins: no bench card may share a token-set with a PUBLISHED card
        // ("Vondelpark Openluchttheater" when "Openluchttheater Vondelpark" shipped) or with an
        // earlier bench card (both orderings of the same thing side by side ON the bench).
        const tk = tokKey(p.title)
        if (tk && (pubToks.has(tk) || benchToks.has(tk))) return false
        if (tk) benchToks.add(tk)
        if (isVetoed(p.title)) return false
        // rested (★4+KILL fatigue) events stay off the BENCH too — the point is Ness stops seeing them
        {
          const today = new Date().toISOString().slice(0, 10)
          const rested = ((corpus as { rested?: { match: string; until: string }[] }).rested ?? [])
            .filter((r) => r.until > today)
          if (rested.some((r) => rxOf(r.match).test(p.title))) return false
        }
        return true
      })
      .sort((a, b) => Number(!!b.image) - Number(!!a.image))   // stable: pictured first, rank order within
      .slice(0, 120)
      .map((p) => ({ id: p.id, title: p.title, venue: p.venue, area: p.area, when: p.when, category: p.category, image: p.image, imageWhy: p.imageWhy, blurb: p.blurb, source: p.source, link: p.link, buzz: p.buzz, weatherFit: p.weatherFit, freshness: p.freshness, firstSeen: p.firstSeen, outdoor: p.outdoor, kid: p.kid, price: p.price, why: p.why, editorScore: p.editorScore }))
    await Bun.write(`${OUT_DIR}/candidates.${city.key}.json`, JSON.stringify({ generatedAt: feed.generatedAt, count: cands.length, candidates: cands }, null, 2))
    console.log(`  → wrote candidates.${city.key}.json (${cands.length} bench events for the Curation Board)`)
  }
}

// PAUSED cities — tabled, not in the live MVP (Amsterdam-only). The pipeline skips them so we don't
// spend API on a city no one sees. Pass --city=new-orleans to build one explicitly (manual override).
const PAUSED = new Set(['new-orleans'])
const targets = CITIES.filter((c) => (ONLY_CITY ? c.key === ONLY_CITY : !PAUSED.has(c.key)))
console.log(`WKNDR refresh · ${targets.length} cit${targets.length === 1 ? 'y' : 'ies'}` +
  `${LLM_ON ? ' · LLM on' : ' · LLM off'}${SK_KEY ? ' · Songkick' : ''}${SKIP_IMAGES ? ' · no images' : ''}`)
for (const c of targets) await buildCity(c)
// DEAD-MAN'S SWITCH — the healthchecks.io "ok" ping lives in the WORKFLOW's final step (refresh.yml), NOT
// here: pinging from this script declared the run healthy before the commit/push/deploy steps had run, so a
// failed publish still looked green. The /fail ping on a gate regression (in buildCity, above) stays here —
// it must fire the moment the gate abstains.
console.log('\n✓ done')
