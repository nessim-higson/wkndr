# 003 — The opening beat

**Branch** `codex/opening-beat` · **Seam** intro + first deal (`Intro.tsx`, `SwipeStack.tsx`,
`App.tsx` `shown`; ranking lens in `weather/modes.ts`)

**The question** — What are the first three cards *for* on a Saturday morning — and does the intro
earn its two seconds every single load?

**The itch** — The intro ("Your weekend, one swipe away") plays on every load, tap to skip. Then
the deck opens: hand pile → 👑 → ▲ → the ranked middle (`orderServed`), de-clustered, blanks held
back, weather dominant (+10 tier), per-day weather when the weekend splits. It is a good *ranking*.
It is not yet an *opening*: a returning user at 09:30 on Saturday wants *today*, and the three
cards should make a plan by themselves. Partner feedback (2026-07-11): "pulls felt generic on a
sunny weekend"; V.11.7 answered on the card ("Perfect for a rainy day"). The first beat hasn't.

**Read first** — `Intro.tsx`, `SwipeStack.tsx` (deal-in, `dealKey`, the nudge), `App.tsx` `shown`
(live-vs-canon rotation, RESERVE, diversify, `orderServed`, `holdBackImageless`), `modes.ts`
`rankPicks` (per-day `{sat, sun}`, `SUN_BONUS`, the tiers), `Calibrate.tsx` (the taste
calibration micro-deck — built, `?dev=1` only), `types.ts` `cardSignal` (the ONE pill),
`CHANGELOG.md` V.11.2/V.11.7, `docs/takeovers.md` §"stickiness".

**What changes** — any of: a returning-user intro (first load vs. the fourth Saturday; the intro
carrying the weather line so it says something); a *runtime-only* "today" lens on the opening —
opened on Saturday, Saturday's picks lead; on Sunday afternoon, what's still on; a first-deal
choreography that presents three cards as a set ("your Saturday, if you did nothing else");
promoting the calibration round out of dev into the first run. Runtime lenses only — the board
mirrors the pipeline's `servePos`, so the *published* order stays what it is; the hand pile, 👑 and
▲ always open the deck.

**Do not touch** — the pipeline, `servePos`, the taste corpus, the filter strip's semantics.

**How to judge** — phone, three sessions: Sat 09:30 sunny, Sat 09:30 COLD_WET, Sun 15:00. Dev
pills for weather; the date via the system clock (or a `?now=` dev param you add). **The one
thing:** cover everything but the first three cards — is that a plan?

**Deliverable** — the beat + a recording of each of the three sessions; the brief filled in.
