// Julian dates and the step from UTC to terrestrial time. The Julian date values are Meeus's own worked examples; the time-scale step is checked at the leap seconds' edges and, as a second opinion that is never
// shipped, against astronomy-engine's delta T over 1800 to 2005 (after that its delta T is a forecast and the real value, exact from the leap seconds, differs by several seconds).
import assert from "node:assert/strict";
import { test } from "node:test";
import { MakeTime } from "astronomy-engine";
import { fromJulianDate, fromJulianDayAndMilliseconds, modifiedJulianDate, toJulianDate, toJulianDay, toMillisecondsInJulianDay, toTerrestrialTime, ttMinusUtc } from "../src/time.ts";

test("Julian dates of known moments: J2000, the Unix epoch, Meeus's Sputnik example", () => {
  assert.equal(toJulianDate(Date.UTC(2000, 0, 1, 12)), 2451545);
  assert.equal(toJulianDate(0), 2440587.5);
  assert.equal(toJulianDate(Date.UTC(2000, 0, 1)), 2451544.5);
  // Meeus, Astronomical Algorithms, example 7.a: 1957 October 4.81 is JD 2436116.31
  assert.ok(Math.abs(toJulianDate(Date.UTC(1957, 9, 4, 19, 26, 24)) - 2436116.31) < 1e-6);
  assert.equal(modifiedJulianDate(Date.UTC(2000, 0, 1)), 51544);
});

test("a Julian date goes back to the same moment", () => {
  for (const ms of [Date.UTC(1800, 0, 1), Date.UTC(1969, 11, 31, 23, 59, 59), Date.UTC(2000, 0, 1, 12), Date.UTC(2026, 10, 7, 9, 30, 15, 123), Date.UTC(2200, 5, 15)]) {
    assert.ok(Math.abs(fromJulianDate(toJulianDate(ms)) - ms) < 1, `${new Date(ms).toISOString()}`);
  }
});

test("the Julian day starts at noon, and the day and the milliseconds of it go back to the very same millisecond", () => {
  assert.notEqual(toJulianDay(Date.UTC(2000, 0, 1, 11, 59, 59, 999)), toJulianDay(Date.UTC(2000, 0, 1, 12)));
  assert.equal(toJulianDay(Date.UTC(2000, 0, 1, 12)), 2451545);
  assert.equal(toMillisecondsInJulianDay(Date.UTC(2000, 0, 1, 18)), 6 * 3_600_000);
  for (let ms = -2_000_000_000_000; ms < 8_000_000_000_000; ms += 123_456_789_011) {
    const t = Math.round(ms);
    assert.equal(fromJulianDayAndMilliseconds(toJulianDay(t), toMillisecondsInJulianDay(t)), t);
    assert.ok(toMillisecondsInJulianDay(t) >= 0 && toMillisecondsInJulianDay(t) < 86_400_000);
  }
});

test("terrestrial time is UTC plus the leap seconds and 32.184 seconds: exact at the edges of the table", () => {
  assert.equal(ttMinusUtc(Date.UTC(1972, 0, 1)), 42.184);
  assert.equal(ttMinusUtc(Date.UTC(1971, 11, 31, 23, 59, 59)) > 42 && ttMinusUtc(Date.UTC(1971, 11, 31, 23, 59, 59)) < 42.4, true);
  assert.equal(ttMinusUtc(Date.UTC(2016, 11, 31, 23, 59, 59)), 68.184);
  assert.equal(ttMinusUtc(Date.UTC(2017, 0, 1)), 69.184);
  assert.equal(ttMinusUtc(Date.UTC(2026, 10, 7)), 69.184);
  assert.equal(toTerrestrialTime(Date.UTC(2017, 0, 1)) - Date.UTC(2017, 0, 1), 69184);
});

test("delta T before 1972 is continuous at the 1972 edge and agrees with astronomy-engine from 1800 to 2005", () => {
  for (let year = 1800; year <= 2005; year += 4) {
    const ms = Date.UTC(year, 5, 15);
    const theirs = (MakeTime(new Date(ms)).tt - MakeTime(new Date(ms)).ut) * 86400;
    const ours = ttMinusUtc(ms);
    assert.ok(Math.abs(ours - theirs) < 1.5, `${year}: ${ours.toFixed(2)} s here, ${theirs.toFixed(2)} s in astronomy-engine`);
  }
});
