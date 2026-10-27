// THE SYNC LOOP — one hook that keeps the app's saved / taste / swiped state, the local mirror
// (`wkndr.account.state.v1`) and the account worker in step. See lib/account.ts for the rules.
//
//   app state ──(every change)──▶ mirror ──(debounced, signed in)──▶ PUT /state
//   PUT 409 ──▶ merge(server, mirror) ──▶ apply to app state ──▶ PUT again on the server's version
//   sign-in / load ──▶ GET /state ──▶ merge with the mirror ──▶ apply ──▶ PUT
//
// The mirror is updated from the app's state by a pure, deterministic projection, so applying a
// merged document to the app re-projects to the SAME fingerprint and the loop settles: nothing is
// pushed that was just pulled.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Pick } from '../types'
import type { Taste } from '../taste'
import {
  type AccountState, type SaveEntry, type Session, type LoginResult,
  accountOn, arriving, exchangeCode, fetchState, fingerprint, laterShelf, loadMirror, loadSession, logout as logoutRemote,
  lookBack, mergeState, persistMirror, persistSession, putState, requestLink, snapshotSaves, takeSigninCode, weekOf,
} from './account'

export type AccountStatus = 'idle' | 'sending' | 'sent' | 'off' | 'bad' | 'slow' | 'error' | 'exchanging' | 'expired'
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline'

const PUSH_DEBOUNCE_MS = 1500

export function useAccount(opts: {
  saved: Set<string>
  taste: Taste
  swiped: Set<string>
  picks: Pick[]
  apply: (next: { saved: Set<string>; taste: Taste; swiped: Set<string> | null }) => void
}) {
  const { saved, taste, swiped, picks, apply } = opts
  const [session, setSession] = useState<Session | null>(() => (accountOn() ? loadSession() : null))
  const [status, setStatus] = useState<AccountStatus>('idle')
  const [sync, setSync] = useState<SyncStatus>('local')
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [mirror, setMirror] = useState<AccountState>(() => loadMirror())
  const mirrorRef = useRef(mirror)
  mirrorRef.current = mirror
  const sessionRef = useRef(session)
  sessionRef.current = session
  const applyRef = useRef(apply)
  applyRef.current = apply
  const lastPushed = useRef<string | null>(null)   // the fingerprint the server is known to hold
  const pushTimer = useRef<number | null>(null)
  const inFlight = useRef(false)

  /* ── app state → mirror (the projection) ── */
  useEffect(() => {
    setMirror((m) => {
      const now = new Date()
      const next: AccountState = {
        ...m,
        saves: snapshotSaves(m.saves, saved, picks, now),
        taste,
        declines: { w: weekOf(now.getTime()), ids: [...swiped] },
      }
      return fingerprint(next) === fingerprint(m) ? m : next
    })
  }, [saved, taste, swiped, picks])

  useEffect(() => { persistMirror(mirror) }, [mirror])
  useEffect(() => { persistSession(session) }, [session])

  /* ── a merged document → app state (one place, so the loop can't fan out) ── */
  const adopt = useCallback((doc: AccountState) => {
    const wk = weekOf(Date.now())
    lastPushed.current = fingerprint(doc)
    setMirror(doc)
    applyRef.current({
      saved: new Set(doc.saves.map((e) => e.id)),
      taste: doc.taste,
      swiped: doc.declines.w === wk ? new Set(doc.declines.ids) : null,
    })
  }, [])

  /* ── pull: on sign-in and on every load with a session ── */
  const pull = useCallback(async (s: Session) => {
    setSync('syncing')
    const server = await fetchState(s)
    if (server === null) { setSession(null); setSync('local'); return }   // the session died — signed out, quietly
    if (server === undefined) { setSync('offline'); return }
    const local = mirrorRef.current
    // Same version as we last reconciled with → nothing happened elsewhere; our mirror is the truth
    // and only needs pushing if it moved. Otherwise another device wrote: merge, adopt, push.
    const merged = server.version === local.version ? { ...local, updatedAt: Math.max(local.updatedAt, server.updatedAt) } : mergeState(server, local)
    const doc = { ...merged, version: server.version }
    adopt(doc)
    if (fingerprint(doc) !== fingerprint(server) || server.version === 0) {
      const r = await putState(s, doc)
      if (r.ok) { const stamped = { ...doc, version: r.version, updatedAt: r.updatedAt }; lastPushed.current = fingerprint(stamped); setMirror(stamped); setSyncedAt(r.updatedAt); setSync('synced') }
      else if (r.conflict) { const again = { ...mergeState(r.state, doc), version: r.version }; adopt(again); const r2 = await putState(s, again); if (r2.ok) { setMirror({ ...again, version: r2.version, updatedAt: r2.updatedAt }); setSyncedAt(r2.updatedAt); setSync('synced') } else setSync('offline') }
      else if (r.dead) { setSession(null); setSync('local') }
      else setSync('offline')
    } else { setSyncedAt(server.updatedAt); setSync('synced') }
  }, [adopt])

  // boot: a magic link landed here (#signin=<code>) → swap it; else resume the stored session
  useEffect(() => {
    if (!accountOn()) return
    const code = takeSigninCode()
    if (code) {
      setStatus('exchanging')
      exchangeCode(code).then((s) => {
        if (!s) { setStatus('expired'); return }
        setStatus('idle'); setSession(s); void pull(s)
      })
      return
    }
    const s = loadSession()
    if (s) void pull(s)
  }, [pull])

  /* ── push: the mirror moved while signed in ── */
  useEffect(() => {
    const s = session
    if (!s) return
    const fp = fingerprint(mirror)
    if (fp === lastPushed.current) return
    if (pushTimer.current) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(async () => {
      if (inFlight.current || sessionRef.current !== s) return
      inFlight.current = true
      setSync('syncing')
      const doc = mirrorRef.current
      const r = await putState(s, doc)
      if (r.ok) { lastPushed.current = fingerprint(doc); setMirror((m) => ({ ...m, version: r.version, updatedAt: r.updatedAt })); setSyncedAt(r.updatedAt); setSync('synced') }
      else if (r.conflict) {
        const again = { ...mergeState(r.state, doc), version: r.version }
        adopt(again)
        const r2 = await putState(s, again)
        if (r2.ok) { setMirror((m) => ({ ...m, version: r2.version, updatedAt: r2.updatedAt })); setSyncedAt(r2.updatedAt); setSync('synced') } else setSync('offline')
      }
      else if (r.dead) { setSession(null); setSync('local') }
      else setSync('offline')
      inFlight.current = false
    }, PUSH_DEBOUNCE_MS)
    return () => { if (pushTimer.current) window.clearTimeout(pushTimer.current) }
  }, [mirror, session, adopt])

  /* ── the two gestures ── */
  const signIn = useCallback(async (email: string) => {
    setStatus('sending')
    const r: LoginResult = await requestLink(email.trim())
    setStatus(r === 'sent' ? 'sent' : r)
  }, [])
  const signOut = useCallback(async () => {
    const s = sessionRef.current
    setSession(null); setSync('local'); setSyncedAt(null); setStatus('idle')
    lastPushed.current = null
    // the mirror stays: your saves are still yours on this device — signed out is today's app
    if (s) await logoutRemote(s)
  }, [])
  const resetStatus = useCallback(() => setStatus('idle'), [])

  /* ── the shelf, the pill, the question ── */
  const now = useMemo(() => new Date(), [mirror.saves.length, session])   // eslint-disable-line react-hooks/exhaustive-deps
  const later = useMemo(() => laterShelf(mirror.saves, now), [mirror.saves, now])
  const laterIds = useMemo(() => new Set(later.map((e) => e.id)), [later])
  const arrivingNow = useMemo(() => arriving(mirror, now), [mirror, now])
  const askAbout = useMemo(() => lookBack(mirror, now), [mirror, now])

  const markSeen = useCallback((e: SaveEntry) => {
    setMirror((m) => ({ ...m, later: { ...m.later, [e.id]: { seen: weekOf(Date.now()) } } }))
  }, [])
  const answerWent = useCallback((e: SaveEntry, went: boolean) => {
    setMirror((m) => ({ ...m, went: { ...m.went, [e.id]: { went, at: Date.now() } } }))
  }, [])

  return { session, status, sync, syncedAt, signIn, signOut, resetStatus, later, laterIds, arriving: arrivingNow, askAbout, markSeen, answerWent, saves: mirror.saves }
}
