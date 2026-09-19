// A VENUE IS A PLACE, NEVER A PUBLISHER (2026-09-19).
//
// The I amsterdam adapter used to fill an unknown venue with "I amsterdam", so a no-photo card's
// foot read "I amsterdam · Museumplein" while its neighbour read "Mozes en Aäronkerk · free" —
// Ness: "an indication at the bottom of the card of where this is from … it's a little confusing,
// some cards have it, some don't." The pipeline no longer writes it (and the restamp scrubs it),
// but a feed already served can still carry it, so every surface that prints a venue goes
// through here. The poster's realVenue is the same law, script-side.
import type { Pick } from '../types'

const PUBLISHERS = ['i amsterdam', 'iamsterdam', 'your little black book', 'amsterdamnow', 'kidsproof', 'maps', 'ness canon']

/** the pick's venue, or '' when the "venue" is one of its sources */
export function placeOf(p: Pick): string {
  const v = (p.venue ?? '').trim()
  if (!v) return ''
  const k = v.toLowerCase()
  const own = (p.source ?? '').split('·').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return own.includes(k) || PUBLISHERS.includes(k) ? '' : v
}
