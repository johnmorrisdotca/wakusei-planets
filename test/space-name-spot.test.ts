// Where a floating name goes, and that it stays inside the view (MODULES-1144).
import assert from "node:assert/strict";
import { test } from "node:test";
import { nameSpot } from "../src/space/labels.ts";

const frame = { width: 400, height: 300 };
const size = { width: 60, height: 16 };

test("a name with room to its right stays on the right of the dot", () => {
  const spot = nameSpot({ x: 100, y: 100, r: 10 }, size, frame);
  assert.deepEqual(spot, { x: 110, y: 92, flipped: false });
});

test("a name that would pass the right edge goes to the left of the dot", () => {
  const spot = nameSpot({ x: 380, y: 100, r: 10 }, size, frame);
  assert.equal(spot.flipped, true);
  assert.equal(spot.x, 310);
  assert.ok(spot.x + size.width <= 370, "it ends before the dot");
});

test("a name that fits on neither side is held against the edge", () => {
  const spot = nameSpot({ x: 30, y: 100, r: 10 }, { width: 80, height: 16 }, { width: 100, height: 300 });
  assert.equal(spot.x, 20);
  assert.equal(spot.flipped, false);
});

test("a name past the bottom or the top is held inside", () => {
  assert.equal(nameSpot({ x: 100, y: 298, r: 4 }, size, frame).y, 284);
  assert.equal(nameSpot({ x: 100, y: 2, r: 4 }, size, frame).y, 0);
});

test("a body outside the view keeps its name where it falls", () => {
  assert.deepEqual(nameSpot({ x: 500, y: 100, r: 10 }, size, frame), { x: 510, y: 92, flipped: false });
});
