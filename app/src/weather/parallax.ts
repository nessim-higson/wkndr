// PARALLAX — where you look from (2026-10-26). The pure half; the listeners are in GlassField.tsx.
//
// iOS Weather's sky answers the hand: tilt the phone and the clouds move a little, the air a
// little less. Two sources feed the pane's `setParallax`: the pointer (a mouse, on desktop) and
// the phone's tilt (DeviceOrientation, behind iOS's permission prompt, asked only after a tap).
// Both are −1..1 on each axis and the pane eases toward them; the shader turns them into a
// percent or two of plate and a few pixels of rain. Off with motion off.
//
// A TILT IS A MOVE, NOT A POSE. A phone held at 50° in bed and one held at 80° on a tram are both
// "straight"; what should move the sky is the CHANGE. So the tilt is read against a rest pose that
// eases toward wherever the phone is held (a few seconds), and a new posture becomes the new still.

/** degrees of tilt, from rest, for the full parallax */
const RANGE = 16
/** seconds for the rest pose to follow the hand */
const REST_TAU = 4

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

export class TiltRest {
  private beta: number | null = null
  private gamma: number | null = null
  /** feed one reading (`beta` front-back, `gamma` left-right, degrees) `dt` seconds after the last;
   *  returns the parallax. A phone past vertical or face down (|beta| > 100) is ignored: gamma flips
   *  sign there and the sky would lurch. */
  read(beta: number, gamma: number, dt: number): [number, number] {
    if (!Number.isFinite(beta) || !Number.isFinite(gamma) || Math.abs(beta) > 100) return [0, 0]
    if (this.beta == null || this.gamma == null) { this.beta = beta; this.gamma = gamma; return [0, 0] }
    const x = clamp((gamma - this.gamma) / RANGE), y = clamp((beta - this.beta) / RANGE)
    const k = 1 - Math.exp(-Math.max(0, dt) / REST_TAU)
    this.gamma += (gamma - this.gamma) * k
    this.beta += (beta - this.beta) * k
    return [x, y]
  }
  reset() { this.beta = null; this.gamma = null }
}

/** the pointer's place in the window → parallax: right positive, UP positive (the pane's y is up) */
export function pointerParallax(x: number, y: number, w: number, h: number): [number, number] {
  if (!(w > 0) || !(h > 0)) return [0, 0]
  return [clamp((x / w - .5) * 2) || 0, clamp(-(y / h - .5) * 2) || 0]   // (|| 0: never a −0)
}
