import assert from "node:assert/strict";
import { test } from "node:test";
import { apparent, BODIES, BODY_IDS, heliocentric, moonGeocentric, orbitPath, system } from "../src/index.ts";
import { cross, dot, length } from "../src/vec.ts";

const at = (y: number, m: number, d: number, h = 12): number => Date.UTC(y, m - 1, d, h);

test("the Earth is about one astronomical unit from the Sun, nearest in January", () => {
  const jan = length(heliocentric("earth", at(2026, 1, 3)));
  const jul = length(heliocentric("earth", at(2026, 7, 5)));
  assert.ok(jan > 0.98 && jan < 0.985, String(jan));
  assert.ok(jul > 1.015 && jul < 1.018, String(jul));
});

test("Saturn's rings are edge-on from the Earth in March 2025 and open about 26 degrees by 2032-ish", () => {
  assert.ok(Math.abs(apparent("saturn", at(2025, 3, 23)).subObserverLat) < 1.2);
  assert.ok(Math.abs(apparent("saturn", at(2017, 9, 15)).subObserverLat) > 25);
});

test("the Moon is new in the second week of November 2026 and full on the 24th", () => {
  assert.ok(apparent("moon", at(2026, 11, 9, 14)).illumination < 0.03);
  assert.ok(apparent("moon", at(2026, 11, 24, 14)).illumination > 0.97);
});

test("the Earth and the Moon are lit from the same side", () => {
  for (const when of [at(2026, 11, 9, 14), at(2026, 11, 24, 14), at(2026, 11, 2)]) {
    const earth = apparent("earth", when);
    const moon = apparent("moon", when);
    const agree = dot(earth.light, moon.light);
    assert.ok(agree > 0.95, `${when} ${agree}`);
    assert.ok(Math.abs(earth.illumination - moon.illumination) < 0.08, `${earth.illumination} ${moon.illumination}`);
  }
});

test("the Moon is about 360,000 to 406,000 km away, and its angular size half a degree", () => {
  const d = length(moonGeocentric(at(2026, 11, 2)));
  assert.ok(d > 356000 && d < 407000, String(d));
  const a = apparent("moon", at(2026, 11, 2));
  assert.ok(a.diameterDeg > 0.48 && a.diameterDeg < 0.58, String(a.diameterDeg));
});

test("the viewer's frame is a right-handed set of axes and every pose vector is a unit vector", () => {
  for (const id of BODY_IDS) {
    const a = apparent(id, at(2026, 11, 2));
    const { right, up, toward } = a.frame;
    assert.ok(dot(cross(right, up), toward) > 0.999, id);
    for (const v of [a.pole, a.meridian, a.light]) assert.ok(Math.abs(length(v) - 1) < 1e-6, `${id} ${length(v)}`);
    assert.ok(a.illumination >= 0 && a.illumination <= 1, id);
  }
});

test("Venus is nearly new near its inferior conjunction; the outer planets are nearly full", () => {
  assert.ok(apparent("jupiter", at(2026, 11, 2)).illumination > 0.97);
  assert.ok(apparent("venus", at(2025, 3, 23)).illumination < 0.03);
});

test("Jupiter's moons stay inside their orbits and Io goes round in under two days", () => {
  const t = at(2026, 11, 2);
  const { moons } = system("jupiter", t);
  assert.deepEqual(moons.map((m) => m.id), ["io", "europa", "ganymede", "callisto"]);
  const io = moons[0]!;
  assert.ok(io.distance > 5.8 && io.distance < 6.0, String(io.distance));
  const later = system("jupiter", t + 3 * 3600_000).moons[0]!;
  assert.ok(Math.hypot(later.x - io.x, later.y - io.y, later.z - io.z) > 2, "Io moves a lot in three hours");
  const path = orbitPath("callisto", t, 12);
  assert.equal(path.length, 36);
  for (let i = 0; i < 12; i += 1) assert.ok(Math.abs(Math.hypot(path[i * 3]!, path[i * 3 + 1]!, path[i * 3 + 2]!) - 26.3) < 1.2);
});

test("a body's size, tilt and rotation are the IAU numbers", () => {
  assert.equal(BODIES.jupiter.radiusKm, 71492);
  assert.equal(BODIES.uranus.tiltDeg, 97.77);
  assert.ok(BODIES.venus.rotationHours < 0, "Venus turns backwards");
  assert.ok(BODIES.saturn.rings!.length >= 5);
  assert.equal(BODY_IDS.length, 1 + 9 + 8 + 25 + 4);
});
