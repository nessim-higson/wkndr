import type { Pick } from '../types'

// Share links carry SHORT, STABLE codes — not raw pick ids. A code is a 7-char base36
// hash of the pick's venue+title, which (a) keeps a 10-pick link under ~90 characters
// where raw ids ran 400+, and (b) survives the weekly feed refresh: crawl ids rotate,
// but a pick that's still in the feed keeps the same venue+title, so old links keep
// resolving. Legacy full-id links still decode (inShared checks both).

function fnv(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

export function shortCode(p: Pick): string {
  const key = `${p.venue}|${p.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return fnv(key).toString(36).padStart(7, '0')
}

/** the canonical share URL: ?w=<codes>&from=<name> */
export function shareLink(picks: Pick[], from?: string): string {
  return `${location.origin}${location.pathname}?w=${picks.map(shortCode).join(',')}`
    + (from?.trim() ? `&from=${encodeURIComponent(from.trim())}` : '')
}

/** does this pick belong to a shared set? (new short codes OR legacy full ids) */
export function inShared(p: Pick, shared: Set<string>): boolean {
  return shared.has(shortCode(p)) || shared.has(p.id)
}
