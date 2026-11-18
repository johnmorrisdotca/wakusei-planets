// /sky riseSetTimes(): rise, transit and set of the Sun and the Moon over a calendar day of a time zone, against the US Naval Observatory's one-day rise/set/transit service (https://aa.usno.navy.mil/api/rstt/oneday), read on 2026-11-17 one page at a time
// and typed in by hand below; nothing was saved or downloaded. The service gives local clock times to the minute (rounded to the nearest) at a fixed offset from UTC that the request names (tz), with no daylight saving: so each row is converted to UT by its own tz
// and the day each package takes (the zone's calendar day, with its clock change) is worked out here from the zone's rules, not by the code under test.
//   New York (40.7128 N, 74.006 W), 2026-11-01, tz -5 (the day the clocks go back at 02:00: 25 hours, 04:00 UT to 05:00 UT next day)
//   New York, 2026-03-08, tz -5 (the day they go forward: 23 hours, 05:00 UT to 04:00 UT next day)
//   Sydney (33.8688 S, 151.2093 E), 2026-10-04, tz 10 (the day they go forward there: 23 hours, 14:00 UT the day before to 13:00 UT)
//   Tromso (69.6492 N, 18.9553 E), 2026-06-21, tz 2 and 2026-12-21, tz 1 (the Sun continuously above the horizon, continuously below it; and the Moon continuously above it on the second)
import assert from "node:assert/strict";
import { test } from "node:test";
import { riseSetTimes } from "../src/sky.ts";

type Row = { rise?: string; transit?: string; set?: string };
interface Case { name: string; latitude: number; longitude: number; zone: string; year: number; month: number; day: number; tz: number; start: number; end: number; sun: Row; moon: Row; horizon: { sun: string; moon: string } }
const CASES: Case[] = [
  { name: "New York, 1 November 2026 (25 hours)", latitude: 40.7128, longitude: -74.006, zone: "America/New_York", year: 2026, month: 11, day: 1, tz: -5, start: Date.UTC(2026, 10, 1, 4), end: Date.UTC(2026, 10, 2, 5),
    sun: { rise: "06:26", transit: "11:40", set: "16:52" }, moon: { transit: "05:39", set: "13:07", rise: "23:14" }, horizon: { sun: "crosses", moon: "crosses" } },
  { name: "New York, 8 March 2026 (23 hours)", latitude: 40.7128, longitude: -74.006, zone: "America/New_York", year: 2026, month: 3, day: 8, tz: -5, start: Date.UTC(2026, 2, 8, 5), end: Date.UTC(2026, 2, 9, 4),
    sun: { rise: "06:19", transit: "12:07", set: "17:55" }, moon: { transit: "03:34", set: "08:23", rise: "23:42" }, horizon: { sun: "crosses", moon: "crosses" } },
  { name: "Sydney, 4 October 2026 (23 hours)", latitude: -33.8688, longitude: 151.2093, zone: "Australia/Sydney", year: 2026, month: 10, day: 4, tz: 10, start: Date.UTC(2026, 9, 3, 14), end: Date.UTC(2026, 9, 4, 13),
    sun: { rise: "05:29", transit: "11:44", set: "18:00" }, moon: { rise: "01:17", transit: "06:09", set: "11:04" }, horizon: { sun: "crosses", moon: "crosses" } },
  { name: "Tromso, 21 June 2026 (midnight sun)", latitude: 69.6492, longitude: 18.9553, zone: "Europe/Oslo", year: 2026, month: 6, day: 21, tz: 2, start: Date.UTC(2026, 5, 20, 22), end: Date.UTC(2026, 5, 21, 22),
    sun: { transit: "12:46" }, moon: { set: "00:37", rise: "12:18", transit: "18:33" }, horizon: { sun: "above", moon: "crosses" } },
  { name: "Tromso, 21 December 2026 (polar night)", latitude: 69.6492, longitude: 18.9553, zone: "Europe/Oslo", year: 2026, month: 12, day: 21, tz: 1, start: Date.UTC(2026, 11, 20, 23), end: Date.UTC(2026, 11, 21, 23),
    sun: {}, moon: { transit: "21:24" }, horizon: { sun: "below", moon: "above" } },
];

const utOf = (c: Case, hhmm: string): number => Date.UTC(c.year, c.month - 1, c.day, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3))) - c.tz * 3_600_000;

test("the Sun's and the Moon's rise, transit and set over a calendar day agree with the USNO to the minute, on three clock-change days and two polar days, and a USNO event outside the zone's day is null here", () => {
  let worst = 0, count = 0;
  for (const c of CASES) {
    for (const body of ["sun", "moon"] as const) {
      const want = c[body];
      const got = riseSetTimes(body, c.start + 12 * 3_600_000, { observer: { latitude: c.latitude, longitude: c.longitude }, timeZone: c.zone });
      assert.equal(got.horizon, c.horizon[body], `${c.name} ${body}: horizon`);
      for (const event of ["rise", "transit", "set"] as const) {
        const stamp = want[event];
        const expected = stamp === undefined ? null : utOf(c, stamp);
        const inside = expected !== null && expected >= c.start && expected < c.end;
        const found = got[event];
        if (expected === null) {
          // the USNO lists no transit for a Sun below the horizon (and none for a day with no rise or set); this package gives the upper transit of a body whatever its height, so it is only held against the USNO where the USNO has one
          assert.ok(event === "transit" || found === null, `${c.name} ${body} ${event}: the USNO has none but ${String(found?.toISOString())} was found`);
        } else if (!inside) {
          assert.equal(found, null, `${c.name} ${body} ${event}: the USNO's ${new Date(expected).toISOString()} is outside the zone's day (${new Date(c.start).toISOString()} to ${new Date(c.end).toISOString()}), so none should be found`);
        } else {
          assert.ok(found instanceof Date, `${c.name} ${body} ${event} was not found`);
          const seconds = (found.getTime() - expected) / 1000;
          worst = Math.max(worst, Math.abs(seconds));
          count += 1;
          assert.ok(Math.abs(seconds) <= 40, `${c.name} ${body} ${event}: ${found.toISOString()} is ${seconds.toFixed(1)} s from the USNO's ${stamp}`);
          assert.ok(found.getTime() >= c.start && found.getTime() < c.end);
        }
      }
    }
  }
  console.log(`calendar-day rise, transit and set: worst ${worst.toFixed(1)} s from the USNO's rounded minute over ${count} events`);
});

test("any moment of the day gives the day, a Date and its milliseconds agree, the same instant is a different day in another zone, and the day length follows the clock change", () => {
  const observer = { latitude: 40.7128, longitude: -74.006 };
  const noon = Date.UTC(2026, 10, 1, 17);
  const day = riseSetTimes("sun", noon, { observer, timeZone: "America/New_York" });
  assert.deepEqual(riseSetTimes("sun", new Date(noon), { observer, timeZone: "America/New_York" }), day);
  assert.deepEqual(riseSetTimes("sun", Date.UTC(2026, 10, 1, 4), { observer, timeZone: "America/New_York" }), day, "the first moment of the day (midnight EDT)");
  assert.deepEqual(riseSetTimes("sun", Date.UTC(2026, 10, 2, 4, 59), { observer, timeZone: "America/New_York" }), day, "the last minute of the 25-hour day");
  assert.notDeepEqual(riseSetTimes("sun", Date.UTC(2026, 10, 2, 5), { observer, timeZone: "America/New_York" }), day, "the next day starts at 05:00 UT");
  assert.notDeepEqual(riseSetTimes("sun", Date.UTC(2026, 10, 1, 3, 59), { observer, timeZone: "America/New_York" }), day, "03:59 UT is still 31 October in New York");
  const utc = riseSetTimes("sun", Date.UTC(2026, 10, 1, 17), { observer: { latitude: 51.4779, longitude: -0.0015 }, timeZone: "UTC" });
  const tokyo = riseSetTimes("sun", Date.UTC(2026, 10, 1, 17), { observer: { latitude: 51.4779, longitude: -0.0015 }, timeZone: "Asia/Tokyo" });
  assert.ok(tokyo.rise!.getTime() - utc.rise!.getTime() > 12 * 3_600_000, "17:00 UT on 1 November is already 2 November in Tokyo");
  assert.ok(riseSetTimes("sun", noon, { observer: { latitude: 40.7128, longitude: -74.006, heightM: 0 }, timeZone: "America/New_York" }).rise instanceof Date, "the height is optional");
});

test("timeZone is required and checked: a missing, empty or unknown one throws a RangeError that names it; a bad body, observer or moment throws", () => {
  const observer = { latitude: 40.7128, longitude: -74.006 };
  const date = Date.UTC(2026, 10, 1);
  assert.throws(() => riseSetTimes("sun", date, { observer } as never), (e: Error) => e instanceof RangeError && /timeZone is required/.test(e.message));
  assert.throws(() => riseSetTimes("sun", date, { observer, timeZone: "" }), (e: Error) => e instanceof RangeError && /timeZone/.test(e.message));
  assert.throws(() => riseSetTimes("sun", date, { observer, timeZone: "Mars/Olympus" }), (e: Error) => e instanceof RangeError && /Mars\/Olympus/.test(e.message));
  assert.throws(() => riseSetTimes("earth" as "sun", date, { observer, timeZone: "UTC" }), RangeError);
  assert.throws(() => riseSetTimes("sun", date, { observer: { latitude: 99, longitude: 0 }, timeZone: "UTC" }), RangeError);
  assert.throws(() => riseSetTimes("sun", Number.NaN, { observer, timeZone: "UTC" }), (e: Error) => e instanceof RangeError && /date/.test(e.message));
});
