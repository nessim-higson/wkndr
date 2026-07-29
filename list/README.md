# WKNDR list — the Friday brief

The subscriber store for the Friday email. A Cloudflare Worker + KV, sibling to `/relay` but
deliberately a **separate worker**: the relay's published privacy claim is "no PII, 14-day TTL,
gone by itself", and an email list is the opposite of that. Two workers, two honest stories.

**Double opt-in, not negotiable.** The audience is in the EU, and a confirmed list is also the
biggest single lever on whether Gmail files the brief in the inbox or the promotions bin. A
signup is *not* a subscriber until they click the link in the confirm mail.

## Status — 2026-07-29

**Deployed, dark, and cannot yet send.** `https://wkndr-list.ness-13b.workers.dev`
(note: `ness-13b`, the same account subdomain as `wkndr-curate` — *not* the relay's
`nessimhigson` one).

| | |
|---|---|
| ✅ KV namespace `SUBS` | `1701f484b4b3461ea0145fdecdaee646`, in `wrangler.toml` |
| ✅ `ADMIN_KEY` | set as a Worker secret; local copy in `list/.env` (gitignored) |
| ✅ Worker deployed | `/stats` answers `{"pending":0,"active":0,"unsub":0}`; unauthed → 404 |
| ⬜ **`MAIL_API_KEY`** | needs a Resend account — **Ness** |
| ⬜ **SPF/DKIM on `wkndr.xyz`** | three TXT records Resend prints — **Ness** |
| ⬜ `LIST_URL` in `landing/index.html` | still `''`, so the form is hidden. Flip last. |

`MAIL_PROVIDER` is `"resend"` with no key, so `/sub` fails loudly rather than silently
accepting people it can never confirm. That's deliberate — and harmless while the landing
form is hidden.

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

## The weekly loop

Thursday 13:00 UTC the content pipeline runs. You curate against a fresh deck Thursday evening.
Friday morning you write the brief and send it:

```bash
cd list
bun run scripts/send.ts brief.html --subject "Rain Saturday. Here's where to be."   # DRY RUN
bun run scripts/send.ts brief.html --subject "Rain Saturday. Here's where to be." --send
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
