// What the Sun and the Moon look like from a place on the Earth at a moment: apparent right ascension and declination of date, parallax, refraction, altitude and azimuth, the phase and the bright limb.
// Written from the standard methods (Meeus, "Astronomical Algorithms", chapters 12, 21, 22, 40, 48; the IAU 1976 precession; IAU 1980 nutation, its largest terms) on this package's own positions: the Sun from the Earth's VSOP87B place,
// the Moon from ELP2000-82B. Pure: no DOM, no three.js. Time is UTC in milliseconds; UT1 is taken as UTC (up to 0.9 s, 0.004 degrees of turn of the Earth); the theories run in terrestrial time.
import { earthPosition, moonGeocentric } from "../theory.ts";
import { toTerrestrialTime } from "../time.ts";

type Vec = readonly [number, number, number];
type Matrix = readonly [Vec, Vec, Vec];

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const ARCSEC = Math.PI / 648000;
const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const J2000_JD = 2451545;
const AU_KM = 149597870.7;
const LIGHT_KM_S = 299792.458;
/** The mean obliquity of the ecliptic at J2000 in the IAU 1976 value the VSOP87 and ELP frames use (84381.448 arc-seconds). */
const OBLIQUITY_J2000 = 84381.448 * ARCSEC;
/** The Earth's equatorial radius in kilometres and its flattening (WGS 84). */
const EARTH_RADIUS_KM = 6378.137;
const EARTH_FLATTENING = 1 / 298.257223563;

/** A place on the Earth: degrees north, degrees east (west negative) and metres above the ellipsoid. */
export interface Observer {
  latitude: number;
  longitude: number;
  heightM?: number;
}

/** A body's place on the sky of date, as the Earth's centre sees it (apparent: light time, aberration for the Sun, nutation): angles in degrees, distance in kilometres. */
export interface Equatorial {
  /** Right ascension of date, 0 to 360. */
  rightAscension: number;
  /** Declination of date, -90 to 90. */
  declination: number;
  distanceKm: number;
}

/** Where a body is in a place's sky: azimuth 0 to 360 from north through east, altitude, the hour angle (0 on the meridian, positive west) and the parallactic angle, all in degrees. */
export interface Horizontal {
  azimuth: number;
  altitude: number;
  hourAngle: number;
  parallacticAngle: number;
  /** The distance from the place to the body in kilometres. */
  distanceKm: number;
}

const matrixTimes = (a: Matrix, b: Matrix): Matrix => [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!)) as unknown as Matrix;
const apply = (m: Matrix, v: Vec): Vec => [m[0]![0]! * v[0] + m[0]![1]! * v[1] + m[0]![2]! * v[2], m[1]![0]! * v[0] + m[1]![1]! * v[1] + m[1]![2]! * v[2], m[2]![0]! * v[0] + m[2]![1]! * v[1] + m[2]![2]! * v[2]];
/** The matrix that re-expresses a vector in axes turned by `a` radians about x, y or z (a frame turn, not a vector turn). */
const frameTurn = (axis: 1 | 2 | 3, a: number): Matrix => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === 1) return [[1, 0, 0], [0, c, s], [0, -s, c]];
  if (axis === 2) return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
  return [[c, s, 0], [-s, c, 0], [0, 0, 1]];
};

/** Julian centuries of terrestrial time from J2000 for a UTC instant in milliseconds. */
const centuries = (ms: number): number => (toTerrestrialTime(ms) - J2000_MS) / (36525 * DAY_MS);

/** Nutation in longitude and obliquity, and the mean obliquity of date, all in radians (Meeus ch. 22, the terms that matter at 0.5 arc-seconds). */
export function nutation(T: number): { longitude: number; obliquity: number; meanObliquity: number } {
  const omega = (125.04452 - 1934.136261 * T) * RAD;
  const sunL = (280.4665 + 36000.7698 * T) * RAD;
  const moonL = (218.3165 + 481267.8813 * T) * RAD;
  const longitude = (-17.2 * Math.sin(omega) - 1.32 * Math.sin(2 * sunL) - 0.23 * Math.sin(2 * moonL) + 0.21 * Math.sin(2 * omega)) * ARCSEC;
  const obliquity = (9.2 * Math.cos(omega) + 0.57 * Math.cos(2 * sunL) + 0.1 * Math.cos(2 * moonL) - 0.09 * Math.cos(2 * omega)) * ARCSEC;
  const meanObliquity = (84381.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T) * ARCSEC;
  return { longitude, obliquity, meanObliquity };
}

/** A J2000 mean-ecliptic vector turned into the true equator and equinox of date: obliquity of J2000, IAU 1976 precession, then nutation. */
function trueOfDate(ecliptic: Vec, T: number): Vec {
  const equatorial = apply(frameTurn(1, -OBLIQUITY_J2000), ecliptic);
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * ARCSEC;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * ARCSEC;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * ARCSEC;
  const precession = matrixTimes(frameTurn(3, -z), matrixTimes(frameTurn(2, theta), frameTurn(3, -zeta)));
  const n = nutation(T);
  const nutate = matrixTimes(frameTurn(1, -(n.meanObliquity + n.obliquity)), matrixTimes(frameTurn(3, -n.longitude), frameTurn(1, n.meanObliquity)));
  return apply(nutate, apply(precession, equatorial));
}

const toEquatorial = (v: Vec, distanceKm: number): Equatorial => ({
  rightAscension: ((Math.atan2(v[1], v[0]) * DEG) % 360 + 360) % 360,
  declination: Math.asin(Math.max(-1, Math.min(1, v[2] / Math.hypot(v[0], v[1], v[2])))) * DEG,
  distanceKm,
});

const fromEquatorial = (e: Equatorial): Vec => {
  const ra = e.rightAscension * RAD;
  const dec = e.declination * RAD;
  return [e.distanceKm * Math.cos(dec) * Math.cos(ra), e.distanceKm * Math.cos(dec) * Math.sin(ra), e.distanceKm * Math.sin(dec)];
};

/** The Sun as seen from the Earth's centre: the apparent place of date, with the annual aberration (the Earth's speed over the speed of light, about 20 arc-seconds) and nutation. */
export function sunEquatorial(ms: number): Equatorial {
  const T = centuries(ms);
  const earth = earthPosition(ms);
  const later = earthPosition(ms + 60_000);
  const sun: Vec = [-earth[0], -earth[1], -earth[2]];
  const distanceAu = Math.hypot(sun[0], sun[1], sun[2]);
  // the Earth's velocity in au per second, over the speed of light in au per second, moves the apparent direction toward where the Earth is heading
  const beta: Vec = [(later[0] - earth[0]) / 60 / (LIGHT_KM_S / AU_KM), (later[1] - earth[1]) / 60 / (LIGHT_KM_S / AU_KM), (later[2] - earth[2]) / 60 / (LIGHT_KM_S / AU_KM)];
  const aberrated: Vec = [sun[0] / distanceAu + beta[0], sun[1] / distanceAu + beta[1], sun[2] / distanceAu + beta[2]];
  return toEquatorial(trueOfDate(aberrated, T), distanceAu * AU_KM);
}

/** The Moon as seen from the Earth's centre: the apparent place of date, with the light time (the Moon is about 1.3 seconds away) and nutation. */
export function moonEquatorial(ms: number): Equatorial {
  const T = centuries(ms);
  const first = moonGeocentric(ms);
  const distance = Math.hypot(first[0], first[1], first[2]);
  const geometric = moonGeocentric(ms - (distance / LIGHT_KM_S) * 1000);
  return toEquatorial(trueOfDate(geometric, T), Math.hypot(geometric[0], geometric[1], geometric[2]));
}

/** The apparent sidereal time at Greenwich in degrees (Meeus ch. 12 with the equation of the equinoxes), from the UTC instant taken as UT1. */
export function greenwichSiderealTime(ms: number): number {
  const jd = ms / DAY_MS + 2440587.5;
  const T = (jd - J2000_JD) / 36525;
  const mean = 280.46061837 + 360.98564736629 * (jd - J2000_JD) + 0.000387933 * T * T - (T * T * T) / 38710000;
  const n = nutation(centuries(ms));
  return (((mean + n.longitude * DEG * Math.cos(n.meanObliquity + n.obliquity)) % 360) + 360) % 360;
}

/** The observer's place from the Earth's centre in the true equator of date, in kilometres, with the turn of the Earth (Meeus ch. 11). */
function observerVector(observer: Observer, ms: number): Vec {
  const lat = observer.latitude * RAD;
  const height = (observer.heightM ?? 0) / 1000;
  const u = Math.atan((1 - EARTH_FLATTENING) * Math.tan(lat));
  const rhoSin = (1 - EARTH_FLATTENING) * Math.sin(u) + (height / EARTH_RADIUS_KM) * Math.sin(lat);
  const rhoCos = Math.cos(u) + (height / EARTH_RADIUS_KM) * Math.cos(lat);
  const theta = (greenwichSiderealTime(ms) + observer.longitude) * RAD;
  return [EARTH_RADIUS_KM * rhoCos * Math.cos(theta), EARTH_RADIUS_KM * rhoCos * Math.sin(theta), EARTH_RADIUS_KM * rhoSin];
}

/**
 * Altitude, azimuth, hour angle and parallactic angle of a body for an observer: topocentric (parallax taken out of the Earth's centre to the place) and geometric, with no refraction.
 * `ms` is the instant the observer's sky turns for; the body's place `equatorial` is its apparent place at that instant.
 */
export function horizontalOf(equatorial: Equatorial, ms: number, observer: Observer): Horizontal {
  const body = fromEquatorial(equatorial);
  const place = observerVector(observer, ms);
  const topo: Vec = [body[0] - place[0], body[1] - place[1], body[2] - place[2]];
  const distanceKm = Math.hypot(topo[0], topo[1], topo[2]);
  const ra = Math.atan2(topo[1], topo[0]);
  const dec = Math.asin(topo[2] / distanceKm);
  const lat = observer.latitude * RAD;
  const H = (greenwichSiderealTime(ms) + observer.longitude) * RAD - ra;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const azimuth = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H));
  const parallactic = Math.atan2(Math.sin(H), Math.tan(lat) * Math.cos(dec) - Math.sin(dec) * Math.cos(H));
  return {
    azimuth: (((azimuth * DEG) % 360) + 360) % 360,
    altitude: altitude * DEG,
    hourAngle: ((((H * DEG) % 360) + 540) % 360) - 180,
    parallacticAngle: parallactic * DEG,
    distanceKm,
  };
}

/**
 * The refraction of the atmosphere in degrees at a geometric altitude in degrees (Saemundsson's formula, standard air at 10 degrees C and 1010 hPa): it lifts a body toward the zenith.
 * It is smooth through the horizon and fades to nothing below -2 degrees.
 */
export function refraction(altitude: number): number {
  if (altitude < -2) return 0;
  const h = Math.max(altitude, -1);
  const r = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * RAD) / 60;
  return altitude < -1 ? r * (altitude + 2) : r;
}

/** The Moon's phase: the illuminated fraction 0 to 1, the phase 0 to 1 (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter), the bright limb's position angle in degrees eastward from north, and whether it is waxing. */
export function moonPhase(ms: number): { fraction: number; phase: number; angle: number; waxing: boolean } {
  const sun = sunEquatorial(ms);
  const moon = moonEquatorial(ms);
  const sunV = fromEquatorial(sun);
  const moonV = fromEquatorial(moon);
  const psi = Math.acos(Math.max(-1, Math.min(1, (sunV[0] * moonV[0] + sunV[1] * moonV[1] + sunV[2] * moonV[2]) / (sun.distanceKm * moon.distanceKm))));
  // the angle at the Moon between the Sun and the Earth (Meeus ch. 48)
  const inc = Math.atan2(sun.distanceKm * Math.sin(psi), moon.distanceKm - sun.distanceKm * Math.cos(psi));
  const fraction = (1 + Math.cos(inc)) / 2;
  const a0 = sun.rightAscension * RAD;
  const d0 = sun.declination * RAD;
  const a = moon.rightAscension * RAD;
  const d = moon.declination * RAD;
  const angle = Math.atan2(Math.cos(d0) * Math.sin(a0 - a), Math.sin(d0) * Math.cos(d) - Math.cos(d0) * Math.sin(d) * Math.cos(a0 - a)) * DEG;
  // waxing while the Moon is east of the Sun along the ecliptic: its longitude is ahead by under half a turn
  const n = nutation(centuries(ms));
  const epsilon = n.meanObliquity + n.obliquity;
  const longitudeOf = (v: Vec): number => Math.atan2(v[1] * Math.cos(epsilon) + v[2] * Math.sin(epsilon), v[0]) * DEG;
  const ahead = (((longitudeOf(moonV) - longitudeOf(sunV)) % 360) + 360) % 360;
  const waxing = ahead < 180;
  const phase = waxing ? 0.5 - inc / (2 * Math.PI) : 0.5 + inc / (2 * Math.PI);
  return { fraction, phase: phase >= 1 ? phase - 1 : phase, angle: ((angle % 360) + 360) % 360, waxing };
}
