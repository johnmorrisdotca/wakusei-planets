// Riding along: the camera sits at a moving point (a moon, a planet, a satellite someone else tracks) and looks at the body it goes round. This file is the maths of where it looks, pure,
// so a page or a test can ask the same question the space view does. It knows no satellites: any point with a place and a way of going will do, and any central body, by its radius.
import { cross, dot, length, RAD, scale, unit, add, type Vec3 } from "../vec.ts";

/** How far the ground moves in the picture for each pixel of a drag at the middle of it: the same pace as the line globe and the Earth from space (about one and a half). */
const GRAB = 1.5;

/**
 * The field of view, in degrees, of a camera riding along at zoom 1.
 *
 * @example
 * ```ts
 * import { RIDE_FOV } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(RIDE_FOV);
 * ```
 */
export const RIDE_FOV = 60;

/**
 * Where a riding camera looks: `down` straight at the centre of the body it goes round (the ground goes by under the camera), or `horizon` tipped forward along the way it is going until the horizon
 * is a little above the middle of the view.
 *
 * @example
 * ```ts
 * import type { RideLook } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const looks: RideLook[] = ["down", "horizon"];
 * console.log(looks.join(" or "));
 * ```
 */
export type RideLook = "down" | "horizon";

/**
 * What `ridePose` is asked: the camera's place from the centre of the body it goes round and its way of travel (any length), that body's radius in the unit of the place, where it looks,
 * and the shared controls' yaw, tilt and zoom.
 *
 * @example
 * ```ts
 * import type { RideInput } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const input: RideInput = { position: [1.066, 0, 0], velocity: [0, 0, -7.66], radius: 1, look: "down", yaw: 0, tilt: 0, zoom: 1 };
 * console.log(input.look);
 * ```
 */
export interface RideInput {
  /** The camera's place from the centre of the body it goes round, in any unit, in the scene's axes. */
  position: Vec3;
  /** Its direction of travel, in any unit: only the direction is used. */
  velocity: Vec3;
  /** The radius of the body it goes round, in the unit of `position` (1 when the place is in radii of that body). */
  radius: number;
  look: RideLook;
  /** The shared controls' yaw in degrees (a drag across the view is 180): turns the camera to look along its picture's left, so the ground moves right. 0 has the way it is going at the top of the picture. */
  yaw: number;
  /** The shared controls' tilt in degrees (a drag down the view is 60): tips the camera to look towards the bottom of its picture, so the ground moves up. */
  tilt: number;
  /** 1 is the natural view; more narrows the field of view. */
  zoom: number;
}

/**
 * The camera `ridePose` works out: where it is, which way it looks, which way is up in the picture, its field of view in degrees, and how big the body looks from there (its angular radius in degrees).
 *
 * @example
 * ```ts
 * import type { RidePose } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const describe = (pose: RidePose): string => `looking ${pose.forward.map((n) => n.toFixed(2)).join(",")} with a ${pose.fov} degree view`;
 * console.log(typeof describe);
 * ```
 */
export interface RidePose {
  position: Vec3;
  forward: Vec3;
  up: Vec3;
  fov: number;
  /** The angular radius of the body it goes round, in degrees: 90 when the camera is on or inside it. */
  bodyRadiusDegrees: number;
}

/**
 * The camera of a body-borne view: at `position`, looking at the body it goes round (a Moon over the Earth, a moon over Jupiter, a spacecraft over Mars: any centre, by `radius`), with the way
 * it is going at the top of the picture. `look: "horizon"` tips it forward until the horizon is a little above the middle. A drag looks about from there, as a head on a pivot does: `yaw` turns the
 * camera to its left and `tilt` tips it towards the bottom of its picture, so the ground follows the pointer (right for a drag right, up for a drag up); the angle for each pixel of the drag is the
 * field of view's, so the pace is the same at any zoom. `zoom` narrows the field of view.
 *
 * @param input - The camera's place, its way of travel, the radius of what it goes round, the look, and the shared controls' yaw, tilt and zoom.
 * @returns The camera's place, forward and up directions (unit vectors), its field of view, and the body's angular radius from there.
 *
 * @example
 * ```ts
 * import { ridePose } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const pose = ridePose({ position: [1.066, 0, 0], velocity: [0, 0, -7.66], radius: 1, look: "down", yaw: 0, tilt: 0, zoom: 1 });
 * console.log(pose.forward.map((n) => n.toFixed(2)).join(","), pose.bodyRadiusDegrees.toFixed(0));
 * ```
 */
export function ridePose(input: RideInput): RidePose {
  const radius = Math.max(1e-12, input.radius);
  const distance = Math.max(1e-9 * radius, length(input.position));
  const nadir = scale(input.position, -1 / distance);
  let ahead: Vec3 = add(input.velocity, scale(nadir, -dot(input.velocity, nadir)));
  if (length(ahead) < 1e-12 * Math.max(1, length(input.velocity))) {
    // no way of travel to go by (or it is straight at the body): north, or east where north is straight down
    const north: Vec3 = [0, 1, 0];
    ahead = add(north, scale(nadir, -dot(north, nadir)));
    if (length(ahead) < 1e-9) ahead = cross([1, 0, 0], nadir);
  }
  ahead = unit(ahead);
  const bodyRadiusDegrees = distance <= radius ? 90 : Math.asin(radius / distance) / RAD;
  const base = input.look === "horizon" ? Math.max(0, bodyRadiusDegrees - 12) * RAD : 0;
  const forward0 = add(scale(nadir, Math.cos(base)), scale(ahead, Math.sin(base)));
  const up0 = add(scale(ahead, Math.cos(base)), scale(nadir, -Math.sin(base)));
  const fov = Math.min(100, Math.max(5, RIDE_FOV / Math.max(0.05, input.zoom)));
  const turn = input.yaw * ((GRAB * fov) / 180) * RAD;
  const lift = input.tilt * ((GRAB * fov) / 60) * RAD;
  const turned = add(scale(forward0, Math.cos(turn)), scale(cross(up0, forward0), Math.sin(turn)));
  const forward = add(scale(turned, Math.cos(lift)), scale(up0, -Math.sin(lift)));
  const up = add(scale(up0, Math.cos(lift)), scale(turned, Math.sin(lift)));
  return { position: [input.position[0], input.position[1], input.position[2]], forward, up, fov, bodyRadiusDegrees };
}
