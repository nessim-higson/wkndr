/**
 * Version bumper — `bun run bump`.
 *
 * Scheme: V.<major>.<sub>. Each ship bumps the sub-counter:
 *   V.4 → V.4.1 → V.4.2 → … → V.4.19 → (rolls) → V.5 → V.5.1 → …
 * The sub runs 1–19; the twentieth iteration rolls to the next whole version and
 * resets. (Ran 1–9 through V.4.7 — widened 2026-06-11.)
 * Whole-version rolls (…→ V.5) are the moments to cut a milestone git tag (v5.0).
 *
 *   bun run bump            # normal sub bump (or roll at 20)
 *   bun run bump --major    # force a whole-version roll now (e.g. to stamp V.5 early)
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
if (forceMajor || sub >= 19) {
  next = `V.${major + 1}`                 // .19 (or --major) → roll to the next whole version
  rolled = true
} else {
  next = `V.${major}.${sub + 1}`          // ordinary sub bump (V.4 → V.4.1, V.4.1 → V.4.2, …)
}

await Bun.write(path, src.replace(/APP_VERSION = '[^']+'/, `APP_VERSION = '${next}'`))
console.log(`${cur} → ${next}${rolled ? `   ← whole-version roll: cut a milestone tag  (git tag v${major + 1}.0)` : ''}`)
