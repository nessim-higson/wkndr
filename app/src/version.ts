// The live build version — BUMPED ON EVERY SHIP via `bun run bump`.
//
// SCHEME (from V.3 onward): V.<major>.<sub>. Each ship bumps the sub-counter:
//   V.3 → V.3.1 → V.3.2 → … → V.3.9 → (rolls) → V.4 → V.4.1 → …
// The sub runs 1–9; the tenth iteration rolls to the next whole version and resets.
// Whole-version landmarks (V.1, V.2, V.3, …) are cut as git tags (v1.0.0, v2.0, v3.0).
// Shown in the menu footer, and used as the ?v= cache-bust on the shared build URL.
//
// History: V.1 = the frozen landmark (served at /wkndr/v1/). V.2 = the command-bar / fan line
// (the old 2.0.0-devN counter). V.3 = this line — Coverflow on mobile, the dimmed wide fan on
// desktop, the live content pipeline, and the refined card detail.
export const APP_VERSION = 'V.4.1'
