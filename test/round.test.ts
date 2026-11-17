import assert from "node:assert/strict";
import { test } from "node:test";
import { edgeStretch, NOT_SQUEEZED, roundShape, squashPoint } from "../src/scene/round.ts";
import type { Vec3 } from "../src/vec.ts";

const eye: Vec3 = [0, 0, 0];
const forward: Vec3 = [0, 0, -1];
const RAD = Math.PI / 180;
/** A point `d` away at `theta` degrees off the line of sight, to the right. */
const at = (d: number, theta: number): Vec3 => [d * Math.sin(theta * RAD), 0, -d * Math.cos(theta * RAD)];

test("a body on the line of sight is not squeezed", () => {
  assert.deepEqual(roundShape(eye, forward, [0, 0, -50], 2), NOT_SQUEEZED);
  assert.equal(edgeStretch(eye, forward, [0, 0, -50]), 1);
});

test("a body off the line of sight is squeezed along the way to the middle by the circular-section factor", () => {
  const d = 40;
  const r = 3;
  for (const theta of [10, 30, 37, 50]) {
    const shape = roundShape(eye, forward, at(d, theta), r);
    const tan = Math.tan(theta * RAD);
    assert.ok(Math.abs(shape.k - 1 / Math.sqrt(1 + (tan * tan * d * d) / (d * d - r * r))) < 1e-12, `theta ${theta}`);
    // the axis lies across the line of sight to the body, in the plane of it and the camera's own, and points back toward the middle
    const sight: Vec3 = [Math.sin(theta * RAD), 0, -Math.cos(theta * RAD)];
    assert.ok(Math.abs(shape.axis[0] * sight[0] + shape.axis[1] * sight[1] + shape.axis[2] * sight[2]) < 1e-12);
    assert.ok(shape.axis[0] < 0, "toward the middle (left of a body at the right)");
    assert.ok(Math.abs(shape.axis[1]) < 1e-12);
  }
  // about cos(theta) for a small body
  assert.ok(Math.abs(roundShape(eye, forward, at(1000, 37), 1).k - Math.cos(37 * RAD)) < 1e-3);
});

test("the radius on the screen grows as 1 / cos of the angle off the line of sight", () => {
  assert.ok(Math.abs(edgeStretch(eye, forward, at(30, 37)) - 1 / Math.cos(37 * RAD)) < 1e-12);
  assert.equal(edgeStretch(eye, forward, [0, 0, 30]), 1, "behind the camera");
});

test("no squeeze for a body behind the camera, one the camera is in, or one at the edge of sight", () => {
  assert.deepEqual(roundShape(eye, forward, [0, 0, 30], 2), NOT_SQUEEZED);
  assert.deepEqual(roundShape(eye, forward, at(2, 20), 2), NOT_SQUEEZED);
  assert.equal(roundShape(eye, forward, at(40, 89), 1).k, 1);
  assert.ok(roundShape(eye, forward, at(40, 60), 1).k < 1);
});

test("squashPoint is the same shift the shader makes: along the axis only, about the centre", () => {
  const centre = at(40, 37);
  const shape = roundShape(eye, forward, centre, 3);
  assert.deepEqual(squashPoint(centre, centre, shape), centre);
  const along: Vec3 = [centre[0] + shape.axis[0] * 3, centre[1] + shape.axis[1] * 3, centre[2] + shape.axis[2] * 3];
  const moved = squashPoint(along, centre, shape);
  assert.ok(Math.abs(Math.hypot(moved[0] - centre[0], moved[1] - centre[1], moved[2] - centre[2]) - 3 * shape.k) < 1e-12);
  // across the axis nothing moves
  const across: Vec3 = [centre[0], centre[1] + 3, centre[2]];
  assert.deepEqual(squashPoint(across, centre, shape), across);
  assert.equal(squashPoint(along, centre, NOT_SQUEEZED), along);
});
