import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useDialogA11y } from '../lib/useDialogA11y'
import './FilterSheet.css'

export interface FilterOption<K extends string> { key: K; label: string; count?: number }

/** MULTI-SELECT filter sheet — tick several options and they combine (a union). `clearKey` is the
 *  "Everything"/"Any time" option that resets the selection; it reads as on when nothing else is.
 *  Toggling keeps the sheet open (batch your picks); close via the backdrop or Done. */
export function FilterSheet<K extends string>({
  open, onClose, options, selected, onToggle, clearKey, title = 'Show me',
}: {
  open: boolean
  onClose: () => void
  options: FilterOption<K>[]
  selected: readonly string[]  // chosen keys (a subset of the option keys, never clearKey)
  onToggle: (k: K) => void     // toggle one; passing clearKey clears all
  clearKey: K
  title?: string
}) {
  // mobile = a bottom sheet that slides up (native, effortless); desktop = a centred modal that
  // fades + scales in (sliding up from the bottom edge felt foreign on a big screen).
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose)
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 600
  const m = isDesktop
    ? { initial: { opacity: 0, scale: 0.95, y: 6 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.97, y: 6 }, transition: { type: 'spring' as const, stiffness: 440, damping: 34 } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: { type: 'spring' as const, stiffness: 320, damping: 34 } }
  const isOn = (k: K) => (k === clearKey ? selected.length === 0 : selected.includes(k))
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fs-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="fs"
            ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={m.initial} animate={m.animate} exit={m.exit}
            transition={m.transition}
          >
            <div className="fs-handle" />
            <div className="fs-head">
              <h3 className="fs-title">{title}</h3>
              <span className="fs-hint">tap to combine</span>
            </div>
            <div className="fs-options">
              {options.map((o) => {
                const on = isOn(o.key)
                return (
                  <button
                    key={o.key}
                    className={`fs-opt${on ? ' on' : ''}`}
                    onClick={() => onToggle(o.key)}
                  >
                    {on && o.key !== clearKey && <Check className="fs-check" size={14} strokeWidth={3} />}
                    {o.label}
                    {o.count !== undefined && <span className="fs-count">{o.count}</span>}
                  </button>
                )
              })}
            </div>
            <button className="fs-done" onClick={onClose}>Done</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
