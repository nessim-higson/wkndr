// `bun run letter` — (re)write data/letter.<city>.json from the data already on disk.
//
// The publishers (refresh.ts, restamp.ts) write the letter themselves at the end of every run; this
// is the standalone door for two cases: the FIRST letter (there is no previous one to diff against,
// so `--prev=<an older picks.json>` lends a baseline — `git show <sha>:app/public/data/picks.amsterdam.json
// > /tmp/prev.json` is the usual source), and a board edit you want to check against real data
// without a 10-minute refresh. Reads picks/pending/candidates/ingest-health; touches nothing else.
//
//   bun run letter                          # rebuild against the previous letter (deltas since it)
//   bun run letter --prev=/tmp/prev.json    # first letter: diff against an older feed instead
//   bun run letter --city=amsterdam
import type { Pick } from '../src/types'
import { emitLetter } from './lib/letter'

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const CITY = arg('city') ?? 'amsterdam'
const OUT_DIR = `${import.meta.dir}/../public/data`

const feed = (await Bun.file(`${OUT_DIR}/picks.${CITY}.json`).json()) as { generatedAt: string; picks: Pick[] }
const pending = ((await Bun.file(`${OUT_DIR}/pending.${CITY}.json`).json().catch(() => null)) as { pending?: Pick[] } | null)?.pending ?? []
const prevPath = arg('prev')
const prevFeed = prevPath ? ((await Bun.file(prevPath).json()) as { generatedAt: string; picks: Pick[] }) : null
if (prevPath && (await Bun.file(`${OUT_DIR}/letter.${CITY}.json`).exists())) {
  console.log(`  --prev ignored: letter.${CITY}.json already exists and is the baseline (delete it to re-baseline)`)
}

const letter = await emitLetter(OUT_DIR, CITY, { generatedAt: feed.generatedAt, picks: feed.picks, pending, prevFeed })
if (!letter) process.exit(1)
const c = letter.counts
console.log(`✓ letter.${CITY}.json · ${letter.weekend.label} · front ${c.front} · ${c.live} live · ${c.held} held · changes: +${letter.changes.in.length} −${letter.changes.out.length} ~${letter.changes.moved.length} since ${letter.changes.since ?? 'never'} · ${letter.health.tag}: ${letter.health.text}`)
for (const [i, x] of letter.front.entries()) console.log(`  ${String(i + 1).padStart(2)}  ${x.title}  —  ${x.why}${x.image ? '' : '  (no photo)'}`)
