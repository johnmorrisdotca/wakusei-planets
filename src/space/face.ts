// Which face of the centred body the space view looks at, and the turn that brings a face to the middle: the camera's direction in the body's own fixed frame. Pure.
import { orientation } from "../scene/orient.ts";
import type { BodyId } from "../facts.ts";
import { cross, dot, RAD, unit, type Vec3 } from "../vec.ts";
import { groundDirection } from "./aim.ts";
import { besideMoon, type BesideInput } from "./beside.ts";

/**
 * A place on a body's surface: east longitude and north latitude in the body's own fixed frame, degrees.
 *
 * @example
 * ```ts no-run
 * import type { Face } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const tranquility: Face = { lon: 23.47, lat: 0.67 };
 * console.log(tranquility.lat);
 * ```
 */
export interface Face {
  lon: number;
  lat: number;
}

/**
 * The camera's turn: the view's yaw and tilt, degrees (the view's `center` is given beside it, and the aim is counted from that).
 *
 * @example
 * ```ts no-run
 * import type { FaceView } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const view: FaceView = { yaw: 30, tilt: -10 };
 * console.log(view.yaw);
 * ```
 */
export interface FaceView {
  yaw: number;
  tilt: number;
}

const wrap = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * The longitude and latitude, on the body in the middle of the space view, of the point under the camera: the camera looks along the line from that point through the body's centre. It is the camera's
 * direction (the Earth's ground direction of `center` less the yaw and tilt, as the stars saw it at `anchor`) put into the body's own frame (its pole and prime meridian at `time`, which carry its spin
 * and, for the Moon, its libration). A body that turns with the clock moves under a camera held in the stars, so the same view names another face a minute later.
 *
 * @param body - The body in the middle of the view.
 * @param view - The view's yaw and tilt, degrees.
 * @param centre - The view's `center` (longitude and latitude, degrees).
 * @param anchor - The moment the camera was last pointed, in milliseconds since the Unix epoch.
 * @param time - The moment shown.
 * @returns The point under the camera, longitude from -180 to 180 and latitude from -90 to 90.
 *
 * @example
 * ```ts
 * import { subCameraPoint } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const at = subCameraPoint("moon", { yaw: 0, tilt: 0 }, { lon: 0, lat: 0 }, Date.UTC(2026, 10, 2), Date.UTC(2026, 10, 2));
 * console.log(at.lon.toFixed(0), at.lat.toFixed(0));
 * ```
 */
export function subCameraPoint(body: BodyId, view: FaceView, centre: Face, anchor: number, time: number): Face {
  const d = groundDirection(centre.lon - view.yaw, Math.max(-90, Math.min(90, centre.lat - view.tilt)), anchor);
  const { pole, meridian } = orientation(body, time);
  const east = cross(pole, meridian);
  return { lon: Math.atan2(dot(d, east), dot(d, meridian)) / RAD, lat: Math.asin(Math.max(-1, Math.min(1, dot(d, pole)))) / RAD };
}

/**
 * The yaw and tilt that put a point of the body under the camera: the other way round from {@link subCameraPoint}, for the same centre, anchor and moment. The yaw is the shorter way round from `from`.
 *
 * @param body - The body in the middle of the view.
 * @param face - The point to bring to the middle.
 * @param centre - The view's `center`.
 * @param anchor - The moment the camera was last pointed.
 * @param time - The moment shown.
 * @param from - The yaw the view has now, so that the turn is the shorter way (0 when left out).
 * @returns The yaw and tilt to give the view.
 *
 * @example
 * ```ts
 * import { faceView, subCameraPoint } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const ms = Date.UTC(2026, 10, 2);
 * const turn = faceView("mars", { lon: 100, lat: 20 }, { lon: 0, lat: 0 }, ms, ms);
 * console.log(subCameraPoint("mars", turn, { lon: 0, lat: 0 }, ms, ms));
 * ```
 */
export function faceView(body: BodyId, face: Face, centre: Face, anchor: number, time: number, from = 0): FaceView {
  const { pole, meridian } = orientation(body, time);
  const east = cross(pole, meridian);
  const c = Math.cos(face.lat * RAD);
  const d: Vec3 = [0, 1, 2].map((i) => c * Math.cos(face.lon * RAD) * meridian[i]! + c * Math.sin(face.lon * RAD) * east[i]! + Math.sin(face.lat * RAD) * pole[i]!) as unknown as Vec3;
  const earth = orientation("earth", anchor);
  const lat = Math.asin(Math.max(-1, Math.min(1, dot(d, earth.pole)))) / RAD;
  const lon = Math.atan2(dot(d, cross(earth.pole, earth.meridian)), dot(d, earth.meridian)) / RAD;
  const yaw = centre.lon - lon;
  return { yaw: from + wrap(yaw - from), tilt: centre.lat - lat };
}

/**
 * The longitude and latitude on a body of a direction from its centre in the scene's axes: what a camera standing along that direction has under it. The body's pole and prime meridian are those at `time`.
 *
 * @param body - The body.
 * @param direction - A direction from the body's centre (any length).
 * @param time - The moment, in milliseconds since the Unix epoch.
 * @returns The point on the body under that direction.
 *
 * @example
 * ```ts
 * import { facingPoint } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const ms = Date.UTC(2026, 10, 2);
 * console.log(facingPoint("moon", [0, 1, 0], ms));
 * ```
 */
export function facingPoint(body: BodyId, direction: Vec3, time: number): Face {
  const d = unit(direction);
  const { pole, meridian } = orientation(body, time);
  const east = cross(pole, meridian);
  return { lon: Math.atan2(dot(d, east), dot(d, meridian)) / RAD, lat: Math.asin(Math.max(-1, Math.min(1, dot(d, pole)))) / RAD };
}

/**
 * The direction from a body's centre, in the scene's axes, of a point on its surface at a moment: the unit vector the other way from {@link facingPoint}.
 *
 * @param body - The body.
 * @param face - The point on its surface.
 * @param time - The moment, in milliseconds since the Unix epoch.
 * @returns The unit direction.
 *
 * @example
 * ```ts
 * import { surfaceDirection } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(surfaceDirection("moon", { lon: 0, lat: 0 }, Date.UTC(2026, 10, 2)).map((n) => n.toFixed(2)));
 * ```
 */
export function surfaceDirection(body: BodyId, face: Face, time: number): Vec3 {
  const { pole, meridian } = orientation(body, time);
  const east = cross(pole, meridian);
  const c = Math.cos(face.lat * RAD);
  return [0, 1, 2].map((i) => c * Math.cos(face.lon * RAD) * meridian[i]! + c * Math.sin(face.lon * RAD) * east[i]! + Math.sin(face.lat * RAD) * pole[i]!) as unknown as Vec3;
}

/**
 * The yaw and tilt of a camera beside a moon (the view `ride(moon, { view: "beside" })` gives) that put it on the side of the moon the point is on: the camera stands along the direction from the moon's
 * centre through the point. The camera there is placed by `besideMoon` (beyond the moon, off the line to its planet), so not every point can be reached: the pair returned brings the camera as near as
 * the view goes, and `error` says by how many degrees it is still off.
 *
 * @param input - What `besideMoon` is given, without the yaw and tilt.
 * @param body - The moon.
 * @param face - The point to bring under the camera.
 * @param time - The moment shown.
 * @returns The yaw and tilt, and the angle in degrees between the camera's direction and the wanted one.
 *
 * @example
 * ```ts
 * import { besideFace } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const input = { moon: [60, 0, 0], moonRadius: 0.273, host: [0, 0, 0], hostRadius: 1, sun: [-23000, 0, 0], aspect: 1.6, zoom: 1 } as const;
 * console.log(besideFace(input, "moon", { lon: 180, lat: 0 }, Date.UTC(2026, 10, 2)).error < 90);
 * ```
 */
export function besideFace(input: Omit<BesideInput, "yaw" | "tilt">, body: BodyId, face: Face, time: number): { yaw: number; tilt: number; error: number } {
  const wanted = unit(surfaceDirection(body, face, time));
  const at = (yaw: number, tilt: number): number => {
    const camera = besideMoon({ ...input, yaw, tilt });
    const away = unit([camera.position[0] - input.moon[0], camera.position[1] - input.moon[1], camera.position[2] - input.moon[2]]);
    return Math.acos(Math.max(-1, Math.min(1, dot(away, wanted)))) / RAD;
  };
  let best = { yaw: 0, tilt: 0, error: Infinity };
  for (let yaw = -180; yaw < 180; yaw += 15) {
    for (let tilt = -60; tilt <= 80; tilt += 10) {
      const error = at(yaw, tilt);
      if (error < best.error) best = { yaw, tilt, error };
    }
  }
  for (let step = 8; step > 0.01; step *= 0.6) {
    for (let round = 0; round < 6; round += 1) {
      let moved = false;
      for (const [dy, dt] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
        const error = at(best.yaw + dy, best.tilt + dt);
        if (error < best.error) { best = { yaw: best.yaw + dy, tilt: best.tilt + dt, error }; moved = true; }
      }
      if (!moved) break;
    }
  }
  return { yaw: wrap(best.yaw), tilt: best.tilt, error: best.error };
}
