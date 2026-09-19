# 004 — The two-minute board (the curate tool)

> **Status 2026-09-11 — Part 1 landed on `main`.** The audit was done in-session and shipped as
> **the letter** (app V.11.12, board V.10): the pipeline writes `data/letter.<city>.json` (the front
> with why-lines, in/out/moved, the doubts, the health sentence) and `app/public/curate/index.html`
> renders it and nothing else. The old grid is parked at `app/public/curate/legacy/`. What this
> brief can still be: **(a) a look-and-feel variation of the letter** — same constraints as below,
> plus: read only `letter.json`, no inline mirrors (`tests/letter-board.test.ts` is the gate), keep
> the Reply contract; or **(b) Take 2, "taste as a dial"** — the corpus (rules, anchors, vetoes,
> rests, the judge floor, the guide boost) as a living document inside the app, with the deck's own
> `SwipeStack` as a live preview that re-ranks as the dials move. (b) is a React route, not a
> static file, and needs its own brief when Ness calls for it. The text below is the original
> brief, kept as the record of the question.


**Branch** `codex/two-minute-board` · **Seam** the Curation Board (`app/public/curate/index.html`
— ~1,500 lines of vanilla HTML/JS, no build step, served static; board V.9.47)

**The question** — Under auto-by-default (V.11.3) and honest images (V.11.9), what does Ness need
to *see* and *do* in two minutes on a Thursday at 15:00 — and what should the board stop asking of
him?

**The context** — The board was built for a law that is gone: the 1:1 airlock, where nothing
shipped without his approval, so the board had to show him *everything*. Since 2026-08-29 the
pipeline publishes on merit and his taste *ranks*; since 2026-09-05 every image carries a receipt.
The board has accreted along the way: Simple / Advanced modes; IN ROTATION (the WEEKEND PILE with
drag-reorder, the canon library) / NEW FINDS (the scored inbox "Fresh from the sources", the bench,
canon candidates); the cancelled shelf; the ingest-health strip; receipts chips + NO PHOTO tiles; a
verdict vocabulary of ★1–5 · ✕ (with a reason that routes: fix / rest / veto / other) · 👑 TOP ·
↑ Top 10 · ▼ LATER · +CANON · IMG ✓/✗ · note · better-image URL; a Drop box for Instagram links;
Submit → a GitHub issue (the durable record) + the fast-lane worker (live in seconds) + a Formspree
mail. Below 720px the door (`?curate2026!`) opens the Triage deck instead — a phone-shaped ★/✕
pass over the airlock.

**Read first, in this order** — `docs/curation-surfaces.md` (who holds the pen — §2 "share the
component, never the sink" and §5 are law), `docs/board-roadmap.md` (Track A auto-compile, Track B
the reason→action routing), `docs/takeovers.md` (guest curators — a second point of view is the
scarce resource, not events), `STATE.md` (every board V.9.x entry, the V.11.3 doctrine
revision), `CHANGELOG.md` board entries V.9.41–V.9.47, then the board's own comments — they carry
the field failures that shaped each control.

**Part 1 — the audit (a document, `docs/variations/004-board-audit.md`)** — map every control and
section to the law it serves *today*; name what is dead weight under auto-by-default; name what
is missing. Candidates to test against the field: the image receipts as a first-class review lane
("7 no-photo · 3 venue borrows · 1 web — glance these"); *what changed since last Thursday* (new /
gone / blank / re-ranked) rather than the whole pool; the "why this leads" receipt on the front 10;
the ingest strip as a sentence, not a bar; whether Simple/Advanced and board/Triage are one tool
with two densities or two tools.

**Part 2 — the prototype** — a variation of the board that answers the question. One shape to
test: a **Glance** mode above Simple — the week on one screen (the front 10 with their why; the
deltas; the receipts lane; the health sentence), one-tap verdicts, Submit unchanged. Phone-first;
if it argues Triage and the board should merge, argue it in the audit and prototype the merged
thing.

**Constraints** — vanilla HTML/JS, no build step, no new external libraries (it is served straight
from `public/`); the **Submit payload is a contract** with the compile (`PILE-ORDER |` line, ✕
kinds fix/rest/veto/other, the issue body format) — keep it byte-compatible unless the audit
argues otherwise, and then say so; do not touch `worker/`; **never enter, request, or hardcode the
board's write key** — every worker POST is gated by `X-Curate-Key` (prompted once per browser), a
preview cannot write without it, and that is the point; the board reads `data/*.json` relative to
itself (on a preview that is the branch's committed data — fine for judging a layout).

**How to judge** — Ness, Thursday 15:00, phone then desktop: can he see the week and correct it in
two minutes? **The one thing:** what the board shows FIRST.

**Deliverable** — the audit doc + the prototype + the brief filled in, with a recording of a
two-minute pass on the preview.
