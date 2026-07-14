# WKNDR

A **weather-aware weekend deck for Amsterdam**. Every week a content pipeline crawls the city's
event sources, dedupes and image-verifies them, ranks them against the coming weekend's
actual forecast, and runs them through a hand-trained taste engine. You swipe; saves become
a shareable link; the link IS the match invite (a partner swipes your picks, overlap slams,
a plan comes back) — all in the URL, no backend, no login.

**Where it lives**

| Surface | URL | Deploy |
| --- | --- | --- |
| Landing | **https://wkndr.xyz** | `landing/` static → Cloudflare Pages |
| App (domain) | **https://app.wkndr.xyz** | `app/` domain build → Cloudflare Pages |
| App (legacy) | https://nessim-higson.github.io/wkndr/ | `app/` default build → GitHub Pages (kept live so old share links resolve) |

The two app builds share one codebase; only the served base path (`/` vs `/wkndr/`) and the
canonical origin baked into unfurl + share links differ (see `app/vite.config.ts`).

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
├── landing/             ← the marketing site (wkndr.xyz). Self-contained static HTML — index + /privacy.
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

## Cloudflare (the .xyz domain)

Two Cloudflare Pages projects sit under `wkndr.xyz` (domain + DNS live in Ness's CF account):

```bash
# landing (wkndr.xyz) — static, no build step
wrangler pages deploy landing --project-name=wkndr-landing

# app (app.wkndr.xyz) — base '/', canonical origin = https://app.wkndr.xyz
cd app && bun run build:domain
wrangler pages deploy dist --project-name=wkndr-app
```

The GitHub Pages deploy (`bun run build`, base `/wkndr/`) is unchanged and stays live so
share links minted on github.io keep resolving. Custom-domain attach + DNS are done in the
CF dashboard.

## Status

Build-for-self validation phase. The product loop is shipped (deck → save → share → match →
plan); the open question is behavioral — do share links round-trip and do plans get lived.
`docs/validation-log.md` is the scoreboard.
