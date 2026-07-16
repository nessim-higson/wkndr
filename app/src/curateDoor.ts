// ─── THE CURATION DOOR ──────────────────────────────────────────────────────────────
// One memorable URL that lands Ness on the right instrument for the screen he's holding:
//
//   app.wkndr.xyz/?curate2026!   on a laptop  → the BOARD (/curate/) — the studio grid
//                                on a phone   → TRIAGE — the airlock deck
//
// That split isn't a convenience, it's the thesis (docs/curation-surfaces.md §3): a grid
// exists to COMPARE (pile order, tiers, the canon library — 1180px of scanning), a deck
// exists to DECIDE (one card, verdict, next). The board on a phone is 203 screens of
// scroll; the deck on a desktop wastes a monitor. The door just picks for you.
//
// ⚠️  THIS IS A SHORTCUT, NOT A LOCK. The bundle ships to everyone and /curate/ answers
// anyone who types it. `?dev=1` is worse only because it's the FIRST thing a curious
// person tries; this isn't guessable. Neither is authentication. If the board ever needs
// to be actually private, that's Cloudflare Access on /curate/* — see §4/§6 of the doc.
//
// Kept separate from DEVUI (`?dev=1`) on purpose: that flag is the *design* surface (all
// views, look switcher, tint sliders, fps readout) and has no business appearing when
// you're stood on a tram ruling on the airlock. Different job, different door. The dev
// menu's ⚖️ Triage button still works under ?dev=1 for driving the deck at a desk.

// Encoding-proof + punctuation-optional: matches ?curate2026, ?curate2026!, and
// ?curate2026%21 alike. Browsers usually leave `!` alone (it's an RFC 3986 sub-delim)
// but "usually" is not a contract, and neither is Ness remembering the bang.
const DOOR = /curate2026/i

export const CURATE_DOOR = DOOR.test(window.location.search)

// The board's grid is `repeat(auto-fill, minmax(230px, 1fr))` inside a 1180px max-width —
// it needs real estate to be a grid at all. Under ~720px it stops comparing and starts
// scrolling, which is the exact failure the deck exists to fix. Width, not user-agent:
// this is a question about screen real estate, not about what device someone owns.
const STUDIO_MIN_WIDTH = 720

// Called from main.tsx BEFORE ReactDOM.render — a redirect after mount would flash the
// app first. `replace` (not `assign`) so Back goes where Ness came from, not into a loop.
export function openCurateDoor(): void {
  if (!CURATE_DOOR) return
  if (window.innerWidth >= STUDIO_MIN_WIDTH) {
    window.location.replace(`${import.meta.env.BASE_URL}curate/`)
  }
  // Narrow screen → fall through and boot the app; App.tsx opens Triage on mount.
}
