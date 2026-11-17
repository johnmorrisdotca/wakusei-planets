// The drop-in check for `/suncalc` and `/suncalc/legacy`: every function and option of suncalc 2.1.2 and of suncalc 1.9.0 (both dev-only oracles, BSD-2-Clause, nothing of theirs shipped) on ONE grid: fourteen
// places (the equator, both hemispheres, both polar circles, 78 degrees north, 78 degrees south) by eleven days from 1900 to 2100 by three hours. Names and shapes must be identical; numbers within a limit
// measured on this grid and set a little above what it found. The two documented differences are asserted too, not skipped: below the horizon suncalc 2 keeps adding the horizon's 0.49 degrees of refraction
// at any depth and we fade it out; and suncalc 1 has no delta T and a mean-element Moon, so the legacy limits are loose where its own error is large (its times drift by minutes, near the poles by half an hour).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import * as SunCalc from "suncalc";
import legacyDefault, * as legacy from "../src/suncalc-legacy.ts";
import oursDefault, * as ours from "../src/suncalc.ts";

const require = createRequire(import.meta.url);
type Pos = { altitude: number; azimuth: number };
const SunCalc1 = require("suncalc1") as Record<string, unknown> & {
  getPosition(d: Date, lat: number, lng: number): Pos;
  getMoonPosition(d: Date, lat: number, lng: number): Pos & { distance: number; parallacticAngle: number };
  getMoonIllumination(d: Date): { fraction: number; phase: number; angle: number };
  getTimes(d: Date, lat: number, lng: number): Record<string, Date>;
  getMoonTimes(d: Date, lat: number, lng: number, inUTC: boolean): Record<string, Date | boolean | undefined>;
};

const PLACES: ReadonlyArray<readonly [string, number, number]> = [
  ["Quito", -0.2, -78.5], ["Nairobi", -1.3, 36.8], ["London", 51.5, -0.1], ["Sydney", -33.9, 151.2], ["Tokyo", 35.7, 139.7], ["Vancouver", 49.3, -123.1], ["Honolulu", 21.3, -157.9],
  ["Ushuaia", -54.8, -68.3], ["Reykjavik", 64.1, -21.9], ["Tromso", 69.65, 18.96], ["Arctic Circle", 66.56, 25], ["Antarctic Circle", -66.56, -60], ["Svalbard", 78.2, 15.6], ["McMurdo", -77.85, 166.7],
];
const DAYS = ["1900-01-15", "1925-06-21", "1950-12-21", "1975-03-20", "2000-09-23", "2026-02-14", "2026-06-21", "2026-12-21", "2050-07-04", "2075-11-30", "2100-06-21"];
const HOURS = [3, 12, 20];
const offsetOf = (lng: number): number => Math.round(lng / 15) * 60;
const degrees = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
const radians = (a: number, b: number): number => Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
const phaseGap = (a: number, b: number): number => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
const secs = (a: Date, b: Date): number => Math.abs(a.getTime() - b.getTime()) / 1000;
const worst: Record<string, number> = {};
const within = (what: string, value: number, limit: number, where: string): void => {
  worst[what] = Math.max(worst[what] ?? 0, value);
  assert.ok(value <= limit, `${what} ${value} is over ${limit} at ${where}`);
};

test("the names and shapes are suncalc's: every export of suncalc 2.1.2 and of suncalc 1.9.0 is here with the same type, and the default object holds them", () => {
  for (const key of Object.keys(SunCalc).filter((k) => k !== "default")) {
    assert.ok(key in ours, `suncalc 2 exports ${key}`);
    assert.equal(typeof (ours as Record<string, unknown>)[key], typeof (SunCalc as Record<string, unknown>)[key], key);
    assert.equal((oursDefault as Record<string, unknown>)[key], (ours as Record<string, unknown>)[key], `the default object's ${key} is the named one`);
  }
  for (const key of Object.keys(SunCalc1)) {
    assert.ok(key in legacy, `suncalc 1 exports ${key}`);
    assert.equal(typeof (legacy as Record<string, unknown>)[key], typeof SunCalc1[key], key);
    assert.equal((legacyDefault as Record<string, unknown>)[key], (legacy as Record<string, unknown>)[key], `the legacy default object's ${key} is the named one`);
  }
  assert.deepEqual(ours.times, SunCalc.times, "the table of times is the same rows in the same order");
  assert.deepEqual(legacy.times, SunCalc1.times, "the legacy table of times is the same rows in the same order");
});

test("require() of the entries works, as the guide says: the same functions as import gives", () => {
  const required = require("../src/suncalc.ts") as typeof ours;
  assert.equal(typeof required.getTimes, "function");
  assert.equal(required.getTimes(new Date("2026-06-21T12:00:00Z"), 51.5, -0.1, 0, 60).sunrise?.toISOString(), ours.getTimes(new Date("2026-06-21T12:00:00Z"), 51.5, -0.1, 0, 60).sunrise?.toISOString());
  assert.equal(typeof (require("../src/suncalc-legacy.ts") as typeof legacy).getMoonTimes, "function");
});

test("addTime adds a time to the table both ways, the default object shares the table, and getTimes then gives it", () => {
  const date = new Date("2026-06-21T12:00:00Z");
  for (const [mod, table] of [[ours, ours.times], [legacy, legacy.times]] as const) {
    const before = table.length;
    mod.addTime(-4, "morningBlue", "eveningBlue");
    try {
      assert.equal(table.length, before + 1);
      assert.equal((mod === ours ? oursDefault : legacyDefault).times, table, "one table");
      const t = mod.getTimes(date, 51.5, -0.1) as Record<string, Date | null>;
      assert.ok(t.morningBlue && t.eveningBlue && !Number.isNaN(t.morningBlue.getTime()), "both new names are in the result");
    } finally {
      table.length = before;
    }
  }
});

test("suncalc 2.1.2 on the grid: every function, same keys, same flags, numbers within the limits measured", () => {
  for (const [name, lat, lng] of PLACES) {
    for (const day of DAYS) {
      for (const hour of HOURS) {
        const date = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
        const where = `${name} ${date.toISOString()}`;
        const sun = SunCalc.getPosition(date, lat, lng);
        const mine = ours.getPosition(date, lat, lng);
        within("sun azimuth degrees", degrees(sun.azimuth, mine.azimuth), 0.06, where);
        if (sun.altitude > 0) within("sun altitude degrees above the horizon", Math.abs(sun.altitude - mine.altitude), 0.08, where);
        else assert.ok(Math.abs(sun.altitude - mine.altitude) < 0.52 && (sun.altitude > -3 || mine.altitude < sun.altitude - 0.4), `below the horizon we do not add the horizon's refraction: ${where}`);
        const moon = SunCalc.getMoonPosition(date, lat, lng);
        const mineMoon = ours.getMoonPosition(date, lat, lng);
        if (moon.altitude > 0) within("moon altitude degrees above the horizon", Math.abs(moon.altitude - mineMoon.altitude), 0.1, where);
        within("moon azimuth degrees", degrees(moon.azimuth, mineMoon.azimuth), 0.15, where);
        within("moon distance fraction", Math.abs(moon.distance - mineMoon.distance) / mineMoon.distance, 1e-4, where);
        within("moon parallactic angle degrees", degrees(moon.parallacticAngle, mineMoon.parallacticAngle), 1, where);
        const ill = SunCalc.getMoonIllumination(date);
        const mineIll = ours.getMoonIllumination(date);
        within("illumination fraction", Math.abs(ill.fraction - mineIll.fraction), 5e-4, where);
        within("illumination phase", phaseGap(ill.phase, mineIll.phase), 0.02, where);
        within("illumination bright limb degrees", degrees(ill.angle, mineIll.angle), 0.4, where);
        assert.deepEqual(Object.keys(mineIll).sort(), Object.keys(ill).sort(), `illumination keys ${where}`);
        if (Math.abs(ill.phase - 0.5) > 0.01 && ill.phase > 0.01 && ill.phase < 0.99) assert.equal(mineIll.waxing, ill.waxing, `waxing ${where}`);
        if (hour !== 12) continue;
        for (const utcOffset of [undefined, offsetOf(lng)]) {
          const a = SunCalc.getTimes(date, lat, lng, 0, utcOffset);
          const b = ours.getTimes(date, lat, lng, 0, utcOffset);
          assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort(), `getTimes keys ${where} ${String(utcOffset)}`);
          for (const key of Object.keys(a)) {
            const x = a[key];
            const y = b[key];
            if (typeof x === "boolean") assert.equal(y, x, `${key} ${where} ${String(utcOffset)}`);
            else if (x instanceof Date) within("sun time seconds", secs(x, y as Date), 90, `${key} ${where}`);
            else assert.equal(y, x, `${key} is ${String(x)} in suncalc: ${where} ${String(utcOffset)}`);
          }
          const height = SunCalc.getTimes(date, lat, lng, 1500, utcOffset);
          const mineHeight = ours.getTimes(date, lat, lng, 1500, utcOffset);
          assert.deepEqual(Object.keys(mineHeight).sort(), Object.keys(height).sort(), `getTimes keys at 1500 m ${where}`);
          if (height.sunrise instanceof Date && mineHeight.sunrise instanceof Date) within("sun time at 1500 m seconds", secs(height.sunrise, mineHeight.sunrise), 120, where);
          const ma = SunCalc.getMoonTimes(date, lat, lng, utcOffset);
          const mb = ours.getMoonTimes(date, lat, lng, utcOffset);
          for (const key of ["rise", "set", "transit", "lowerTransit", "alwaysUp", "alwaysDown"] as const) {
            const x = ma[key];
            const y = mb[key];
            if (x instanceof Date && y instanceof Date) within("moon time seconds", secs(x, y), 60, `${key} ${where}`);
            else if (typeof x === "boolean") assert.equal(y, x, `moon ${key} ${where} ${String(utcOffset)}`);
            else if ((x === undefined) !== (y === undefined)) {
              // an event in the last minute of the day: one of the two scans keeps it, the other does not
              const edge = Date.parse(`${day}T00:00:00Z`) - (utcOffset ?? 0) * 60_000;
              const at = ((x ?? y) as Date).getTime();
              assert.ok(utcOffset !== undefined && [edge, edge + 86_400_000].some((e) => Math.abs(at - e) < 60_000), `moon ${key} is in one and not the other: ${where} ${String(utcOffset)}`);
            }
          }
        }
      }
    }
  }
  console.log("suncalc 2.1.2 grid, worst difference found:", JSON.stringify(worst));
});

test("suncalc 1.9.0 on the grid: every function, same keys, an invalid Date for no event, numbers within suncalc 1's own error", () => {
  const worst1: Record<string, number> = {};
  const near = (what: string, value: number, limit: number, where: string): void => {
    worst1[what] = Math.max(worst1[what] ?? 0, value);
    assert.ok(value <= limit, `${what} ${value} is over ${limit} at ${where}`);
  };
  for (const [name, lat, lng] of PLACES) {
    for (const day of DAYS) {
      for (const hour of HOURS) {
        const date = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
        const where = `${name} ${date.toISOString()}`;
        const a = SunCalc1.getPosition(date, lat, lng);
        const b = legacy.getPosition(date, lat, lng);
        near("sun altitude radians", Math.abs(a.altitude - b.altitude), 0.04, where);
        near("sun azimuth radians", radians(a.azimuth, b.azimuth), 0.15, where);
        const m = SunCalc1.getMoonPosition(date, lat, lng);
        const mm = legacy.getMoonPosition(date, lat, lng);
        near("moon altitude radians", Math.abs(m.altitude - mm.altitude), 0.12, where);
        near("moon azimuth radians", radians(m.azimuth, mm.azimuth), 0.3, where);
        near("moon distance fraction", Math.abs(m.distance - mm.distance) / mm.distance, 0.03, where);
        near("moon parallactic angle radians", radians(m.parallacticAngle, mm.parallacticAngle), 0.3, where);
        const i = SunCalc1.getMoonIllumination(date);
        const mi = legacy.getMoonIllumination(date);
        assert.deepEqual(Object.keys(mi).sort(), Object.keys(i).sort(), `illumination keys ${where}`);
        near("illumination fraction", Math.abs(i.fraction - mi.fraction), 0.03, where);
        near("illumination phase", phaseGap(i.phase, mi.phase), 0.03, where);
        near("illumination bright limb radians", radians(i.angle, mi.angle), 1, where);
        if (hour !== 12) continue;
        const ta = SunCalc1.getTimes(date, lat, lng);
        const tb = legacy.getTimes(date, lat, lng);
        assert.deepEqual(Object.keys(tb).sort(), Object.keys(ta).sort(), `getTimes keys ${where}`);
        const limit = Math.abs(lat) <= 45 ? 400 : Math.abs(lat) <= 60 ? 900 : 2700;
        for (const key of Object.keys(ta)) {
          const x: Date = ta[key];
          const y: Date = tb[key];
          assert.ok(y instanceof Date, `${key} is a Date ${where}`);
          if (Number.isNaN(x.getTime()) !== Number.isNaN(y.getTime())) assert.ok(Math.abs(lat) >= 66, `${key} is invalid in one and not the other at a latitude under 66: ${where}`);
          else if (!Number.isNaN(x.getTime())) near(`sun time seconds (latitude up to ${limit === 400 ? 45 : limit === 900 ? 60 : 90})`, secs(x, y), limit, `${key} ${where}`);
        }
        for (const inUTC of [false, true]) {
          const ma = SunCalc1.getMoonTimes(date, lat, lng, inUTC);
          const mb = legacy.getMoonTimes(date, lat, lng, inUTC);
          const start = new Date(date);
          if (inUTC) start.setUTCHours(0, 0, 0, 0);
          else start.setHours(0, 0, 0, 0);
          for (const key of ["rise", "set", "alwaysUp", "alwaysDown"] as const) {
            const x = ma[key];
            const y = mb[key];
            if (x instanceof Date && y instanceof Date) near("moon time seconds", secs(x, y), Math.abs(lat) <= 45 ? 1500 : Math.abs(lat) <= 60 ? 2000 : 3600, `${key} ${where}`);
            else if ((x === undefined || x === false) !== (y === undefined || y === false)) {
              const at = x instanceof Date ? x : y instanceof Date ? y : undefined;
              const atEdge = at !== undefined && [start.getTime(), start.getTime() + 86_400_000].some((e) => Math.abs(at.getTime() - e) < 300_000);
              assert.ok(Math.abs(lat) >= 60 || atEdge, `moon ${key} is in one and not the other at a latitude under 60: ${where} inUTC ${String(inUTC)}`);
            }
          }
        }
      }
    }
  }
  console.log("suncalc 1.9.0 grid, worst difference found:", JSON.stringify(worst1));
});
