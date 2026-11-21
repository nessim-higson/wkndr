// THE AIR — what the wind does to the pane (2026-10-26, Ness: "the weather app on the iPhone is
// lovely — it has subtle movement that has been beautifully dialed in").
//
// Until now every motion in the glass was on its own clock: the clouds drifted at one speed in
// one direction whatever the forecast said. Open-Meteo's hourly feed carries the wind at 10 m —
// speed and the direction it blows FROM — so the sky can move the way the day does: a still day
// is still, a front moves, and the rain in the air leans with the wind. This file is the pure,
// testable half: a forecast wind → the two numbers the shader reads. Bounded on purpose: a gale is
// a firm lean, never a cartoon.
//
// THE WINDOW FACES SOUTH. A direction needs a viewer: the plates are skies lit from ahead, which
// puts the sun — and so the south — in front of you. Looking south, west is on your right, so a
// westerly (blowing FROM the west, TOWARD the east) carries the clouds and the rain to your LEFT.
// That is the whole convention; `x` is negative for a westerly, positive for an easterly, and a
// northerly or southerly moves nothing sideways.

export interface Wind {
  /** km/h at 10 m (Open-Meteo's default unit) */
  speed: number
  /** degrees the wind blows FROM, clockwise from north (meteorological) */
  dir: number
}

export interface Air {
  /** −1..1: the wind's push across the window, screen-right positive, already weighted by `force` */
  x: number
  /** 0..1: how much of the wind the pane shows — nothing under a light air, all of it by a fresh breeze */
  force: number
}

export const STILL_AIR: Air = { x: 0, force: 0 }

/** Light air (≤ 4 km/h) moves nothing; a fresh breeze (Beaufort 5, ~30 km/h) is the full effect. */
const CALM = 4, FRESH = 30

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

export function airFor(wind: Wind | null | undefined): Air {
  if (!wind || !Number.isFinite(wind.speed) || !Number.isFinite(wind.dir) || wind.speed < 0) return STILL_AIR
  const force = smooth(clamp01((wind.speed - CALM) / (FRESH - CALM)))
  if (force === 0) return STILL_AIR
  const x = Math.sin(wind.dir * Math.PI / 180) * force   // east component of where it blows TO, mirrored for a south-facing window
  return { x: Math.abs(x) < 1e-9 ? 0 : x, force }
}
