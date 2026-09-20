import type { HourReading } from './hourly'

/** THE HOUR SCRUBBER (2026-09-20). Drag through the weekend's forecast: the sky follows the thumb
 *  live (scene + the sun's grade), and the deck re-deals for that hour's weather when you let go —
 *  re-ranking on every tick would shuffle cards under a moving finger. "Now" returns to the real sky. */
export function TimeScrub({ stops, idx, nowIdx, onIdx, onCommit }: {
  stops: HourReading[]; idx: number | null; nowIdx: number
  onIdx: (i: number | null) => void; onCommit: (i: number | null) => void
}) {
  if (stops.length < 12) return null
  const at = idx != null ? stops[idx] : null
  const last = stops.length - 1
  const sunAt = stops.findIndex((s) => s.dow === 0)
  const value = idx ?? (nowIdx >= 0 ? nowIdx : 0)
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
  return <div className={`time-scrub${at ? ' on' : ''}`} role="group" aria-label="Scrub the weekend's forecast" onClick={stop} onKeyDown={stop}>
    <button type="button" className="ts-now" aria-pressed={idx == null} onClick={() => { onIdx(null); onCommit(null) }}>Now</button>
    <div className="ts-track">
      <input type="range" min={0} max={last} step={1} value={value}
        aria-label="Hour of the weekend" aria-valuetext={at ? `${at.clock}, ${Math.round(at.temp)} degrees, ${at.sky}, ${at.pop}% rain` : 'Now'}
        onChange={(e) => onIdx(+e.target.value)}
        onPointerUp={(e) => onCommit(+(e.target as HTMLInputElement).value)}
        onKeyUp={(e) => onCommit(+(e.target as HTMLInputElement).value)} />
      <span className="ts-day" style={{ left: 0 }}>Sat</span>
      {sunAt > 0 && <span className="ts-day" style={{ left: `${(sunAt / last) * 100}%` }}>Sun</span>}
      {nowIdx >= 0 && <i className="ts-nowmark" style={{ left: `${(nowIdx / last) * 100}%` }} aria-hidden />}
    </div>
    <span className="ts-read">{at ? `${at.clock} · ${Math.round(at.temp)}° · ${at.pop}%` : 'Drag through the weekend'}</span>
  </div>
}
