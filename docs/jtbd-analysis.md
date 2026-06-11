# WKNDR — Jobs-to-be-Done analysis

_2026-06-11. Christensen JTBD applied ahead of the Mom Test interviews
(docs/mom-test-interviews.md). Feeds the go/no-go on the paid/native/geolocation bet._

## The job statement

> **When the weekend is coming and neither of us has a plan, I want us to land on
> something we're both genuinely up for — without the back-and-forth — so the weekend
> feels intentional instead of defaulted.**

No product in the sentence; the job predates and will outlive any app.

**Three dimensions (all must be served):**
- **Functional** — converge on a plan that fits the weather, the budget, the energy
  level, and (for parents) the nap window, with minimal searching and negotiating.
- **Emotional** — relief from decision fatigue; anticipation (having something to look
  forward to by Thursday); not feeling the Sunday-evening "we wasted it again".
- **Social** — be the partner/parent/friend *with the good ideas*; "we found this place"
  as taste-signalling. The shareable link is native to this dimension — it's a gift, not
  a notification.

## ⚠ Finding 1: the bet targets a different job than the app serves

There are at least **four distinct jobs** hiding in "weekend discovery", separated by
circumstance (and JTBD says circumstance IS the job):

| # | Circumstance | Job | Served today? |
|---|--------------|-----|----------------|
| J1 | Thu–Fri, no plan yet | plan the weekend together, ahead | **yes — this is WKNDR** |
| J2 | Sat 11am, already out / bored NOW | "what's good near me right now" | no — this is the **geolocation bet** |
| J3 | kid is climbing the walls | occupy the 4yo somewhere that doesn't bore us | partially (Kids lens) |
| J4 | friends visiting | show our city well | no (a share-link could) |

The paid/native/geolocation track is a **J2 product**, but all validation so far (and the
matching wedge) is **J1**. Confirming J1 does NOT validate the J2 bet — they have
different competitors, different moments, different anxieties. The interviews must
establish *which circumstance actually recurs* in real households before the bet unparks.

## Forces of progress (switching from WhatsApp + IG-saves + same-five-places)

**Push** (frustration with today)
- "We always end up at the same three places" — sameness fatigue.
- The ping-pong: "what do you want to do?" "I dunno, you?" — negotiation cost.
- Sunday-evening regret after a defaulted weekend.
- Instagram-saves graveyard: saved 40 things, been to none.

**Pull** (attraction of the new)
- A weather-fitted shortlist that's already filtered ("perfect today").
- The match moment — agreement as a game instead of a negotiation.
- Feeling like people who know their city.

**Anxiety** (fear of the new)
- "Is this list actually current?" — one stale date and trust is gone
  (→ the backlog's date-verification item is an ANXIETY fix, rank it accordingly).
- "If I send my partner this link, will they think it's homework?" — the round-trip
  has social risk for the sender.
- Cold-start taste: "it doesn't know us yet."

**Habit** (comfort with the current way)
- The WhatsApp thread costs zero new behavior.
- The same-five-places are beloved *because* they need no negotiation.
- "We'll figure it out Saturday" is itself a comfortable ritual for some couples —
  **for them the loop is not a pain, it's intimacy** (the Mom Test scary question).

**⚠ Finding 2: the battle is Habit, not Pull.** The current solution is free,
instant, and already open. More features (more Pull) won't move `Push + Pull >
Habit + Anxiety`; reducing the right side will. WKNDR's existing instincts are
correct — no account, no install, the link drops INTO the WhatsApp thread rather than
replacing it. The wedge must intercept the existing ritual, not propose a new one.
Date-verification (anxiety) likely buys more adoption than any new feature (pull).

## Big Hire vs Little Hire

- **Big Hire** = opening the link / bookmarking the PWA. Cheap by design. ✓
- **Little Hire** = *re-choosing it next Thursday.* This is what the 8-weekend window
  actually measures, and the app currently has **no job-done metric** — sessions and
  swipes measure engagement, not "did the weekend get planned through it?".
- **⚠ Finding 3:** the paid/native bet asks for a bigger Big Hire (install + pay)
  before any Little Hire evidence exists. The build order in the backlog (validate
  first) is therefore right — and the validation metric should be: *of the last 8
  weekends, how many contained one thing that came from the app?* Add the lightest
  possible proxy (e.g. a "we did this" tap on a saved pick, or just count saved-pick
  link-outs per weekend).

## Competition for the job (what J1 actually competes with)

1. **Non-consumption** — staying in, "we'll see", Netflix. The biggest competitor.
2. **The workaround stack** — WhatsApp thread + Instagram saves + a shared note/Google
   Maps list. (If interviews find these lists exist → the job is real AND underserved;
   strongest possible signal.)
3. **The human solution** — the partner who always plans. (If one exists, a two-sided
   matching loop has no vacancy to fill.)
4. **The city itself** — Amsterdam is dense enough that walking out the door works;
   improvisation is a real hire.
5. Named apps last: Time Out / I amsterdam / Fever / newsletters — mostly compete for
   *inspiration*, not for *agreement*. WKNDR should position against the workaround
   stack ("your saved-places graveyard"), never against Time Out.

## What the Mom Test interviews must listen for (the join with docs/mom-test-interviews.md)

1. **Which circumstance recurs** — Thursday planning (J1) vs Saturday-now (J2) vs kid
   pressure (J3). Tally per conversation; this decides what the paid bet even is.
2. **Workaround evidence** — shared lists, IG collections, a "places" note. Ask to SEE
   it ("oh you have a list? show me"). Workarounds = unserved job.
3. **The planning role** — who proposed the last three weekends? If always the same
   person, probe how the other experiences it (J1's two-sidedness lives or dies here).
4. **Fire events** — "you used to use Time Out/Fever — when did you stop, what
   happened?" (firing reasons = positioning gold).
5. **Forces in their words** — log each quote as push / pull / anxiety / habit in
   docs/validation-log.md; the force with the most quotes picks the next build.
6. **First-thought timeline** for the last weekend that went WELL: when did the idea
   appear, from where, who said it out loud, what nearly killed it.

## Score (framework's 0–10 rubric): **7/10**

Strong: circumstance-first thinking is native here (weather IS a circumstance lens);
all three job dimensions are served by the matching wedge; Big-Hire friction is already
minimal; competition is correctly understood as the workaround stack, not Time Out.

To reach 10:
- **(−1) Job split unacknowledged** — the geolocation bet rides on J2 while everything
  validated is J1. Fix: make the interviews tally circumstances; re-scope the bet to
  whichever job the data picks.
- **(−1) No job-done metric** — nothing distinguishes engagement from accomplished
  weekends. Fix: lightest "this happened" signal per weekend.
- **(−1) Anxiety underweighted in the backlog** — date-verification is filed as
  content-pipeline hygiene; by the forces math it's a top-3 adoption lever. Fix:
  re-rank it ahead of new pull features.
