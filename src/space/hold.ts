// How the camera holds its direction while time runs: fixed to the stars (the view's own way, and the default), turning with the body in focus (its ground stays still under the viewer as it spins), or turning with a
// pair (the body in focus and a companion keep the same framing as the two move: the Sun stays behind Mercury at the back left while the camera circles Mercury). Pure: no DOM, no three.js, no clock.
//
// The camera looks at the body in focus from a direction `aim`, a unit vector from the body to the camera. Fixed to the stars, `aim` is the same vector for ever. In the other two frames it is carried by a basis that
// turns with the thing it is held to: `aim` at a later moment is the vector that has the same three numbers in that moment's basis as `aim` had in the first moment's. The body's basis is its meridian, its east and
// its pole; the pair's is the direction to the companion, the side of it round the axis of their orbit, and the axis. A drag changes `aim` and the new framing is then carried the same way.
import { BODIES, type BodyId, type MoonId } from "../facts.ts";
import { orientation, moonOffset } from "../scene/orient.ts";
import { add, cross, dot, RAD, scale, sub, type Vec3 } from "../vec.ts";
import { frameAt } from "./frame.ts";
import { hostOf } from "./bodies.ts";
import { moonDistance, placeBodies, radiusIn, type ScaleMode } from "./scale.ts";

/**
 * How the camera holds its direction while time runs: `stars` (fixed to the stars, today's way and the default), `body` (turning with the body in focus, so its ground stays still under the viewer as it spins) and `pair`
 * (turning with the body in focus and a companion, so the companion stays at the same place in the picture).
 *
 * @example
 * ```ts
 * import type { FrameKind } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const frame: FrameKind = "pair";
 * console.log(frame);
 * ```
 */
export type FrameKind = "stars" | "body" | "pair";

/**
 * The frames, in the order a control lists them.
 *
 * @example
 * ```ts
 * import { FRAMES } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(FRAMES.join(", "));
 * ```
 */
export const FRAMES: readonly FrameKind[] = ["stars", "body", "pair"];

/**
 * A frame from what a page wrote (an attribute or a property): `body` and `pair` as written, anything else `stars`.
 *
 * @param value - What was written.
 * @returns The frame.
 *
 * @example
 * ```ts
 * import { readFrame } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(readFrame("pair"), readFrame("nonsense"));
 * ```
 */
export function readFrame(value: unknown): FrameKind {
  return value === "body" || value === "pair" ? value : "stars";
}

/**
 * Three unit vectors square to one another, right-handed (`a` cross `b` is `c`): the axes a direction is carried by.
 *
 * @example
 * ```ts
 * import type { HoldBasis } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const basis: HoldBasis = { a: [1, 0, 0], b: [0, 1, 0], c: [0, 0, 1] };
 * console.log(basis.c);
 * ```
 */
export interface HoldBasis {
  a: Vec3;
  b: Vec3;
  c: Vec3;
}

const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
const unit = (v: Vec3): Vec3 => {
  const n = length(v);
  return n === 0 ? [0, 0, 0] : [v[0] / n, v[1] / n, v[2] / n];
};

/**
 * Whether a body has a rotation the package knows: a moon that keeps one face to its planet, or a body whose prime meridian turns. A body without one cannot be turned with.
 *
 * @param id - A body's name.
 * @returns True when the body's ground turns in a way the package can work out.
 *
 * @example
 * ```ts
 * import { hasRotation } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(hasRotation("mars"));
 * ```
 */
export function hasRotation(id: BodyId): boolean {
  const facts = BODIES[id];
  return facts.synchronous === true || facts.prime.rate !== 0;
}

/**
 * The basis that turns with a body's ground at a moment: its prime meridian, its east and its north pole, in the scene's axes. Null for a body with no known rotation.
 *
 * @param id - A body's name.
 * @param ms - The moment, in milliseconds since the Unix epoch.
 * @returns The basis, or null.
 *
 * @example
 * ```ts
 * import { bodyBasis } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const basis = bodyBasis("mars", Date.UTC(2026, 10, 2));
 * console.log(basis !== null);
 * ```
 */
export function bodyBasis(id: BodyId, ms: number): HoldBasis | null {
  if (!hasRotation(id)) return null;
  const { pole, meridian } = orientation(id, ms);
  return { a: meridian, b: cross(pole, meridian), c: pole };
}

/**
 * The basis that turns with a pair: `a` towards the companion, `c` the axis (the part of `axis` square to `a`, so `axis` need not be), and `b` completing it. As the companion goes round the body in focus the basis
 * turns about the axis by the same angle, and never jumps while `toward` is not along `axis`, which the axis of the pair's own orbit (`pairAxis`) never is.
 *
 * @param toward - The direction from the body in focus to the companion.
 * @param axis - A direction the pair turns about.
 * @returns The basis.
 *
 * @example
 * ```ts
 * import { pairBasis } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const basis = pairBasis([1, 0, 0], [0, 1, 0]);
 * console.log(basis.b);
 * ```
 */
export function pairBasis(toward: Vec3, axis: Vec3): HoldBasis {
  const a = unit(toward);
  const across = sub(axis, scale(a, dot(axis, a)));
  const c = length(across) < 1e-12 ? unit(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])) : unit(across);
  return { a, b: cross(c, a), c };
}

/**
 * The axis a pair turns about: the direction of the angular momentum of the companion's motion about the body in focus at a moment, from where `toward` puts the companion half an hour either side. It is the same axis
 * all the way round an orbit (a moon of Uranus, which goes round over the poles, gets its own), so a basis made with it turns about it and never jumps.
 *
 * @param toward - The direction from the body in focus to the companion at a moment.
 * @param ms - The moment the axis is taken at.
 * @returns A unit vector.
 *
 * @example
 * ```ts
 * import { pairAxis } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const axis = pairAxis((ms) => [Math.cos(ms / 1e8), 0, Math.sin(ms / 1e8)], 0);
 * console.log(axis.map((n) => n.toFixed(2)).join(", "));
 * ```
 */
export function pairAxis(toward: (ms: number) => Vec3, ms: number): Vec3 {
  const half = 1_800_000;
  const was = unit(toward(ms - half));
  const will = unit(toward(ms + half));
  const now = unit(toward(ms));
  const axis = cross(now, sub(will, was));
  return length(axis) < 1e-15 ? unit(cross(now, Math.abs(now[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])) : unit(axis);
}

/**
 * A direction carried from one basis to another: the vector that has in `to` the three numbers `aim` has in `from`.
 *
 * @param aim - The direction, from the body in focus to the camera.
 * @param from - The basis it was framed in.
 * @param to - The basis at the later moment.
 * @returns The direction at the later moment.
 *
 * @example
 * ```ts
 * import { carry } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const turned = carry([1, 0, 0], { a: [1, 0, 0], b: [0, 1, 0], c: [0, 0, 1] }, { a: [0, 1, 0], b: [-1, 0, 0], c: [0, 0, 1] });
 * console.log(turned.map((n) => n.toFixed(2)).join(", "));
 * ```
 */
export function carry(aim: Vec3, from: HoldBasis, to: HoldBasis): Vec3 {
  const x = dot(aim, from.a);
  const y = dot(aim, from.b);
  const z = dot(aim, from.c);
  return [to.a[0] * x + to.b[0] * y + to.c[0] * z, to.a[1] * x + to.b[1] * y + to.c[1] * z, to.a[2] * x + to.b[2] * y + to.c[2] * z];
}

/**
 * A direction pushed away from the line to a companion as far as it takes to keep the companion out of sight behind the body in focus, and no further: the camera on the far side of the body from the companion, looking at
 * the body, has the companion directly behind it. Where `aim` is within `least` radians of the direction away from the companion it is moved to that distance, along the way from the companion's far side that it leans
 * to, so the change is continuous (the companion passing behind the body slides the camera to one side and never makes it jump).
 *
 * @param aim - The direction from the body in focus to the camera.
 * @param toward - The direction from the body in focus to the companion.
 * @param least - How far from straight behind it the camera may be, in radians.
 * @returns The direction, `aim` itself when it is already clear.
 *
 * @example
 * ```ts
 * import { keepClear } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(keepClear([-1, 0, 0], [1, 0, 0], 0.3).map((n) => n.toFixed(2)).join(", "));
 * ```
 */
export function keepClear(aim: Vec3, toward: Vec3, least: number): Vec3 {
  const away = scale(unit(toward), -1);
  const a = unit(aim);
  const angle = Math.atan2(length(cross(a, away)), dot(a, away));
  if (angle >= least) return a;
  const side = sub(a, scale(away, dot(a, away)));
  const out = length(side) < 1e-12 ? unit(cross(away, Math.abs(away[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])) : unit(side);
  return add(scale(away, Math.cos(least)), scale(out, Math.sin(least)));
}

/**
 * Where a body is at a moment, in the scene's places for a scale (Earth radii from the Earth's centre) and its drawn radius. A moon is at its planet's place and offset by its orbit at the scale's distance.
 *
 * @param id - A body's name.
 * @param mode - The scale.
 * @param ms - The moment.
 * @returns The place.
 *
 * @example
 * ```ts
 * import { holdSite } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(holdSite("sun", "compressed", Date.UTC(2026, 10, 2)).radius > 0);
 * ```
 */
export function holdSite(id: BodyId, mode: ScaleMode, ms: number): { at: Vec3; radius: number } {
  const places = placeBodies(mode, frameAt(ms));
  const host = hostOf(id);
  if (host === undefined || id === "moon") return { at: places[id as keyof typeof places], radius: radiusIn(id as Parameters<typeof radiusIn>[0], mode) };
  const real = moonOffset(id as MoonId, ms);
  const d = length(real);
  const hostRadius = radiusIn(host as Parameters<typeof radiusIn>[0], mode);
  const k = (d === 0 ? 1 : moonDistance(mode, host as Parameters<typeof moonDistance>[1], d) / d) * hostRadius;
  const centre = places[host as keyof typeof places];
  return { at: add(centre, scale(real, k)), radius: Math.max(1e-6, (BODIES[id].radiusKm / BODIES[host as BodyId].radiusKm) * hostRadius) };
}

/**
 * The unit direction from one body to another at a moment, in the scene's places for a scale.
 *
 * @param from - The body in focus.
 * @param to - The companion.
 * @param mode - The scale.
 * @param ms - The moment.
 * @returns A unit vector.
 *
 * @example
 * ```ts
 * import { directionBetween } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(directionBetween("mercury", "sun", "compressed", Date.UTC(2026, 10, 2)).length);
 * ```
 */
export function directionBetween(from: BodyId, to: BodyId, mode: ScaleMode, ms: number): Vec3 {
  return unit(sub(holdSite(to, mode, ms).at, holdSite(from, mode, ms).at));
}

/**
 * The controls' yaw and tilt, in degrees, that make the stars' direction (`groundDirection`) at a moment the given direction, for a view whose centre is a longitude and latitude: the inverse of how the view turns yaw and tilt
 * into a direction. A frame that carries the direction uses it to take the stars' direction again from now, with the direction it has now.
 *
 * @param aim - The direction, from the body in focus to the camera.
 * @param centre - The view's centre, east longitude and north latitude in degrees.
 * @param ms - The moment the stars' direction is taken at.
 * @returns The yaw and the tilt.
 *
 * @example
 * ```ts
 * import { controlsFor, groundDirection } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const now = Date.UTC(2026, 10, 2);
 * const { yaw, tilt } = controlsFor(groundDirection(20 - 30, 10 - 5, now), { lon: 20, lat: 10 }, now);
 * console.log(yaw.toFixed(1), tilt.toFixed(1));
 * ```
 */
export function controlsFor(aim: Vec3, centre: { lon: number; lat: number }, ms: number): { yaw: number; tilt: number } {
  const { pole, meridian } = orientation("earth", ms);
  const east = cross(pole, meridian);
  const lat = Math.asin(Math.max(-1, Math.min(1, dot(aim, pole)))) / RAD;
  const lon = Math.atan2(dot(aim, east), dot(aim, meridian)) / RAD;
  return { yaw: ((((centre.lon - lon + 180) % 360) + 360) % 360) - 180, tilt: centre.lat - lat };
}
