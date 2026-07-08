// Regression guard for src/lib/feed.ts — the runtime feed-boundary guard. A pick missing its
// identity fields is dropped at ingestion (broken React keys / corrupted save-Sets class),
// everything else passes through for the downstream soft-repair to normalize.
import { describe, it, expect } from 'bun:test'
import { sanePicks } from '../src/lib/feed'

const good = { id: 'a', title: 'A thing', category: 'live', when: 'Sat 11 Jul' }

describe('sanePicks', () => {
  it('passes well-formed picks through untouched', () => {
    expect(sanePicks([good]).length).toBe(1)
  })
  it('drops rows missing id or title (the un-repairable class)', () => {
    const rows = [good, { ...good, id: '' }, { title: 'no id', category: 'eat' }, { ...good, title: undefined }, null]
    const out = sanePicks(rows as unknown[])
    expect(out.length).toBe(1)
    expect(out[0].id).toBe('a')
  })
  it('keeps a pick with a missing when (soft-repaired downstream), drops a non-string one', () => {
    expect(sanePicks([{ ...good, when: undefined }]).length).toBe(1)
    expect(sanePicks([{ ...good, when: 42 }]).length).toBe(0)
  })
})
