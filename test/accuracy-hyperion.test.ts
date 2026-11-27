import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { moonTheoryOf } from "../src/data/theories.ts";
import { moonVector } from "../src/ephemeris.ts";
import { distance } from "../src/nearest.ts";
import { loadMoonTheory } from "../src/tables/lazy.ts";
import { cross, length, RAD, type Vec3 } from "../src/vec.ts";

const { samples } = JSON.parse(readFileSync(new URL("./data/horizons-hyperion.json", import.meta.url), "utf8")) as {
  samples: [utcMs: number, x: number, y: number, z: number][];
};

const directionError = (a: Vec3, b: Vec3): number =>
  Math.atan2(length(cross(a, b)), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / RAD;

test("loading Saturn's moon theory improves Hyperion on independent Horizons dates from 1800 through 2199", async () => {
  assert.equal(samples.length, 192);
  assert.equal(moonTheoryOf("hyperion"), undefined);
  const fittedWorst = Math.max(...samples.map(([ms, x, y, z]) => directionError(moonVector("hyperion", ms), [x, y, z])));
  assert.ok(fittedWorst <= 20, `the fitted orbit's worst error is ${fittedWorst}°`);
  const date = Date.UTC(2026, 10, 27);
  const fittedDistance = distance("saturn", "hyperion", date);
  assert.ok(fittedDistance.uncertaintyKm > 0.3 * fittedDistance.distanceKm);

  assert.equal(await loadMoonTheory("saturn"), true);
  assert.equal(await loadMoonTheory("saturn"), false);
  const refinedDistance = distance("saturn", "hyperion", date);
  assert.ok(refinedDistance.uncertaintyKm < 0.02 * refinedDistance.distanceKm);
  for (const [ms, x, y, z] of samples) {
    const error = directionError(moonVector("hyperion", ms), [x, y, z]);
    assert.ok(error <= 1, `${new Date(ms).toISOString()}: Hyperion is ${error}° from Horizons`);
  }
});
