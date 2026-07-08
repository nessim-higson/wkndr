// LAST-RESORT BOUNDARY — a render crash used to be a white screen (V.7.11's bad feed produced
// exactly that; the fix hardened the data path but not the blast radius). This catches whatever
// still slips through and degrades to a branded "reload" state instead of a blank page — which
// matters most for a share-link recipient who has never seen the app work and won't try twice.
// Class component because error boundaries still have no hook equivalent.
import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { broke: boolean }> {
  state = { broke: false }
  static getDerivedStateFromError() { return { broke: true } }
  componentDidCatch(err: unknown) { console.error('wkndr: render crash', err) }
  render() {
    if (!this.state.broke) return this.props.children
    return (
      <div style={{
        minHeight: '100dvh', display: 'grid', placeContent: 'center', gap: 14,
        background: 'var(--paper, #faf8f3)', color: 'var(--ink, #1a1a1a)',
        textAlign: 'center', padding: 24,
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>WKNDR</div>
        <p style={{ margin: 0, color: 'var(--ink-3, #5a5a5a)', maxWidth: 260 }}>
          Something broke mid-render. Your saves are safe — reload and carry on.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            justifySelf: 'center', padding: '10px 22px', borderRadius: 999,
            background: 'var(--ink, #1a1a1a)', color: 'var(--paper, #faf8f3)', fontWeight: 600,
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
