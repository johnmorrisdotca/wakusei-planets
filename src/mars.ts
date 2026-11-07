// Mars time: the Mars Sol Date and Coordinated Mars Time of Allison and McEwen (2000, Planetary and Space Science 48, 215), from terrestrial time, and the local mean solar time at a longitude.
// A sol is 1.0274912517 days (88,775.244 seconds). Pure: no DOM, no three.js.
import { toJulianDate, toTerrestrialTime } from "./clock.ts";
import type { When } from "./when.ts";

/**
 * The Mars Sol Date: the count of Martian days, as the Julian date counts Earth's. 44796.0 is about 2000-01-06 00:00 TT.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns Sols, with the fraction of the sol.
 *
 * @example
 * ```ts
 * import { marsSolDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(marsSolDate(Date.UTC(2021, 1, 18, 20, 55)).toFixed(3));
 * ```
 */
export function marsSolDate(when: When): number {
  return (toJulianDate(toTerrestrialTime(when)) - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626;
}

/**
 * Coordinated Mars Time: the mean solar time on Mars's prime meridian, in hours from 0 up to 24 (a Martian hour is 1/24 of a sol).
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns Hours.
 *
 * @example
 * ```ts
 * import { coordinatedMarsTime } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(coordinatedMarsTime(Date.UTC(2021, 1, 18, 20, 55)).toFixed(2));
 * ```
 */
export function coordinatedMarsTime(when: When): number {
  const sol = marsSolDate(when);
  return (sol - Math.floor(sol)) * 24;
}

/**
 * The local mean solar time on Mars at a longitude east of its prime meridian, in hours from 0 up to 24.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param longitude - Degrees east (Jezero Crater is 77.45).
 * @returns Hours.
 *
 * @example
 * ```ts
 * import { marsLocalMeanSolarTime } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(marsLocalMeanSolarTime(Date.UTC(2021, 1, 18, 20, 55), 77.45).toFixed(1));
 * ```
 */
export function marsLocalMeanSolarTime(when: When, longitude: number): number {
  if (!Number.isFinite(longitude)) throw new RangeError(`longitude must be a finite number of degrees east, got ${longitude}`);
  return (((coordinatedMarsTime(when) + longitude / 15) % 24) + 24) % 24;
}
