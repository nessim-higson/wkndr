// THE WINGS (V.11.10) — what the deck deals when you've been through this weekend's set. Until now
// the browse deck was bottomless by RECYCLING: swipe past everything and it quietly cleared your
// declines and re-dealt the same cards ("it reshuffles the deck with the same cards" — Ness,
// 2026-09-06). But the pipeline already holds more: the BENCH (candidates.<city>.json — picks that
// passed every screen and lost a slot to the caps) and the part of the AIRLOCK that cleared the
// judge and was held only by the no-photo cap. Those are the honest "more". When they run out too,
// the deck ends — and says so.
import type { Pick } from '../types'

const LIVE = ['web-', 'llm-', 'rss-', 'sk-']
const JUDGE_FLOOR = 5   // mirrors scripts/lib/pipeline.ts — below it the airlock is junk, not "more"

const key = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(19|20)\d{2}\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').sort().join(' ')

/** Merge the bench and the merit part of the airlock behind the feed — deduped by id and by title. */
export function mergeWings(feed: Pick[], bench: Pick[], pending: Pick[]): Pick[] {
  const ids = new Set(feed.map((p) => p.id))
  const titles = new Set(feed.map((p) => key(p.title)))
  const out: Pick[] = []
  const take = (p: Pick) => {
    if (!p || !p.id || !p.title || ids.has(p.id)) return
    const k = key(p.title)
    if (titles.has(k)) return
    ids.add(p.id); titles.add(k); out.push(p)
  }
  for (const p of bench) take(p)
  for (const p of [...pending].filter((p) => LIVE.some((pre) => p.id.startsWith(pre)) && (p.judgeScore ?? 0) >= JUDGE_FLOOR)
    .sort((a, b) => (b.judgeScore ?? 0) - (a.judgeScore ?? 0))) take(p)
  return out
}

/** Fetch both files for a city. Fail-soft: a missing file is an empty list, never an error. */
export async function fetchWings(base: string, city: string): Promise<{ bench: Pick[]; pending: Pick[] }> {
  const get = async (name: string, field: string): Promise<Pick[]> => {
    try {
      const r = await fetch(`${base}data/${name}.${city}.json`)
      if (!r.ok) return []
      const j = await r.json()
      return Array.isArray(j?.[field]) ? j[field] : []
    } catch { return [] }
  }
  const [bench, pending] = await Promise.all([get('candidates', 'candidates'), get('pending', 'pending')])
  return { bench, pending }
}
