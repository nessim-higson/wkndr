import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// TWO deploy targets, one build:
//   • GitHub Pages (default)         → served under /wkndr/ ; unfurl + share origin = the Pages URL.
//     OLD share links in the wild live here, so this build must never stop resolving them.
//   • Cloudflare Pages (the domain)  → WKNDR_DEPLOY=domain → served at / on app.wkndr.xyz ;
//     unfurl + share origin = the canonical https://app.wkndr.xyz.
// Local dev always serves at / .
const DOMAIN_ORIGIN = 'https://app.wkndr.xyz'
const PAGES_ORIGIN = 'https://nessim-higson.github.io/wkndr'

/** The unfurl image for the weekend this build serves. Platforms (WhatsApp, iMessage, Slack, X)
 *  cache an unfurl BY URL, so a fixed filename would keep serving an old card long after the picks
 *  changed — this repo already hit that once (see the og-app.png note in index.html). The poster
 *  script writes `share/og-<saturday>.png` on the same weekly cron, and this stamps the SAME name
 *  into the tag, so the file and the tag can never drift. Mirrors pipeline.ts upcomingWeekend(). */
function ogImagePath(now = new Date()): string {
  // EXACT mirror of pipeline.ts upcomingWeekend(): on a SUNDAY the weekend's Saturday was YESTERDAY.
  // The first cut used "the next Saturday", which on a Sunday pointed a week ahead — at a file the
  // poster hadn't written yet, so every link pasted on a Sunday would have unfurled with no image.
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = d.getDay()                                 // 0 Sun … 6 Sat
  if (dow === 0) d.setDate(d.getDate() - 1)              // Sun → this weekend's Sat was yesterday
  else if (dow !== 6) d.setDate(d.getDate() + (6 - dow)) // Mon–Fri → the next Saturday
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `/share/og-${key}.png`
}

export default defineConfig(({ command }) => {
  const domain = process.env.WKNDR_DEPLOY === 'domain'
  const ogOrigin = domain ? DOMAIN_ORIGIN : PAGES_ORIGIN
  return {
    base: command === 'build' ? (domain ? '/' : '/wkndr/') : '/',
    define: {
      // share.ts stamps links with this when set; '' ⇒ fall back to the live location, so the
      // GH Pages build keeps emitting Pages links and dev keeps emitting localhost links.
      'import.meta.env.VITE_APP_ORIGIN': JSON.stringify(domain ? DOMAIN_ORIGIN : ''),
    },
    plugins: [
      react(),
      {
        // stamp the absolute unfurl origin into index.html at build time (og:/twitter:/icons).
        // `order: 'pre'` runs before Vite's own HTML/asset pass so it never sees the raw
        // %OG_ORIGIN% token (the `%` breaks Vite's decodeURI on href/src attributes).
        name: 'wkndr-og-origin',
        transformIndexHtml: {
          order: 'pre',
          handler(html: string) {
            return html
              .replaceAll('%OG_ORIGIN%', ogOrigin)
              .replaceAll('%OG_IMAGE%', ogImagePath())
          },
        },
      },
    ],
    server: { port: Number(process.env.PORT) || 5173 },
  }
})
