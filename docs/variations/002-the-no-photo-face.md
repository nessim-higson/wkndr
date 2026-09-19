# 002 — The no-photo face

**Branch** `codex/no-photo-face` · **Seam** the card face (`app/src/components/Card.tsx`, `Card.css`)

**The question** — Can a card with no photo be the card you'd *choose*, not the one you forgive?

**The itch** — V.11.9 retired every borrowed photo (a tattoo convention wore the flower market; a
Concertgebouw open day wore Haarlem). A card whose event has no honest photo now ships the
typographic face: the weather field pulled dark as its ground, the house grain, the title in
Clash Display, the venue beneath. 6–7 of ~35 live cards a week wear it, and for some events it is
permanent (the organiser simply has no usable image). Today it is a *good fallback*. The brief is
to make it an *object*.

**Read first** — `Card.tsx` (the `nophoto` branch), `Card.css` (`.card--nophoto`, `.np-*`; the
photo face's glaze/tint/grain vars it shares), `types.ts` (`ImageWhy`, `imageFocal`), `STATE.md`
V.11.9, `CHANGELOG.md` V.11.9 ("one idea per face; no 'no photo' apology on the card"),
`app/scripts/poster.ts` (its `none` variant: "type-only — most editorial"), `CLAUDE.md` design
lineage (the Helvetica instinct that keeps returning; v5 is the base).

**What changes** — the no-photo face only. Directions that are fair game: type as image (the
title huge, cropped by the frame, the when-stamp as the hero); a *derived* mark from the pick's own
facts — category, district (`lib/geo.ts` resolves a district and often a pin: a district silhouette
is honest imagery), weather affinity, price; a ticket/stub idiom; the venue line as the loud part.
It must hold on the phone (tall) AND on desktop (near-square: `min(52vw,560px) × ≤70vh`), survive a
long Dutch title at 46px, keep the when-stamp + the one signal pill + the expand cue where they
are, and read as the same system as the photo cards (same grain, same tokens).

**Do not touch** — the photo face; the thumbs (`.poster--*` in list/itinerary/share stay); the
law: nothing on this face may be a photograph or stock of anything other than this event. No
"no photo" copy on the card — the board carries that receipt.

**How to judge** — deal it between two photo cards on the phone. Does it feel chosen or forgiven?
Then desktop. **The one thing:** "Nederlands Theater Festival & Amsterdam Fringe Festival" at
46px, and "Museum Market" at 46px — both must look designed.

**Deliverable** — the face + screenshots of three real blanks from the live feed (phone + desktop).
