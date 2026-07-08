// FUNNEL METRICS — privacy-light GoatCounter beacon (no cookies, no fingerprinting, EU-hosted;
// no consent banner needed). Exists to fill docs/validation-log.md's columns with NUMBERS:
// opened? → 'link-open' · finished/matched? → 'match-slam' · sent back? → 'plan-sent' ·
// round-trip landed? → 'return-leg'. Pageviews come free from count.js; the events below are the
// funnel. DORMANT until SITE is set (create the site at goatcounter.com, paste its code here) —
// with it empty every call is a no-op, so this ships safely ahead of the account.
const SITE = ''   // e.g. 'wkndr' → counts to https://wkndr.goatcounter.com

declare global {
  interface Window {
    goatcounter?: { count: (v: { path: string; title?: string; event?: boolean }) => void }
  }
}

export function initMetrics() {
  if (!SITE || document.querySelector('script[data-goatcounter]')) return
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://gc.zgo.at/count.js'
  s.setAttribute('data-goatcounter', `https://${SITE}.goatcounter.com/count`)
  document.head.appendChild(s)
}

/** Fire a named funnel event ('link-open', 'first-swipe', 'save', 'match-slam', 'plan-sent',
 *  'return-leg', 'intent-yes'/'intent-no'). Fire-and-forget; one retry if count.js is still loading. */
export function track(event: string) {
  if (!SITE) return
  const send = () => window.goatcounter?.count({ path: event, event: true })
  if (window.goatcounter) send()
  else setTimeout(send, 2500)
}
