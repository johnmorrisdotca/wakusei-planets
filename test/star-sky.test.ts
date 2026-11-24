import assert from "node:assert/strict";
import { test } from "node:test";
import { OBLIQUITY, RAD } from "../src/vec.ts";
import { holdStarSky, skyDirection } from "../src/space/starSky.ts";

test("the north celestial pole is the ecliptic pole, tilted by the obliquity", () => {
  const [x, y, z] = skyDirection(0, 90);
  assert.ok(Math.abs(x) < 1e-12);
  assert.ok(Math.abs(y - Math.sin(OBLIQUITY * RAD)) < 1e-12);
  assert.ok(Math.abs(z - Math.cos(OBLIQUITY * RAD)) < 1e-12);
  const sirius = skyDirection(101.287, -16.716);
  const length = Math.hypot(sirius[0], sirius[1], sirius[2]);
  assert.ok(Math.abs(length - 1) < 1e-12);
});

test("the sky stays on the camera and inside the far plane", () => {
  const group = { position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } }, scale: { value: 0, setScalar(value: number) { this.value = value; } } };
  holdStarSky(group, { position: { x: 3, y: 4, z: 5 }, far: 100 });
  assert.deepEqual([group.position.x, group.position.y, group.position.z], [3, 4, 5]);
  assert.equal(group.scale.value, 60);
});
