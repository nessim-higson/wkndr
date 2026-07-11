// DEV ONLY (stripped from prod builds — the import.meta.env.DEV guard is statically false
// there, so bundlers drop the body): headless/hidden-tab test drivers can't animate — the
// tab's rAF and WAAPI document timeline are both suspended — which freezes framer-motion
// mid-transition (the intro never lifts, no sheet can open, AnimatePresence exits strand),
// so automated verification dead-ends. Two-part fix, applied only when the tab is hidden at
// boot:
//   1. MotionGlobalConfig.skipAnimations — framer's own test-mode switch: animations resolve
//      instantly, so every UI state transition completes.
//   2. An rAF pump off a MessageChannel self-ping for the non-framer loops (the ambient
//      canvas). NOT setInterval: hidden tabs throttle timers to ≥1s. postMessage is exempt.
// MUST be the first import in main.tsx: module bodies run depth-first, so this patches the
// globals before framer-motion ever schedules a frame.
if (import.meta.env.DEV && document.visibilityState === 'hidden') {
  import('framer-motion').then(({ MotionGlobalConfig }) => { MotionGlobalConfig.skipAnimations = true })
  const cbs: FrameRequestCallback[] = []
  window.requestAnimationFrame = (cb) => cbs.push(cb)
  window.cancelAnimationFrame = () => {}
  const ch = new MessageChannel()
  let last = performance.now()
  ch.port1.onmessage = () => {
    const t = performance.now()
    if (t - last >= 33) { last = t; const run = cbs.splice(0); run.forEach((cb) => cb(t)) }
    ch.port2.postMessage(0)
  }
  ch.port2.postMessage(0)
}

export {}
