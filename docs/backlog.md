# WKNDR — backlog (parked, deliberate)

Things noted but intentionally deferred, so they're not lost.

## From partner feedback (2026-06-03)

### 1. Weather framing: today vs. the weekend ahead
The weather readout currently describes **today**, but the app's whole premise is the
**forthcoming weekend** — the mismatch reads as confusing. Reconcile so the weather shown
is the weekend's outlook (e.g. "Sat–Sun" forecast, or "this weekend looks…"), not the
current hour. Open question: how to handle mid-week vs. weekend (show the *next* weekend's
forecast and label it clearly). Touches: weather/modes.ts (classify uses today's daily),
App.goLive (fetches forecast_days=1 → widen to the weekend window), the topbar + InputsSheet
copy, and the intro line.

### 2. Cards: richer, fan-like, more on click
Make the list/stack cards look more like the **fan** cards (full-bleed, image-led, bolder),
and surface **more information on click** (the detail). Specifically:
- **Hero the date** on the initial card (date/time prominent, not buried in metadata).
- Add a **"Closing soon" / scarcity** flag on the card when relevant (we already compute
  `freshness: 'ending'` and `status` — surface them as a badge).
- Detail view: more depth on tap.

(Both are post-v1.0 polish — the engine + content pipeline come first.)
