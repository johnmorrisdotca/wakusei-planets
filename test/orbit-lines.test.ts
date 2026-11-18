// How faint the space view draws its orbit lines, and which line is under the pointer.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FAR_LOSS, FAR_RADII, FEW_LINES, LEAST_KEEP, NEAR_RADII, lineAlpha, lineKeep, linesInView, nearestLine, outnessOf, type ScreenLine } from "../src/space/orbit-lines.ts";

test("outness: none within 30 radii, all from 30000, the log of the distance between, rising", () => {
  assert.equal(outnessOf(4.1), 0);
  assert.equal(outnessOf(NEAR_RADII), 0);
  assert.equal(outnessOf(FAR_RADII), 1);
  assert.equal(outnessOf(1e9), 1);
  assert.ok(Math.abs(outnessOf(Math.sqrt(NEAR_RADII * FAR_RADII)) - 0.5) < 1e-12);
  assert.equal(outnessOf(Number.NaN), 0);
  let last = 0;
  for (let r = NEAR_RADII; r <= FAR_RADII; r *= 1.3) {
    const now = outnessOf(r);
    assert.ok(now >= last);
    last = now;
  }
});

test("a line keeps all its opacity while few are drawn and the view is near, and less as more are drawn or the view goes out", () => {
  assert.equal(lineKeep({ crowd: 1, outness: 0 }), 1);
  assert.equal(lineKeep({ crowd: FEW_LINES, outness: 0 }), 1);
  assert.ok(lineKeep({ crowd: FEW_LINES + 1, outness: 0 }) < 1);
  assert.ok(Math.abs(lineKeep({ crowd: FEW_LINES * 4, outness: 0 }) - 0.5) < 1e-12, "four times the crowd, half the opacity");
  assert.ok(Math.abs(lineKeep({ crowd: 1, outness: 1 }) - (1 - FAR_LOSS)) < 1e-12);
  assert.ok(Math.abs(lineKeep({ crowd: FEW_LINES * 4, outness: 1 }) - 0.5 * (1 - FAR_LOSS)) < 1e-12, "the two together multiply");
  let last = 1;
  for (let crowd = 1; crowd <= 400; crowd += 7) {
    const now = lineKeep({ crowd, outness: 0.3 });
    assert.ok(now <= last, "more lines never make one stronger");
    last = now;
  }
});

test("a line is never made fainter than the least, and a number out of range is held to it", () => {
  assert.equal(lineKeep({ crowd: 100_000, outness: 1 }), LEAST_KEEP);
  assert.equal(lineKeep({ crowd: 293 + 23, outness: 1 }), LEAST_KEEP, "Saturn's catalogue moons and the planets' lines, from far out");
  assert.equal(lineKeep({ crowd: 1, outness: 5 }), 1 - FAR_LOSS);
  assert.equal(lineKeep({ crowd: 1, outness: -3 }), 1);
});

test("the opacity of a line is its own opacity times the share kept", () => {
  assert.equal(lineAlpha({ base: 0.55, crowd: 3, outness: 0 }), 0.55);
  assert.ok(Math.abs(lineAlpha({ base: 0.6, crowd: FEW_LINES * 4, outness: 0 }) - 0.3) < 1e-12);
  assert.equal(lineAlpha({ base: 0.6, crowd: 1e6, outness: 1 }), 0.6 * LEAST_KEEP);
});

const line = (id: string, ...xy: number[]): ScreenLine => ({ id, colour: "#ffffff", xy });

test("the nearest line within the distance is found, by the distance to its segments and not to its points", () => {
  const lines = [line("a", 0, 0, 100, 0), line("b", 0, 50, 100, 50)];
  assert.equal(nearestLine(lines, { x: 50, y: 4 }, 6)?.id, "a", "between two points of a long segment");
  assert.equal(nearestLine(lines, { x: 50, y: 46 }, 6)?.id, "b");
  assert.equal(nearestLine(lines, { x: 50, y: 25 }, 6), null, "far from both");
  assert.equal(nearestLine(lines, { x: 50, y: 7 }, 6), null, "just outside");
  assert.equal(nearestLine(lines, { x: 50, y: 20 }, 30)?.id, "a", "the nearer of two within reach");
  assert.equal(nearestLine(lines, { x: 50, y: 30 }, 30)?.id, "b");
});

test("past the end of a segment the distance is to its end", () => {
  const lines = [line("a", 0, 0, 100, 0)];
  assert.equal(nearestLine(lines, { x: 104, y: 3 }, 6)?.id, "a", "5 away from the end");
  assert.equal(nearestLine(lines, { x: 106, y: 5 }, 6), null, "7.8 away from the end");
  assert.equal(nearestLine([line("dot", 10, 10, 10, 10)], { x: 13, y: 14 }, 6)?.id, "dot", "a segment of no length is a point");
});

test("a line is broken where it is behind the camera: nothing joins the points either side", () => {
  const broken = [line("a", 0, 0, 10, 0, Number.NaN, Number.NaN, 90, 0, 100, 0)];
  assert.equal(nearestLine(broken, { x: 50, y: 0 }, 6), null, "the gap is not a segment");
  assert.equal(nearestLine(broken, { x: 95, y: 2 }, 6)?.id, "a");
  assert.equal(nearestLine([line("none", Number.NaN, Number.NaN, Number.NaN, Number.NaN)], { x: 0, y: 0 }, 6), null);
});

test("no lines, no points and a one-point line find nothing", () => {
  assert.equal(nearestLine([], { x: 0, y: 0 }, 6), null);
  assert.equal(nearestLine([line("empty")], { x: 0, y: 0 }, 6), null);
  assert.equal(nearestLine([line("one", 5, 5)], { x: 5, y: 5 }, 6), null);
});

test("a ring of many lines picks the one the point is on, and the box test does not lose a line whose box only just reaches the point", () => {
  const ring = (id: string, r: number): ScreenLine => {
    const xy: number[] = [];
    for (let i = 0; i <= 72; i += 1) xy.push(200 + r * Math.cos((i / 72) * 2 * Math.PI), 200 + r * Math.sin((i / 72) * 2 * Math.PI));
    return { id, colour: "#aabbcc", xy };
  };
  const lines = [ring("r40", 40), ring("r80", 80), ring("r120", 120)];
  assert.equal(nearestLine(lines, { x: 280, y: 200 }, 4)?.id, "r80");
  assert.equal(nearestLine(lines, { x: 200, y: 200 + 120 + 3 }, 4)?.id, "r120", "3 outside the outermost, in the box grown by the distance");
  assert.equal(nearestLine(lines, { x: 200, y: 200 + 120 + 9 }, 4), null);
  assert.equal(nearestLine(lines, { x: 200, y: 200 }, 4), null, "the middle of the rings");
});

test("a line is in the picture when some segment of it has its box over the picture, and a line that is wholly off it, or behind the camera, is not", () => {
  const inside = line("in", 10, 10, 50, 50);
  const crossing = line("across", -500, 100, 900, 120);
  const corner = line("corner", -20, -20, 5, 5);
  const off = line("off", 700, 10, 800, 90, 900, 300);
  const above = line("above", 0, -300, 600, -200);
  const behind = line("behind", Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  const gap = line("gap", -50, 50, Number.NaN, Number.NaN, 700, 50, 800, 50);
  assert.equal(linesInView([inside, crossing, corner, off, above, behind, gap], 640, 480), 3, "in, across and corner");
  assert.equal(linesInView([], 640, 480), 0);
  assert.equal(linesInView([line("one", 5, 5)], 640, 480), 0, "a point is no line");
});
