// What the flat map shows at a moment, as numbers: where the Sun is overhead, where each orbiter is over the ground, the shading of the night side, a craft's coverage circle and its ground track cut for a flat map.
// Pure: no DOM, no clock reads (the moment is always given).
import { splitTrail, type GroundPoint } from "../ground-track.ts";
import { system } from "../ephemeris.ts";
import { BODIES, MOONS_OF, type HostId, type MoonId } from "../facts.ts";
import { orbiterElements, orbiterGround, orbiterGroundTrack, orbiterNumbers, orbiterDim, type OrbiterId, type OrbiterStatus } from "../orbiters.ts";
import { subSolarPoint } from "../places.ts";
import { cross, dot } from "../vec.ts";
import { flatBody, type FlatBodyId } from "./bodies.ts";
import { pixelsPerDegree, wrapLongitude, type FlatView } from "./geometry.ts";

const RAD = Math.PI / 180;

/**
 * Where the Sun is overhead on a body: latitude and east longitude in degrees, from the package's own ephemeris and the body's IAU pole and prime meridian. The longitude is in -180 up to 180, like the map's.
 *
 * @param body - Any body the flat map draws.
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
 * How fast the Sun moves across a body's ground, in degrees of longitude a second at a moment: about 0.0042 on the Earth and Mars, 0.00014 on the Moon, 0.00002 on Mercury. It sets how often a running clock needs to draw the night.
 *
 * @param body - Any body the flat map draws.
 * @param ms - Milliseconds since 1970 (UTC).
 * @returns Degrees a second, always positive.
 *
 * @example
 * ```ts
 * import { flatSunRate } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(flatSunRate("mars", Date.UTC(2026, 10, 12)).toFixed(4), flatSunRate("moon", Date.UTC(2026, 10, 12)).toFixed(5));
 * ```
 */
export function flatSunRate(body: FlatBodyId, ms: number): number {
  const a = flatSun(body, ms);
  const b = flatSun(body, ms + 60_000);
  return Math.abs(wrapLongitude(b.lon - a.lon)) / 60;
}

/**
 * The sunrise and sunset line: the circle of the body's surface where the Sun is on the horizon, as longitude and latitude with the longitude carried on without a jump (so a flat map draws it again a world to the left and right). It is the circle 90 degrees from the point where the Sun is overhead.
 *
 * @param sun - Where the Sun is overhead (`flatSun`).
 * @param steps - How many steps round it.
 * @returns The points; the last is a whole turn of longitude from the first.
 *
 * @example
 * ```ts
 * import { flatSun, sunriseLine } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const line = sunriseLine(flatSun("mars", Date.UTC(2026, 10, 12)), 8);
 * console.log(line.length, Math.abs(line[8]![0] - line[0]![0]));
 * ```
 */
export const sunriseLine = (sun: GroundPoint, steps = 144): [number, number][] => circleOutline(sun.lat, sun.lon, 90, steps).points;

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
 * @param body - Any body the flat map draws: the night's colour and the twilight's width.
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

/**
 * The moons the package places round a body: their ids, in the package's order. Empty for a body with none (Mercury, Venus, the moons themselves).
 *
 * @param body - Any body the flat map draws.
 * @returns The moons' ids.
 *
 * @example
 * ```ts
 * import { moonsOfBody } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(moonsOfBody("mars").join(", "), moonsOfBody("venus").length);
 * ```
 */
export const moonsOfBody = (body: FlatBodyId): readonly MoonId[] => (Object.prototype.hasOwnProperty.call(MOONS_OF, body) ? MOONS_OF[body as keyof typeof MOONS_OF] : []);

/**
 * One moon as the flat map of its planet shows it at a moment: the place on the planet's ground that it is straight above, and how far it is from the planet's centre.
 *
 * @example
 * ```ts
 * import { flatMoons, type FlatMoon } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const io: FlatMoon = flatMoons("jupiter", Date.UTC(2026, 10, 23)).find((moon) => moon.id === "io")!;
 * console.log(io.lat.toFixed(1), io.distanceKm > 400_000);
 * ```
 */
export interface FlatMoon {
  id: MoonId;
  /** The latitude of the point on the planet with the moon straight overhead, degrees. */
  lat: number;
  /** Its longitude in -180 up to 180, degrees east. */
  lon: number;
  /** The distance from the planet's centre, in kilometres. */
  distanceKm: number;
}

/** The ground point under each moon of a planet, from the planet's pole and prime meridian and the moon's place in the same frame. */
function groundPoints(host: FlatBodyId, ms: number): FlatMoon[] {
  const { planet, moons } = system(host as HostId, ms);
  const radius = BODIES[host].radiusKm;
  const east = cross(planet.pole, planet.meridian);
  return moons.map((moon) => {
    const along = [moon.x / moon.distance, moon.y / moon.distance, moon.z / moon.distance] as const;
    const lat = Math.asin(Math.max(-1, Math.min(1, dot(along, planet.pole)))) / RAD;
    const lon = Math.atan2(dot(along, east), dot(along, planet.meridian)) / RAD;
    return { id: moon.id, lat, lon: wrapLongitude(lon), distanceKm: moon.distance * radius };
  });
}

/**
 * Where each moon of a body is overhead at a moment: the point on the body's ground with the moon straight above it, for a flat map of the moons' planet. The Earth has the Moon, Mars two, Jupiter six, Saturn nineteen, Uranus five, Neptune four, Pluto three; a body with none gives an empty list.
 *
 * @param host - Any body the flat map draws.
 * @param ms - Milliseconds since 1970 (UTC).
 * @returns The moons, nearest first.
 *
 * @example
 * ```ts
 * import { flatMoons } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const moons = flatMoons("mars", Date.UTC(2026, 10, 23, 12));
 * console.log(moons.map((moon) => `${moon.id} ${moon.lat.toFixed(0)}, ${moon.lon.toFixed(0)}`).join("; "));
 * ```
 */
export function flatMoons(host: FlatBodyId, ms: number): FlatMoon[] {
  return moonsOfBody(host).length === 0 ? [] : groundPoints(host, ms);
}

/**
 * The track of each moon over its planet's ground: where it is overhead from before the moment to after it, half a turn of the planet either way (at least one hour, at most two days), as points with their moments. The planet turns under the moon, so a close moon of a fast planet draws a long path round the map.
 *
 * @param host - Any body the flat map draws.
 * @param ms - Milliseconds since 1970 (UTC): the moment at the track's middle.
 * @param points - How many steps along the track.
 * @returns For each moon, its points (longitude in -180 up to 180), or an empty map for a body with no moons.
 *
 * @example
 * ```ts
 * import { flatMoonTracks } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const tracks = flatMoonTracks("jupiter", Date.UTC(2026, 10, 23), 20);
 * console.log(tracks.get("io")?.length, tracks.size);
 * ```
 */
export function flatMoonTracks(host: FlatBodyId, ms: number, points = 48): Map<MoonId, { lat: number; lon: number; ms: number }[]> {
  const out = new Map<MoonId, { lat: number; lon: number; ms: number }[]>();
  if (moonsOfBody(host).length === 0) return out;
  const half = flatMoonTrackHalf(host);
  for (let i = 0; i <= points; i += 1) {
    const at = ms - half + (2 * half * i) / points;
    for (const moon of groundPoints(host, at)) {
      let list = out.get(moon.id);
      if (list === undefined) out.set(moon.id, (list = []));
      list.push({ lat: moon.lat, lon: moon.lon, ms: at });
    }
  }
  return out;
}

/**
 * How long a track of the moons of a planet is, either side of the moment, in milliseconds: half a turn of the planet, at least an hour and at most two days.
 *
 * @param host - Any body the flat map draws.
 * @returns Milliseconds.
 *
 * @example
 * ```ts
 * import { flatMoonTrackHalf } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(flatMoonTrackHalf("jupiter") / 3_600_000);
 * ```
 */
export const flatMoonTrackHalf = (host: FlatBodyId): number => Math.min(48, Math.max(1, Math.abs(BODIES[host].rotationHours) / 2)) * 3_600_000;
