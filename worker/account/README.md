# WKNDR account — the first account layer

A Cloudflare Worker + KV, sibling to `/list` (the Friday brief) and `worker/curate/` (the board's
fast-lane), and deliberately its **own worker with its own namespace**: the relay keeps no identity
past 14 days, the list keeps an address until the person leaves, and this one keeps a person's saves
and taste for as long as they want an account. Three workers, three honest stories.

Ness, 2026-10-26: *"I want to look at having an account that I can log into and then have saved
events and things to do for the future."* Decided: **free, no passwords, no Google sign-in — a magic
link on the person's email**, mailed through the same Resend account the brief uses, with the list's
privacy posture: nothing exists until the link is tapped, and no endpoint ever says whether an
address is known. The account is **additive**: signed out, the app is exactly what it was.

## Status — 2026-10-27

| | |
|---|---|
| ✅ Worker + tests | `src/index.ts` (the handler) + `src/lib.ts` (the rules); `app/tests/worker-account.test.ts` drives the whole lifecycle against an in-memory KV |
| ✅ App | `app/src/lib/account.ts` (the merge, the shelf, the question) · `lib/useAccount.ts` (the sync loop) · `components/AccountSheet.tsx` · the Later tab + "did you go?" in the saves panel |
| ✅ Local proof | done 2026-10-27 with `wrangler dev` in `MAIL_PROVIDER=none`: link logged → followed → signed in → a save on one "device" → a second device's write through `PUT /state` → merged on reload (Later · 2, the arrival pill, the question) |
| ✅ Deployed | `https://wkndr-account.ness-13b.workers.dev` — KV namespace `ACCOUNT` `0b262e1cc80b4257b6f89d99305195e6`, in `wrangler.toml` (2026-10-27) |
| ✅ **`MAIL_API_KEY`** | set 2026-10-28 — a Resend key with *Sending access* restricted to `wkndr.xyz` (shared Resend team with AFF; the domain and key are WKNDR's own). First magic link delivered from `hello@wkndr.xyz` the same afternoon. Without it the worker still runs and `/login` answers `{ok:true, delivery:'off'}`; the sheet then says *"Sign-in mail isn't switched on yet"*. |

`MAIL_FROM` is `WKNDR <hello@wkndr.xyz>` — the same verified domain as the brief (the three DNS
records in list/README.md step 2 cover both).

## Deploy (once)

```bash
cd worker/account
npx wrangler kv namespace create ACCOUNT    # paste the printed id over REPLACE_WITH_KV_ID in wrangler.toml
npx wrangler deploy
npx wrangler secret put MAIL_API_KEY        # the Resend key — when you have it; everything else works without
```

The app points at `https://wkndr-account.ness-13b.workers.dev` (`ACCOUNT_URL` in
`app/src/lib/account.ts`). If wrangler prints a different origin, change that one constant.

## Local proof (no key, no mail)

```bash
cd worker/account
npx wrangler dev --port 8788 --var MAIL_PROVIDER:none --var APP_ORIGIN:http://localhost:5173
```

In the app (`cd app && bun run dev`), in the console: `localStorage['wkndr.account.url'] = 'http://localhost:8788'`
and reload. ≡ → Account → Sign in → the link prints in the wrangler terminal (`[mail:none] … /auth/<token>`);
open it; you land back on the app signed in. `GET /state` with the session (`localStorage['wkndr.account.v1']`)
shows what the app wrote; a `PUT /state` with another device's document comes back merged on the next load.

## API

| | |
|---|---|
| `POST /login` | `{email, return?, hp?}` → mints a one-time **15-minute** token, mails the link. Always `{ok:true}` for a well-formed address (`delivery:'off'` when no mail key is set — a fact about the deploy, not the address). `return` is honoured only for our own origins. Rate-limited: 10 per IP per 10 min (a plain 429), 3 per address per 10 min (answered as if mailed, and not — a 429 there would say which addresses are being hammered). |
| `GET /auth/<token>` | consumes the token, creates the account record (on the tap, never on the form), mints a **90-day session** and a **2-minute one-time exchange code**, and redirects to the app with `#signin=<code>`. The session itself never rides in a URL. |
| `POST /session` | `{code}` → `{session, email, since}`. One swap. |
| `GET /me` | `{email, since}` — `authorization: Bearer <session>` |
| `GET /state` | the account's state, or an empty `version: 0` one |
| `PUT /state` | `{version, state}` → **200** `{version, updatedAt}` when `version` matches the stored one (last write wins, then bumps) · **409** `{version, state}` when another device wrote first: the app merges (`lib/account.ts mergeState`) and retries on the returned version. The worker only refuses to clobber; it never merges. |
| `POST /logout` | deletes the session |

## The state

```
{ version, updatedAt,
  saves:    [{id, title, when, at, start?, end?, link?}]   // snapshots, so a save outlives the weekly feed
  declines: {w, ids}                                        // this week's swiped-past ids
  taste:    {token: weight}                                 // the per-person profile — never the deck
  later:    {id: {seen?}}                                   // the arrival pill's "seen this week"
  went:     {id: {went, at}} }                              // DID YOU GO? — the first outcome data (moat.md §6)
```

**The merge** (app side, tested in `app/tests/account.test.ts`): saves union (the earlier save moment
wins, missing dates fill in); declines union within a week, else the newer week's; taste is the more
recently updated document's, plus any token only the other knew — never summed, so merging twice is a
no-op; an answer is deliberate, the later one wins.

**KV layout:** `a:<sha256(email)>` the record · `t:<token>` login token (15 min) · `c:<code>` exchange
code (2 min) · `s:<session>` → account key (90 d) · `st:<key>` the state · `rl:` / `rle:` the counters.
Addresses are hashed in keys so a listing never spills them; the record holds the plaintext because we
have to mail it.

## What it is NOT

- Not a login for the Curation Board, not a role, not a way to write to the deck
  (`docs/curation-surfaces.md` §2 — the taste profile stays per person).
- Not the paid layer. Free: it is the retention and data layer; the paid bet waits for the couples
  validation (`docs/backlog.md`).
- Not a merge of the three stores. The brief's list and this account share a Resend key and a sending
  domain, nothing else — subscribing to the brief does not make an account and vice versa.
