import assert from "node:assert/strict";
import { test } from "node:test";
import { equationOfTime, getTimes } from "../src/suncalc.ts";

test("equation of time agrees with JPL Horizons throughout the year", () => {
  // JPL Horizons Sun (10), geodetic Earth site 0° E, 0° N, 0 km, quantity 34 (L_Ap_SOL_Time).
  // Daily rows at 12:00 UTC in 2026, sampled at the start of each month, near zero,
  // at the annual extrema, and at the date of the largest difference across the full table.
  // horizons-sun-q34-greenwich-2026.txt, SHA-256
  // 86b3dae0f6b64b4646bd8bce13c5c59eb4d30b442d64a86d7644bc3646551d7e
  const rows = [
    ["2026-01-01", 11, 56, 26.1458],
    ["2026-01-05", 11, 54, 36.6391],
    ["2026-02-01", 11, 46, 27.4475],
    ["2026-02-11", 11, 45, 49.5186],
    ["2026-03-01", 11, 47, 42.4938],
    ["2026-04-01", 11, 56, 9.9467],
    ["2026-04-15", 11, 59, 59.6675],
    ["2026-05-01", 12, 2, 55.3806],
    ["2026-06-01", 12, 2, 9.6412],
    ["2026-07-01", 11, 56, 6.3968],
    ["2026-08-01", 11, 53, 38.4898],
    ["2026-09-01", 11, 59, 59.5082],
    ["2026-10-01", 12, 10, 20.6432],
    ["2026-11-01", 12, 16, 25.3962],
    ["2026-11-03", 12, 16, 26.7858],
    ["2026-12-01", 12, 10, 59.4663],
    ["2026-12-25", 11, 59, 57.1514],
  ] as const;
  for (const [day, hours, minutes, seconds] of rows) {
    const expectedSeconds = ((hours - 12) * 60 + minutes) * 60 + seconds;
    const actualSeconds = equationOfTime(new Date(`${day}T12:00:00Z`)) * 60;
    assert.ok(Math.abs(actualSeconds - expectedSeconds) < 2, `${day}: ${actualSeconds} s vs Horizons ${expectedSeconds} s`);
  }
});

test("equation of time resolves the sign and wraps across midnight", () => {
  assert.ok(equationOfTime(Date.UTC(2026, 1, 11, 12)) < -14);
  assert.ok(equationOfTime(Date.UTC(2026, 10, 3, 12)) > 16);
  for (const midnight of [0, Date.UTC(2026, 6, 1)]) {
    const before = equationOfTime(midnight - 1000);
    const after = equationOfTime(midnight + 1000);
    assert.ok(Math.abs(before - after) < 0.001);
    assert.equal(equationOfTime(new Date(midnight)), equationOfTime(midnight));
  }
  assert.throws(() => equationOfTime(new Date(NaN)), /when must be a valid Date/);
});

test("at solar noon the equation of time recovers the local mean solar time", () => {
  const greenwichMeanNoon = Date.UTC(2026, 10, 3, 12);
  for (const [latitude, longitude, utcOffset] of [[51.48, 0, 0], [49.28, -123.12, -480], [35.68, 139.76, 540]] as const) {
    const solarNoon = getTimes(greenwichMeanNoon, latitude, longitude, 0, utcOffset).solarNoon.getTime();
    const meanNoon = greenwichMeanNoon - longitude * 240_000;
    assert.ok(Math.abs(solarNoon + equationOfTime(solarNoon) * 60_000 - meanNoon) < 2);
  }
});
