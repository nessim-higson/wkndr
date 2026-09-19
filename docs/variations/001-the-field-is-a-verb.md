# 001 — The field is a verb

**Branch** `codex/field-is-a-verb` · **Seam** the ambient field (`app/src/weather/`)

**The question** — What if the field *did* the weather instead of colour-coding it: rain falls,
heat shimmers, wind pushes, cloud drifts, a changeable day changes — and you read the sky before
you read the header?

**The itch** — The shipped look, Auras, is a palette-shifting soft-gradient: it tells you the mode
by hue (amber hot, blue-grey wet), which is a code you have to already know. V.11.7 had to add a
droplet glyph and rename COLD_WET's copy to "Rainy" because the field wasn't saying it. Ness's
reframe: *weather is a verb.* A field that rains is legible to a stranger; a field that is bluish
is not.

**Read first** — `app/src/weather/modes.ts` (the 5 modes, `classify` — pop ≥ 80 → COLD_WET at any
temperature; per-day split weekends `{sat, sun}`; the palettes and `applyMode`, which writes the
`--field-*` and `--card-tint` tokens every surface reads), `WeatherField.tsx` + `ambientEngine.ts`
+ `looks/*.ts` (Auras / Riso / Forms / A Gradient — the look registry and the `?dev=1` panel with
Scale · Motion · Grain), `CHANGELOG.md` V.11.7 / V.11.8 ("no flash of the wrong sky" — boot seeds
the last real weather; never HOT by default).

**What changes** — ONE new look, registered like the others, selectable in the dev panel. Auras
stays the default on this branch; graduation is the moment to swap. It must: render all 5 modes
and the split weekend; breathe with the live tokens (the card glaze reads the same `--field-*`);
hold 30 fps on an iPhone; treat motion as opt-in and calm (the Motion slider is the contract —
at 0 it is a still image that still says the weather); respect `prefers-reduced-motion`; keep the
header module legible in every mode. The field is the sky, not the content: it must never fight a
card.

**Do not touch** — cards, ranking, `classify` and its thresholds, the palettes' hues (a look may
*use* them differently; changing what COLD_WET means is a different brief).

**How to judge** — on the phone, dev pills: COLD_WET first (does it rain, within a second, before
you notice the droplet?), then HOT (shimmer, not orange), VOLATILE (does it *turn*?). Then desktop
at full width. **The one thing:** cover the header with your thumb — do you know the weather?

**Deliverable** — the look + a 20-second recording per mode in the PR; the brief filled in.
