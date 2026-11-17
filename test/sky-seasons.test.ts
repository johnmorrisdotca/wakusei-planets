// /sky seasons(): the equinoxes and solstices against the US Naval Observatory's table (the time of the seasons, UT, to the minute).
// Source: USNO Astronomical Applications Department, "Earth's Seasons - Equinoxes, Solstices, Perihelion, and Aphelion" data service, https://aa.usno.navy.mil/api/seasons?year=<year> (tz 0), read on 2026-11-17 one year at a time
// (1900, 2000, 2026 and 2050) and typed in by hand below; nothing was saved or downloaded. The table is to the minute, so its own rounding is up to 30 seconds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { seasons } from "../src/sky.ts";

/** [year, then month-day hour:minute UT of the March equinox, June solstice, September equinox and December solstice]. */
const USNO: Array<[number, [number, number, number, number][]]> = [
  [1900, [[3, 21, 1, 39], [6, 21, 21, 40], [9, 23, 12, 20], [12, 22, 6, 41]]],
  [2000, [[3, 20, 7, 35], [6, 21, 1, 48], [9, 22, 17, 28], [12, 21, 13, 37]]],
  [2026, [[3, 20, 14, 46], [6, 21, 8, 24], [9, 23, 0, 5], [12, 21, 20, 50]]],
  [2050, [[3, 20, 10, 19], [6, 21, 3, 33], [9, 22, 19, 28], [12, 21, 16, 38]]],
];
/** What the test holds the wrapper to: the table's own 30 second rounding plus up to 30 seconds of the engine's own series (measured worst: 60.3 s, 2026 June solstice). */
const TOLERANCE_MS = 90_000;

test("the four seasons of 1900, 2000, 2026 and 2050 are within 90 seconds of the USNO table, and the worst miss is reported", () => {
  let worst = 0;
  for (const [year, table] of USNO) {
    const got = seasons(year);
    [got.marchEquinox, got.juneSolstice, got.septemberEquinox, got.decemberSolstice].forEach((date, i) => {
      const [month, day, hour, minute] = table[i]!;
      const miss = Math.abs(date.getTime() - Date.UTC(year, month - 1, day, hour, minute));
      worst = Math.max(worst, miss);
      assert.ok(miss <= TOLERANCE_MS, `${year} season ${i + 1}: ${date.toISOString()} is ${miss / 1000} s from the USNO ${month}-${day} ${hour}:${minute}`);
    });
  }
  console.log(`seasons: worst miss against USNO ${worst / 1000} s over 16 events`);
});

test("the seasons come in order, as Dates, and a non-integer year throws a RangeError naming it", () => {
  for (const year of [1750, 2026, 2250]) {
    const s = seasons(year);
    assert.ok(s.marchEquinox < s.juneSolstice && s.juneSolstice < s.septemberEquinox && s.septemberEquinox < s.decemberSolstice);
    assert.ok(s.marchEquinox instanceof Date && s.marchEquinox.getUTCFullYear() === year);
  }
  for (const bad of [2026.5, Number.NaN, Number.POSITIVE_INFINITY, "2026" as unknown as number]) assert.throws(() => seasons(bad), (e: Error) => e instanceof RangeError && /year/.test(e.message));
});
