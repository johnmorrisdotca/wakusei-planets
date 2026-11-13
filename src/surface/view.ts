// The camera of a person standing on the Moon: where the eyes are, which way they look and how wide. Pure maths on plain arrays: no three.js, no DOM.
import type { Vec3 } from "../vec.ts";

/**
 * Eye height of a standing person in metres.
 *
 * @example
 * ```ts
 * import { EYE_HEIGHT } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(`eyes ${EYE_HEIGHT} m above the ground`);
 * ```
 */
export const EYE_HEIGHT = 1.7;

/**
 * The widest and the narrowest view, in degrees from the top of the picture to its bottom: zoom is the field of view.
 *
 * @example
 * ```ts
 * import { FOV_LIMITS } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(`zoom runs from ${FOV_LIMITS.min} to ${FOV_LIMITS.max} degrees`);
 * ```
 */
export const FOV_LIMITS = { min: 8, max: 100 } as const;

/**
 * A person's walking pace, metres a second.
 *
 * @example
 * ```ts
 * import { WALK_SPEED } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(`${(WALK_SPEED * 10).toFixed(0)} m in ten seconds`);
 * ```
 */
export const WALK_SPEED = 1.4;

/**
 * Where the eyes look: an azimuth (degrees clockwise from north), a pitch (degrees above the horizon) and a field of view (degrees, top to bottom).
 *
 * @example
 * ```ts
 * import { siteById, type Look } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const look: Look = siteById("apollo-17")!.look;
 * console.log(`toward ${look.azimuth} degrees, ${look.pitch} up, ${look.fov} wide`);
 * ```
 */
export interface Look {
  azimuth: number;
  pitch: number;
  fov: number;
}

/**
 * A look held within what makes sense: the azimuth round the compass, the pitch short of straight up and down, the field of view within `FOV_LIMITS`.
 *
 * @param look - Any look, however far out of range.
 * @returns A new look: the azimuth from 0 up to but not including 360, the pitch from -85 to 85 and the field of view within `FOV_LIMITS`.
 *
 * @example
 * ```ts
 * import { clampLook } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(clampLook({ azimuth: -90, pitch: 120, fov: 200 }));
 * ```
 */
export function clampLook(look: Look): Look {
  return {
    azimuth: ((look.azimuth % 360) + 360) % 360,
    pitch: Math.max(-85, Math.min(85, look.pitch)),
    fov: Math.max(FOV_LIMITS.min, Math.min(FOV_LIMITS.max, look.fov)),
  };
}

/**
 * The direction a look points, in the scene's frame: x to the east, y up and z to the south (so north is -z and a camera looking north has the east on its right).
 *
 * @param look - The look.
 * @returns A unit vector.
 *
 * @example
 * ```ts
 * import { forward } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(forward({ azimuth: 90, pitch: 0, fov: 60 }).map((n) => n.toFixed(2)).join(", "));
 * ```
 */
export function forward(look: Look): Vec3 {
  const az = (look.azimuth * Math.PI) / 180;
  const p = (look.pitch * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(p), Math.sin(p), -Math.cos(az) * Math.cos(p)];
}

/** The camera's right, up and forward axes in the scene's frame for a look: what a flat thing that faces the viewer is drawn along. */
export function cameraAxes(look: Look): { right: Vec3; up: Vec3; forward: Vec3 } {
  const f = forward(look);
  // right = forward x (0, 1, 0), up = right x forward
  let rx = -f[2];
  let rz = f[0];
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  return { right: [rx, 0, rz], up: [-rz * f[1], rz * f[0] - rx * f[2], rx * f[1]], forward: f };
}

/**
 * The view and projection together, as a column-major 4 x 4 matrix (a float array of sixteen numbers) for a vertex shader: eyes at `eye` in the scene's frame, looking along `look`.
 *
 * @param eye - Where the eyes are, in the scene's frame (east, up, south), in metres.
 * @param look - Which way they look and how wide.
 * @param aspect - The picture's width over its height.
 * @param near - The nearest distance drawn, in metres.
 * @param far - The farthest distance drawn, in metres.
 * @returns The sixteen numbers of the matrix, column by column.
 *
 * @example
 * ```ts
 * import { viewProjection } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const matrix = viewProjection([0, 1.7, 0], { azimuth: 0, pitch: 0, fov: 60 }, 16 / 9);
 * console.log(matrix.length);
 * ```
 */
export function viewProjection(eye: Vec3, look: Look, aspect: number, near = 0.3, far = 600_000): Float32Array {
  const { right: r, up: u, forward: f } = cameraAxes(look);
  const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const view = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, eye), -dot(u, eye), dot(f, eye), 1];
  const t = 1 / Math.tan((look.fov * Math.PI) / 360);
  const proj = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += proj[k * 4 + row]! * view[c * 4 + k]!;
      out[c * 4 + row] = sum;
    }
  }
  return out;
}

/**
 * A position moved over the ground by a walk: `ahead` metres along the look's heading (negative backs up) and `aside` to its right, in the site's plane (east, north).
 *
 * @param position - Where the walker is, in metres east and north of the site.
 * @param azimuth - The heading, in degrees clockwise from north.
 * @param ahead - Metres along the heading; negative backs up.
 * @param aside - Metres to the right of the heading; negative goes left.
 * @returns The new position, in metres east and north of the site.
 *
 * @example
 * ```ts
 * import { stepOver } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(stepOver({ east: 0, north: 0 }, 0, 10, 0));
 * ```
 */
export function stepOver(position: { east: number; north: number }, azimuth: number, ahead: number, aside: number): { east: number; north: number } {
  const az = (azimuth * Math.PI) / 180;
  const sin = Math.sin(az);
  const cos = Math.cos(az);
  return { east: position.east + ahead * sin + aside * cos, north: position.north + ahead * cos - aside * sin };
}
