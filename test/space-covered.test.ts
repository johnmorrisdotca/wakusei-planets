import assert from "node:assert/strict";
import { test } from "node:test";
import { COVER_ARROW_GAP, COVER_MIN_PX, coverArrows, coveredBy } from "../src/space/index.ts";

const rank = (id: string): number => (id === "earth" ? 0 : id === "uranus" ? 2 : 4);

test("a body is covered by the nearest body whose disc holds its place and which is nearer the camera; a dot covers nothing, and nothing covers itself", () => {
  const behind = coveredBy([
    { id: "earth", x: 300, y: 300, r: 120, distance: 4 },
    { id: "moon", x: 80, y: 300, r: 30, distance: 3 },
    { id: "uranus", x: 340, y: 280, r: 1, distance: 60_000 },
    { id: "ariel", x: 342, y: 281, r: 0.1, distance: 60_000.1 },
    { id: "mars", x: 90, y: 310, r: 2, distance: 2 },
    { id: "venus", x: 95, y: 305, r: 1, distance: 5 },
    { id: "jupiter", x: 500, y: 500, r: 3, distance: 100 },
  ]);
  assert.equal(behind.get("uranus"), "earth");
  assert.equal(behind.get("ariel"), "earth");
  // Mars is inside the Moon's disc but nearer than the Moon: not behind it; Venus is behind the Moon, and Mars's two-pixel disc covers nothing
  assert.equal(behind.get("mars"), undefined);
  assert.equal(behind.get("venus"), "moon");
  assert.equal(behind.get("jupiter"), undefined);
  assert.equal(behind.get("earth"), undefined);
  assert.equal(behind.size, 3);
  assert.ok(COVER_MIN_PX >= 4);
});

test("the nearest covering disc wins when two hold the place", () => {
  const behind = coveredBy([
    { id: "earth", x: 300, y: 300, r: 120, distance: 4 },
    { id: "moon", x: 320, y: 300, r: 40, distance: 2 },
    { id: "uranus", x: 330, y: 300, r: 1, distance: 60_000 },
  ]);
  assert.equal(behind.get("uranus"), "moon");
  assert.equal(behind.get("moon"), undefined, "the Moon is in front of the Earth, not behind it");
});

test("one arrow per covering disc, just outside its edge on the side of the surest hidden body, pointing in, the lead first and the rest counted", () => {
  const arrows = coverArrows(
    {
      earth: { x: 300, y: 300, r: 120 },
      uranus: { x: 340, y: 280, r: 1, behind: "earth" },
      ariel: { x: 345, y: 281, r: 0.1, behind: "earth" },
      oberon: { x: 350, y: 285, r: 0.1, behind: "earth" },
      moon: { x: 80, y: 300, r: 30 },
      venus: { x: 60, y: 300, r: 1, behind: "moon" },
      mars: null,
    },
    rank,
  );
  assert.deepEqual(arrows.map((a) => [a.cover, a.lead, a.bodies]), [
    ["earth", "uranus", ["uranus", "ariel", "oberon"]],
    ["moon", "venus", ["venus"]],
  ]);
  const earth = arrows[0]!;
  // the tip is COVER_ARROW_GAP outside the Earth's edge, in the direction of Uranus from the Earth's centre
  const toUranus = Math.hypot(40, -20);
  assert.ok(Math.abs(earth.x - (300 + (40 / toUranus) * (120 + COVER_ARROW_GAP))) < 1e-9);
  assert.ok(Math.abs(earth.y - (300 + (-20 / toUranus) * (120 + COVER_ARROW_GAP))) < 1e-9);
  // and it points back in, towards the centre
  const back = (Math.atan2(20, -40) * 180) / Math.PI;
  assert.ok(Math.abs(earth.angle - back) < 1e-9, `${earth.angle} vs ${back}`);
  const moon = arrows[1]!;
  assert.ok(moon.x < 80 - 30 && Math.abs(moon.y - 300) < 1e-9, "Venus is left of the Moon: the arrow sits on the Moon's left edge");
  assert.ok(Math.abs(Math.abs(moon.angle) - 0) < 1e-9, "pointing right, into the Moon");
});

test("a hidden body whose covering body is off the screen gets no arrow, and a body right at the centre points the arrow from the right", () => {
  assert.deepEqual(coverArrows({ uranus: { x: 10, y: 10, r: 1, behind: "earth" }, earth: null }, rank), []);
  const [arrow] = coverArrows({ earth: { x: 300, y: 300, r: 100 }, uranus: { x: 300, y: 300, r: 1, behind: "earth" } }, rank);
  assert.ok(arrow !== undefined && arrow.x > 300 && Math.abs(arrow.y - 300) < 1e-9);
});
