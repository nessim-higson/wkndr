// WKNDR — THE FRIDAY SEND, unattended. Run by .github/workflows/friday.yml after `bun run brief`.
//
//   bun run list/scripts/friday.ts            # send list/out/brief.html to every confirmed subscriber
//   bun run list/scripts/friday.ts --dry      # everything but the send: guards, audience, the worker's answer
//
// Ness, 22 Nov 2026: "I'd like to begin receiving email blasts on what's happening every weekend."
// send.ts stays the by-hand door (read the draft, edit a line, send it); this is the one that runs when
// nobody is at the laptop. It holds no mail key — the worker does (POST /blast) — only ADMIN_KEY.
//
// It refuses, loudly (exit 1, so the failed run mails Ness), rather than send something wrong:
//   · a brief written from a feed whose weekend is already over (Thursday's refresh did not publish);
//   · a brief for a weekend that is not the one coming (or the one under way);
//   · a draft with no picks, no subject, or over Gmail's clip.
// The worker refuses the rest: a second send for the same weekend (409) is reported and exits 0.

const LIST_URL = process.env.LIST_URL || 'https://wkndr-list.ness-13b.workers.dev'
const ADMIN_KEY = process.env.ADMIN_KEY || ''
const OUT = `${import.meta.dir}/../out`
const dry = process.argv.includes('--dry')

export interface Receipt { saturday: string | null; subject: string; stale: boolean; template: string; picks: number; forecast: boolean }

/** Is this draft sendable today? Returns the reason it is not, or null. Pure — tested with fixed clocks. */
export function refusal(r: Receipt, htmlBytes: number, now: Date): string | null {
  if (!r.saturday || !/^\d{4}-\d{2}-\d{2}$/.test(r.saturday)) return 'the draft names no weekend'
  if (r.stale) return `the feed is for ${r.saturday}, already past — Thursday's refresh did not publish a new weekend`
  if (!r.subject?.trim()) return 'the draft has no subject'
  if (r.picks < 3) return `only ${r.picks} picks — too thin to send`
  if (htmlBytes > 100_000) return `${(htmlBytes / 1024).toFixed(1)} KB — Gmail clips past 102 KB and hides the unsubscribe link`
  if (htmlBytes < 2_000) return 'the draft is nearly empty'
  // the weekend must be the coming one or the one under way: Saturday no more than 6 days ahead,
  // Sunday not yet over (dates compared as Amsterdam calendar days)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(now)   // YYYY-MM-DD
  const days = Math.round((Date.parse(`${r.saturday}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 864e5)
  if (days > 6) return `the draft is for ${r.saturday}, ${days} days out — not this weekend`
  if (days < -1) return `the draft is for ${r.saturday}, which is over`
  return null
}

if (import.meta.main) {
  const receipt = JSON.parse(await Bun.file(`${OUT}/brief.json`).text()) as Receipt
  const html = await Bun.file(`${OUT}/brief.html`).text()
  const why = refusal(receipt, Buffer.byteLength(html, 'utf8'), new Date())
  console.log(`\n  WKNDR Friday send${dry ? ' · DRY RUN' : ''}`)
  console.log(`  weekend   ${receipt.saturday} · template ${receipt.template} · ${receipt.picks} picks · ${receipt.forecast ? 'with forecast' : 'NO forecast'}`)
  console.log(`  subject   ${receipt.subject}`)
  if (why) { console.error(`\n  ✖ NOT SENT — ${why}\n`); process.exit(1) }
  if (!ADMIN_KEY) { console.error('\n  ✖ NOT SENT — ADMIN_KEY not set (repo secret LIST_ADMIN_KEY)\n'); process.exit(1) }

  const res = await fetch(`${LIST_URL}/blast`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ key: receipt.saturday, subject: receipt.subject, html, dry }),
  })
  const out = await res.json().catch(() => ({})) as { ok?: boolean; sent?: number; failed?: number; audience?: number; already?: { at: number; sent: number } | null; error?: string }
  if (res.status === 409) { console.log(`  already   this weekend went out ${new Date(out.already?.at ?? 0).toISOString()} to ${out.already?.sent} — nothing sent twice\n`); process.exit(0) }
  if (!res.ok) { console.error(`\n  ✖ the worker answered ${res.status}: ${JSON.stringify(out)}\n`); process.exit(1) }
  if (dry) console.log(`  audience  ${out.audience} confirmed${out.already ? ` · already sent this weekend (${out.already.sent})` : ''}\n  nothing sent.\n`)
  else if (!out.audience) console.log('  audience  0 confirmed — nobody to send to yet (sign up at wkndr.xyz and click the confirm mail)\n')
  else console.log(`  sent      ${out.sent}/${out.audience}${out.failed ? ` · ${out.failed} FAILED` : ''}\n`)
  if (out.failed) process.exit(1)
}
