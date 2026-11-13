// THE TWO PILES (proto/two-piles) — your saves split into THIS WEEKEND (the plan: what a share
// sends) and the LIBRARY (later dates, open runs, the evergreens: things you can do any week).
// The split defaults to the Later-shelf rule (account.ts shelfOf); the two pills move a save
// across for THIS weekend only. Overrides are keyed by the served weekend's end date, so next
// week every save sits where its date puts it again — the plan is a weekly thing, the library
// is not. Local only for now (`wkndr.plan.v1`): the account contract doesn't carry it yet.
import { type SaveEntry, shelfOf } from './account'
import { upcomingWeekendEnd } from './when'

export const KEY_PLAN = 'wkndr.plan.v1'
export type Pile = 'weekend' | 'library'
export interface Plan { wk: string; add: string[]; drop: string[] }   // add → weekend, drop → library

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12) }
const OPEN_RUN = /\b(until|through|thru|till|t\/m)\b/i

/** The served weekend, as the key a plan belongs to. */
export const weekendKey = (now: Date = new Date()) => iso(upcomingWeekendEnd(now))
export const emptyPlan = (now: Date = new Date()): Plan => ({ wk: weekendKey(now), add: [], drop: [] })

/** Where a save's date puts it, before any pill. */
export const naturalPile = (e: SaveEntry, now: Date = new Date()): Pile => (shelfOf(e, now) === 'later' ? 'library' : 'weekend')

export function pileOf(e: SaveEntry, plan: Plan, now: Date = new Date()): Pile {
  if (plan.add.includes(e.id)) return 'weekend'
  if (plan.drop.includes(e.id)) return 'library'
  return naturalPile(e, now)
}

/** Move a save to a pile for this weekend. Moving it back to where its date puts it just clears
 *  the override, so the plan never carries a no-op. */
export function movePile(plan: Plan, e: SaveEntry, to: Pile, now: Date = new Date()): Plan {
  const add = plan.add.filter((id) => id !== e.id)
  const drop = plan.drop.filter((id) => id !== e.id)
  if (to === naturalPile(e, now)) return { ...plan, add, drop }
  return to === 'weekend' ? { ...plan, add: [...add, e.id], drop } : { ...plan, add, drop: [...drop, e.id] }
}

/** The library, soonest first: a dated save by its date, a run by its end (the deadline), the
 *  undated ones (evergreens pushed out of the plan) last, oldest save first. */
export function libraryShelf(saves: SaveEntry[], plan: Plan, now: Date = new Date()): SaveEntry[] {
  const key = (e: SaveEntry) => (e.start && !OPEN_RUN.test(e.when) ? e.start : (e.end ?? e.start ?? '9999'))
  return saves.filter((e) => pileOf(e, plan, now) === 'library')
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.at - b.at))
}

/** What a library row says about when it comes round: "Next weekend" when its first day falls in
 *  the weekend after the served one; null otherwise (the row's own `when` already says the date). */
export function arrivesLabel(e: SaveEntry, now: Date = new Date()): string | null {
  if (!e.start) return null
  const end = upcomingWeekendEnd(now)
  const nextEnd = new Date(end); nextEnd.setDate(end.getDate() + 7)
  const t = fromIso(e.start).getTime()
  return t > end.getTime() && t <= nextEnd.getTime() ? 'Next weekend' : null
}

/* ───────────────────────────── storage (thin) ───────────────────────────── */

/** A stored plan is only read for the weekend it was made for. */
export function loadPlan(now: Date = new Date()): Plan {
  try {
    const p = JSON.parse(localStorage.getItem(KEY_PLAN) || 'null') as Plan | null
    if (p && p.wk === weekendKey(now) && Array.isArray(p.add) && Array.isArray(p.drop)) return p
  } catch { /* unreadable → fresh */ }
  return emptyPlan(now)
}
export function persistPlan(p: Plan) {
  try { localStorage.setItem(KEY_PLAN, JSON.stringify(p)) } catch { /* private mode */ }
}
