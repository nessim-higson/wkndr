// SCOUTED FINDS — the "did you hear about the new…" layer (V.7.14).
//
// Agent-scouted, human-curated fresh finds: new openings, pop-ups, limited runs that the structured
// sources don't carry yet. The slate lives in scripts/taste/scouted.json (each find name-verified against
// a real source page; images URL-verified at scout time). Ingested every run like any adapter, so finds
// survive refreshes; they graduate out by being +CANON'd (→ evergreen), killed (→ veto), or expiring.
// id prefix web-scout- (live; images trusted-but-screened like iams/lbb). Never throws.
import type { Pick, Category, Mode } from '../../src/types'
import scouted from '../taste/scouted.json'

const ALL: Mode[] = ['HOT', 'WARM', 'COOL', 'COLD_WET', 'VOLATILE']
const FAIR: Mode[] = ['HOT', 'WARM', 'COOL']
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)

export function scoutedExtract(cityKey: string): Pick[] {
  if (cityKey !== 'amsterdam') return []
  return (scouted as Record<string, string | null>[]).flatMap((f): Pick[] => {
    if (!f || typeof f.title !== 'string') return []
    const category = (f.category ?? 'out') as Category
    const outdoor = category === 'out' || /rooftop|beach|terras|strand|open.?air|openlucht/i.test(String(f.title) + String(f.blurb ?? ''))
    return [{
      id: `web-scout-${slug(f.title)}`,
      title: String(f.title).slice(0, 90),
      venue: String(f.venue ?? f.title).slice(0, 60),
      area: String(f.area ?? '').slice(0, 40),
      when: String(f.when ?? 'Now open').slice(0, 60),
      category,
      freshness: 'new',
      outdoor,
      kid: false,
      price: String(f.price ?? '').slice(0, 30),
      image: typeof f.image === 'string' && f.image.startsWith('http') ? f.image : undefined,
      blurb: String(f.blurb ?? '').slice(0, 160),
      why: String(f.why ?? 'New find').slice(0, 60),
      source: 'Fresh find',
      link: typeof f.link === 'string' && f.link.startsWith('http') ? f.link : 'https://www.iamsterdam.com',
      weatherFit: outdoor ? [...FAIR] : [...ALL],
      verify: false,
    }]
  })
}
