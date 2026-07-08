# WKNDR

A **weather-aware weekend deck for Amsterdam** — live at
**https://nessim-higson.github.io/wkndr/**. Every week a content pipeline crawls the city's
event sources, dedupes and image-verifies them, ranks them against the coming weekend's
actual forecast, and runs them through a hand-trained taste engine. You swipe; saves become
a shareable link; the link IS the match invite (a partner swipes your picks, overlap slams,
a plan comes back) — all in the URL, no backend, no login.

**Start here:** `STATE.md` — the kept-current snapshot (live version, pipeline state, open
decisions). Then `docs/backlog.md` for strategy and `CHANGELOG.md` for history.

```
wkndr/
├── STATE.md             ← read first. "catch me up" snapshot, kept current.
├── CLAUDE.md            ← session onboarding for Claude Code.
├── CHANGELOG.md         ← version history (V.<major>.<sub>, tags per whole version).
├── app/                 ← the product. Vite + React + TS, run with bun.
│   ├── src/             ← deck, matching, taste model, ambient weather field
│   ├── scripts/         ← the weekly content pipeline + taste engine (bun, GitHub Actions cron)
│   ├── tests/           ← logic tests (bun test) — they gate every content refresh
│   └── public/curate/   ← the Curation Board (verdicts → GitHub issue → compiled into the engine)
├── docs/                ← strategy, pipeline architecture, validation instruments
├── versions/            ← frozen reference builds (v4-10, v6-2)
└── experiments/         ← the 2026-05 design-exploration archive that seeded all of this
```

## Run

```bash
cd app
bun install
bun run dev        # → http://localhost:5173
bun run test       # logic suite (also runs in CI before every content refresh)
```

## Ship

`cd app && bun run bump` → `bun run build` → commit → push. Pushing to `main` auto-deploys
to GitHub Pages; the weekly feed refreshes via `.github/workflows/refresh.yml` (Thu 13:00 UTC,
publish-gated — a broken run abstains and last-good keeps serving).

## Status

Build-for-self validation phase. The product loop is shipped (deck → save → share → match →
plan); the open question is behavioral — do share links round-trip and do plans get lived.
`docs/validation-log.md` is the scoreboard.
