/* DIRECTION B (comp): the ten as a deck. Right keeps, left cuts, Undo brings the last one back.
   When the deck is empty the kept cards are handed to the list tool (direction A) through the
   same browser state it reads, so ordering, adding and publishing are the same screens. */
(() => {
  const C = window.COMP, U = window.CU, esc = U.esc
  const qs = new URLSearchParams(location.search)
  const sample = C.curators.find((c) => c.slug === 'sanne')
  const named = (qs.get('name') || '').replace(/[<>]/g, '').trim().slice(0, 24)
  const NAME = named || sample.name
  const SLUG = NAME.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'you'
  const WEEK = C.week, FLOOR = C.front
  const $ = (id) => document.getElementById(id)
  const THRESHOLD = 90

  let i = 0
  const kept = [], cut = []   // cut: { pick, at } so a put-back lands in its old slot
  const history = []           // [{ pick, dir }]

  function cardHTML(p, k) {
    const meta = [p.when, p.venue !== p.title ? p.venue : ''].filter(Boolean).join(' · ')
    return '<div class="card' + (k === 1 ? ' under' : k >= 2 ? ' under2' : '') + '" data-id="' + esc(p.id) + '" tabindex="' + (k === 0 ? '0' : '-1') + '" aria-label="' + esc(p.title) + '. ' + esc(meta) + '">'
      + U.photo(p, 340, 453, '', 40, 5) + '<div class="scrim"></div>'
      + '<div class="top">' + (p.when ? '<span class="stamp">' + esc(p.when) + '</span>' : '<span></span>') + (p.guide ? '<span class="signal">Weekend guide</span>' : '') + '</div>'
      + '<span class="verdict keep">Keep</span><span class="verdict cut">Cut</span>'
      + '<div class="foot"><p class="title">' + esc(p.title) + '</p>' + (meta ? '<p class="meta">' + esc(meta) + '</p>' : '') + '</div></div>'
  }
  function render() {
    const stage = $('stage')
    const next = FLOOR.slice(i, i + 3)
    // the top card is the LAST child so it paints above the two peeking behind it
    stage.innerHTML = next.slice().reverse().map((p, idx) => cardHTML(p, next.length - 1 - idx)).join('')
    $('counter').textContent = i < FLOOR.length ? (i + 1) + ' of ' + FLOOR.length : ''
    $('undoRow').hidden = !history.length
    $('acts').hidden = i >= FLOOR.length
    if (i >= FLOOR.length) finish()
    else wire(stage.lastElementChild)
  }

  function wire(card) {
    let drag = null
    const keepTag = card.querySelector('.verdict.keep'), cutTag = card.querySelector('.verdict.cut')
    card.addEventListener('pointerdown', (e) => { if (e.button) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; card.setPointerCapture(e.pointerId); card.classList.add('dragging') })
    card.addEventListener('pointermove', (e) => {
      if (!drag) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      card.style.transform = 'translate(' + dx + 'px, ' + dy * 0.25 + 'px) rotate(' + dx / 16 + 'deg)'
      keepTag.style.opacity = Math.min(1, Math.max(0, dx / THRESHOLD))
      cutTag.style.opacity = Math.min(1, Math.max(0, -dx / THRESHOLD))
    })
    const end = (e) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      drag = null
      card.classList.remove('dragging')
      if (dx > THRESHOLD) decide(1)
      else if (dx < -THRESHOLD) decide(-1)
      else { card.style.transform = ''; keepTag.style.opacity = 0; cutTag.style.opacity = 0 }
    }
    card.addEventListener('pointerup', end)
    card.addEventListener('pointercancel', end)
    card.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') decide(1); if (e.key === 'ArrowLeft') decide(-1) })
  }

  function decide(dir) {
    if (i >= FLOOR.length) return
    const p = FLOOR[i], card = $('stage').lastElementChild
    card.classList.add('gone')
    card.style.transform = 'translate(' + dir * 130 + 'vw, -40px) rotate(' + dir * 22 + 'deg)'
    card.querySelector(dir > 0 ? '.verdict.keep' : '.verdict.cut').style.opacity = 1
    if (dir > 0) kept.push(p); else cut.push({ pick: p, at: i })
    history.push({ pick: p, dir })
    i++
    $('live').textContent = p.title + (dir > 0 ? ' kept.' : ' cut.') + (i < FLOOR.length ? ' Next: ' + FLOOR[i].title : ' That was the last one.')
    setTimeout(render, 260)
  }
  function undo() {
    const h = history.pop()
    if (!h) return
    i--
    if (h.dir > 0) kept.pop(); else cut.pop()
    $('result').hidden = true; $('stage').hidden = false
    render()
    $('live').textContent = h.pick.title + ' is back.'
  }

  function finish() {
    const n = kept.length
    $('resultH').textContent = n === FLOOR.length ? 'You kept all ten.' : 'You kept ' + n + ' of ' + FLOOR.length + '.'
    $('resultLines').innerHTML = (n < 5 ? '<p>A page needs at least five picks.</p><p>Add your own in the next step, or undo a cut.</p>' : '<p>Now put them in your order.</p><p>Then add up to five of your own.</p>')
    $('cutlist').textContent = cut.length ? 'Cut, and still in WKNDR: ' + cut.map((c) => c.pick.title).join(', ') + '.' : ''
    // hand the kept cards to the list tool through the state it already reads
    const key = 'wkndr.guestcomp.week.' + WEEK.sat + '.' + SLUG
    const S = { list: kept.map((p) => Object.assign({}, p)), cut: cut.map((c) => ({ pick: Object.assign({}, c.pick), at: c.at })), line: named ? '' : sample.line, pub: null }
    try { localStorage.setItem(key, JSON.stringify(S)) } catch (e) { /* private mode */ }
    $('toOrder').href = '../week/index.html' + (named ? '?name=' + encodeURIComponent(named) : '')
    $('stage').hidden = true
    $('result').hidden = false
    $('toOrder').focus({ preventScroll: true })
  }

  $('keepBtn').addEventListener('click', () => decide(1))
  $('cutBtn').addEventListener('click', () => decide(-1))
  $('undo').addEventListener('click', undo)
  document.addEventListener('keydown', (e) => { if (e.target.closest('.card')) return; if (e.key === 'ArrowRight') decide(1); if (e.key === 'ArrowLeft') decide(-1) })

  $('hello').textContent = NAME + ', this weekend is yours.'
  $('when').textContent = WEEK.long + (WEEK.temps ? ' · ' + WEEK.temps : '')
  $('weekShort').textContent = WEEK.label
  document.title = NAME + "'s week, swipe first · WKNDR"
  $('cutIcon').innerHTML = U.icon('x')
  $('keepIcon').innerHTML = U.icon('check')
  render()
})()
