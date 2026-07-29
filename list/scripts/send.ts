// WKNDR — the Friday send. Deliberately a SCRIPT you run, not a cron that fires.
//
// The whole premise of the Friday brief is that it's hand-crafted after you've seen what
// Thursday's pipeline run actually produced. Automating the send would quietly turn it back
// into the Thursday robot digest it isn't. You write the file, you read it back, you send it.
//
//   bun run list/scripts/send.ts brief.html --subject "Rain Saturday. Here's where to be."
//   bun run list/scripts/send.ts brief.html --subject "…" --send      # actually sends
//
// Without --send it's a DRY RUN: prints the recipient count, the subject, and the first
// rendered email to stdout. Default-dry is on purpose — an accidental blast is unrecoverable.
//
// Env: LIST_URL (the worker origin) + ADMIN_KEY + MAIL_API_KEY. Keep them in list/.env (gitignored).

const LIST_URL = process.env.LIST_URL || 'https://wkndr-list.ness-13b.workers.dev'
const ADMIN_KEY = process.env.ADMIN_KEY || ''
const MAIL_API_KEY = process.env.MAIL_API_KEY || ''
const MAIL_FROM = process.env.MAIL_FROM || 'WKNDR <friday@wkndr.xyz>'
const BATCH = 100          // Resend's batch endpoint cap

interface Sub { email: string; unsubToken: string; src: string }

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null
}

/** The unsub link is per-recipient, so the body is rendered per-recipient. `{{unsub}}` anywhere
 *  in the brief becomes that person's one-click link; the footer is appended if you forgot it. */
function render(html: string, sub: Sub): string {
  const link = `${LIST_URL}/unsub/${sub.unsubToken}`
  const body = html.includes('{{unsub}}')
    ? html.replaceAll('{{unsub}}', link)
    : html + `\n<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e7e3d8;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#8b8a82">
  You're getting this because you asked for the WKNDR Friday brief.
  <a href="${link}" style="color:#8b8a82">Unsubscribe</a> — one click, no questions.
</div>`
  return body
}

async function main() {
  const file = process.argv[2]
  const subject = arg('--subject')
  const live = process.argv.includes('--send')

  if (!file || !subject) {
    console.error('usage: send.ts <brief.html> --subject "…" [--send]')
    process.exit(1)
  }
  if (!ADMIN_KEY) { console.error('ADMIN_KEY not set'); process.exit(1) }

  const html = await Bun.file(file).text()

  const res = await fetch(`${LIST_URL}/export`, { headers: { authorization: `Bearer ${ADMIN_KEY}` } })
  if (!res.ok) { console.error(`export failed: ${res.status}`); process.exit(1) }
  const { subs } = (await res.json()) as { count: number; subs: Sub[] }

  console.log(`\n  WKNDR Friday brief`)
  console.log(`  subject   ${subject}`)
  console.log(`  file      ${file} (${html.length} bytes)`)
  console.log(`  audience  ${subs.length} confirmed`)
  const bySrc = subs.reduce<Record<string, number>>((a, s) => ({ ...a, [s.src]: (a[s.src] || 0) + 1 }), {})
  console.log(`  sources   ${Object.entries(bySrc).map(([k, v]) => `${k}:${v}`).join('  ') || '—'}`)

  if (!subs.length) { console.log('\n  Nobody to send to. Stopping.\n'); return }

  if (!live) {
    console.log(`\n  DRY RUN — nothing sent. Re-run with --send to blast.`)
    console.log(`  ─── first rendered email ${'─'.repeat(40)}\n`)
    console.log(render(html, subs[0]).slice(0, 1200) + (html.length > 1200 ? '\n  …' : ''))
    console.log(`\n  ${'─'.repeat(64)}\n`)
    return
  }

  if (!MAIL_API_KEY) { console.error('MAIL_API_KEY not set'); process.exit(1) }

  let sent = 0, failed = 0
  for (let i = 0; i < subs.length; i += BATCH) {
    const chunk = subs.slice(i, i + BATCH)
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { authorization: `Bearer ${MAIL_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(chunk.map(s => ({
        from: MAIL_FROM,
        to: s.email,
        subject,
        html: render(html, s),
        // List-Unsubscribe is what makes Gmail show a native unsubscribe button instead of
        // offering "report spam" — the single highest-leverage deliverability header there is.
        headers: {
          'List-Unsubscribe': `<${LIST_URL}/unsub/${s.unsubToken}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }))),
    })
    if (r.ok) { sent += chunk.length; console.log(`  sent ${sent}/${subs.length}`) }
    else { failed += chunk.length; console.error(`  batch failed ${r.status}: ${await r.text().catch(() => '')}`) }
  }
  console.log(`\n  Done — ${sent} sent, ${failed} failed.\n`)
}

main()
