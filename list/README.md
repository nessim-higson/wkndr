# WKNDR list — the Friday brief

The subscriber store for the Friday email. A Cloudflare Worker + KV, sibling to `/relay` but
deliberately a **separate worker**: the relay's published privacy claim is "no PII, 14-day TTL,
gone by itself", and an email list is the opposite of that. Two workers, two honest stories.

**Double opt-in, not negotiable.** The audience is in the EU, and a confirmed list is also the
biggest single lever on whether Gmail files the brief in the inbox or the promotions bin. A
signup is *not* a subscriber until they click the link in the confirm mail.

## Status — 2026-10-26

Ness: "I want to kick start the email feature." Everything below the line was already built in July
and has sat dark since; today added the one missing step — the file — and proved the loop end to end
up to the blast (a dry run against the live worker: `audience 0 confirmed · Nobody to send to`).

**What runs today, with nothing from you:**

| | |
|---|---|
| ✅ Worker deployed | `https://wkndr-list.ness-13b.workers.dev` — alive (`/stats` answers 401 unauthed, as designed) |
| ✅ KV namespace `SUBS` | `1701f484b4b3461ea0145fdecdaee646`, in `wrangler.toml` |
| ✅ `ADMIN_KEY` | a Worker secret; local copy in `list/.env` (gitignored) |
| ✅ **`bun run brief`** (`app/scripts/brief.ts`) | writes **template E, the picks** (since 2026-10-30; `--template=hybrid` for D, `grid` for the 2-up, `radical` for the five that are different objects, `all` for every one) from the live deck + the weekend forecast → `list/out/brief-<saturday>.html` (+ `brief.html`); checks every `<tr>` sits in a `<table>` and the size stays under Gmail's clip; 24 tests |
| ✅ `send.ts` dry run | reads the audience off the worker, renders per-recipient unsubscribe links, prints the first email; `--send` to blast |
| ✅ Templates | five comps + the harness, live at https://wkndr-brief.pages.dev; the renderer builds **E** (D on request) |

**The three steps that were Ness's — done 2026-10-28 (sign-in mail delivered from `hello@wkndr.xyz` that afternoon):**

1. ✅ **Resend key** — WKNDR lives in the existing Resend team (the one that also carries the AFF /
   Crunchyroll access codes — a second team is a paid feature). Isolation is per domain + per key: the
   key is *Sending access* restricted to `wkndr.xyz`, named `wkndr-workers`; it is `MAIL_API_KEY` on
   both `wkndr-list` and `wkndr-account`. What is shared with AFF is the Free plan's 100-mails-a-day
   cap and account standing — fine at this size; revisit (Pro, $20) once the list passes ~50.
   `list/.env` also needs `MAIL_API_KEY=…` for `send.ts --send`.
2. ✅ **`wkndr.xyz` verified** in Resend (Ireland region) via Cloudflare's one-click Domain Connect:
   DKIM TXT + the `send` / `rsend` CNAMEs, all DNS-only. Still to add by hand in the Cloudflare zone:
   a `_dmarc` TXT `v=DMARC1; p=none;` (Resend lists it, doesn't add it) and, before the first blast,
   an Email Routing rule forwarding `friday@` / `hello@` to a read inbox — neither is a mailbox.
   Click tracking: switch OFF under the domain's Configuration tab (plain organiser links, plain magic link).
3. ✅ **Form live** — `LIST_URL` in `landing/index.html` points at the worker. Next: Ness + partner sign
   up on the landing and click the confirm mails — subscriber one and two.

**The weekly loop from then on** (Monday + Thursday 10:00 UTC the pipeline rebuilds the deck):

```bash
cd app && bun run brief                    # Friday morning: the draft, from the deck as it stands
open ../list/out/brief.html                # read it; edit the hero sentence and the forecast line by hand
cd ../list && bun run scripts/send.ts out/brief.html --subject "…"          # dry run — audience, first email
cd ../list && bun run scripts/send.ts out/brief.html --subject "…" --send   # the blast
```

`bun run brief --hero="copenhagen"` pins the cover to a card by title; `--per=4` is picks per day;
`--template=picks|grid|index|plates|cover|split|blocks|hybrid|poster|receipt|board|postcard|note|radical|all` picks the design (default `picks`; `radical` = the five that are different objects);
`all` also writes **`list/out/variations.html`** — every one side by side at phone width, with a 600px toggle; each layout is inlined as `srcdoc`, so the page renders opened straight from the folder, not only served.
The renderer writes as of **the feed's own weekend** (the Letter names it) — on a Monday before the
rebuild the draft is last weekend's and says so; a Friday run is the coming weekend with its forecast.
`list/out/` is gitignored: the brief is a sent thing, not a source file.

## Deploy (once — done, kept for reference)

```bash
cd list
npx wrangler kv namespace create SUBS      # paste the printed id into wrangler.toml
npx wrangler secret put MAIL_API_KEY       # Resend API key
npx wrangler secret put ADMIN_KEY          # long random string — gates /export + /stats
npx wrangler deploy
```

Then verify the worker origin in two places — `LIST_URL` in `landing/index.html` and the
`LIST_URL` default in `scripts/send.ts` — match what wrangler printed.

**Sending domain.** Resend needs SPF/DKIM records on `wkndr.xyz`. DNS is already in Ness's
Cloudflare account, so it's paste-three-records. Until that's done, mail sends from Resend's
sandbox domain and deliverability will be poor — do this before the first real blast, not after.

To develop without sending anything, set `MAIL_PROVIDER = "none"` in `wrangler.toml`; the worker
logs what it *would* have mailed and no key is needed.

## Templates — five comps

`templates/` holds three designs for the brief, plus a side-by-side harness. Same picks, same
weekend, and the **real forecast for 1–2 Aug 2026** pulled from Open-Meteo's *hourly* endpoint —
Sat 24°, Sun 26°, no rain either day, but Saturday clouds over at lunch and clears by six while
Sunday is bright only until one. That hour-level reading is the §3 slot model doing real work: a
daily summary would have called this "two sunny days" and said nothing useful. Three bets about
what the brief *is*:

| | Comp | The bet | Size |
|---|---|---|---|
| **A** | `a-poster.html` | the **picture** sells it — hero image, one lead pick, thumb rows | 15.8 KB |
| **B** | `b-dispatch.html` | the **writing** sells it — zero images, hanging numerals, signed | 12.5 KB |
| **C** | `c-forecast.html` | the **structure** sells it — Sat vs Sun columns, each with its own temp | 13.4 KB |
| **D** | `d-hybrid.html` | **A's cover over C's split** — see below | 17.5 KB |
| **E** | `e-picks.html` | **the picks, pictured** — the renderer's default since 2026-10-30, see below | 29 KB |

**D, the hybrid**, rests on one rule: *the hero is a pick, not a mood image.* It earns the space by
being the single best hour of the weekend — named, dated, with a reason — so De Parade appears once,
as the cover, and never again in the Saturday column. Then a one-line forecast claim explains the
weekend's shape, and the two columns carry the rest **chronologically down each day** (Saturday:
1–4pm → early evening → after dark). Reading order becomes doing order.

**E, the picks** (2026-10-30, Ness: "the design of a picks of the weekend — develop out the email
design") keeps D's rules — the cover is a pick, the forecast line explains the shape, the days run
chronologically — and changes one thing: after the cover, D was a wall of type, and the app's front is
fully pictured. So every pick is a numbered row with a **square focal-point thumb** re-cut from the
original (never the card's portrait crop), the day and hour as the kicker, title, venue · price, one
line of the card's own copy, and a **monospace source trace** (`via LBB · I amsterdam · 610 going on
RA`) — the signal-and-link model made visible on every row, and the only place mono is allowed. A card
with no honest photo gets the typographic face (its initial on the day's wash), never a stand-in. The
**sky opens it as a band**: the claim big, Saturday and Sunday as two cells in their own weather tint,
and the forecast's receipt (`forecast Open-Meteo · read Fri 30 Oct 12:00 · ranked by the sky, then the
hour`) — the first phone screen is the sky, then the cover. The rows hold at 390px by shrinking the
thumb to 104px, never stacking; `--template=grid` is the same data as 2-up 3:2 cards (a contact sheet
on desktop, long on a phone — kept for comparing, not the default). Dark: the washes go to a dark
neutral, the tints stay. Images off: the wash square with the title as styled alt text.

**The variations round (2026-10-30, "can I please see more variations on design").** Seven layouts
of E from the same data, each a different bet, all under `brief-picks.ts` and written together by
`bun run brief --template=all` into `list/out/variations.html`:

| layout | the bet | lineage |
|---|---|---|
| `rows` (default) | thumb + text rows under a sky band; holds on a phone without stacking | the app's list view |
| `grid` | 2-up 3:2 cards, a contact sheet; stacks on a phone | — |
| `index` | type only after the cover — hanging numerals, the writing sells it | 03-visual-languages/02-bold-index |
| `plates` | every pick a quiet full-width photograph with a caption, brick-red accent, no rules, text CTA | 05-cover-hara/03-hara |
| `cover` | the weekend's weather as a solid field in the wetter day's mode tint, then a dense list with 72px round thumbs | 04-header-directions III |
| `split` | Saturday \| Sunday as two pictured columns — D's structure, every card pictured | 02-v5-family |
| `blocks` | each pick its own colour world — a full-width block in the day's wash, picture right, type left | 03-visual-languages/03-scrollytelling |

All seven keep the rules (tested: every `<tr>` legal, the cover once, `{{unsub}}`, under the clip, the
trace on every row, the phone rules). The plates are the same markup with the orange replaced by
`#8a2818` everywhere — the one design-token rule the Hara direction insists on.

**The radical round (2026-10-30, "give me some radically different email designs").** The seven
above are one world in seven arrangements. These five, in `app/scripts/brief-radical.ts`, each take a
different OBJECT as the model and build the brief as that object — same data, same rules, nothing else
shared:

| layout | the object | what makes it that object |
|---|---|---|
| `poster` | a gig poster | black page, the hero full-bleed 4:5, 46px uppercase name, the claim black-on-orange, the rest a lineup with sizes falling by rank |
| `receipt` | a till receipt | a 360px thermal-paper strip, all monospace (the one honest place for it at body size), dashed rules, line items with the hour as the amount, totals, a barcode of table cells; no `<img>` |
| `board` | a departures board | Swiss timetable: white, a 6px black rule, red times down a column, a tinted square per row for the day's mode; no `<img>` |
| `postcard` | a postcard on a desk | the photo in a white print border as the front; a cream back with a handwritten note (Snell Roundhand → Apple Chancery → Segoe Script → cursive) naming the picks as a sentence per day, a stamp with the temperature, a postmark, address rules |
| `note` | a plain email from a friend | white page, the system font at 16px, no mast, no card, no numbers, no pictures; prose with the links in it |

Tested the same way (legal tables, `{{unsub}}`, under the clip, the hero once, a trace, the claim, the
phone rule) plus one pin per object. Sizes 9–24 KB. The receipt and the note are the two cheapest
emails the list can send; the poster is the one that would look wrong in a light inbox and right on
a phone at night.

**Two layout bugs found building it, both worth remembering:**

- **The mobile breakpoint must sit BELOW 600px.** These were written at `max-width:620px`, and email
  content width *is* 600px — so the query matched everywhere and **comp C never once rendered its
  two-column layout**, on any screen. It had been silently stacked since it was written. All four are
  now `max-width:480px`.
- **The shell is `width:100%; max-width:600px`, never `width:600px`.** The latter fought the
  wrapper's 12px side padding and produced a 624px document inside a 600px viewport — a horizontal
  scrollbar in any 600px-wide reading pane. The `width="600"` *attribute* stays for Outlook, which
  ignores `max-width`. D's columns are percentages (48/4/48) for the same reason.

Compare them: `preview_start` the `wkndr-brief` config (port 4219) → `/compare.html`, or live at
https://wkndr-brief.pages.dev. Toggles for mobile 390, the Outlook.com dark path, and **images
off**.

**On image blocking, accurately.** Classic Outlook desktop on Windows blocks external images by
default for senders not on the safe-senders list, and a lot of locked-down corporate mail does the
same. **Gmail does not** — it has proxied and cached images through `googleusercontent` since 2013
and displays them by default; the "ask before displaying external images" setting exists but is
opt-in. Apple Mail displays too (proxied via Mail Privacy Protection on iOS 15+). So blocked-image
readers are a real but minority slice, concentrated in Outlook desktop and corporate estates —
treat the published percentages floating around as folklore.

The way to know *your* number: an open is measured by loading a tracking pixel, so **your open rate
is approximately your image-load rate.** Resend reports it. After two or three sends you'll have a
better figure for your own list than any published average.

Comp A is hardened for the blocked case anyway — see the hero comment in `a-poster.html`: a
`bgcolor` on the cell, **no `height` attribute** so a blocked image collapses to a line instead of
reserving an empty band, and styled `alt` text so it degrades to designed type.

**Email-HTML rules these follow**, worth keeping if you edit them:

- **Every `<tr>` must be a direct child of a `<table>`.** A `<tr>` inside a `<td>` is *silently
  discarded* by HTML parsers — not moved, deleted. This cost Comp A its forecast block and its lead
  pick on the first pass and rendered without any error. There's a checker in the git history of
  this file's commit; re-run it after structural edits.
- **Everything load-bearing is inline.** `<style>` is enhancement — Gmail strips it on forwards.
- **No flexbox, grid, or CSS variables.** Outlook renders through Word. Tables and inline styles.
- **Two dark paths**: `@media (prefers-color-scheme:dark)` for Apple Mail/iOS, and `[data-ogsc]`
  for Outlook.com. Both are wired; the paper tone is a real colour (`#faf8f3`, not `#fff`) because
  it survives Gmail's inversion far better.
- **Under 102 KB, always.** Past that Gmail clips the message and hides the tail behind "View
  entire message" — and the tail is where the unsubscribe link lives.
- **Webfonts don't load.** TWKLausannePan is unavailable in mail, so these use the brand's
  secondary face (Helvetica Neue → Helvetica → Arial). Don't try to @font-face it.
- **`{{unsub}}`** appears in all three; `send.ts` swaps it per recipient.

## The weekly loop

Thursday 10:00 UTC the content pipeline runs. You curate against a fresh deck Thursday evening.
Friday morning `bun run brief` (in `app/`) writes the draft to `list/out/brief.html`; you edit it and send it:

```bash
cd list
bun run scripts/send.ts out/brief.html --subject "Rain Saturday. Here's where to be."   # DRY RUN
bun run scripts/send.ts out/brief.html --subject "Rain Saturday. Here's where to be." --send
```

`--send` is required to actually blast — the default is a dry run that prints the audience count,
the source breakdown, and the first fully rendered email. An accidental send is unrecoverable, so
the safe path is the default one.

`{{unsub}}` anywhere in `brief.html` becomes that recipient's one-click unsubscribe link. If you
leave it out, a footer with one is appended automatically — the brief can never ship without a way
out. Every send also carries `List-Unsubscribe` headers, which is what makes Gmail show a native
unsubscribe button instead of offering "report spam".

## API

| | |
|---|---|
| `POST /sub` | `{email, src?, hp?}` → mints a pending record, mails a confirm link. Always answers `{ok:true}` — an endpoint that says "already subscribed" is an address-enumeration oracle. |
| `GET /confirm/<token>` | pending → active. One-time use, 7-day expiry. |
| `GET /unsub/<token>` | active → unsubscribed. One click, no login, no "are you sure". |
| `GET /export` | active addresses + unsub tokens, for the send script. `authorization: Bearer <ADMIN_KEY>`. |
| `GET /stats` | `{pending, active, unsub}` — the opt-in experiment's scoreboard. Same auth. |

## What this is actually testing

STATE.md item 6 is the real gate: *does anyone come back weekend after weekend?* moat.md is blunter
— "a much-polished front door, zero evidence of the weekly habit the whole thesis rests on."

This list is the cheapest instrument for that question. The numbers that matter, in order:

1. **Confirm rate** (`pending` → `active`). Below ~50% means the ask is landing wrong, not that
   nobody wants it.
2. **Week-4 open rate.** Week 1 is curiosity. Week 4 is habit. This is the number.
3. **Click-through to the app.** An email people open but never act on is a newsletter, not a wedge.
4. **Unsubscribes after a specific issue** — that's a taste signal about that week's picks, and it's
   as useful as the Curation Board's ✕.

`src` is stored on every record, so the export tells you where subscribers actually come from —
landing vs app vs anything physical. That's how a sticker or window-card experiment gets measured
instead of guessed at.
