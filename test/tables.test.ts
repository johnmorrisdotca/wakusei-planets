// A dwarf planet's fitted table is optional: without it `heliocentric` still answers with the approximate elements, and importing the entry point makes it accurate.
import assert from "node:assert/strict";
import { test } from "node:test";
import { heliocentric } from "../src/ephemeris.ts";
import { tableOf } from "../src/data/tables.ts";
import { length, sub } from "../src/vec.ts";

test("without a table Ceres is still answered, by the elements, and importing the table moves it by about two degrees in 2000", async () => {
  const when = Date.UTC(2000, 0, 1, 12);
  assert.equal(tableOf("ceres"), undefined);
  const before = heliocentric("ceres", when);
  assert.ok(length(before) > 2 && length(before) < 3.5);
  await import("../src/tables/ceres.ts");
  assert.ok(tableOf("ceres") !== undefined);
  const after = heliocentric("ceres", when);
  // 2 degrees at 2.8 au is about 0.1 au
  assert.ok(length(sub(before, after)) > 0.05, "the table changes the answer");
});

test("the part entry points register only their own bodies", async () => {
  await import("../src/tables/dwarfs.ts");
  for (const name of ["orcus", "haumea", "quaoar", "makemake", "gonggong", "eris", "sedna"]) assert.ok(tableOf(name) !== undefined, name);
  assert.equal(tableOf("pluto"), undefined, "Pluto's table is in the core, not registered");
});
