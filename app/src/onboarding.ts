// ─── ONBOARDING — a minute to learn your taste (phase 1) ─────────────────────────────────
// The first-run flow that replaces the dev-only "Tune WKNDR" micro-deck. Every answer writes
// into the SAME on-device Taste the swipes write (taste.ts), in the ONLY vocabulary the model
// reads today (tokensFor: category, area, source, outdoor, kid, weather fit). So nothing here
// needs a new ranking term, and the weather still leads: tasteScore is clamped (−5…+6) under a
// weather term of ~10. Signed in, it rides the account like any other taste (lib/account.ts).
//
// Phase 1 asks four things: who's with you, six this-or-that pairs, twelve real swipes, and how
// you take rain. Where/spend, energy and day-vs-night wait for the pipeline to tag them.
import type { Pick } from './types'
import { CATEGORY_LABEL } from './types'
import { type Taste, tokensFor } from './taste'

export const KEY_ONBOARDED = 'wkndr.onboarded.v1'
export const KEY_PROFILE = 'wkndr.profile.v1'   // the answers that aren't weights yet (company, rain)

export type Company = 'solo' | 'partner' | 'friends' | 'kids'
export type RainTake = 'stay' | 'indoors' | 'anyway'
export type PairPick = 'a' | 'b' | 'both' | 'neither'
export interface Pair { a: Pick; b: Pick; slot: string }
export interface Profile { company: Company[]; rain: RainTake | null; at: string }

/** Each pair is tied to a moment, so the choice reads as a real decision, not a quiz. */
export const SLOTS = ['Saturday, 11:00', 'Saturday, 15:00', 'Saturday night', 'Sunday morning', 'Sunday afternoon', 'A free evening']

/** The tokens a pair is ABOUT: what kind of thing, outdoors or not, for kids or not. Not its
 *  weather fit, source or area — nearly every card shares those (an empty area is one shared
 *  token), so heavy onboarding writes on them lifted most of the deck to the taste cap and
 *  flattened the ranking (seen in the first end-to-end run: wf:COOL 11.5 after six pairs). */
export const pairTokens = (p: Pick): string[] => tokensFor(p).filter((t) => t.startsWith('cat:') || t === 'outdoor' || t === 'kid')

const add = (t: Taste, p: Pick, d: number): Taste => {
  const next = { ...t }
  for (const tok of pairTokens(p)) {
    const v = (next[tok] || 0) + d
    if (v === 0) delete next[tok]; else next[tok] = v
  }
  return next
}

/** Six pairs from the served deck: pictured cards only (a pair is judged on its photo), the two
 *  halves always different categories, and no card used twice — so six taps cover the range of
 *  the weekend rather than six flavours of the top category. Deterministic for a given deck. */
export function pickPairs(deck: Pick[], n = 6): Pair[] {
  const pool = deck.filter((p) => !!p.image)
  const used = new Set<string>()
  const catUse = new Map<string, number>()
  const pairs: Pair[] = []
  const fresh = (p: Pick) => !used.has(p.id) && (catUse.get(p.category) ?? 0) < 2
  for (const a of pool) {
    if (pairs.length >= n) break
    if (!fresh(a)) continue
    const b = pool.find((x) => x.id !== a.id && fresh(x) && x.category !== a.category)
    if (!b) continue
    for (const p of [a, b]) { used.add(p.id); catUse.set(p.category, (catUse.get(p.category) ?? 0) + 1) }
    pairs.push({ a, b, slot: SLOTS[pairs.length % SLOTS.length] })
  }
  return pairs
}

/** Twelve real cards for the swipe round, after the pairs: pictured first, at most two per
 *  category so the round samples the weekend instead of repeating its top shelf. */
export function pickSwipes(deck: Pick[], exclude: Set<string>, n = 12): Pick[] {
  const per = new Map<string, number>()
  const out: Pick[] = []
  const take = (p: Pick, cap: number) => {
    if (out.length >= n || exclude.has(p.id) || out.includes(p) || (per.get(p.category) ?? 0) >= cap) return
    out.push(p); per.set(p.category, (per.get(p.category) ?? 0) + 1)
  }
  for (const p of deck) if (p.image) take(p, 2)
  for (const p of deck) take(p, 3)   // a thin weekend: relax, never come up short for no reason
  return out
}

/** A pair is a direct comparison, so it says more than a swipe: the chosen card +2 on each of its
 *  tokens, the other −1. "Both" is a mild yes to each, "neither" a mild no. Multiples of 0.5,
 *  keeping taste.ts's float-exact ===0 contract. */
export function applyPair(t: Taste, pair: Pair, pick: PairPick): Taste {
  if (pick === 'a') return add(add(t, pair.a, 2), pair.b, -1)
  if (pick === 'b') return add(add(t, pair.b, 2), pair.a, -1)
  if (pick === 'both') return add(add(t, pair.a, 1), pair.b, 1)
  return add(add(t, pair.a, -1), pair.b, -1)
}

/** The swipe round's write: the deck's own weights (♥ +1, ★ +1.5, ✕ −1) on the same focused
 *  tokens as a pair, so twelve quick swipes teach "what kind of thing" without piling weight
 *  onto the weather and source tokens that every card shares. */
export function applyRoundSwipe(t: Taste, p: Pick, dir: 'like' | 'nope' | 'save' | 'skip'): Taste {
  const d = dir === 'save' ? 1.5 : dir === 'like' ? 1 : dir === 'nope' ? -1 : 0
  return d ? add(t, p, d) : t
}

/** Kids is the one company answer the model can read today (the `kid` token): a soft +3, never a
 *  filter. Solo / partner / friends are kept in the profile until picks carry a `with:` tag. */
export function applyCompany(t: Taste, company: Company[]): Taste {
  if (!company.includes('kids')) return t
  return { ...t, kid: (t.kid || 0) + 3 }
}

/** How you take rain, in the weather vocabulary every pick already carries. "Stay in" and
 *  "swap to indoors" lean toward the cards that suit a wet day (wf:COLD_WET); "go anyway" leans
 *  toward outdoors. Small on purpose: the forecast still does the heavy lifting. */
export function applyRain(t: Taste, take: RainTake | null): Taste {
  if (!take) return t
  const next = { ...t }
  const bump = (k: string, d: number) => { const v = (next[k] || 0) + d; if (v === 0) delete next[k]; else next[k] = v }
  if (take === 'stay') bump('wf:COLD_WET', 2)
  if (take === 'indoors') bump('wf:COLD_WET', 1)
  if (take === 'anyway') bump('outdoor', 1)
  return next
}

/* ─────────────────────────────── the reveal ─────────────────────────────── */

/** One fragment per category, so the headline is two of them: "Slow galleries, loud nights." */
const FRAG: Record<string, string> = {
  art: 'slow galleries', live: 'loud nights', eat: 'long dinners', drink: 'good bars', market: 'market mornings',
  out: 'fresh air', stage: 'a good seat', daytrip: 'a train out', shop: 'browsing',
}
const SHORT: Record<string, string> = {
  art: 'Art', live: 'Live music', eat: 'Eating out', drink: 'Bars', market: 'Markets', out: 'Out & about',
  stage: 'Stage & screen', daytrip: 'Day trips', shop: 'Shops',
}

export interface Reveal { headline: string; bars: { label: string; score: number }[]; traits: string[] }

/** The taste card, read straight off the weights: the five categories with the most signal
 *  (strongest first), scored 0–100 around a neutral 50, a headline from the top two, and the
 *  answers that aren't weights as plain traits. Pure, so the card always tells the truth. */
export function revealOf(t: Taste, profile: { company: Company[]; rain: RainTake | null }): Reveal {
  const cats = Object.keys(CATEGORY_LABEL).map((c) => ({ c, w: t[`cat:${c}`] || 0 }))
  cats.sort((x, y) => y.w - x.w || x.c.localeCompare(y.c))
  const bars = cats.slice(0, 5).map(({ c, w }) => ({ label: SHORT[c] ?? c, score: Math.max(4, Math.min(96, Math.round(50 + w * 7))) }))
  const top = cats.filter((x) => x.w > 0).slice(0, 2).map((x) => FRAG[x.c])
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const headline = top.length === 2 ? `${cap(top[0])}, ${top[1]}.` : top.length === 1 ? `${cap(top[0])}, mostly.` : 'A bit of everything.'
  const traits: string[] = []
  const who: Record<Company, string> = { solo: 'Often solo', partner: 'With a partner', friends: 'With friends', kids: 'Kids too' }
  for (const c of profile.company) traits.push(who[c])
  if (profile.rain) traits.push({ stay: 'Rain → stay in', indoors: 'Rain → indoors', anyway: 'Rain or shine' }[profile.rain])
  if ((t.outdoor || 0) > 0) traits.push('Outdoors when dry')
  return { headline, bars, traits }
}

/* ─────────────────────────────── when it shows ─────────────────────────────── */

/** First run only, and never over a shared round or the curation door. ?onboard=1 forces it (to
 *  judge it on a phone that has already been through), ?onboard=0 never shows it. Someone who
 *  already has a taste profile (an old device, a signed-in merge) is never asked to start over. */
export function shouldOnboard(o: { search: string; visits: number; hasTaste: boolean; onboarded: boolean; shared: boolean; curate: boolean }): boolean {
  const q = new URLSearchParams(o.search).get('onboard')
  if (q === '1') return true
  if (q === '0' || o.shared || o.curate) return false
  return o.visits <= 1 && !o.hasTaste && !o.onboarded
}
