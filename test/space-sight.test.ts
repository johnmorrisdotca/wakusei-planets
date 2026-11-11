// Where a body is for the picture: in view, or beyond which edge and where along it, for bodies in front of the camera and behind it; and when the page is told again.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGHT_STEP_PX, sightChanged, sightOf, type Sight } from "../src/space/index.ts";

const W = 800;
const H = 600;
const ahead = (x: number, y: number, r = 2) => ({ front: true, x, y, r, dx: x - W / 2, dy: y - H / 2 });

test("a body whose disc is on the picture is in view, even when only its edge is; its place is its own", () => {
  assert.deepEqual(sightOf(ahead(400, 300), W, H), { inView: true, behind: false, edge: null, x: 400, y: 300, along: 0, angle: 0 });
  assert.equal(sightOf(ahead(810, 300, 20), W, H).inView, true);
  assert.equal(sightOf(ahead(830, 300, 20), W, H).inView, false);
  assert.equal(sightOf(ahead(-5, -5, 10), W, H).inView, true);
});

test("a body out of view lies beyond the edge the line from the middle to it crosses, at the point it crosses", () => {
  const right = sightOf(ahead(1200, 300), W, H);
  assert.equal(right.edge, "right");
  assert.equal(right.x, W);
  assert.equal(right.y, 300);
  assert.equal(right.along, 300);
  assert.equal(right.angle, 90);
  const up = sightOf(ahead(500, -900), W, H);
  assert.equal(up.edge, "top");
  assert.equal(up.y, 0);
  assert.ok(Math.abs(up.along - (400 + 100 * (300 / 1200))) < 1e-9);
  assert.ok(up.angle > 0 && up.angle < 45);
  assert.equal(sightOf(ahead(-300, 320), W, H).edge, "left");
  const down = sightOf(ahead(100, 2000), W, H);
  assert.equal(down.edge, "bottom");
  assert.equal(down.y, H);
  assert.ok(down.angle > 180 && down.angle < 270);
  // a long, low picture: a body up and to the right goes out of the top when it is steep, out of the side when it is shallow
  assert.equal(sightOf(ahead(500, -1000), W, H).edge, "top");
  assert.equal(sightOf(ahead(3000, 0), W, H).edge, "right");
});

test("a body behind the camera has a side too, from the way to it on the screen; straight behind is below", () => {
  const left = sightOf({ front: false, x: 0, y: 0, r: 0, dx: -3, dy: 0.5 }, W, H);
  assert.equal(left.behind, true);
  assert.equal(left.inView, false);
  assert.equal(left.edge, "left");
  assert.equal(left.x, 0);
  const straight = sightOf({ front: false, x: 0, y: 0, r: 0, dx: 0, dy: 0 }, W, H);
  assert.equal(straight.edge, "bottom");
  assert.equal(straight.along, W / 2);
  assert.equal(straight.angle, 180);
  // the place a body behind the camera would project to is never read: it may be anywhere
  assert.equal(sightOf({ front: false, x: 400, y: 300, r: 50, dx: 0, dy: -1 }, W, H).edge, "top");
});

test("a panned view starts the line at the point straight ahead, kept inside the picture", () => {
  const panned = sightOf({ front: false, x: 0, y: 0, r: 0, dx: 1, dy: 0 }, W, H, { x: 600, y: 100 });
  assert.equal(panned.edge, "right");
  assert.equal(panned.along, 100);
  const outside = sightOf({ front: false, x: 0, y: 0, r: 0, dx: 0, dy: -1 }, W, H, { x: 2000, y: 300 });
  assert.equal(outside.edge, "top");
  assert.equal(outside.x, W);
});

test("the page is told again when a body enters or leaves the view, changes edge, goes behind, or moves a step along its edge; not for small moves", () => {
  const at = (x: number, y = 300): Record<string, Sight> => ({ mars: sightOf(ahead(x, y), W, H) });
  assert.equal(sightChanged(at(1200), at(1200, 300 + SIGHT_STEP_PX / 2)), false);
  assert.equal(sightChanged(at(1200), at(1200, 300 + SIGHT_STEP_PX * 3)), true);
  assert.equal(sightChanged(at(1200), at(500)), true);
  assert.equal(sightChanged(at(1200), at(-300)), true);
  // a body in view moving about in it is no news
  assert.equal(sightChanged(at(200), at(600, 100)), false);
  assert.equal(sightChanged(at(1200), { ...at(1200), sun: sightOf(ahead(400, 300), W, H) }), true);
  assert.equal(sightChanged({}, at(1200)), true);
  const behind = { mars: sightOf({ front: false, x: 0, y: 0, r: 0, dx: 1, dy: 0 }, W, H) };
  assert.equal(sightChanged(at(1200), behind), true);
});

test("a line through a corner of the picture belongs to the top or the bottom edge, at the corner itself", () => {
  const up = sightOf(ahead(1200, -300), W, H);
  assert.equal(up.edge, "top");
  assert.equal(up.x, W);
  assert.equal(up.y, 0);
  assert.equal(up.along, W);
  const down = sightOf({ front: false, x: 0, y: 0, r: 0, dx: 4, dy: 3 }, W, H);
  assert.equal(down.edge, "bottom");
  assert.equal(down.x, W);
  assert.equal(down.y, H);
  assert.equal(down.along, W);
  assert.equal(sightOf({ front: false, x: 0, y: 0, r: 0, dx: -4, dy: -3 }, W, H).edge, "top");
});
