// How the camera leaves one body for the next: the named transitions John picks between, and the curves of a glide. Pure: numbers in, numbers out; the scene turns them into a camera.
//
//   turn-travel  the default: swing round the body being left until the destination is in the frame beside it, then travel to it with the destination in frame the whole way
//   direct       a slow launch, then straight at the destination (the way it went before, with a gentler start)
//   look-back    pull away watching the body being left, then turn to the destination over the last part of the trip
//   auto         `direct` when the destination is in view where the trip starts, `turn-travel` when it is not
//   cut          no glide: the view is at the destination at once (what a reader who prefers reduced motion gets)

/**
 * The names of the transitions: `turn-travel` (the default), `direct`, `look-back`, `auto` and `cut`.
 *
 * @example
 * ```ts
 * import { TRANSITIONS } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(TRANSITIONS.join(", "));
 * ```
 */
export const TRANSITIONS = ["turn-travel", "direct", "look-back", "auto", "cut"] as const;

/**
 * One of the names in `TRANSITIONS`.
 *
 * `turn-travel` never shows an empty frame: the camera first swings round the body it is leaving, keeping that body in view, until the destination is in the frame beside it (a point or a marked dot when it is
 * too small to see); then it travels toward the destination, which stays in the frame and grows, with the leaving and the arrival slow and the middle fast; then it settles. At every moment one of the two bodies is on the screen.
 *
 * @example
 * ```ts
 * import type { Transition } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const how: Transition = "look-back";
 * console.log(how);
 * ```
 */
export type Transition = (typeof TRANSITIONS)[number];

/**
 * How long the slow launch lasts by default, in milliseconds: the camera takes this long to cover the first fifth of the trip, so the departure is seen.
 *
 * @example
 * ```ts
 * import { DEFAULT_LAUNCH_MS } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(DEFAULT_LAUNCH_MS);
 * ```
 */
export const DEFAULT_LAUNCH_MS = 500;

/**
 * How long the turn to the destination lasts by default in `look-back`, in milliseconds: the last stretch of the trip.
 *
 * @example
 * ```ts
 * import { DEFAULT_TURN_MS } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(DEFAULT_TURN_MS);
 * ```
 */
export const DEFAULT_TURN_MS = 700;

/**
 * Reads a transition from what a page or an attribute says: a name in `TRANSITIONS` in any case, else `fallback`.
 *
 * @param value - The text.
 * @param fallback - What to answer for text that is none of the names (`turn-travel` by default).
 * @returns The transition.
 *
 * @example
 * ```ts
 * import { readTransition } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(readTransition("Look-Back"), readTransition("sideways"), readTransition(null, "auto"));
 * ```
 */
export function readTransition(value: unknown, fallback: Transition = "turn-travel"): Transition {
  const name = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (TRANSITIONS as readonly string[]).includes(name) ? (name as Transition) : fallback;
}

/**
 * Reads a time in milliseconds from a number or the text of an attribute: from 0 up to ten seconds, and `fallback` for anything that is not a number.
 *
 * @param value - The number or text.
 * @param fallback - What to answer for a value that is none.
 * @returns Milliseconds.
 *
 * @example
 * ```ts
 * import { readMs } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(readMs("800", 500), readMs(-5, 500), readMs("slow", 500), readMs(99_999, 500));
 * ```
 */
export function readMs(value: unknown, fallback: number): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(10_000, Math.max(0, n));
}

/**
 * The transition a trip really takes: `auto` is `direct` when the destination is in view where the trip starts and `turn-travel` when it is not; the others are themselves.
 *
 * @param wanted - What was asked for.
 * @param destinationInView - Whether the destination is on the screen now.
 * @returns `turn-travel`, `direct`, `look-back` or `cut`.
 *
 * @example
 * ```ts
 * import { chooseTransition } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(chooseTransition("auto", true), chooseTransition("auto", false), chooseTransition("cut", false));
 * ```
 */
export function chooseTransition(wanted: Transition, destinationInView: boolean): "turn-travel" | "direct" | "look-back" | "cut" {
  if (wanted === "auto") return destinationInView ? "direct" : "turn-travel";
  return wanted;
}

/**
 * How far round the body being left the camera has swung in `turn-travel`, from 0 to 1, after `elapsedMs`: a smooth swing over `turnMs`, scaled up for a wide angle so a half turn is not hurried (a quarter turn takes `turnMs`).
 *
 * @param elapsedMs - Time since the trip began.
 * @param turnMs - How long a quarter turn takes.
 * @param angleDeg - How far the camera must swing, in degrees.
 * @returns 0 at the start, 1 once the destination is framed.
 *
 * @example
 * ```ts
 * import { swingProgress } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(swingProgress(0, 700, 90), swingProgress(700, 700, 90), swingProgress(700, 700, 180).toFixed(2));
 * ```
 */
export function swingProgress(elapsedMs: number, turnMs: number, angleDeg: number): number {
  return smooth(elapsedMs / swingDuration(turnMs, angleDeg));
}

/**
 * How long the swing of `turn-travel` takes for an angle: `turnMs` for a quarter turn or less, longer in proportion for more, never under 150 milliseconds.
 *
 * @param turnMs - How long a quarter turn takes.
 * @param angleDeg - The swing's angle in degrees.
 * @returns Milliseconds.
 *
 * @example
 * ```ts
 * import { swingDuration } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(swingDuration(700, 30), swingDuration(700, 180));
 * ```
 */
export function swingDuration(turnMs: number, angleDeg: number): number {
  return Math.max(150, turnMs * Math.max(1, angleDeg / 90));
}

/**
 * How far along the travel leg of `turn-travel` the camera is, from 0 to 1, with the leaving and the arrival slow and the middle fast: a smoothstep of a smoothstep over `glideDuration(launchMs)`.
 *
 * @param elapsedMs - Time since the travel leg began.
 * @param launchMs - The launch time, which sets the leg's length as `glideDuration` does.
 * @returns The share of the way covered.
 *
 * @example
 * ```ts
 * import { travelProgress } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(travelProgress(0, 500), travelProgress(430, 500).toFixed(2), travelProgress(5000, 500));
 * ```
 */
export function travelProgress(elapsedMs: number, launchMs: number): number {
  return smooth(smooth(elapsedMs / glideDuration(launchMs)));
}

/** The smoothstep of `x` from 0 to 1. */
const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** The share of the trip a smoothstep has covered by the point where the launch ends (the launch is the first 29 percent of the time, which covers one fifth of the way). */
const LAUNCH_SHARE = 0.29;

/**
 * How long a whole glide takes, in milliseconds: the slow launch is the first 29 percent of it (and covers the first fifth of the way), and the rest is the same curve running on to the destination, so a longer launch
 * makes a longer glide. With a launch of 0 the glide is a quick 300 milliseconds.
 *
 * @param launchMs - How long the slow launch lasts.
 * @returns The glide's length in milliseconds.
 *
 * @example
 * ```ts
 * import { glideDuration } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(Math.round(glideDuration(500)), glideDuration(0));
 * ```
 */
export function glideDuration(launchMs: number): number {
  return launchMs <= 0 ? 300 : Math.max(300, launchMs / LAUNCH_SHARE);
}

/**
 * How far along the way the camera is, from 0 to 1, after `elapsedMs` of a glide of the given launch: a smoothstep over `glideDuration`, so it starts slowly, speeds up and settles.
 *
 * @param elapsedMs - Time since the glide began.
 * @param launchMs - The launch time.
 * @returns The share of the trip covered.
 *
 * @example
 * ```ts
 * import { glideProgress } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(glideProgress(0, 500), glideProgress(500, 500).toFixed(2), glideProgress(5000, 500));
 * ```
 */
export function glideProgress(elapsedMs: number, launchMs: number): number {
  return smooth(elapsedMs / glideDuration(launchMs));
}

/**
 * How far the camera has turned from looking back at the body it left to looking at its destination, from 0 to 1, in `look-back`: nothing until the last `turnMs` of the glide, then a smooth turn.
 *
 * @param elapsedMs - Time since the glide began.
 * @param launchMs - The launch time.
 * @param turnMs - How long the turn lasts.
 * @returns 0 while still looking back, 1 once it faces the destination.
 *
 * @example
 * ```ts
 * import { glideDuration, turnProgress } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const end = glideDuration(500);
 * console.log(turnProgress(0, 500, 700), turnProgress(end, 500, 700), turnProgress(end - 350, 500, 700));
 * ```
 */
export function turnProgress(elapsedMs: number, launchMs: number, turnMs: number): number {
  const end = glideDuration(launchMs);
  const length = Math.min(end, Math.max(1, turnMs));
  return smooth((elapsedMs - (end - length)) / length);
}
