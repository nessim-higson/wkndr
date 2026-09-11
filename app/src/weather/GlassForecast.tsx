import { GLASS_PATTERNS } from '../lib/card-material'
import { useDialogA11y } from '../lib/useDialogA11y'
import { GLASS_LABELS, GLASS_SCENES, type GlassScene } from './glass'
import type { WeekendWx } from './modes'

export function GlassForecast({ open, onClose, weekend, live, label, preview, onPreview, moving, onMoving, shell, onShell, face, onFace, finish, onFinish }: {
  shell:string; onShell:(v:string)=>void; face:string; onFace:(v:string)=>void; finish:string; onFinish:(v:string)=>void;
  open: boolean; onClose: () => void; weekend: WeekendWx | null; live: boolean; label?: string;
  preview: GlassScene | null; onPreview: (scene: GlassScene | null) => void;
  moving: boolean; onMoving: (moving: boolean) => void;
}) {
  const ref = useDialogA11y<HTMLDivElement>(open, onClose)
  if (!open) return null
  return <div className="glass-forecast-backdrop" onClick={onClose}>
    <div className="glass-forecast" ref={ref} role="dialog" aria-modal="true" aria-labelledby="glass-forecast-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
      <div className="glass-forecast-head"><h2 id="glass-forecast-title">Interface & weather</h2><button onClick={onClose}>Done</button></div>
      <div className="glass-study">
        <label>Interface<select value={shell} onChange={e=>onShell(e.target.value)}><option value="open">01 · Open glass</option><option value="floating">02 · Floating header</option></select></label>
        <label>No-photo material<select value={face} onChange={e=>onFace(e.target.value)}><option value="glass-opal">Opal glass</option><option value="glass-smoked">Smoked glass</option><option value="glass-frosted">Frosted glass</option><option value="emboss-ivory">Blind emboss</option></select></label>
        {face.startsWith('glass') && <label>Glass finish<select value={finish} onChange={e=>onFinish(e.target.value)}><option value="auto">Varies by card</option>{GLASS_PATTERNS.map(p=><option key={p} value={p}>{p}</option>)}</select></label>}
      </div>
      <p className="glass-forecast-date">{live ? label || 'This weekend' : 'Forecast unavailable'}</p>
      {live && weekend?.days.length ? <dl className="glass-days">{weekend.days.map(d =>
        <div key={d.key}><dt>{d.label}</dt><dd>{d.hi}° / {d.lo}°<span>{d.pop}% rain chance</span></dd></div>
      )}</dl> : <p>The live forecast has not loaded. The background is a visual fallback.</p>}
      <p className="glass-forecast-note">Daily forecast from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. Rain chance describes the day, not how hard or when it will rain.</p>
      <div className="glass-study">
        <label htmlFor="glass-appearance">Compare the glass</label>
        <select id="glass-appearance" value={preview ?? 'forecast'} onChange={e => onPreview(e.target.value === 'forecast' ? null : e.target.value as GlassScene)}>
          <option value="forecast">Current Amsterdam weather</option>
          {GLASS_SCENES.map(s => <option key={s} value={s}>{GLASS_LABELS[s]}</option>)}
        </select>
        <p className="glass-forecast-note">Background follows a timestamped current Amsterdam model estimate. Other choices are appearance previews only. Cards stay ranked for the weekend forecast.</p>
        <label className="glass-motion"><input type="checkbox" checked={moving} onChange={e => onMoving(e.target.checked)} />Animate weather gently</label>
        <p className="glass-forecast-note">Stays still when Reduce Motion is enabled.</p>
      </div>
    </div>
  </div>
}
