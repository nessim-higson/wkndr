// THE LETTER BOARD — a renderer, by contract.
//
// public/curate/index.html reads data/letter.<city>.json and nothing else. The old board carried
// inline mirrors of the app's date brain, the weekend lens and the title key, and STATE.md records
// what each one cost when it drifted. The letter board is allowed NONE of them: every fact on the
// page is computed by the run that built the deck. What it must keep is the reply contract — the
// ✕ vocabulary the compile routes on, and the payload lines the compile parses — byte-for-byte
// with the parked board at curate/legacy/, because both still file into the same inbox.
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const html = readFileSync(join(import.meta.dir, '../public/curate/index.html'), 'utf8')
const legacy = readFileSync(join(import.meta.dir, '../public/curate/legacy/index.html'), 'utf8')

const reasons = (src: string) =>
  [...src.matchAll(/\{r:'([a-z]+)',\s*t:'([^']+)',\s*kind:'([a-z]+)'\}/g)].map((m) => [m[1], m[2], m[3]])

describe('the letter board is a renderer', () => {
  it('reads the letter and no other data file', () => {
    expect(html).toContain("fetch('../data/letter.'+CITY+'.json?t='+Date.now())")
    for (const f of ['picks.amsterdam', 'pending.amsterdam', 'candidates.amsterdam', 'canon.amsterdam', 'verdicts.amsterdam', 'inbox.amsterdam', 'ingest-health.amsterdam', 'trending.amsterdam'])
      expect(html, `the letter board must not read ${f}`).not.toContain(f)
  })
  it('carries no date brain, no weekend lens, no title-key mirror', () => {
    for (const marker of ['const MONi=', 'datesOf', 'isOver', 'looksBroken', 'function tok(', 'const tok=', 'TOKSTOP', 'datedThisWeekend', 'weatherFit'])
      expect(html, `mirror found: ${marker}`).not.toContain(marker)
    // it never fetches the forecast either — the letter was built against it
    expect(html).not.toContain('open-meteo')
  })
  it('keys verdicts by pick id and lights every rendered twin of a card together', () => {
    expect(html).toContain('data-id="\'+esc(id)+\'"')
    expect(html).toContain("document.querySelectorAll('.row[data-id]')")
  })
})

describe('the reply contract', () => {
  it('the ✕ vocabulary is byte-identical to the parked board\'s (the compile routes on kind)', () => {
    const mine = reasons(html), theirs = reasons(legacy)
    expect(mine.length).toBe(8)
    expect(mine).toEqual(theirs)
  })
  it('payload lines the compile parses are unchanged', () => {
    for (const s of ["'\\n- PILE-ORDER | '+order.join(' > ')", "'REST:'+v.until:'KILL'", "'why:'+v.reason", "bits.push('FLAG')", "bits.push('img:bad')", "'note:'+v.note", "v.stars+'*'"])
      expect(html, `missing payload marker ${s}`).toContain(s)
  })
  it('the fast lane is the same worker route, write-gated by the same key, never hardcoded', () => {
    expect(html).toContain("curateFetch('/curate/'+CITY,buildOverrides())")
    expect(html).toContain("'X-Curate-Key':key")
    expect(html).toContain("const KEY_LS='wkndr.curate.key'")
    expect(html).not.toMatch(/CURATE_KEY\s*=\s*'[^']+'/)
  })
  it('an untouched front sends an empty pile — the deck keeps its own order (lib/overrides.ts)', () => {
    expect(html).toContain('pile:S.hand?frontTitles().slice(0,200):[]')
  })
  it('the durable record is the same GitHub inbox', () => {
    expect(html).toContain("https://github.com/nessim-higson/wkndr/issues/new")
    expect(html).toContain('labels=curation')
  })
  it('two channels, not three — the Formspree mail is retired with the grid', () => {
    expect(html).not.toContain('formspree')
  })
})

describe('the parked board', () => {
  it('still works from its new address (data paths re-rooted) and says what it is', () => {
    expect(legacy).toContain("jf('../../data/picks.amsterdam.json'")
    expect(legacy).not.toContain("jf('../data/")
    expect(legacy).toContain('THE OLD BOARD')
  })
})
