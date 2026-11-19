// The moon pages' numbers: worked out from the package's data, the same object for the same planet, every catalogue moon there, the cards nearest first.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MOONS_OF } from "../src/facts.ts";
import { catalogueMoonsOf, moonCounts } from "../src/moon-catalogue.ts";
import { moonPage, MOON_PAGE_HOSTS, MOON_PAGE_TIME } from "../src/moon-pages/index.ts";

test("each giant planet's pages hold every moon of the list, its orbit where it has one, and the moons drawn in full nearest first", () => {
  assert.equal(new Date(MOON_PAGE_TIME).toISOString(), "2026-12-01T00:00:00.000Z");
  for (const host of MOON_PAGE_HOSTS) {
    const page = moonPage(host);
    assert.equal(moonPage(host), page, "the same object again");
    const catalogue = catalogueMoonsOf(host);
    assert.equal(page.moons.length, catalogue.length);
    assert.equal(page.counts.total, moonCounts()[host]!.total);
    assert.equal(page.counts.prograde + page.counts.retrograde, catalogue.filter((m) => m.orbit !== null).length);
    for (const moon of page.moons) {
      assert.equal(moon.orbit === null, moon.a === null, moon.id);
      if (moon.orbit !== null) assert.equal(moon.orbit.length, 48 * 3, moon.id);
    }
    assert.deepEqual(page.cards.map((c) => c.id).sort(), [...MOONS_OF[host]].sort());
    const distances = page.cards.map((c) => c.a ?? Infinity);
    assert.deepEqual(distances, [...distances].sort((p, q) => p - q));
    assert.ok(page.inner > 0 && page.inner < Math.max(...page.moons.flatMap((m) => m.orbit ?? [0]).map(Math.abs)));
  }
});
