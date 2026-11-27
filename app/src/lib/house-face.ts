// THE HOUSE FACE (proto/type-cards, 2026-11-22) — the pure half.
//
// Ness, 13–15 Nov: "type focused, sophisticated and fresh" for the card that has no photograph;
// 22 Nov: "I thought we'd start to introduce those? I don't see them". His yes marks on the boards
// (Swiss, Light, Ledger, Margin, Emphasis, Numeral, Up, Bleed, Stair, Turned, Reflected, Strip, Bars)
// were distilled into one face: paper, ink, one brick-red point, Helvetica Neue Light / Medium, facts
// in small capitals — and ten composition MOVES, one per card. This file is the dealer and the text
// rules; HouseFace.tsx / HouseFace.css draw them. Nothing here reads the clock or the feed.

export const HOUSE_MOVES = ['rule', 'light', 'ledger', 'margin', 'num', 'refl', 'strip', 'up', 'bars', 'emph'] as const
export type HouseMove = typeof HOUSE_MOVES[number]
export const HOUSE_MOVE_LABEL: Record<HouseMove, string> = {
  rule: 'Rule', light: 'Light', ledger: 'Ledger', margin: 'Margin', num: 'Numeral',
  refl: 'Reflected', strip: 'Strip', up: 'Up', bars: 'Bars', emph: 'Emphasis',
}

/** Up to 24 characters a title is SHORT (Light 46); over it, LONG (Medium 30). The board's line. */
export const LONG_TITLE = 24
export const isLongTitle = (title: string): boolean => Array.from(title.trim()).length > LONG_TITLE

/** FNV-1a, as card-material.ts does it: the same id gives the same move on every phone. */
export function houseHash(id: string): number {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0
  return h
}

// ── the date a card carries ────────────────────────────────────────────────────────────────────
const DATE = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/
const ENDS = /^\s*(until|through|ends|t\/m)\b/i

/** The day the pick STARTS on, for the Numeral move — or null. "Until Sun 13 Dec" has no start day:
 *  a 232px "13" behind it would read as "on the 13th", which is the one thing the card doesn't know.
 *  (The board fell back to the served Saturday; on real `when` strings that printed a wrong date.) */
export function houseDay(when: string): { dow: string; day: string; mon: string } | null {
  if (ENDS.test(when)) return null
  const m = when.match(DATE)
  return m ? { dow: m[1], day: m[2], mon: m[3] } : null
}

/** The short date for a foot or a dateline: "Sat 21 Nov", "Until Sun 13 Dec" — or, undated, the
 *  feed's own words ("This weekend", "Every Saturday"). Never an invented date. */
export function houseDateLine(when: string): string {
  const head = when.split(' · ')[0].trim()
  const m = head.match(DATE)
  if (!m) return head
  const lead = head.slice(0, m.index).match(/(Until|From|Opens|Ends)\s+$/i)
  return `${lead ? lead[1] + ' ' : ''}${m[1]} ${m[2]} ${m[3]}`
}

// ── the dealer ────────────────────────────────────────────────────────────────────────────────
export interface HouseCard { id: string; title: string; when?: string }

/** A move a card may not take: a long title skips Up (it would run off the card's edge), and a pick
 *  with no start day skips Numeral (see houseDay). Every other move takes every card. */
export function moveFits(move: HouseMove, card: HouseCard): boolean {
  if (move === 'up') return !isLongTitle(card.title)
  if (move === 'num') return houseDay(card.when ?? '') !== null
  return true
}

/** A card's move is `hash(id) mod 10`. It steps on to the next move when its own would repeat the
 *  no-photo card before it (`prev`), or when the card can't carry it. */
export function houseMove(card: HouseCard, prev: HouseMove | null = null): HouseMove {
  let m = houseHash(card.id) % HOUSE_MOVES.length
  for (let tries = 0; tries < HOUSE_MOVES.length && (HOUSE_MOVES[m] === prev || !moveFits(HOUSE_MOVES[m], card)); tries++) {
    m = (m + 1) % HOUSE_MOVES.length
  }
  return HOUSE_MOVES[m]
}

/** Deal a laid deck: every card without a photograph gets its move, and no two no-photo cards IN A
 *  ROW share one (the pictured cards between them don't reset the count — two Ledgers either side of
 *  a photograph still read as a repeat). Call it on the order laid once per deal (App `dealt`), not
 *  on what is left after each swipe, or a card's move would change as its neighbour leaves. */
export function dealHouseMoves<T extends HouseCard & { image?: string | null }>(deck: T[], force: HouseMove | null = null): Map<string, HouseMove> {
  const out = new Map<string, HouseMove>()
  let prev: HouseMove | null = null
  for (const card of deck) {
    if (card.image) continue
    // THE STUDY OVERRIDE (`?move=ledger`): one move across the whole deck, to judge it on every real
    // title at once — the board's "isolate one move" chips. A card that can't carry it keeps its own.
    prev = force && moveFits(force, card) ? force : houseMove(card, force ? null : prev)
    out.set(card.id, prev)
  }
  return out
}

/** `?move=<name>` → the move to force, or null. Takes the key ("num") or the board's name ("Numeral"). */
export function forcedMove(q: string | null | undefined): HouseMove | null {
  const want = (q ?? '').trim().toLowerCase()
  return HOUSE_MOVES.find((m) => m === want || HOUSE_MOVE_LABEL[m].toLowerCase() === want) ?? null
}

// ── the text rules ────────────────────────────────────────────────────────────────────────────
const bare = (t: string) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
const LEAD = new Set(['the', 'a', 'an', 'de', 'het', 'een', 'must', 'see'])
// where the SUBJECT of a title ends: a preposition, a conjunction — or a verb ("Café Pietertje
// opens in Westerpark" bolded "opens" until the verbs were on this list)
const STOP = new Set(['at', 'in', 'on', 'of', 'with', 'for', 'to', 'and', 'x', 'by', 'from', 'behind',
  'van', 'bij', 'op', 'aan', 'met', 'en', 'voor', 'naar',
  'is', 'are', 'opens', 'open', 'opent', 'celebrates', 'viert', 'returns', 'comes'])

export const titleTokens = (title: string): string[] => title.trim().split(/\s+/).filter(Boolean)

/** EMPHASIS: which word of the title is its subject — the last word of the head, where the head
 *  ends at the first stop-word, a colon or dash, or an opening bracket. Returns the token's index
 *  (-1 for an empty title). "Proper Sunday Roast at Café Iep" → Roast; "Agaar (IDFA 2026)" → Agaar. */
export function emphasisIndex(title: string): number {
  const t = titleTokens(title)
  if (!t.length) return -1
  let start = 0
  while (start < t.length - 1 && LEAD.has(bare(t[start]).toLowerCase())) start++
  let end = t.length
  for (let i = start; i < t.length; i++) {
    if (i > start && (STOP.has(bare(t[i]).toLowerCase()) || t[i].startsWith('(') || /^[–—|-]$/.test(t[i]))) { end = i; break }
    if (/[:–—|]$/.test(t[i])) { end = i + 1; break }
  }
  let k = end - 1
  while (k > start && !/\p{L}/u.test(t[k])) k--   // "SCIM Amsterdam 2026 –" lands on Amsterdam, not 2026
  return k
}

/** BARS: the title as lines two words long. A pair that would run past `max` characters sets one
 *  word to a line instead, so no line is ever cut — the board's ellipsis lost half of the long
 *  titles. Punctuation at a word's edges is dropped (a bar is the punctuation); what is inside a
 *  word stays ("children's", "Oud-West"). */
export function barLines(title: string, max = 16): string[] {
  // a price is not punctuation: "€3" keeps its sign (bare() alone printed "sandos for 3 at"), as do "50%" and "21+"
  const edge = (w: string) => w.replace(/^[^\p{L}\p{N}\p{Sc}]+|[^\p{L}\p{N}\p{Sc}%+°]+$/gu, '')
  const words = titleTokens(title).map((w) => edge(w) || (w === '&' ? '&' : '')).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < words.length; i++) {
    const pair = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : ''
    if (pair && Array.from(pair).length <= max) { out.push(pair); i++ } else out.push(words[i])
  }
  return out
}

/** The longest unbreakable run in a title, in characters — the face sizes its type so this run fits
 *  the measure. A hyphen is a legal break ("Oud-West"), so it ends a run. */
export function longestRun(texts: string | string[]): number {
  const all = (Array.isArray(texts) ? texts : titleTokens(texts).flatMap((w) => w.split(/(?<=-)/)))
  return all.reduce((n, w) => Math.max(n, Array.from(w).length), 1)
}

/** A venue as the card prints it: the name, not the address. The feed carries "Café Pietertje, Van
 *  Limburg Stirumplein 4-6, Amsterdam-West" and, once, a stray "<st" of markup. */
export const shortPlace = (venue: string): string => venue.replace(/<[^>]*>?/g, '').split(',')[0].trim()

// ── which face is on ──────────────────────────────────────────────────────────────────────────
export const FACES = ['glass-opal', 'glass-smoked', 'glass-frosted', 'emboss-ivory', 'house'] as const
/** what a Card wears when nothing dealt it a face (the fan, the list, onboarding: surfaces outside the stack) */
export const FACE_FALLBACK = 'glass-opal'
/** what the stack's no-photo cards wear (V.12.12: the house face graduated from proto/type-cards) */
export const FACE_DEFAULT = 'house'
export const FACE_DEFAULT_KEY = 'wkndr.face.default'

/** THE SWITCH. The house face is the default; the glass study is still one flag away:
 *   `?face=glass-opal` — this load only (any study face by name).
 *   `?house=0`         — THIS DEVICE goes back to glass-opal and stays there (remembered);
 *                        `?house=1` forgets that and returns to the house face.
 *  `remember`: a face to store, null to clear, undefined to leave the stored choice alone. */
export function resolveFace(q: { face?: string | null; house?: string | null; stored?: string | null }): { face: string; remember?: string | null } {
  const known = (f?: string | null): f is string => !!f && (FACES as readonly string[]).includes(f)
  const on = q.house === '1' || q.house === 'true' || q.house === ''
  const off = q.house === '0' || q.house === 'false'
  const remember = on ? null : off ? FACE_FALLBACK : undefined
  const stored = on ? null : off ? FACE_FALLBACK : q.stored
  return { face: known(q.face) ? q.face : known(stored) ? stored : FACE_DEFAULT, remember }
}
