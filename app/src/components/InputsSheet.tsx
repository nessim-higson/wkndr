import { AnimatePresence, motion } from 'framer-motion'
import type { Mode } from '../types'
import type { Source } from '../data/sources'
import { MODE_META } from '../weather/modes'
import { APP_VERSION } from '../version'
import './InputsSheet.css'

/** Exposes every input feeding the recommendations — the credibility / source-trace.
 *  Roster is passed in from the active city so this travels with the feed. */
export function InputsSheet({
  open, onClose, mode, hi, lo, live, activeCount,
  roster, rosterCount, cityLabel, seed, feedAt,
}: {
  open: boolean
  onClose: () => void
  mode: Mode
  hi: number
  lo: number
  live: boolean
  activeCount: number
  roster: Record<string, Source[]>
  rosterCount: number
  cityLabel: string
  seed?: boolean
  feedAt?: string | null
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="sheet-handle" />
            <h3 className="sheet-title">What’s feeding this brief</h3>
            <p className="sheet-sub">Every input behind today’s picks. We signal &amp; link — never republish.</p>

            <section className="sheet-block">
              <h4>Weather · this weekend</h4>
              <p>
                <b>Open-Meteo</b> {live ? 'weekend forecast' : '(preview)'} → <b>{MODE_META[mode].label}</b> ·
                {' '}H {hi}° L {lo}°. The picks are ranked for the <b>coming weekend's</b> outlook,
                not today. Production adds <b>Buienradar</b> (5-min rain) + <b>KNMI</b>.
              </p>
            </section>

            <section className="sheet-block">
              <h4>Sources · {rosterCount} in the {cityLabel} roster</h4>
              <p className="sheet-note">This weekend’s brief drew on {activeCount}. The full roster WKNDR reads from:</p>
              {Object.entries(roster).map(([group, list]) => (
                <div className="sheet-group" key={group}>
                  <div className="sheet-group-label">{group}</div>
                  <div className="sheet-sources">
                    {list.map((s) => (
                      <a key={s.name} className="sheet-src" href={s.url} target="_blank" rel="noreferrer">
                        ↳ {s.name}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="sheet-block">
              <h4>Pipeline</h4>
              <p>
                {feedAt
                  ? <>Served from a <b>generated feed</b> (refresh pipeline) · {new Date(feedAt).toLocaleString()}.</>
                  : <>Served from the <b>bundled snapshot</b> (no live feed loaded).</>}
                {' '}Adapters normalize → dedupe → fill og:images → publish <code>picks.json</code>.
              </p>
            </section>

            <section className="sheet-block">
              <h4>Ranking</h4>
              <p>Re-ranked by <b>weather-fit × freshness</b> for this weekend. Your swipes add a <b>taste</b> signal next (Phase 4).</p>
            </section>

            <section className="sheet-block">
              <h4>For</h4>
              <p>{cityLabel} · Ness — kids treated as a cross-cut lens, not a separate feed.</p>
            </section>

            <div className="sheet-version">WKNDR v{APP_VERSION} · {cityLabel} · {seed ? 'seed set (pre-crawl)' : 'hand-curated snapshot'}</div>
            <button className="sheet-done" onClick={onClose}>Done</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
