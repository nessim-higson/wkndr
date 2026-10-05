/* Shared helpers for the guest-curator comps. Plain script, no build step. */
window.CU = (() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  /* A pasted link is only ever followed if it is a web address. */
  const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : '' } catch (e) { return '' } }
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch (e) { return '' } }
  const sameLink = (a, b) => { try { const x = new URL(a), y = new URL(b); const k = (v) => v.hostname.replace(/^www\./, '') + v.pathname.replace(/\/+$/, ''); return k(x) === k(y) } catch (e) { return false } }

  /* Every photograph in the feed is a wsrv.nl render (scripts/lib/pipeline.ts toPortrait). The comps
     ask the same proxy for the size they draw, keeping the feed's focal point, so a 64px thumbnail
     is not an 800x1200 download. A raw source (the held-back picks) is wrapped the same way. */
  const sized = (url, w, h) => {
    if (!url) return ''
    if (/images\.weserv\.nl/.test(url)) return url.replace(/([?&])w=\d+/, '$1w=' + w).replace(/([?&])h=\d+/, '$1h=' + h)
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(url) + '&w=' + w + '&h=' + h + '&fit=cover&a=attention&output=jpg&default=' + encodeURIComponent(url)
  }
  /* The photo, or the type face a pick wears when it has none. Never a stand-in picture. */
  const typeFace = (title, cls, px, lines) => '<div class="ph ph--type ' + cls + '"><span style="font-size:' + px + 'px;-webkit-line-clamp:' + lines + '">' + esc(title) + '</span></div>'
  const photo = (p, w, h, cls, px, lines) => p.image
    ? '<div class="ph ' + cls + '" data-title="' + esc(p.title) + '" data-px="' + px + '" data-lines="' + lines + '"><img src="' + esc(sized(p.image, w * 2, h * 2)) + '" alt="" loading="lazy" decoding="async"></div>'
    : typeFace(p.title, cls, px, lines)
  /* A photo that fails to load becomes the type face, not a broken-image icon. */
  document.addEventListener('error', (e) => {
    const img = e.target
    if (!img || img.tagName !== 'IMG') return
    const box = img.closest('.ph')
    if (!box || box.classList.contains('ph--type')) return
    box.classList.add('ph--type')
    box.innerHTML = '<span style="font-size:' + (box.dataset.px || 11) + 'px;-webkit-line-clamp:' + (box.dataset.lines || 4) + '">' + esc(box.dataset.title || '') + '</span>'
  }, true)

  const ICONS = {
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    out: '<path d="M7 17 17 7M8 7h9v9"/>',
    share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    check: '<path d="M5 12.5 9.5 17 19 7.5"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  }
  const icon = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>'

  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const date = (iso) => { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]) }
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  const shortDay = (d) => DAY[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]
  const longWeek = (sat, sun) => {
    const a = date(sat), b = date(sun)
    return a.getMonth() === b.getMonth()
      ? 'Sat ' + a.getDate() + ' and Sun ' + b.getDate() + ' ' + MONTH[b.getMonth()] + ' ' + b.getFullYear()
      : 'Sat ' + a.getDate() + ' ' + MONTH[a.getMonth()] + ' and Sun ' + b.getDate() + ' ' + MONTH[b.getMonth()] + ' ' + b.getFullYear()
  }
  const shortWeek = (sat, sun) => {
    const a = date(sat), b = date(sun)
    return a.getMonth() === b.getMonth()
      ? 'Sat ' + a.getDate() + ' to Sun ' + b.getDate() + ' ' + MON[b.getMonth()]
      : 'Sat ' + a.getDate() + ' ' + MON[a.getMonth()] + ' to Sun ' + b.getDate() + ' ' + MON[b.getMonth()]
  }

  /* The first publication named on a pick: "I amsterdam · Your Little Black Book" reads "I amsterdam". */
  const firstSource = (s) => String(s || '').split(/\s[·\/&]\s/)[0].trim()

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true } catch (e) { /* older Safari, or no permission */ }
    try {
      const t = document.createElement('textarea')
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'
      document.body.appendChild(t); t.select()
      const ok = document.execCommand('copy'); t.remove(); return ok
    } catch (e) { return false }
  }

  return { esc, safeUrl, host, sameLink, sized, photo, typeFace, icon, date, addDays, shortDay, longWeek, shortWeek, firstSource, copy, MON, MONTH }
})()
