# WKNDR — Mom Test interview kit

_2026-06-11. The validation pass that gates the paid/native/geolocation bet (see backlog
"Strategic tracks"). Method: Rob Fitzpatrick's Mom Test — talk about their life, not the
idea; past specifics, not hypotheticals; listen 80%. The app is NEVER mentioned until the
ask at the end, if at all._

## The three beliefs at risk (state them so they can lose)

1. **Problem** — Couples/households in Amsterdam regularly hit a "what do you want to do
   this weekend?" loop that costs them real time/energy or produces worse weekends
   (defaulting to the same three things, staying in by indecision).
2. **Segment** — The pain is sharpest for couples (and parents of young kids) who *intend*
   to do things, not for spontaneous people or content-saturated locals who already know
   their scene.
3. **Solution-shape** — A shared swipe-deck whose overlap becomes the plan fits how they'd
   actually decide together (vs. one person proposing in WhatsApp and the other vetoing).

Each interview should be able to **damage** at least one of these. If a question can't
change what gets built, don't ask it.

## The scary questions (the ones that could kill the bet)

- *Does the loop even hurt?* Maybe "I dunno, what do you want to do?" is 90 seconds in
  WhatsApp and nobody experiences it as a problem — it might even be enjoyable couple time.
- *Does weather actually drive the decision*, or do people check Buienradar once and go
  anyway? (Weather is the moat thesis — test it against behavior, not the pitch.)
- *Is discovery the bottleneck at all?* Maybe everyone already has a list (Instagram saves,
  group chats, the same five newsletters) and the bottleneck is **agreeing**, or **booking**,
  or **energy** — each implies a different product.
- *Who plans?* If one partner always plans and the other is happy to be led, a two-sided
  matching loop solves a pain that doesn't exist in that household.

## The script (casual — never "can I interview you")

Framing line: **"How did you two end up doing [whatever they did] last weekend?"** —
that's it. It's a normal social question; the whole script hides inside it.

**Opening (the last instance, not the general case)**
- "What did you do last weekend? How did that come together?"
- "Who suggested it? What else was on the table?"
- "Walk me through it — where were you when it got decided? (couch, chat, Thursday?)"

**Dig (the friction, in their words)**
- "What's the hardest part of figuring out a weekend?" → then **"why was that hard?"**
- "Tell me about a weekend where the planning went wrong / you ended up doing nothing."
- "How often does the 'I don't know, what do you want to do' thing happen? When was the
  last time?"
- "What did the weather do to the plan that day?" *(never "do you check the weather" —
  ask what happened)*
- (parents) "How did you find the last thing you did with the kid that wasn't the
  playground?"

**What they already do (the real competitors)**
- "Where did that idea come from?" (Instagram save / friend / newsletter / habit)
- "What have you tried for finding stuff — apps, lists, newsletters? Which ones did you
  stop using? Why?"
- "What did you pay for last — tickets, a guide, a membership?" *(anchors real spend)*
- "When you and [partner] disagree on a plan, what actually happens?"

**Deflections (when the conversation produces bad data)**
- Compliment ("oh that app sounds cool!") → "Thanks — but what did you do *last* weekend?"
- Fluff ("we always end up at the same places") → "When was the last time? Which place?"
- Feature idea → "What's driving that — when did you last need it?"

## What NOT to ask (WKNDR's specific traps)

- ✗ "Would you use an app that ranks the weekend by weather?" (always yes)
- ✗ "Would you and your partner swipe together to pick plans?" (hypothetical + adorable = yes)
- ✗ "How much would you pay for this?" (anchored fiction — ask what they *did* pay for)
- ✗ "Don't you hate deciding what to do every weekend?" (leading; supplies the pain)
- ✗ Anything containing the words "weather-aware", "swipe", "match", or a demo of the app
  before the commitment ask.

## The commitment ladder (WKNDR's unfair advantage)

The share link means commitment is **measurable behavior**, not a promise:

1. **Time** — "I'm collecting how people in Amsterdam decide weekends — can I text you
   Friday to hear what you ended up doing?" (a no here = a no to everything)
2. **Reputation** — "Who's the most over-planned couple you know? Would you intro me?"
3. **Behavior (the real test)** — at the END, if and only if they described the pain
   themselves: "I've got a thing — I'll send you ten picks for this weekend; swipe what
   you'd do, takes a minute." Then watch the funnel, don't ask:
   - did they open the link?
   - did they finish the round? (the app shows N of N)
   - did a plan come back? (the return link is the round-trip)
   - **did any of it get DONE on the weekend?** (the only metric that gates the paid bet)
4. **Money-shaped** — "the next ten weekends of this costs a coffee" — only after ≥1
   completed round-trip. A flinch here is data too.

A polite "send it to me!" that never opens = a zombie lead. Count it as a no.

## Who / where (Amsterdam, casual)

- Couples at the playground / crèche pickup (the kid lens makes the opener natural).
- The "what should we do this weekend?" posts in Amsterdam expat/neighbourhood groups —
  reply privately, ask what they ended up doing, never pitch in-thread.
- Friends-of-friends via the over-planner intro (ladder rung 2).
- Quota: **10 conversations before any feature work on the paid/native track.** Spread:
  ~5 couples no kids, ~3 with kids, ~2 singles-who-plan-groups (control group).

## Processing (the belief board)

One row per conversation in `docs/validation-log.md`: who · date · exact quotes ·
**facts** (what they did) vs **interpretation** · commitment given · which of the three
beliefs it moved. Review after every 5.

**Decision rules (set BEFORE the data arrives):**
- Problem confirmed = ≥7/10 describe the loop unprompted with a specific recent instance.
- Weather thesis holds = ≥5/10 describe a plan that actually changed because of weather.
- Matching wedge holds = ≥3 link round-trips complete AND ≥1 produces a done-in-real-life
  plan within the 8-weekend window.
- Anything less: the paid/native/geolocation bet stays parked; reframe (ERRC one variable:
  maybe the job is "agreeing", not "discovering") and run the next 10.

## Score (per the framework's 0–10 rubric)

This plan as written: **9/10.** All questions are past-specific and idea-free, the
commitment ladder is behavioral, decision rules are pre-registered. The missing point is
earned in the field, not on paper: the discipline to not mention the app when someone
hands you a compliment-shaped opening — and to log the conversations that hurt.
