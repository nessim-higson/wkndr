// EDITORIAL JUDGE — the "best of the weekend" pass (V.6.4).
//
// The web_search extractor (llm/websearch, claude-haiku) decides what EXISTS this weekend; this STRONGER
// model decides what's WORTH KNOWING. It scores the already-validated, deduped, balanced LIVE candidates
// 0..10 on editorial merit — distinctiveness, local credibility, timeliness/urgency, variety — WITHOUT
// touching any facts (title/when/link/image are frozen). The score lands on Pick.editorScore and becomes a
// term in the app's rankPicks (src/weather/modes.ts), so "best" actually leads the deck instead of the feed
// being "whatever the cheap extractor cited, ordered by source tier."
//
// Uses a DISTINCT strong model via ANTHROPIC_JUDGE_MODEL (NOT ANTHROPIC_MODEL — that's the cheap haiku
// extractor; reusing it would defeat the out-class premise). One call per city per run, a few cents. Never
// throws: any failure → empty map → every editorScore stays undefined → today's behaviour.
import type { Pick } from '../../src/types'

const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_JUDGE_MODEL || 'claude-sonnet-4-6'

// Deterministic per-id order so the INPUT ordering can't bias the judge — and so runs stay reproducible
// (no Math.random). A simple string hash is plenty for a stable shuffle.
function idHash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h }

/** Score live candidates 0..10 by editorial merit → Map<id, score>. Never throws. */
export async function editorialScores(candidates: Pick[], cityName: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!KEY || candidates.length === 0) return out
  const list = [...candidates]
    .sort((a, b) => idHash(a.id) - idHash(b.id))
    .map((p) => ({ id: p.id, title: p.title, venue: p.venue, area: p.area, when: p.when, category: p.category, source: p.source, buzz: p.buzz, why: p.why }))

  const sys = `You are WKNDR's culture editor for ${cityName}. You will receive a JSON list of events already
confirmed to be on this coming weekend. Score EACH 0-10 for how much a culture-savvy local would want to KNOW
about it this weekend. Weigh: distinctiveness/originality, genuine local credibility, timeliness/urgency (a
one-off, a closing show, a real moment beats an always-on listing), and variety (don't let several
near-identical items all score high). CROSS-SOURCE BUZZ matters: an event whose "source" credits SEVERAL
independent publications (or buzz ≥ 2) is being talked about across the city's press — up-weight it; that is
the "everyone's going" signal. A generic tourist-trap or a thin listing scores low even from a good
source; a singular, only-this-weekend thing scores high. Do NOT invent, rewrite or re-date anything — judge
only what is given. Reply with ONLY a JSON array, no prose: [{"id": string, "score": number}].`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,   // headroom: ~25 tokens/row so a large candidate set's JSON array never truncates
        system: sys,
        messages: [{ role: 'user', content: `Events:\n${JSON.stringify(list)}\n\nReturn ONLY the JSON array of {id, score}.` }],
      }),
    }).then((r) => r.json())
    if (res?.error || !Array.isArray(res?.content)) {
      console.log(`    · editor: API → ${JSON.stringify(res?.error ?? 'no content').slice(0, 160)}`)
      return out
    }
    const text = res.content.filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text).join('')
    const a = text.indexOf('['), b = text.lastIndexOf(']')
    if (a === -1 || b === -1) return out
    const rows = JSON.parse(text.slice(a, b + 1)) as { id?: string; score?: number }[]
    for (const r of rows) {
      if (typeof r?.id === 'string' && typeof r?.score === 'number' && isFinite(r.score)) {
        out.set(r.id, Math.max(0, Math.min(10, r.score)))
      }
    }
  } catch (e) {
    console.log(`    · editor: threw — ${(e as Error).message}`)
  }
  return out
}
