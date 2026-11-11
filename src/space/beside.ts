// A camera placed beside and beyond a moon, off the line to the planet it goes round: the moon is large in the foreground and the planet is in view behind it, at its real angular size. Pure: places in, a camera out.
import { add, cross, dot, length, RAD, scale, unit, type Vec3 } from "../vec.ts";

/**
 * How many radii of the moon the camera keeps from it at zoom 1: the moon then spans about 20 degrees of the view.
 *
 * @example
 * ```ts
 * import { BESIDE_RADII } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(BESIDE_RADII);
 * ```
 */
export const BESIDE_RADII = 5.8;
/** The angle off the line from the planet through the moon, in degrees, the camera first tries; it opens wider until the planet clears the moon. */
const FIRST_ANGLE = 25;

/**
 * What `besideMoon` is asked: where the moon, the planet it goes round and the Sun are and how big the moon and the planet are (one unit for all), the shape of the view, and the shared controls' zoom, yaw and tilt.
 *
 * @example
 * ```ts
 * import type { BesideInput } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const input: BesideInput = { moon: [60, 0, 0], moonRadius: 0.273, host: [0, 0, 0], hostRadius: 1, sun: [-23000, 0, 0], aspect: 1.6, zoom: 1, yaw: 0, tilt: 0 };
 * console.log(input.moonRadius);
 * ```
 */
export interface BesideInput {
  moon: Vec3;
  moonRadius: number;
  host: Vec3;
  hostRadius: number;
  sun: Vec3;
  /** The view's width over its height. */
  aspect: number;
  /** 1 keeps `BESIDE_RADII` moon radii from the moon; more goes closer, less goes further. */
  zoom: number;
  /** Degrees the camera swings round the line from the planet through the moon (a drag across the view is 180). */
  yaw: number;
  /** Degrees the camera opens further off that line (a drag down the view is 60). */
  tilt: number;
}

/**
 * The camera `besideMoon` works out: where it is, which way it looks and its up, its vertical field of view in degrees, how far it is from the moon, and the angle in degrees between the moon and the planet as the camera sees them.
 *
 * @example
 * ```ts
 * import type { BesideCamera } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const describe = (camera: BesideCamera): string => `${camera.separation.toFixed(0)} degrees apart in a ${camera.fov.toFixed(0)} degree view`;
 * console.log(typeof describe);
 * ```
 */
export interface BesideCamera {
  position: Vec3;
  forward: Vec3;
  up: Vec3;
  fov: number;
  distance: number;
  separation: number;
}

const angleBetween = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / RAD;
const minus = (a: Vec3, b: Vec3): Vec3 => add(a, scale(b, -1));

/**
 * The camera for a view from near a moon with its planet still in view: beyond the moon on the side away from the planet and a little off the line to it, so the moon is large in the foreground and the planet is behind it,
 * at the angular size it really has from there. The camera sits on the Sun's side of that line where it can, so the moon shows a lit face. It opens off the line, from 25 degrees, until the two discs no longer touch
 * (with 2 degrees to spare), turns the picture so the planet is to one side of the moon, and widens the field of view until both fit the view's narrower side.
 *
 * @param input - The places and sizes, the view's shape, and the zoom, yaw and tilt.
 * @returns The camera.
 *
 * @example
 * ```ts
 * import { besideMoon } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const camera = besideMoon({ moon: [60.3, 0, 0], moonRadius: 0.273, host: [0, 0, 0], hostRadius: 1, sun: [-23000, 5000, 9000], aspect: 1.6, zoom: 1, yaw: 0, tilt: 0 });
 * console.log(camera.distance.toFixed(2), camera.separation.toFixed(0));
 * ```
 */
export function besideMoon(input: BesideInput): BesideCamera {
  const { moon, moonRadius, host, hostRadius } = input;
  const away = unit(minus(moon, host));
  const toSun = unit(minus(input.sun, moon));
  let side: Vec3 = minus(toSun, scale(away, dot(toSun, away)));
  if (length(side) < 1e-3) side = cross(away, [0, 1, 0]);
  if (length(side) < 1e-3) side = cross(away, [1, 0, 0]);
  side = unit(side);
  const distance = Math.max(1.05 * moonRadius, (BESIDE_RADII * moonRadius) / Math.max(1e-9, input.zoom));
  const swing = (v: Vec3): Vec3 => {
    // the camera swings round the line from the planet through the moon by `yaw`
    const turn = input.yaw * RAD;
    return add(add(scale(v, Math.cos(turn)), scale(cross(away, v), Math.sin(turn))), scale(away, dot(away, v) * (1 - Math.cos(turn))));
  };
  const place = (angle: number): { position: Vec3; separation: number } => {
    const direction = swing(add(scale(away, Math.cos(angle * RAD)), scale(side, Math.sin(angle * RAD))));
    const position = add(moon, scale(direction, distance));
    return { position, separation: angleBetween(minus(moon, position), minus(host, position)) };
  };
  const moonHalf = (position: Vec3): number => Math.asin(Math.min(1, moonRadius / Math.max(moonRadius * 1.0001, length(minus(moon, position))))) / RAD;
  const hostHalf = (position: Vec3): number => Math.asin(Math.min(1, hostRadius / Math.max(hostRadius * 1.0001, length(minus(host, position))))) / RAD;
  let angle = Math.max(5, Math.min(85, FIRST_ANGLE + input.tilt));
  let spot = place(angle);
  while (angle < 85 && spot.separation < moonHalf(spot.position) + hostHalf(spot.position) + 2) {
    angle += 2;
    spot = place(angle);
  }
  const { position } = spot;
  const toMoon = unit(minus(moon, position));
  const toHost = unit(minus(host, position));
  // look between the two, and turn the picture so the planet is to the side of the moon, not above or below it
  const forward = unit(add(toMoon, toHost));
  const shift = minus(toHost, toMoon);
  let across = unit(minus(shift, scale(forward, dot(shift, forward))));
  let up = unit(cross(across, forward));
  // the planet may be on either side of the moon, so the picture is turned the way that keeps north (the scene's +y) up: the Earth is never seen south-up from beside the Moon
  if (up[1] < 0) {
    up = scale(up, -1);
    across = scale(across, -1);
  }
  // both discs fit: the half-angle from the middle to the far edge of each, across and up
  const reach = Math.max(angleBetween(forward, toMoon) + moonHalf(position), angleBetween(forward, toHost) + hostHalf(position)) + 3;
  const half = Math.max(Math.tan(reach * RAD) / Math.min(1.6, Math.max(0.3, input.aspect)), Math.tan((moonHalf(position) + 3) * RAD));
  const fov = Math.min(110, Math.max(35, 2 * Math.atan(half) / RAD));
  return { position, forward, up, fov, distance, separation: spot.separation };
}
