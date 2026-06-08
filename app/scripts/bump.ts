/**
 * Version bumper — `bun run bump`.
 *
 * Scheme: V.<major>.<sub>. Each ship bumps the sub-counter:
 *   V.3 → V.3.1 → V.3.2 → … → V.3.9 → (rolls) → V.4 → V.4.1 → …
 * The sub runs 1–9; the tenth iteration rolls to the next whole version and resets.
 * Whole-version rolls (…→ V.4) are the moments to cut a milestone git tag (v4.0).
 *
 *   bun run bump            # normal sub bump (or roll at 10)
 *   bun run bump --major    # force a whole-version roll now (e.g. to stamp V.4 early)
 */
const path = `${import.meta.dir}/../src/version.ts`
const src = await Bun.file(path).text()
const m = src.match(/APP_VERSION = '([^']+)'/)
if (!m) throw new Error('APP_VERSION not found in version.ts')

const cur = m[1]
const v = cur.match(/^V\.(\d+)(?:\.(\d+))?$/)
if (!v) throw new Error(`version "${cur}" is not in V.<major>[.<sub>] form — fix version.ts first`)

const major = Number(v[1])
const sub = v[2] ? Number(v[2]) : 0
const forceMajor = process.argv.includes('--major')

let next: string
let rolled = false
if (forceMajor || sub >= 9) {
  next = `V.${major + 1}`                 // .9 (or --major) → roll to the next whole version
  rolled = true
} else {
  next = `V.${major}.${sub + 1}`          // ordinary sub bump (V.3 → V.3.1, V.3.1 → V.3.2, …)
}

await Bun.write(path, src.replace(/APP_VERSION = '[^']+'/, `APP_VERSION = '${next}'`))
console.log(`${cur} → ${next}${rolled ? `   ← whole-version roll: cut a milestone tag  (git tag v${major + 1}.0)` : ''}`)
