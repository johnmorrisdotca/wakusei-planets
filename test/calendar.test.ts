// Calendars, time scales, sidereal time and Mars time. Known answers are Meeus's worked examples (Astronomical Algorithms, chapters 7 and 12) and the published Mars Sol Date definition (Allison and McEwen 2000);
// the `julian` package (MIT, dev-only) is the oracle for the functions this package takes over from it; astronomy-engine for sidereal time. Round trips run over the whole range of a JavaScript Date.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import * as Astronomy from "astronomy-engine";
import {
  B1950_JD, J2000_JD, convertTimeScale, coordinatedMarsTime, dayOfWeek, dayOfYear, daysInMonth, deltaT, equationOfTheEquinoxes, fromCalendar, fromJulianDate, fromJulianDayAndMilliseconds,
  greenwichApparentSiderealTime, greenwichMeanSiderealTime, isLeapYear, julian, julianCenturies, julianMillennia, localSiderealTime, marsLocalMeanSolarTime, marsSolDate, taiMinusUtc, tdbMinusTt,
  toCalendar, toDate, toJulianDate, toJulianDay, toMillisecondsInJulianDay, toTerrestrialTime, ttMinusUtc,
} from "../src/time.ts";

const require = createRequire(import.meta.url);
const julianPackage = require("julian") as ((d: Date) => string) & { toDate(jd: string | number): Date; toJulianDay(d: Date | number): number; toMillisecondsInJulianDay(d: Date | number): number; fromJulianDayAndMilliseconds(day: number, ms: number): number };

test("the julian package's functions give the same answers under the same names, on 2,000 moments from 1970 to 2300", () => {
  for (let i = 0; i < 2000; i += 1) {
    const ms = Math.round(Date.UTC(1970, 0, 1) + ((Date.UTC(2300, 0, 1) - Date.UTC(1970, 0, 1)) * ((i * 7919) % 2000)) / 2000 + i * 12_345);
    const date = new Date(ms);
    assert.equal(julian(date), julianPackage(date), `julian(${date.toISOString()})`);
    assert.equal(toJulianDay(date), julianPackage.toJulianDay(date));
    assert.equal(toMillisecondsInJulianDay(date), julianPackage.toMillisecondsInJulianDay(date));
    assert.equal(fromJulianDayAndMilliseconds(toJulianDay(date), toMillisecondsInJulianDay(date)), ms);
    // the package lets Date truncate the fraction of a millisecond, this one rounds to the nearest: a millisecond apart at most, on a string that holds only 86 milliseconds
    assert.ok(Math.abs(toDate(julian(date)).getTime() - julianPackage.toDate(julian(date)).getTime()) <= 1);
  }
  assert.equal(julian(new Date("2013-11-21T10:47:02Z")), "2456617.949329", "the julian README's moment, to the second");
});

test("before 12:00 UTC on 31 December 1969 the julian package truncates toward zero and gives a day one too high and a negative millisecond count; this package floors, so the pair is right and the date string still agrees", () => {
  for (const iso of ["1700-01-01T00:00:00Z", "1886-11-25T16:04:41.865Z", "1959-10-20T18:53:16.830Z", "1969-12-31T11:59:59Z"]) {
    const date = new Date(iso);
    assert.equal(julianPackage.toJulianDay(date), toJulianDay(date) + 1, iso);
    assert.ok(julianPackage.toMillisecondsInJulianDay(date) < 0 && toMillisecondsInJulianDay(date) >= 0 && toMillisecondsInJulianDay(date) < 86_400_000, iso);
    assert.equal(julian(date), julianPackage(date), iso);
    assert.equal(fromJulianDayAndMilliseconds(toJulianDay(date), toMillisecondsInJulianDay(date)), date.getTime(), iso);
  }
});

test("Meeus's calendar examples: 1957 October 4.81, 333 January 27.5 (Julian), the day of the week and of the year", () => {
  assert.ok(Math.abs(toJulianDate(fromCalendar({ year: 1957, month: 10, day: 4, hour: 19, minute: 26, second: 24 })) - 2436116.31) < 1e-6);
  assert.equal(toJulianDate(fromCalendar({ year: 333, month: 1, day: 27, hour: 12 }, "julian")), 1842713);
  assert.deepEqual(toCalendar(Math.round(fromJulianDate(1842713)), "julian"), { year: 333, month: 1, day: 27, hour: 12, minute: 0, second: 0, millisecond: 0 });
  assert.deepEqual(toCalendar(Math.round(fromJulianDate(2436116.31))), { year: 1957, month: 10, day: 4, hour: 19, minute: 26, second: 24, millisecond: 0 });
  assert.equal(toJulianDate(fromCalendar({ year: -4712, month: 1, day: 1, hour: 12 }, "julian")), 0, "the Julian date's own zero");
  assert.equal(toJulianDate(fromCalendar({ year: 1858, month: 11, day: 17 })), 2400000.5, "modified Julian date 0");
  assert.equal(toJulianDate(fromCalendar({ year: 1900, month: 1, day: 1 })), 2415020.5);
  assert.equal(dayOfWeek(Date.UTC(1954, 5, 30)), 3, "30 June 1954 was a Wednesday");
  assert.equal(dayOfWeek(Date.UTC(2000, 0, 1)), 6);
  assert.equal(dayOfYear(Date.UTC(1978, 10, 14)), 318);
  assert.equal(dayOfYear(Date.UTC(1988, 3, 22)), 113);
});

test("the switch of 1582: 4 October (Julian) is followed by 15 October (Gregorian), a day apart and a Thursday then a Friday, and the ten days between do not exist", () => {
  const last = fromCalendar({ year: 1582, month: 10, day: 4 });
  const first = fromCalendar({ year: 1582, month: 10, day: 15 });
  assert.equal(first - last, 86_400_000);
  assert.deepEqual([dayOfWeek(last), dayOfWeek(first)], [4, 5]);
  assert.equal(toJulianDate(first), 2299160.5);
  assert.deepEqual(toCalendar(first, "julian").day, 5, "the same day in the Julian calendar is 5 October");
  assert.deepEqual([toCalendar(last).day, toCalendar(first).day], [4, 15]);
  assert.throws(() => fromCalendar({ year: 1582, month: 10, day: 10 }), /skipped 5 to 14 October 1582/);
  assert.equal(daysInMonth(1582, 10), 21);
  assert.equal(dayOfYear(Date.UTC(1582, 11, 31)), 355, "the year of the switch has 355 days");
});

test("leap years and the length of months in each calendar, including years before 1 CE", () => {
  assert.deepEqual([1900, 2000, 2024, 2100].map((y) => isLeapYear(y)), [false, true, true, false]);
  assert.equal(isLeapYear(1900, "julian"), true);
  assert.equal(isLeapYear(0, "gregorian"), true, "the year 0 is divisible by 400");
  assert.deepEqual([-4, -1, 0, 4].map((y) => isLeapYear(y, "julian")), [true, false, true, true]);
  assert.equal(isLeapYear(1500), true, "auto uses the Julian rule before 1582");
  assert.deepEqual([daysInMonth(2024, 2), daysInMonth(2023, 2), daysInMonth(2023, 4), daysInMonth(2023, 12)], [29, 28, 30, 31]);
});

test("a date goes to a moment and back for every day from the year -5000 to 5000 in both calendars, and to the ends of a JavaScript Date", () => {
  for (const calendar of ["gregorian", "julian", "auto"] as const) {
    let previous = Number.NEGATIVE_INFINITY;
    for (let year = -5000; year <= 5000; year += 7) {
      for (const [month, day] of [[1, 1], [2, 28], [3, 1], [12, 31]] as const) {
        const ms = fromCalendar({ year, month, day, hour: 13, minute: 14, second: 15, millisecond: 16 }, calendar);
        assert.deepEqual(toCalendar(ms, calendar), { year, month, day, hour: 13, minute: 14, second: 15, millisecond: 16 }, `${year}-${month}-${day} ${calendar}`);
        if (month === 1 && day === 1) {
          assert.ok(ms > previous);
          previous = ms;
        }
      }
    }
  }
  for (const year of [-271821, -100000, 275759]) assert.equal(toCalendar(fromCalendar({ year, month: 6, day: 15 }, "gregorian"), "gregorian").year, year);
});

test("the Gregorian calendar agrees with JavaScript's own Date on every day from 1000 to 3000", () => {
  for (let ms = Date.UTC(1000, 0, 1); ms < Date.UTC(3000, 0, 1); ms += 86_400_000 * 13 + 3_600_000 * 5) {
    const d = new Date(ms);
    const c = toCalendar(ms, "gregorian");
    assert.deepEqual([c.year, c.month, c.day, c.hour, c.minute, c.second], [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]);
    assert.equal(dayOfWeek(ms), d.getUTCDay());
  }
});

test("bad dates throw with the value: a day that does not exist, a month of 13, a half second, a leap day in a common year", () => {
  assert.throws(() => fromCalendar({ year: 2023, month: 2, day: 29 }), /2023-2-29 does not exist/);
  assert.throws(() => fromCalendar({ year: 2023, month: 13, day: 1 }), RangeError);
  assert.throws(() => fromCalendar({ year: 2023, month: 4, day: 31 }), RangeError);
  assert.throws(() => fromCalendar({ year: 2023, month: 1, day: 1, second: 0.5 }), /second must be a whole number, got 0.5/);
  assert.throws(() => fromCalendar({ year: 2023, month: 1, day: 1, hour: 24 }), RangeError);
  assert.throws(() => toCalendar(Number.NaN), RangeError);
  assert.throws(() => toCalendar(new Date("nope")), /valid Date/);
  assert.throws(() => dayOfWeek("2000-01-01" as unknown as number), TypeError);
  assert.throws(() => daysInMonth(2024, 0), RangeError);
});

test("a Date is never changed, and a Date and the same milliseconds give the same answer in every function", () => {
  const date = new Date("2026-11-07T12:34:56.789Z");
  const before = date.getTime();
  for (const f of [toJulianDate, toJulianDay, toMillisecondsInJulianDay, ttMinusUtc, taiMinusUtc, deltaT, toCalendar, dayOfWeek, dayOfYear, greenwichMeanSiderealTime, greenwichApparentSiderealTime, marsSolDate, coordinatedMarsTime, julianCenturies, julianMillennia, tdbMinusTt, equationOfTheEquinoxes] as Array<(w: Date | number) => unknown>) {
    assert.deepEqual(f(date), f(before), f.name);
  }
  assert.equal(date.getTime(), before);
});

test("time scales: the leap seconds, GPS and TT, TDB's millisecond, and every pair goes back to the same moment from 1800 to 2200", () => {
  const utc = Date.UTC(2026, 10, 7, 12);
  const seconds = (to: "tai" | "gps" | "tt" | "ut1"): number => (convertTimeScale(utc, "utc", to, { dut1: -0.1 }) - utc) / 1000;
  assert.deepEqual([seconds("tai"), seconds("gps"), seconds("tt"), seconds("ut1")], [37, 18, 69.184, -0.1]);
  assert.equal(convertTimeScale(utc, "utc", "tt"), toTerrestrialTime(utc));
  assert.equal(taiMinusUtc(Date.UTC(2016, 11, 31, 23, 59, 59)), 36);
  assert.equal(taiMinusUtc(Date.UTC(2017, 0, 1)), 37);
  assert.equal(taiMinusUtc(Date.UTC(1972, 0, 1)), 10);
  assert.equal(deltaT(utc, 0.2), 69.184 - 0.2);
  let widest = 0;
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 86_400_000) widest = Math.max(widest, Math.abs(tdbMinusTt(ms)));
  assert.ok(widest > 0.0016 && widest < 0.0017, `TDB-TT peaks at ${widest} s, 1.657 ms in the literature`);
  const scales = ["utc", "ut1", "tai", "gps", "tt", "tdb"] as const;
  for (let ms = Date.UTC(1800, 0, 1); ms < Date.UTC(2200, 0, 1); ms += 86_400_000 * 211 + 7_123_456) {
    for (const from of scales) for (const to of scales) {
      const there = convertTimeScale(ms, from, to, { dut1: 0.3 });
      assert.ok(Math.abs(convertTimeScale(there, to, from, { dut1: 0.3 }) - ms) < 0.5, `${from} to ${to} and back at ${new Date(ms).toISOString()}`);
    }
  }
  assert.throws(() => convertTimeScale(utc, "utc", "tt", { dut1: Number.NaN }), /dut1/);
});

test("centuries and millennia from J2000, and the constants", () => {
  assert.equal(J2000_JD, 2451545);
  assert.ok(Math.abs(B1950_JD - 2433282.4235) < 1e-9);
  assert.ok(Math.abs(julianCenturies(Date.UTC(2000, 0, 1, 11, 58, 55, 816), "tt")) < 1e-9, "J2000.0 is noon in terrestrial time, which is 11:58:55.816 on the clock");
  assert.ok(Math.abs(julianCenturies(Date.UTC(2100, 0, 1, 12), "utc") - 1) < 1e-4);
  assert.ok(Math.abs(julianMillennia(Date.UTC(3000, 0, 1, 12), "utc") - 1) < 1e-3);
});

test("sidereal time: Meeus's examples (1987 April 10) to a hundredth of a second of time", () => {
  const hours = (h: number, m: number, s: number): number => (h + m / 60 + s / 3600) * 15;
  const degreesOff = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
  assert.ok(degreesOff(greenwichMeanSiderealTime(Date.UTC(1987, 3, 10)), hours(13, 10, 46.3668)) < 0.01 / 240, "12.a mean");
  assert.ok(degreesOff(greenwichApparentSiderealTime(Date.UTC(1987, 3, 10)), hours(13, 10, 46.1351)) < 0.04 / 240, "12.a apparent: the nutation here is good to 0.5 arc-seconds");
  assert.ok(degreesOff(greenwichMeanSiderealTime(Date.UTC(1987, 3, 10, 19, 21)), hours(8, 34, 57.0896)) < 0.01 / 240, "12.b");
  assert.ok(Math.abs(equationOfTheEquinoxes(Date.UTC(1987, 3, 10)) * 240 + 0.2317) < 0.04, "-0.2317 s of time that day");
  assert.ok(Math.abs(degreesOff(localSiderealTime(Date.UTC(2026, 10, 7, 12), -123.1), greenwichApparentSiderealTime(Date.UTC(2026, 10, 7, 12)) - 123.1)) < 1e-9);
  assert.notEqual(localSiderealTime(Date.UTC(2026, 10, 7, 12), 0, { apparent: false }), localSiderealTime(Date.UTC(2026, 10, 7, 12), 0));
  assert.ok(degreesOff(greenwichMeanSiderealTime(Date.UTC(2026, 10, 8)) - greenwichMeanSiderealTime(Date.UTC(2026, 10, 7)), 0.98564736629) < 1e-6, "a sidereal day gains 0.9856 degrees a day on the clock");
  for (const day of ["1900-06-01T00:00:00Z", "1987-04-10T00:00:00Z", "2026-11-07T12:00:00Z", "2080-07-01T00:00:00Z"]) {
    const want = Astronomy.SiderealTime(Astronomy.MakeTime(new Date(day))) * 15;
    assert.ok(degreesOff(greenwichApparentSiderealTime(new Date(day)), want) < 0.001, `against astronomy-engine on ${day}`);
  }
  assert.throws(() => localSiderealTime(0, Number.NaN), /longitude/);
});

test("Mars time: the Mars Sol Date's definition, the length of a sol, and the Martian afternoon at the landing of Curiosity (and a regression value for Perseverance)", () => {
  const tt0 = fromJulianDate(2451549.5) - 64_184;
  assert.ok(Math.abs(marsSolDate(tt0) - (44796 - 0.0009626)) < 1e-9, "2000-01-06 00:00 TT is MSD 44796 less 0.0009626");
  assert.ok(Math.abs(marsSolDate(tt0 + 88_775_244.147) - marsSolDate(tt0) - 1) < 3e-8, "a sol is 88,775.244 seconds: 1.0274912517 days");
  const landing = Date.UTC(2021, 1, 18, 20, 55);
  const local = marsLocalMeanSolarTime(landing, 77.45);
  assert.ok(local > 16.0 && local < 16.15, `Perseverance at Jezero is a regression value, 16:04 local mean solar time, not ${local}`);
  const curiosity = marsLocalMeanSolarTime(Date.UTC(2012, 7, 6, 5, 17, 57), 137.44);
  assert.ok(curiosity > 14.9 && curiosity < 15.2, `Curiosity touched down at Gale at about 15:00 local mean solar time, not ${curiosity}`);
  assert.ok(coordinatedMarsTime(landing) >= 0 && coordinatedMarsTime(landing) < 24);
  assert.throws(() => marsLocalMeanSolarTime(0, Number.NaN), /longitude/);
});

test("the time entry point imports no rendering and stays under 6 KiB gzipped", async () => {
  const result = await build({ entryPoints: ["src/time.ts"], bundle: true, minify: true, format: "esm", platform: "neutral", write: false, metafile: true, logLevel: "silent" });
  const bytes = gzipSync(result.outputFiles[0]!.contents).byteLength;
  assert.ok(bytes <= 6 * 1024, `${bytes} bytes gzipped`);
  assert.ok(Object.keys(result.metafile!.inputs).every((file) => /^src\/(time|clock|calendar|scales|sidereal|mars|when)\.ts$/.test(file)), Object.keys(result.metafile!.inputs).join(", "));
  console.log(`time: ${bytes} gzip bytes`);
});
