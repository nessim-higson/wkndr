import { type ReactNode, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Baby, Check, ChevronLeft, Clock, Cloud, CloudRain, Coffee, House, Share, Umbrella, User, Users } from 'lucide-react'
import type { Pick, SwipeDir } from '../types'
import type { Taste } from '../taste'
import { type Company, type Pair, type PairPick, type Profile, type RainTake, applyCompany, applyPair, applyRain, applyRoundSwipe, pickPairs, pickSwipes, revealOf } from '../onboarding'
import { cssUrl } from '../lib/image'
import { useDialogA11y } from '../lib/useDialogA11y'
import type { Session } from '../lib/account'
import type { AccountStatus } from '../lib/useAccount'
import { SwipeStack } from './SwipeStack'
import './Onboarding.css'

// ─── ONBOARDING (phase 1) — a minute to learn your taste ──────────────────────────────────
// Arrive → who's with you → six this-or-that pairs → twelve real swipes → how you take rain →
// the taste card (+ an optional sign-in). The logic is pure and tested in onboarding.ts; this
// file only renders it. Answers accumulate in a local Taste and are committed ONCE, on "See your
// weekend" (or on Skip, with whatever was answered so far): the deck re-deals the moment it's done.

type Step = 'arrive' | 'company' | 'pairs' | 'swipe' | 'rain' | 'reveal'
interface Snap { step: Step; pairIdx: number; acc: Taste; saved: string[]; declined: string[] }
export interface OnboardResult { taste: Taste; saved: string[]; declined: string[]; profile: Profile }

const WHO: { key: Company; label: string; sub: string; Icon: typeof User }[] = [
  { key: 'solo', label: 'Just me', sub: 'Solo plans, easy to book', Icon: User },
  { key: 'partner', label: 'A partner', sub: 'Dates, dinners, slow days', Icon: Users },
  { key: 'friends', label: 'Friends', sub: 'Groups and nights out', Icon: Users },
  { key: 'kids', label: 'Kids', sub: 'Family days rank higher', Icon: Baby },
]
const RAIN: { key: RainTake; label: string; sub: string; Icon: typeof User }[] = [
  { key: 'stay', label: 'Stay in somewhere warm', sub: 'Saunas, brown cafés, long lunches', Icon: Coffee },
  { key: 'indoors', label: 'Swap to indoors', sub: 'Same energy, under a roof', Icon: House },
  { key: 'anyway', label: 'Go anyway', sub: 'A coat is a coat', Icon: Umbrella },
]
const ORDER: Step[] = ['company', 'pairs', 'swipe', 'rain']

export function Onboarding({ deck, taste, temp, skyWord, account, onDone }: {
  deck: Pick[]                 // the served deck, ranked for this weekend's weather
  taste: Taste                 // usually empty: onboarding adds to it, never replaces it
  temp?: number
  skyWord: string              // "dry", "rain" … for the arrival pill
  account: { on: boolean; session: Session | null; status: AccountStatus; signIn: (email: string) => void }
  onDone: (r: OnboardResult) => void
}) {
  const pairs = useMemo<Pair[]>(() => pickPairs(deck), [deck])
  const swipes = useMemo(() => pickSwipes(deck, new Set(pairs.flatMap((p) => [p.a.id, p.b.id]))), [deck, pairs])
  const fan = useMemo(() => deck.filter((p) => p.image).slice(0, 3), [deck])

  const [snap, setSnap] = useState<Snap>({ step: 'arrive', pairIdx: 0, acc: taste, saved: [], declined: [] })
  const [history, setHistory] = useState<Snap[]>([])
  const [company, setCompany] = useState<Company[]>([])
  const [rain, setRain] = useState<RainTake | null>(null)
  const [swipeIdx, setSwipeIdx] = useState(0)
  const [email, setEmail] = useState('')
  const { step } = snap

  const go = (next: Partial<Snap>) => { setHistory((h) => [...h, snap]); setSnap((s) => ({ ...s, ...next })) }
  const back = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1)); setSnap(prev)
    if (prev.step === 'swipe' || step === 'swipe') setSwipeIdx(0)   // a swipe round restarts whole, never half-counted
  }
  const finish = (acc: Taste = snap.acc) => onDone({
    taste: applyRain(acc, rain), saved: snap.saved, declined: snap.declined,
    profile: { company, rain, at: new Date().toISOString() },
  })
  const dialogRef = useDialogA11y<HTMLDivElement>(true, () => finish())

  const reveal = useMemo(() => revealOf(applyRain(snap.acc, rain), { company, rain }), [snap.acc, rain, company])

  function choosePair(pick: PairPick) {
    const acc = applyPair(snap.acc, pairs[snap.pairIdx], pick)
    if (snap.pairIdx + 1 < pairs.length) go({ acc, pairIdx: snap.pairIdx + 1 })
    else go({ acc, step: swipes.length ? 'swipe' : 'rain' })
  }
  function onSwipe(p: Pick, dir: SwipeDir) {
    const acc = applyRoundSwipe(snap.acc, p, dir)
    const saved = dir === 'save' ? [...snap.saved, p.id] : snap.saved
    const declined = dir === 'nope' ? [...snap.declined, p.id] : snap.declined
    const n = swipeIdx + 1
    setSwipeIdx(n)
    if (n >= swipes.length) go({ acc, saved, declined, step: 'rain' })
    else setSnap((s) => ({ ...s, acc, saved, declined }))
  }

  // progress: four parts, the current one filling as its round goes
  const part = ORDER.indexOf(step)
  const within = step === 'pairs' ? (snap.pairIdx + 0.5) / Math.max(1, pairs.length)
    : step === 'swipe' ? (swipeIdx + 0.5) / Math.max(1, swipes.length) : 0.5

  const nav = () => (
    <div className="ob-nav">
      <button className="ob-back" onClick={back} aria-label="Back"><ChevronLeft size={22} strokeWidth={2} /></button>
      <div className="ob-bars" aria-hidden="true">
        {ORDER.map((s, i) => <i key={s} className={i < part ? 'd' : i === part ? 'c' : ''} style={i === part ? { ['--p' as string]: `${Math.round(within * 100)}%` } : undefined} />)}
      </div>
      <button className="ob-skip" onClick={() => finish()}>Skip</button>
    </div>
  )
  const eyebrow = (extra?: ReactNode) => (
    <div className="ob-eb">Step {part + 1} <span>of {ORDER.length}</span>{extra}</div>
  )

  return (
    <div className={`ob ob--${step}`} ref={dialogRef} role="dialog" aria-modal="true" aria-label="Set up your taste" tabIndex={-1}>
      {/* enter-only on purpose: an exit-wait (AnimatePresence mode="wait") never released the swipe
          screen — the deck's own card animations held it open, so the rain step never mounted. */}
      <motion.div key={step + (step === 'pairs' ? snap.pairIdx : '')} className="ob-screen"
          initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>

          {step === 'arrive' && (
            <>
              <div className="ob-orb" />
              <div className="ob-top">
                <span className="ob-wm">WKNDR</span>
                <span className="ob-pill">{skyWord === 'rain' ? <CloudRain size={15} /> : <Cloud size={15} />}Amsterdam{temp != null ? ` · ${Math.round(temp)}°` : ''} · {skyWord}</span>
              </div>
              <div className="ob-fan" aria-hidden="true">
                {fan.map((p) => <i key={p.id} style={{ backgroundImage: cssUrl(p.image!) }} />)}
              </div>
              <div className="ob-copy">
                <h1>Your weekend,<br />one swipe away.</h1>
                <p>First, a minute on what a good weekend looks like to you. We'll rank this one around it, and around the weather.</p>
              </div>
              <div className="ob-foot">
                <button className="ob-cta ob-cta--paper" onClick={() => go({ step: 'company' })}>Start <span className="ob-tm">· about a minute</span><ArrowRight size={18} strokeWidth={2.2} /></button>
                <button className="ob-ghost" onClick={() => finish()}>Skip, just show me the weekend</button>
              </div>
            </>
          )}

          {step === 'company' && (
            <>
              {nav()}
              <div className="ob-body">
                {eyebrow()}
                <h2 className="ob-q">Who's usually with you?</h2>
                <p className="ob-help">Pick any. It changes what comes first.</p>
                <div className="ob-tiles">
                  {WHO.map(({ key, label, sub, Icon }) => {
                    const on = company.includes(key)
                    return (
                      <button key={key} className={`ob-tile${on ? ' on' : ''}`} aria-pressed={on}
                        onClick={() => setCompany((c) => on ? c.filter((x) => x !== key) : [...c, key])}>
                        {on && <span className="ob-tick"><Check size={14} strokeWidth={3} /></span>}
                        <span className="ob-icb"><Icon size={22} strokeWidth={1.8} /></span>
                        <span className="ob-tl"><b>{label}</b><span>{sub}</span></span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="ob-foot">
                <button className="ob-cta" onClick={() => go({ step: pairs.length ? 'pairs' : 'swipe', acc: applyCompany(snap.acc, company) })}>
                  {company.length ? 'Continue' : 'Skip this one'}<ArrowRight size={18} strokeWidth={2.2} />
                </button>
              </div>
            </>
          )}

          {step === 'pairs' && pairs[snap.pairIdx] && (() => {
            const pr = pairs[snap.pairIdx]
            return (
              <>
                {nav()}
                <div className="ob-body">
                  {eyebrow(<span className="ob-dots">{pairs.map((_, i) => <i key={i} className={i < snap.pairIdx ? 'd' : i === snap.pairIdx ? 'c' : ''} />)}</span>)}
                  <span className="ob-ctx"><Clock size={15} />{pr.slot}</span>
                  <h2 className="ob-q">You'd rather…</h2>
                  <div className="ob-duel">
                    {([['a', pr.a], ['b', pr.b]] as const).map(([k, p]) => (
                      <button key={p.id} className="ob-dc" style={{ backgroundImage: cssUrl(p.image!) }} onClick={() => choosePair(k)}>
                        <span className="ob-dl"><b>{p.title}</b><span>{p.venue || p.when}</span></span>
                      </button>
                    ))}
                    <span className="ob-or" aria-hidden="true">or</span>
                  </div>
                  <div className="ob-alt"><button onClick={() => choosePair('both')}>Both</button><button onClick={() => choosePair('neither')}>Neither</button></div>
                </div>
              </>
            )
          })()}

          {step === 'swipe' && (
            <>
              {nav()}
              <div className="ob-body">
                {eyebrow()}
                <h2 className="ob-q">Into it, or not?</h2>
                <p className="ob-help">This weekend's real cards. ★ saves it to your weekend.</p>
                <div className="ob-stage"><SwipeStack picks={swipes.slice(swipeIdx)} onSwipe={onSwipe} keysActive /></div>
                <div className="ob-count" aria-live="polite">{Math.min(swipeIdx + 1, swipes.length)} of {swipes.length}</div>
              </div>
            </>
          )}

          {step === 'rain' && (
            <>
              {nav()}
              <div className="ob-body">
                {eyebrow()}
                <div className="ob-sky"><span className="ob-pill"><CloudRain size={15} />All day</span><div><b>11°</b><span>Saturday · heavy rain</span></div></div>
                <h2 className="ob-q">It's pouring. You…</h2>
                <div className="ob-opts" role="radiogroup">
                  {RAIN.map(({ key, label, sub, Icon }) => (
                    <button key={key} role="radio" aria-checked={rain === key} className={`ob-opt${rain === key ? ' on' : ''}`} onClick={() => setRain(key)}>
                      <span className="ob-icb"><Icon size={22} strokeWidth={1.8} /></span>
                      <span className="ob-tl"><b>{label}</b><span>{sub}</span></span>
                      <i className="ob-r" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="ob-foot">
                <button className="ob-cta ob-cta--accent" onClick={() => go({ step: 'reveal' })}>Show me my taste<ArrowRight size={18} strokeWidth={2.2} /></button>
              </div>
            </>
          )}

          {step === 'reveal' && (
            <>
              <div className="ob-rtop">
                <span>Your taste</span>
                {'share' in navigator && (
                  <button className="ob-share" aria-label="Share your taste" onClick={() => navigator.share({ title: 'My WKNDR taste', text: `${reveal.headline} My weekend taste on WKNDR.`, url: location.origin }).catch(() => {})}>
                    <Share size={17} />
                  </button>
                )}
              </div>
              <div className="ob-tc">
                <div className="ob-tk"><span>Your weekend taste</span><span className="ob-wm ob-wm--sm">WKNDR</span></div>
                <h2>{reveal.headline}</h2>
                <div className="ob-tb">
                  {reveal.bars.map((b) => (
                    <div key={b.label}><span>{b.label}</span><i><b style={{ width: `${b.score}%` }} /></i><em>{b.score}</em></div>
                  ))}
                </div>
                {reveal.traits.length > 0 && <div className="ob-traits">{reveal.traits.map((t) => <span key={t}>{t}</span>)}</div>}
              </div>
              {account.on && !account.session && (
                <div className="ob-keep">
                  {account.status === 'sent' ? (
                    <><b>Check your mail</b><p>The link to <b>{email.trim()}</b> keeps this taste on every device. It works once, for 15 minutes.</p></>
                  ) : (
                    <>
                      <b>Keep this taste</b>
                      <p>Sign in and it follows you to any phone, and tunes your Friday email.</p>
                      <form className="ob-fld" onSubmit={(e) => { e.preventDefault(); if (email.trim()) account.signIn(email) }}>
                        <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                          placeholder="you@example.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                          disabled={account.status === 'sending'} />
                        <button type="submit" aria-label="Send me a link" disabled={!email.trim() || account.status === 'sending'}><ArrowRight size={20} strokeWidth={2.2} /></button>
                      </form>
                      {account.status === 'bad' && <p className="ob-note">That doesn't look like an email address.</p>}
                      {account.status === 'error' && <p className="ob-note">Couldn't reach the account service. Your taste is kept on this phone.</p>}
                    </>
                  )}
                </div>
              )}
              <div className="ob-end">
                <button className="ob-cta ob-cta--accent" onClick={() => finish()}>See your weekend<ArrowRight size={18} strokeWidth={2.2} /></button>
              </div>
            </>
          )}
      </motion.div>
    </div>
  )
}
