// The live build version — BUMPED ON EVERY SHIP.
// Shown in the menu footer, and used verbatim as the ?v= in the link we share
// (e.g. https://nessim-higson.github.io/wkndr/?v=2.0.0) so the URL is the version,
// confirms freshness, and busts the cache in one. Milestone git tags are cut
// separately at notable points.
//
// NAMING: the frozen landmark build is V.1 (served at /wkndr/v1/). Everything in
// this current line of work is V.2 — hence the 2.x major. `-devN` counts the
// in-progress iterations within V.2 before it's stamped a clean 2.0.0.
export const APP_VERSION = '2.0.0-dev26'
