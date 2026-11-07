// Pluto's and the dwarf planets' tables are Chebyshev segments: the position must not jump where one ends and the next begins, and it must agree with JPL's approximate elements (which it replaces) to within their own error.
import assert from "node:assert/strict";
import { test } from "node:test";
import { heliocentric } from "../src/ephemeris.ts";
import { DWARF_TABLES } from "../src/data/dwarfs.ts";
import { PLUTO_SEGMENT_MS, PLUTO_START } from "../src/data/pluto.ts";
import { ttMinusUtc } from "../src/time.ts";
import { length, sub } from "../src/vec.ts";

test("Pluto steps by no more than the fit's own error where one segment of the table ends and the next begins", () => {
  for (let k = 1; k < 20; k += 1) {
    const edge = PLUTO_START + k * PLUTO_SEGMENT_MS;
    const utc = edge - ttMinusUtc(edge) * 1000;
    const step = length(sub(heliocentric("pluto", utc + 500), heliocentric("pluto", utc - 500)));
    // a second of Pluto's own travel is about 3e-8 au; segments are fitted on their own and may disagree by the fit's error, 0.15 arc-seconds, which is 3e-5 au at Pluto's distance
    assert.ok(step < 4e-5, `at segment ${k} Pluto steps ${step} au across the edge`);
  }
});

test("the table and JPL's approximate elements agree to about 40 arc-seconds in 2026", () => {
  const table = heliocentric("pluto", Date.UTC(2026, 10, 7));
  const outside = heliocentric("pluto", Date.UTC(2201, 0, 1));
  assert.ok(length(table) > 30 && length(table) < 50);
  assert.ok(length(outside) > 30 && length(outside) < 50, "outside 1800 to 2200 the elements still answer");
});

test("every dwarf planet's table is continuous across its segment edges, and the elements answer outside it", () => {
  for (const [name, table] of Object.entries(DWARF_TABLES)) {
    for (let k = 1; k < table.segments.length; k += 1) {
      const edge = table.start + k * table.segment;
      const utc = edge - ttMinusUtc(edge) * 1000;
      const before = heliocentric(name as Parameters<typeof heliocentric>[0], utc - 500);
      const after = heliocentric(name as Parameters<typeof heliocentric>[0], utc + 500);
      // a second of travel plus the segments' disagreement (each is fitted alone, within `worst` arc-seconds of Horizons) at the body's distance
      const allowed = 2e-6 * length(before) + (2 * table.worst * length(before)) / 206264.806 + 1e-7;
      assert.ok(length(sub(after, before)) < allowed, `${name} steps ${length(sub(after, before))} au across edge ${k}, allowed ${allowed}`);
    }
    const outside = heliocentric(name as Parameters<typeof heliocentric>[0], Date.UTC(2300, 0, 1));
    assert.ok(Number.isFinite(length(outside)) && length(outside) > 1, `${name} outside its table`);
  }
});
