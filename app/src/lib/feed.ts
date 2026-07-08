// THE FEED BOUNDARY — the fetched picks JSON is the one untyped edge in the app. A pick missing
// its IDENTITY fields can't degrade gracefully (no id = broken React keys + corrupted save/swipe
// Sets; no title = a blank card), so those rows are DROPPED — loudly, in the console — instead of
// normalized. Every other missing field is soft-repaired downstream (App's cityPicks normalize
// pass, V.7.11 lineage). Belt to that brace: this catches the row the pipeline gate never saw.
import type { Pick } from '../types'

export function sanePicks(raw: unknown[]): Pick[] {
  const ok = (raw as Pick[]).filter((p) =>
    p && typeof p.id === 'string' && p.id.length > 0 &&
    typeof p.title === 'string' && p.title.length > 0 &&
    typeof p.category === 'string' && (p.when == null || typeof p.when === 'string'))
  if (ok.length < raw.length) console.warn(`wkndr: dropped ${raw.length - ok.length} malformed feed pick(s)`)
  return ok
}
