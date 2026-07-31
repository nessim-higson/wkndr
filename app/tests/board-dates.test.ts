// THE BOARD/APP DATE INVARIANT — the Curation Board must show exactly what the app can serve.
//
// The board (public/curate/index.html) is dependency-free static JS, so it carries an INLINE MIRROR
// of src/lib/when.ts. A mirror that drifts is invisible until it bites: before board V.9.25 the board
// had no expiry guard at all, so on the 23 Jul feed — read on the 30th — last weekend's picks were
// still holding the opening deck's #2/#4/#5/#6 slots (Milkshake, IJ-Hallen Flea Market, Kwaku, Wils)
// while the app, which DOES filter on whenIsPast, had never served them to a tester.
//
// This test extracts the board's own helpers straight out of the HTML and asserts they agree with
// when.ts on every `when` string the shipped data contains, plus the adversarial shapes the live feed
// happens not to hold today (backwards ranges, Dec→Jan wraps, open runs, >45d-stale one-offs).
// Editing either side without the other goes red here.
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { whenIsPast, whenLooksBroken, whenWeekendDays, upcomingWeekendEnd } from '../src/lib/when'

const BOARD = join(import.meta.dir, '../public/curate/index.html')
const html = readFileSync(BOARD, 'utf8')

/** Lift a verbatim slice of the board's source, so the test runs the SHIPPED code, not a copy. */
function slice(start: string, end: string): string {
  const i = html.indexOf(start)
  expect(i, `board helper not found — did it get renamed? ${start}`).toBeGreaterThan(-1)
  const j = html.indexOf(end, i)
  expect(j, `no terminator for board helper: ${start}`).toBeGreaterThan(-1)
  return html.slice(i, j + end.length)
}

const src = [
  slice('const MONi=', 'return ts.sort((a,b)=>a-b)};'),
  slice('const TODAY=', 'const isOver=w=>{const ts=datesOf(w);return !!ts.length&&ts[ts.length-1]<TODAY};'),
  slice('const looksBroken=w=>{', '\n    return false};'),
].join('\n')
const board = new Function(`${src}\nreturn {isOver,looksBroken}`)() as {
  isOver: (w: string) => boolean
  looksBroken: (w: string) => boolean
}

// every distinct `when` the shipped data carries…
const DATA = join(import.meta.dir, '../public/data')
const whens = new Set<string>()
for (const f of ['picks.amsterdam.json', 'pending.amsterdam.json', 'trending.amsterdam.json',
                 'candidates.amsterdam.json', 'canon.amsterdam.json', 'canon-candidates.amsterdam.json',
                 'picks.new-orleans.json']) {
  const j = JSON.parse(readFileSync(join(DATA, f), 'utf8'))
  for (const rows of [j.picks, j.pending, j.trending, j.candidates, j.canon])
    for (const p of rows ?? []) if (p?.when != null) whens.add(p.when)
}
const fromFeed = whens.size
// …plus the shapes that break mirrors, which the feed may not contain on any given week
const ADVERSARIAL = [
  'Sun 28 – Sun 12 Jul',        // backwards range, one month token
  'Sat 12 Jul – Sun 28 Jun',    // explicit start/end, ends before it starts
  '20 Dec – 4 Jan',             // legitimate year wrap — must NOT read as broken
  'Until 15 Jan',               // open run pointing across the new year
  'Sat 3 May',                  // >45d stale one-off — must stay past, not resurrect as next year
  'Thu 30 Jul – Sun 2 Aug',     // cross-month range
  'Sat 25 – Sun 26 Jul',        // the Milkshake shape
  'Fri–Sun 24–26 Jul · ongoing',
  'Until 30 Aug', 'All summer · evenings', 'Opens 8 Sep',
  'Daily', 'Mon–Sat 09:00–18:00', '14:00–23:00', '',
]
for (const w of ADVERSARIAL) whens.add(w)

describe('curation board ↔ app date parity', () => {
  it('the board never shows a pick the app has already dropped as past', () => {
    const drift = [...whens].filter((w) => board.isOver(w) !== whenIsPast(w))
      .map((w) => `"${w}" — board.isOver=${board.isOver(w)} app.whenIsPast=${whenIsPast(w)}`)
    expect(drift).toEqual([])
  })

  it('the board and the app agree on which date ranges are malformed', () => {
    const drift = [...whens].filter((w) => board.looksBroken(w) !== whenLooksBroken(w))
      .map((w) => `"${w}" — board.looksBroken=${board.looksBroken(w)} app.whenLooksBroken=${whenLooksBroken(w)}`)
    expect(drift).toEqual([])
  })

  it('audits a real corpus of when-strings, not just the handwritten cases', () => {
    expect(fromFeed).toBeGreaterThan(50)
    expect(whens.size).toBeGreaterThan(fromFeed)
  })

  // ——— the ✕ vocabulary contract (V.9.26). The reason's `kind` IS the compile routing instruction
  // (docs/board-roadmap.md Track B), so a chip with no kind, or a kind the compiler doesn't handle,
  // is a verdict that silently does nothing. `rest` is the one that must carry a return date —
  // without `until`, corpus.rested can't know when to bring the pick back. ———
  const reasons = new Function(
    `${slice('const REASONS=[', '];')}\n${slice('const REASON_KIND=', 'x.kind]));')}\n${slice('const REASON_LABEL=', "other:'cancelled → see note'};")}\nreturn {REASONS,REASON_KIND,REASON_LABEL}`,
  )() as {
    REASONS: { r: string; t: string; kind: string }[]
    REASON_KIND: Record<string, string>
    REASON_LABEL: Record<string, string>
  }

  it('every ✕ reason declares a kind the compiler routes on', () => {
    const KINDS = ['fix', 'rest', 'veto', 'other']
    expect(reasons.REASONS.length).toBeGreaterThan(0)
    expect(reasons.REASONS.filter((x) => !KINDS.includes(x.kind))).toEqual([])
    // and every reason is legible in the status panel / payload
    expect(reasons.REASONS.filter((x) => !reasons.REASON_LABEL[x.r])).toEqual([])
  })

  it('keeps a rest verb — the "not on right now" case IJ-Hallen needs', () => {
    const rest = reasons.REASONS.filter((x) => x.kind === 'rest').map((x) => x.r)
    expect(rest).toContain('offcycle')   // a pick that is fine, just not running this weekend
    expect(rest).toContain('seen')       // fatigue — same mechanism, different cause
    // a rest must never be routed as a permanent veto: corpus.rested vs corpus.eventVeto
    expect(reasons.REASON_KIND.offcycle).toBe('rest')
    expect(reasons.REASON_KIND.offbrand).toBe('veto')
  })

  it('offers a free-text escape hatch for reasons not on the list', () => {
    expect(reasons.REASONS.some((x) => x.kind === 'other')).toBe(true)
    expect(html).toContain('class="othertext"')
  })

  it('a rest asks for a return date, and only a date finalises it', () => {
    expect(html).toContain('Back when?')
    expect(html).toContain('const RESTS=')
    // the rest branch must NOT kill on the chip click — it waits for the date
    expect(html).toContain("if(kind==='rest'){box.dataset.pending=r;box.classList.add('asking-when');return}")
    // …and the date is what calls kill()
    expect(html).toContain('const rest=until=>{const v=get();v.reason=box.dataset.pending')
  })

  // A two-step reason (rest / other) must not tag the pick until the SECOND step completes. Round #19
  // shipped "IJ-Hallen | KILL why:other" with no note — the chip was pressed, the text never typed —
  // and the compile had to guess what he meant.
  it('an abandoned two-step reason leaves no half-written verdict', () => {
    const wire = slice('function wireReasons(', '\n}')
    const chipHandler = wire.slice(wire.indexOf("box.querySelectorAll('.rchip[data-kind]')"), wire.indexOf("const rest=until=>"))
    // the rest/other branches return BEFORE `v.reason=r` — that assignment sits after both guards
    const restIdx = chipHandler.indexOf("if(kind==='rest')")
    const otherIdx = chipHandler.indexOf("if(kind==='other')")
    const assignIdx = chipHandler.indexOf('v.reason=r;')
    expect(restIdx).toBeGreaterThan(-1)
    expect(otherIdx).toBeGreaterThan(-1)
    expect(assignIdx).toBeGreaterThan(otherIdx)
    expect(assignIdx).toBeGreaterThan(restIdx)
    // the free-text path writes reason and note together, never one without the other
    expect(html).toContain("const v=get();v.reason='other';v.note=s;")
  })

  // A pile and a kill naming the same pick contradict each other; the compile then has to pick one by
  // hand. buildOverrides stripped cancelled titles, but the GitHub issue line didn't (round #19 filed
  // a PILE-ORDER with IJ-Hallen at #4 that he had cancelled in the same round).
  it('cancelled titles are stripped from BOTH submit payloads', () => {
    expect(html).toContain('const order=PILE.filter(t=>!dead.has(t))')          // the issue line
    expect(html).toContain('pile:(PILE||[]).filter(t=>!dead.has(t)).slice(0,200)') // the fast lane
  })

  // ——— ✕ = CANCEL NOW, CLASSIFY LATER (V.9.27). Ness: "when I ✕ something out it should be removed
  // immediately from my board, and maybe put to a section where I can elaborate on it later."
  // Before this, ✕ only opened the picker and the card sat in place until classified — the verdict
  // blocked the removal, so triage stalled on every card. ———
  it('✕ cancels immediately — it never waits for a reason', () => {
    // both views call killNow() straight off the ✕; neither opens an inline picker any more
    expect(html).toContain('function killNow(p)')
    expect(html).toContain("el.querySelector('.okill').addEventListener('click',()=>killNow(p))")
    expect(html).toMatch(/querySelector\('\.kill'\)\.addEventListener\('click',\(\)=>\{[\s\S]{0,600}killNow\(p\)/)
    // the old classify-first affordances are gone
    expect(html).not.toContain("reasonBox('reasons')")
    expect(html).not.toContain(".addEventListener('click',()=>el.classList.toggle('asking'))")
  })

  it('a cancel with no reason is still a valid verdict', () => {
    // killNow sets killed WITHOUT touching reason — an un-reasoned cancel submits as a plain KILL
    expect(html).toMatch(/function killNow\(p\)\{const v=\(V\[vkey\(p\)\]\?\?=\{t:p\.title\}\);v\.killed=true;v\.flag=undefined;/)
    expect(html).toContain("return 'Cancelled — reason optional'")
  })

  it('cancelled picks land on a shelf that can be elaborated on later, or undone', () => {
    expect(html.match(/function renderCancelled\(/g)?.length).toBe(1)
    for (const host of ['cancelbox', 'cancelbox2'])          // rendered into BOTH views
      expect(html).toContain(`id="${host}"`)
    expect(html).toContain("for(const id of ['cancelbox','cancelbox2'])")
    expect(html).toContain('↩ Put back')
    expect(html).toContain("reasonBox('oreasons')")           // the chips live on the shelf now
    expect(html).toContain('.crow .oreasons{display:flex}')   // …and are always visible there
  })

  it('undo restores the original slot and keeps prior taste', () => {
    // cancelled titles stay in PILE (filtered at render, stripped from the payload) — that's what
    // makes Put back land in the old slot rather than at the bottom
    expect(html).toContain("for(const t of (PILE||[]))if(pick(t)&&!have.has(t)){full.push(t);have.add(t)}")
    expect(html).toContain('const dead=deadTitles()')
    // undo clears only the cancel fields, never stars/img
    expect(html).toMatch(/vv\.killed=undefined;vv\.flag=undefined;vv\.reason=undefined;vv\.until=undefined/)
  })

  it('both views share ONE reason implementation (the V.9.25 drift bug)', () => {
    expect(html.match(/function wireReasons\(/g)?.length).toBe(1)
    expect(html.match(/const reasonBox=/g)?.length).toBe(1)
    // one call site now — the shelf, which both views render
    expect(html.match(/(?<!function )wireReasons\(el,/g)?.length).toBe(1)
  })

  it('the payload distinguishes a REST from a KILL', () => {
    expect(html).toContain("bits.push(v.until?'REST until '+v.until:'KILL')")
    expect(html).toContain("bits.push(v.until?'REST:'+v.until:'KILL')")
    expect(html).toContain('...(v.until?{until:v.until}:{})')   // and it reaches the fast-lane payload
  })

  // ——— PER-DAY WEATHER (board V.9.30). The board's lens tests a pick against the mode of the day
  // it is actually on, mirroring lib/when.ts whenWeekendDays. A drifted mirror means the lens shows
  // a slice the deck would never serve — the exact class of bug the date parity above exists for. ———
  it('the board’s daysOf agrees with the app’s whenWeekendDays', () => {
    const end = upcomingWeekendEnd()
    const SUN = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    const SAT = new Date(SUN.getFullYear(), SUN.getMonth(), SUN.getDate() - 1)
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const ds = (d: Date) => `${d.getDate()} ${M[d.getMonth()]}`
    // WKEND is the board's end-of-Sunday timestamp; datesOf + daysOf are lifted verbatim
    const src = [
      `const WKEND=${SUN.getTime() + 86_399_999};`,
      slice('const MONi=', 'return ts.sort((a,b)=>a-b)};'),
      slice('const daysOf=w=>{', "return o.sat||o.sun?o:BOTH};"),
    ].join('\n')
    const daysOf = new Function(`${src}\nreturn daysOf`)() as (w: string) => { sat: boolean; sun: boolean }

    const cases = [
      `Sat ${ds(SAT)}`, `Sun ${ds(SUN)}`, `${ds(SAT)} – ${ds(SUN)}`,
      'Daily · 9:00–18:00', 'Ongoing', 'Until 30 Aug', 'All summer · evenings', '',
      `Fri ${ds(new Date(SAT.getFullYear(), SAT.getMonth(), SAT.getDate() - 1))} · 23:00`,
      `Sat–Sun ${SAT.getDate()}–${SUN.getDate()} ${M[SUN.getMonth()]}`,
    ]
    const drift = cases.filter((w) => {
      const a = daysOf(w), b = whenWeekendDays(w, SAT, SUN)
      return a.sat !== b.sat || a.sun !== b.sun
    })
    expect(drift).toEqual([])
  })

  it('the board judges a pick against its own day, not one blended mode', () => {
    expect(html).toContain('const modesOf=p=>')
    expect(html).toContain('const fitsWx=p=>')
    // the lens filter must go through fitsWx, never a bare WX.mode includes()
    expect(html).toContain('dateInWknd(p.when)&&fitsWx(p)')
    expect(html).not.toContain('p.weatherFit.includes(WX.mode)')
  })

  it('the board still filters every list through servable()', () => {
    // the cull is the whole fix — if any of these go missing, dead picks are back on the board.
    // asserted as a list of names so a failure names the broken list instead of dumping the file.
    const missing = [
      ...(html.includes('const servable=p=>!isOver(p.when)&&!looksBroken(p.when)') ? [] : ['servable() predicate']),
      ...(html.includes('d.picks=cull(d.picks)') ? [] : ['the live feed']),
      ...['pending', 'trending', 'bench', 'canonC', 'canon'].filter((l) => !html.includes(`${l}=cull(${l})`)),
    ]
    expect(missing).toEqual([])
  })
})

// ── ONE VERDICT PER EVENT (board V.9.31) ────────────────────────────────────────────────────────
// The board renders the same event in several sections (the lens, the feed, the canon library, a
// trending twin). Keyed by pick ID, each copy held its OWN verdict — so ✕ on the feed card left the
// library card untouched, and round #22 filed one pick as both "Pure Markt | 4* KILL" and
// "Pure Markt | 4*". Keyed by the title token instead, twins are a single record.
describe('one verdict per event', () => {
  it('keys verdicts by the title token, not the pick id', () => {
    expect(html).toContain('const vkey=p=>tok(p.title||\'\')')
    // no verdict site may still read/write V by raw pick id
    expect(html).not.toMatch(/V\[p\.id\]/)
    expect(html).toContain('V[vkey(p)]')
  })

  it('cards carry their verdict key so every twin lights up together', () => {
    expect(html).toContain('el.dataset.vk=vkey(p)')
    expect(html).toContain('const v=V[el.dataset.vk||\'\']')
  })

  it('a cancel sweeps the twins off screen, not just the clicked card', () => {
    expect(html).toContain('.card[data-vk="${CSS.escape(vkey(p))}"]')
  })

  it('migrates an existing id-keyed round instead of losing it', () => {
    expect(html).toContain('V=rekey(s.V||{})')
    expect(html).toContain('function rekey(old)')
    expect(html).toContain('function mergeV(a,b)')
  })

  it('merging twins keeps the decisive call, never the bare star', () => {
    const src = slice('function mergeV(a,b){', '\n  return o}')
    const merge = new Function(`${src}\nreturn mergeV`)() as (a: Record<string, unknown>, b: Record<string, unknown>) => Record<string, unknown>
    // the exact #22 pair: one copy cancelled, the twin merely rated
    const out = merge({ t: 'Pure Markt', stars: 4, killed: true }, { t: 'Pure Markt', stars: 4 })
    expect(out.killed).toBe(true)
    expect(out.stars).toBe(4)
    // and the reverse order must agree — merge order is arbitrary
    const flipped = merge({ t: 'Pure Markt', stars: 4 }, { t: 'Pure Markt', stars: 4, killed: true })
    expect(flipped.killed).toBe(true)
    // a cancel clears any flag; the higher star survives
    const both = merge({ t: 'X', flag: true, stars: 5 }, { t: 'X', killed: true, stars: 3 })
    expect(both.killed).toBe(true)
    expect(both.flag).toBeUndefined()
    expect(both.stars).toBe(5)
  })
})
