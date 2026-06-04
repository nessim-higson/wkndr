// Keyless RSS adapter — the always-on floor. Pulls a feed and turns its items into rough Picks
// with NO API key. Honest about its limits: RSS items are articles/roundups, not clean dated
// events, so these are coarse (a card that links to "this week's best…"). Signal + link: we keep
// our OWN minimal blurb and link out — we do NOT republish the feed's description prose.
import type { Pick } from '../../src/types'
import { deriveWeatherFit } from '../lib/pipeline'
import type { RosterSource } from '../roster'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36'

const tag = (block: string, name: string): string => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return ''
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)

export async function rssExtract(source: RosterSource, max = 6): Promise<Pick[]> {
  try {
    const xml = await fetch(source.url, { headers: { 'user-agent': UA, accept: 'application/rss+xml,text/xml' } })
      .then((r) => (r.ok ? r.text() : ''))
    if (!xml) return []
    const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m) => m[0]).slice(0, max)
    return items.map((block): Pick | null => {
      const title = tag(block, 'title')
      let link = tag(block, 'link')
      if (!title || !link.startsWith('http')) return null
      return {
        id: `rss-${slug(source.name)}-${slug(title)}`,
        title: title.slice(0, 90),
        venue: source.name,
        area: '',
        when: 'This weekend',
        category: source.category ?? 'out',
        freshness: 'weekend',
        outdoor: false,
        kid: false,
        price: '',
        blurb: `Featured this week by ${source.name}.`,   // our own line — not their copy
        why: `In this week's ${source.name}`,
        source: source.name,
        link,
        weatherFit: deriveWeatherFit(false),
        verify: true,
      }
    }).filter((p): p is Pick => !!p)
  } catch {
    return []
  }
}
