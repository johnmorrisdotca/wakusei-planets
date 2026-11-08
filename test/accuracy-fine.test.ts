// The finer planets' series, `tables/vsop` (VSOP87B cut at 3e-7 instead of 3e-6): the same 60 dates from 1800 to 2200 as accuracy-dense.test.ts, with tighter limits. Pluto is a fitted table and does not change.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { heliocentric, heliocentricModel } from "../src/ephemeris.ts";
import { planetSeriesOf } from "../src/data/theories.ts";
import { length, RAD, type Vec3 } from "../src/vec.ts";

type Dense = { dates: string[]; planets: Record<string, Vec3[]> };
const reference = JSON.parse(readFileSync(new URL("./data/horizons-dense.json", import.meta.url), "utf8")) as Dense;
const AU_KM = 149597870.7;
const FINE_ARCSEC: Record<string, number> = { mercury: 1.7, venus: 0.6, earth: 0.7, mars: 0.95, jupiter: 0.7, saturn: 1.1, uranus: 2.5, neptune: 0.95 };
const worst = (name: string): number => {
  let most = 0;
  reference.planets[name]!.forEach((horizons, i) => {
    const [x, y, z] = heliocentric(name as Parameters<typeof heliocentric>[0], Date.parse(reference.dates[i]!));
    const mine: Vec3 = [x * AU_KM, y * AU_KM, z * AU_KM];
    most = Math.max(most, (Math.acos(Math.max(-1, Math.min(1, (mine[0] * horizons[0] + mine[1] * horizons[1] + mine[2] * horizons[2]) / (length(mine) * length(horizons))))) / RAD) * 3600);
  });
  return most;
};

test("without tables/vsop the planets use the small series, and importing it teaches heliocentric the finer ones", async () => {
  assert.equal(planetSeriesOf("neptune"), undefined);
  const small = worst("mars");
  assert.ok(small > 1, "the small series leaves more than an arc-second on Mars");
  await import("../src/tables/vsop.ts");
  for (const name of Object.keys(FINE_ARCSEC)) assert.ok(planetSeriesOf(name) !== undefined, name);
  assert.equal(planetSeriesOf("pluto"), undefined);
  assert.deepEqual(heliocentricModel("mars", Date.UTC(2026, 0, 1)), { theory: "vsop87b", worstArcseconds: null });
  assert.ok(worst("mars") < small / 3, "and the finer series is several times closer");
});

test("with tables/vsop every planet from Mercury to Neptune is within its limit on 60 dates from 1800 to 2200", async () => {
  await import("../src/tables/vsop.ts");
  for (const [name, limit] of Object.entries(FINE_ARCSEC)) {
    const arcseconds = worst(name);
    assert.ok(arcseconds <= limit, `${name} is ${arcseconds.toFixed(2)} arc-seconds from Horizons, the limit is ${limit}`);
  }
});
