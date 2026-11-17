// What the flat map shows at a moment, as numbers: where the Sun is overhead, where each orbiter is over the ground, the shading of the night side, a craft's coverage circle and its ground track cut for a flat map.
// Pure: no DOM, no clock reads (the moment is always given).
import { splitTrail, type GroundPoint } from "../ground-track.ts";
import { orbiterElements, orbiterGround, orbiterGroundTrack, orbiterNumbers, orbiterDim, type OrbiterId, type OrbiterStatus } from "../orbiters.ts";
import { subSolarPoint } from "../places.ts";
import { flatBody, type FlatBodyId } from "./bodies.ts";
import { pixelsPerDegree, wrapLongitude, type FlatView } from "./geometry.ts";

const RAD = Math.PI / 180;

/**
 * Where the Sun is overhead on a body: latitude and east longitude in degrees, from the package's own ephemeris and the body's IAU pole and prime meridian. The longitude is in -180 up to 180, like the map's.
 *
 * @param body - `moon` or `mars`.
 * @param ms - Milliseconds since 1970 (UTC).
 * @returns The point.
 *
 * @example
 * ```ts
 * import { flatSun } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const sun = flatSun("moon", Date.UTC(1969, 6, 20, 20, 17, 40));
 * console.log(sun.lon.toFixed(0), "east: the Sun is low in the east at Tranquility Base");
 * ```
 */
export function flatSun(body: FlatBodyId, ms: number): GroundPoint {
  const sun = subSolarPoint(flatBody(body).id, ms);
  return { lat: sun.lat, lon: wrapLongitude(sun.lon) };
}

/**
 * One orbiter as the flat map shows it at a moment.
 *
 * @example
 * ```ts
 * import { flatOrbiter, type FlatOrbiter } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const lro: FlatOrbiter = flatOrbiter("lro", Date.UTC(2026, 10, 12))!;
 * console.log(lro.status, lro.dim);
 * ```
 */
export interface FlatOrbiter {
  id: OrbiterId;
  /** The point on the ground under it: degrees, longitude in -180 up to 180. */
  lat: number;
  lon: number;
  /** Its height above the surface in kilometres. */
  altitudeKm: number;
  /** Where its path comes from at this moment (`orbiterStatus`): `tracked`, `predicted` or `modelled`. */
  status: Exclude<OrbiterStatus, "none">;
  /** True when its position is approximate and the map should draw it faint (`orbiterDim`). */
  dim: boolean;
}

/**
 * Where an orbiter is over the ground at a moment, with its height and how sure its place is. `undefined` for a craft with no public path (Tianwen-1, CAPSTONE), which the map does not draw.
 *
 * @param id - The orbiter.
 * @param ms - Milliseconds since 1970 (UTC).
 * @returns The orbiter, or `undefined`.
 *
 * @example
 * ```ts
 * import { flatOrbiter } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(flatOrbiter("mro", Date.UTC(2026, 10, 12))?.altitudeKm.toFixed(0), flatOrbiter("tianwen-1", Date.UTC(2026, 10, 12)));
 * ```
 */
export function flatOrbiter(id: OrbiterId, ms: number): FlatOrbiter | undefined {
  const ground = orbiterGround(id, ms);
  const numbers = orbiterNumbers(id, ms);
  if (ground === undefined || numbers === undefined || numbers.status === "none") return undefined;
  return { id, lat: ground.lat, lon: wrapLongitude(ground.lon), altitudeKm: numbers.altitudeKm, status: numbers.status, dim: orbiterDim(id, ms) };
}

/**
 * Whether an orbiter has a path the map can draw at all.
 *
 * @param id - The orbiter.
 * @returns False for Tianwen-1 and CAPSTONE.
 *
 * @example
 * ```ts
 * import { hasPath } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(hasPath("lro"), hasPath("tianwen-1"));
 * ```
 */
export const hasPath = (id: OrbiterId): boolean => orbiterElements(id) !== undefined;

/** The shading's smooth step: 0 up to `a`, 1 from `b`, smooth between. */
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Shade the night side into a grid of pixels: for each cell of a `columns` by `rows` grid laid over the view (each cell `cell` pixels of the box on a side), the alpha of the night's colour, from how far the Sun is below the horizon there.
 * Full night is `twilightDeg` below the horizon and the shading is gone a quarter of that above it, so the Moon's edge is sharp and Mars's soft. The cell's longitude wraps round the body, so a map wider than the world is shaded the same at both copies.
 *
 * @param out - The grid, 4 bytes a cell (red, green, blue, alpha), filled in.
 * @param columns - Cells across.
 * @param rows - Cells down.
 * @param cell - The cell's side in pixels of the view.
 * @param view - The map's view.
 * @param sun - Where the Sun is overhead.
 * @param body - `moon` or `mars`: the night's colour and the twilight's width.
 *
 * @example
 * ```ts
 * import { shadeNight } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const view = { width: 8, height: 4, centerLon: 0, centerLat: 0, zoom: 1 };
 * const grid = new Uint8ClampedArray(8 * 4 * 4);
 * shadeNight(grid, 8, 4, 1, view, { lat: 0, lon: 0 }, "moon");
 * console.log(grid[3 + 4 * 0] === 0, grid[3 + 4 * 7]! > 150);
 * ```
 */
export function shadeNight(out: Uint8ClampedArray, columns: number, rows: number, cell: number, view: FlatView, sun: GroundPoint, body: FlatBodyId): void {
  const info = flatBody(body);
  const k = pixelsPerDegree(view);
  const sinSun = Math.sin(sun.lat * RAD);
  const cosSun = Math.cos(sun.lat * RAD);
  const cosDelta = new Float64Array(columns);
  for (let c = 0; c < columns; c += 1) cosDelta[c] = Math.cos(wrapLongitude(view.centerLon + ((c + 0.5) * cell - view.width / 2) / k - sun.lon) * RAD);
  const [r, g, b, top] = info.night;
  const full = -info.twilightDeg;
  const edge = info.twilightDeg / 4;
  for (let row = 0; row < rows; row += 1) {
    const lat = Math.max(-90, Math.min(90, view.centerLat - ((row + 0.5) * cell - view.height / 2) / k)) * RAD;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    for (let c = 0; c < columns; c += 1) {
      const elevation = Math.asin(Math.max(-1, Math.min(1, sinSun * sinLat + cosSun * cosLat * cosDelta[c]!))) / RAD;
      const at = (row * columns + c) * 4;
      out[at] = r;
      out[at + 1] = g;
      out[at + 2] = b;
      out[at + 3] = Math.round(255 * top * (1 - smooth(full, edge, elevation)));
    }
  }
}

/**
 * The outline of the circle on a body's surface that a craft can see: every point `angleDeg` from the point under it, as longitude and latitude with the longitude carried on without a jump (so it can run past 180 and the map draws
 * the circle again a world to the left and right). The outline's last point is its first again; where the circle holds a pole, `pole` is `1` or `-1` and the last point is a whole turn of longitude from the first.
 *
 * @param lat - Latitude of the centre.
 * @param lon - Longitude of the centre.
 * @param angleDeg - The circle's angular radius at the body's centre, in degrees (`coverageAngleRad` in degrees).
 * @param steps - How many steps round it (there are `steps + 1` points, the last being the first again).
 * @returns The points, and whether a pole is inside.
 *
 * @example
 * ```ts
 * import { circleOutline } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const ring = circleOutline(80, 10, 15);
 * console.log(ring.pole, ring.points.length);
 * ```
 */
export function circleOutline(lat: number, lon: number, angleDeg: number, steps = 72): { points: [number, number][]; pole: -1 | 0 | 1 } {
  const theta = Math.min(180, Math.max(0, angleDeg)) * RAD;
  const lat0 = lat * RAD;
  const points: [number, number][] = [];
  let previous = lon;
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps;
    const phi = Math.asin(Math.max(-1, Math.min(1, Math.sin(lat0) * Math.cos(theta) + Math.cos(lat0) * Math.sin(theta) * Math.cos(bearing))));
    const delta = Math.atan2(Math.sin(bearing) * Math.sin(theta) * Math.cos(lat0), Math.cos(theta) - Math.sin(lat0) * Math.sin(phi)) / RAD;
    let next = lon + delta;
    while (next - previous > 180) next -= 360;
    while (next - previous < -180) next += 360;
    previous = next;
    points.push([next, phi / RAD]);
  }
  // a circle that holds a pole runs once round the whole of longitude
  const pole: -1 | 0 | 1 = Math.abs(lat) + angleDeg > 90 ? (lat >= 0 ? 1 : -1) : 0;
  return { points, pole };
}

/**
 * An orbiter's ground track for one trip round: half behind it and half ahead, as points with their moments. The package's own `orbiterGroundTrack`, over one period centred on the moment.
 *
 * @param id - The orbiter.
 * @param ms - Milliseconds since 1970 (UTC): the moment the orbiter is at the track's middle.
 * @param points - How many steps round the trip.
 * @returns The points with their longitude in -180 up to 180, or an empty list for a craft with no path.
 *
 * @example
 * ```ts
 * import { flatTrack } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const track = flatTrack("lro", Date.UTC(2026, 10, 12), 40);
 * console.log(track.length, track.filter((p) => p.ms <= Date.UTC(2026, 10, 12)).length);
 * ```
 */
export function flatTrack(id: OrbiterId, ms: number, points = 160): { lat: number; lon: number; ms: number }[] {
  const days = orbiterElements(id)?.periodDays;
  if (days === undefined) return [];
  const half = (days * 86_400_000) / 2;
  return orbiterGroundTrack(id, ms - half, ms + half, points).map((p) => ({ lat: p.lat, lon: wrapLongitude(p.lon), ms: p.ms }));
}

/**
 * A run of ground points cut into the straight pieces a flat map can draw: each step is split where it crosses the date line or runs over a pole, so no line crosses the whole map.
 *
 * @param points - Points in order, longitude in -180 up to 180.
 * @returns Pieces, each from one point to the next, longitudes within -180 and 180.
 *
 * @example
 * ```ts
 * import { trackPieces } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(trackPieces([{ lat: 0, lon: 170 }, { lat: 5, lon: -170 }]).length);
 * ```
 */
export function trackPieces(points: readonly GroundPoint[]): [GroundPoint, GroundPoint][] {
  const out: [GroundPoint, GroundPoint][] = [];
  for (let i = 1; i < points.length; i += 1) out.push(...splitTrail(points[i - 1]!, points[i]!));
  return out;
}
