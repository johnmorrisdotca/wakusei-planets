// A smooth move of the standing view's camera from one pose to another (MODULES-1561): from the watched landing's window or ground camera to the standing view or the rover, with no jump cut. Pure: no DOM, no clock reads.
import type { Look } from "./view.ts";

/** How long the move takes by default, in milliseconds. */
export const GLIDE_MS = 1100;

/** Where the camera is and which way it looks: metres east and north of the site, the eye's height in metres (absolute, as the standing view's eye is), and the look. */
export interface Pose {
  east: number;
  north: number;
  up: number;
  look: Look;
}

/**
 * The slow-fast-slow curve of the move: 0 at 0, 1 at 1, and flat at both ends so that it starts and stops without a jolt.
 *
 * @param t - How far through the move, 0 to 1 (outside is held).
 * @returns The share of the way gone, 0 to 1.
 */
export function easeInOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

const turnBetween = (a: number, b: number): number => ((((b - a) % 360) + 540) % 360) - 180;

/**
 * The pose a share `k` of the way from one pose to another: the eye on the straight line between them with its height above the ground blended (so it never goes under a hill between the two places), the azimuth the short way round, and the pitch and the field of view blended. At 0 it is `from` and at 1 it is `to`, exactly.
 *
 * @param from - Where the move starts.
 * @param to - Where it ends.
 * @param k - The share of the way, 0 to 1 (already eased).
 * @param groundAt - The height of the ground at a place, in the same metres as `up`.
 * @returns The blended pose.
 */
export function blendPose(from: Pose, to: Pose, k: number, groundAt: (east: number, north: number) => number): Pose {
  if (!(k > 0)) return { ...from, look: { ...from.look } };
  if (!(k < 1)) return { ...to, look: { ...to.look } };
  const east = from.east + (to.east - from.east) * k;
  const north = from.north + (to.north - from.north) * k;
  const aboveFrom = from.up - groundAt(from.east, from.north);
  const aboveTo = to.up - groundAt(to.east, to.north);
  const up = groundAt(east, north) + aboveFrom + (aboveTo - aboveFrom) * k;
  return {
    east,
    north,
    up,
    look: {
      azimuth: (((from.look.azimuth + turnBetween(from.look.azimuth, to.look.azimuth) * k) % 360) + 360) % 360,
      pitch: from.look.pitch + (to.look.pitch - from.look.pitch) * k,
      fov: from.look.fov + (to.look.fov - from.look.fov) * k,
    },
  };
}
