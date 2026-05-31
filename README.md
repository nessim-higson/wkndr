# WKNDR

A **weather-aware, swipe-trained discovery engine for Amsterdam.** Learns your taste
through a Tinder-style swipe and surfaces what's alive in the city right now — events,
food, galleries, day-trips — re-ranked by the weather and by what it's learned about you.
(It began as a curated weekend *brief*; that's now one view within the engine.)

**Start here:** read `docs/discovery-direction.md` (the locked product direction), then
`CLAUDE.md` (working memory / design lineage) and `index.html` (browse the experiments).

```
wkndr/
├── CLAUDE.md            ← read first. project memory for Claude Code sessions.
├── index.html           ← design navigator / contact sheet
├── experiments/         ← every prototype, in chronological chapters
│   ├── 01-foundations/
│   ├── 02-v5-family/    ← v5 is the working base; v5-kids is the current favourite
│   ├── 03-visual-languages/
│   ├── 04-header-directions/
│   └── 05-cover-hara/   ← most recent thread
├── engine/
│   └── weather-engine.ts   ← 5-mode classifier + ranker + LLM narration
└── docs/
    ├── SETUP.md         ← run locally · deploy · the Figma handoff loop
    └── sources.md       ← real Amsterdam venue + data-source URLs
```

## Run

```bash
python3 -m http.server 8000   # → http://localhost:8000
```

## Status

**Concept locked (discovery engine), entering Phase 1 — validate.** Next build is the
weekend-only swipe stack: CSS gradient weather background, basic DOM swipe, list/stack
toggle stubbed, weather-ranked picks for the coming weekend. Goal: do Ness + partner
actually open it for ~8 weekends? Visual exploration in `/experiments` (v5 base; Hara,
cover-helvetica, and the 06-hybrid live weather header are the latest threads) feeds the
card + weather-field design. See `docs/discovery-direction.md` §9 for the full build order.
