// A body's pose when no date is given: its axial tilt on the page, how far the viewer looks over its pole, and where the Sun is. Plus the turns that put a longitude
// and latitude on the picture. Pure.
import { BODIES, type BodyFacts, type BodyId } from "./facts.ts";
import type { Pose } from "./ephemeris.ts";
import { cross, dot, DEG, RAD, turn, unit, type Vec3 } from "./vec.ts";

/**
 * Options for a pose when no date is given. Angles are in degrees: `tilt` leans the pole on the page, `pitch` is how far the viewer looks over the pole, `phase` is the Sun–body–viewer angle and `spin` the longitude at the middle of the disc.
 *
 * @example
 * ```ts
 * import { portrait, type PortraitOptions } from "@johnmorrisdotca/wakusei-planets";
 *
 * const options: PortraitOptions = { tilt: 20, pitch: 15, phase: 60 };
 * console.log(portrait("jupiter", options).light.length);
 * ```
 */
export interface PortraitOptions {
  /** The axial tilt on the page: how far the north pole leans to the right of straight up. Default: the body's own tilt (turned to 120 or less). */
  tilt?: number;
  /** How far the viewer looks over the north pole: 0 sees the equator edge-on, 90 looks straight down at the pole. Default 12, or 22 for a body with rings. */
  pitch?: number;
  /** The Sun–body–viewer angle: 0 is full, 90 half, 180 new. Default 38. */
  phase?: number;
  /** The longitude at the middle of the disc, degrees east. Default: the longitude of the body's best-known side. */
  spin?: number;
}

/**
 * The tilt a drawing shows for a body: its obliquity, turned past 120 degrees to the other side (Venus is nearly upside down, so it is drawn nearly upright).
 * @param facts - A body's facts.
 * @returns The tilt in degrees to lean the drawing by.
 *
 * @example
 * ```ts
 * import { BODIES, drawnTilt } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(drawnTilt(BODIES.uranus), drawnTilt(BODIES.venus).toFixed(2));
 * ```
 */
export const drawnTilt = (facts: BodyFacts): number => (facts.tiltDeg > 120 ? facts.tiltDeg - 180 : facts.tiltDeg);

/**
 * A pose from a tilt, a pitch, a phase and a spin: the body as a portrait, with the Sun a little above the left. The same arguments always give the same pose.
 * @param id - The body's name.
 * @param options - The pose's tilt, pitch, phase and spin.
 * @returns The pose, as unit vectors in the viewer's frame.
 *
 * @example
 * ```ts
 * import { portrait } from "@johnmorrisdotca/wakusei-planets";
 *
 * const pose = portrait("mars", { phase: 90 });
 * console.log(pose.light[0] < -0.9);
 * ```
 */
export function portrait(id: BodyId, options: PortraitOptions = {}): Pose {
  const facts = BODIES[id];
  const roll = (options.tilt ?? drawnTilt(facts)) * RAD;
  const pitchDeg = options.pitch ?? (facts.rings !== undefined ? 22 : 12);
  const B = pitchDeg * RAD;
  const pole: Vec3 = [Math.sin(roll) * Math.cos(B), Math.cos(roll) * Math.cos(B), Math.sin(B)];
  const viewer: Vec3 = [0, 0, 1];
  const eq = unit([viewer[0] - dot(viewer, pole) * pole[0], viewer[1] - dot(viewer, pole) * pole[1], viewer[2] - dot(viewer, pole) * pole[2]]);
  const meridian = turn(eq, pole, -(options.spin ?? facts.showLon ?? 0));
  const phase = (options.phase ?? 38) * RAD;
  const lift = 14 * RAD;
  const light = unit([-Math.sin(phase) * Math.cos(lift), Math.sin(lift), Math.cos(phase) * Math.cos(lift)]);
  return { pole, meridian, light };
}

/** The semi-axes of a body that is not a spheroid, as fractions of its radius: along its longitude 0, along its east and along its pole. */
export type Axes = readonly [number, number, number];

/** A longitude and latitude (degrees) as a point on the body, in the viewer's frame (unit radius): x right, y up, z toward the viewer. The flattening squeezes it along the pole; `axes` shape a triaxial body instead. */
export function surfacePoint(pose: Pose, lon: number, lat: number, flattening = 0, axes?: Axes): Vec3 {
  const cl = Math.cos(lat * RAD);
  const east = cross(pose.pole, pose.meridian);
  const x = cl * Math.cos(lon * RAD) * (axes?.[0] ?? 1);
  const y = cl * Math.sin(lon * RAD) * (axes?.[1] ?? 1);
  const z = Math.sin(lat * RAD) * (axes?.[2] ?? 1 - flattening);
  return [pose.meridian[0] * x + east[0] * y + pose.pole[0] * z, pose.meridian[1] * x + east[1] * y + pose.pole[1] * z, pose.meridian[2] * x + east[2] * y + pose.pole[2] * z];
}

/** The outward normal's z at a longitude and latitude: positive when that point faces the viewer. */
export function facing(pose: Pose, lon: number, lat: number, flattening = 0, axes?: Axes): number {
  const cl = Math.cos(lat * RAD);
  const east = cross(pose.pole, pose.meridian);
  const x = (cl * Math.cos(lon * RAD)) / (axes?.[0] ?? 1);
  const y = (cl * Math.sin(lon * RAD)) / (axes?.[1] ?? 1);
  const z = Math.sin(lat * RAD) / (axes?.[2] ?? 1 - flattening);
  return pose.meridian[2] * x + east[2] * y + pose.pole[2] * z;
}

/** The silhouette of a body: its half-width, half-height along the pole's direction and the angle of the pole from straight up, clockwise, in degrees. With `axes` it is the outline of a triaxial body: its long half-width, its short one and the angle of the long one from straight right, clockwise. */
export function silhouette(pose: Pose, flattening: number, axes?: Axes): { a: number; b: number; angle: number } {
  if (axes !== undefined) {
    const east = cross(pose.pole, pose.meridian);
    const cols: [number, number][] = [
      [pose.meridian[0] * axes[0], pose.meridian[1] * axes[0]],
      [east[0] * axes[1], east[1] * axes[1]],
      [pose.pole[0] * axes[2], pose.pole[1] * axes[2]],
    ];
    const sxx = cols.reduce((t, c) => t + c[0] * c[0], 0);
    const syy = cols.reduce((t, c) => t + c[1] * c[1], 0);
    const sxy = cols.reduce((t, c) => t + c[0] * c[1], 0);
    const mean = (sxx + syy) / 2;
    const spread = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
    return { a: Math.sqrt(mean + spread), b: Math.sqrt(Math.max(0, mean - spread)), angle: -0.5 * Math.atan2(2 * sxy, sxx - syy) * DEG };
  }
  const c = 1 - flattening;
  const s = pose.pole[2];
  return { a: 1, b: Math.sqrt(c * c * (1 - s * s) + s * s), angle: Math.atan2(pose.pole[0], pose.pole[1]) * DEG };
}
