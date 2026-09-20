// A BLURB IS A SENTENCE ABOUT THE EVENT — not the page's furniture (2026-09-20).
//
// Two things reached the expanded card that were never copy:
//   · GALLERY CHROME. I amsterdam's JSON-LD description for a page with a photo carousel carries the
//     carousel with it: "Keerweer Image from Konstantin Sonnenkind Previous slide Next slide 1 / 2
//     Slide 1 of 2 There's nothing like a lakeside setting…". Everything up to the last carousel
//     control is the gallery (caption, credit, buttons, counter); the copy starts after it.
//   · THE GUILLOTINE. The adapter cut descriptions at 160 characters wherever that fell — "These
//     luncht". A cut now lands on a sentence end when there is one in reach, else on a word, and
//     says so with an ellipsis.
// Shared by the adapters (at ingest), the restamp (the feed already on disk) and nothing else: the
// client shows what the feed says.
const CONTROL = /(?:Previous slide|Next slide|Slide \d+ of \d+|Vorige dia|Volgende dia|Dia \d+ van \d+)/gi

/** strip a leading photo carousel (caption, credit, controls, counter) */
export function stripGallery(s: string): string {
  let last = -1
  for (const m of s.matchAll(CONTROL)) last = (m.index ?? 0) + m[0].length
  if (last < 0) return s
  return s.slice(last).replace(/^\s*\d+\s*\/\s*\d+\s*/, '')
}

/** The old adapter cut at 160 characters, wherever that fell; anything that long with no sentence end is a cut. */
const GUILLOTINE = 150

/** End a cut blurb honestly: on a sentence if one ends in reach, else on a whole word, with an ellipsis.
 *  A blurb that was never cut (short, or ending in punctuation) is returned as written. */
export function endCleanly(s: string, max = Infinity, wasCut = false): string {
  const endedOnSpace = /\s$/.test(s)
  const flat = s.replace(/\s+/g, ' ').trim()
  const cutHere = flat.length > max
  const out = cutHere ? flat.slice(0, max) : flat
  if (!out) return out
  if (!cutHere && /[.!?…]["”’')\]]?$/.test(out)) return out
  if (!cutHere && !wasCut && out.length < GUILLOTINE) return out
  const sentence = Math.max(out.lastIndexOf('. '), out.lastIndexOf('! '), out.lastIndexOf('? '))
  if (sentence >= out.length * 0.55) return out.slice(0, sentence + 1)
  // is the last token a whole word? we cut it ourselves mid-string → only if a space follows; it came to us cut → only if it ended on one
  const whole = cutHere ? flat.charAt(max) === ' ' : endedOnSpace
  const word = out.lastIndexOf(' ')
  const body = whole || word < 40 ? out : out.slice(0, word)
  return `${body.replace(/[\s,;:–—-]+$/, '')}…`
}

export const tidyBlurb = (s: string, max = Infinity): string =>
  (s ? endCleanly(stripGallery(s), max, s.trim().length >= GUILLOTINE && !/[.!?…]["”’')\]]?\s*$/.test(s)) : s)
