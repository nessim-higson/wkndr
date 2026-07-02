// EDITORIAL JUDGE — the "best of the weekend" pass (V.6.4) + SEMANTIC DEDUP (V.7.4).
//
// The extractors (haiku) decide what EXISTS this weekend; this STRONGER model decides what's WORTH KNOWING.
// It scores the already-validated, deduped, balanced LIVE candidates 0..10 on editorial merit —
// distinctiveness, local credibility, timeliness/urgency, variety — WITHOUT touching any facts
// (title/when/link/image are frozen). The score lands on Pick.editorScore and becomes a term in the app's
// rankPicks (src/weather/modes.ts), so "best" actually leads the deck.
//
// It ALSO names DUPLICATE CLUSTERS: with many sources unioned, the same real-world event arrives under
// different titles and languages — "Festival TREK" / "TREK Amsterdam (Street Food Festival)" /
// "TREK Foodfestival", or "Love on the Canals" / "Liefde op de Grachten". titleKey/prefix rules can't
// catch those; a model reading the whole list can. refresh.ts merges each cluster into one card
// (structured id preferred, credits unioned into buzz).
//
// Uses a DISTINCT strong model via ANTHROPIC_JUDGE_MODEL (NOT ANTHROPIC_MODEL — that's the cheap haiku
// extractor). One call per city per run, a few cents. Never throws: any failure → empty result →
// every editorScore stays undefined and nothing merges → today's behaviour.
import type { Pick } from '../../src/types'
import corpus from '../taste/corpus.json'

const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_JUDGE_MODEL || 'claude-sonnet-4-6'

export interface EditorVerdict { scores: Map<string, number>; dupes: string[][] }

// Deterministic per-id order so the INPUT ordering can't bias the judge — and so runs stay reproducible
// (no Math.random). A simple string hash is plenty for a stable shuffle.
function idHash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h }

/** Score live candidates 0..10 + name same-event duplicate clusters. Never throws. */
export async function editorialScores(candidates: Pick[], cityName: string): Promise<EditorVerdict> {
  const out: EditorVerdict = { scores: new Map(), dupes: [] }
  if (!KEY || candidates.length === 0) return out
  const list = [...candidates]
    .sort((a, b) => idHash(a.id) - idHash(b.id))
    .map((p) => ({ id: p.id, title: p.title, venue: p.venue, area: p.area, when: p.when, category: p.category, source: p.source, buzz: p.buzz, why: p.why }))

  const sys = `You are WKNDR's culture editor for ${cityName}. You will receive a JSON list of events already
confirmed to be on this coming weekend. TWO JOBS.

1. SCORE each 0-10 for how much a culture-savvy local would want to KNOW about it this weekend. Weigh:
distinctiveness/originality, genuine local credibility, timeliness/urgency (a one-off, a closing show, a
real moment beats an always-on listing), and variety (don't let several near-identical items all score
high). CROSS-SOURCE BUZZ matters: an event whose "source" credits SEVERAL independent publications (or
buzz ≥ 2) is being talked about across the city's press — up-weight it. Generic filler scores ≤2 even
from a good source: a wide-release movie simply playing in cinemas, a tourist-trap, a thin listing.

2. Find DUPLICATES: entries that are the SAME real-world event under different titles, phrasings or
LANGUAGES (e.g. "Festival TREK" / "TREK Amsterdam (Street Food Festival)" / "TREK Foodfestival" are one
festival; "Love on the Canals" and "Liefde op de Grachten" are one exhibition). Same venue + same dates +
same concept = one event. Different editions, dates or genuinely different events are NOT duplicates —
when unsure, do NOT pair them.

NESS'S TASTE (the curator this feed serves — these override your instincts where they conflict):
${(corpus.eventRules as string[]).map((r) => '- ' + r).join('\n')}
His calibration anchors (title → his 1-5 stars):
${(corpus.starAnchors as { title: string; stars: number; note?: string }[]).map((a) => `- "${a.title}" → ${'★'.repeat(a.stars)}${a.note ? ' (' + a.note + ')' : ''}`).join('\n')}

Do NOT invent, rewrite or re-date anything — judge only what is given. Reply with ONLY JSON, no prose:
{"scores": [{"id": string, "score": number}, ...], "dupes": [[string, string, ...], ...]}
(dupes = arrays of ids that are one event; [] if none.)`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,   // headroom: ~25 tokens/row so a large candidate set's JSON never truncates
        system: sys,
        messages: [{ role: 'user', content: `Events:\n${JSON.stringify(list)}\n\nReturn ONLY the JSON object {scores, dupes}.` }],
      }),
    }).then((r) => r.json())
    if (res?.error || !Array.isArray(res?.content)) {
      console.log(`    · editor: API → ${JSON.stringify(res?.error ?? 'no content').slice(0, 160)}`)
      return out
    }
    const text = res.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text).join('')
    const a = text.indexOf('{'), b = text.lastIndexOf('}')
    if (a === -1 || b === -1) return out
    const obj = JSON.parse(text.slice(a, b + 1)) as { scores?: { id?: string; score?: number }[]; dupes?: unknown[] }
    for (const r of obj.scores ?? []) {
      if (typeof r?.id === 'string' && typeof r?.score === 'number' && isFinite(r.score)) {
        out.scores.set(r.id, Math.max(0, Math.min(10, r.score)))
      }
    }
    const ids = new Set(candidates.map((p) => p.id))
    for (const c of obj.dupes ?? []) {
      if (!Array.isArray(c)) continue
      const cluster = c.filter((x): x is string => typeof x === 'string' && ids.has(x))
      if (cluster.length >= 2 && cluster.length <= 5) out.dupes.push(cluster)   // conservative: small clusters only
    }
  } catch (e) {
    console.log(`    · editor: threw — ${(e as Error).message}`)
  }
  return out
}
