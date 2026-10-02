// Regression guard for scripts/lib/pipeline.ts — dedupe (the multi-source union), titleKey identity,
// the image URL screens, and the weekend window. These are the pure functions the whole content
// pipeline leans on; each rule here encodes a bug we actually hit during the pipeline era.
import { describe, it, expect } from 'bun:test'
import { dedupe, unionCredits, titleKey, urlLooksNonPhoto, toPortrait, upcomingWeekend, whenBeforeWeekend, imagePassBroken, largerRenditions, pagePhotosFrom, isOwnPage, approvalCheck, type TasteCorpus, type WeeklySlate, untrustedWebPick, ADAPTER_PICK, OWN_RECORD, OWN_IMAGE, iamsLanguageTwins, crossSourceTwins, suspectTwins } from '../scripts/lib/pipeline'
import { whenIsPast } from '../src/lib/when'
import type { Pick } from '../src/types'

const P = (o: Partial<Pick> & { id: string; title: string }): Pick => ({
  venue: 'V', area: '', when: 'Sat 4 Jul', category: 'live', freshness: 'weekend',
  outdoor: false, kid: false, price: '', blurb: '', why: '', source: 'S', link: 'https://x.example',
  weatherFit: ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE'], ...o,
})

describe('titleKey — canonical event identity', () => {
  it('matches title variants of the same event', () => {
    expect(titleKey('Holland Festival 2026: Alain Clark & friends')).toBe(titleKey('Holland Festival'))
  })
  it('drops city tokens', () => {
    expect(titleKey('Vunzige Deuntjes Festival Amsterdam')).toBe(titleKey('Vunzige Deuntjes Festival'))
  })
})

describe('dedupe — unioning many sources safely', () => {
  it('merges same-title keyless picks and counts buzz', () => {
    const out = dedupe([
      P({ id: 'web-a-same-night', title: 'Same Night', source: 'Source A' }),
      P({ id: 'llm-b-same-night', title: 'Same Night', source: 'Source B' }),
    ])
    expect(out.length).toBe(1)
    expect(out[0].buzz).toBe(2)
    expect(out[0].source).toContain('Source A')
    expect(out[0].source).toContain('Source B')
  })

  it('NEVER collapses two structured picks (distinct events, same-ish title)', () => {
    const out = dedupe([
      P({ id: 'web-iams-show-jul-4', title: 'Summer Show' }),
      P({ id: 'web-iams-show-jul-5', title: 'Summer Show' }),
    ])
    expect(out.length).toBe(2)   // stable ids = distinct instances — the multi-date-collapse bug
  })

  it('folds a keyless duplicate INTO the structured pick (cross-source corroboration)', () => {
    const out = dedupe([
      P({ id: 'web-iams-big-show', title: 'Big Show', source: 'I amsterdam' }),
      P({ id: 'web-search-big-show', title: 'Big Show', source: 'Your Little Black Book', popularity: 300 }),
    ])
    expect(out.length).toBe(1)
    expect(out[0].id).toBe('web-iams-big-show')      // structured identity survives
    expect(out[0].buzz).toBe(2)                       // corroboration counted
    expect(out[0].popularity).toBe(300)               // strongest draw signal carried through
  })

  it('collapses near-duplicate keyless titles by prefix', () => {
    const out = dedupe([
      P({ id: 'web-a-gnr', title: "Guns N' Roses" }),
      P({ id: 'web-b-gnr-plus', title: "Guns N' Roses and Mammoth" }),
    ])
    expect(out.length).toBe(1)
  })

  it('folds a near-match keyless title into its structured twin (prefix, both directions)', () => {
    const out = dedupe([
      P({ id: 'web-iams-world-press-photo-2026', title: 'World Press Photo 2026', source: 'I amsterdam' }),
      P({ id: 'web-lbb-world-press-photo-exhibition-2026', title: 'World Press Photo Exhibition 2026', source: 'Your Little Black Book' }),
    ])
    expect(out.length).toBe(1)
    expect(out[0].id).toBe('web-iams-world-press-photo-2026')
    expect(out[0].buzz).toBe(2)
  })
})

describe('unionCredits — the buzz count must be earnable, not inflatable', () => {
  // The three traps board V.9.43 surfaced, pinned at the source. Grachtenfestival shipped buzz 3
  // off two real publications because a websearch LLM cited both in ONE slash-joined string.
  it('splits a slash-compound credit instead of counting it as a phantom source', () => {
    const u = unionCredits('Your Little Black Book', 'I amsterdam / Your Little Black Book')
    expect(u.source).toBe('Your Little Black Book · I amsterdam')
    expect(u.buzz).toBe(2)
  })
  it('is idempotent — re-folding an already-doubled string cannot grow it', () => {
    const doubled = 'Your Little Black Book · I amsterdam / Your Little Black Book · I amsterdam'
    expect(unionCredits(doubled)).toEqual({ source: 'Your Little Black Book · I amsterdam', buzz: 2 })
  })
  it('dedupes case-insensitively, keeping first-seen casing', () => {
    const u = unionCredits('I amsterdam', 'I Amsterdam')
    expect(u.source).toBe('I amsterdam')
    expect(u.buzz).toBe(1)
  })
  it('keeps tier labels in the display string but out of the count', () => {
    const u = unionCredits('Fresh find', 'I amsterdam')
    expect(u.source).toBe('Fresh find · I amsterdam')
    expect(u.buzz).toBe(1)   // "Fresh find" is scouted.ts's label, not a corroborating publication
  })
  it('does not split names on an unspaced slash (24/7 Gym stays whole)', () => {
    expect(unionCredits('24/7 Gym').source).toBe('24/7 Gym')
  })
  it('survives undefined and empty sources', () => {
    expect(unionCredits(undefined, '', 'RA')).toEqual({ source: 'RA', buzz: 1 })
  })
})

describe('image URL screens', () => {
  it('flags organiser logos/wordmarks (the black-card class)', () => {
    expect(urlLooksNonPhoto('https://app.thefeedfactory.nl/api/assets/x/LOGO___WORDMARK_square_black.webp')).toBe(true)
  })
  it('flags watermarked stock hosts (the Magnific class)', () => {
    expect(urlLooksNonPhoto('https://img.freepik.com/premium-photo/theatre_1288284.jpg')).toBe(true)
  })
  it('passes real photos', () => {
    expect(urlLooksNonPhoto('https://images.pexels.com/photos/302769/pexels-photo-302769.jpeg')).toBe(false)
    expect(urlLooksNonPhoto('https://upload.wikimedia.org/wikipedia/commons/6/62/Albert_Cuypmarkt.jpg')).toBe(false)
  })
})

describe('toPortrait — wsrv wrap', () => {
  it('wraps an https source and is idempotent', () => {
    const wrapped = toPortrait('https://example.com/a.jpg')
    expect(wrapped).toContain('images.weserv.nl')
    expect(toPortrait(wrapped)).toBe(wrapped)
  })
  it('leaves non-https URLs alone (mixed-content guard handles them elsewhere)', () => {
    expect(toPortrait('http://example.com/a.jpg')).toBe('http://example.com/a.jpg')
  })
})

describe('weekend window', () => {
  const NOW = new Date(2026, 6, 1, 12)   // Wed 1 Jul 2026
  it('computes the coming weekend from a weekday', () => {
    const wk = upcomingWeekend(NOW)
    expect([wk.sat.getDate(), wk.sun.getDate(), wk.cutoff.getDate()]).toEqual([4, 5, 3])
  })
  it('build-time whenIsPast (the unified src/lib/when brain) drops finished events, keeps evergreen', () => {
    expect(whenIsPast('Sun 28 Jun', NOW)).toBe(true)
    expect(whenIsPast('Daily · dinner', NOW)).toBe(false)
  })
  it('whenBeforeWeekend screens dated weekday one-offs, keeps weekend + evergreen', () => {
    expect(whenBeforeWeekend('Thu 2 Jul', NOW)).toBe(true)    // ends before the Fri cutoff
    expect(whenBeforeWeekend('Sat 4 Jul', NOW)).toBe(false)
    expect(whenBeforeWeekend('Daily · dinner', NOW)).toBe(false)
  })
})

// V.8.14 — titleLooseMatch: the PILE-ORDER matcher. Pins R4's three real losses (7/10 stamped):
// the board stores drag-time titles verbatim; the next crawl retitles or trims them.
import { titleLooseMatch } from '../scripts/lib/pipeline'

describe('titleLooseMatch — board titles vs re-crawled feed titles', () => {
  it('survives a descriptive suffix being dropped (Nara Nara / Jollof)', () => {
    expect(titleLooseMatch('Nara Nara', 'Nara Nara Egyptian restaurant')).toBe(true)
    expect(titleLooseMatch('The Jollof Club', 'The Jollof Club West-African restaurant')).toBe(true)
  })
  it('survives a retitle with shared core tokens (Kwaku weekend naming)', () => {
    expect(titleLooseMatch('Kwaku Summer Festival Opening Weekend', 'Kwaku Summer Festival - Weekend 1')).toBe(true)
  })
  it('still matches identical and diacritic-shifted titles', () => {
    expect(titleLooseMatch('World Press Photo', 'World Press Photo')).toBe(true)
    expect(titleLooseMatch('Ekō – Japan in twee beeldverhalen', 'Eko - Japan in twee beeldverhalen')).toBe(true)
  })
  it('does NOT over-match unrelated events', () => {
    expect(titleLooseMatch('Summer Festival Amsterdam', 'Kwaku Summer Festival - Weekend 1')).toBe(false)
    expect(titleLooseMatch('Jazz at H\'ART Museum', 'Jazz op het IJ')).toBe(false)
    expect(titleLooseMatch('Nara Nara', 'Nora')).toBe(false)
  })
})

// V.9.9 — the board-drift fix: the pipeline stamps the PROJECTED SERVE ORDER (the app's own
// rankPicks → diversify → orderServed) onto published picks; the Curation Board reads the stamp.
// Pins the live 2026-07-12 defect: the board's inline pile-mirror ignored pilePos, so Ness's own
// dragged order ruled the app while the board showed a phantom pile.
import { stampServeOrder } from '../scripts/lib/pipeline'

describe('stampServeOrder — the board reads the deck, not a mirror', () => {
  it('stamps every pick, 1-based and unique', () => {
    const out = stampServeOrder([P({ id: 'a', title: 'A' }), P({ id: 'b', title: 'B' }), P({ id: 'c', title: 'C' })], 'WARM')
    const pos = out.map((p) => p.servePos).sort()
    expect(pos).toEqual([1, 2, 3])
  })
  it('a hand-dragged pilePos rules the stamp — above even an active 👑 TOP', () => {
    const dragged = P({ id: 'dragged', title: 'Dragged', pilePos: 1 })
    const top = P({ id: 'top', title: 'Crowned', top: true, when: 'Daily' })
    const out = stampServeOrder([top, dragged], 'WARM')
    expect(out.find((p) => p.id === 'dragged')?.servePos).toBe(1)
    expect(out.find((p) => p.id === 'top')?.servePos).toBe(2)
  })
  it('null mode (forecast down) still stamps — neutral WARM, never an unstamped feed', () => {
    const out = stampServeOrder([P({ id: 'x', title: 'X' })], null)
    expect(out[0].servePos).toBe(1)
  })
})

describe('dedupe — a keyless twin folds into its structured record at 10 key chars (V.11.11)', () => {
  it('"Yayoi Kusama Exhibition Opening" folds onto the organiser\'s "Yayoi Kusama"', () => {
    const out = dedupe([
      P({ id: 'web-iams-yayoi-kusama', title: 'Yayoi Kusama', source: 'I amsterdam', image: 'https://i/k.jpg' }),
      P({ id: 'web-lbb-yayoi-kusama-exhibition-opening', title: 'Yayoi Kusama Exhibition Opening', source: 'Your Little Black Book' }),
      P({ id: 'web-x-yayoi-kusama-exhibition-opens', title: 'Yayoi Kusama Exhibition Opens', source: 'Het Parool' }),
    ])
    expect(out.length).toBe(1)
    expect(out[0].id).toBe('web-iams-yayoi-kusama')
    expect(out[0].buzz).toBe(3)
  })
  it('a shorter shared start still does not collapse two keyless events', () => {
    // PASS 2 measures the 't:'-prefixed key (≥12 = 10 bare chars); "jazznight" is 9
    const out = dedupe([P({ id: 'web-a-x', title: 'Jazz Night' }), P({ id: 'web-b-y', title: 'Jazz Night Special Edition' })])
    expect(out.length).toBe(2)
  })
})

// A HAND CALL IS A THIS-WEEKEND CALL (2026-09-18). The pile's #1 (filed `new`) and #3 (filed
// `always`) were dealt first and shown to nobody: the default deck opens on the This-weekend lens.
import { markThisWeekend, pickByTitle } from '../scripts/lib/pipeline'
describe('the slate files its cards under the default lens', () => {
  it('a piled or led card becomes weekend, whatever it was filed as', () => {
    expect(markThisWeekend({ freshness: 'always' }).freshness).toBe('weekend')
    expect(markThisWeekend({ freshness: 'new' }).freshness).toBe('weekend')
    expect(markThisWeekend({ freshness: 'weekend' }).freshness).toBe('weekend')
  })
  it('a pile title lands on the exact title before the loose match', () => {
    const picks = [{ title: 'Sandberg x Schilo: 5-course pop-up dinner inspired by Yayoi Kusama' }, { title: 'Yayoi Kusama' }, { title: 'Foam' }, { title: 'FOAM Photography Museum' }]
    expect(pickByTitle(picks, 'Yayoi Kusama')?.title).toBe('Yayoi Kusama')
    expect(pickByTitle(picks, 'yayoi  kusama')?.title).toBe('Yayoi Kusama')
    expect(pickByTitle(picks, 'FOAM Photography Museum')?.title).toBe('FOAM Photography Museum')
    expect(pickByTitle(picks, 'Kusama exhibition')?.title).toBeUndefined()
  })
})


describe('imagePassBroken — the publish gate reads an OUTAGE, not a percentage', () => {
  it('passes the two autumn runs it wrongly refused (2026-09-21 / 09-24)', () => {
    expect(imagePassBroken(99, 56, 47)).toBe(false)   // 24 Sep: 43 imaged of 99, last good served 47
    expect(imagePassBroken(85, 45, 47)).toBe(false)   // 21 Sep
  })
  it('fails when the imaged count collapses — keys or network down', () => {
    expect(imagePassBroken(99, 92, 47)).toBe(true)    // 7 of 99
    expect(imagePassBroken(120, 60, 130)).toBe(true)  // 60 imaged against 130 serving: half of last good
    expect(imagePassBroken(120, 60, 100)).toBe(false) // 60 against 100: thinner, not broken
  })
  it('a first run has only the floor; a tiny crawl never trips it', () => {
    expect(imagePassBroken(99, 56, null)).toBe(false)
    expect(imagePassBroken(99, 70, null)).toBe(true)
    expect(imagePassBroken(6, 6, 47)).toBe(false)
  })
})

describe('largerRenditions — the same photograph, more pixels', () => {
  it('asks a resize query for one sane width and keeps the rest of the query', () => {
    const v = largerRenditions('https://www.artis.nl/media/drvgtbyd/deepseeingcurrents_liggend.jpg?width=1200&height=630&quality=80&v=1dd5')
    expect(v[0]).toBe('https://www.artis.nl/media/drvgtbyd/deepseeingcurrents_liggend.jpg?quality=80&v=1dd5&width=2000')
    expect(v[v.length - 1]).toBe('https://www.artis.nl/media/drvgtbyd/deepseeingcurrents_liggend.jpg?width=1200&height=630&quality=80&v=1dd5')
  })
  it('knows WordPress, Craft, Wix and Squarespace', () => {
    expect(largerRenditions('https://x.nl/wp-content/uploads/2026/09/guide-700x525.jpg')[0]).toBe('https://x.nl/wp-content/uploads/2026/09/guide.jpg')
    expect(largerRenditions('https://assets.eyefilm.nl/images/programme-item/_1200x630_crop_center-center_none/campagnebeeld.jpg')[0]).toBe('https://assets.eyefilm.nl/images/programme-item/campagnebeeld.jpg')
    expect(largerRenditions('https://static.wixstatic.com/media/396d30_3e~mv2.jpg/v1/fill/w_600,h_400,al_c/396d30_3e~mv2.jpg')[0]).toBe('https://static.wixstatic.com/media/396d30_3e~mv2.jpg')
    expect(largerRenditions('https://images.squarespace-cdn.com/content/v1/a/b/room.jpg?format=750w')[0]).toBe('https://images.squarespace-cdn.com/content/v1/a/b/room.jpg?format=2500w')
  })
  it('leaves a plain URL alone, and always ends on the URL as given', () => {
    expect(largerRenditions('https://x.nl/photo.jpg')).toEqual(['https://x.nl/photo.jpg'])
    for (const u of ['https://x.nl/a-700x525.jpg', 'https://x.nl/a.jpg?w=600']) { const v = largerRenditions(u); expect(v[v.length - 1]).toBe(u) }
  })
})

describe("the page's own photographs", () => {
  const html = `<img src="/img/logo.png"><img data-src="https://cdn.x.nl/room.jpg" src="data:image/gif;base64,AAA">
    <picture><source srcset="/a-400.jpg 400w, /a-1600.jpg 1600w, /a-800.jpg 800w"><img src="/a-400.jpg"></picture>
    <img src="//cdn.x.nl/bar.webp?x=1&amp;y=2"><img src="/sprite-icons.png"><img src="/vector.svg">`
  it('takes the largest srcset entry and lazy sources, resolves them, skips logos, icons and vectors', () => {
    expect(pagePhotosFrom(html, 'https://x.nl/menu/')).toEqual(['https://cdn.x.nl/room.jpg', 'https://x.nl/a-1600.jpg', 'https://x.nl/a-400.jpg', 'https://cdn.x.nl/bar.webp?x=1&y=2'])
  })
  it('only an event’s or a venue’s own page counts as its page', () => {
    for (const u of ['https://bistrodefles.nl/', 'https://www.artis.nl/en/x', 'https://www.eyefilm.nl/en/programme/x/1']) expect(isOwnPage(u)).toBe(true)
    for (const u of ['https://www.yourlittleblackbook.me/en/weekendtips-amsterdam/', 'https://www.iamsterdam.com/en/whats-on/x', 'https://www.instagram.com/bar_francois/', 'https://duckduckgo.com/?q=x', 'https://tiqets.tpo.lv/d7W']) expect(isOwnPage(u)).toBe(false)
  })
})

describe('a starred venue admits its own programme', () => {
  const corpus = { starredKeeps: [], topPicks: [], starredVenues: [{ match: 'eye filmmuseum', stars: 4 }] } as unknown as TasteCorpus
  const weekly = { weekend: '', lead: [], later: [], pile: [] } as unknown as WeeklySlate
  it('by venue, at the bar, and nobody else', () => {
    const ok = approvalCheck(corpus, weekly, [])
    expect(ok({ title: 'Ulrich Seidl – Über das Leben', venue: 'Eye Filmmuseum' })).toBe(true)
    expect(ok({ title: 'Some other show', venue: 'Stedelijk Museum' })).toBe(false)
    expect(ok({ title: 'Eye-catching market', venue: '' })).toBe(false)
  })
})

describe('a structured adapter’s pick is never an unverified web-search find', () => {
  it('Eye’s permanent exhibition lives at a URL that looks like an index — and is kept', () => {
    expect(untrustedWebPick({ id: 'web-eye-permanent-exhibition', link: 'https://www.eyefilm.nl/en/permanent-exhibition', buzz: 1 })).toBe(false)
  })
  it('a lone web-search pick behind a listing index is dropped; a second source or a real page keeps it', () => {
    expect(untrustedWebPick({ id: 'web-java-vintage-market', link: 'https://www.iamsterdam.com/en/whats-on', buzz: 1 })).toBe(true)
    expect(untrustedWebPick({ id: 'web-java-vintage-market', link: '', buzz: 1 })).toBe(true)
    expect(untrustedWebPick({ id: 'web-java-vintage-market', link: 'https://www.iamsterdam.com/en/whats-on', buzz: 2 })).toBe(false)
    expect(untrustedWebPick({ id: 'web-java-vintage-market', link: 'https://javaplein.nl/agenda/vintage-market-oktober', buzz: 1 })).toBe(false)
    expect(untrustedWebPick({ id: 'llm-eye-filmmuseum-x', link: 'https://www.eyefilm.nl/en/whats-on', buzz: 1 })).toBe(false)   // the LLM lane is judged elsewhere
  })
  it('every adapter answers all three questions', () => {
    for (const a of ['iams', 'ra', 'scout', 'eye']) { expect(ADAPTER_PICK.test(`web-${a}-x`)).toBe(true); expect(OWN_RECORD.test(`web-${a}-x`)).toBe(true); expect(OWN_IMAGE.test(`web-${a}-x`)).toBe(true) }
    // LBB: its photograph is its own and it is no web-search guess — but only a weekend TIP is a resolved
    // record. An agenda pick is an LLM reading of an article and must be offered the organiser's record:
    // "Cabinet Design Market" (LBB) is "CABINET | Curated curiosa & design weekendmarkt" (I amsterdam)
    for (const id of ['web-lbb-cabinet-design-market', 'web-lbb-tips-vermut-in-oud-west']) { expect(ADAPTER_PICK.test(id)).toBe(true); expect(OWN_IMAGE.test(id)).toBe(true) }
    expect(OWN_RECORD.test('web-lbb-tips-vermut-in-oud-west')).toBe(true)
    expect(OWN_RECORD.test('web-lbb-cabinet-design-market')).toBe(false)
    expect(ADAPTER_PICK.test('web-guide-iams-x')).toBe(true); expect(OWN_IMAGE.test('web-guide-iams-x')).toBe(true)
    expect(OWN_RECORD.test('web-guide-iams-x')).toBe(false)     // a guide item is still offered the organiser's record
    expect(ADAPTER_PICK.test('web-hero-x')).toBe(true); expect(OWN_IMAGE.test('web-hero-x')).toBe(false)   // a hero's image is a hand pin
    for (const rx of [ADAPTER_PICK, OWN_RECORD, OWN_IMAGE]) expect(rx.test('web-some-search-find')).toBe(false)
  })
})

describe('one event, two records — I amsterdam’s English and Dutch slug', () => {
  const en = { id: 'web-iams-weekend-of-science-in-amsterdam', link: 'https://www.iamsterdam.com/en/whats-on/calendar/festivals/events/weekend-of-science-in-amsterdam', when: 'Sat 3 – Sun 4 Oct', venue: 'Diverse locaties door heel Amsterdam' }
  const nl = { id: 'web-iams-weekend-van-de-wetenschap', link: 'https://www.iamsterdam.com/uit/agenda/festivals/events/weekend-van-de-wetenschap', when: 'Sat 3 – Sun 4 Oct', venue: 'Diverse locaties door heel Amsterdam' }
  it('one from each tree, same dates, same place: the same event', () => {
    expect(iamsLanguageTwins(en, nl)).toBe(true)
    expect(iamsLanguageTwins(nl, en)).toBe(true)
  })
  it('two listings from ONE tree are a reseller’s — different events that share a photo', () => {
    expect(iamsLanguageTwins(en, { ...en, id: 'web-iams-candlelight-queen' })).toBe(false)
  })
  it('different dates or a different place is a different event; so is anything that is not an I amsterdam record', () => {
    expect(iamsLanguageTwins(en, { ...nl, when: 'Sat 10 – Sun 11 Oct' })).toBe(false)
    expect(iamsLanguageTwins(en, { ...nl, venue: 'NEMO Science Museum' })).toBe(false)
    expect(iamsLanguageTwins(en, { ...nl, id: 'web-lbb-tips-weekend-van-de-wetenschap' })).toBe(false)
    expect(iamsLanguageTwins({ ...en, link: 'https://weekendvandewetenschap.nl/' }, nl)).toBe(false)   // off-site link: the tree is unknown
  })
})

describe('one event, two organiser records — I amsterdam lists the festival, Resident Advisor its night', () => {
  const iams = { id: 'web-iams-butoh-festival-amsterdam-x-edition-teatro-munganga', title: 'Butoh Festival Amsterdam X Edition - Teatro Munganga', venue: 'Teatro Munganga' }
  const ra = { id: 'web-ra-2291184', title: 'Butoh Festival Amsterdam', venue: 'Teatro Munganga' }
  it('one from each source, the same venue, one title inside the other', () => {
    expect(crossSourceTwins(iams, ra)).toBe(true)
    expect(crossSourceTwins(ra, iams)).toBe(true)
  })
  it('two records from ONE source never fold, however alike', () => {
    expect(crossSourceTwins(ra, { ...ra, id: 'web-ra-2291185' })).toBe(false)
    expect(crossSourceTwins(iams, { ...iams, id: 'web-iams-butoh-festival-amsterdam' })).toBe(false)
  })
  it('another venue, an unrelated title, a missing venue or a short title is not evidence', () => {
    expect(crossSourceTwins(iams, { ...ra, venue: 'Melkweg' })).toBe(false)
    expect(crossSourceTwins(iams, { ...ra, title: 'Paesaggi Records Autunno Minitour' })).toBe(false)
    expect(crossSourceTwins({ ...iams, venue: '' }, { ...ra, venue: '' })).toBe(false)
    expect(crossSourceTwins({ ...iams, title: 'Melkweg night' }, { ...ra, title: 'Melkweg' })).toBe(false)
    expect(crossSourceTwins(iams, { id: 'web-lbb-tips-butoh', title: 'Butoh Festival Amsterdam', venue: 'Teatro Munganga' })).toBe(false)
  })
  it('reads the venue past an article and an accent', () => {
    expect(crossSourceTwins({ ...iams, venue: 'Het Concertgebouw', title: 'Concertgebouw Open Day 2026' }, { ...ra, venue: 'Concertgebouw', title: 'Concertgebouw Open Day' })).toBe(true)
  })
})

describe('the page’s own photographs — a CMS that serves images without a file extension', () => {
  const html = `<img src="/img/woordmerk_darkgreen.svg"><img data-big='/File/image/lOBdmpV2IrLowAqML9sy' src='/File/image/lOBdmpV2IrLowAqML9sy/500' class='img-fluid'>
    <img src="/api/track?id=1"><a href="/File/pdf/menu">menu</a><img src="/images/foto_mm2.gif">`
  it('takes the full-size file route, then its thumbnail; never a vector, a GIF or a tracker', () => {
    expect(pagePhotosFrom(html, 'https://olmenhorst.nl/activiteiten/oogstfeesten-2026')).toEqual(['https://olmenhorst.nl/File/image/lOBdmpV2IrLowAqML9sy', 'https://olmenhorst.nl/File/image/lOBdmpV2IrLowAqML9sy/500'])
  })
})

describe('possible duplicate cards are said out loud', () => {
  const c = (id: string, title: string, venue: string) => ({ id, title, venue })
  it('the same distinctive name at the same place, under two titles', () => {
    const twins = suspectTwins([
      c('web-lbb-cabinet-design-market', 'Cabinet Design Market', 'Centrale Markt'),
      c('web-iams-cabinet-curated-curiosa-and-design-weekendmarkt', 'CABINET | Curated curiosa & design weekendmarkt', 'Centrale Markthal'),
      c('web-iams-the-maker-market', 'The Maker Market', 'De Hallen Amsterdam'),
    ])
    expect(twins).toHaveLength(1)
    expect(twins[0].map((p) => p.id)).toEqual(['web-lbb-cabinet-design-market', 'web-iams-cabinet-curated-curiosa-and-design-weekendmarkt'])
  })
  it('a venue’s own name, a generic word or another place is not a shared name', () => {
    expect(suspectTwins([c('a', 'Melkweg: Techno Tuesday', 'Melkweg'), c('b', 'Melkweg presents Cheeky Monday', 'Melkweg')])).toHaveLength(0)
    expect(suspectTwins([c('a', 'Sunday Market at Westergas', 'Westergas'), c('b', 'Sunday Roast Club', 'Westergas')])).toHaveLength(0)
    expect(suspectTwins([c('a', 'Cabinet Design Market', 'Centrale Markt'), c('b', 'Cabinet of Curiosities', 'Tropenmuseum')])).toHaveLength(0)
    expect(suspectTwins([c('a', 'Cabinet Design Market', ''), c('b', 'CABINET weekend', '')])).toHaveLength(0)
  })
})
