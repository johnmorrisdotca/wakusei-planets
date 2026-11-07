// Time scales: UTC (the clock, as JavaScript counts it, no leap seconds), UT1 (the Earth's turn), TAI (atomic time), GPS, TT (terrestrial time) and TDB (barycentric dynamical time), with the leap seconds from 1972 (IERS Bulletin C)
// and delta T before. Every moment is a number of milliseconds since 1970 read on the named scale's own clock, so `convertTimeScale` adds or takes off the difference. Pure: no DOM, no three.js.
import { J2000_JD, TT_MINUS_TAI_SECONDS, taiMinusUtc, toJulianDate } from "./clock.ts";
import { moment, type When } from "./when.ts";

/**
 * A time scale: `utc` (the clock), `ut1` (the Earth's turn, within 0.9 s of UTC), `tai` (atomic time), `gps` (TAI less 19 s), `tt` (terrestrial time, TAI plus 32.184 s) and `tdb` (barycentric dynamical time, TT plus a few milliseconds that follow the year).
 *
 * @example
 * ```ts
 * import { type TimeScale } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * const scales: TimeScale[] = ["utc", "ut1", "tai", "gps", "tt", "tdb"];
 * console.log(scales.length);
 * ```
 */
export type TimeScale = "utc" | "ut1" | "tai" | "gps" | "tt" | "tdb";

const GPS_MINUS_TAI_SECONDS = -19;

/**
 * TDB minus TT in seconds: a term that follows the Earth round the Sun and is never more than 1.7 milliseconds (Meeus's two terms, 0.001657 sin g and 0.000014 sin 2g, good to about 30 microseconds).
 * @param when - A `Date` or milliseconds since 1970 (read as TT).
 * @returns Seconds.
 *
 * @example
 * ```ts
 * import { tdbMinusTt } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(Math.abs(tdbMinusTt(Date.UTC(2026, 0, 3))) < 0.002);
 * ```
 */
export function tdbMinusTt(when: When): number {
  const g = ((357.53 + 0.98560028 * (toJulianDate(when) - J2000_JD)) * Math.PI) / 180;
  return 0.001657 * Math.sin(g) + 0.000014 * Math.sin(2 * g);
}

function toUtc(ms: number, from: TimeScale, dut1: number): number {
  if (from === "utc") return ms;
  if (from === "ut1") return ms - dut1 * 1000;
  let tai = ms;
  if (from === "gps") tai = ms - GPS_MINUS_TAI_SECONDS * 1000;
  else if (from === "tt") tai = ms - TT_MINUS_TAI_SECONDS * 1000;
  else if (from === "tdb") tai = ms - tdbMinusTt(ms) * 1000 - TT_MINUS_TAI_SECONDS * 1000;
  let utc = tai;
  for (let i = 0; i < 3; i += 1) utc = tai - taiMinusUtc(utc) * 1000;
  return utc;
}

function fromUtc(utc: number, to: TimeScale, dut1: number): number {
  if (to === "utc") return utc;
  if (to === "ut1") return utc + dut1 * 1000;
  const tai = utc + taiMinusUtc(utc) * 1000;
  if (to === "tai") return tai;
  if (to === "gps") return tai + GPS_MINUS_TAI_SECONDS * 1000;
  const tt = tai + TT_MINUS_TAI_SECONDS * 1000;
  return to === "tt" ? tt : tt + tdbMinusTt(tt) * 1000;
}

/**
 * A moment on one time scale as the same moment on another, in milliseconds since 1970 read on the target scale's own clock. UTC to TT is the leap seconds plus 32.184 s from 1972 and delta T before;
 * UT1 needs `dut1` (UT1 minus UTC, from the IERS) and is UTC when it is left out, which is within 0.9 s; the TDB term is under 2 ms.
 * @param when - A `Date` or a number of milliseconds since 1970, on the `from` scale.
 * @param from - The scale it is on.
 * @param to - The scale wanted.
 * @param options - `dut1`, UT1 minus UTC in seconds, default 0.
 * @returns Milliseconds since 1970 on the `to` scale.
 *
 * @example
 * ```ts
 * import { convertTimeScale } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * const utc = Date.UTC(2026, 10, 7, 12);
 * console.log((convertTimeScale(utc, "utc", "tt") - utc) / 1000, (convertTimeScale(utc, "utc", "gps") - utc) / 1000);
 * ```
 */
export function convertTimeScale(when: When, from: TimeScale, to: TimeScale, options: { dut1?: number } = {}): number {
  const dut1 = options.dut1 ?? 0;
  if (!Number.isFinite(dut1)) throw new RangeError(`dut1 must be a finite number of seconds, got ${dut1}`);
  const ms = moment(when);
  return from === to ? ms : fromUtc(toUtc(ms, from, dut1), to, dut1);
}
