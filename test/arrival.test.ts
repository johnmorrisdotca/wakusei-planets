// The side an arrival stands on: a companion in the picture, and the body at least half lit. Synthetic places, so each rule is one arrangement.
import assert from "node:assert/strict";
import { test } from "node:test";
import { arrivalSide } from "../src/space/travel.ts";
import { cross, dot, length, scale, sub, unit, type Vec3 } from "../src/vec.ts";

const angleOf = (a: Vec3, b: Vec3): number => Math.atan2(length(cross(a, b)), dot(a, b));

const BODY: Vec3 = [0, 0, 0];
const SUN: Vec3 = [0, 0, 100];
const FROM: Vec3 = [0, 0, 30];

function sees(side: Vec3, at: Vec3, aspect = 16 / 9): boolean {
  const distance = 4.1 * Math.max(1, 1 / aspect);
  const camera: Vec3 = [side[0] * distance, side[1] * distance, side[2] * distance];
  const forward = scale(side, -1);
  const north = sub([0, 1, 0], scale(forward, forward[1]));
  const up = length(north) < 1e-8 ? ([1, 0, 0] as Vec3) : unit(north);
  const v = sub(at, camera);
  const z = dot(v, forward);
  if (!(z > 0)) return false;
  const tv = Math.tan((35 / 2) * (Math.PI / 180));
  if (Math.abs(dot(v, cross(forward, up))) > 0.92 * tv * aspect * z) return false;
  if (Math.abs(dot(v, up)) > 0.92 * tv * z) return false;
  return angleOf(forward, unit(v)) > Math.atan(1 / distance) * 1.15;
}

test("a moon is kept in the picture ahead of the body the camera came from", () => {
  const moon: Vec3 = [9, 0.4, 0];
  const left: Vec3 = [0, 12, 2];
  const side = arrivalSide({
    body: BODY,
    radius: 1,
    from: FROM,
    sun: SUN,
    aspect: 16 / 9,
    companions: [
      { id: "io", at: moon, rank: 1 },
      { id: "earth", at: left, rank: 2 },
    ],
  });
  assert.equal(side.companion, "io");
  assert.ok(side.lit >= 0.5, String(side.lit));
  assert.ok(sees(side.side, moon), "the moon is beside the body");
});

test("with no moon, the body the camera came from is the companion", () => {
  const left: Vec3 = [6, 0.2, -1];
  const side = arrivalSide({
    body: BODY,
    radius: 1,
    from: FROM,
    sun: SUN,
    aspect: 16 / 9,
    companions: [{ id: "earth", at: left, rank: 2 }],
  });
  assert.equal(side.companion, "earth");
  assert.ok(side.lit >= 0.5);
  assert.ok(sees(side.side, left));
});

test("a night-side approach stays at least half lit, and the Sun is not bought by turning the globe black", () => {
  const night: Vec3 = [0, 0, -12];
  const side = arrivalSide({
    body: BODY,
    radius: 1,
    from: [0, 0, -30],
    sun: SUN,
    aspect: 1,
    companions: [{ id: "mars", at: night, rank: 2 }],
  });
  assert.ok(side.lit >= 0.5, String(side.lit));
  assert.ok(angleOf(side.side, unit(SUN)) <= Math.PI / 2 + 1e-4);
  if (side.companion === "mars") assert.ok(sees(side.side, night, 1));
  const sun = arrivalSide({
    body: BODY,
    radius: 1,
    from: FROM,
    sun: SUN,
    aspect: 16 / 9,
    companions: [{ id: "sun", at: SUN, rank: 3 }],
  });
  assert.ok(sun.lit >= 0.5, String(sun.lit));
  assert.ok(angleOf(sun.side, unit(SUN)) <= Math.PI / 2 + 1e-4);
  if (sun.companion === "sun") assert.ok(sees(sun.side, SUN));
});
