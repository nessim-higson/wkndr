#!/usr/bin/env node
/**
 * META SETUP CHECKER — run this after each step of the Instagram setup.
 *
 *   node meta-check.mjs <TOKEN> [target-account]
 *
 * Walks the exact chain business_discovery needs and says which link is broken:
 *   token valid?  →  Page?  →  Page linked to an IG professional account?
 *   →  can it read another account by username?  →  do the fields we need come back?
 *
 * That last check is the one that matters and the one Meta's docs don't answer:
 * they show like_count / comments_count under business_discovery but never confirm
 * caption / media_url / permalink / timestamp. Those four are what a WKNDR pick is
 * made of — without them the watcher can detect posts but not build cards.
 *
 * Nothing is written anywhere. Read-only, safe to run repeatedly.
 */

const V = 'v21.0'
const G = `https://graph.facebook.com/${V}`
const [, , TOKEN, TARGET = 'doubleamagazine'] = process.argv

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

if (!TOKEN) {
  console.log('usage: node meta-check.mjs <TOKEN> [target-account]')
  process.exit(1)
}

async function get(path) {
  const url = `${G}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(TOKEN)}`
  const r = await fetch(url)
  const j = await r.json().catch(() => ({}))
  return { status: r.status, j }
}

function explain(err) {
  const m = err?.message ?? 'unknown error'
  const code = err?.code
  if (code === 190) return 'The token is invalid or expired. Generate a new one.'
  if (code === 200 || /permission/i.test(m)) {
    return 'The token is missing a permission. It needs instagram_basic, pages_show_list and pages_read_engagement.'
  }
  if (code === 100 && /nonexisting field|Unsupported get request/i.test(m)) {
    return 'That object exists but this token cannot see it — usually the Page is not linked to the app or the system user has no role on it.'
  }
  if (code === 4 || code === 17 || code === 32) return 'Rate limited. Wait a few minutes and retry.'
  return m
}

;(async () => {
  console.log(`\nChecking a Meta token against Graph ${V}\n${'─'.repeat(58)}`)

  // 1. is the token even valid, and what is it?
  const me = await get('me?fields=id,name')
  if (me.j.error) {
    console.log(bad('Token rejected'))
    console.log(dim('   ' + explain(me.j.error)))
    process.exit(1)
  }
  console.log(ok(`Token works — identity: ${me.j.name ?? me.j.id}`))

  // 2. what permissions does it actually carry?
  const dbg = await get(`debug_token?input_token=${encodeURIComponent(TOKEN)}`)
  const scopes = dbg.j?.data?.scopes
  if (Array.isArray(scopes)) {
    const need = ['instagram_basic', 'pages_show_list', 'pages_read_engagement']
    const missing = need.filter((s) => !scopes.includes(s))
    console.log(missing.length ? bad(`Missing permission(s): ${missing.join(', ')}`)
                               : ok('All required permissions present'))
    console.log(dim(`   has: ${scopes.join(', ')}`))
    const exp = dbg.j.data.expires_at
    console.log(dim(exp === 0 || exp === undefined
      ? '   never expires (system user token — good for a cron)'
      : `   EXPIRES ${new Date(exp * 1000).toISOString().slice(0, 10)} — a cron will break then. Prefer a system user token.`))
  }

  // 3. a Page
  const pages = await get('me/accounts?fields=id,name,instagram_business_account')
  const list = pages.j?.data ?? []
  if (pages.j.error || !list.length) {
    console.log(bad('No Facebook Page visible to this token'))
    console.log(dim('   ' + (pages.j.error ? explain(pages.j.error)
      : 'Create a Page, or give this system user a role on the existing one.')))
    process.exit(1)
  }
  console.log(ok(`Found ${list.length} Page(s): ${list.map((p) => p.name).join(', ')}`))

  // 4. a Page with an Instagram professional account attached
  const linked = list.find((p) => p.instagram_business_account?.id)
  if (!linked) {
    console.log(bad('No Page has an Instagram professional account linked'))
    console.log(dim('   In the Instagram app: Settings → Account type → switch to Professional,'))
    console.log(dim('   then link it to your Facebook Page. This is the step people miss.'))
    process.exit(1)
  }
  const IGID = linked.instagram_business_account.id
  console.log(ok(`Instagram professional account linked to "${linked.name}" — IG user id ${IGID}`))

  // 5. THE REAL TEST — read someone else's public account, with the fields a card needs
  const fields = 'business_discovery.username(' + TARGET + '){username,followers_count,media_count,' +
    'media.limit(5){id,caption,media_url,permalink,timestamp,media_type,like_count,comments_count}}'
  const bd = await get(`${IGID}?fields=${encodeURIComponent(fields)}`)
  if (bd.j.error) {
    console.log(bad(`business_discovery on @${TARGET} failed`))
    console.log(dim('   ' + explain(bd.j.error)))
    console.log(dim('   If @' + TARGET + ' is a personal account, it is invisible to this API by design.'))
    process.exit(1)
  }
  const d = bd.j.business_discovery
  console.log(ok(`Read @${d.username} — ${d.followers_count} followers, ${d.media_count} posts`))

  const media = d.media?.data ?? []
  if (!media.length) {
    console.log(bad('No media returned — nothing to build cards from'))
    process.exit(1)
  }

  console.log(`\n${'─'.repeat(58)}\nDo the fields a WKNDR pick needs come back?\n`)
  const need = ['caption', 'media_url', 'permalink', 'timestamp']
  const m0 = media[0]
  let allGood = true
  for (const f of need) {
    const has = m0[f] !== undefined && m0[f] !== null
    if (!has) allGood = false
    console.log(has ? ok(f) : bad(`${f} — NOT returned`))
  }

  console.log(`\n${dim('most recent post:')}`)
  console.log(dim(`  ${m0.timestamp ?? '?'}  ${m0.media_type ?? ''}`))
  console.log(dim(`  ${(m0.caption ?? '(no caption)').replace(/\s+/g, ' ').slice(0, 90)}`))
  console.log(dim(`  ${m0.permalink ?? '(no permalink)'}`))

  console.log(`\n${'─'.repeat(58)}`)
  console.log(allGood
    ? ok('READY. The watcher can be built against this token.')
    : bad('Partial. Detection works, but cards need the missing field(s) — ' +
          'fall back to running each permalink through /drop.'))
  console.log()
})()
