// THE INBOX SCORE (Workstream 2) — the composite ordering for the candidate inbox, so candidates
// "arrive already scored and ordered" (the brief's target flow, step 2). Pure and network-free;
// scripts/ingest.ts applies it, tests/score.test.ts pins it.
//
// The brief proposed four inputs. Honest accounting of what each maps to TODAY:
//   engagement velocity  → NOT AVAILABLE — needs the IG business_discovery poller (watchlist,
//                          gated on Ness-side Meta setup). Layers in later; see docs/ingest.md.
//   mention recency      → `buzz` (cross-source corroboration from dedupe's credit-union) +
//                          `firstSeen` recency from the seen registry.
//   novelty (first-seen) → the registry again — the top-weighted term, per the brief's law:
//                          novelty above raw volume, or the same five famous venues win weekly.
//   swipe affinity       → the board corpus (starAnchors ★3+ and starredKeeps), as a MULTIPLIER
//                          on the base — the brief's word — so taste amplifies signal rather
//                          than manufacturing it: an affinity hit on a zero-signal pick is 0.
//
// `realDraw` (RA's attending count) IS raw volume — that is why its cap sits below what novelty
// plus one corroborating source can earn. All weights live in taste/weights.json (config, not
// constants), overridable without a commit via WKNDR_WEIGHTS.
import type { Pick } from '../../src/types'
import { latestDateOf, whenActiveBy } from '../../src/lib/when'
import defaults from '../taste/weights.json'

export interface ScoreWeights {
  novelty: number; noveltyDays: number
  corroboration: number; corroborationCap: number
  realDraw: number
  dated: number; weekendBonus: number
  affinity: number
}

/** weights.json, with WKNDR_WEIGHTS (a JSON object) merged over it — tunable without a deploy. */
export function loadWeights(env: string | undefined = process.env.WKNDR_WEIGHTS): ScoreWeights {
  let over: Partial<ScoreWeights> = {}
  try { over = env ? JSON.parse(env) : {} } catch { console.warn('  weights:  WKNDR_WEIGHTS is not valid JSON — using taste/weights.json as-is') }
  return { ...(defaults as ScoreWeights & { _: string }), ...over }
}

/** The starred vocabulary — meaningful tokens from every title Ness has starred (anchors ★3+ and
 *  keeps). Coarse by design: token overlap is v1 affinity, not a model. Generic-but-tasteful words
 *  ("festival", "jazz") stay IN — if he stars festivals, festival-ness is signal; only pure glue
 *  and the city itself are stopped. */
const STOP = new Set(['amsterdam', 'the', 'this', 'that', 'with', 'van', 'het', 'een', 'and', 'voor', 'weekend', 'best', 'guide'])
export function starredVocabulary(corpus: { starAnchors?: { title: string; stars: number }[]; starredKeeps?: { match: string; stars: number }[] }): Set<string> {
  const vocab = new Set<string>()
  const feed = [
    ...(corpus.starAnchors ?? []).filter((a) => a.stars >= 3).map((a) => a.title),
    ...(corpus.starredKeeps ?? []).filter((k) => k.stars >= 4).map((k) => k.match),
  ]
  for (const t of feed) for (const w of t.toLowerCase().split(/[^a-z0-9à-ÿ]+/)) if (w.length >= 4 && !STOP.has(w)) vocab.add(w)
  return vocab
}

export interface InboxScore { score: number; why: string }

/** Score one candidate. `today` is injectable so tests can pin dates; the weekend window comes
 *  from the same date brain the deck uses (latestDateOf / whenActiveBy — no second parser). */
export function scoreInbox(p: Pick, vocab: Set<string>, w: ScoreWeights, today: string): InboxScore {
  const parts: string[] = []
  const t0 = new Date(today + 'T00:00:00Z').getTime()

  // NOVELTY — linear decay from full weight at arrival to 0 at noveltyDays. Unregistered = 0:
  // no arrival record earns nothing, the same fails-closed stance as effectiveFreshness.
  const seen = p.firstSeen ? Date.parse(p.firstSeen + 'T00:00:00Z') : NaN
  const age = Number.isFinite(seen) ? Math.max(0, (t0 - seen) / 864e5) : Infinity
  const novelty = age <= w.noveltyDays ? w.novelty * (1 - age / w.noveltyDays) : 0
  if (novelty > 0) parts.push(age < 1 ? 'seen today' : `seen ${Math.round(age)}d ago`)

  // CORROBORATION — independent sources beyond the first, the mention-recency proxy that exists.
  const corro = Math.min(w.corroborationCap, Math.max(0, (p.buzz ?? 1) - 1) * w.corroboration)
  if (corro > 0) parts.push(`${p.buzz} sources`)

  // REAL DRAW — RA attending on a log curve; deliberately capped below novelty + one corroboration.
  const draw = p.popularity ? Math.min(w.realDraw, Math.log10(p.popularity + 1)) : 0
  if (draw > 0) parts.push(`${p.popularity} going`)

  // DATED — a parseable real date separates events from article-shaped RSS items (whose default
  // "This weekend" deliberately does not parse); active-by-Sunday earns the weekend bonus on top.
  const latest = latestDateOf(p.when, new Date(t0))
  const sun = new Date(t0); sun.setUTCDate(sun.getUTCDate() + ((7 - sun.getUTCDay()) % 7)); sun.setUTCHours(23, 59, 59)
  const dated = latest ? w.dated + (whenActiveBy(p.when, sun, new Date(t0)) ? w.weekendBonus : 0) : 0
  if (latest) parts.push(dated > w.dated ? 'on this weekend' : 'real date')

  // AFFINITY — the personal MULTIPLIER (the brief's word): amplifies signal, never creates it.
  const words = `${p.title} ${p.venue}`.toLowerCase().split(/[^a-z0-9à-ÿ]+/)
  const hits = [...new Set(words.filter((x) => x.length >= 4 && vocab.has(x)))]
  const mult = 1 + w.affinity * Math.min(1, hits.length / 3)
  if (hits.length) parts.push(`taste: ${hits.slice(0, 3).join(' ')}`)

  const score = Math.round((novelty + corro + draw + dated) * mult * 10) / 10
  return { score, why: parts.join(' · ') || 'no signal yet' }
}
