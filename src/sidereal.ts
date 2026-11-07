// Sidereal time: the Earth's turn against the stars. Greenwich mean sidereal time (IAU 1982, Meeus ch. 12) from UT1, the equation of the equinoxes from the nutation (IAU 1980, its largest terms, 0.5 arc-seconds),
// the apparent time that adds it, and the local time at a longitude. Angles are degrees, 0 to 360 (15 degrees an hour). UT1 is UTC unless `dut1` is given, which is within 0.9 s of the Earth's turn (0.004 degrees). Pure: no DOM, no three.js.
import { DAY_MS, J2000_JD, J2000_MS, toJulianDate, toTerrestrialTime } from "./clock.ts";
import { moment, type When } from "./when.ts";

const RAD = Math.PI / 180;
const ARCSEC = Math.PI / 648000;

/** Nutation in longitude and in obliquity, and the mean obliquity of date, in radians, at `T` Julian centuries of terrestrial time from J2000 (Meeus ch. 22, accurate to 0.5 arc-seconds). */
export function nutation(T: number): { longitude: number; obliquity: number; meanObliquity: number } {
  const omega = (125.04452 - 1934.136261 * T) * RAD;
  const sunL = (280.4665 + 36000.7698 * T) * RAD;
  const moonL = (218.3165 + 481267.8813 * T) * RAD;
  const longitude = (-17.2 * Math.sin(omega) - 1.32 * Math.sin(2 * sunL) - 0.23 * Math.sin(2 * moonL) + 0.21 * Math.sin(2 * omega)) * ARCSEC;
  const obliquity = (9.2 * Math.cos(omega) + 0.57 * Math.cos(2 * sunL) + 0.1 * Math.cos(2 * moonL) - 0.09 * Math.cos(2 * omega)) * ARCSEC;
  const meanObliquity = (84381.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T) * ARCSEC;
  return { longitude, obliquity, meanObliquity };
}

const wrap = (degrees: number): number => ((degrees % 360) + 360) % 360;

/**
 * The Greenwich mean sidereal time in degrees, 0 to 360 (divide by 15 for hours).
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param dut1 - UT1 minus UTC in seconds, from the IERS; default 0 (within 0.9 s).
 * @returns Degrees.
 *
 * @example
 * ```ts
 * import { greenwichMeanSiderealTime } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log((greenwichMeanSiderealTime(Date.UTC(1987, 3, 10)) / 15).toFixed(4));
 * ```
 */
export function greenwichMeanSiderealTime(when: When, dut1 = 0): number {
  const jd = toJulianDate(moment(when) + dut1 * 1000);
  const T = (jd - J2000_JD) / 36525;
  return wrap(280.46061837 + 360.98564736629 * (jd - J2000_JD) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/**
 * The equation of the equinoxes in degrees: the nutation in longitude times the cosine of the obliquity, what apparent sidereal time has over mean (about 1 second of time at most).
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns Degrees, between about -0.0013 and 0.0013.
 *
 * @example
 * ```ts
 * import { equationOfTheEquinoxes } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log((equationOfTheEquinoxes(Date.UTC(1987, 3, 10)) * 240).toFixed(4));
 * ```
 */
export function equationOfTheEquinoxes(when: When): number {
  const T = (toTerrestrialTime(when) - J2000_MS) / (36525 * DAY_MS);
  const n = nutation(T);
  return (n.longitude * Math.cos(n.meanObliquity + n.obliquity)) / RAD;
}

/**
 * The Greenwich apparent sidereal time in degrees, 0 to 360: the mean time with the equation of the equinoxes added, which is what the hour angle of a body is measured against.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param dut1 - UT1 minus UTC in seconds, from the IERS; default 0.
 * @returns Degrees.
 *
 * @example
 * ```ts
 * import { greenwichApparentSiderealTime } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log((greenwichApparentSiderealTime(Date.UTC(1987, 3, 10)) / 15).toFixed(4));
 * ```
 */
export function greenwichApparentSiderealTime(when: When, dut1 = 0): number {
  return wrap(greenwichMeanSiderealTime(when, dut1) + equationOfTheEquinoxes(when));
}

/**
 * The local sidereal time in degrees, 0 to 360, at a longitude east of Greenwich (west negative): the right ascension on the meridian.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param longitude - Degrees east.
 * @param options - `apparent` (default `true`: with the equation of the equinoxes) and `dut1`, UT1 minus UTC in seconds.
 * @returns Degrees.
 *
 * @example
 * ```ts
 * import { localSiderealTime } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(localSiderealTime(Date.UTC(2026, 10, 7, 12), -123.1).toFixed(2));
 * ```
 */
export function localSiderealTime(when: When, longitude: number, options: { apparent?: boolean; dut1?: number } = {}): number {
  if (!Number.isFinite(longitude)) throw new RangeError(`longitude must be a finite number of degrees east, got ${longitude}`);
  const greenwich = options.apparent === false ? greenwichMeanSiderealTime(when, options.dut1) : greenwichApparentSiderealTime(when, options.dut1);
  return wrap(greenwich + longitude);
}
