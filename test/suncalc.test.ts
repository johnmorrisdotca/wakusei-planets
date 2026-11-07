// The sun and moon from a place (`/suncalc` and `/suncalc/legacy`). Three oracles, all dev-only and none shipped: astronomy-engine (the independent one: rise and set to seconds), suncalc 2.1.2 (the interface we
// are a superset of, BSD-2-Clause) and suncalc 1.9.0 (the old interface, which is cruder: it has no delta T and a mean-element Moon). Plus the facts a table can check: the solstice noon altitude, polar day and
// night, the day lengths at the equator. Every limit is what the code measured, a little looser.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import * as Astronomy from "astronomy-engine";
import * as SunCalc from "suncalc";
import * as legacy from "../src/suncalc-legacy.ts";
import * as ours from "../src/suncalc.ts";

const require = createRequire(import.meta.url);
const SunCalc1 = require("suncalc1") as {
  getPosition(d: Date, lat: number, lng: number): { altitude: number; azimuth: number };
  getMoonIllumination(d: Date): { fraction: number; phase: number; angle: number };
};

const PLACES: ReadonlyArray<readonly [string, number, number]> = [
  ["London", 51.5, -0.1], ["Quito", -0.2, -78.5], ["Sydney", -33.9, 151.2], ["Tokyo", 35.7, 139.7], ["Vancouver", 49.3, -123.1], ["Reykjavik", 64.1, -21.9],
];
const DAYS = ["2000-03-01", "2013-06-21", "2026-11-07", "2026-12-21", "2045-09-23"];
const seconds = (a: Date, b: Date): number => Math.abs(a.getTime() - b.getTime()) / 1000;
const offsetOf = (lng: number): number => Math.round(lng / 15) * 60;

test("the Sun's rise and set agree with astronomy-engine to 12 seconds, and the Moon's to 8, on places in both hemispheres from 2000 to 2045", () => {
  let compared = 0;
  for (const [name, lat, lng] of PLACES) {
    for (const day of DAYS) {
      const offset = offsetOf(lng);
      const start = Date.parse(`${day}T00:00:00Z`) - offset * 60_000;
      const observer = new Astronomy.Observer(lat, lng, 0);
      const mine = ours.getTimes(new Date(`${day}T12:00:00Z`), lat, lng, 0, offset);
      for (const [direction, key] of [[1, "sunrise"], [-1, "sunset"]] as const) {
        const reference = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date(start), 1);
        const found = mine[key];
        if (reference === null || reference.date.getTime() >= start + 86_400_000) continue;
        assert.ok(found instanceof Date, `${name} ${day} ${key}`);
        compared += 1;
        assert.ok(seconds(found, reference.date) <= 12, `${name} ${day} ${key} is ${seconds(found, reference.date).toFixed(1)} s from astronomy-engine`);
      }
      const moonReference = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, 1, new Date(start), 1);
      const moon = ours.getMoonTimes(new Date(`${day}T12:00:00Z`), lat, lng, offset);
      if (moonReference !== null && moonReference.date.getTime() < start + 86_400_000) {
        assert.ok(moon.rise !== undefined, `${name} ${day} moonrise`);
        compared += 1;
        assert.ok(seconds(moon.rise, moonReference.date) <= 8, `${name} ${day} moonrise is ${seconds(moon.rise, moonReference.date).toFixed(1)} s from astronomy-engine`);
      }
    }
  }
  assert.ok(compared > 50, `only ${compared} rise or set times were compared`);
});

test("every function of suncalc 2 gives what suncalc 2 gives, within its own precision, on one grid of places and dates", () => {
  for (const [name, lat, lng] of PLACES) {
    for (const day of DAYS) {
      const date = new Date(`${day}T12:00:00Z`);
      const offset = offsetOf(lng);
      const a = SunCalc.getPosition(date, lat, lng);
      const b = ours.getPosition(date, lat, lng);
      if (a.altitude > 0) {
        assert.ok(Math.abs(a.altitude - b.altitude) < 0.02, `${name} ${day} sun altitude ${a.altitude} against ${b.altitude}`);
        assert.ok(Math.abs(((a.azimuth - b.azimuth + 540) % 360) - 180) < 0.05, `${name} ${day} sun azimuth`);
      }
      const am = SunCalc.getMoonPosition(date, lat, lng);
      const bm = ours.getMoonPosition(date, lat, lng);
      assert.ok(Math.abs(am.distance - bm.distance) / bm.distance < 0.002, `${name} ${day} moon distance`);
      const ai = SunCalc.getMoonIllumination(date);
      const bi = ours.getMoonIllumination(date);
      assert.ok(Math.abs(ai.fraction - bi.fraction) < 0.002 && Math.abs(ai.phase - bi.phase) < 0.003 && ai.waxing === bi.waxing, `${name} ${day} illumination`);
      assert.ok(Math.abs(((ai.angle - bi.angle + 540) % 360) - 180) < 0.5, `${name} ${day} bright limb`);
      for (const utcOffset of [undefined, offset]) {
        const ta = SunCalc.getTimes(date, lat, lng, 0, utcOffset);
        const tb = ours.getTimes(date, lat, lng, 0, utcOffset);
        for (const key of Object.keys(ta)) {
          if (key === "alwaysUp" || key === "alwaysDown") {
            assert.equal(Boolean(tb[key]), Boolean(ta[key]), `${name} ${day} ${key}`);
            continue;
          }
          const x = ta[key];
          const y = tb[key];
          assert.equal(y === null || y === undefined, x === null || x === undefined, `${name} ${day} ${String(utcOffset)} ${key} present in one`);
          if (x instanceof Date && y instanceof Date) assert.ok(seconds(x, y) <= 60, `${name} ${day} ${key} is ${seconds(x, y).toFixed(0)} s from suncalc`);
        }
        const ma = SunCalc.getMoonTimes(date, lat, lng, utcOffset);
        const mb = ours.getMoonTimes(date, lat, lng, utcOffset);
        for (const key of ["rise", "set", "transit", "lowerTransit"] as const) {
          assert.equal(mb[key] === undefined, ma[key] === undefined, `${name} ${day} moon ${key} present in one`);
          const x = ma[key];
          const y = mb[key];
          if (x !== undefined && y !== undefined) assert.ok(seconds(x, y) <= 90, `${name} ${day} moon ${key} is ${seconds(x, y).toFixed(0)} s from suncalc`);
        }
      }
    }
  }
});

test("facts a table can check: the solstice noon altitude, polar day and night, the day at the equator", () => {
  const noon = ours.getTimes(new Date("2026-06-21T12:00:00Z"), 51.5, -0.1, 0, 60).solarNoon;
  assert.ok(Math.abs(ours.getPosition(noon, 51.5, -0.1).altitude - (90 - 51.5 + 23.4366)) < 0.2, "London's solstice noon is 90 - latitude + the tilt (refraction adds a hair)");
  assert.equal(ours.getTimes(new Date("2026-06-21T12:00:00Z"), 69.65, 18.96, 0, 120).alwaysUp, true, "Tromso has the midnight Sun in June");
  assert.equal(ours.getTimes(new Date("2026-12-21T12:00:00Z"), 69.65, 18.96, 0, 60).alwaysDown, true, "and no sunrise in December");
  const equator = ours.getTimes(new Date("2026-03-20T12:00:00Z"), 0, 0, 0, 0);
  const hours = (equator.sunset!.getTime() - equator.sunrise!.getTime()) / 3_600_000;
  assert.ok(hours > 12.05 && hours < 12.2, `a day at the equator at the equinox is a little over 12 hours, not ${hours}`);
});

test("a height lowers the horizon, a custom time is found, and the day rules are the ones suncalc documents", () => {
  const date = new Date("2026-11-07T12:00:00Z");
  const sea = ours.getTimes(date, 49.3, -123.1, 0, -480);
  const hill = ours.getTimes(date, 49.3, -123.1, 1000, -480);
  assert.ok(hill.sunrise!.getTime() < sea.sunrise!.getTime() && hill.sunset!.getTime() > sea.sunset!.getTime(), "from 1,000 m the Sun is up longer");
  ours.addTime(-4, "morningBlueHourEnd", "blueHour");
  const blue = ours.getTimes(date, 49.3, -123.1, 0, -480);
  assert.ok(blue.blueHour instanceof Date && blue.morningBlueHourEnd instanceof Date);
  assert.ok(blue.blueHour!.getTime() > blue.sunset!.getTime() && blue.blueHour!.getTime() < blue.dusk!.getTime(), "the Sun passes -4 degrees between sunset and dusk");
  const day = Date.parse("2026-11-07T08:00:00Z");
  assert.ok(sea.sunrise!.getTime() >= day && sea.sunset!.getTime() < day + 86_400_000, "with a UTC offset the day is the local calendar day");
});

test("a Date and the same milliseconds give the same answer, and bad input throws with the value in the message", () => {
  const date = new Date("2026-11-07T12:00:00Z");
  assert.deepEqual(ours.getPosition(date, 35.7, 139.7), ours.getPosition(date.getTime(), 35.7, 139.7));
  assert.deepEqual(ours.getMoonTimes(date, 35.7, 139.7, 540), ours.getMoonTimes(date.getTime(), 35.7, 139.7, 540));
  assert.throws(() => ours.getPosition(date, 91, 0), /lat must be between -90 and 90 degrees, got 91/);
  assert.throws(() => ours.getPosition(new Date("nope"), 0, 0), RangeError);
  assert.throws(() => ours.getTimes(date, 0, Number.NaN), /lng/);
  assert.throws(() => ours.getTimes(date, 0, 0, 0, Number.POSITIVE_INFINITY), /utcOffset/);
});

test("no NaN anywhere from the poles to the date line, and an event that does not happen is null or absent, never an invalid date", () => {
  for (const lat of [-90, -89.9, -66.5, 0, 66.5, 89.9, 90]) {
    for (const lng of [-180, -90, 0, 90, 180]) {
      const date = new Date("2026-06-21T12:00:00Z");
      const p = ours.getPosition(date, lat, lng);
      assert.ok(Number.isFinite(p.altitude) && Number.isFinite(p.azimuth), `position at ${lat}, ${lng}`);
      const t = ours.getTimes(date, lat, lng);
      for (const [key, value] of Object.entries(t)) if (value instanceof Date) assert.ok(Number.isFinite(value.getTime()), `${key} at ${lat}, ${lng}`);
      const m = ours.getMoonTimes(date, lat, lng);
      for (const [key, value] of Object.entries(m)) if (value instanceof Date) assert.ok(Number.isFinite(value.getTime()), `moon ${key} at ${lat}, ${lng}`);
    }
  }
});

test("suncalc 1's conventions: radians, azimuth from south, the Sun without refraction, an invalid date for no event, a negative bright-limb angle while waxing", () => {
  const date = new Date("2026-11-07T12:00:00Z");
  const noon = legacy.getTimes(date, 51.5, -0.1).solarNoon;
  const p = legacy.getPosition(noon, 51.5, -0.1);
  assert.ok(Math.abs(p.azimuth) < 0.01, "at solar noon the Sun is due south in the northern hemisphere: azimuth 0");
  assert.ok(p.altitude > 0.3 && p.altitude < 0.5, "radians, not degrees");
  const north = legacy.getPosition(legacy.getTimes(date, -33.9, 151.2).solarNoon, -33.9, 151.2);
  assert.ok(Math.abs(Math.abs(north.azimuth) - Math.PI) < 0.01, "in the southern hemisphere it is due north: azimuth plus or minus pi");
  const polar = legacy.getTimes(new Date("2026-06-21T12:00:00Z"), 69.65, 18.96);
  assert.ok(Number.isNaN(polar.sunrise!.getTime()) && Number.isNaN(polar.sunset!.getTime()), "no sunrise in the midnight Sun is an invalid Date");
  const waxing = legacy.getMoonIllumination(new Date("2026-11-17T12:00:00Z"));
  const waning = legacy.getMoonIllumination(new Date("2026-12-05T12:00:00Z"));
  assert.ok(waxing.angle < 0 && waning.angle > 0 && waxing.phase < 0.5 && waning.phase > 0.5, "waxing: negative angle and phase under a half");
  const moon = legacy.getMoonTimes(new Date("2026-11-07T12:00:00Z"), 35.7, 139.7, true);
  assert.ok(moon.rise instanceof Date && moon.set instanceof Date && moon.rise.getUTCDate() === 7, "the Moon's day is the UTC day when inUTC is true");
});

test("suncalc 1's functions are within suncalc 1's own precision of what it gives: it has no delta T and a mean Moon, so the limits are looser than for suncalc 2", () => {
  for (const [name, lat, lng] of PLACES) {
    for (const day of ["2013-06-21", "2026-11-07", "2026-12-21", "2045-09-23"]) {
      const date = new Date(`${day}T12:00:00Z`);
      const a = SunCalc1.getPosition(date, lat, lng);
      const b = legacy.getPosition(date, lat, lng);
      assert.ok(Math.abs(a.altitude - b.altitude) < 0.01, `${name} ${day} altitude ${a.altitude} against ${b.altitude}`);
      const ai = SunCalc1.getMoonIllumination(date);
      const bi = legacy.getMoonIllumination(date);
      assert.ok(Math.abs(ai.fraction - bi.fraction) < 0.02 && Math.sign(ai.angle) === Math.sign(bi.angle), `${name} ${day} illumination`);
    }
  }
});
