import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moonDotColumn, romanValue } from "../src/moon-dots.ts";

describe("moonDotColumn", () => {
  it("reads a Roman numeral", () => {
    assert.equal(romanValue("XVI"), 16);
    assert.equal(romanValue("IX"), 9);
    assert.equal(romanValue("nope"), null);
  });

  it("lists Jupiter's moons I to XVI, nearest first, Ganymede the largest dot", () => {
    const rows = moonDotColumn("jupiter");
    assert.deepEqual(rows.map((row) => row.label), [
      "Metis", "Adrastea", "Amalthea", "Thebe", "Io", "Europa", "Ganymede", "Callisto",
      "Leda", "Himalia", "Lysithea", "Elara", "Ananke", "Carme", "Pasiphae", "Sinope",
    ]);
    const distances = rows.map((row) => row.distanceKm);
    assert.ok(distances.every((km, i) => i === 0 || distances[i - 1]! <= km));
    const ganymede = rows.find((row) => row.id === "ganymede")!;
    const metis = rows.find((row) => row.id === "metis")!;
    assert.ok(ganymede.px > rows.find((row) => row.id === "io")!.px);
    assert.ok(ganymede.px > metis.px);
    assert.equal(metis.px >= 8, true);
  });

  it("keeps Saturn, Uranus and Neptune to the same numbers, Titan the largest Saturn dot", () => {
    for (const host of ["saturn", "uranus", "neptune"] as const) {
      const rows = moonDotColumn(host);
      assert.ok(rows.length > 0 && rows.length <= 16, host);
      const distances = rows.map((row) => row.distanceKm);
      assert.ok(distances.every((km, i) => i === 0 || distances[i - 1]! <= km), host);
    }
    const saturn = moonDotColumn("saturn");
    const titan = saturn.find((row) => row.id === "titan")!;
    assert.ok(saturn.every((row) => row.id === "titan" || row.px <= titan.px));
  });
});
