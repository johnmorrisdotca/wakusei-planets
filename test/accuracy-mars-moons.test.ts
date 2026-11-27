import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DAY_MS, fromJulianDate, toTerrestrialTime } from "../src/clock.ts";
import { moonTheoryOf } from "../src/data/theories.ts";
import { moonVector } from "../src/ephemeris.ts";
import { loadMoonTheory } from "../src/tables/lazy.ts";
import { cross, DEG, dot, length, scale, sub, type Vec3 } from "../src/vec.ts";

const IDS = ["phobos", "deimos"] as const;
const START = Date.UTC(1950, 0, 1);
const END = Date.UTC(2050, 0, 1);
const TRANSITION = 3652.5 * DAY_MS;
const HOUR = 60 * 60 * 1000;

const reference = JSON.parse(readFileSync(new URL("./data/horizons-mars-moons.json", import.meta.url), "utf8")) as {
  datesTdb: number[];
  moons: Record<typeof IDS[number], Vec3[]>;
};
const dense = JSON.parse(readFileSync(new URL("./data/horizons-dense.json", import.meta.url), "utf8")) as { dates: string[] };

/** Convert a TT millisecond on the time scale used by the evaluator back to its UTC input. */
function utcAt(terrestrial: number): number {
  const first = terrestrial - (toTerrestrialTime(terrestrial) - terrestrial);
  return first + (terrestrial - toTerrestrialTime(first));
}

const directionError = (a: Vec3, b: Vec3): number => Math.atan2(length(cross(a, b)), dot(a, b)) * DEG;

test("Jacobson’s Mars model improves both moons on 192 separate Horizons dates and joins the fitted orbits smoothly", async () => {
  // TT approximates TDB here. Their periodic difference is less than 2 ms.
  const dates = reference.datesTdb.map((jd) => utcAt(fromJulianDate(jd)));
  assert.equal(dates.length, 192);
  assert.equal(new Set(dates).size, dates.length);
  for (const date of dates) {
    assert.ok(dense.dates.every((old) => Math.abs(Date.parse(old) - date) > 1));
  }
  const seams = [
    { time: START, fitted: true },
    { time: START + TRANSITION, fitted: false },
    { time: END - TRANSITION, fitted: false },
    { time: END, fitted: true },
  ];
  const fallbackChecks = [
    { time: START - DAY_MS, tolerance: 0 },
    { time: START, tolerance: 0 },
    { time: START + HOUR, tolerance: 1e-6 },
    { time: END - HOUR, tolerance: 1e-6 },
    { time: END, tolerance: 0 },
    { time: END + DAY_MS, tolerance: 0 },
  ];
  const fitted = IDS.map((id) => dates.map((date) => moonVector(id, date)));
  const fallback = IDS.map((id) => new Map(fallbackChecks.map(({ time }) => [time, moonVector(id, utcAt(time))])));
  assert.equal(moonTheoryOf("phobos"), undefined);
  assert.equal(await loadMoonTheory("mars"), true);
  assert.equal(await loadMoonTheory("mars"), false);
  assert.equal(moonTheoryOf("titan"), undefined);

  for (const [index, id] of IDS.entries()) {
    const theory = moonTheoryOf(id);
    assert.ok(theory);
    let rmsBefore = 0;
    let rmsAfter = 0;
    const vectors = reference.moons[id];
    assert.equal(vectors.length, dates.length);
    vectors.forEach((expected, row) => {
      const date = dates[row]!;
      const before = directionError(fitted[index]![row]!, expected);
      const actual = moonVector(id, date);
      const after = directionError(actual, expected);
      const inside = theory.weight?.(toTerrestrialTime(date)) === 1;
      const limit = id === "phobos" ? (inside ? 0.05 : 0.15) : (inside ? 0.10 : 0.18);
      assert.ok(after <= limit, `${id} at ${new Date(date).toISOString()}: ${after}° (limit ${limit}°)`);
      assert.ok(Math.abs(length(actual) - length(expected)) < 5, id);
      rmsBefore += before ** 2;
      rmsAfter += after ** 2;
    });
    assert.ok(rmsAfter < rmsBefore / 9, `${id} directional RMS falls by more than a factor of 3`);

    for (const { time, tolerance } of fallbackChecks) {
      const destination = fallback[index]!.get(time)!;
      assert.ok(length(sub(moonVector(id, utcAt(time)), destination)) <= tolerance, `${id} joins the fit near ${new Date(time).toISOString()}`);
    }
    for (const seam of seams) {
      const time = utcAt(seam.time);
      const want = seam.fitted ? fallback[index]!.get(seam.time)! : theory(seam.time);
      const current = moonVector(id, time);
      assert.ok(length(sub(current, want)) < 1e-8, `${id} position at ${new Date(time).toISOString()}`);
      const left = scale(sub(current, moonVector(id, time - 250)), 4);
      const right = scale(sub(moonVector(id, time + 250), current), 4);
      assert.ok(length(sub(left, right)) < 0.0002, `${id} velocity at ${new Date(time).toISOString()}`);
    }
  }
});
