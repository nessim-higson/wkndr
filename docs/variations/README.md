# Variations — the protocol and the brief

Open briefs: `001-the-field-is-a-verb.md` · `002-the-no-photo-face.md` · `003-the-opening-beat.md` ·
`004-the-two-minute-board.md`. One branch each; the file IS the first prompt.

A variation is a question about WKNDR answered in code, on its own branch, with its own preview
URL, judged against the live feed. It is never `main`. See `AGENTS.md` for the working rules.

## Filing one

```
git switch main && git pull
git switch -c codex/<slug>          # e.g. codex/field-is-a-verb
# … work in app/src …
cd app && bun test tests && bunx tsc -b
git push -u origin codex/<slug>     # → preview at https://codex-<slug>.wkndr-app.pages.dev
gh pr create --fill                  # the PR description = this brief, filled in
```

Working locally on several at once: one git worktree per variation, one port each.

```
git worktree add ../wkndr-<slug> codex/<slug>
cd ../wkndr-<slug>/app && bun install --frozen-lockfile && bun run dev --port 5181
```

## The brief (paste into the PR description and fill in)

```
## <Variation name>

**The question** — one sentence. What would be true about WKNDR if this worked?

**The reference / the itch** — where the idea comes from (a site, a moment in use, a line in
STATE.md or CHANGELOG.md, a field failure). Links.

**What changed** — the seam(s) touched (see AGENTS.md "Where variation is welcome"), in 3–6 bullets.
Files listed.

**What it deliberately does NOT touch** — and why.

**How to judge it** — on the phone: … · on desktop: … · the one thing to look at first.

**Preview** — https://codex-<slug>.wkndr-app.pages.dev (+ screenshots / a short recording)

**Tests** — `bun test tests` N pass · `bunx tsc -b` clean · new tests: …

**If it graduates** — what would have to be true; what the version entry would say.
```

## The two worlds — the rule that keeps them apart

`main` is production; a variation branch is a question. Neither side describes the other:
- A prototype branch never edits `STATE.md`, `CHANGELOG.md`, `app/src/version.ts`, the data, the
  pipeline, the taste corpus, `.github/`, the workers.
- **`main`'s documents never describe unmerged work.** No PR summaries in `STATE.md`, no "in
  flight" design detail in `CHANGELOG.md`, nothing in a session memory. The PR is the record until
  graduation; the preview is the artefact; review happens in PR comments. The only thing that
  crosses early is the *reason* a variation was closed (§ Outcomes below).
- The `main` worktree never checks out a `codex/**` branch. Review with `gh pr diff <n>` and the
  preview URL; work on one in its own worktree (`git worktree add ../wkndr-<slug> codex/<slug>`).
- Production deploys from `main` only (`deploy.yml`); previews deploy to the branch alias only
  (`preview.yml`, `--branch=<slug>`). A preview cannot become production.

## After

A variation is judged on the preview, on the phone, against this week's real cards. Three outcomes:
- **Graduates** → rebase on `main`, bump `app/src/version.ts` (`bun run bump`), add the
  `CHANGELOG.md` + `STATE.md` entries, merge the PR. Production deploys from `main`.
- **Informs** → the idea is kept as a note in `STATE.md` § Open items, the branch is deleted.
- **Rejected** → the PR is closed with the reason in one line. The reason is the deliverable.

Preview deployments are removed by deleting the branch (Cloudflare keeps the last few; nothing
lives at the alias once the branch is gone).

## Outcomes

_The reason a variation was closed — one line each, dated. The only trace an unmerged branch leaves on `main`._
