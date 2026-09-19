// ─── THE CURATION DOOR ──────────────────────────────────────────────────────────────
// One memorable URL that lands Ness on the board, whatever he is holding:
//
//   app.wkndr.xyz/?curate2026!   → THE LETTER (/curate/) — phone or laptop
//
// Until V.11.12 the door split by width: a laptop went to the studio grid, a phone to the Triage
// deck (docs/curation-surfaces.md §3 — a grid compares, a deck decides). The letter is written to
// be read top to bottom on a phone in two minutes and corrected inline, so the split has no job
// left: one door, one instrument. Triage still exists behind the ?dev=1 menu for driving the
// airlock deck at a desk; the studio grid is parked at /curate/legacy/.
//
// ⚠️  THIS IS A SHORTCUT, NOT A LOCK. The bundle ships to everyone and /curate/ answers
// anyone who types it. `?dev=1` is worse only because it's the FIRST thing a curious
// person tries; this isn't guessable. Neither is authentication. Every WRITE the board makes
// is gated by the worker's X-Curate-Key; if the board ever needs to be actually private,
// that's Cloudflare Access on /curate/* — see §4/§6 of the doc.
//
// Kept separate from DEVUI (`?dev=1`) on purpose: that flag is the *design* surface (all
// views, look switcher, tint sliders, fps readout) and has no business appearing when
// you're stood on a tram ruling on the week. Different job, different door.

// Encoding-proof + punctuation-optional: matches ?curate2026, ?curate2026!, and
// ?curate2026%21 alike. Browsers usually leave `!` alone (it's an RFC 3986 sub-delim)
// but "usually" is not a contract, and neither is Ness remembering the bang.
const DOOR = /curate2026/i

export const CURATE_DOOR = DOOR.test(window.location.search)

// Called from main.tsx BEFORE ReactDOM.render — a redirect after mount would flash the
// app first. `replace` (not `assign`) so Back goes where Ness came from, not into a loop.
export function openCurateDoor(): void {
  if (!CURATE_DOOR) return
  window.location.replace(`${import.meta.env.BASE_URL}curate/`)
}
