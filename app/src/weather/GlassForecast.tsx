import { useDialogA11y } from '../lib/useDialogA11y'
import { GLASS_LABELS, GLASS_SCENES, type GlassScene } from './glass'
import type { WeekendWx } from './modes'

export function GlassForecast({ open, onClose, weekend, live, label, preview, onPreview, moving, onMoving }: {
  open: boolean; onClose: () => void; weekend: WeekendWx | null; live: boolean; label?: string;
  preview: GlassScene | null; onPreview: (scene: GlassScene | null) => void;
  moving: boolean; onMoving: (moving: boolean) => void;
}) {
  const ref = useDialogA11y<HTMLDivElement>(open, onClose)
  if (!open) return null
  return <div className="glass-forecast-backdrop" onClick={onClose}>
    <div className="glass-forecast" ref={ref} role="dialog" aria-modal="true" aria-labelledby="glass-forecast-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
      <div className="glass-forecast-head"><h2 id="glass-forecast-title">The weekend outlook</h2><button onClick={onClose}>Done</button></div>
      <p className="glass-forecast-date">{live ? label || 'This weekend' : 'Forecast unavailable'}</p>
      {live && weekend?.days.length ? <dl className="glass-days">{weekend.days.map(d =>
        <div key={d.key}><dt>{d.label}</dt><dd>{d.hi}° / {d.lo}°<span>{d.pop}% rain chance</span></dd></div>
      )}</dl> : <p>The live forecast has not loaded. The background is a visual fallback.</p>}
      <p className="glass-forecast-note">Daily forecast from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>. Rain chance describes the day, not how hard or when it will rain.</p>
      <div className="glass-study">
        <label htmlFor="glass-appearance">Compare the glass</label>
        <select id="glass-appearance" value={preview ?? 'forecast'} onChange={e => onPreview(e.target.value === 'forecast' ? null : e.target.value as GlassScene)}>
          <option value="forecast">Follow the forecast</option>
          {GLASS_SCENES.map(s => <option key={s} value={s}>{GLASS_LABELS[s]}</option>)}
        </select>
        <p className="glass-forecast-note">Appearance previews only. Your cards stay ranked for the actual forecast.</p>
        <label className="glass-motion"><input type="checkbox" checked={moving} onChange={e => onMoving(e.target.checked)} />Animate weather gently</label>
        <p className="glass-forecast-note">Stays still when Reduce Motion is enabled.</p>
      </div>
    </div>
  </div>
}
