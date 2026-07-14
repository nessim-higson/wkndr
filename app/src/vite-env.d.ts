/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Canonical public origin for share links + unfurls, stamped at build time by
   *  vite.config's `define`. Set to https://app.wkndr.xyz in the domain build
   *  (WKNDR_DEPLOY=domain); empty on the GitHub Pages build + local dev, where share.ts
   *  falls back to the live location so old GH Pages links keep resolving. */
  readonly VITE_APP_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
