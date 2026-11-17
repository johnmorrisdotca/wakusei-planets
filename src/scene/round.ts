// A body that looks round wherever it is in the picture. A perspective camera draws a sphere away from the middle of the picture as an ellipse, long along the line to the middle: at an angle `theta` off the line of sight
// the ellipse is about `1 / cos(theta)` as long as it is wide, and a wide window's edge is 40 degrees or more off it. The body is drawn as the ellipsoid that makes a circle: the sphere squeezed along that line, across the
// line of sight to its centre, by the factor the cone of sight from the camera needs for a circular section by the picture's plane (the circular sections of an elliptic cone: tan(theta)^2 = (1/A^2 - 1/B^2) / (1/B^2 + 1)
// for a cone of half-angles A across the squeezed way and B across the other, and with B = r / sqrt(d^2 - r^2) the factor A / B is below). The body's colours, lighting and texture are still the sphere's own; only where
// its points land on the screen changes, in the vertex shaders (`ROUND_GLSL`), by `squashPoint`'s sum. Pure, no allocation beyond the arrays themselves.
import { dot, length, type Vec3 } from "../vec.ts";

/** How a body is squeezed to look round: along the unit `axis` (about the body's centre, in the scene's axes) to `k` times its length, `k` from 0 to 1, 1 for no change. */
export interface Round {
  axis: Vec3;
  k: number;
}

/** No squeeze. */
export const NOT_SQUEEZED: Round = { axis: [1, 0, 0], k: 1 };

/** The weight of the squeeze falls to nothing as the body's edge gets this close to 90 degrees off the line of sight (in radians): there the plane of the picture cuts the cone of sight in a curve that is no ellipse. */
const FADE_FROM = (75 * Math.PI) / 180;
const FADE_TO = (88 * Math.PI) / 180;

/**
 * How the body at `centre` with `radius` is squeezed to look round to a perspective camera at `eye` looking along `forward` (a unit vector), in the scene's axes. A body in the middle of the picture, one the camera is in
 * or at, and one behind it are not squeezed.
 *
 * @param eye - The camera's place.
 * @param forward - The way the camera looks, a unit vector.
 * @param centre - The body's centre.
 * @param radius - The body's radius.
 * @returns The squeeze.
 */
export function roundShape(eye: Vec3, forward: Vec3, centre: Vec3, radius: number): Round {
  const to: Vec3 = [centre[0] - eye[0], centre[1] - eye[1], centre[2] - eye[2]];
  const d = length(to);
  if (!(d > radius * 1.001) || !(radius > 0)) return NOT_SQUEEZED;
  const sight: Vec3 = [to[0] / d, to[1] / d, to[2] / d];
  const cos = dot(forward, sight);
  if (!(cos > 0)) return NOT_SQUEEZED;
  // the way the line of sight to the body's centre leans to the camera's own, across it
  const lean: Vec3 = [forward[0] - cos * sight[0], forward[1] - cos * sight[1], forward[2] - cos * sight[2]];
  const across = length(lean);
  if (!(across > 1e-9)) return NOT_SQUEEZED;
  const theta = Math.acos(Math.min(1, cos));
  const tan2 = (1 - cos * cos) / (cos * cos);
  const half = Math.asin(radius / d);
  const k = 1 / Math.sqrt(1 + (tan2 * d * d) / (d * d - radius * radius));
  // the whole of the squeeze while the body's far edge is well inside the picture's plane's reach, none as it nears 90 degrees
  const t = Math.min(1, Math.max(0, (theta + half - FADE_FROM) / (FADE_TO - FADE_FROM)));
  const weight = 1 - t * t * (3 - 2 * t);
  return { axis: [lean[0] / across, lean[1] / across, lean[2] / across], k: 1 - weight * (1 - k) };
}

/**
 * How much wider across a body is drawn off the middle of the picture than on it: a perspective camera draws the same body `1 / cos(theta)` as wide at `theta` off the line of sight (the picture's plane is that much
 * farther from the camera there). With the body drawn round, this is the factor on its radius on the screen; the on-axis radius is `(height / 2) * r / sqrt(d^2 - r^2) / tan(fov / 2)` pixels.
 *
 * @param eye - The camera's place.
 * @param forward - The way the camera looks, a unit vector.
 * @param centre - The body's centre.
 * @returns 1 in the middle of the picture, more out from it; 1 for a body behind the camera.
 */
export function edgeStretch(eye: Vec3, forward: Vec3, centre: Vec3): number {
  const to: Vec3 = [centre[0] - eye[0], centre[1] - eye[1], centre[2] - eye[2]];
  const d = length(to);
  if (!(d > 0)) return 1;
  const cos = dot(forward, to) / d;
  return cos > 0.2 ? 1 / cos : 1;
}

/**
 * Where a point of the body goes when the body is squeezed: the same shift the vertex shaders make. For a layer that is laid over the body (a name, a mark) and must stay on its drawn surface.
 *
 * @param point - A point in the scene's axes.
 * @param centre - The body's centre.
 * @param round - The squeeze from `roundShape`.
 * @returns The point moved.
 */
export function squashPoint(point: Vec3, centre: Vec3, round: Round): Vec3 {
  if (round.k >= 1) return point;
  const d: Vec3 = [point[0] - centre[0], point[1] - centre[1], point[2] - centre[2]];
  const along = (1 - round.k) * dot(d, round.axis);
  return [point[0] - round.axis[0] * along, point[1] - round.axis[1] * along, point[2] - round.axis[2] * along];
}

/**
 * The shader's side of the squeeze: declare the two uniforms and `roundWorld`, which takes a world position and gives the one it is drawn at. The centre is the model matrix's own place (the body's group is at its
 * centre and its meshes are at the group's origin).
 */
export const ROUND_GLSL = /* glsl */ `
uniform vec3 uRoundAxis;
uniform float uRoundK;
vec4 roundWorld(vec4 w) {
  if (uRoundK < 1.0) {
    vec3 c = modelMatrix[3].xyz;
    vec3 d = w.xyz - c;
    w.xyz = c + d - (1.0 - uRoundK) * uRoundAxis * dot(d, uRoundAxis);
  }
  return w;
}`;
