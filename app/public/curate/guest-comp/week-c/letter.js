/* DIRECTION C (comp): the week as a letter. Entries with an open line each. Move, remove, add,
   write, send. State lives in this browser only. Same ?name= and ?live= handles as direction A. */
(() => {
  const C = window.COMP, U = window.CU, esc = U.esc
  const qs = new URLSearchParams(location.search)
  const sample = C.curators.find((c) => c.slug === 'sanne')
  const named = (qs.get('name') || '').replace(/[<>]/g, '').trim().slice(0, 24)
  const NAME = named || sample.name
  const SLUG = NAME.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'you'
  const MAX_OWN = 5, MIN_PICKS = 5, WHY_MAX = 140
  const $ = (id) => document.getElementById(id)
  let WEEK = C.week, FLOOR = C.front, KEY = '', S = null
  const ui = { day: '', image: '', pub: 'ask', opener: null }

  const fresh = () => ({ list: FLOOR.map((p) => Object.assign({}, p)), cut: [], line: named ? '' : sample.line, pub: null })
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { /* private mode */ } }
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && Array.isArray(s.list) && Array.isArray(s.cut) ? s : null } catch (e) { return null } }
  const ownCount = () => S.list.filter((p) => p.own).length
  const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  const sig = () => JSON.stringify([S.line, S.list.map((p) => [p.id, p.why || ''])])
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many)
  const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }

  // ─── the entries ────────────────────────────────────────────────────────────────────────
  function entryHTML(p, i, n) {
    const link = U.safeUrl(p.link)
    const words = String(p.title).split(' '), last = words.pop()
    const title = link
      ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(words.join(' ')) + (words.length ? ' ' : '') + '<span class="nb">' + esc(last) + U.icon('out') + '</span><span class="sr"> (opens the page)</span></a>'
      : esc(p.title)
    const meta = [p.when, p.venue !== p.title ? p.venue : ''].filter(Boolean).join(' · ')
    return '<li class="entry" data-id="' + esc(p.id) + '">'
      + '<div class="side"><span class="n" aria-hidden="true">' + (i + 1) + '</span>' + U.photo(p, 56, 70, '', 8, 4) + '</div>'
      + '<div class="main">' + (p.own ? '<span class="own label">Yours</span>' : '')
      + (meta ? '<p class="meta">' + esc(meta) + '</p>' : '') + '<h2 class="title">' + title + '</h2>'
      + '<label><span class="sr">Your line for ' + esc(p.title) + (p.own ? ', needed' : ', optional') + '</span>'
      + '<textarea class="line' + (p.why ? ' has' : '') + (p.own ? ' needs' : '') + '" rows="1" maxlength="' + WHY_MAX + '" placeholder="' + (p.own ? 'Why you would go. This one needs a line.' : 'Say why, or leave it.') + '">' + esc(p.why || '') + '</textarea></label>'
      + '<p class="count" hidden><span class="n2">0</span> / ' + WHY_MAX + '</p>'
      + '</div>'
      + '<div class="tools">'
      + '<button class="tool mv" type="button" data-dir="-1" aria-label="Move ' + esc(p.title) + ' up"' + (i === 0 ? ' disabled' : '') + '>' + U.icon('up') + '</button>'
      + '<button class="tool mv" type="button" data-dir="1" aria-label="Move ' + esc(p.title) + ' down"' + (i === n - 1 ? ' disabled' : '') + '>' + U.icon('down') + '</button>'
      + '<button class="tool rm" type="button" aria-label="Remove ' + esc(p.title) + ' from your week">' + U.icon('x') + '</button>'
      + '</div></li>'
  }
  const rowEl = (id) => [...$('entries').children].find((el) => el.dataset.id === id)
  function renderList() {
    const n = S.list.length
    $('entries').innerHTML = S.list.map((p, i) => entryHTML(p, i, n)).join('')
    $('entries').querySelectorAll('textarea').forEach(grow)
  }
  function renderCut() {
    $('cutbox').hidden = !S.cut.length
    $('cutlist').innerHTML = S.cut.map((c) => '<div class="cutrow" data-id="' + esc(c.pick.id) + '"><span>' + esc(c.pick.title) + '</span><button class="btn act-back" type="button">Put back<span class="sr"> ' + esc(c.pick.title) + '</span></button></div>').join('')
  }
  function renderBar() {
    const n = S.list.length, own = ownCount(), dirty = !S.pub || S.pub.sig !== sig()
    const missing = S.list.filter((p) => p.own && !p.why).length
    let status = plural(n, 'entry', 'entries') + '. ' + own + ' of ' + MAX_OWN + ' your own.'
    if (n < MIN_PICKS) status = 'Keep or add at least five to send.'
    else if (missing) status = missing === 1 ? 'One of your own still needs its line.' : missing + ' of your own still need a line.'
    else if (S.pub && !dirty) status = 'Sent. Your page is up to date.'
    else if (S.pub) status = 'Changes not sent yet.'
    $('status').textContent = status
    $('send').textContent = S.pub ? (dirty ? 'Send changes' : 'Sent') : 'Send my week'
    $('send').disabled = n < MIN_PICKS || missing > 0 || (!!S.pub && !dirty)
    $('openAdd').innerHTML = U.icon('plus') + (own ? 'Add another of your own' : 'Add something of your own')
    $('openAdd').hidden = own >= MAX_OWN || !$('add').hidden
    $('addFull').hidden = own < MAX_OWN
    $('sign').textContent = NAME
  }
  function renderAll() { renderList(); renderCut(); renderBar() }
  const flash = (id) => { const el = rowEl(id); if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash') }
  const say = (text) => { $('live').textContent = ''; setTimeout(() => { $('live').textContent = text }, 30) }

  function move(id, dir) {
    const i = S.list.findIndex((p) => p.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= S.list.length) return
    const before = rowEl(id).getBoundingClientRect().top
    const p = S.list[i]; S.list[i] = S.list[j]; S.list[j] = p
    save(); renderList(); renderBar()
    const el = rowEl(id)
    window.scrollBy(0, el.getBoundingClientRect().top - before)
    const btn = el.querySelector('.mv[data-dir="' + dir + '"]')
    ;(btn.disabled ? el.querySelector('.mv:not([disabled])') : btn).focus({ preventScroll: true })
    flash(id)
    say(p.title + ' is now number ' + (j + 1) + ' of ' + S.list.length + '.')
  }
  function remove(id) {
    const i = S.list.findIndex((p) => p.id === id)
    if (i < 0) return
    const p = S.list.splice(i, 1)[0]
    S.cut.unshift({ pick: p, at: i })
    save(); renderAll()
    toast('Out of your week. It stays in WKNDR.', () => putBack(id))
    say(p.title + ' removed from your week.')
  }
  function putBack(id) {
    const k = S.cut.findIndex((c) => c.pick.id === id)
    if (k < 0) return
    if (S.cut[k].pick.own && ownCount() >= MAX_OWN) { toast('You already have five of your own.'); return }
    const c = S.cut.splice(k, 1)[0]
    S.list.splice(Math.min(c.at, S.list.length), 0, c.pick)
    save(); renderAll(); flash(id)
  }

  $('entries').addEventListener('click', (e) => {
    const row = e.target.closest('.entry'); if (!row) return
    const mv = e.target.closest('.mv')
    if (mv) return move(row.dataset.id, +mv.dataset.dir)
    if (e.target.closest('.rm')) return remove(row.dataset.id)
  })
  // the line saves as you type; Enter ends it, because a line is one line
  $('entries').addEventListener('input', (e) => {
    const t = e.target; if (t.tagName !== 'TEXTAREA') return
    grow(t)
    const row = t.closest('.entry'), p = S.list.find((x) => x.id === row.dataset.id)
    const text = oneLine(t.value).slice(0, WHY_MAX)
    if (text) p.why = text; else delete p.why
    t.classList.toggle('has', !!text)
    const c = row.querySelector('.count'); c.hidden = t.value.length < WHY_MAX - 30; c.querySelector('.n2').textContent = t.value.length
    save(); renderBar()
  })
  $('entries').addEventListener('keydown', (e) => { if (e.target.tagName === 'TEXTAREA' && e.key === 'Enter') { e.preventDefault(); e.target.blur() } })
  $('entries').addEventListener('focusout', (e) => { if (e.target.tagName === 'TEXTAREA') { e.target.value = oneLine(e.target.value); grow(e.target) } })
  $('cutlist').addEventListener('click', (e) => { const row = e.target.closest('.cutrow'); if (row && e.target.closest('.act-back')) putBack(row.dataset.id) })

  $('about').addEventListener('input', (e) => { grow(e.target); S.line = oneLine(e.target.value).slice(0, 90); save(); renderBar() })
  $('about').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } })

  // ─── add something of your own ──────────────────────────────────────────────────────────
  const DAYS = () => {
    const sat = U.date(WEEK.sat), sun = U.date(WEEK.sun), fri = U.addDays(sat, -1)
    return [
      { k: 'fri', label: 'Fri ' + fri.getDate(), when: U.shortDay(fri) },
      { k: 'sat', label: 'Sat ' + sat.getDate(), when: U.shortDay(sat) },
      { k: 'sun', label: 'Sun ' + sun.getDate(), when: U.shortDay(sun) },
      { k: 'both', label: 'Sat and Sun', when: 'Sat ' + sat.getDate() + ' and Sun ' + sun.getDate() + ' ' + U.MON[sun.getMonth()] },
      { k: 'any', label: 'Any day', when: 'Any day' },
    ]
  }
  function setDay(k) { ui.day = k; [...$('days').children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k))); if (k) $('eDay').hidden = true }
  function fillState(text, kind) { const el = $('fillstate'); el.textContent = text; el.className = 'fillstate' + (kind ? ' ' + kind : '') }
  function showFields(focusEl) { $('fields').hidden = false; $('byHand').hidden = true; if (focusEl) { focusEl.focus({ preventScroll: true }); focusEl.scrollIntoView({ block: 'nearest' }) } }
  function resetAdd() {
    $('add').reset(); ui.day = ''; ui.image = ''
    setDay(''); fillState('')
    $('fields').hidden = true; $('byHand').hidden = false
    ;['eTitle', 'eDay', 'eWhere', 'eWhy'].forEach((id) => { $(id).hidden = true })
    ;['fTitle', 'fWhere', 'fWhy'].forEach((id) => $(id).removeAttribute('aria-invalid'))
    $('whyCount').textContent = '0 / ' + WHY_MAX
  }
  function openAdd() { $('add').hidden = false; $('openAdd').hidden = true; $('link').focus({ preventScroll: true }); $('add').scrollIntoView({ block: 'nearest' }) }
  function closeAdd() { resetAdd(); $('add').hidden = true; renderBar(); $('openAdd').focus({ preventScroll: true }) }
  function fill() {
    const raw = $('link').value.trim()
    if (!raw) { fillState('Paste a link first.', 'bad'); $('link').focus(); return }
    const url = U.safeUrl(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw)
    if (!url || !/\.[a-z]{2,}$/i.test(U.host(url))) { fillState('That does not look like a link.', 'bad'); $('link').focus(); return }
    const at = S.list.findIndex((p) => U.sameLink(p.link, url))
    if (at >= 0) { fillState('That is already in your week, at number ' + (at + 1) + '.', 'bad'); return }
    $('link').value = url
    fillState('Reading the page.', 'busy'); $('fill').disabled = true
    setTimeout(() => {
      $('fill').disabled = false
      const s = C.samples.find((x) => U.sameLink(x.url, url))
      ui.image = ''
      if (s && s.kind === 'page') {
        $('fTitle').value = s.title; $('fWhere').value = s.venue; $('fTime').value = s.time || ''; setDay(s.day); ui.image = s.image || ''
        fillState('Filled in from ' + U.host(url) + '. Check it, then write your line.')
        showFields($('fWhy'))
      } else {
        fillState(s ? 'We could not read that page. Type it in.' : 'This comp cannot read live pages. Type it in.')
        showFields($('fTitle'))
      }
    }, 750)
  }
  function submitAdd(e) {
    e.preventDefault()
    if (ownCount() >= MAX_OWN) return
    const title = oneLine($('fTitle').value), where = oneLine($('fWhere').value), why = oneLine($('fWhy').value).slice(0, WHY_MAX), time = oneLine($('fTime').value)
    const bad = [['eTitle', 'fTitle', !title], ['eDay', null, !ui.day], ['eWhere', 'fWhere', !where], ['eWhy', 'fWhy', !why]]
    let first = null
    bad.forEach(([err, field, isBad]) => {
      $(err).hidden = !isBad
      if (field) { if (isBad) $(field).setAttribute('aria-invalid', 'true'); else $(field).removeAttribute('aria-invalid') }
      if (isBad && !first) first = field ? $(field) : $('days').firstElementChild
    })
    if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); return }
    const day = DAYS().find((d) => d.k === ui.day)
    const link = U.safeUrl($('link').value.trim())
    const pick = { id: 'own-' + Date.now().toString(36), title, venue: where, when: day.when + (time ? ' · ' + time : ''), link, source: link ? U.host(link) : '', own: true, why }
    if (ui.image) pick.image = ui.image
    if (ui.day === 'any') pick.until = 'open'
    S.list.push(pick)   // a letter is written top to bottom: your own go where you are writing
    save(); resetAdd(); $('add').hidden = true; renderAll()
    const el = rowEl(pick.id); el.scrollIntoView({ block: 'center' }); flash(pick.id)
    toast('Added as number ' + S.list.length + '. Move it up if it leads.')
    say(title + ' added at number ' + S.list.length + '.')
  }
  $('openAdd').addEventListener('click', openAdd)
  $('addCancel').addEventListener('click', closeAdd)
  $('fill').addEventListener('click', fill)
  $('link').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fill() } })
  $('byHand').addEventListener('click', () => { fillState(''); showFields($('fTitle')) })
  $('days').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) setDay(b.dataset.k) })
  $('samples').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { $('link').value = b.dataset.url; fill() } })
  $('fWhy').addEventListener('input', (e) => { $('whyCount').textContent = e.target.value.length + ' / ' + WHY_MAX })
  $('fWhy').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('add').requestSubmit() } })
  $('add').addEventListener('submit', submitAdd)

  // ─── send ───────────────────────────────────────────────────────────────────────────────
  const pageUrl = () => 'wkndr.xyz/ams/' + SLUG
  function weekAsText() {
    const lines = [NAME + "'s week · " + WEEK.long]
    if (S.line) lines.push(S.line)
    lines.push('')
    S.list.forEach((p, i) => { lines.push((i + 1) + '. ' + p.title + (p.own ? ' (my own)' : '')); lines.push('   ' + [p.when, p.venue].filter(Boolean).join(' · ')); if (p.why) lines.push('   ' + p.why); if (p.link) lines.push('   ' + p.link) })
    if (S.cut.length) lines.push('', 'Not in my week: ' + S.cut.map((c) => c.pick.title).join('; '))
    return lines.join('\n')
  }
  function modal(on) { $('scrim').classList.toggle('on', on); ['col', 'mast', 'bar'].forEach((id) => { $(id).inert = on }); document.documentElement.style.overflow = on ? 'hidden' : '' }
  function renderDone() {
    const n = S.list.length, own = ownCount(), withLine = S.list.filter((p) => p.why).length
    if (ui.pub === 'ask') {
      $('doneTitle').textContent = S.pub ? 'Send your changes?' : 'Send your week?'
      $('doneLines').innerHTML = '<p>' + plural(n, 'entry', 'entries') + ', ' + withLine + ' with a line.</p><p>' + (own === 0 ? 'None are your own yet.' : own === 1 ? '1 is your own.' : own + ' are your own.') + '</p><p>It goes to your page, <span class="url">' + esc(pageUrl()) + '</span>, and to the Friday email.</p><p>You can change it until Sunday night.</p>'
      $('doneNote').hidden = true
      $('doneBtns').innerHTML = '<button class="btn btn--accent btn--tall" type="button" data-do="send">' + (S.pub ? 'Send changes' : 'Send') + '</button><button class="btn btn--quiet" type="button" data-do="close">Not yet</button>'
    } else {
      $('doneTitle').textContent = 'Sent.'
      $('doneLines').innerHTML = '<p>Your page is <span class="url">' + esc(pageUrl()) + '</span>.</p><p>It stays up after the weekend as your archive.</p>'
      $('doneNote').hidden = false
      $('doneBtns').innerHTML = '<a class="btn btn--ink btn--tall" href="../ams/sanne/index.html?mine=1">See my page</a><button class="btn btn--tall" type="button" data-do="copy">Copy my week as text</button><button class="btn btn--quiet" type="button" data-do="close">Back to my week</button>'
    }
  }
  function openDone() { ui.opener = document.activeElement; renderDone(); $('done').inert = false; $('done').classList.add('open'); modal(true); $('doneTitle').focus({ preventScroll: true }) }
  function closeDone() { if (!$('done').classList.contains('open')) return; $('done').classList.remove('open'); $('done').inert = true; modal(false); if (ui.opener) ui.opener.focus({ preventScroll: true }) }
  function send() {
    S.pub = { at: new Date().toISOString(), sig: sig() }
    save()
    try { localStorage.setItem('wkndr.guestcomp.published', JSON.stringify({ slug: SLUG, name: NAME, line: S.line, week: WEEK, picks: S.list, cut: S.cut.map((c) => c.pick.title), at: S.pub.at })) } catch (e) { /* private mode */ }
    ui.pub = 'done'; renderDone(); renderBar(); $('doneTitle').focus({ preventScroll: true })
  }
  $('send').addEventListener('click', () => { ui.pub = 'ask'; openDone() })
  $('doneBtns').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-do]'); if (!b) return
    if (b.dataset.do === 'send') send()
    if (b.dataset.do === 'close') closeDone()
    if (b.dataset.do === 'copy') { const ok = await U.copy(weekAsText()); b.textContent = ok ? 'Copied' : 'Could not copy'; setTimeout(() => { b.textContent = 'Copy my week as text' }, 1800) }
  })
  $('scrim').addEventListener('click', closeDone)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDone() })

  let toastTimer = 0, toastUndo = null
  function toast(text, undo) {
    clearTimeout(toastTimer); toastUndo = undo || null
    $('toastText').textContent = text; $('toastUndo').hidden = !undo
    $('toast').classList.add('on')
    toastTimer = setTimeout(() => $('toast').classList.remove('on'), undo ? 6000 : 2600)
  }
  $('toastUndo').addEventListener('click', () => { const u = toastUndo; toastUndo = null; $('toast').classList.remove('on'); if (u) u() })

  // ─── boot ───────────────────────────────────────────────────────────────────────────────
  function boot() {
    KEY = 'wkndr.guestcomp.letter.' + WEEK.sat + '.' + SLUG
    S = load() || fresh()
    $('hello').textContent = NAME + "'s week"
    $('when').textContent = WEEK.long + (WEEK.temps ? ' · ' + WEEK.temps : '')
    $('weekShort').textContent = WEEK.label
    $('about').value = S.line; grow($('about'))
    document.title = NAME + "'s week, as a letter · WKNDR"
    $('days').innerHTML = DAYS().map((d) => '<button class="chip" type="button" data-k="' + d.k + '" aria-pressed="false">' + esc(d.label) + '</button>').join('')
    $('samples').innerHTML = C.samples.map((s) => '<button class="chip" type="button" data-url="' + esc(s.url) + '">' + esc(s.kind === 'page' ? (s.title.length > 26 ? s.title.slice(0, 24).trim() + '…' : s.title) : 'An Instagram profile') + '</button>').join('')
    resetAdd(); renderAll()
  }
  if (qs.get('live') === '1') {
    fetch('https://app.wkndr.xyz/data/letter.amsterdam.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no letter'))))
      .then((L) => {
        WEEK = { sat: L.weekend.sat, sun: L.weekend.sun, label: U.shortWeek(L.weekend.sat, L.weekend.sun), long: U.longWeek(L.weekend.sat, L.weekend.sun) }
        FLOOR = L.front.map((x) => ({ id: x.id, title: x.title, venue: x.venue || '', when: x.when || '', link: x.link || '', source: x.source || '', image: x.image }))
      })
      .catch(() => { /* offline: the snapshot stands in */ })
      .then(boot)
  } else boot()
})()
