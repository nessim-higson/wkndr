import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Mail } from 'lucide-react'
import { useDialogA11y } from '../lib/useDialogA11y'
import type { Session } from '../lib/account'
import type { AccountStatus, SyncStatus } from '../lib/useAccount'
import './InputsSheet.css'
import './AccountSheet.css'

/** THE ACCOUNT SHEET (V.12.2) — sign in with a mailed link, or see what's signed in. The same
 *  paper sheet as "What's feeding this". No password field exists anywhere in the app, on purpose:
 *  the link IS the proof, and the sheet says so in one line rather than asking to be trusted. */
export function AccountSheet({
  open, onClose, session, status, sync, syncedAt, onSignIn, onSignOut, onReset,
}: {
  open: boolean
  onClose: () => void
  session: Session | null
  status: AccountStatus
  sync: SyncStatus
  syncedAt: number | null
  onSignIn: (email: string) => void
  onSignOut: () => void
  onReset: () => void   // back from "check your mail" to the field
}) {
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose)
  const [email, setEmail] = useState('')
  useEffect(() => { if (!open) onReset() }, [open, onReset])   // a closed sheet forgets its sent-state, not the address

  const sent = status === 'sent'
  const busy = status === 'sending' || status === 'exchanging'
  const note =
    status === 'off' ? 'Sign-in mail isn’t switched on yet — the account service is up, the mail key isn’t. Saves stay on this device for now.'
    : status === 'bad' ? 'That doesn’t look like an email address.'
    : status === 'slow' ? 'Too many tries from here — give it ten minutes.'
    : status === 'error' ? 'Couldn’t reach the account service. Try again in a moment.'
    : status === 'expired' ? 'That link has expired or was already used. Ask for a fresh one.'
    : null

  const syncLine =
    sync === 'syncing' ? 'Syncing…'
    : sync === 'offline' ? 'Offline — changes stay here and sync when you’re back.'
    : syncedAt ? `Synced · ${new Date(syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Synced'

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div
            className="sheet acct"
            ref={dialogRef} role="dialog" aria-modal="true" aria-label={session ? 'Your account' : 'Sign in'} tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="sheet-handle" />
            {session ? (
              <>
                <h3 className="sheet-title">Signed in</h3>
                <p className="sheet-sub">{session.email}</p>
                <section className="sheet-block">
                  <h4>Sync</h4>
                  <p>{syncLine}</p>
                </section>
                <section className="sheet-block">
                  <h4>What follows you</h4>
                  <p>Your saves, your taste profile, this week’s passes, the Later shelf and your did-you-go answers. Nothing else — no location, no history, no sharing with anyone.</p>
                </section>
                <button className="sheet-done acct-out" onClick={() => { onSignOut(); onClose() }}>
                  <LogOut size={15} strokeWidth={2.2} /> Sign out on this device
                </button>
                <div className="sheet-version">Free. Signing out keeps what’s on this device.</div>
              </>
            ) : sent ? (
              <>
                <h3 className="sheet-title">Check your mail</h3>
                <p className="sheet-sub">A sign-in link is on its way to <b>{email.trim()}</b>. It works once and lasts 15 minutes — tap it on the device you want signed in.</p>
                <div className="acct-mail"><Mail size={28} strokeWidth={1.6} /></div>
                <button className="acct-again" onClick={onReset}>Use another address</button>
                <button className="sheet-done" onClick={onClose}>Done</button>
              </>
            ) : (
              <>
                <h3 className="sheet-title">Sign in</h3>
                <p className="sheet-sub">Your saves and your taste follow you to any device. No password — we mail you a link.</p>
                <form
                  className="acct-form"
                  onSubmit={(e) => { e.preventDefault(); if (!busy && email.trim()) onSignIn(email) }}
                >
                  <input
                    className="acct-input"
                    type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    aria-label="Email address"
                  />
                  <button className="sheet-done acct-send" type="submit" disabled={busy || !email.trim()}>
                    {status === 'exchanging' ? 'Signing you in…' : status === 'sending' ? 'Sending…' : 'Send me a link'}
                  </button>
                </form>
                {note && <p className={`acct-note${status === 'off' ? ' acct-note--off' : ''}`}>{note}</p>}
                <div className="sheet-version">Free. The link is the only key — nothing exists until you tap it.</div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
