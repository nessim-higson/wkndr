// CARD IMAGES (V.11.10) — one source, two shapes. The pipeline publishes every photo as a wsrv.nl
// 800×1200 portrait render (the phone card's shape; server-side fetch, hotlink-proof). The DESKTOP
// card is nearly square (min(52vw,560px) × ≤70vh), and painting the portrait render into it with
// `cover` cropped a crop — the middle band of an already-cropped frame: a red blob and a bridge where
// the Fringe dancer should be. So the card face asks wsrv for the UNCROPPED source (fit=inside, max
// 1600) and lets CSS do the one crop, positioned by the pick's focal point. Thumbs keep the portrait
// render — at 60px a saliency crop is fine and the bytes are smaller.
import type { Pick } from '../types'

/** The raw source behind a wsrv render (or the url itself). Mirror of scripts/lib/pipeline originalOf.
 *  ONE decode, and searchParams.get already did it: the pipeline encodes the source once
 *  (encodeURIComponent), so a second decodeURIComponent here turned the source's OWN escapes into
 *  characters — `%28Amsterdam%2C_The_Netherlands%29` became `(Amsterdam,_The_Netherlands)` — and
 *  encodeURIComponent never re-encodes `(` `)` `'`. The card then wrote `url(https://…(Amsterdam,…)…)`
 *  unquoted, CSS refused it, and the card painted nothing: the De Hallen market opened the deck as a
 *  blank on 2026-10-08, with four more live cards (Rijksmuseum and Foodhallen canon among them) the same. */
export function originalOf(src: string): string {
  try {
    const u = new URL(src)
    if (u.hostname === 'images.weserv.nl') {
      const raw = u.searchParams.get('url')
      if (raw) return raw
    }
  } catch { /* not a URL we understand — use as-is */ }
  return src
}

/** A CSS `url()` that survives any source: quoted, with the one character a quoted url cannot hold
 *  escaped. Unquoted `url(…)` dies on `(` `)` `'` and whitespace, and wsrv keeps a source's parentheses
 *  verbatim (`…adeliciousstory%2520(8).png`), so every inline backgroundImage goes through here. */
export function cssUrl(src: string): string {
  return `url("${src.replace(/["\\\n\r]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}")`
}

/** The card-face render: the uncropped source at ≤1600px, still through wsrv (fetch + fallback). */
export function cardImageOf(src: string): string {
  const orig = originalOf(src)
  if (orig === src) return src   // not a wsrv render (bundled/relative) — use as-is
  const enc = encodeURIComponent(orig)
  return `https://images.weserv.nl/?url=${enc}&w=1600&h=1600&fit=inside&output=jpg&default=${enc}`
}

/** A landscape (3:2) render for the detail sheet's header, cropped on the focal point when known. */
export function headerImageOf(src: string, focal?: [number, number]): string {
  const orig = originalOf(src)
  if (orig === src) return src
  const enc = encodeURIComponent(orig)
  const crop = focal ? `a=focal&fpx=${focal[0].toFixed(3)}&fpy=${focal[1].toFixed(3)}` : 'a=attention'
  return `https://images.weserv.nl/?url=${enc}&w=1200&h=800&fit=cover&${crop}&output=jpg&default=${enc}`
}

/** CSS background-position for a `cover` fit: the focal point, else centre-weighted a little
 *  high (faces and titles live in the upper half more often than the lower). */
export function focalPosition(p: Pick | undefined | null): string {
  const f = p?.imageFocal
  if (!f || !Number.isFinite(f[0]) || !Number.isFinite(f[1])) return '50% 40%'
  return `${Math.round(f[0] * 100)}% ${Math.round(f[1] * 100)}%`
}
