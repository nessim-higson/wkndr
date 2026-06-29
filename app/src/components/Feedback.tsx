import { useState } from 'react'
import './Feedback.css'

// FEEDBACK WIDGET (for friend/family test rounds). A small floating button → a sheet with a quick
// sentiment + note → POSTs to a Formspree endpoint (no backend; Formspree emails Ness + logs a
// dashboard). The form id is PUBLIC by design (client-embedded, spam-filtered by Formspree), so it's
// safe to commit. Until it's set, the widget gracefully falls back to a prefilled mailto so feedback
// still works. Every submit carries CONTEXT (version + which screen/card) so notes aren't vague.
const FORM = 'https://formspree.io/f/xykqpwkw'   // Formspree → emails Ness + logs a dashboard
const FORM_READY = !/REPLACE_ME/.test(FORM)
const MAILTO = 'ness@iamalwayshungry.com'

export function Feedback({ getContext }: { getContext: () => Record<string, string> }) {
  const [open, setOpen] = useState(false)
  const [sentiment, setSentiment] = useState<'up' | 'down' | null>(null)
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const reset = () => { setOpen(false); setStatus('idle'); setNote(''); setSentiment(null) }
  const canSend = !!note.trim() || !!sentiment

  const submit = async () => {
    if (!canSend) return
    setStatus('sending')
    const ctx = getContext()
    const payload: Record<string, string> = {
      sentiment: sentiment ?? '', note: note.trim(), from: name.trim() || 'anon', ...ctx, ua: navigator.userAgent,
    }
    try {
      if (FORM_READY) {
        const r = await fetch(FORM, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) throw new Error('post failed')
      } else {
        // fallback while the Formspree endpoint isn't wired yet
        const body = encodeURIComponent(
          `${sentiment ? `[${sentiment}] ` : ''}${note.trim()}\n\n— ${payload.from}\n\n` +
          `context: ${Object.entries(ctx).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
        window.location.href = `mailto:${MAILTO}?subject=${encodeURIComponent('WKNDR feedback')}&body=${body}`
      }
      setStatus('sent')
      setTimeout(reset, 1700)
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <button className="fb-fab" onClick={() => setOpen(true)} aria-label="Send feedback">
        <span aria-hidden>✦</span> Feedback
      </button>

      {open && (
        <div className="fb-scrim" onClick={reset}>
          <div className="fb-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Send feedback">
            {status === 'sent' ? (
              <div className="fb-done">Thanks 🙏<span>Got it — keep ’em coming.</span></div>
            ) : (
              <>
                <div className="fb-head">
                  <div className="fb-title">Quick feedback</div>
                  <button className="fb-x" onClick={reset} aria-label="Close">✕</button>
                </div>
                <div className="fb-sent">
                  <button className={sentiment === 'up' ? 'on' : ''} onClick={() => setSentiment('up')}>👍 Love it</button>
                  <button className={sentiment === 'down' ? 'on' : ''} onClick={() => setSentiment('down')}>👎 Feels off</button>
                </div>
                <textarea
                  className="fb-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="What’s working? What’s confusing, missing, or broken?" />
                <input
                  className="fb-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)" />
                <button className="fb-send" disabled={!canSend || status === 'sending'} onClick={submit}>
                  {status === 'sending' ? 'Sending…' : status === 'error' ? 'Try again' : 'Send'}
                </button>
                {status === 'error' && <div className="fb-err">Couldn’t send — check connection and retry.</div>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
