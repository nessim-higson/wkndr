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
import { whenIsPast, whenLooksBroken } from '../src/lib/when'

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
    expect(html).toContain("if(kind==='rest'){box.classList.add('asking-when');return}")
    // …and the date handlers are what call kill()
    expect(html).toMatch(/\.rchip\.until.*get\(\)\.until=inDays\(\+c\.dataset\.d\);kill\(\)/)
  })

  it('both views share ONE reason implementation (the V.9.25 drift bug)', () => {
    // exactly one wiring function, used by the Advanced card and the Simple row alike
    expect(html.match(/function wireReasons\(/g)?.length).toBe(1)
    // two CALL sites (lookbehind excludes the definition itself): Advanced card + Simple row
    expect(html.match(/(?<!function )wireReasons\(el,p,/g)?.length).toBe(2)
    expect(html.match(/const reasonBox=/g)?.length).toBe(1)
    expect(html).toContain("reasonBox('reasons')")
    expect(html).toContain("reasonBox('oreasons')")
  })

  it('the payload distinguishes a REST from a KILL', () => {
    expect(html).toContain("bits.push(v.until?'REST until '+v.until:'KILL')")
    expect(html).toContain("bits.push(v.until?'REST:'+v.until:'KILL')")
    expect(html).toContain('...(v.until?{until:v.until}:{})')   // and it reaches the fast-lane payload
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
