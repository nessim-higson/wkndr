# WKNDR

A weather-aware weekend brief for a city. Personalized, re-ranked by the forecast,
written with an editorial voice. Discovery, not community.

**Start here:** open `CLAUDE.md` (full project context) and `index.html` (browse all
the design experiments). Workflow + Figma loop in `docs/SETUP.md`.

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

Exploration phase. v5 is the chosen base. Open question: v5-helvetica (energetic product)
vs. Hara (quiet publication) vs. a hybrid. Generative cover + Midjourney art-direction
pass is the next big build. See the "Open questions" section of CLAUDE.md.
