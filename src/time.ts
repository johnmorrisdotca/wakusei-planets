// Time for the sky: Julian dates, and the step from the clock (UTC) to terrestrial time (TT), the dynamical time the planets' theories are written in. Pure: no DOM, no three.js.
// From 1972 the step is exact: TT is TAI plus 32.184 seconds and TAI is UTC plus the leap seconds (IERS Bulletin C). Before 1972 it is delta T, from the polynomials of Espenak and Meeus
// (NASA, https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html, for 1800 to 1972) and Morrison and Stephenson's parabola outside 1800 to 1972.

const DAY_MS = 86_400_000;
/** The Julian date of the Unix epoch, 1970-01-01T00:00:00Z. */
const UNIX_EPOCH_JD = 2_440_587.5;
/** The Julian date of the Unix epoch in milliseconds: exact in a 64-bit number, so the day and the milliseconds of the day lose nothing. */
const JD_EPOCH_MS = 210_866_760_000_000;
const MJD_OFFSET = 2_400_000.5;
const TT_MINUS_TAI_SECONDS = 32.184;
/** The length of a Gregorian year in milliseconds, for turning a time into a decimal year. */
const YEAR_MS = 31_556_952_000;

/** TAI minus UTC, in seconds, from the date it took effect (IERS Bulletin C). After the last one, none has been added. */
const LEAP_SECONDS: readonly (readonly [number, number])[] = [
  [Date.UTC(1972, 0, 1), 10], [Date.UTC(1972, 6, 1), 11], [Date.UTC(1973, 0, 1), 12], [Date.UTC(1974, 0, 1), 13], [Date.UTC(1975, 0, 1), 14], [Date.UTC(1976, 0, 1), 15],
  [Date.UTC(1977, 0, 1), 16], [Date.UTC(1978, 0, 1), 17], [Date.UTC(1979, 0, 1), 18], [Date.UTC(1980, 0, 1), 19], [Date.UTC(1981, 6, 1), 20], [Date.UTC(1982, 6, 1), 21],
  [Date.UTC(1983, 6, 1), 22], [Date.UTC(1985, 6, 1), 23], [Date.UTC(1988, 0, 1), 24], [Date.UTC(1990, 0, 1), 25], [Date.UTC(1991, 0, 1), 26], [Date.UTC(1992, 6, 1), 27],
  [Date.UTC(1993, 6, 1), 28], [Date.UTC(1994, 6, 1), 29], [Date.UTC(1996, 0, 1), 30], [Date.UTC(1997, 6, 1), 31], [Date.UTC(1999, 0, 1), 32], [Date.UTC(2006, 0, 1), 33],
  [Date.UTC(2009, 0, 1), 34], [Date.UTC(2012, 6, 1), 35], [Date.UTC(2015, 6, 1), 36], [Date.UTC(2017, 0, 1), 37],
];

/**
 * A time as a Julian date: the days since noon on 1 January 4713 BC (Julian calendar), as a number. A `Date` or milliseconds since 1970 in, the same scale out (UTC stays UTC).
 * A number near today holds about a tenth of a millisecond; `toJulianDay` and `toMillisecondsInJulianDay` give the same instant with nothing lost.
 * @param ms - Milliseconds since 1970.
 * @returns The Julian date.
 *
 * @example
 * ```ts
 * import { toJulianDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(toJulianDate(Date.UTC(2013, 10, 21, 10, 47, 2)).toFixed(6));
 * ```
 */
export function toJulianDate(ms: number): number {
  return ms / DAY_MS + UNIX_EPOCH_JD;
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
 * @param ms - Milliseconds since 1970.
 * @returns The modified Julian date.
 *
 * @example
 * ```ts
 * import { modifiedJulianDate } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(modifiedJulianDate(Date.UTC(2000, 0, 1)));
 * ```
 */
export function modifiedJulianDate(ms: number): number {
  return toJulianDate(ms) - MJD_OFFSET;
}

/**
 * The whole Julian day of a time. A Julian day starts at noon, so 11:59 and 12:00 are in different days.
 * @param ms - Milliseconds since 1970.
 * @returns The integer Julian day number.
 *
 * @example
 * ```ts
 * import { toJulianDay } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(toJulianDay(Date.UTC(2000, 0, 1, 12)));
 * ```
 */
export function toJulianDay(ms: number): number {
  return Math.floor((ms + JD_EPOCH_MS) / DAY_MS);
}

/**
 * The milliseconds since noon, the start of the Julian day, that a time is into it.
 * @param ms - Milliseconds since 1970.
 * @returns Milliseconds from 0 up to one day.
 *
 * @example
 * ```ts
 * import { toMillisecondsInJulianDay } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(toMillisecondsInJulianDay(Date.UTC(2000, 0, 1, 18)));
 * ```
 */
export function toMillisecondsInJulianDay(ms: number): number {
  const t = ms + JD_EPOCH_MS;
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

function deltaT(year: number): number {
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
 * @param ms - Milliseconds since 1970 (UTC).
 * @returns Seconds to add to UTC to get TT.
 *
 * @example
 * ```ts
 * import { ttMinusUtc } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(ttMinusUtc(Date.UTC(2026, 10, 7)));
 * ```
 */
export function ttMinusUtc(ms: number): number {
  if (ms >= LEAP_SECONDS[0]![0]) {
    let taiMinusUtc = LEAP_SECONDS[0]![1];
    for (const [from, seconds] of LEAP_SECONDS) if (ms >= from) taiMinusUtc = seconds;
    return taiMinusUtc + TT_MINUS_TAI_SECONDS;
  }
  return deltaT(1970 + ms / YEAR_MS);
}

/**
 * A moment in UTC as the same moment in terrestrial time, on the same scale of milliseconds since 1970.
 * @param ms - Milliseconds since 1970 (UTC).
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
export function toTerrestrialTime(ms: number): number {
  return ms + ttMinusUtc(ms) * 1000;
}
