import assert from "node:assert/strict";
import { test } from "node:test";
import { coverageAngleRad, splitDateLine, splitTrail, trackSteps } from "../src/ground-track.ts";
import { createPaintTrail } from "../src/paint/trail.ts";

test("the date line splits a line that would cross the map, and a short line stays one piece", () => {
  const crossed = splitDateLine({ lon: 170, lat: 0 }, { lon: -170, lat: 4 });
  assert.equal(crossed.length, 2);
  assert.equal(crossed[0]![1].lon, 180);
  assert.equal(crossed[1]![0].lon, -180);
  assert.equal(splitDateLine({ lon: 10, lat: 0 }, { lon: 20, lat: 1 }).length, 1);
  const same = splitDateLine({ lon: -170, lat: 0 }, { lon: 170, lat: 0 });
  assert.equal(same.length, 2);
  assert.ok(Math.abs(same[0]![1].lon) === 180);
});

test("a step near a pole is split so the line goes to the pole instead of across the map", () => {
  const pieces = splitTrail({ lon: 10, lat: 80 }, { lon: 170, lat: 75 });
  assert.ok(pieces.length > 1);
  assert.ok(pieces.some((piece) => piece.some((point) => Math.abs(point.lat) === 90)));
  assert.equal(splitTrail({ lon: 0, lat: 10 }, { lon: 20, lat: 12 }).length, 1);
});

test("the swath radius is 0 on the surface and wider the higher the craft, and matches the Earth at 6,371 km", () => {
  assert.equal(coverageAngleRad(0, 6371), 0);
  assert.equal(coverageAngleRad(-10, 1737.4), 0);
  const low = coverageAngleRad(50, 1737.4);
  const high = coverageAngleRad(400, 1737.4);
  assert.ok(low > 0 && high > low);
  const earth = coverageAngleRad(400, 6371);
  assert.ok(Math.abs(earth - 0.2108) < 0.002, String(earth));
  assert.ok(trackSteps({ lon: 0, lat: 0 }, { lon: 10, lat: 0 }, 2).length > 2);
});

test("the trail grows as time moves, holds still at one moment, clears, and a new craft starts empty", () => {
  const trail = createPaintTrail();
  trail.set({ id: "lro", length: "1d" });
  const sample = (ms: number) => ({ lon: Math.max(-170, Math.min(170, ms / 200_000)), lat: 8, heightKm: 50 });
  const first = trail.step(0, 1737.4, sample);
  assert.equal(first, true);
  const painted = trail.pixels;
  assert.ok(painted > 0);
  assert.equal(trail.step(0, 1737.4, sample), false);
  assert.equal(trail.pixels, painted);
  assert.equal(trail.step(6 * 3_600_000, 1737.4, sample), true);
  assert.ok(trail.pixels > painted, "six hours later the line is longer");
  const backward = trail.pixels;
  trail.step(5 * 3_600_000, 1737.4, sample);
  assert.ok(trail.pixels > 0 && trail.pixels <= backward);
  trail.set({ id: "danuri" });
  assert.equal(trail.pixels, 0);
  trail.clear();
  assert.equal(trail.pixels, 0);
  assert.equal(trail.on, false);
});
