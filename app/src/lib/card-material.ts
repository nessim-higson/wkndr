export const GLASS_PATTERNS = ['ribbon', 'arc', 'edge', 'fluted', 'prism', 'halo'] as const
/** A card keeps its optical signature across swipes/reloads; no random flicker. */
export function glassSignature(id: string) {
  let hash = 2166136261
  for (const char of id) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0
  return { pattern: GLASS_PATTERNS[hash % GLASS_PATTERNS.length], angle: 118 + hash % 39, offset: 18 + (hash >>> 8) % 29 }
}

export function titleMark(title: string): string {
  if (title.includes('&')) return '&'
  return title.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(word => Array.from(word)[0]).join('').toLocaleUpperCase('nl-NL')
}
