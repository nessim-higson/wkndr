/* THE GUEST'S WEEK (comp). Move, cut, add, say why, publish. State lives in this browser only.
   Two handles for sitting with a real person (Gate A in docs/takeovers.md):
     ?name=Maya   greets them by name and starts their line empty
     ?live=1      loads this week's real ten from the production letter instead of the snapshot */
(() => {
  const C = window.COMP, U = window.CU
  const qs = new URLSearchParams(location.search)
  const sample = C.curators.find((c) => c.slug === 'sanne')
  const named = (qs.get('name') || '').replace(/[<>]/g, '').trim().slice(0, 24)
  const NAME = named || sample.name
  const SLUG = NAME.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'you'
  const MAX_OWN = 5      // at least half of any guest's first ten is still the ranked deck
  const MIN_PICKS = 5    // a page with fewer reads as broken
  const WHY_MAX = 140, LINE_MAX = 90
  const wide = window.matchMedia('(min-width: 720px)')   // the app's own desktop breakpoint
  const $ = (id) => document.getElementById(id)
  const esc = U.esc

  let WEEK = C.week, FLOOR = C.front, KEY = '', S = null
  const ui = { editing: null, day: '', image: '', pub: 'ask', opener: null }

  // ─── state ──────────────────────────────────────────────────────────────────────────────
  const fresh = () => ({ list: FLOOR.map((p) => Object.assign({}, p)), cut: [], line: named ? '' : sample.line, pub: null })
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { /* private mode */ } }
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && Array.isArray(s.list) && Array.isArray(s.cut) ? s : null } catch (e) { return null } }
  const ownCount = () => S.list.filter((p) => p.own).length
  const sig = () => JSON.stringify([S.line, S.list.map((p) => [p.id, p.why || ''])])
  const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many)

  // ─── the list ───────────────────────────────────────────────────────────────────────────
  function rowHTML(p, i, n) {
    const link = U.safeUrl(p.link)
    // the arrow travels with the last word, so it never sits alone on a line
    const words = String(p.title).split(' '), last = words.pop()
    const title = link
      ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(words.join(' ')) + (words.length ? ' ' : '')
        + '<span class="nb">' + esc(last) + U.icon('out') + '</span><span class="sr"> (opens the page)</span></a>'
      : esc(p.title)
    const meta = [p.when, p.venue !== p.title ? p.venue : ''].filter(Boolean).join(' · ')
    const more = ui.editing === p.id
      ? '<div class="whyedit">'
        + '<label class="sr" for="why-' + i + '">Why you would go to ' + esc(p.title) + '</label>'
        + '<textarea class="input" id="why-' + i + '" maxlength="' + WHY_MAX + '" rows="2" placeholder="Go early. The courtyard fills by seven.">' + esc(p.why || '') + '</textarea>'
        + '<p class="help help--bad" hidden>Your own picks need a line.</p>'
        + '<div class="foot"><span class="help"><span class="n">' + (p.why || '').length + '</span> / ' + WHY_MAX + '</span>'
        + '<div><button class="btn btn--quiet act-cancel" type="button">Cancel</button><button class="btn btn--ink act-save" type="button">Save line</button></div></div></div>'
      : (p.why ? '<p class="why">' + esc(p.why) + '</p>' : '')
        + '<div class="acts"><button class="btn act-why" type="button">' + (p.why ? 'Edit line' : 'Say why') + '<span class="sr"> for ' + esc(p.title) + '</span></button>'
        + '<button class="btn act-cut" type="button">Cut<span class="sr"> ' + esc(p.title) + ' from your week</span></button>'
        + '<span class="move">'
        + '<button class="mv" type="button" data-dir="-1" aria-label="Move ' + esc(p.title) + ' up"' + (i === 0 ? ' disabled' : '') + '>' + U.icon('up') + '</button>'
        + '<button class="mv" type="button" data-dir="1" aria-label="Move ' + esc(p.title) + ' down"' + (i === n - 1 ? ' disabled' : '') + '>' + U.icon('down') + '</button>'
        + '</span></div>'
    return '<li class="pick" data-id="' + esc(p.id) + '">'
      + '<div class="rank" aria-hidden="true">' + (i + 1) + '</div>'
      + U.photo(p, 72, 90, 'thumb', 11, 5)
      + '<div class="body">' + (p.own ? '<span class="own label">Yours</span>' : '')
      + '<h3 class="title">' + title + '</h3>' + (meta ? '<p class="meta">' + esc(meta) + '</p>' : '') + '</div>'
      + '<div class="more">' + more + '</div></li>'
  }
  const rowEl = (id) => [...$('list').children].find((el) => el.dataset.id === id)

  function renderList() {
    const n = S.list.length
    $('list').innerHTML = S.list.map((p, i) => rowHTML(p, i, n)).join('')
    $('count').textContent = plural(n, 'pick', 'picks')
  }
  function renderCut() {
    $('cutbox').hidden = !S.cut.length
    $('cutlist').innerHTML = S.cut.map((c) => '<div class="cutrow" data-id="' + esc(c.pick.id) + '"><span>' + esc(c.pick.title) + '</span>'
      + '<button class="btn act-back" type="button">Put back<span class="sr"> ' + esc(c.pick.title) + '</span></button></div>').join('')
  }
  function renderBar() {
    const n = S.list.length, own = ownCount(), dirty = !S.pub || S.pub.sig !== sig()
    const pub = $('publish'), add = $('openAdd')
    let status = plural(n, 'pick', 'picks') + '. ' + own + ' of ' + MAX_OWN + ' your own.'
    if (n < MIN_PICKS) status = 'Keep or add at least five picks to publish.'
    else if (S.pub && !dirty) status = 'Published. Your page is up to date.'
    else if (S.pub) status = 'You have changes that are not on your page yet.'
    $('status').textContent = status
    pub.textContent = S.pub ? (dirty ? 'Publish changes' : 'Published') : 'Publish'
    pub.disabled = n < MIN_PICKS || (!!S.pub && !dirty)
    add.innerHTML = own >= MAX_OWN ? 'Five added' : U.icon('plus') + 'Add a pick'
    add.disabled = own >= MAX_OWN
    $('addBody').hidden = own >= MAX_OWN
    $('addFull').hidden = own < MAX_OWN
    $('addSub').textContent = own >= MAX_OWN ? '' : 'Something we would not find. ' + own + ' of ' + MAX_OWN + ' added.'
  }
  function renderByline() {
    $('mono').textContent = NAME.slice(0, 1).toUpperCase()
    $('who').textContent = NAME
    $('line').textContent = S.line || 'Add one line about you.'
    $('line').classList.toggle('empty', !S.line)
    $('lineEdit').textContent = S.line ? 'Edit your line' : 'Add your line'
  }
  function renderAll() { renderByline(); renderList(); renderCut(); renderBar() }

  const flash = (id) => { const el = rowEl(id); if (!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash') }
  const say = (text) => { $('live').textContent = ''; setTimeout(() => { $('live').textContent = text }, 30) }

  // ─── move: the row stays under the finger, so a second tap lands on the same button ─────
  function move(id, dir) {
    const i = S.list.findIndex((p) => p.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= S.list.length) return
    const before = rowEl(id).getBoundingClientRect().top
    const p = S.list[i]
    S.list[i] = S.list[j]; S.list[j] = p
    save(); renderList(); renderBar()
    const el = rowEl(id)
    window.scrollBy(0, el.getBoundingClientRect().top - before)
    const btn = el.querySelector('.mv[data-dir="' + dir + '"]')
    ;(btn.disabled ? el.querySelector('.mv:not([disabled])') : btn).focus({ preventScroll: true })
    flash(id)
    say(p.title + ' is now number ' + (j + 1) + ' of ' + S.list.length + '.')
  }

  // ─── cut: out of this week only. One tap, one undo. No reason asked. ─────────────────────
  function cut(id) {
    const i = S.list.findIndex((p) => p.id === id)
    if (i < 0) return
    const p = S.list.splice(i, 1)[0]
    S.cut.unshift({ pick: p, at: i })
    ui.editing = null
    save(); renderAll()
    toast('Cut. It stays in WKNDR.', () => putBack(id))
    say(p.title + ' is cut from your week.')
    const next = $('list').children[Math.min(i, S.list.length - 1)]
    if (next) next.querySelector('.act-cut').focus({ preventScroll: true })
  }
  function putBack(id) {
    const k = S.cut.findIndex((c) => c.pick.id === id)
    if (k < 0) return
    if (S.cut[k].pick.own && ownCount() >= MAX_OWN) { toast('You already have five of your own.'); return }
    const c = S.cut.splice(k, 1)[0]
    S.list.splice(Math.min(c.at, S.list.length), 0, c.pick)
    save(); renderAll(); flash(id)
    say(c.pick.title + ' is back in your week.')
  }

  // ─── why: one line, first person. Needed on your own picks, welcome on the rest. ─────────
  function editWhy(id) {
    ui.editing = id
    renderList()
    const t = rowEl(id).querySelector('textarea')
    t.focus({ preventScroll: true }); t.setSelectionRange(t.value.length, t.value.length)
    rowEl(id).scrollIntoView({ block: 'nearest' })
  }
  function saveWhy(id) {
    const el = rowEl(id), p = S.list.find((x) => x.id === id)
    const text = oneLine(el.querySelector('textarea').value).slice(0, WHY_MAX)
    if (p.own && !text) { el.querySelector('.help--bad').hidden = false; el.querySelector('textarea').setAttribute('aria-invalid', 'true'); el.querySelector('textarea').focus(); return }
    if (text) p.why = text; else delete p.why
    ui.editing = null
    save(); renderList(); renderBar(); flash(id)
    rowEl(id).querySelector('.act-why').focus({ preventScroll: true })
  }
  function cancelWhy(id) { ui.editing = null; renderList(); const el = rowEl(id); if (el) el.querySelector('.act-why').focus({ preventScroll: true }) }

  $('list').addEventListener('click', (e) => {
    const row = e.target.closest('.pick'); if (!row) return
    const id = row.dataset.id
    const mv = e.target.closest('.mv')
    if (mv) return move(id, +mv.dataset.dir)
    if (e.target.closest('.act-cut')) return cut(id)
    if (e.target.closest('.act-why')) return editWhy(id)
    if (e.target.closest('.act-save')) return saveWhy(id)
    if (e.target.closest('.act-cancel')) return cancelWhy(id)
  })
  $('list').addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') e.target.closest('.whyedit').querySelector('.n').textContent = e.target.value.length })
  $('list').addEventListener('keydown', (e) => {
    if (e.target.tagName !== 'TEXTAREA') return
    const id = e.target.closest('.pick').dataset.id
    if (e.key === 'Enter') { e.preventDefault(); saveWhy(id) }   // a why is one line: Enter saves it
    if (e.key === 'Escape') { e.stopPropagation(); cancelWhy(id) }
  })
  $('cutlist').addEventListener('click', (e) => { const row = e.target.closest('.cutrow'); if (row && e.target.closest('.act-back')) putBack(row.dataset.id) })

  // ─── your line ──────────────────────────────────────────────────────────────────────────
  function lineMode(editing) {
    $('bylineShow').hidden = editing; $('bylineEdit').hidden = !editing
    if (editing) { const i = $('lineInput'); i.value = S.line; $('lineCount').textContent = i.value.length + ' / ' + LINE_MAX; i.focus() } else $('lineEdit').focus({ preventScroll: true })
  }
  $('lineEdit').addEventListener('click', () => lineMode(true))
  $('lineCancel').addEventListener('click', () => lineMode(false))
  $('lineSave').addEventListener('click', () => { S.line = oneLine($('lineInput').value).slice(0, LINE_MAX); save(); renderByline(); renderBar(); lineMode(false) })
  $('lineInput').addEventListener('input', (e) => { $('lineCount').textContent = e.target.value.length + ' / ' + LINE_MAX })
  $('lineInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('lineSave').click() } if (e.key === 'Escape') lineMode(false) })

  // ─── add a pick ─────────────────────────────────────────────────────────────────────────
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
  function renderGot() {
    const title = oneLine($('fTitle').value)
    const got = $('got')
    got.hidden = false
    got.innerHTML = ui.image
      ? U.photo({ image: ui.image, title }, 48, 60, '', 9, 4) + '<span>Photo from the page.</span>'
      : U.typeFace(title || 'Your pick', '', 9, 4) + '<span>No photo. Your pick gets a type card.</span>'
  }
  function showFields(focusEl) { $('fields').hidden = false; $('byHand').hidden = true; renderGot(); if (focusEl) focusEl.focus({ preventScroll: true }); focusEl && focusEl.scrollIntoView({ block: 'nearest' }) }
  function resetAdd() {
    $('add').reset(); ui.day = ''; ui.image = ''
    setDay(''); fillState('')
    $('fields').hidden = true; $('byHand').hidden = false; $('got').hidden = true
    ;['eTitle', 'eDay', 'eWhere', 'eWhy'].forEach((id) => { $(id).hidden = true })
    ;['fTitle', 'fWhere', 'fWhy'].forEach((id) => $(id).removeAttribute('aria-invalid'))
    $('hWhy').hidden = false; $('whyCount').textContent = '0 / ' + WHY_MAX
  }
  /* "Fill in": on the real tool a worker reads the page (JSON-LD, then OpenGraph) and returns a
     card to check. Here the sample links answer from the snapshot, and anything else takes the
     path every unreadable page takes: the link is kept and you type the rest. */
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
        fillState('Filled in from ' + U.host(url) + '. Check it, then add your line.')
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
    $('hWhy').hidden = !why
    if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); return }
    const day = DAYS().find((d) => d.k === ui.day)
    const link = U.safeUrl($('link').value.trim())
    const pick = { id: 'own-' + Date.now().toString(36), title, venue: where, when: day.when + (time ? ' · ' + time : ''), link, source: link ? U.host(link) : '', own: true, why }
    if (ui.image) pick.image = ui.image
    if (ui.day === 'any') pick.until = 'open'
    S.list.unshift(pick)
    save(); resetAdd(); renderAll()
    if (!wide.matches) closeAdd(true)
    const el = rowEl(pick.id)
    el.scrollIntoView({ block: 'center' }); flash(pick.id)
    toast('Added at number 1.')
    say(title + ' added to your week at number 1.')
  }

  // the add panel is a modal sheet on a phone and a standing panel on a laptop
  function syncAdd() { const open = $('add').classList.contains('open'); $('add').inert = !wide.matches && !open }
  function modal(on, sheet) {
    $('scrim').classList.toggle('on', on)
    ;['col', 'mast', 'bar'].forEach((id) => { $(id).inert = on })
    if (sheet === 'done') $('add').inert = on || (!wide.matches && !$('add').classList.contains('open'))
    document.documentElement.style.overflow = on ? 'hidden' : ''
  }
  function openAdd() {
    if (ownCount() >= MAX_OWN) return
    if (wide.matches) { $('link').focus(); $('add').scrollIntoView({ block: 'nearest' }); return }
    ui.opener = document.activeElement
    $('add').classList.add('open'); syncAdd(); modal(true, 'add')
    $('link').focus({ preventScroll: true })
  }
  function closeAdd(silent) {
    if (!$('add').classList.contains('open')) return
    $('add').classList.remove('open'); syncAdd(); modal(false, 'add')
    if (!silent && ui.opener) ui.opener.focus({ preventScroll: true })
  }
  wide.addEventListener('change', () => { if (wide.matches) { $('add').classList.remove('open'); if (!$('done').classList.contains('open')) modal(false) } syncAdd() })

  $('openAdd').addEventListener('click', openAdd)
  $('addClose').addEventListener('click', () => closeAdd())
  $('addCancel').addEventListener('click', () => closeAdd())
  $('fill').addEventListener('click', fill)
  $('link').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fill() } })
  $('byHand').addEventListener('click', () => { fillState(''); showFields($('fTitle')) })
  $('days').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) setDay(b.dataset.k) })
  $('samples').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { $('link').value = b.dataset.url; fill() } })
  $('fTitle').addEventListener('input', () => { if (!$('fields').hidden) renderGot() })
  $('fWhy').addEventListener('input', (e) => { $('whyCount').textContent = e.target.value.length + ' / ' + WHY_MAX })
  $('fWhy').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('addSubmit').click() } })
  $('add').addEventListener('submit', submitAdd)

  // ─── publish ────────────────────────────────────────────────────────────────────────────
  const pageUrl = () => 'wkndr.xyz/ams/' + SLUG
  function weekAsText() {
    const lines = [NAME + "'s week · " + WEEK.long]
    if (S.line) lines.push(S.line)
    lines.push('')
    S.list.forEach((p, i) => {
      lines.push((i + 1) + '. ' + p.title + (p.own ? ' (my own)' : ''))
      lines.push('   ' + [p.when, p.venue].filter(Boolean).join(' · '))
      if (p.why) lines.push('   Why: ' + p.why)
      if (p.link) lines.push('   ' + p.link)
    })
    if (S.cut.length) lines.push('', 'Not in my week: ' + S.cut.map((c) => c.pick.title).join('; '))
    return lines.join('\n')
  }
  function renderDone() {
    const n = S.list.length, own = ownCount()
    const btns = $('doneBtns')
    if (ui.pub === 'ask') {
      $('doneTitle').textContent = S.pub ? 'Publish your changes?' : 'Publish your week?'
      $('doneLines').innerHTML = '<p>' + plural(n, 'pick', 'picks') + ', in your order.</p>'
        + '<p>' + (own === 0 ? 'None are your own yet.' : own === 1 ? '1 is your own.' : own + ' are your own.') + '</p>'
        + '<p>Your page will be <span class="url">' + esc(pageUrl()) + '</span>.</p>'
        + '<p>You can change it until Sunday night.</p>'
      $('doneNote').hidden = true
      btns.innerHTML = '<button class="btn btn--accent btn--tall" type="button" data-do="publish">' + (S.pub ? 'Publish changes' : 'Publish') + '</button>'
        + '<button class="btn btn--quiet" type="button" data-do="close">Not yet</button>'
    } else {
      $('doneTitle').textContent = 'Your week is published.'
      $('doneLines').innerHTML = '<p>Your page is <span class="url">' + esc(pageUrl()) + '</span>.</p><p>It stays up after the weekend as your archive.</p>'
      $('doneNote').hidden = false
      btns.innerHTML = '<a class="btn btn--ink btn--tall" href="../ams/sanne/index.html?mine=1">See my page</a>'
        + '<button class="btn btn--tall" type="button" data-do="copy">Copy my week as text</button>'
        + '<button class="btn btn--quiet" type="button" data-do="close">Back to my week</button>'
    }
  }
  function openDone() { ui.opener = document.activeElement; renderDone(); $('done').inert = false; $('done').classList.add('open'); modal(true, 'done'); $('doneTitle').focus({ preventScroll: true }) }
  function closeDone() { if (!$('done').classList.contains('open')) return; $('done').classList.remove('open'); $('done').inert = true; modal(false, 'done'); syncAdd(); if (ui.opener) ui.opener.focus({ preventScroll: true }) }
  function publish() {
    S.pub = { at: new Date().toISOString(), sig: sig() }
    save()
    try { localStorage.setItem('wkndr.guestcomp.published', JSON.stringify({ slug: SLUG, name: NAME, line: S.line, week: WEEK, picks: S.list, cut: S.cut.map((c) => c.pick.title), at: S.pub.at })) } catch (e) { /* private mode */ }
    ui.pub = 'done'; renderDone(); renderBar()
    $('doneTitle').focus({ preventScroll: true })
    say('Your week is published.')
  }
  $('publish').addEventListener('click', () => { ui.pub = 'ask'; openDone() })
  $('doneBtns').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-do]'); if (!b) return
    if (b.dataset.do === 'publish') publish()
    if (b.dataset.do === 'close') closeDone()
    if (b.dataset.do === 'copy') { const ok = await U.copy(weekAsText()); b.textContent = ok ? 'Copied' : 'Could not copy'; setTimeout(() => { b.textContent = 'Copy my week as text' }, 1800) }
  })
  $('scrim').addEventListener('click', () => { closeAdd(); closeDone() })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAdd(); closeDone() } })

  // ─── toast ──────────────────────────────────────────────────────────────────────────────
  let toastTimer = 0, toastUndo = null
  function toast(text, undo) {
    clearTimeout(toastTimer)
    toastUndo = undo || null
    $('toastText').textContent = text
    $('toastUndo').hidden = !undo
    $('toast').classList.add('on')
    toastTimer = setTimeout(() => $('toast').classList.remove('on'), undo ? 6000 : 2600)
  }
  $('toastUndo').addEventListener('click', () => { const u = toastUndo; toastUndo = null; $('toast').classList.remove('on'); if (u) u() })

  // ─── start over: two taps, because it throws away typed lines ───────────────────────────
  let resetArmed = 0
  $('reset').addEventListener('click', () => {
    const b = $('reset')
    if (!resetArmed) { b.textContent = 'Tap again to start over'; resetArmed = setTimeout(() => { resetArmed = 0; b.textContent = 'Start over' }, 4000); return }
    clearTimeout(resetArmed); resetArmed = 0; b.textContent = 'Start over'
    S = fresh(); ui.editing = null
    save(); try { localStorage.removeItem('wkndr.guestcomp.published') } catch (e) { /* private mode */ }
    resetAdd(); renderAll(); window.scrollTo(0, 0)
    toast('Back to the ranked ten.')
  })

  // ─── boot ───────────────────────────────────────────────────────────────────────────────
  function boot() {
    KEY = 'wkndr.guestcomp.week.' + WEEK.sat + '.' + SLUG
    S = load() || fresh()
    $('hello').textContent = NAME + ', this weekend is yours.'
    $('when').textContent = WEEK.long + (WEEK.temps ? ' · ' + WEEK.temps : '')
    $('weekShort').textContent = WEEK.label
    document.title = NAME + "'s week · WKNDR"
    $('addClose').innerHTML = U.icon('x')
    $('days').innerHTML = DAYS().map((d) => '<button class="chip" type="button" data-k="' + d.k + '" aria-pressed="false">' + esc(d.label) + '</button>').join('')
    $('samples').innerHTML = C.samples.map((s) => '<button class="chip" type="button" data-url="' + esc(s.url) + '">'
      + esc(s.kind === 'page' ? (s.title.length > 26 ? s.title.slice(0, 24).trim() + '…' : s.title) : 'An Instagram profile') + '</button>').join('')
    resetAdd(); syncAdd(); renderAll()
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
