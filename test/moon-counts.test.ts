import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moonCounts } from "../src/moon-catalogue.ts";
import { MOON_COUNT_IDS, moonCountGrid } from "../src/moon-counts.ts";

describe("moonCountGrid", () => {
  it("lists the nine painted planets in solar-system order, with the catalogue's own counts", () => {
    const rows = moonCountGrid();
    const counts = moonCounts();
    assert.deepEqual(rows.map((row) => row.id), [...MOON_COUNT_IDS]);
    for (const row of rows) {
      assert.equal(row.total, counts[row.id]?.total ?? 0);
    }
    assert.equal(rows.find((row) => row.id === "mercury")!.total, 0);
    assert.equal(rows.find((row) => row.id === "venus")!.total, 0);
    assert.ok(rows.find((row) => row.id === "saturn")!.total > rows.find((row) => row.id === "jupiter")!.total);
  });

  it("marks only the planet with the most moons", () => {
    const rows = moonCountGrid();
    const max = Math.max(...rows.map((row) => row.total));
    assert.deepEqual(
      rows.filter((row) => row.most).map((row) => row.id),
      rows.filter((row) => row.total === max).map((row) => row.id),
    );
    assert.equal(rows.find((row) => row.id === "saturn")!.most, true);
    assert.equal(rows.find((row) => row.id === "jupiter")!.most, false);
  });
});
