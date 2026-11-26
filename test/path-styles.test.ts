// Styled orbits (MODULES-1328): a page names a few bodies and a look, and the looks differ by width and dash as well as colour.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUILT_IN_PATH_STYLES,
  MAX_PATHS,
  capPaths,
  completeStyle,
  hitRadius,
  nearestPath,
  pathSpanMs,
  readPathHit,
  styleOf,
  styleTable,
  type PathStyle,
} from "../src/space/path-styles.ts";

test("the built-in looks differ by width and dash, not only by colour (MODULES-1328)", () => {
  const looks = ["selected", "hovered", "favourite", "path"] as const;
  assert.deepEqual(Object.keys(BUILT_IN_PATH_STYLES).sort(), [...looks].sort());
  const signature = (style: PathStyle): string => `${style.width}:${style.dash === null ? "solid" : style.dash.join(",")}`;
  const seen = new Set(looks.map((name) => signature(BUILT_IN_PATH_STYLES[name])));
  assert.equal(seen.size, looks.length, "each look has its own width or dash");
  assert.equal(BUILT_IN_PATH_STYLES.selected.dash, null);
  assert.ok(BUILT_IN_PATH_STYLES.hovered.dash !== null && BUILT_IN_PATH_STYLES.favourite.dash !== null);
  assert.notEqual(BUILT_IN_PATH_STYLES.hovered.width, BUILT_IN_PATH_STYLES.favourite.width);
});

test("a look keeps only the parts that are in range (MODULES-1328)", () => {
  const base = BUILT_IN_PATH_STYLES.path;
  assert.equal(completeStyle(null, base).width, base.width);
  assert.equal(completeStyle(undefined, base).color, base.color);
  const kept = completeStyle({ color: "  ", width: Number.NaN, opacity: -2, dash: [0, 80] }, base);
  assert.equal(kept.color, base.color);
  assert.equal(kept.width, base.width);
  assert.equal(kept.opacity, 0);
  assert.deepEqual(kept.dash, [1, 64]);
  const ignored = completeStyle({ dash: [4] as unknown as [number, number] }, base);
  assert.deepEqual(ignored.dash, base.dash);
  assert.equal(readPathHit(""), 8);
  assert.equal(readPathHit("nope"), 8);
  assert.equal(readPathHit("-1"), 8);
  assert.equal(hitRadius(0, "pen"), 0);
  assert.equal(hitRadius(10, "pen"), 10);
  assert.equal(capPaths([1, 2]).dropped, 0);
  assert.equal(nearestPath([], { x: 0, y: 0 }, 0), null);
  const point = nearestPath([{ id: "mars", style: "path", xy: [5, 5, 5, 5] }], { x: 5, y: 6 }, 8);
  assert.equal(point?.distancePx, 1);
  const broken = nearestPath([{ id: "mars", style: "path", xy: [Number.NaN, 0, 10, 0, 10, 0, 20, 0] }], { x: 15, y: 1 }, 8);
  assert.equal(broken?.id, "mars");
  const table = styleTable({ "": { width: 4 }, hovered: null });
  assert.equal(table[""], undefined);
  assert.equal(table.hovered!.dash !== null, true);
});

test("a page's look is laid over the built-in one, and a bad part is left out (MODULES-1328)", () => {
  const favourite = completeStyle({ color: "#7fdbff", width: 100, dash: [8, 5] }, BUILT_IN_PATH_STYLES.favourite);
  assert.equal(favourite.color, "#7fdbff");
  assert.equal(favourite.width, 8);
  assert.deepEqual(favourite.dash, [8, 5]);
  assert.equal(favourite.opacity, BUILT_IN_PATH_STYLES.favourite.opacity);
  const solid = completeStyle({ dash: null }, BUILT_IN_PATH_STYLES.hovered);
  assert.equal(solid.dash, null);
  const table = styleTable({ favourite: { width: 3 }, mine: { color: "#ff0000" }, hovered: null });
  assert.equal(table.favourite!.width, 3);
  assert.equal(table.favourite!.color, BUILT_IN_PATH_STYLES.favourite.color);
  assert.equal(table.hovered!.width, BUILT_IN_PATH_STYLES.hovered.width, "null takes a page's entry away and leaves the built-in look");
  assert.equal(table.mine!.color, "#ff0000");
  assert.equal(table.mine!.width, BUILT_IN_PATH_STYLES.path.width);
  assert.equal(styleOf({ id: "mars" }, table).name, "path");
  assert.equal(styleOf({ id: "mars", style: "favourite" }, table).style.width, 3);
  assert.equal(styleOf({ id: "mars", style: "missing" }, table).name, "path");
  assert.equal(styleOf({ id: "mars", style: { color: "#00ff00" } }, table).name, "custom");
});

test("a long list keeps its last paths, and a touch reaches further (MODULES-1328)", () => {
  const list = Array.from({ length: MAX_PATHS + 4 }, (_, i) => ({ id: `b${i}` }));
  const capped = capPaths(list);
  assert.equal(capped.dropped, 4);
  assert.equal(capped.kept.length, MAX_PATHS);
  assert.equal(capped.kept[0]!.id, "b4");
  assert.equal(capped.kept.at(-1)!.id, `b${MAX_PATHS + 3}`);
  assert.equal(readPathHit(null), 8);
  assert.equal(readPathHit("off"), 0);
  assert.equal(readPathHit("80"), 40);
  assert.equal(hitRadius(8, "mouse"), 8);
  assert.equal(hitRadius(8, "touch"), 16);
  assert.equal(hitRadius(0, "touch"), 0);
});

test("a planet's trip is round the Sun and a moon's is round its planet (MODULES-1328)", () => {
  const mars = pathSpanMs("mars");
  const moon = pathSpanMs("moon");
  const io = pathSpanMs("io");
  assert.ok(mars !== null && Math.abs(mars / 86_400_000 - 686.98) < 0.01);
  assert.ok(moon !== null && moon > 27 * 86_400_000 && moon < 28 * 86_400_000);
  assert.ok(io !== null && io > 1.7 * 86_400_000 && io < 1.8 * 86_400_000);
  assert.ok(moon < mars);
  assert.equal(pathSpanMs("sun"), null);
  assert.equal(pathSpanMs("no-such-body"), null);
});

test("the nearest styled path is the one under the point (MODULES-1328)", () => {
  const lines = [
    { id: "mars", style: "favourite", xy: [0, 0, 100, 0] },
    { id: "io", style: "selected", xy: [0, 40, 100, 40] },
  ];
  const onMars = nearestPath(lines, { x: 50, y: 3 }, 8);
  assert.equal(onMars?.id, "mars");
  assert.ok(onMars !== null && onMars.distancePx < 4);
  assert.equal(nearestPath(lines, { x: 50, y: 30 }, 8), null);
  const touch = nearestPath(lines, { x: 50, y: 30 }, 16);
  assert.equal(touch?.id, "io");
});
