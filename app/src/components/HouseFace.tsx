import { Fragment, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Pick } from '../types'
import { CATEGORY_LABEL } from '../types'
import { placeOf } from '../lib/place'
import { resolveGeo } from '../lib/geo'
import {
  barLines, emphasisIndex, houseDateLine, houseDay, isLongTitle, longestRun, shortPlace, titleTokens,
  isSparse, type HouseMove,
} from '../lib/house-face'
import './HouseFace.css'

/** A title as words: each word is its own span so the fit pass can find the one that had to break
 *  (and only that one is then hyphenated — a Dutch compound never splits while it fits a line). */
function Title({ text, cls = '', bold = -1 }: { text: string; cls?: string; bold?: number }) {
  return <h2 className={`hf-title ${cls}`} lang="nl">
    {titleTokens(text).map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span className={`hf-word${i === bold ? ' hf-b' : ''}`}>{w}</span></Fragment>)}
  </h2>
}

// THE FIT PASS. The board drew every move at 340×455 on hand-cleaned titles; the deck is 288–600px
// wide and the feed's titles run from "Vermut" to eighty characters. So after layout the face steps
// its title down (never below 60%) until the title sits inside the card, under the chrome, clear of
// every fact block — and past the third step it drops the optional facts. Measured in LAYOUT
// offsets, not screen rects: the card is mid-flight (scaled, rotated) when it first mounts.
const STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6]
const SAFE_TOP = 92, SAFE_BOTTOM = 12, CLEAR = 6

function box(el: HTMLElement, root: HTMLElement) {
  let top = 0, left = 0
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) { top += n.offsetTop; left += n.offsetLeft }
  return { top, left, bottom: top + el.offsetHeight, right: left + el.offsetWidth }
}

function fit(root: HTMLElement) {
  const H = root.offsetHeight, W = root.offsetWidth
  const title = root.querySelector<HTMLElement>('.hf-fit')
  if (!H || !W || !title) return
  const words = Array.from(root.querySelectorAll<HTMLElement>('.hf-word'))
  for (const w of words) w.classList.remove('hf-hy')
  for (let i = 0; i < STEPS.length; i++) {
    root.style.setProperty('--hf-fit', String(STEPS[i]))
    root.toggleAttribute('data-tight', i >= 3)
    const t = box(title, root)
    const keep = Array.from(root.querySelectorAll<HTMLElement>('.hf-keep')).filter((b) => b.offsetParent).map((b) => box(b, root))
    // Up runs its title up the right edge, beside the chrome rather than under it
    const top = root.dataset.move === 'up' ? 64 : SAFE_TOP
    const inside = (b: typeof t) => b.top >= top && b.bottom <= H - SAFE_BOTTOM && b.left >= 0 && b.right <= W
    // …and its box is pinned top and bottom, so a title with a column too many leaves the box
    // sideways instead of growing it. (scrollWidth can't be asked: a tight line-height always
    // "overflows" its own line box by a few pixels of descender.)
    const slack = parseFloat(getComputedStyle(title).fontSize) * 0.3
    const spills = root.dataset.move === 'up' && words.some((w) => w.offsetLeft < -slack || w.offsetLeft + w.offsetWidth > title.clientWidth + slack
      || w.offsetTop < -slack || w.offsetTop + w.offsetHeight > title.clientHeight + slack)
    const clear = keep.every((b) => b.top >= t.bottom + CLEAR || b.bottom <= t.top - CLEAR || b.left >= t.right + CLEAR || b.right <= t.left - CLEAR)
    if (inside(t) && keep.every(inside) && clear && !spills) break
  }
  // a word in more than one piece is a word that alone overran the measure: let that one hyphenate
  for (const w of words) if (w.getClientRects().length > 1) w.classList.add('hf-hy')
}

/** THE HOUSE FACE — paper, ink, one red point, Helvetica Neue; the composition is the card's `move`
 *  (lib/house-face.ts deals it). The chrome (when stamp, signal pill, expand) is Card's, untouched. */
export function HouseFace({ pick, move }: { pick: Pick; move: HouseMove }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const run = () => fit(el)
    run()
    const ro = new ResizeObserver(run)
    ro.observe(el)
    document.fonts?.ready.then(run).catch(() => {})
    return () => ro.disconnect()
  }, [pick.id, pick.title, move])

  const title = pick.title
  const venue = shortPlace(placeOf(pick))
  const district = resolveGeo(pick).district ?? ''
  const area = district && district.toLowerCase() !== venue.toLowerCase() ? district : ''
  const place = venue || area || 'Amsterdam'
  const cat = CATEGORY_LABEL[pick.category]
  const date = houseDateLine(pick.when)
  const day = houseDay(pick.when)
  const price = (pick.price ?? '').trim()
  const long = isLongTitle(title)
  const lines = move === 'bars' ? barLines(title) : []

  let body: ReactNode
  switch (move) {
    case 'rule': body = <>
      <div className="hf-meta hf-caps hf-keep"><span>{cat}</span><span>{date}</span></div>
      <Title text={title} cls="hf-fit" />
      <div className="hf-end hf-facts hf-keep"><div><b>{place}</b>{venue && area && <><br />{area}</>}</div>{price && <div>{price}</div>}</div>
    </>; break
    case 'light': body = <>
      <Title text={title} cls="hf-fit hf-light" />
      <div className="hf-venue hf-caps hf-keep">{place}{venue && area && <><br />{area}</>}</div>
      <div className="hf-price hf-keep">{price || cat}</div>
    </>; break
    case 'ledger': body = <>
      <Title text={title} cls="hf-fit hf-med" />
      <dl className="hf-rows hf-keep">
        <div><dt>When</dt><dd>{pick.when}</dd></div>
        <div><dt>Where</dt><dd>{place}</dd></div>
        {venue && area && <div className="hf-opt"><dt>Area</dt><dd>{area}</dd></div>}
        {price && <div><dt>Price</dt><dd>{price}</dd></div>}
        <div className="hf-opt"><dt>Kind</dt><dd>{cat}</dd></div>
      </dl>
    </>; break
    case 'margin': body = <>
      <div className="hf-side hf-caps hf-keep">{cat}<br />{date}{price && <><br />{price}</>}</div>
      <span className="hf-point" aria-hidden />
      <Title text={title} cls="hf-fit hf-med" />
      <div className="hf-venue hf-facts hf-keep">{[venue, area].filter(Boolean).join(' · ') || 'Amsterdam'}</div>
    </>; break
    case 'num': body = <>
      <span className="hf-big" aria-hidden>{day?.day}</span>
      <Title text={title} cls="hf-fit hf-med" />
      <div className="hf-foot hf-caps hf-keep"><span>{place}</span><span>{day ? `${day.dow} · ` : ''}{cat}</span></div>
    </>; break
    case 'up': body = <>
      <div className="hf-side hf-caps hf-keep"><b>{place}</b>{date}<br />{cat}</div>
      <Title text={title} cls="hf-fit" />
    </>; break
    case 'bars': body = <>
      <h2 className="hf-title hf-lines hf-fit" lang="nl">{lines.map((l, i) => <span key={i} className="hf-line">{l}</span>)}</h2>
      <div className="hf-foot hf-facts hf-keep"><span><b>{place}</b></span><span>{date}</span></div>
    </>; break
    case 'emph': body = <>
      <Title text={title} cls="hf-fit" bold={emphasisIndex(title)} />
      <div className="hf-foot hf-facts hf-keep"><span><b>{place}</b></span><span>{date}{price && ` · ${price}`}</span></div>
    </>; break
  }

  return <div ref={ref} className={`hf hm-${move}`} data-move={move} data-len={long ? 'long' : 'short'} data-sparse={isSparse(pick) || undefined}
    style={{ '--hf-w': move === 'bars' ? longestRun(lines) : longestRun(title) } as CSSProperties}>
    {body}
  </div>
}
