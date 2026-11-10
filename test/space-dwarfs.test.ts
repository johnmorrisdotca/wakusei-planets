// The dwarf planets in the space view: each has a place in the frame, in both scales, and lies on its own orbit line like the planets.
import assert from "node:assert/strict";
import { test } from "node:test";
import { heliocentric } from "../src/ephemeris.ts";
import { frameAt, orbitLine, placeBodies, planetOrbit, radiusIn, SPACE_DWARFS, type ScaleMode } from "../src/space/index.ts";
import { moonDistance } from "../src/space/scale.ts";
import { BODIES } from "../src/facts.ts";
import type { Vec3 } from "../src/vec.ts";

const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
const ms = Date.UTC(2026, 10, 10, 12);

test("every dwarf planet has a place in the frame, as far from the Earth as it is from the Sun to within an astronomical unit", () => {
  const frame = frameAt(ms);
  assert.deepEqual(Object.keys(frame.dwarfs).sort(), [...SPACE_DWARFS].sort());
  for (const id of SPACE_DWARFS) {
    const fromSun = length(heliocentric(id, ms));
    const fromEarth = length(frame.dwarfs[id]);
    assert.ok(Math.abs(fromEarth - fromSun) <= 1.0001, `${id}: ${fromEarth.toFixed(2)} au from the Earth, ${fromSun.toFixed(2)} from the Sun`);
  }
});

for (const mode of ["true", "compressed"] as ScaleMode[]) {
  test(`${mode} scale: each dwarf planet is placed with the planets' mapping and lies on its own orbit line`, () => {
    const frame = frameAt(ms);
    const places = placeBodies(mode, frame);
    for (const id of SPACE_DWARFS) {
      const line = orbitLine(mode, places.sun, planetOrbit(id, ms, 96));
      let near = Infinity;
      for (let i = 0; i < 96; i += 1) {
        const a = line[i]!;
        const b = line[i + 1]!;
        const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const am: Vec3 = [places[id][0] - a[0], places[id][1] - a[1], places[id][2] - a[2]];
        const t = Math.max(0, Math.min(1, (am[0] * ab[0] + am[1] * ab[1] + am[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
        near = Math.min(near, Math.hypot(places[id][0] - a[0] - ab[0] * t, places[id][1] - a[1] - ab[1] * t, places[id][2] - a[2] - ab[2] * t));
      }
      const radius = length([line[0]![0] - places.sun[0], line[0]![1] - places.sun[1], line[0]![2] - places.sun[2]]);
      assert.ok(near / radius < 0.01, `${id}: ${(near / radius).toFixed(4)} of its orbit's radius off its line`);
    }
  });
}

test("a dwarf planet's size: real in the true scale, never under 0.3 Earth radii in the compressed one; its moons keep their real distances", () => {
  for (const id of SPACE_DWARFS) {
    assert.equal(radiusIn(id, "true"), BODIES[id].radiusKm / 6378.137);
    assert.ok(radiusIn(id, "compressed") >= 0.3 && radiusIn(id, "compressed") >= radiusIn(id, "true"));
  }
  for (const host of ["orcus", "haumea", "eris"] as const) assert.equal(moonDistance("compressed", host, 12.5), 12.5);
});
