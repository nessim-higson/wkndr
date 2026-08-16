// THE BUZZ TAG CONTRACT — corroboration shown on the board must never overclaim.
//
// The pipeline's `dedupe()` folds keyless duplicates into their structured twin and counts the
// corroboration as `buzz`, which then up-levels ranking steeply (2→+1.5, 3→+3, 4+→+4). Board V.9.43
// surfaces that as an "N SOURCES" tag so a promote/demote scan can see which picks the city agrees on.
//
// Two things can quietly turn that tag into a lie, so they are pinned here:
//   1. THE THRESHOLD. Below 2 there is no corroboration to claim — a lone source is not a chorus.
//   2. THE DOUBLED SOURCE STRING. Some picks ship `source` as "A · B / A · B" (Grachtenfestival on the
//      2026-08-13 feed). A naive split reports four corroborators for two publications.
// The count and the NAMES are allowed to disagree — `buzz` counts folded records while `source` keeps
// a display string — so the tooltip must state the count and list what is named WITHOUT implying the
// two are the same number.
//
// Like board-dates.test.ts, this lifts the shipped helpers straight out of the HTML: editing the board
// without editing the contract goes red here.
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BOARD = join(import.meta.dir, '../public/curate/index.html')
const html = readFileSync(BOARD, 'utf8')

function slice(start: string, end: string): string {
  const i = html.indexOf(start)
  expect(i, `board helper not found — did it get renamed? ${start}`).toBeGreaterThan(-1)
  const j = html.indexOf(end, i)
  expect(j, `no terminator for board helper: ${start}`).toBeGreaterThan(-1)
  return html.slice(i, j + end.length)
}

const src = [
  slice('const srcNames=', ".values()];"),
  slice('const buzzTag=', "+' SOURCES</span>';};"),
].join('\n')
const board = new Function(`${src}\nreturn {srcNames,buzzTag}`)() as {
  srcNames: (p: { source?: string }) => string[]
  buzzTag: (p: { buzz?: number; source?: string }) => string
}

const SRC_DOUBLED = 'Your Little Black Book · I amsterdam / Your Little Black Book · I amsterdam'

describe('board buzz tag', () => {
  it('says nothing below the corroboration threshold', () => {
    for (const buzz of [undefined, 0, 1])
      expect(board.buzzTag({ buzz, source: SRC_DOUBLED })).toBe('')
  })

  it('tags at 2 and up', () => {
    expect(board.buzzTag({ buzz: 2, source: 'A · B' })).toContain('2 SOURCES')
    expect(board.buzzTag({ buzz: 3, source: SRC_DOUBLED })).toContain('3 SOURCES')
  })

  it('collapses a doubled source string instead of counting it twice', () => {
    expect(board.srcNames({ source: SRC_DOUBLED }))
      .toEqual(['Your Little Black Book', 'I amsterdam'])
  })

  it('never claims more NAMES than it can show', () => {
    // buzz 3, two distinct publications: the tip must not read "across 3 sources — A · B"
    const tip = board.buzzTag({ buzz: 3, source: SRC_DOUBLED })
    expect(tip).toContain('3 corroborating mentions')
    expect(tip).toContain('named: Your Little Black Book · I amsterdam')
  })

  it('survives a missing or empty source', () => {
    expect(board.srcNames({})).toEqual([])
    expect(board.buzzTag({ buzz: 2 })).toContain('2 SOURCES')
    expect(board.buzzTag({ buzz: 2 })).not.toContain('named:')
  })

  it('holds on every buzzed pick in the shipped feed', () => {
    const feed = JSON.parse(readFileSync(join(import.meta.dir, '../public/data/picks.amsterdam.json'), 'utf8'))
    for (const p of feed.picks ?? []) {
      const tag = board.buzzTag(p)
      if ((p.buzz ?? 0) < 2) { expect(tag).toBe(''); continue }
      expect(tag).toContain(`${p.buzz} SOURCES`)
      // no name may appear twice in the tip — the doubled-string trap, on real data
      const named = board.srcNames(p).map(s => s.toLowerCase())
      expect(new Set(named).size).toBe(named.length)
    }
  })
})
