import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogueMoonsOf } from "../src/moon-catalogue.ts";
import { jupiterMoonChart } from "../src/jupiter-chart.ts";

test("the chart draws every moon of Jupiter, larger when the moon is, and higher when it is farther", () => {
  const chart = jupiterMoonChart();
  const moons = catalogueMoonsOf("jupiter");
  assert.equal(chart.count, moons.length);
  assert.equal(chart.dots.length, moons.length);
  assert.deepEqual(chart.dots.map((dot) => dot.id).sort(), moons.map((moon) => moon.id).sort());
  const ganymede = chart.dots.find((dot) => dot.id === "ganymede")!;
  assert.ok(chart.dots.every((dot) => dot.r <= ganymede.r + 0.01));
  for (const dot of chart.dots) {
    assert.ok(dot.x - dot.r >= 8 && dot.x + dot.r <= chart.width - 8, dot.id);
    assert.ok(dot.y - dot.r >= 36 && dot.y + dot.r < chart.planet.y - chart.planet.r, dot.id);
  }
  for (let i = 0; i < chart.dots.length; i++) {
    for (let j = i + 1; j < chart.dots.length; j++) {
      const a = chart.dots[i]!;
      const b = chart.dots[j]!;
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
      assert.ok(gap >= 2.5, `${a.id} touches ${b.id}`);
    }
  }
  const byDistance = [...chart.dots].filter((dot) => dot.distanceKm !== null).sort((a, b) => a.distanceKm! - b.distanceKm!);
  const near = byDistance.slice(0, 8).reduce((sum, dot) => sum + dot.y, 0) / 8;
  const far = byDistance.slice(-8).reduce((sum, dot) => sum + dot.y, 0) / 8;
  assert.ok(near > far, "the nearest moons sit closest to Jupiter");
  const himalia = chart.legend.find((entry) => entry.id === "himalia")!;
  assert.equal(himalia.names.ja, "ヒマリア群");
  assert.ok(chart.dots.filter((dot) => dot.estimated).length > 0);
  assert.equal(chart.legend.reduce((sum, entry) => sum + entry.count, 0), chart.count);
});
