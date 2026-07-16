import { useEffect, useRef } from 'react'

// Dialog plumbing every sheet/modal needs but none had: focus moves INTO the surface when it
// opens, Tab cycles inside it (never escapes to the deck underneath), Escape closes it, and
// focus RETURNS to whatever opened it on close. Attach the returned ref to the dialog root
// (give that root tabIndex={-1} so it can take focus when it holds no controls).
// Closed sheets in this app unmount entirely, so there's nothing to `inert` here — the one
// always-mounted panel (the header menu) sets `inert` itself.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogA11y<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const root = ref.current
    const focusables = () =>
      root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null) : []

    // let the mount/animation settle a frame, then move focus in
    const t = window.setTimeout(() => (focusables()[0] ?? root)?.focus({ preventScroll: true }), 30)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return }
      if (e.key !== 'Tab' || !root) return
      const els = focusables()
      if (!els.length) { e.preventDefault(); return }
      const i = els.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1].focus() }
      else if (!e.shiftKey && (i === -1 || i === els.length - 1)) { e.preventDefault(); els[0].focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      opener?.focus?.({ preventScroll: true })
    }
  }, [open])

  return ref
}
