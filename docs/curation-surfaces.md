# WKNDR — Curation surfaces: who holds the pen

_Decided 2026-07-16. Why the Curation Board, Tune, and the taste engine are three different things
that look like one thing — and what may/may not be merged. Companion to `moat.md` (defensibility),
`pipeline-architecture.md` (how content flows), and `../STATE.md` (current build). **The Airlock law
in STATE.md is upstream of this doc; nothing here weakens it.**_

---

## 1. The three surfaces

Everything below involves swiping a card to express taste. That resemblance is the trap — the blast
radius is completely different in each case.

| Surface | Writes to | Scope | Who can | Where |
|---|---|---|---|---|
| **Curation Board** | verdict payload → GitHub issue → compile → the airlock | **global** — what exists in the deck at all | **Ness only** | `app.wkndr.xyz/curate/` |
| **Tune WKNDR** (V.10.3) | `taste.ts` → `applyCalibration` → on-device profile | **local** — how *your* deck sorts | everyone | app, `?dev=1` → Taste · dev |
| **Deck swipes** (live app) | `taste.ts` → `applySwipe` | **local** — same profile, passively | everyone | the app itself |

**The board decides what's in the universe. Tune decides how the universe is sorted for you.**

## 2. The law: share the component, never the sink

`applyCalibration()` and a board verdict are the same *gesture* with different consequences. One
re-ranks your phone. The other re-ranks everyone's.

STATE.md, 2026-07-10: _"THE AIRLOCK — the live deck is 1:1 with his board approvals."_ That is the
product. The landing page's promise is literally **"Not another events feed"** — the value is that a
specific human with a specific viewpoint picked these. The moment power users can write into the
airlock, WKNDR is an events feed with voting, and the promise is void. Consensus is the opposite of
taste.

So:

- ✅ **Share the deck component.** One `<SwipeDeck>` (SwipeStack + physics + tests), many consumers.
  `Calibrate.tsx` already proves the pattern.
- ❌ **Never share the sink.** `taste.ts` is per-device and per-person. The verdict payload is Ness's
  alone. No UI, flag, or role grants a user write access to the airlock.

If a future feature seems to need crowd input into the deck, it is a different product. Re-read §5
before building it.

## 3. Mobile: the board doesn't need a rebuild, it needs a second mode

Measured 2026-07-16 at 375×812 against the live board (V.9.14):

- It reflows correctly — viewport meta ✅, `.wrap{max-width:1180px}` (not fixed) ✅,
  `grid-template-columns:repeat(auto-fill,minmax(230px,1fr))` ✅, zero media queries and mostly fine
  without them.
- **But: 203 screens of scroll.** 620 card elements, 329 items (221 IN ROTATION + 108 NEW FINDS),
  behind ~500 words of preamble.

That is not a CSS bug. A grid exists to **compare** (see twenty, weigh, batch-decide). A deck exists
to **decide** (one, verdict, next). Two jobs:

| | Job | Form | Device |
|---|---|---|---|
| **The studio** | pile order, ▲LEAD/▼LATER, tiers, compile, canon library | the grid — keep as-is | desk |
| **The notebook** | triage the airlock queue (~108 unapproved) — ★ / ✕ / 👑 | **deck mode** | phone, on the fly |

Same verdicts, same payload, same Submit → GitHub. Different moment. **Do not port the studio to
mobile** — reordering a weekend pile on a phone is a fantasy, and the grid is correct for what it does.

Build: wire the existing SwipeStack to the airlock queue (`pending.<city>.json`), emit the same
verdict shape the board already emits. Reuse, don't rebuild.

## 4. Exposure: the tool is not the moat — but the verdicts are sensitive

Consistent with `moat.md` (_"the taste loop is **a** moat, not **the** moat"_; the operational
pipeline is the underrated one):

- **The tool is not a moat.** 38KB of card swiper. Anyone could build it in a day.
- **The method is not much of a moat.** LENS / tiers / airlock is a *recipe*. Recipes aren't moats;
  execution is. A competitor can learn "weather-fit × buzz, human-gated" and still need years of
  accumulated judgment for it to mean anything.
- **The verdicts are the asset.** Not because they're secret — because they're *accumulated*.

So exposing the board leaks the recipe, not the meal. Arguably the recipe is a **trust asset**: the
pitch is "not an algorithm, a person with taste," and showing the machinery is *evidence* for that
claim. "Here's how this weekend got ranked" is good marketing.

**The real reason to keep part of it private is diplomacy, not strategy.** The board carries kill
lists and vetoes on named real venues (e.g. the Île de Bisous veto, V.9.8). A venue owner finding
themselves retired is a conversation we didn't choose to have.

**The cut: method public, verdicts private.** A read-only "how this weekend got ranked" view is a
great public artifact. The kill list is not. Until that view exists, `/curate/` being discoverable is
**accepted risk, not an incident** — no write path, and `picks.json` is already public.

## 5. Parked: guest curators (a real option, not this week)

The variable worth tweaking (per the ERRC/JTBD lathe) is **who the curator is for** — not whether
there's a curator.

- Today: Ness curates for everyone → one taste, one deck. Coherent, doesn't scale.
- Naive: everyone curates for themselves → no taste, just filters → **events feed → death**.
- **The interesting middle: someone curates for *their people*.** "Sanne's Amsterdam" — a shared
  lens, published to friends.

That's Pitchfork inviting a guest reviewer, not opening a comment section. It preserves "a human with
taste picked this" while multiplying humans, and it rides the share/relay/rounds machinery that
already exists (V.9.4/V.9.7). Each guest lens is its own airlock, owned by its curator; the WKNDR
deck stays 1:1 with Ness.

Requires: identity (currently zero accounts — a real cost), lens storage, and a discovery story.
**Do not start this before the deck-mode work lands.**

## 6. Wiring (the order, and why)

1. **Deploy automation — first, highest value.** `refresh.yml` (Thu 13:00 UTC) commits fresh
   `picks.json` and auto-deploys to **GitHub Pages only**. `wkndr.xyz` + `app.wkndr.xyz` are CF Pages
   projects with `Git Provider: No` — manual `wrangler pages deploy`. **So every Thursday the real
   domain serves stale content until Ness remembers.** Fix: CF deploy step in `deploy.yml` +
   `CLOUDFLARE_API_TOKEN` repo secret (Pages:Edit).
2. **Deck mode for triage** — §3. Gated `?dev=1` like Tune.
3. **Gate: deliberately not now** — §4. If the read-only view ships, gating then ungating is wasted
   work. Revisit only if the kill list becomes a liability.
4. **Guest curators** — §5, parked.

**Git stays the database.** The pipeline committing `picks.json` to the repo is the best decision in
the system, not a workaround: every content run is diffable, revertable, and a red test suite means
last-good keeps serving. Do **not** port that to Workers Cron + KV — it would trade an auditable
editorial history for nothing. Cloudflare is the shop window; GitHub is the factory.
