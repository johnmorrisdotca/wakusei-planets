import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { heliocentric, moonGeocentric } from "../src/ephemeris.ts";
import { cross, dot, length, RAD, scale, type Vec3 } from "../src/vec.ts";

const AU_KM = 149_597_870.7;
const { samples } = JSON.parse(readFileSync(new URL("./data/horizons-moon-uranus.json", import.meta.url), "utf8")) as {
  samples: [utcMs: number, mx: number, my: number, mz: number, ux: number, uy: number, uz: number][];
};

function arcsecondsBetween(a: Vec3, b: Vec3): number {
  return Math.atan2(length(cross(a, b)), dot(a, b)) / RAD * 3600;
}

test("the Moon stays within 1.1 arc-seconds on 192 dates held out of the longitude fit", () => {
  assert.equal(samples.length, 192);
  for (const [ms, x, y, z] of samples) {
    const error = arcsecondsBetween(moonGeocentric(ms), [x, y, z]);
    assert.ok(error <= 1.1, `${new Date(ms).toISOString()}: the Moon is ${error}″ from Horizons`);
  }
});

test("the finer Uranus series stays within 1.6 arc-seconds on the held-out dates", async () => {
  const uncorrected = Math.max(...samples.map(([ms, , , , x, y, z]) => arcsecondsBetween(scale(heliocentric("uranus", ms), AU_KM), [x, y, z])));
  assert.ok(uncorrected <= 5, `the default series is ${uncorrected}″ from Horizons`);
  await import("../src/tables/vsop.ts");
  for (const [ms, , , , x, y, z] of samples) {
    const error = arcsecondsBetween(scale(heliocentric("uranus", ms), AU_KM), [x, y, z]);
    assert.ok(error <= 1.6, `${new Date(ms).toISOString()}: Uranus is ${error}″ from Horizons`);
  }
});
