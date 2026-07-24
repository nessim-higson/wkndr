# Curation Board — roadmap (scoped 2026-07-23)

Where the board is headed after V.9.19. Two linked tracks. Ness's asks, verbatim:
1. "How do I know a cancel (bad image / wrong link) is getting ingested?" → **shipped V.9.19** (status panel).
2. "Scope auto-compile" so my calls apply without a human compile step.
3. "From Advanced / New Finds, when I find something cool, add it to the top 10 OR the cards
   following it, then re-order. Right now I can crown something but it just sits there."
4. "Better communication and ordering so I know I can upvote / devote, and educate the system on
   why something is off."

---

## Track A — Auto-compile (kill the "Submit → Claude compiles" loop)

**Today:** board Submit → files a GitHub issue → *Claude* hand-compiles `corpus.json`/`weekly.json` →
`restamp` → deploy. Latency: minutes + a human. No confirmation until reload (the V.9.19 panel is a
patch over this gap, not a fix).

**Target:** a card action (kill, pile order) is reflected in the live app in seconds, no human.

**Approach — relay overrides (recommended).** WKNDR already runs a Cloudflare Worker + KV (the relay,
`wkndr-relay.nessimhigson.workers.dev`). Extend it with a curation-overrides doc:

- **Worker:** `POST /curate/<city>` stores `{killedTitles[], pileOrder[], topTitles[], flags[]}` in KV,
  keyed by the feed's `generatedAt` (so a stale override auto-expires when the feed rolls). `GET /curate/<city>` returns it.
- **Board:** on Submit, POST the overrides (alongside — or instead of — the GitHub issue). Button →
  "✓ Live." The status panel reads the same doc → flips to ✓ instantly, no reload.
- **App:** after loading `picks.<city>.json`, fetch the overrides and apply the SAME taste layer restamp
  already does — drop killed, apply pile order, stamp tops. Fail-soft: no overrides → today's behavior.
- **Fold-in:** the durable corpus compile stays a periodic assisted pass (below) that bakes overrides
  into `corpus.json`; the KV doc is the fast lane, the corpus is the source of truth.

**Why not full CI auto-compile from the issue?** Compile involves judgment the parser can't safely make
(the R9 Scheepvaartmuseum case: a "kill" that was really a *link* problem on a *crowned* card). Keep the
nuanced corpus edits assisted; auto-apply only the safe, reversible actions (kill = drop, pile = reorder).

**Effort:** medium — Worker endpoint + app apply-layer + board POST. Reuses restamp's matchers.

---

## Track B — One card vocabulary: add-to-order · upvote/devote · educate-why

**The gap Ness named:** crowning a New Find "just sits there" — no way to place it in the opening 10 or
the tail, no ordering, no feedback. And no structured way to say *why* something is off.

**Target — the same verbs on every card (Simple pool, Advanced feed, New Finds):**

- **↑ Add to opening** — drops it into the top-10 (or the tail if 10 is full, at a chosen slot), then
  drag to reorder. From a New Find this also *promotes* it (so it enters the feed) — bridging the
  Advanced→Simple gap that exists today (crown promotes but never places).
- **↓ Push down / not this week** — sinks it (the current LATER), with feedback.
- **★ rate** — unchanged.
- **✕ Cancel + why** — kill opens a **reason picker** (chips): *wrong link · bad image · low-res ·
  off-brand · duplicate · seen it too much*. The reason is not just communication —

  **the reason routes the compile action.** This is the fix for the R9 mistake:
  - *wrong link* → fix the deep link, keep the pick (don't veto)
  - *bad image / low-res* → image swap (curated.ts / better-image URL)
  - *seen it too much* → `rested` (fatigue, returns later)
  - *off-brand / bad* → `eventVeto` (permanent kill)
  - *duplicate* → dedup, not taste

- **Feedback everywhere:** each card shows its resulting state — "in your top 10 · #3" / "pushed to the
  tail" / "cancelled — wrong link (pending)". The V.9.19 status panel already tracks landing; this makes
  the *pre-submit* state legible too.

**Effort:** medium-large — unify the add action across views, the reason picker, and the reason→action
routing table in the compiler.

---

## Suggested sequence
1. **Track B reason-picker first** (small, high-leverage): structured "why" on cancel + the routing
   table. Immediately improves compile correctness (prevents R9-class errors) and communication.
2. **Track A relay overrides** (kills + pile order go live instantly, no human).
3. **Track B unified add-to-opening** across Advanced/New Finds (place + reorder from anywhere).

Each is independently shippable; do them in any order the moment appetite allows.
