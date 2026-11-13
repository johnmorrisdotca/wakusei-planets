// Which face of the centred body the space view looks at, and the turn that brings a face to the middle: the camera's direction in the body's own fixed frame. Pure.
import { orientation } from "../scene/orient.ts";
import type { BodyId } from "../facts.ts";
import { cross, dot, RAD, type Vec3 } from "../vec.ts";
import { groundDirection } from "./aim.ts";

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
