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
