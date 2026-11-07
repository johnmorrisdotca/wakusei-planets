// The clock under the sky: Julian dates, the leap seconds and delta T, and the step from the clock (UTC) to terrestrial time (TT), the dynamical time the planets' theories are written in. Pure: no DOM, no three.js.
// `time.ts` is the public entry that gathers this with the calendar, the time scales, sidereal time and Mars time.
// From 1972 the step is exact: TT is TAI plus 32.184 seconds and TAI is UTC plus the leap seconds (IERS Bulletin C). Before 1972 it is delta T, from the polynomials of Espenak and Meeus
// (NASA, https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html, for 1800 to 1972) and Morrison and Stephenson's parabola outside 1800 to 1972.

import { moment, type When } from "./when.ts";

export const DAY_MS = 86_400_000;
/** The Julian date of the Unix epoch, 1970-01-01T00:00:00Z. */
export const UNIX_EPOCH_JD = 2_440_587.5;
/** The Julian date of the Unix epoch in milliseconds: exact in a 64-bit number, so the day and the milliseconds of the day lose nothing. */
const JD_EPOCH_MS = 210_866_760_000_000;
const MJD_OFFSET = 2_400_000.5;
export const TT_MINUS_TAI_SECONDS = 32.184;
/** The length of a Gregorian year in milliseconds, for turning a time into a decimal year. */
export const YEAR_MS = 31_556_952_000;

/** TAI minus UTC, in seconds, from the date it took effect (IERS Bulletin C). After the last one, none has been added. */
export const LEAP_SECONDS: readonly (readonly [number, number])[] = [
  [Date.UTC(1972, 0, 1), 10], [Date.UTC(1972, 6, 1), 11], [Date.UTC(1973, 0, 1), 12], [Date.UTC(1974, 0, 1), 13], [Date.UTC(1975, 0, 1), 14], [Date.UTC(1976, 0, 1), 15],
  [Date.UTC(1977, 0, 1), 16], [Date.UTC(1978, 0, 1), 17], [Date.UTC(1979, 0, 1), 18], [Date.UTC(1980, 0, 1), 19], [Date.UTC(1981, 6, 1), 20], [Date.UTC(1982, 6, 1), 21],
  [Date.UTC(1983, 6, 1), 22], [Date.UTC(1985, 6, 1), 23], [Date.UTC(1988, 0, 1), 24], [Date.UTC(1990, 0, 1), 25], [Date.UTC(1991, 0, 1), 26], [Date.UTC(1992, 6, 1), 27],
  [Date.UTC(1993, 6, 1), 28], [Date.UTC(1994, 6, 1), 29], [Date.UTC(1996, 0, 1), 30], [Date.UTC(1997, 6, 1), 31], [Date.UTC(1999, 0, 1), 32], [Date.UTC(2006, 0, 1), 33],
  [Date.UTC(2009, 0, 1), 34], [Date.UTC(2012, 6, 1), 35], [Date.UTC(2015, 6, 1), 36], [Date.UTC(2017, 0, 1), 37],
];

/**
 * A time as a Julian date: the days since noon on 1 January 4713 BC (Julian calendar), as a number. A `Date` or milliseconds since 1970 in, the same scale out (UTC stays UTC).
 * A number near today holds about a tenth of a millisecond; `toJulianDay` and `toMillisecondsInJulianDay` give the same instant with nothing lost.
 * @param when - A `Date` or milliseconds since 1970.
 * @returns The Julian date.
 *
 * @example
 * ```ts
 * import { toJulianDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(toJulianDate(Date.UTC(2013, 10, 21, 10, 47, 2)).toFixed(6));
 * ```
 */
export function toJulianDate(when: When): number {
  return moment(when) / DAY_MS + UNIX_EPOCH_JD;
}

/**
 * The time, in milliseconds since 1970, of a Julian date.
 * @param jd - The Julian date.
 * @returns Milliseconds since 1970.
 *
 * @example
 * ```ts
 * import { fromJulianDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(new Date(fromJulianDate(2451545)).toISOString());
 * ```
 */
export function fromJulianDate(jd: number): number {
  return (jd - UNIX_EPOCH_JD) * DAY_MS;
}

/**
 * The modified Julian date: the Julian date less 2,400,000.5, so a day starts at midnight and the numbers are shorter.
 * @param when - A `Date` or milliseconds since 1970.
 * @returns The modified Julian date.
 *
 * @example
 * ```ts
 * import { modifiedJulianDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(modifiedJulianDate(Date.UTC(2000, 0, 1)));
 * ```
 */
export function modifiedJulianDate(when: When): number {
  return toJulianDate(when) - MJD_OFFSET;
}

/**
 * The whole Julian day of a time. A Julian day starts at noon, so 11:59 and 12:00 are in different days.
 * @param when - A `Date` or milliseconds since 1970.
 * @returns The integer Julian day number.
 *
 * @example
 * ```ts
 * import { toJulianDay } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(toJulianDay(Date.UTC(2000, 0, 1, 12)));
 * ```
 */
export function toJulianDay(when: When): number {
  return Math.floor((moment(when) + JD_EPOCH_MS) / DAY_MS);
}

/**
 * The milliseconds since noon, the start of the Julian day, that a time is into it.
 * @param when - A `Date` or milliseconds since 1970.
 * @returns Milliseconds from 0 up to one day.
 *
 * @example
 * ```ts
 * import { toMillisecondsInJulianDay } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(toMillisecondsInJulianDay(Date.UTC(2000, 0, 1, 18)));
 * ```
 */
export function toMillisecondsInJulianDay(when: When): number {
  const t = moment(when) + JD_EPOCH_MS;
  return t - Math.floor(t / DAY_MS) * DAY_MS;
}

/**
 * A time from a Julian day and the milliseconds into it, with no digit lost: `fromJulianDayAndMilliseconds(toJulianDay(t), toMillisecondsInJulianDay(t))` is `t`.
 * @param day - The integer Julian day number.
 * @param msInDay - Milliseconds since the day began at noon.
 * @returns Milliseconds since 1970.
 *
 * @example
 * ```ts
 * import { fromJulianDayAndMilliseconds, toJulianDay, toMillisecondsInJulianDay } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * const t = Date.UTC(2026, 10, 7, 9, 30, 15, 123);
 * console.log(fromJulianDayAndMilliseconds(toJulianDay(t), toMillisecondsInJulianDay(t)) === t);
 * ```
 */
export function fromJulianDayAndMilliseconds(day: number, msInDay: number): number {
  return day * DAY_MS + msInDay - JD_EPOCH_MS;
}

export function deltaTPolynomial(year: number): number {
  if (year < 1800 || year >= 1972) {
    const u = (year - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (year < 1860) {
    const t = year - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (year < 1900) {
    const t = year - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (year < 1920) {
    const t = year - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (year < 1941) {
    const t = year - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (year < 1961) {
    const t = year - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  const t = year - 1975;
  return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
}

/**
 * Terrestrial time minus the clock's time, in seconds, at a moment given in UTC: 69.184 from the last leap second in 2017 on (until another is added), exact from 1972, and delta T before.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns Seconds to add to UTC to get TT.
 *
 * @example
 * ```ts
 * import { ttMinusUtc } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(ttMinusUtc(Date.UTC(2026, 10, 7)));
 * ```
 */
export function ttMinusUtc(when: When): number {
  const ms = moment(when);
  let i = LEAP_SECONDS.length;
  while (i) {
    const [from, seconds] = LEAP_SECONDS[--i]!;
    if (ms >= from) return seconds + TT_MINUS_TAI_SECONDS;
  }
  return deltaTPolynomial(1970 + ms / YEAR_MS);
}

/**
 * A moment in UTC as the same moment in terrestrial time, on the same scale of milliseconds since 1970.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The same moment in TT, in milliseconds.
 *
 * @example
 * ```ts
 * import { toTerrestrialTime } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * const utc = Date.UTC(2000, 0, 1, 12);
 * console.log((toTerrestrialTime(utc) - utc) / 1000);
 * ```
 */
export function toTerrestrialTime(when: When): number {
  const ms = moment(when);
  return ms + ttMinusUtc(ms) * 1000;
}

/**
 * The Julian date of J2000.0, 2000-01-01 12:00 TT: the epoch of the planets' theories.
 *
 * @example
 * ```ts
 * import { J2000_JD, toJulianDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(J2000_JD === toJulianDate(Date.UTC(2000, 0, 1, 12)));
 * ```
 */
export const J2000_JD = 2_451_545;
/**
 * J2000.0, 2000-01-01 12:00, as milliseconds since 1970 counted on a clock that reads TT: a terrestrial time is this far from it.
 *
 * @example
 * ```ts
 * import { J2000_MS } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(new Date(J2000_MS).toISOString());
 * ```
 */
export const J2000_MS = 946_728_000_000;
/**
 * The Julian date of the Besselian epoch B1950.0, 1950 January 0.923 (Meeus).
 *
 * @example
 * ```ts
 * import { B1950_JD } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(B1950_JD);
 * ```
 */
export const B1950_JD = 2_433_282.4235;
/**
 * The Julian date of the Unix epoch, 1970-01-01T00:00:00Z (UTC).
 *
 * @example
 * ```ts
 * import { UNIX_EPOCH_JULIAN_DATE, toJulianDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(UNIX_EPOCH_JULIAN_DATE === toJulianDate(0));
 * ```
 */
export const UNIX_EPOCH_JULIAN_DATE = UNIX_EPOCH_JD;

/**
 * A time as a string of its Julian date with six decimals, as the `julian` package gives it (a tenth of a second).
 * @param when - A `Date` or milliseconds since 1970.
 * @returns The Julian date as a string.
 *
 * @example
 * ```ts
 * import { julian } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(julian(new Date("2013-11-21T10:47:02Z")));
 * ```
 */
export function julian(when: When): string {
  return toJulianDate(when).toFixed(6);
}

/**
 * The `Date` of a Julian date (a number, or the string `julian` gives), rounded to the millisecond.
 * @param jd - The Julian date.
 * @returns A `Date`.
 *
 * @example
 * ```ts
 * import { toDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(toDate("2456617.949335").toISOString());
 * ```
 */
export function toDate(jd: number | string): Date {
  const value = typeof jd === "string" ? Number(jd) : jd;
  if (!Number.isFinite(value)) throw new RangeError(`jd must be a finite Julian date, got ${String(jd)}`);
  return new Date(Math.round(fromJulianDate(value)));
}

/**
 * Julian centuries (36,525 days) from J2000.0: the time argument of most theories. In terrestrial time unless `scale` says UTC.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param scale - `"tt"` (the default, what the theories want) or `"utc"` to count the clock's days.
 * @returns Julian centuries, negative before 2000.
 *
 * @example
 * ```ts
 * import { julianCenturies } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(julianCenturies(Date.UTC(2100, 0, 1, 12)).toFixed(6));
 * ```
 */
export function julianCenturies(when: When, scale: "tt" | "utc" = "tt"): number {
  const ms = scale === "tt" ? toTerrestrialTime(when) : moment(when);
  return (ms - J2000_MS) / (36_525 * DAY_MS);
}

/**
 * Julian millennia (365,250 days) from J2000.0, in terrestrial time unless `scale` says UTC: the time argument of the VSOP87 series.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param scale - `"tt"` (the default) or `"utc"`.
 * @returns Julian millennia, negative before 2000.
 *
 * @example
 * ```ts
 * import { julianMillennia } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(julianMillennia(Date.UTC(3000, 0, 1, 12)).toFixed(6));
 * ```
 */
export function julianMillennia(when: When, scale: "tt" | "utc" = "tt"): number {
  return julianCenturies(when, scale) / 10;
}

/**
 * TAI minus UTC in seconds: the leap seconds from 1972 (10 then, 37 since 2017), and before 1972 delta T less 32.184, which is how far the atomic scale would have been from the Earth's turn.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns Seconds to add to UTC to get TAI.
 *
 * @example
 * ```ts
 * import { taiMinusUtc } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(taiMinusUtc(Date.UTC(2026, 10, 7)));
 * ```
 */
export function taiMinusUtc(when: When): number {
  return ttMinusUtc(when) - TT_MINUS_TAI_SECONDS;
}

/**
 * Delta T, terrestrial time minus universal time (UT1), in seconds. From 1972 it is the leap seconds plus 32.184 s less `dut1` (UT1 minus UTC, which the IERS publishes and is under 0.9 s: leave it out and it is taken as 0),
 * before 1972 the polynomials of Espenak and Meeus (NASA). After the last leap second it is held at 69.184 s, the assumption JPL Horizons makes.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param dut1 - UT1 minus UTC in seconds, from the IERS; default 0.
 * @returns Seconds.
 *
 * @example
 * ```ts
 * import { deltaT } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(deltaT(Date.UTC(1900, 0, 1)).toFixed(1), deltaT(Date.UTC(2026, 10, 7)));
 * ```
 */
export function deltaT(when: When, dut1 = 0): number {
  return ttMinusUtc(when) - dut1;
}
