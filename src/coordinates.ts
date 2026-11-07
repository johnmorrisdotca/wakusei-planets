// Coordinate rotations: Meeus, Astronomical Algorithms, 2nd ed., chapters 12, 13, 22.
// Standalone mathematics; no body data, ephemerides or rendering dependencies.
import { ttMinusUtc } from "./clock.ts";

const RAD = Math.PI / 180;
const J2000 = 2451545;
const DAY_MS = 86400000;

/** Named axes. Of-date axes are mean, not nutated.
 * @example
 * ```ts
 * import type { CoordinateFrame } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: CoordinateFrame = "eclipticJ2000";
 * console.log(value);
 * ```
 */
export type CoordinateFrame = "eclipticJ2000" | "equatorialJ2000" | "eclipticOfDate" | "equatorialOfDate";
/** Origin is preserved by every rotation; no observer translation is performed.
 * @example
 * ```ts
 * import type { CoordinateOrigin } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: CoordinateOrigin = "geocentric";
 * console.log(value);
 * ```
 */
export type CoordinateOrigin = "heliocentric" | "geocentric" | "topocentric";
/** Scientific context. Numeric epoch is Unix UTC milliseconds identifying the mean frame's instant; J2000 is JD 2451545.0 TT.
 * @example
 * ```ts
 * import type { CoordinateContext } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: CoordinateContext = { origin: "geocentric", frame: "equatorialJ2000", epoch: "J2000", corrections: "geometric" };
 * console.log(value);
 * ```
 */
export interface CoordinateContext {
  origin: CoordinateOrigin;
  frame: CoordinateFrame;
  epoch: "J2000" | number;
  corrections: "geometric";
}
/** Spherical coordinates: longitude [0,360), latitude [-90,90], radius in AU.
 * @example
 * ```ts
 * import { cartesianToSpherical, type SphericalAu } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: SphericalAu = cartesianToSpherical({ origin: "heliocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric", xAu: 0, yAu: 1, zAu: 0 });
 * console.log(value);
 * ```
 */
export interface SphericalAu extends CoordinateContext { longitude: number; latitude: number; distanceAu: number }
/** Right-handed Cartesian components in AU: x at longitude zero, y at 90 degrees, z north.
 * @example
 * ```ts
 * import { sphericalToCartesian, type CartesianAu } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: CartesianAu = sphericalToCartesian({ origin: "heliocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric", longitude: 90, latitude: 0, distanceAu: 1 });
 * console.log(value);
 * ```
 */
export interface CartesianAu extends CoordinateContext { xAu: number; yAu: number; zAu: number }
/** Ecliptic angles, in degrees, in the named mean ecliptic frame.
 * @example
 * ```ts
 * import { equatorialToEcliptic, type EclipticCoordinates } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: EclipticCoordinates = equatorialToEcliptic({ origin: "geocentric", frame: "equatorialJ2000", epoch: "J2000", corrections: "geometric", rightAscension: 90, declination: 0 });
 * console.log(value);
 * ```
 */
export interface EclipticCoordinates extends CoordinateContext { frame: "eclipticJ2000" | "eclipticOfDate"; eclipticLongitude: number; eclipticLatitude: number }
/** Equatorial angles, in degrees (right ascension is never hours).
 * @example
 * ```ts
 * import { eclipticToEquatorial, type EquatorialCoordinates } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: EquatorialCoordinates = eclipticToEquatorial({ origin: "geocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric", eclipticLongitude: 90, eclipticLatitude: 0 });
 * console.log(value);
 * ```
 */
export interface EquatorialCoordinates extends CoordinateContext { frame: "equatorialJ2000" | "equatorialOfDate"; rightAscension: number; declination: number }
/** Earth observer: degrees north/east; optional metres above mean sea level. Rotations do not use height.
 * @example
 * ```ts
 * import type { CoordinateObserver } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: CoordinateObserver = { latitude: 49, longitude: -123 };
 * console.log(value);
 * ```
 */
export interface CoordinateObserver { latitude: number; longitude: number; heightM?: number }
/** Geometric horizontal direction. Azimuth is clockwise from north; origin remains that of the supplied direction.
 * @example
 * ```ts
 * import { equatorialToHorizontal, type HorizontalCoordinates } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * const value: HorizontalCoordinates = equatorialToHorizontal({ origin: "topocentric", frame: "equatorialOfDate", epoch: 0, corrections: "geometric", rightAscension: 0, declination: 0 }, 0, { observer: { latitude: 49, longitude: -123 } });
 * console.log(value);
 * ```
 */
export interface HorizontalCoordinates {
  origin: CoordinateOrigin;
  frame: "horizontal";
  epoch: number;
  corrections: "geometric";
  altitude: number;
  azimuth: number;
}

function finite(name: string, value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${name}: ${String(value)} must be finite`);
  return value;
}
function bounded(name: string, value: number, low: number, high: number): number {
  finite(name, value);
  if (value < low || value > high) throw new RangeError(`${name}: ${value} must be in [${low}, ${high}]`);
  return value;
}
function wrap(value: number): number { return ((value % 360) + 360) % 360; }
function instant(when: Date | number): number {
  const ms = finite("when", when instanceof Date ? when.getTime() : when);
  if (Math.abs(ms) > 8640000000000000) throw new RangeError(`when: ${ms} is outside the Date range`);
  return ms;
}
function context(c: CoordinateContext): CoordinateContext {
  if (!["heliocentric", "geocentric", "topocentric"].includes(c.origin)) throw new RangeError(`origin: ${c.origin}`);
  if (!["eclipticJ2000", "equatorialJ2000", "eclipticOfDate", "equatorialOfDate"].includes(c.frame)) throw new RangeError(`frame: ${c.frame}`);
  if (c.corrections !== "geometric") throw new RangeError(`corrections: ${c.corrections}; expected geometric`);
  if (c.frame.endsWith("J2000")) {
    if (c.epoch !== "J2000") throw new RangeError(`epoch: ${c.epoch}; expected J2000`);
  } else {
    if (typeof c.epoch !== "number") throw new RangeError(`epoch: ${c.epoch}; expected Unix milliseconds`);
    instant(c.epoch);
  }
  return { origin: c.origin, frame: c.frame, epoch: c.epoch, corrections: c.corrections };
}
function spherical(longitude: number, latitude: number): [number, number, number] {
  const l = wrap(finite("longitude", longitude)) * RAD;
  const b = bounded("latitude", latitude, -90, 90) * RAD;
  const cb = Math.abs(latitude) === 90 ? 0 : Math.cos(b);
  return [cb * Math.cos(l), cb * Math.sin(l), Math.sin(b)];
}
function angles(x: number, y: number, z: number): [number, number] {
  const xy = Math.hypot(x, y);
  return [xy < 1e-15 * Math.hypot(x, y, z) ? 0 : wrap(Math.atan2(y, x) / RAD), Math.atan2(z, xy) / RAD];
}

/** Convert spherical to Cartesian, preserving origin, frame, epoch and geometric corrections. Radius must be positive.
 * @param value - Coordinates with explicit origin, frame, epoch and geometric corrections.
 * @returns Cartesian components in AU with the same context.
 * @example
 * ```ts
 * import { sphericalToCartesian } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * console.log(sphericalToCartesian({ origin: "heliocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric", longitude: 90, latitude: 0, distanceAu: 1 }));
 * ```
 */
export function sphericalToCartesian(value: SphericalAu): CartesianAu {
  const c = context(value);
  const d = finite("distanceAu", value.distanceAu);
  if (d <= 0) throw new RangeError(`distanceAu: ${d} must be positive`);
  const [x, y, z] = spherical(value.longitude, value.latitude);
  return { ...c, xAu: x * d, yAu: y * d, zAu: z * d };
}
/** Convert Cartesian to spherical. Zero vectors throw; longitude at either pole is conventionally zero.
 * @param value - Coordinates with explicit origin, frame, epoch and geometric corrections.
 * @returns Spherical angles in degrees and radius in AU with the same context.
 * @example
 * ```ts
 * import { cartesianToSpherical } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * console.log(cartesianToSpherical({ origin: "heliocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric", xAu: 0, yAu: 1, zAu: 0 }));
 * ```
 */
export function cartesianToSpherical(value: CartesianAu): SphericalAu {
  const c = context(value);
  const x = finite("xAu", value.xAu), y = finite("yAu", value.yAu), z = finite("zAu", value.zAu);
  const d = finite("distanceAu", Math.hypot(x, y, z));
  if (d === 0) throw new RangeError("distanceAu: 0 has no direction");
  const [longitude, latitude] = angles(x / d, y / d, z / d);
  return { ...c, longitude, latitude, distanceAu: d };
}
/** Mean obliquity in degrees: IAU 1980 (Meeus 22.2), evaluated in TT. Validated for 1800–2050; extrapolates outside it.
 * @param when - Date or Unix UTC milliseconds.
 * @returns Mean obliquity in degrees.
 * @example
 * ```ts
 * import { meanObliquity } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * console.log(meanObliquity(new Date("2000-01-01T12:00:00Z")));
 * ```
 */
export function meanObliquity(when: Date | number): number {
  const utc = instant(when);
  const t = ((utc + ttMinusUtc(utc) * 1000) / DAY_MS + 2440587.5 - J2000) / 36525;
  return (84381.448 - 46.815 * t - 0.00059 * t * t + 0.001813 * t * t * t) / 3600;
}
function obliquity(c: CoordinateContext): number {
  return (c.epoch === "J2000" ? 84381.448 / 3600 : meanObliquity(c.epoch)) * RAD;
}
/** Rotate a mean ecliptic direction into the matching mean equatorial frame. No precession between epochs, nutation, aberration or light-time is added.
 * @param value - Coordinates with explicit origin, frame, epoch and geometric corrections.
 * @returns Right ascension and declination in the matching mean equatorial frame.
 * @example
 * ```ts
 * import { eclipticToEquatorial } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * console.log(eclipticToEquatorial({ origin: "geocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric", eclipticLongitude: 90, eclipticLatitude: 0 }));
 * ```
 */
export function eclipticToEquatorial(value: EclipticCoordinates): EquatorialCoordinates {
  const c = context(value);
  if (!c.frame.startsWith("ecliptic")) throw new RangeError(`frame: ${c.frame}; expected ecliptic`);
  const [x, y, z] = spherical(value.eclipticLongitude, value.eclipticLatitude);
  const e = obliquity(c);
  const [rightAscension, declination] = angles(x, y * Math.cos(e) - z * Math.sin(e), y * Math.sin(e) + z * Math.cos(e));
  return { ...c, frame: c.frame === "eclipticJ2000" ? "equatorialJ2000" : "equatorialOfDate", rightAscension, declination };
}
/** Inverse mean-equator rotation, retaining the same origin and epoch.
 * @param value - Coordinates with explicit origin, frame, epoch and geometric corrections.
 * @returns Ecliptic longitude and latitude in the matching mean ecliptic frame.
 * @example
 * ```ts
 * import { equatorialToEcliptic } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * console.log(equatorialToEcliptic({ origin: "geocentric", frame: "equatorialJ2000", epoch: "J2000", corrections: "geometric", rightAscension: 90, declination: 0 }));
 * ```
 */
export function equatorialToEcliptic(value: EquatorialCoordinates): EclipticCoordinates {
  const c = context(value);
  if (!c.frame.startsWith("equatorial")) throw new RangeError(`frame: ${c.frame}; expected equatorial`);
  const [x, y, z] = spherical(value.rightAscension, value.declination);
  const e = obliquity(c);
  const [eclipticLongitude, eclipticLatitude] = angles(x, y * Math.cos(e) + z * Math.sin(e), -y * Math.sin(e) + z * Math.cos(e));
  return { ...c, frame: c.frame === "equatorialJ2000" ? "eclipticJ2000" : "eclipticOfDate", eclipticLongitude, eclipticLatitude };
}
/** Rotate a mean equatorial-of-date direction to an observer's horizon (Meeus 12.4, 13.5–6). The input epoch must equal when. UTC approximates UT1; height is validated but unused. No parallax, refraction, nutation or horizon dip. Azimuth at zenith/nadir is conventionally zero.
 * @param value - Mean equatorial-of-date direction with explicit origin and epoch.
 * @param when - Date or Unix UTC milliseconds equal to the input epoch.
 * @param options - Observer in degrees north/east; height in metres above mean sea level.
 * @returns Altitude and north-based azimuth in degrees; original origin preserved.
 * @example
 * ```ts
 * import { equatorialToHorizontal } from "@johnmorrisdotca/wakusei-planets/coordinates";
 * console.log(equatorialToHorizontal({ origin: "topocentric", frame: "equatorialOfDate", epoch: 0, corrections: "geometric", rightAscension: 0, declination: 0 }, 0, { observer: { latitude: 49, longitude: -123 } }));
 * ```
 */
export function equatorialToHorizontal(value: EquatorialCoordinates, when: Date | number, options: { observer: CoordinateObserver }): HorizontalCoordinates {
  const c = context(value), ms = instant(when);
  if (c.frame !== "equatorialOfDate" || c.epoch !== ms) throw new RangeError(`frame/epoch: ${c.frame}/${c.epoch}; expected equatorialOfDate at when ${ms}`);
  const observer = options.observer;
  const p = bounded("observer.latitude", observer.latitude, -90, 90) * RAD;
  const l = bounded("observer.longitude", observer.longitude, -180, 180);
  finite("observer.heightM", observer.heightM ?? 0);
  const ra = wrap(finite("rightAscension", value.rightAscension));
  const d = bounded("declination", value.declination, -90, 90) * RAD;
  const days = ms / DAY_MS + 2440587.5 - J2000, t = days / 36525;
  const h = wrap(280.46061837 + 360.98564736629 * days + 0.000387933 * t * t - t * t * t / 38710000 + l - ra) * RAD;
  const east = -Math.cos(d) * Math.sin(h);
  const north = Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(h) * Math.sin(p);
  const up = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(h) * Math.cos(p);
  const horizontal = Math.hypot(east, north);
  return { origin: c.origin, frame: "horizontal", epoch: ms, corrections: "geometric", altitude: Math.atan2(up, horizontal) / RAD, azimuth: horizontal < 1e-15 ? 0 : wrap(Math.atan2(east, north) / RAD) };
}
