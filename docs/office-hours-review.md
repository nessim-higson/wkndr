# WKNDR — YC office-hours review

_2026-06-11. Startup mode, run against the full doc set (backlog, moat,
discovery-direction, jtbd-analysis, mom-test-interviews) as a fully-formed plan —
diagnostic + premise challenge + alternatives + assignment. Stage: pre-revenue,
users = founder + partner._

## The six forcing questions, answered with the evidence that exists

**Q1 — Demand reality.** Strongest evidence someone wants this: the founder uses it.
That's it — and it's the correct amount for this stage, *but it isn't being recorded*.
Nothing in the repo says "weekend N: we did X because the app surfaced it." THE KILL
QUESTION: **have you and your partner actually run a weekend through it — not swiped
it, lived it?** If the founder's own household doesn't run on it for 8 weekends,
no interview result matters. Waitlists, compliments, this review — none of it is demand.

**Q2 — Status quo.** WhatsApp thread + Instagram saves + the same five places. The
uncomfortable truth: the workaround costs ~90 seconds, not hours. The real cost is
weekend *quality* (sameness, regret) — which is harder to measure and much easier to
fool yourself about. WKNDR is not saving time; it's claiming better weekends. That
claim needs the "we did this" evidence, nothing else proves it.

**Q3 — Desperate specificity.** The named human is the founder. Good (build-for-self
is the plan), but the next named human doesn't exist yet. Who is the most
over-planned couple you know — actual names? The mom-test kit asks for this intro;
it's the right move, do it first.

**Q4 — Narrowest wedge.** The share link is a genuinely good wedge: no login, no
install, recipient gets value in one tap, and it now survives feed refreshes (V.4.9).
Nobody would pay for anything this week — which settles the Stripe question without
a meeting. The wedge's sharpest form: **the link IS the product**; the app is where
links come from.

**Q5 — Observation & surprise.** Self-dogfooding is real (this week's QA round found
the match-freeze — that only happens when you actually use it). But: has anyone
watched a person open a share link *cold*, unaided, not knowing what WKNDR is? No.
That observation is worth more than the next five features.

**Q6 — Future-fit.** In 3 years any LLM assistant answers "what's good in Amsterdam
this weekend for a couple with a 4yo, given the weather" — weather-ranking and
curation get commoditized. What an assistant can't replicate: **the two-sided
agreement loop and the data it produces** (what couples matched on). Future-fit
points hard at matching and away from solo discovery. The moat doc already half
knows this; act like it.

## Where the founder is fooling himself (named plainly)

1. **Polish as progress.** V.4.5–4.7 shipped ambient-field shaders, knob panels,
   seed persistence. Gorgeous, zero validation value. The craft is the brand and the
   joy — fine — but the last three versions moved the *product*, not the *question*.
   The question only moves when a stranger round-trips a link.
2. **The platform shape is already creeping in.** Paid / native / geolocation /
   live-room match is a platform vision. JTBD already showed geo serves a different
   job (J2) than anything validated (J1). The backlog says "validate first" — believe
   your own backlog.
3. **Unmeasured self-use.** "Build for self first" only works if the self-use is
   honestly logged. 8 weekends, one line each: did the app pick anything we did?

## Premises (challenged, then adopted)

1. The job being validated is J1 — plan the weekend *together, ahead*. The share-link
   match is the wedge. ✓
2. No paid/native/geo work until the mom-test thresholds hit (≥7/10 unprompted pain,
   ≥3 round-trips, ≥1 lived plan). ✓
3. The one metric that matters this month: **completed round-trips from people who
   are not the founder.** ✓
4. Date-trust is an adoption gate (anxiety force), not pipeline hygiene — one wrong
   date in front of a recipient kills the link's credibility. ✓

## Alternatives for the next two weeks

**A — Validation sprint (minimal viable, recommended).**
Three mom-test conversations + three real share links sent + watch one cold open.
Zero feature work except round-trip blockers. Effort S · Risk low · Reuses everything
shipped this week (short links, freeze fix, simplified cards).

**B — Instrument, then validate (ideal architecture).**
Add the lightest job-done signal first (even a hand-logged docs/validation-log.md +
asking recipients counts; a privacy-light beacon on link-open/round-trip if desired),
then run A with real funnel numbers. Effort M · Risk: instrumentation becomes
another week of building.

**C — The link is the product (creative/lateral).**
Invert the framing: the recipient experience IS the front door. "Plan your weekend
in one link." The app is just where links are made. Changes positioning, landing
page, and what gets polished next. Effort M · Risk: bigger story, same unvalidated
pain underneath.

**Recommendation: A, with B's manual logging (no new code).** C is the likely
*conclusion* of validation, not a substitute for it.

## The assignment (by Sunday)

1. Send the real share link to **three people outside the household** — the
   over-planned couple first.
2. **Watch one of them open it cold.** Say nothing. Write down the first 60 seconds.
3. Log all three outcomes (opened? finished? plan returned? plan lived?) in
   `docs/validation-log.md`.
4. This weekend, run your own household on it and log one line.

No new features before that — except anything that literally blocks a round-trip.

## Founder signals (for the record)

Real problem from own life ✓ · agency (ships relentlessly) ✓ · taste ✓ · domain
expertise (Amsterdam scene, the content pipeline proves it) ✓ · named external
users ✗ (the gap this assignment closes) · demand evidence ✗ (same).
