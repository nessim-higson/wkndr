import { AnimatePresence, motion } from 'framer-motion'
import './FilterSheet.css'

export interface FilterOption<K extends string> { key: K; label: string; count?: number }

/** Buckets the category/kids filters into a tucked-away sheet instead of a chip row. */
export function FilterSheet<K extends string>({
  open, onClose, options, active, onSelect,
}: {
  open: boolean
  onClose: () => void
  options: FilterOption<K>[]
  active: K
  onSelect: (k: K) => void
}) {
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
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="fs-handle" />
            <h3 className="fs-title">Show me</h3>
            <div className="fs-options">
              {options.map((o) => (
                <button
                  key={o.key}
                  className={`fs-opt${active === o.key ? ' on' : ''}`}
                  onClick={() => { onSelect(o.key); onClose() }}
                >
                  {o.label}
                  {o.count !== undefined && <span className="fs-count">{o.count}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
