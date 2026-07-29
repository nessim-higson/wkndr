# WKNDR — takeovers, precision, and stickiness

_Night memo, 2026-07-28. Ness raised four threads at once: curator takeovers, a better board,
weather precision, and why people don't come back. They're one argument. Advances
`curation-surfaces.md` §5 from **parked** to **planned** — that section wrote the framing
("Sanne's Amsterdam"); this writes the build. Companions: `moat.md`, `backlog.md`, `../STATE.md`._

---

## 0. The reframe

The scarce resource in WKNDR was never events. Crawls produce 1,500 a week. The scarce resource is
**a point of view**, and there has only ever been one — Ness's, at roughly a day a week.

So the instinct to hand curation to other people is right, but the reason to do it isn't labor.
It's that **the byline is the product**. Guest curation doesn't outsource the chore; it multiplies
the only thing WKNDR has that an aggregator can't copy. Ten curators is ten viewpoints, and — this
is the part that matters more than the time saved — **ten audiences**.

The corollary costs something: if the byline is the product, the airlock has to be rebuilt around
*whose* taste rather than *the* taste. That's the real work in this memo.

---

## 1. Takeovers

### What it is

A named person curates one city for one week. Their name is on it. The week expires.

This is guest-editing, not UGC. The distinction is not cosmetic — it's the whole quality model.
UGC dilutes (average of everyone → no taste → events feed → death, per §5). Guest-editing accretes:
every week adds a named human with reputation on the line, and the archive becomes a roster rather
than a pile.

Comps worth reading before committing: **Perfectly Imperfect** (guest recommendation lists, the
closest analogue), Pitchfork guest reviewers, and **@sweden / Curators of Sweden** — that last one
is the cautionary tale. A rotating national account went brilliantly until a curator torched it.
Rotation without governance is a loaded gun; see §1.4.

### 1.1 The distribution argument (the real one)

Each curator brings 50–500 people who care about *them*. That is not a marketing channel bolted on;
it's the growth model. Twelve curators a quarter in one city is the distribution problem solved
without spending anything — and it solves it in the only way that works for a taste product, which
is *transitively through someone you trust*.

It also fixes the return problem directly. Nobody has a reason to open WKNDR on a schedule today.
"It's Sanne's week" is a reason, and it's a reason *her friends* feel most.

### 1.2 The airlock question — decide this first

`curation-surfaces.md` states the law: **the live deck is 1:1 with Ness's board approvals.** A guest
curator with board rights breaks it. So don't give them board rights. Split the write scopes:

| Scope | What it does | Blast radius | Who |
|---|---|---|---|
| **Order** | pile position, promote/demote | this week, this city, expires | **guest curator** |
| **Add** | manual entry / URL paste | this week's deck, provenance-stamped | **guest curator** |
| **Judge** | veto · canon · 👑 TOP · rested | permanent, writes `corpus.json` | **Ness only, forever** |

Order and Add are *editorial*. Judge is *the taste engine*, and the taste engine is Ness's
accumulated identity — five compiled rounds of judgment that took two months. It does not get
delegated, ever.

**The shape that follows:** a guest curator gets **their own deck**, not write access to the
canonical one. `wkndr.xyz/ams/sanne` — same engine, same cards, her order, her five additions, her
byline, her week. The house deck stays 1:1 with Ness. The corpus learns from her round as *signal*
(what a good curator surfaced), never as *verdict*.

§5 listed the blockers as identity, lens storage, and discovery. **Two of the three got cheaper
since it was written.** `wkndr-curate` (the fast-lane worker, KV-backed, live since V.10.16) already
*is* lens storage — a lens is a keyed round of pile order + kills + extras, which is precisely the
payload Submit already POSTs. And identity doesn't need accounts: a per-curator signed URL
(`/curate/?k=<token>`) issued by hand is correct at n=10 and costs an afternoon. Do not build auth.

### 1.3 The constraint that decides whether this works

**Curators must curate from a floor, never from blank.**

- From blank: 3 hours, no quality bottom, and the first flake kills the week.
- From a pre-ranked deck of 60 machine-gathered picks: *re-rank the top 10, kill what's wrong, add
  five things we'd never find.* Twenty minutes, and the worst case is still a decent WKNDR week.

This single decision is the difference between a model that survives a bad curator and one that
doesn't. The pipeline already produces the floor. The board already does the re-ranking. The gap is
only "add five things" — which is §2.

### 1.4 The risks, named

- **Quality variance.** Mitigated by the floor (§1.3), not by review — review is just the labor
  coming back through the side door.
- **Reputational.** A curator can put something ugly on a page with Ness's name in the URL. Answer:
  a short curator agreement, the week expires automatically, and Ness holds a kill switch on the
  lens. Governance is one paragraph and a button, but it has to exist *before* curator #1.
- **Diplomacy.** §4 already flags that kill lists on named venues are sensitive. Guest kills are
  worse — a stranger retiring a real business under WKNDR's banner. Guest ✕ must mean "not my week,"
  never "vetoed." Route it as `pile: last`, not `veto`. This is a one-line routing decision with a
  large downside if missed.
- **The archive turns thin.** Twelve weeks of guest lenses is either a roster or a graveyard.
  Decide up front that expired lenses stay live and readable at their URL — that's the roster, and
  it's the thing you show curator #13 to get them to say yes.

---

## 2. The board becomes an instrument

Takeovers are blocked on exactly one missing feature, and it happens to be the highest-leverage
thing on the whole board: **a curator's best picks are never in the crawl.** The warehouse party,
the pop-up, the thing that only exists in a Telegram channel. Without manual entry a takeover is
just someone reordering our list, which is not worth their name.

**Two doors, one destination.**

- **Paste a URL** → a worker fetches the page, reads JSON-LD / OpenGraph, runs the existing image
  screen, and returns a filled card to confirm or edit. This is `adapters/iamsterdam.ts` logic behind
  an endpoint — the extraction code already exists and is good. Expect ~80% clean auto-fill on any
  real venue page. Instagram is the known hard case (no JSON-LD, hostile to fetch); fall through to
  hand entry rather than fighting it.
- **Type it by hand** → title · when · where · why · image. Thirty seconds.

Both land in a `submitted` lane in `wkndr-curate`, stamped `by:<curator>`, promoted into that
curator's deck at their own rank. Never into `corpus.json` without Ness compiling it.

### The one field that matters

**"Why" is mandatory, one line, first person.**

That's the entire difference between WKNDR and an events feed, and it's the thing a crawl
structurally cannot produce. "Go early, the courtyard fills by seven." A machine will never write
that. It is also, not incidentally, what makes curating feel like *writing* — credit-bearing, fun,
postable — instead of data entry. Make the field prominent and the takeover sells itself.

**Other board work, in order:** the ✕ reason→action routing table (already flagged in STATE.md as
next, and now load-bearing for §1.4's guest-kill routing) → light polling so open sessions update →
per-curator scoping of the whole surface.

---

## 3. Weather precision — this is a real bug, and I found it

Last weekend's failure (glorious Saturday, washed-out Sunday, an all-outdoor deck) is not a tuning
problem. It's an architectural one, and it's four lines.

`app/src/App.tsx:725-728`:

```ts
const hi = Math.round(Math.max(...his))   // MAX high across the weekend
const lo = Math.round(Math.min(...los))   // MIN low across the weekend
const pp = Math.max(...pps)               // MAX precip across the weekend
const m  = classify(hi, pp, hi - lo)      // ONE mode for the whole weekend
```

The weekend is collapsed into a single synthetic day built from **Saturday's best temperature and
Sunday's worst rain**. That composite day doesn't exist. Worse, it's optimistic where it should be
cautious: with Saturday at 26° and Sunday at 60% rain, `classify` (`weather/modes.ts:69`) returns
`HOT` — `high >= 24` fires before anything reads the rain, the SUN_BONUS (`modes.ts:143`) lifts every
outdoor pick, and Sunday's washout is invisible to the deck. Exactly what happened.

Two compounding weaknesses behind it:

1. **`precipitation_probability_max` is a daily maximum.** A 70% spike at 4am scores identically to
   steady afternoon rain. It's the wrong variable for "can I go outside."
2. **A pick has no day.** `datedThisWeekend` and `sunBonus` treat the weekend as one unit, so even a
   correct mode couldn't route a pick to the right day.

### The fix — and it's a product upgrade, not a patch

**Make the slot the atomic unit, not the weekend.** Four of them: Sat day · Sat night · Sun day ·
Sun night. Each gets its own mode, classified from **hourly** data over the hours people actually go
out (say 10:00–18:00 and 19:00–01:00) using `precipitation_probability` + `precipitation` +
`cloudcover` + `windspeed`, not a daily max.

Open-Meteo already serves hourly on the same keyless endpoint. This is deterministic code over
better data — a day's work, no new dependency, and it cascades:

- **Ranking gets honest.** Outdoor picks compete for sunny slots; the wet slot pulls indoor. The
  Sunday wash gets a museum instead of a park.
- **The deck becomes a plan.** "Saturday looks like this. Sunday, do this instead." That's a
  materially better product than a ranked list, and it's the JTBD wedge stated more sharply — the
  weekend is two decisions, and WKNDR has been answering as if it were one.
- **The ambient field gets its finesse.** Ness asked for this separately. Today one mode paints the
  whole session. With four slots the field has somewhere to *go* — scrubbing across slots moves it,
  and the Sat→Sun transition is legible in the visuals. The engine already supports it; it's been
  starved of input, not capability.
- **The copy gets sharper.** "26° this weekend" becomes "26° Saturday, 14° and wet Sunday" — a
  claim only WKNDR makes, and the honest version of the promise already on the landing page.

**Do not put a model on this.** It's arithmetic over a forecast. The codebase already carries a lot
of LLM surface and this is the kind of place it would quietly rot.

**Sequencing note:** this ships *before* takeovers. Handing a guest curator a broken instrument
exports the bug to someone whose reputation is on the line — and "all your picks were outdoors on a
rainy Sunday" is precisely the failure that makes a curator not come back.

---

## 4. Stickiness — the honest diagnosis

People aren't lazy. **WKNDR has no summons.** No fixed time, no push, no email, no personal reason
to open it. Every one of those is fixable without new technology. Ranked by leverage ÷ cost:

1. **The Friday drop.** One fixed time, every week. "Thursday 18:00, the weekend lands." This is the
   single biggest missing thing and it's nearly free — appointment beats every retention mechanic
   ever invented. **Correction (found 2026-07-29): this is already half-built and uncommitted.**
   `list/` is a complete Cloudflare Worker + KV subscriber store (double opt-in, Resend, admin-gated
   `/export` + `/stats`), and `landing/index.html` carries the opt-in form. **Neither is deployed** —
   `list/wrangler.toml` still reads `id = "REPLACE_WITH_KV_ID"` and the worker origin doesn't
   resolve. Finish that before building anything new here; see §6 Phase 1.
   **Second prerequisite:** verify the Cloudflare auto-deploy actually fires. The step is
   wired in `deploy.yml:64`, but confirm `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are set —
   the repo has form here (`SERPER_API_KEY` and `HEALTHCHECK_URL` are both wired and dormant). You
   cannot promise a Thursday drop while the real domain serves stale content until someone
   remembers to deploy by hand.
2. **The curator's own audience.** §1.1. Social obligation is the strongest retention force
   available and takeovers generate it as a byproduct.
3. **A reason to start a match.** The relay works (V.9.7) and nobody initiates. The machinery isn't
   missing; the prompt is. Put "Ask someone" on the drop itself, not four saves deep.
4. **The Sunday-night receipt.** "Did you go?" — one tap. Creates a second weekly visit, feeds the
   taste engine real behavioral signal, and closes `backlog.md`'s open validation question (does a
   plan happen IRL). Three birds, one screen.
5. **Streaks / passport.** Listed for completeness. It cuts against how you build — direct control,
   honest instruments, no cheap loops — and it would read as borrowed. Low priority; probably never.

The pattern: **1, 3 and 4 are all the same insight.** WKNDR is a weekly ritual with no clock. Give it
a clock.

---

## 5. Which models to task

Grounded in what the pipeline already runs (Haiku for the 10 websearch facets, Sonnet as the
editorial judge via `ANTHROPIC_JUDGE_MODEL`).

| Job | Model | Why |
|---|---|---|
| **URL → card extraction** (§2) | **Haiku 4.5** | High volume, structured extraction from HTML, latency-sensitive (curator is waiting). Escalate to Sonnet only when there's no JSON-LD and the page is a mess. |
| **Editorial judge** | **Sonnet 5** — unchanged | Working. Don't touch it while changing everything around it. |
| **"Why" line assist** | **Haiku 4.5**, suggestion-only | Curator types three words, gets a line they must edit or accept. **Never auto-publishes** — an auto-written "why" destroys the exact thing §2 says is the product. |
| **Slot weather** (§3) | **none** | Deterministic. Putting a model here would be the mistake. |
| **Vision / image screen** | unchanged | Hard-won. Leave it. |
| **Architecture, compiles, this kind of memo** | **Opus 5** | Judgment work. |

The general rule for this codebase: **it already has enough LLM surface.** New model calls need to
earn their place against deterministic code, and §3 is the live example of a job that looks like an
AI problem and isn't.

---

## 6. Sequence

Three phases, two gates. The gates matter more than the phases.

**Phase 1 — fix the instrument (~1 week).** Nothing here depends on a decision.
1. Confirm the Thursday CF auto-deploy actually fires. (Blocks everything in §4.)
2. **Land the Friday brief that's already written** (§4, item 1) — create the KV namespace, set
   `MAIL_API_KEY` + `ADMIN_KEY`, add the SPF/DKIM records for `friday@wkndr.xyz`, deploy, then
   commit `list/` and the landing form together. **Do not ship the landing form before the worker
   is live** — `LIST_URL` is hardcoded to an origin that doesn't resolve, so today the form would
   render and every signup would fail. Set `LIST_URL=''` to hide the block if the landing ships first.
3. Slot-based weather: hourly fetch → four slots → per-slot ranking → deck reads as two days (§3).
4. The ✕ reason→action routing table — already next in STATE.md, and load-bearing for §1.4.

**Phase 2 — arm the board (~1 week).** Useful to Ness alone even if takeovers never happen; that's
the test of whether it's the right next thing.
5. Manual event entry (§2).
6. URL paste → auto-filled card (§2).
7. Mandatory "why" field, wired through to the card face.

> **Gate A — before writing a line of takeover code:** run one takeover *by hand*. Pick one person,
> give them the existing board with a shared link, sit with them for twenty minutes, and watch. If a
> good curator won't spend twenty minutes, no amount of tooling changes that, and you'll have learned
> it for the cost of a coffee instead of a month.

**Phase 3 — the lens (~2 weeks, only past Gate A).**
8. Per-curator lens: signed URL, scoped board, `wkndr-curate` keyed by curator + week.
9. The public lens page with byline and expiry — `/ams/sanne`.
10. Newsletter generated from the same submit: **one round produces both the email and the deck.**
   This is what makes the curator's job feel like writing rather than admin, and it gives them the
   thing to post. It's also why the newsletter is not a marketing channel — it's the *deliverable*,
   and the app is its interactive form.

> **Gate B — before city #2:** one curator has to complete a second week voluntarily. A first week is
> flattery. A second week is a product. `backlog.md` already gates city #2 on Amsterdam feeling
> locked; this is the sharper version of the same test.

---

## 7. To decide in the morning

1. **Own deck or shared deck?** (§1.2) Everything downstream forks here. My read: own deck — it's
   the only version that doesn't break the airlock, and it's also the better product.
2. **Does guest ✕ ever mean veto?** (§1.4) My read: never. Route to `pile: last`.
3. **Slot weather before takeovers, or in parallel?** My read: before. Don't hand out a broken
   instrument.
4. **Does phase 2 stand alone?** If manual entry wouldn't be worth building for yourself, that's
   evidence the takeover thesis is carrying more weight than it has earned yet.
5. **Does the Friday brief ship before or alongside takeovers?** (§4, item 1) It's written and unshipped.
   My read: before — it's the clock, and a curator needs somewhere for their week to land.

The thing worth sitting with: **quality variance is the entire risk**, and §1.3 is the entire
mitigation. Curating from a floor is a twenty-minute job with a quality bottom. Curating from blank
is a three-hour job with none. If you get that one decision right, a bad curator costs you a
mediocre week. If you get it wrong, a bad curator costs you the byline — which by then is the product.
