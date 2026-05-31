# WKNDR — Defensibility & content model (strategy)

> A living map of what could make WKNDR defensible and unique, plus the content
> model that supports it. Captured from the strategy thread. Companion to
> `docs/discovery-direction.md` (product direction) and `docs/content-pipeline.md`
> (how content gets fresh). **Pre-validation: most of this is moat-*forming*
> foundation, not a moat yet — moats compound after product-market fit.**

---

## 1. Wedge vs moat vs feature (don't conflate them)

| Layer | Type | Defensible? |
|---|---|---|
| **Weather-ranking** | *Wedge* / positioning | No on its own (copyable in a sprint) — but "the weather-aware one" is ownable positioning and how we get *in*. |
| **Taste loop** (swipe-trained) | Data / switching cost | Somewhat — compounds per user; it's individual switching cost, **not** a network effect (yet). |
| **Living content pipeline** | **Operational** | **Yes — underrated.** A deep, fresh, well-curated local pool is labor + tuning + relationships. Hard to replicate. The Techmeme-style moat. |
| **Craft / design** | **Brand** | **Yes, if sustained** (see §3). |
| **The synthesis** | Integration | **Yes** — nobody combines weather + swipe-taste + deep local pool + list/stack duality + craft. Copying one feature ≠ copying the gestalt. |
| **Single-city depth** | Strategy | Owning Amsterdam *densely* beats being shallow everywhere. |

**The taste loop is *a* moat, not *the* moat.** Real defensibility is the *stack* compounding.

---

## 2. The content model — two axes, not one list

Content sits on **two independent axes**:

- **Weather sensitivity** — how much do conditions matter? Beach/terrace = *high*;
  museum/ramen = *low / inverse* (better when it's grim).
- **Time sensitivity** — fleeting vs always-there. Gig / closing show = *fleeting*;
  great museum / top bar = *evergreen*.

This already maps to the app's `freshness` buckets:

```
TIME-SENSITIVE  →  new  ·  weekend  ·  ending      (the churn — needs the pipeline)
EVERGREEN       →  always                          (the canon — cheap, durable)
WEATHER         →  the ranking lens, cutting across all of the above
```

The gap today: the **evergreen layer exists only as a tag**, not as a deliberate,
curated, browsable thing. That's the opportunity in §4.

---

## 3. Design as a core moat (it does triple duty)

Design alone is copyable; **sustained design taste becomes brand**, which is one of
the most durable consumer moats (Things, Linear, Arc, Bellroy). For WKNDR it earns
its place because it does three jobs at once:

1. **Identity** — a recognizable **weather-reactive visual system** (the field +
   the **generative weekend cover**, every weekend composed from the real data).
   Ownable in a way a layout isn't.
2. **Function** — the design *is* the information (glance → colour tells you the weather).
3. **Distribution** — a beautiful generated cover / "my weekend" card is **shareable**
   → organic marketing + brand impression. Design → growth.

**Key dependency:** design is **upstream of the data moat.** The swipe must feel
delightful or people won't do it enough to train taste → thin data → weak recs.
Polishing the experience *feeds the flywheel*; it isn't vanity.

---

## 4. The evergreen "Guide / Canon" mode (recommended)

A deliberate, curated, ranked repository of the durable good stuff — every museum,
best bars, parks, Eater-ranked restaurants, etc. A **third mode** beside the weekend
Stack/List: *"show me the definitive good stuff"* (reference) vs *"what should I do
this weekend"* (decide).

**Why it's strong (compounding):**
1. **The safety net / bottomless floor** — fixes the "ran out of things to swipe"
   problem. There's always a great museum/bar/park to fall back on.
2. **Cheap to maintain** — museums and top bars don't change weekly. High-value,
   low-upkeep content asset; the opposite of fragile event-churn.
3. **Content + distribution moat** — "best bars in Amsterdam, ranked" is linkable,
   searchable, shareable — definitive reference that earns trust + organic traffic.

**Two cautions:**
- **Don't drift into a Time Out listicle.** Keep it differentiated: even the canon is
  **weather-tagged** ("best rainy-day museums"), **taste-personalized** ("ranked for
  you"), and beautifully presented. The opinionated, weather-aware, personalized
  canon — not a generic guide. Otherwise we're competing with incumbents on their turf.
- **Legal spine holds.** "Ranked by Eater" = *cite + link* Eater (signal + link), not
  republish their list. WKNDR's evergreen layer is our own synthesis, crediting sources.

---

## 5. Shareable artifacts (the distribution lever) — two of them

The Spotify-Wrapped instinct, split into two artifacts (the less-obvious one is more valuable):

- **"My Weekend" (planning share) — frequent + useful.** Pick favs → a beautiful card
  (weather cover + your 3 picks) → send to your **partner**: "here's what I'm thinking."
  A real job-to-be-done (first users = Ness + partner → coordination), happens *every
  weekend*, every send is a brand impression + soft invite. **The viral loop that
  actually loops.**
- **"Wrapped" (retrospective) — the marketing moment.** "Your WKNDR spring" — what you
  did, your taste, top areas. Periodic, identity-expressing. **Only possible because of
  the taste/saved history now being captured.**

Both powered by the existing foundation (saved list + taste profile + generative cover).
**Start static/image share** (works everywhere); layer *interactive* cards later
(interactive = recipient loads WKNDR = better growth, more friction).

---

## 6. Other defensibility levers to develop (rough priority)

1. **Outcome data, not just intent** — capture *"did it"* (you actually went) + a quick
   rating. Almost nobody has this; richer than swipes; a feedback loop hard to copy.
   Best proprietary-data play.
2. **Collaborative filtering ("people like you saved…")** — the bridge from *personal*
   switching cost to a real **network effect** (more users → better recs for everyone).
   The Spotify/Netflix moat. Needs users → later, but architect for it now.
3. **Publisher & venue relationships** — signal+link can become a *relationship* moat:
   we send traffic + credit → preferential data, embeds, partnerships (Techmeme ↔ tech press).
4. **Ritual / habit** — Thursday brief + Saturday weather-pivot push → weekly habit
   (Hook model). Habit is a retention moat.
5. **Shareable artifacts** — see §5 (also a distribution moat).
6. **Multi-city framework (later)** — once it works in a 2nd city, the *system* (not the
   Amsterdam content) is the asset.

---

## 7. Honest meta + sequencing

Pre-validation, the real edge is unglamorous: **execution, taste, and being the person
who cares most about Amsterdam discovery.** Don't build the fortress before proving
anyone wants to live there. But *do* lay moat-forming foundations so defensibility can
form once it sticks.

**Sequence (all after a couple of weekends of real use):**
1. **Evergreen "Guide" mode** — cheapest high-impact; fixes run-dry; makes the app feel
   complete for validation.
2. **"My Weekend" share card** — serves the partner-coordination JTBD + seeds distribution.
3. **"Wrapped" retrospective** — once there's enough history to sing.
4. Outcome-data loop · collaborative filtering · the pipeline — as it earns them.
