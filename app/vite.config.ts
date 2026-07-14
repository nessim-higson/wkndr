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
            return html.replaceAll('%OG_ORIGIN%', ogOrigin)
          },
        },
      },
    ],
    server: { port: Number(process.env.PORT) || 5173 },
  }
})
