import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moonCounts } from "../src/moon-catalogue.ts";
import { MOON_CATALOGUE_FETCHED } from "../src/moon-catalogue.ts";
import { MOON_COUNT_IDS, MOON_COUNT_READ, moonCountGrid, moonCountHref } from "../src/moon-counts.ts";

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

  it("sends a giant planet to its moon page, and the others to that body", () => {
    assert.equal(moonCountHref("saturn"), "saturn.html");
    assert.equal(moonCountHref("mercury"), "index.html?body=mercury");
    assert.equal(moonCountHref("pluto"), "index.html?body=pluto");
    assert.equal(MOON_COUNT_READ, MOON_CATALOGUE_FETCHED);
  });
});
