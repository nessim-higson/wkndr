# WKNDR — The Account · STATE

_Catch-me-up snapshot for the account layer — a **snapshot, not a history** (the history is
`CHANGELOG.md` V.12.2 and the git log). Read this before touching `worker/account/`,
`app/src/lib/account.ts`, `lib/useAccount.ts`, `components/AccountSheet.tsx` or
`components/LaterShelf.tsx`. The top-level `STATE.md` carries the one-paragraph version._

_Last updated: 2026-10-30_

---

## What it is, in one breath

Ness, 2026-10-26: *"I want to look at having an account that I can log into and then have saved
events and things to do for the future."* Built 27 Oct as **V.12.2**: a free, password-less,
Google-less account — a **magic link** mailed to the person's address — whose only job is to make
**saves and taste follow a person between devices**, and to hold the first two things that need
memory past one weekend: the **Later shelf** (saves for dates after this weekend) and **Did you go?**
(the first outcome data WKNDR has ever stored, `docs/moat.md` §6 item 1). Signed out, the app is
exactly V.12.1. Nothing here writes to the deck (`docs/curation-surfaces.md` §2).

## Status — 2026-10-30

| | |
|---|---|
| **Live** | `https://wkndr-account.ness-13b.workers.dev` — Cloudflare Worker `wkndr-account`, KV namespace `ACCOUNT` (`0b262e1cc80b4257b6f89d99305195e6`), deployed 27 Oct. |
| **Mail** | ✅ **ON since 28 Oct** — `MAIL_API_KEY` set (a Resend key with *Sending access* restricted to `wkndr.xyz`, the same team as the Friday brief); first magic link delivered from `hello@wkndr.xyz` that afternoon. A live `POST /login` now answers `{ok:true}` with no `delivery:'off'`. |
| **App** | V.12.2 on `app.wkndr.xyz` (Cloudflare Pages deploys every push to `main`). The menu row, the sheet, the Later tab, the arrival pill and the question are all in. |
| **Tests** | 26 for this layer: `app/tests/worker-account.test.ts` (13 — the whole lifecycle against an in-memory KV with a clock) + `app/tests/account.test.ts` (13 — the merge, the shelf, the pill, the question). `bun test tests` was 603 green at ship; `bunx tsc -b` clean. |
| **Proved** | End to end locally in `MAIL_PROVIDER=none` on 27 Oct (link logged → followed → signed in → save on device A → device B's `PUT` → merged on reload: Later · 2, the pill, Went synced). Phone viewport checked. **Not yet proved:** a real two-device session with the live mail — Ness's first real sign-in on 28 Oct is the only live tap so far. |
| **Users** | Ness. Nobody else has been pointed at it; it is not announced anywhere (no landing copy, no brief mention). |

## Where it lives & how it deploys

- **Worker:** `worker/account/src/index.ts` (the fetch handler — the ONLY thing the entry module
  exports) + `worker/account/src/lib.ts` (constants, the state contract, the pure rules; tests import
  from here). `wrangler.toml` carries the KV id, `MAIL_PROVIDER=resend`, `MAIL_FROM`, `APP_ORIGIN`.
  Deploy = `cd worker/account && npx wrangler deploy` (wrangler via `npx --no-install`, authed on the
  laptop). The one secret is `MAIL_API_KEY` (set; rotate with `npx wrangler secret put MAIL_API_KEY`,
  no redeploy needed).
- **App:** `app/src/lib/account.ts` (the contract mirrored, the rules, the fetch wrappers, the storage),
  `app/src/lib/useAccount.ts` (the sync loop — one hook), `app/src/components/AccountSheet.tsx` (+ `.css`),
  `app/src/components/LaterShelf.tsx` (`LaterRows`, `AskWent`), wired in `App.tsx` (`const account =
  useAccount(…)`). The worker origin is the constant `ACCOUNT_URL` in `lib/account.ts`; set it to `''`
  and the whole account path switches off (menu row gone; the shelf and the question keep working from
  the local mirror). `app/src/lib/when.ts firstDateOf` was added for the shelf.
- **Mail:** Resend, the brief's account and verified domain (`list/README.md` steps 1–2). The Free plan's
  100-mails-a-day cap is shared between `wkndr-list` and `wkndr-account` — fine at this size.

## How it works (the shape to keep in your head)

```
≡ → Account → email ─▶ POST /login ─▶ one-time token (15 min) mailed as /auth/<token>
tap ─▶ GET /auth/<token> ─▶ record created ON THE TAP · session (90 d) · exchange code (2 min)
    ─▶ 302 app#signin=<code> ─▶ POST /session {code} ─▶ {session, email} in localStorage
load / sign-in ─▶ GET /state ─▶ merge with the local mirror ─▶ apply to app ─▶ PUT if it moved
any change ─▶ mirror (pure projection) ─▶ 1.5 s debounce ─▶ PUT /state {version, state}
PUT 409 ─▶ merge(server, mirror) ─▶ apply ─▶ PUT again on the server's version
```

- **The session is a bearer in localStorage** (`wkndr.account.v1`), not a cookie: the worker is
  cross-origin to `app.wkndr.xyz` and Safari ITP would eat a third-party cookie. The session never
  rides in a URL — the redirect carries a 2-minute one-time exchange code in the fragment.
- **The worker never merges.** `PUT /state` is last-write-wins on the version the client last saw;
  a stale write gets a **409 with the stored document** and the APP merges (`mergeState`, tested) and
  retries. The merge: saves union (earlier `at` wins, missing dates fill in); declines union within a
  week, else the newer week's; taste from the newer document plus any token only the other knew —
  **never summed**, so merging twice is a no-op; `later` max seen; a `went` answer is deliberate, the
  later one wins.
- **The mirror** (`wkndr.account.state.v1`) is the one store the app reads for the shelf and the
  question — signed in or out. App state → mirror is a deterministic projection
  (`snapshotSaves` + taste + this week's swiped ids), so adopting a merged document re-projects to the
  same fingerprint and the loop settles.
- **Saves are snapshots** `{id, title, when, at, start?, end?, link?}` taken at save time, so a save
  outlives the weekly feed (a Later row for a card that rotated out still opens the organiser's page).
- **Enumeration-safe by construction:** `/login` answers identically for a known and an unknown
  address; 10/IP/10 min → a plain 429; 3/address/10 min → answered as mailed, and not sent;
  `delivery:'off'` is a fact about the deploy, never the address; `return` is honoured only for our
  own origins. Addresses are hashed in KV keys; the record holds the plaintext because we mail it.

## The surfaces (what a person sees)

- **Menu row** (≡ → Account): "Sign in" or the signed-in email, with a sub-line — *saves + taste follow
  you · synced* / *syncing…* / *offline · kept here until you're back*.
- **The sheet** (paper, reuses `InputsSheet.css`): form (one email field, "Send me a link") →
  "Check your mail" (+ "Use another address") → signed in ("What follows you", "Sign out on this
  device"). Notes for `off` (mail not switched on), `bad`, `slow`, `error`, `expired` (a link older than
  15 min, or a code older than 2 min, lands on a 410 page / "expired" note).
- **Saves panel:** when any save is shelved, two tabs — **This weekend · n** / **Later · n** — Later
  sorted soonest first (a run by its end date), rows with a calendar thumb that open the detail if the
  card is still in the feed, else the organiser's link in a new tab.
- **The arrival pill** (`.ctx-bar.later`, under the header): *Saved for this weekend · <title> (+n)*
  with Open / ✕, shown once per save per week (`later[id].seen`), only on the plain feed, yielding to
  intro, more-like, undo and the open menu.
- **Did you go?** (`.sv-ask`, after the saves list): up to three finished saves, Went / Didn't, asked
  once; the answer lands in `went` and syncs.
- **Sign out** keeps the device's saves (toast: *Signed out · your saves stay on this device*).

## The rules (numbers, so they're not re-derived)

| Rule | Where | Says |
|---|---|---|
| Later shelf | `shelfOf` | `start` after the upcoming weekend's end, **or** an open run (`until / through / thru / till / t/m` in `when`) whose `end` outlives it |
| Arrival pill | `arriving` | `start` within [today, weekend end], saved in an earlier week, and not already seen this week |
| Did you go? | `lookBack` | ended before today, within the last 21 days, unanswered — newest first |
| Week | `weekOf` | `floor(ms / 6.048e8)` — the same week number `taste.ts` scopes declines by |
| TTLs | `lib.ts` | token 15 min · exchange code 2 min · session 90 d · rate window 10 min |
| Caps | `sanitizeState` | 1000 saves · 4000 decline ids · 4000 taste tokens · 256 KB body; `link` kept only if `http(s)://` |

**KV layout:** `a:<sha256(email)>` record · `t:<token>` · `c:<code>` · `s:<session>` → account key ·
`st:<key>` the state · `rl:` / `rle:` the counters.

## Working model (how to iterate without mailing anyone)

```bash
cd worker/account && npx wrangler dev --port 8788 --var MAIL_PROVIDER:none --var APP_ORIGIN:http://localhost:5173
```
In the app (`cd app && bun run dev`) console: `localStorage['wkndr.account.url'] = 'http://localhost:8788'`,
reload. The link prints in the wrangler log (`[mail:none] … /auth/<token>`). A second device is a
`curl -X PUT /state` on the current version. The hidden preview tab is drivable headlessly (memory:
`wkndr-headless-verify`). Tests: `cd app && bun test tests/worker-account.test.ts tests/account.test.ts`.

## Traps (each cost real time on 27 Oct)

1. **workerd refuses an entry module that exports anything but handlers** ("Incorrect type for map
   entry 'CODE_TTL_S'"). Constants and rules stay in `src/lib.ts`; `src/index.ts` exports only `default`.
2. **The contract lives in two files.** `SaveEntry` / `AccountState` are mirrored in
   `worker/account/src/lib.ts` and `app/src/lib/account.ts`, and the worker's `sanitizeState` must keep
   every field the app snapshots — when it dropped `link`, every pull looked dirty and the version
   bumped on every load. Add a field in **both** places and in `sanitizeState`.
3. **Local wrangler KV is keyed by the namespace id.** Changing the id in `wrangler.toml` mid-session
   empties the dev store; the app then gets a 401 and signs out quietly. Designed, not a bug.
4. **Hard-coded ink on the panel.** `.sv-tabs` / `.sv-ask-btns` use `color: inherit` and the glass
   shell overrides them with `--pane-ink` (`GlassShell.css`); a hex there vanishes on the dark pane.

## Decided and NOT built (on purpose)

- **Email change** — sign out, sign in with the other address; saves stay on the device and merge.
- **Account deletion** — a `DELETE /me` is ~ten lines (record + sessions + state); write it the day
  a stranger asks, not before.
- **The Later split in the dev-only Itinerary list** — the saves panel is the surface.
- **Any role, board login or deck write** — the account is a per-person profile, nothing more.
- **The paid layer** — this is the free retention and data layer; the paid bet waits for the couples
  validation (`docs/backlog.md`).
- **Merging the three stores** — the brief's list and the account share a Resend key and domain,
  nothing else; subscribing to the brief does not make an account and vice versa.

## Open / known edges

- **Reset while signed in** (menu → Reset) empties the account's saves and taste too — write-through
  is honest about it, but the toast doesn't say so yet.
- **Session expiry** (90 d) and a dead session both sign out *quietly* (401 → session dropped, no
  toast). Fine for now; a one-line "signed out, tap to sign back in" is the obvious upgrade.
- **`went` is stored, not used.** moat.md §6 wants it to feed the taste profile / the weekly letter;
  nothing reads it yet beyond hiding the question.
- **No live two-device proof yet** with real mail (see Status). The first time a second phone signs
  in is the moment to watch the version counter.
- **Resend Free plan**: 100 mails/day shared with the brief; a sign-in storm would starve the Friday
  send. Revisit (Pro) once either list or sign-ins grow.

## Pointers

`worker/account/README.md` (deploy, API, state contract — the reference) · `CHANGELOG.md` V.12.2 ·
top-level `STATE.md` "Live right now" · `docs/moat.md` §6 (outcome data) · `docs/curation-surfaces.md`
§2 (who may write where) · `list/README.md` (the Resend account, DNS) · memory `wkndr-account-worker`.
