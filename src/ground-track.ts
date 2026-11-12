// The ground track of a craft over a body: the date line, the poles, and the circle where the craft stands 10° up.
// Pure: no DOM, no three.js, no clock. chikyu-earth can import this later. Its Earth-only `coverageAngleRad(heightKm)` matches `coverageAngleRad(heightKm, 6371)`.
const RAD = Math.PI / 180;

/**
 * A point on a body: longitude and latitude in degrees. Longitude runs from −180 to 180.
 *
 * @example
 * ```ts
 * import { splitDateLine, type GroundPoint } from "@johnmorrisdotca/wakusei-planets/ground-track";
 *
 * const point: GroundPoint = { lon: 170, lat: 10 };
 * console.log(splitDateLine(point, { lon: -170, lat: 12 }).length);
 * ```
 */
export interface GroundPoint {
  lon: number;
  lat: number;
}

/**
 * The angle at the body's centre, in radians, out to where a craft `heightKm` above the surface is `elevationDeg` above the horizon (10 when left out).
 * 0 when the craft is on the surface or below, or so low that it is never that high. `radiusKm` is the body's radius.
 *
 * @param heightKm - Height above the surface, in kilometres.
 * @param radiusKm - The body's radius, in kilometres.
 * @param elevationDeg - The elevation that still counts, in degrees. 10 when left out.
 * @returns The angle, in radians.
 *
 * @example
 * ```ts
 * import { coverageAngleRad } from "@johnmorrisdotca/wakusei-planets/ground-track";
 *
 * console.log(coverageAngleRad(400, 6371) > coverageAngleRad(50, 1737.4));
 * ```
 */
export function coverageAngleRad(heightKm: number, radiusKm: number, elevationDeg = 10): number {
  const r = radiusKm + heightKm;
  if (!(r > radiusKm) || !(radiusKm > 0)) return 0;
  const elevation = elevationDeg * RAD;
  const cosAlpha = (radiusKm / r) * Math.cos(elevation);
  if (!(cosAlpha < 1)) return 0;
  const alpha = Math.acos(Math.max(-1, cosAlpha));
  return Math.max(0, alpha - elevation);
}

/** A unit vector for a longitude and latitude (+z at longitude 0, +x east, +y north). */
const unitOf = (point: GroundPoint): [number, number, number] => {
  const lon = point.lon * RAD;
  const lat = point.lat * RAD;
  const c = Math.cos(lat);
  return [c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon)];
};

const fromUnit = (x: number, y: number, z: number): GroundPoint => {
  const length = Math.hypot(x, y, z) || 1;
  return { lon: (Math.atan2(x, z) * 180) / Math.PI, lat: (Math.asin(Math.max(-1, Math.min(1, y / length))) * 180) / Math.PI };
};

/**
 * Points from `a` to `b` along the great circle, about `stepDeg` apart, including both ends. A fast clock stays a continuous line.
 *
 * @param a - The start.
 * @param b - The end.
 * @param stepDeg - The longest step, in degrees.
 * @returns The points, including both ends.
 *
 * @example
 * ```ts
 * import { trackSteps } from "@johnmorrisdotca/wakusei-planets/ground-track";
 *
 * console.log(trackSteps({ lon: 0, lat: 0 }, { lon: 10, lat: 0 }, 2).length > 2);
 * ```
 */
export function trackSteps(a: GroundPoint, b: GroundPoint, stepDeg: number): GroundPoint[] {
  const u = unitOf(a);
  const v = unitOf(b);
  const dot = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
  const angle = Math.acos(dot);
  const step = Math.max(0.25, stepDeg) * RAD;
  if (!(angle > step)) return [a, b];
  const count = Math.ceil(angle / step);
  const sin = Math.sin(angle) || 1;
  const out: GroundPoint[] = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const left = Math.sin((1 - t) * angle) / sin;
    const right = Math.sin(t * angle) / sin;
    out.push(fromUnit(u[0] * left + v[0] * right, u[1] * left + v[1] * right, u[2] * left + v[2] * right));
  }
  return out;
}

/**
 * One segment, or two when the short way from `a` to `b` crosses the date line, so an equirectangular line does not cross the whole map.
 * Longitude is degrees, −180 to 180. This is the same split chikyu-earth uses for a satellite over the Earth.
 *
 * @param a - The start.
 * @param b - The end.
 * @returns One segment, or two that meet at ±180.
 *
 * @example
 * ```ts
 * import { splitDateLine } from "@johnmorrisdotca/wakusei-planets/ground-track";
 *
 * console.log(splitDateLine({ lon: 170, lat: 0 }, { lon: -170, lat: 0 }).length);
 * ```
 */
export function splitDateLine(a: GroundPoint, b: GroundPoint): [GroundPoint, GroundPoint][] {
  let delta = b.lon - a.lon;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const end = a.lon + delta;
  if (end <= 180 && end >= -180) return [[a, { lon: end, lat: b.lat }]];
  const edge = end > 180 ? 180 : -180;
  const span = end - a.lon;
  const t = span === 0 ? 0 : (edge - a.lon) / span;
  const lat = a.lat + (b.lat - a.lat) * t;
  const other = edge === 180 ? -180 : 180;
  const rest = end > 180 ? end - 360 : end + 360;
  return [
    [a, { lon: edge, lat }],
    [{ lon: other, lat }, { lon: rest, lat: b.lat }],
  ];
}

/**
 * `splitDateLine`, and a split at a pole when the short way between two high-latitude points would cross the pole.
 * Each piece is safe to draw as a straight line on an equirectangular map.
 *
 * @param a - The start.
 * @param b - The end.
 * @returns The pieces, in order.
 *
 * @example
 * ```ts
 * import { splitTrail } from "@johnmorrisdotca/wakusei-planets/ground-track";
 *
 * console.log(splitTrail({ lon: 10, lat: 80 }, { lon: 170, lat: 75 }).length > 1);
 * ```
 */
export function splitTrail(a: GroundPoint, b: GroundPoint): [GroundPoint, GroundPoint][] {
  let delta = b.lon - a.lon;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  if (Math.abs(delta) > 90 && Math.abs(a.lat) > 45 && Math.abs(b.lat) > 45 && Math.sign(a.lat) === Math.sign(b.lat)) {
    const pole = a.lat > 0 ? 90 : -90;
    return [...splitDateLine(a, { lon: a.lon, lat: pole }), ...splitDateLine({ lon: b.lon, lat: pole }, b)];
  }
  return splitDateLine(a, b);
}
