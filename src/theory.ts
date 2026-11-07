// The two theories the rest is built on, kept apart so that the sun and moon times import them and nothing else: the planets' VSOP87B series (Bretagnon and Francou, IMCCE, data/vsop.ts) and the Moon's
// ELP2000-82B (Chapront-Touze and Chapront, IMCCE, data/lunar.ts), both in terrestrial time. Pure: no DOM, no three.js.
import { LUNAR_MAIN, LUNAR_PERIODIC } from "./data/lunar.ts";
import { VSOP_EARTH, type Variable } from "./data/vsop.ts";
import { toTerrestrialTime } from "./clock.ts";
import type { Vec3 } from "./vec.ts";

/** Milliseconds since 1970 at J2000.0 (2000-01-01 12:00 TT, taken as UTC). */
const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY = 86_400_000;
const centuries = (ms: number): number => (ms - J2000) / (DAY * 36525);

/** A planet from its VSOP87B series: longitude, latitude and radius at a moment in terrestrial time, as x, y, z in the J2000 ecliptic. */
export function vsopPosition(series: readonly [Variable, Variable, Variable], terrestrialMs: number): Vec3 {
  const t = (terrestrialMs - J2000) / (365_250 * DAY);
  const spherical = [0, 0, 0];
  for (let k = 0; k < 3; k += 1) {
    let sum = 0;
    let power = 1;
    for (const terms of series[k]!) {
      let s = 0;
      for (const [amplitude, phase, frequency] of terms) s += amplitude * Math.cos(phase + frequency * t);
      sum += power * s;
      power *= t;
    }
    spherical[k] = sum;
  }
  const [longitude, latitude, radius] = spherical as [number, number, number];
  const cosLatitude = Math.cos(latitude);
  return [radius * cosLatitude * Math.cos(longitude), radius * cosLatitude * Math.sin(longitude), radius * Math.sin(latitude)];
}


/** The Earth's heliocentric place (J2000 ecliptic, au) at a UTC instant: the VSOP87B series run in terrestrial time. */
export function earthPosition(ms: number): Vec3 {
  return vsopPosition(VSOP_EARTH, toTerrestrialTime(ms));
}

const ARCSEC = Math.PI / 648000;
const dms = (d: number, m: number, sec: number): number => ((d + m / 60 + sec / 3600) * Math.PI) / 180;
// The mean arguments of ELP2000-82B (Chapront-Touze and Chapront), each as a polynomial in Julian centuries of terrestrial time from J2000, in radians:
// the Moon's mean longitude, its node and its perigee, the Earth–Moon barycentre's mean longitude and the Sun's perigee, then the planets' mean longitudes.
const LUNAR_W1 = [dms(218, 18, 59.95571), 1732559343.73604 * ARCSEC, -5.8883 * ARCSEC, 0.6604e-2 * ARCSEC, -0.3169e-4 * ARCSEC];
const LUNAR_W2 = [dms(83, 21, 11.67475), 14643420.2632 * ARCSEC, -38.2776 * ARCSEC, -0.45047e-1 * ARCSEC, 0.21301e-3 * ARCSEC];
const LUNAR_W3 = [dms(125, 2, 40.39816), -6967919.3622 * ARCSEC, 6.3622 * ARCSEC, 0.7625e-2 * ARCSEC, -0.3586e-4 * ARCSEC];
const LUNAR_EARTH = [dms(100, 27, 59.22059), 129597742.2758 * ARCSEC, -0.0202 * ARCSEC, 0.9e-5 * ARCSEC, 0.15e-6 * ARCSEC];
const LUNAR_PERIGEE = [dms(102, 56, 14.42753), 1161.2283 * ARCSEC, 0.5327 * ARCSEC, -0.138e-3 * ARCSEC, 0];
/** Delaunay's arguments D, l', l and F as polynomials: by power of time, then by argument. */
const LUNAR_DELAUNAY = LUNAR_W1.map((w1, k) => [w1 - LUNAR_EARTH[k]! + (k === 0 ? Math.PI : 0), LUNAR_EARTH[k]! - LUNAR_PERIGEE[k]!, w1 - LUNAR_W2[k]!, w1 - LUNAR_W3[k]!]);
const LUNAR_ZETA = [LUNAR_W1[0]!, LUNAR_W1[1]! + 5029.0966 * ARCSEC];
const LUNAR_PLANET_0 = [dms(252, 15, 3.25986), dms(181, 58, 47.28305), LUNAR_EARTH[0]!, dms(355, 25, 59.78866), dms(34, 21, 5.34212), dms(50, 4, 38.89694), dms(314, 3, 18.01841), dms(304, 20, 55.19575)];
const LUNAR_PLANET_1 = [538101628.68898, 210664136.43355, 129597742.2758, 68905077.59284, 10925660.42861, 4399609.65932, 1542481.19393, 786550.32074].map((rate) => rate * ARCSEC);
/** The ratio of the Moon's mean distance in the fitted theory to the one the series are written for. */
const LUNAR_DISTANCE_SCALE = 384747.9806448954 / 384747.9806743165;

/**
 * The Moon's position from the Earth's centre (J2000 mean ecliptic and equinox, kilometres), from the lunar solution ELP2000-82B (Chapront-Touze and Chapront, IMCCE) cut to its 540 largest terms and run in terrestrial time: within a few arc-seconds of Horizons from 1800 to 2200.
 * @param ms - The instant, in milliseconds since 1970 (UTC).
 * @returns The position as x, y, z in kilometres.
 *
 * @example
 * ```ts
 * import { moonGeocentric } from "@johnmorrisdotca/wakusei-planets";
 *
 * const [x, y, z] = moonGeocentric(Date.UTC(2026, 10, 2));
 * console.log(Math.round(Math.hypot(x, y, z)) > 350000);
 * ```
 */
export function moonGeocentric(ms: number): Vec3 {
  const T = centuries(toTerrestrialTime(ms));
  const poly = (c: readonly number[]): number => c[0]! + T * (c[1]! + T * (c[2]! + T * (c[3]! + T * c[4]!)));
  // the arguments D, l', l, F for the main problem (to the fourth power of time), and for the perturbations (to the first) with zeta and the planets
  const full = [0, 1, 2, 3].map((i) => LUNAR_DELAUNAY[0]![i]! + T * (LUNAR_DELAUNAY[1]![i]! + T * (LUNAR_DELAUNAY[2]![i]! + T * (LUNAR_DELAUNAY[3]![i]! + T * LUNAR_DELAUNAY[4]![i]!))));
  const slow = [...[0, 1, 2, 3].map((i) => LUNAR_DELAUNAY[0]![i]! + T * LUNAR_DELAUNAY[1]![i]!), LUNAR_ZETA[0]! + T * LUNAR_ZETA[1]!, ...LUNAR_PLANET_0.map((p, i) => p + T * LUNAR_PLANET_1[i]!)];
  const sums = [0, 0, 0];
  for (const term of LUNAR_MAIN) {
    const c = term[0]!;
    sums[c] = sums[c]! + term[1]! * Math.sin(term[2]! * full[0]! + term[3]! * full[1]! + term[4]! * full[2]! + term[5]! * full[3]! + (c === 2 ? Math.PI / 2 : 0));
  }
  for (const term of LUNAR_PERIODIC) {
    const c = term[0]!;
    let y = (term[3]! * Math.PI) / 180;
    for (let j = 0; j < 13; j += 1) y += term[4 + j]! * slow[j]!;
    const power = term[1]!;
    sums[c] = sums[c]! + term[2]! * (power === 0 ? 1 : power === 1 ? T : T * T) * Math.sin(y);
  }
  const lon = sums[0]! * ARCSEC + poly(LUNAR_W1);
  const lat = sums[1]! * ARCSEC;
  const dist = sums[2]! * LUNAR_DISTANCE_SCALE;
  const x1 = dist * Math.cos(lat) * Math.cos(lon);
  const x2 = dist * Math.cos(lat) * Math.sin(lon);
  const x3 = dist * Math.sin(lat);
  // the plane of the mean ecliptic of date to J2000, by the series' own precession matrix
  let pw = T * (0.10180391e-4 + T * (0.47020439e-6 + T * (-0.5417367e-9 + T * (-0.2507948e-11 + T * 0.463486e-14))));
  let qw = T * (-0.113469002e-3 + T * (0.12372674e-6 + T * (0.1265417e-8 + T * (-0.1371808e-11 + T * -0.320334e-14))));
  const ra = 2 * Math.sqrt(1 - pw * pw - qw * qw);
  const pwqw = 2 * pw * qw;
  const pw2 = 1 - 2 * pw * pw;
  const qw2 = 1 - 2 * qw * qw;
  pw *= ra;
  qw *= ra;
  return [pw2 * x1 + pwqw * x2 + pw * x3, pwqw * x1 + qw2 * x2 - qw * x3, -pw * x1 + qw * x2 + (pw2 + qw2 - 1) * x3];
}

