/* THE CURATOR'S PAGE (comp): /ams/<name>. The name, one line, the week, the picks in their order
   with their lines, and what the page becomes after Sunday: an archive that stays readable.
   Reads the curator from <html data-curator>. ?after=1 shows a live week as it will look once the
   week has ended. ?mine=1 shows the week the tool comp published in this browser. */
(() => {
  const C = window.COMP, U = window.CU, esc = U.esc
  const qs = new URLSearchParams(location.search)
  const slug = document.documentElement.dataset.curator
  let cur = C.curators.find((c) => c.slug === slug)
  let mine = false
  if (qs.get('mine') === '1') {
    try {
      const m = JSON.parse(localStorage.getItem('wkndr.guestcomp.published') || 'null')
      if (m && Array.isArray(m.picks)) { cur = { slug: m.slug, name: m.name, line: m.line, week: m.week, picks: m.picks, cut: m.cut || [], status: 'now' }; mine = true }
    } catch (e) { /* nothing published here */ }
  }
  const after = cur.status === 'past' || qs.get('after') === '1'
  const APP = '../../../../'   // the app, from /curate/guest-comp/ams/<name>/

  // what day it is, for the archive: a past week is judged from today; a live week shown "after"
  // is judged from the Monday following it
  const realToday = new Date(); realToday.setHours(0, 0, 0, 0)
  const monday = U.addDays(U.date(cur.week.sun), 1)
  const today = after && monday > realToday ? monday : realToday

  const pos = cur.name + (/s$/i.test(cur.name) ? "'" : "'s")
  const own = cur.picks.filter((p) => p.own).length

  /* the share link is the app's own: ?w=<codes>&from=<name> opens a named set of the picks that are
     in the feed (src/lib/share.ts shortCode). The curator's own finds need the lens to travel. */
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) } return h >>> 0 }
  const shortCode = (p) => fnv((p.venue + '|' + p.title).toLowerCase().replace(/[^a-z0-9]+/g, '')).toString(36).padStart(7, '0')
  const deckLink = APP + '?w=' + cur.picks.filter((p) => !p.own).map(shortCode).join(',') + '&from=' + encodeURIComponent(cur.name)

  function status(p) {
    if (!after) return ''
    if (p.until === 'open') return '<span class="p-state on">Still on</span>'
    if (p.until && U.date(p.until) >= today) { const d = U.date(p.until); return '<span class="p-state on">On until ' + d.getDate() + ' ' + U.MON[d.getMonth()] + '</span>' }
    return '<span class="p-state">Ended</span>'
  }
  const stillOn = cur.picks.filter((p) => p.until === 'open' || (p.until && U.date(p.until) >= today)).length

  function pickHTML(p, i) {
    const link = U.safeUrl(p.link)
    const title = link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(p.title) + '</a>' : esc(p.title)
    const meta = [p.when, p.venue !== p.title ? p.venue : ''].filter(Boolean).join(' · ')
    const trace = p.own
      ? 'Found by ' + esc(cur.name) + (link ? ' · <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(U.host(link)) + U.icon('out') + '</a>' : '')
      : 'via ' + esc(U.firstSource(p.source) || 'the feed') + (link ? ' · <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Event details' + U.icon('out') + '</a>' : '')
    return '<li class="p' + (after && !(p.until === 'open' || (p.until && U.date(p.until) >= today)) ? ' p--ended' : '') + '">'
      + '<div class="p-media">' + U.photo(p, 112, 140, 'p-ph', 12, 6) + '<span class="stamp p-n" aria-hidden="true">' + (i + 1) + '</span></div>'
      + '<div class="p-body">'
      + (p.own ? '<span class="signal">' + esc(pos) + ' find</span>' : '')
      + '<h2 class="p-title">' + title + '</h2>'
      + '<p class="p-meta">' + esc(meta) + status(p) + '</p>'
      + (p.why ? '<p class="p-why">' + esc(p.why) + '</p>' : '')
      + '<p class="p-trace">' + trace + '</p>'
      + '</div></li>'
  }

  const weekLabel = after ? 'Week of ' + U.date(cur.week.sat).getDate() + ' ' + U.MONTH[U.date(cur.week.sat).getMonth()] : 'This week'
  const html = '<section class="hero">'
    + '<p class="label">Guest curator · ' + esc(weekLabel) + '</p>'
    + '<h1 class="display">' + esc(pos) + ' week</h1>'
    + (cur.line ? '<p class="bio">' + esc(cur.line) + '</p>' : '')
    + '<p class="dates">' + esc(cur.week.long) + (!after && cur.week.temps ? ' <span>· ' + esc(cur.week.temps) + '</span>' : '') + '</p>'
    + (after
      ? '<div class="pane notice lines"><p>This week has ended.</p><p>' + esc(pos) + ' picks stay here.</p>' + (stillOn ? '<p>' + (stillOn === 1 ? '1 of them is still on.' : stillOn + ' of them are still on.') + '</p>' : '') + '</div>'
        + '<div class="cta"><a class="btn btn--accent btn--tall" href="../index.html">See this week</a><button class="btn btn--tall" type="button" id="share">' + U.icon('share') + 'Share</button></div>'
      : '<div class="cta"><a class="btn btn--accent btn--tall" href="' + esc(deckLink) + '">Swipe ' + esc(pos) + ' picks</a><button class="btn btn--tall" type="button" id="share">' + U.icon('share') + 'Share</button></div>')
    + '<p class="count">' + cur.picks.length + ' picks' + (own ? ', ' + own + ' of them ' + esc(pos) + ' own finds' : '') + '.</p>'
    + '</section><div class="col">'
    + '<ol class="picks" aria-label="' + esc(pos) + ' picks, in order">' + cur.picks.map(pickHTML).join('') + '</ol>'
    + '<section class="pane afterword lines">'
    + (after
      ? '<p>Every curated week stays here.</p><p>The house deck ranks this weekend by the weather.</p><a class="btn btn--ink btn--tall" href="' + APP + '">Open WKNDR</a>'
      : '<p>After ' + esc(pos) + ' picks the deck goes on in WKNDR\'s order.</p><p>Ranked for the weekend\'s weather.</p><a class="btn btn--ink btn--tall" href="' + esc(deckLink) + '">Swipe ' + esc(pos) + ' picks</a>')
    + '</section>'
    + '<footer class="pfoot"><a href="../index.html">All curators</a><a href="https://wkndr.xyz/">What WKNDR is</a></footer></div>'

  document.getElementById('page').innerHTML = html
  document.title = pos + ' week · WKNDR'
  if (mine) document.getElementById('mineNote').hidden = false

  const share = document.getElementById('share')
  share.addEventListener('click', async () => {
    const url = location.href.split('?')[0]
    if (navigator.share) { try { await navigator.share({ title: pos + ' week on WKNDR', url }); return } catch (e) { /* closed the sheet */ } }
    const ok = await U.copy(url)
    const t = document.getElementById('toast'); document.getElementById('toastText').textContent = ok ? 'Link copied.' : 'Could not copy the link.'
    t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2400)
  })
})()
