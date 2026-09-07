// WHERE THE DATA COMES FROM (V.11.10 / the prototype protocol). By default the app reads the feed
// files committed next to it (`/data/picks.<city>.json`, written by the cron). A build may point them
// at another origin with `VITE_DATA_ORIGIN` (trailing slash) — the branch-preview workflow builds
// every `codex/**` / `proto/**` branch with `VITE_DATA_ORIGIN=https://app.wkndr.xyz/`, so a
// variation always shows THIS week's real cards however stale its own branch's data files are.
// Production leaves it unset. `app/public/_headers` opens CORS on /data/* for exactly this.
export function dataBase(): string {
  const origin = (import.meta.env.VITE_DATA_ORIGIN as string | undefined) || ''
  return origin || import.meta.env.BASE_URL
}
export const dataUrl = (file: string): string => `${dataBase()}data/${file}`
