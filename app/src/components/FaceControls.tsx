import { useEffect, useState } from 'react'
export const FACE_VARIANTS = [
  ['emboss-ivory', 'F1 · Ivory press'], ['emboss-graphite', 'F2 · Graphite relief'], ['emboss-mineral', 'F3 · Mineral paper'],
  ['weather-solar', 'B1 · Solar relief'], ['weather-rain', 'B2 · Rain etching'], ['weather-cloud', 'B3 · Cloud contour'],
  ['glass-opal', 'E1 · Opal light'], ['glass-smoked', 'E2 · Smoked glass'], ['glass-frosted', 'E3 · Frosted sky'],
] as const
export function FaceControls() {
  const [variant, setVariant] = useState('emboss-ivory')
  useEffect(() => { document.documentElement.dataset.face = variant; return () => { delete document.documentElement.dataset.face } }, [variant])
  return <details className="face-controls" open><summary>Card materials</summary><label>Appearance<select value={variant} onChange={e => setVariant(e.target.value)}>{FACE_VARIANTS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></details>
}
