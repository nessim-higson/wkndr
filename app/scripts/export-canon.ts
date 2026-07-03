// EXPORT CANON → public/data/canon.amsterdam.json
//
// The Curation Board (public/curate/, vanilla JS) can't import the app's TS data modules — but the
// "IN ROTATION" tab must show the APPROVED LIBRARY: every static pick the app can serve (the canon
// floor + Ness's board-approved canon2). This dumps them all to JSON, grouped source-of-truth-first.
// Runs as part of `bun run build` (package.json) so the file can never drift from the code.
import { CITIES } from '../src/data/cities'

const ams = CITIES.find((c) => c.key === 'amsterdam')!
const rows = ams.picks.map((p) => ({
  id: p.id, title: p.title, venue: p.venue, area: p.area, when: p.when, category: p.category,
  image: p.image, blurb: p.blurb, link: p.link, price: p.price, tier: (p as { tier?: string }).tier,
  approved: p.id.startsWith('ams-ev2-'),   // canon2 = Ness's board-approved half
}))
await Bun.write('public/data/canon.amsterdam.json', JSON.stringify({
  generatedAt: 'build-time', count: rows.length, canon: rows,
}, null, 2))
console.log(`export-canon: ${rows.length} rotation picks → public/data/canon.amsterdam.json (${rows.filter((r) => r.approved).length} Ness-approved)`)
