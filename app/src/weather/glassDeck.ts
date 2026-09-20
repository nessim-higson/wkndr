// A GLASS CARD ONLY EVER SITS ON A PHOTOGRAPH (2026-09-20).
//
// Ness: "when you have two translucent cards it looks whack — please have them only on a photo card."
// A no-photo face is frosted glass, and the card behind it shows through. A photograph through frost
// is a soft field of colour; another glass card is a second layer of type and frost fighting the
// first. So the deck never deals two imageless cards in a row: when two would touch, the next
// pictured card steps between them. Stable otherwise, and a no-op once the pictured cards run out
// (or in the glass-only study, where every card is imageless on purpose).
export function neverTwoGlass<T extends { image?: string | null }>(deck: T[]): T[] {
  const out: T[] = []
  const rest = [...deck]
  while (rest.length) {
    let i = 0
    if (out.length && !out[out.length - 1].image && !rest[0].image) {
      const j = rest.findIndex((p) => !!p.image)
      if (j > 0) i = j
    }
    out.push(rest.splice(i, 1)[0])
  }
  return out
}
