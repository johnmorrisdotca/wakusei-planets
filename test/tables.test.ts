// A dwarf planet's fitted table is optional: without it `heliocentric` still answers with the approximate elements, and importing the entry point makes it accurate.
import assert from "node:assert/strict";
import { test } from "node:test";
import { heliocentric } from "../src/ephemeris.ts";
import { registerTable, tableOf } from "../src/data/tables.ts";
import { length, sub } from "../src/vec.ts";

test("without a table Ceres is still answered, by the elements, and importing the table moves it by about two degrees in 2000", async () => {
  const when = Date.UTC(2000, 0, 1, 12);
  assert.equal(tableOf("ceres"), undefined);
  assert.deepEqual(heliocentric.model("ceres", when), { theory: "osculating-elements", worstArcseconds: null });
  const before = heliocentric("ceres", when);
  assert.ok(length(before) > 2 && length(before) < 3.5);
  await import("../src/tables/ceres.ts");
  assert.ok(tableOf("ceres") !== undefined);
  const after = heliocentric("ceres", when);
  assert.deepEqual(heliocentric.model("ceres", when), { theory: "chebyshev", worstArcseconds: tableOf("ceres")!.worst });
  // 2 degrees at 2.8 au is about 0.1 au
  assert.ok(length(sub(before, after)) > 0.05, "the table changes the answer");
});

test("the part entry points register only their own bodies", async () => {
  await import("../src/tables/dwarfs.ts");
  for (const name of ["orcus", "haumea", "quaoar", "makemake", "gonggong", "eris", "sedna"]) assert.ok(tableOf(name) !== undefined, name);
  assert.equal(tableOf("pluto"), undefined, "Pluto's table is in the core, not registered");
});

test("model information respects built-in priorities, TT segment edges and unknown accuracy", async () => {
  const { toTerrestrialTime } = await import("../src/clock.ts");
  const when = Date.UTC(2026, 0, 1);
  assert.deepEqual(heliocentric.model("earth", when), { theory: "vsop87b", worstArcseconds: null });
  assert.deepEqual(heliocentric.model("pluto", when), { theory: "chebyshev", worstArcseconds: 0.14637 });
  assert.deepEqual(heliocentric.model("pluto", Date.UTC(2300, 0, 1)), { theory: "approximate-elements", worstArcseconds: null });
  const original = tableOf("ceres")!;
  const fixture = { start: toTerrestrialTime(when), segment: 1000, worst: 0.125, segments: [[[1], [2], [3]]] };
  try {
    registerTable("ceres", fixture);
    for (const offset of [0, 1, 999]) {
      assert.deepEqual(heliocentric.model("ceres", when + offset), { theory: "chebyshev", worstArcseconds: fixture.worst });
      assert.ok(heliocentric("ceres", when + offset).every(Number.isFinite));
    }
    for (const offset of [-1, 1000]) assert.deepEqual(heliocentric.model("ceres", when + offset), { theory: "osculating-elements", worstArcseconds: null });
  } finally {
    registerTable("ceres", original);
  }
});

test("model queries reject nonfinite instants without loading tables", () => {
  for (const body of ["earth", "pluto", "ceres"] as const) for (const ms of [NaN, Infinity, -Infinity]) assert.throws(() => heliocentric.model(body, ms), RangeError);
});
