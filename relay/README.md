# WKNDR relay

WKNDR's first backend — a ~120-line Cloudflare Worker + KV that closes the **boomerang**
without the manual link-back. Born from a field failure (2026-07-11): the partner finished
her match round and never sent the link back, so the sender never saw the matches.

## What it does

- The share sheet mints a random **round id** and rides it on the invite link (`&r=abc123…`).
- The recipient's app **POSTs their matches** here under that id as they swipe (and flags
  `done` when the round completes).
- The sender's app **polls GET** on boot / every 45s / on tab-return while a sent round is
  pending, and when matches land it jumps straight to the same `?w=…&m=1` "it's a match"
  greeting the manual link-back produces.
- Optionally, the first `done` POST forwards a one-line ping to Formspree
  ("Sanne finished a match round: 4 matches") — same endpoint as the feedback widget.

**Privacy posture:** no accounts, no cookies, nothing logged. A round is only short
pick-codes + a first name, stored under an unguessable id, auto-deleted after **14 days**.
The manual "Send your matches" button stays as the fallback whenever the relay is off or
unreachable.

## API

```
POST /r/<id>   {"codes":["1a2b3c4","..."],"name":"Sanne","done":true}   → {"ok":true}
GET  /r/<id>                                                            → {"codes":[…],"name":"Sanne","done":true,"at":1752234567890} | 404
```

Ids are `[a-z0-9]{6,24}`; codes are the app's short pick-codes (`app/src/lib/share.ts`).
CORS is open — the unguessable id is the secret, not the origin.

## Deploy (3 commands, from this directory)

```sh
npx wrangler login                        # 1. once — opens the browser to your CF account
npx wrangler kv namespace create ROUNDS   # 2. once — paste the printed id into wrangler.toml
npx wrangler deploy                       # 3. every change — prints the live URL
```

Step 3 prints the worker URL, e.g. `https://wkndr-relay.<your-subdomain>.workers.dev`.

## Turn it on in the app

Paste that URL into `RELAY_URL` in `app/src/lib/relay.ts`, then ship the app
(`cd app && bun run bump && bun run build`, commit, push). While `RELAY_URL` is `''`
the entire relay path is a no-op — links carry no `&r=`, nothing is posted or polled.

## Smoke test

```sh
curl -X POST https://<worker-url>/r/test0round -H 'content-type: application/json' \
  -d '{"codes":["1a2b3c4"],"name":"Test","done":true}'
curl https://<worker-url>/r/test0round
```

The GET should echo the round back (and the `done:true` should land one Formspree email).
