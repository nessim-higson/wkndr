// A VENUE IS A PLACE, NEVER A PUBLISHER (2026-09-19; rule corrected 2026-10-02).
//
// The I amsterdam adapter used to fill an unknown venue with "I amsterdam", and the guides adapter
// with the guide's own name, so a card's foot read "I amsterdam · Museumplein" while its neighbour
// read "Mozes en Aäronkerk · free" — Ness: "an indication at the bottom of the card of where this is
// from … it's a little confusing, some cards have it, some don't." The adapters no longer write it
// and the pipeline scrubs it, but a feed already served can still carry it, so every surface that
// prints a venue goes through here.
//
// THE RULE NAMES PUBLISHERS. The first cut blanked any venue that matched one of the pick's own
// SOURCES — which erased every venue that publishes its own programme: "Eye Filmmuseum" from Eye's
// own site, Efteling, Micropia, Madurodam. A museum listing its own show is a place AND a source.
// A guide, a listing site or a map is never a place; those are named here, once, for the client
// (placeOf) and the pipeline (poster.ts realVenue → refresh / restamp) alike. A new guide adapter
// adds its name to this list.
import type { Pick } from '../types'

export const PUBLISHERS = [
  'i amsterdam', 'iamsterdam', 'your little black book', 'lbb', 'amsterdam tips', 'amsterdamtips',
  'amsterdamnow', 'amsterdam now', 'amsterdam foodie', 'kidsproof', 'uitkrant', 'het parool', 'het parool ps',
  'girls who magazine', 'time out', 'timeout', 'lost in amsterdam', 'resident advisor', 'songkick',
  'maps', 'google maps', 'ness canon', 'fresh find', 'the web', 'web',
]

export const isPublisher = (name: string): boolean => PUBLISHERS.includes(name.trim().toLowerCase())

/** the pick's venue, or '' when the "venue" is a publisher's name */
export function placeOf(p: Pick): string {
  const v = (p.venue ?? '').trim()
  return v && !isPublisher(v) ? v : ''
}
