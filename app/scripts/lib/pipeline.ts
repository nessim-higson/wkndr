// Shared pipeline spine — the part every adapter reuses. Adapters do FETCH + NORMALIZE
// (source → Pick[]); this does the rest: DEDUPE → DERIVE → ENRICH(og:image) → PUBLISH.
// Plain Bun TypeScript, no app/React imports beyond the Pick type.
import type { Mode, Pick } from '../../src/types'

const ALL_MODES: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const FAIR_MODES: Mode[] = ['HOT', 'WARM', 'COOL']

// Indoor things are weather-proof (fit every mode incl. the wet ones); outdoor things are
// fair-weather only. Adapters can override, but this is the sane default.
export function deriveWeatherFit(outdoor: boolean): Mode[] {
  return outdoor ? [...FAIR_MODES] : [...ALL_MODES]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Merge the same event arriving from multiple adapters. Key = title+venue. The richest
// record wins; we union the source credits (the cross-source "buzz" signal lives here).
export function dedupe(picks: Pick[]): Pick[] {
  const byKey = new Map<string, Pick & { sources?: string[] }>()
  for (const p of picks) {
    const key = `${norm(p.title)}|${norm(p.venue)}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...p })
      continue
    }
    // keep the one with more info (longer blurb / has image), union the credits
    const richer = (p.blurb?.length ?? 0) + (p.image ? 50 : 0) > (existing.blurb?.length ?? 0) + (existing.image ? 50 : 0) ? p : existing
    const merged: Pick = { ...existing, ...richer }
    const credits = new Set((existing.source + ' · ' + p.source).split(' · ').filter(Boolean))
    merged.source = [...credits].join(' · ')
    merged.buzz = credits.size                                   // distinct sources = the "talked about" signal
    byKey.set(key, merged)
  }
  return [...byKey.values()]
}

// Keep the pool DIVERSE: cap how many of each category make the cut, so a firehose source
// (e.g. a ticketing feed full of gigs) can't drown out food / art / free / markets.
export function balanceByCategory(picks: Pick[], perCat = 6): Pick[] {
  const count: Record<string, number> = {}
  const kept: Pick[] = []
  for (const p of picks) {                                       // assumes input is already buzz/quality-ordered
    const c = count[p.category] ?? 0
    if (c >= perCat) continue
    count[p.category] = c + 1
    kept.push(p)
  }
  return kept
}

// Strip HTML to readable text for the LLM (drop script/style/nav noise, collapse whitespace).
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Best-effort og:image scrape for a single page. Returns a verified-looking image URL or
// null. Never throws — a blocked/slow page just means "keep the poster fallback".
export async function fetchOgImage(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok) return null
    const html = await res.text()
    const m =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    if (!m) return null
    let img = m[1].trim()
    if (img.startsWith('//')) img = 'https:' + img
    if (img.startsWith('/')) { const u = new URL(url); img = u.origin + img }
    return img.startsWith('http') ? img : null
  } catch {
    return null
  }
}

// Run an async fn over items with a concurrency cap (be polite to source servers).
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
