# WKNDR — backlog & strategic handoff

_Last updated 2026-06-11, after the V.4 arc. This is the live working set + the strategic
threads to carry forward. The original 2026-06-04 V2 plan (mostly shipped) is archived at the
bottom for history._

## Where we are
- **Live build: V.4.6** — https://nessim-higson.github.io/wkndr/
- Versioning: `V.<major>.<sub>`, the sub rolls at `.9` → next whole version (`bun run bump`).
  Whole versions are git milestone tags (`v1.0.0` … `v4.0`).
- Feed: ~100 Amsterdam picks; evergreen library ~84 (classic / bespoke tiers). Monday refresh
  cron + buzz-ranking pipeline. New evergreen are injected into `public/data/picks.amsterdam.json`.

## Shipped in the V.4 arc (was open → now done)
- **Matching** — swipe-to-match over a partner's shared picks. The existing share link
  `?w=ids&from=Name` (produced by ShareSheet from the saved list) IS the match invite — **no
  backend**. Opening one auto-launches the match; the deck is the sender's picks, so every yes is
  real overlap → "It's a match" slam; end-of-round **Plan** → "Add to my list" / "Send <name> the
  plan" (return link). Async + couples-first by design. (V.4.1 prototype → V.4.3 real round-trip.)
- **Weather pills on cards** — Rain or shine / Best when sunny / Best on a wet day / Better when
  dry, derived from `weatherFit` + `outdoor`; flips to **"Perfect today"** (accent glow) when the
  pick peaks in the live forecast. Stack + fan parity (the category line was dropped). (V.4.4–V.4.5)
- **Share nudge** — at ≥3 saves, a dismissible "Plan these together · Match" bar. (V.4.4)
- **Weather-tinted header temp** — the degrees take the live mode's hue. (V.4.4)
- **Ambient field looks** — dumped all but Silk; ported 4 from the background generator:
  **Auras, Riso, Forms** (canvas-2D), **A Gradient** (WebGL). Pluggable renderers (each owns its
  canvas), weather-mode-driven, **Randomize** button for the seeded ones. (V.4.5–V.4.6)
- **Content depth** — Shortlist (eat), Kids, LOST iN, batch-2 (new **Shops** category + museums /
  cinemas). Feed 31 → 100.
- **Swipe-feel** — deferred undo (no mid-flurry pop); match slam arm-delay (can't be tap-dismissed).
- Also done from the old plan: weekend framing, image-led cards, fan auto-play removed, Helvetica
  card copy, multi-category pipeline.

## Open — near-term polish
- **Background looks** — pick a keeper / default (or keep switchable). Expose the prototypes'
  knobs (Riso/Forms had density, grain, time-of-day sliders). Lock favourite seeds. The one soft
  palette seam is **Cool → cloud** (calm grey vs WKNDR's crisp teal Cool) — leave or crisp it
  (verified the rest of the weather→look mapping is sound). **Perf:** Riso/Forms run full-rate
  (no 30fps cap like Silk's FieldEngine) — add a cap if the swipe deck ever hitches on old phones.
- **Matching — symmetric round** — today the partner only reacts to the planner's list (every yes =
  overlap). Next: blend a few of the partner's OWN picks (from the full weather-filtered feed) into
  their deck and round-trip those back so the planner swipes them too. The "Send the plan" return
  link is currently basic.
- **Rich card detail** — Spotify / Apple Music link-out (or inline preview) on music picks: listen
  there & then. (Still open from the V2 plan.)
- **Coverflow on desktop** — one-line branch swap when ready (desktop = WheelFan, mobile = Coverflow).

## Open — content & pipeline
- **Date verification** — pipeline dates are extracted-not-verified; the durable fix (flagged
  repeatedly) is a verify pass to stop stale/wrong dates.
- **Benevisser** — unresolved West restaurant; need the correct name to fold in. ("Hop and Berkel"
  was killed — unresolvable.)

## Strategic tracks (bigger bets — validate before building)
- **Paid app / iOS native / geolocation** — the big direction. Native app + real-time "what's good
  near you *right now*" (geo needs lat/lon on picks). Paid = backend + Stripe. Also unlocks the
  **live-room match** (same-room, real-time swiping) the async link can't do. **High build cost —
  validate first.**
- **The moat** (see `moat.md`) — weather-driven ranking + matching is what a generic "rank these
  restaurants" app can't copy; the share link is the distribution lever. Matching turns the saved
  list two-sided.
- **Validation lens before the paid/native bet:**
  - **JTBD** — the job WKNDR is hired for: *kill the "I dunno, what do you want to do?" loop* for
    the coming weekend. Matching is the wedge.
  - **Mom Test** — talk to real couples/groups about how they *last* decided a weekend; don't pitch,
    ask about the friction and what they tried. Confirm the planning-together pain is real and the
    link round-trip actually gets used before investing in backend/native.
  - Ness's style: ideate by tweaking one variable (ERRC / JTBD lathe); lead with reframes, not
    blue-ocean framings.

## Reference docs
`moat.md` (differentiation + distribution) · `discovery-direction.md` · `content-pipeline.md` ·
`claude-design-brief.md` · `sources.md` · `SETUP.md`.

---

## Archive — original V2 plan (2026-06-04, mostly shipped)

v1.0.0 is frozen at `/wkndr/v1/`. This was the V2 working set; kept for history.

1. **Weekend-weather framing** — show the coming weekend, not today. ✅ done
2. **Richer cards** — image-led, hero the date, scarcity badges. ✅ mostly done (+ weather pills)
3. **Pipeline — broad, trustworthy, multi-category** — go-to sources across all categories for
   Amsterdam + New Orleans; trust via cross-source agreement; powers our own discovery first, then
   share. ✅ largely done; date-verification still open
4. **Fan auto-play felt forced → remove (keep the dynamic throw).** ✅ done
5. **Rich card backside / detail** — listen to the artist there & then (Spotify/Apple link-out);
   structured detail (lineup, price, why-now, map). ◻ link-out still open
6. **Weather-legible background** — explored Hockney / giant-Helvetica / aura-dots directions.
   ✅ shipped as the 4 ported looks (Auras / Riso / Forms / A Gradient)
7. **Helvetica Neue for card copy; WKNDR wordmark stays Clash Display.** ✅ done
