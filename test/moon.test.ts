// The Moon comes from ELP2000-82B (540 terms): it must stay finite, keep a real Moon's distance and latitude, and move smoothly, from 1800 to 2200 and a long way outside.
import assert from "node:assert/strict";
import { test } from "node:test";
import { moonGeocentric } from "../src/ephemeris.ts";
import { length, sub } from "../src/vec.ts";

test("the Moon stays between 350,000 and 410,000 km and within 5.4 degrees of the ecliptic, every few hours from 1800 to 2200 and beyond", () => {
  for (let ms = Date.UTC(1700, 0, 1); ms < Date.UTC(2300, 0, 1); ms += 37 * 3_600_000 * 24 + 13 * 60_000) {
    const p = moonGeocentric(ms);
    const r = length(p);
    assert.ok(Number.isFinite(r) && r > 350_000 && r < 410_000, `distance ${r} on ${new Date(ms).toISOString()}`);
    assert.ok(Math.abs(Math.asin(p[2] / r)) < (5.4 * Math.PI) / 180, `latitude on ${new Date(ms).toISOString()}`);
  }
});

test("the Moon moves smoothly: an hour apart it is 3,100 to 4,100 km further on, and a second apart about a kilometre", () => {
  for (let ms = Date.UTC(2000, 0, 1); ms < Date.UTC(2001, 0, 1); ms += 5 * 86_400_000) {
    const hour = length(sub(moonGeocentric(ms + 3_600_000), moonGeocentric(ms)));
    assert.ok(hour > 3_100 && hour < 4_100, `an hour on ${new Date(ms).toISOString()} moves ${hour} km`);
    const second = length(sub(moonGeocentric(ms + 1000), moonGeocentric(ms)));
    assert.ok(second > 0.85 && second < 1.2, `a second on ${new Date(ms).toISOString()} moves ${second} km`);
  }
});
