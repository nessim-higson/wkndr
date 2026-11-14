// EASE — a value that never pops (2026-10-26).
//
// Every change the pane shows — a new sky, a new drop map, the sun moving an hour under the
// scrubber's thumb, the wind of the next hour — used to land as one `smoothstep` over 1.6 s, and
// the air layers (snow, now rain) switched with it. iOS Weather never lets a change land: it
// dissolves, slowly, on an ease that starts and ends at rest. This is that: a set of numbers that
// move from where they ARE to where they are asked to be, over `ms`, on a smootherstep (zero
// velocity at both ends). Asking again mid-flight starts from the value showing at that moment,
// so a scrubber dragged through six hours never jumps back to a stale start.
//
// Pure: the clock is passed in, so a test can walk it.

/** Perlin's smootherstep: C2 at both ends, so a dissolve that starts or stops is never felt. */
export function smoother(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

export class Eased {
  private from: Float32Array
  private to: Float32Array
  private t0 = -Infinity
  private ms = 1
  constructor(initial: ArrayLike<number>) {
    this.from = Float32Array.from(initial)
    this.to = Float32Array.from(initial)
  }
  /** aim at `target` over `ms`, starting from whatever shows at `now` */
  set(target: ArrayLike<number>, ms: number, now: number) {
    const cur = this.at(now)
    this.from.set(cur)
    this.to.set(target)
    this.ms = Math.max(1, ms)
    this.t0 = now
  }
  /** land on `target` at once (the first frame, a reset) */
  jump(target: ArrayLike<number>) {
    this.from.set(target); this.to.set(target); this.t0 = -Infinity
  }
  /** the values showing at `now` */
  at(now: number): Float32Array {
    const k = smoother((now - this.t0) / this.ms)
    const out = new Float32Array(this.to.length)
    for (let i = 0; i < out.length; i++) out[i] = this.from[i] + (this.to[i] - this.from[i]) * k
    return out
  }
  /** still moving at `now`? */
  active(now: number): boolean { return now - this.t0 < this.ms }
  get target(): Float32Array { return this.to }
}
