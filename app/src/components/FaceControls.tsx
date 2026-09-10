import { useEffect, useState } from 'react'
import { GLASS_PATTERNS } from '../lib/card-material'
export const FACE_VARIANTS = [
  ['emboss-ivory', 'F1 · Ivory press'], ['emboss-graphite', 'F2 · Graphite relief'], ['emboss-mineral', 'F3 · Mineral paper'],
  ['weather-solar', 'B1 · Solar relief'], ['weather-rain', 'B2 · Rain etching'], ['weather-cloud', 'B3 · Cloud contour'],
  ['glass-opal', 'E1 · Opal light'], ['glass-smoked', 'E2 · Smoked glass'], ['glass-frosted', 'E3 · Frosted sky'],
] as const
export const CURRENT_VARIANTS = [['weather-current','W1 · Fine etching'],['weather-current-relief','W2 · Soft relief'],['weather-current-atmosphere','W3 · Atmosphere']] as const
export function FaceControls({ value, onChange, options = FACE_VARIANTS }: { value?:string; onChange?:(value:string)=>void; options?:readonly (readonly [string,string])[] }) {
  const [variant, setVariant] = useState('emboss-ivory')
  const selected = value ?? variant
  const [pattern,setPattern] = useState('auto')
  useEffect(()=> { if(pattern === 'auto') delete document.documentElement.dataset.glassOverride; else document.documentElement.dataset.glassOverride=pattern; return ()=>{delete document.documentElement.dataset.glassOverride} },[pattern])
  useEffect(() => { document.documentElement.dataset.face = selected; return () => { delete document.documentElement.dataset.face } }, [selected])
  return <details className="face-controls" open><summary>Card materials</summary><label>Appearance<select value={selected} onChange={e => { setVariant(e.target.value); onChange?.(e.target.value) }}>{options.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>{selected.startsWith('glass') && <label>Glass finish<select value={pattern} onChange={e=>setPattern(e.target.value)}><option value="auto">Varies by card</option>{GLASS_PATTERNS.map(p=><option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}</select></label>}</details>
}
