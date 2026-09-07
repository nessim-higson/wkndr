# AGENTS.md — working on WKNDR as a coding agent

WKNDR is a weather-aware weekend deck for Amsterdam (`app.wkndr.xyz`). A weekly pipeline crawls
the city's event sources, image-verifies them, ranks them against the coming weekend's forecast and
a hand-trained taste engine; you swipe; saves become a shareable link. Amsterdam only, no accounts,
no backend beyond two tiny Cloudflare workers.

**Read in this order before touching anything:** `STATE.md` (the kept-current snapshot — what's
live, what's law, what's open) → `CLAUDE.md` (design lineage) → `docs/curation-surfaces.md` (who may
write where) → `CHANGELOG.md` (why every decision was made, dated).

## Run / test / build

```
cd app
bun install --frozen-lockfile
bun run dev                 # Vite on :5173
bun test tests              # ~380 logic tests. THEY GATE THE CONTENT CRON — keep them green.
bunx tsc -b                 # strict TS, noUnusedLocals — must pass
bun run build               # the GitHub Pages build (base /wkndr/)
WKNDR_DEPLOY=domain bun run build   # the app.wkndr.xyz build (base /)
```

Bun, not npm. No key or network is needed for dev, tests or build: the app reads the committed
feed in `app/public/data/`. **Never run `bun run refresh` / `ingest` / `restamp` from a branch** —
they need API keys, hit live sources, and rewrite the data files the cron owns.

Sandbox setup (Codex cloud / any fresh box): `curl -fsSL https://bun.sh/install | bash` then
`cd app && bun install --frozen-lockfile`. Everything after that runs offline.

## THE PROTOTYPE PROTOCOL — how a variation lives

1. **Branch from `main`, named `codex/<slug>`** (or `proto/<slug>`). Never commit to `main`.
2. **Push the branch → it gets its own preview URL**: `.github/workflows/preview.yml` builds it
   and deploys to Cloudflare Pages as `https://codex-<slug>.wkndr-app.pages.dev` (the branch name
   slugified: `/` → `-`, lowercase). Production (`app.wkndr.xyz`) deploys from `main` only.
   The preview reads the LIVE feed from production (`VITE_DATA_ORIGIN`), so a variation always
   shows this week's real cards, however old the branch's data files are.
3. **Open a PR.** The PR description is the variation's dossier — use the template in
   `docs/variations/README.md`: the question it explores, what changed, how to judge it, what it
   deliberately does NOT touch. Screenshots or a screen recording of the preview help.
4. **On a prototype branch, do not**: bump `app/src/version.ts`, edit `STATE.md` / `CHANGELOG.md`
   (those are `main`'s history — a variation that graduates gets its entry when it merges), touch
   `app/public/data/*` (bot-owned; the cron rewrites it), `app/scripts/**` or `app/scripts/taste/**`
   (the pipeline and the taste corpus — only if the brief is explicitly pipeline-side), `.github/`,
   `worker/`, `relay/`, `landing/`, `versions/`, `experiments/`.
5. **Tests stay green** (`bun test tests`, `bunx tsc -b`). Add tests for any new pure logic in
   `app/tests/`. If a change makes an existing test wrong, say so in the PR and explain why — do
   not delete the test to get green.
6. One variation per branch. Small, legible diffs. Comments in the codebase explain WHY a rule
   exists (often with the date and the field failure that caused it) — keep that voice, and read
   the comment before changing the code beneath it.

## What is LAW (don't re-litigate on a prototype branch)

These were each tried the other way and reverted; the reasons are in `STATE.md` / `CHANGELOG.md`.
- **Weather is the thesis.** The deck ranks against the coming weekend's actual forecast; the
  ambient field IS the weather. Any variation keeps weather as the organising lens.
- **The deck is endless** (no "sets of N"); **cards are full-bleed `cover`** (no blur-fill).
- **Honest images (V.11.9).** A card's photo is OF the event or its venue, or the card has none —
  the typographic no-photo face. Never reintroduce a category/stock/"themed" photo fallback.
  Every live pick carries `imageWhy`; every image gets `imageFocal` (the crop's focal point).
- **Signal + link, never republish.** Facts only, our own ≤22-word blurb, the source credited and
  linked. No scraping of copy, no republished descriptions.
- **Amsterdam only.** No multi-city scaffolding.
- **Only Ness writes to the corpus** (`docs/curation-surfaces.md` §5). Users never write to the
  airlock; the board is his.
- **Copy: one idea per beat.** No restating, no tagline twice, no apology copy ("no photo yet"
  belongs on the board, not the card).
- **Type**: Helvetica Neue is the body voice; Clash Display is reserved for the wordmark, hero
  lines and poster titles. Use the scale tokens in `app/src/index.css` (`--fs-*`, `--sp-*`); don't
  invent in-between sizes.

## Where variation is WELCOME (the seams)

| Seam | Files | What lives there |
| --- | --- | --- |
| The ambient field | `app/src/weather/WeatherField.tsx`, `modes.ts` | 6 looks (CSS / Silk / Auras / Riso / Forms / shader). Ness has never loved Auras. "Weather is a verb" — the field should *do* the weather, not decorate it. |
| The card face | `app/src/components/Card.tsx`, `Card.css` | Photo face (glaze + grain + focal crop) and the typographic no-photo face. The when-stamp, the one signal pill, the title. |
| The deck | `app/src/components/SwipeStack.tsx`, `App.tsx` (`shown`, `rankPicks`, `orderServed`) | Swipe mechanics, deal-in, the wings, the end state. Ranking lives in `weather/modes.ts`. |
| List / Coverflow | `ListView.tsx`, `Coverflow.tsx` | The same pool in other postures. |
| The detail sheet | `CardDetail.tsx` | Expands out of the card; the focus loupe; "More like this". |
| Intro / first run | `Intro.tsx`, `Calibrate.tsx` | The opening beat and the taste-calibration round. |
| Filters | the `.filterstrip` in `App.tsx`, `FilterSheet` | When × What × Where, on the face. |
| Saves → plan → share | `Itinerary.tsx`, `ShareSheet.tsx`, `MatchGame.tsx` | The boomerang: link → partner swipes → overlap slams. |
| The Curation Board | `app/public/curate/index.html` (vanilla, static), `components/Triage.tsx` | Ness's instrument. Write-gated worker (never enter the key); Submit payload is a contract with the compile. See `docs/variations/004-*`. |

The data contract is `app/src/types.ts` (`Pick`). A variation may add optional fields it derives at
runtime; it may not require pipeline changes to render.

## How Ness judges a variation

He is the designer. He tests on his phone (iPhone, Safari) AND on a wide desktop window — both
must hold. He notices redundancy at the vocabulary level, off-by-pixels alignment, and anything
that "asks to be trusted" instead of explaining itself (a pill that says *why* beats one that says
*perfect*). A filter nobody finds doesn't exist. Motion is opt-in and calm. He would rather see one
idea taken all the way than three half-taken. Say what you left out and why.
