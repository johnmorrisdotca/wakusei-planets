import assert from "node:assert/strict";
import { test } from "node:test";
import { ORBITS } from "../src/data/orbits.ts";
import {
  BUILT_IN_PATH_STYLES,
  capPaths,
  colourOf,
  completeStyle,
  hitRadius,
  MAX_PATHS,
  nearestLine,
  nearestOnSegment,
  normalisePaths,
  parsePaths,
  parsePathStyles,
  readPathHit,
  resolvePathId,
  ringPeriodDays,
  styleOf,
  styleTable,
} from "../src/space/paths.ts";
import { MAX_RIBBON_QUADS, newRibbonBuffer, projectLine, writeRibbon, type RibbonView } from "../src/space/path-ribbons.ts";
import { PATH_IDS } from "../src/space/scene.ts";
import { SPACE_DWARFS, SPACE_MINORS, SPACE_PLANETS } from "../src/space/frame.ts";

const BODIES_WITH_LINE = new Set<string>([...SPACE_PLANETS, ...SPACE_DWARFS, ...SPACE_MINORS]);

test("the built-in looks differ by width and dash as well as colour", () => {
  const looks = Object.values(BUILT_IN_PATH_STYLES);
  const keys = new Set(looks.map((l) => `${l.width}/${JSON.stringify(l.dash)}`));
  assert.equal(keys.size, looks.length, "no two looks share both a width and a dash");
});

test("a look is completed from its base and held to its ranges", () => {
  const base = BUILT_IN_PATH_STYLES["path"]!;
  assert.deepEqual(completeStyle(undefined, base), base);
  assert.equal(completeStyle({ width: 99 }, base).width, 8);
  assert.equal(completeStyle({ width: 0 }, base).width, 0.5);
  assert.equal(completeStyle({ opacity: 3 }, base).opacity, 1);
  assert.deepEqual(completeStyle({ dash: [0, 500] }, base).dash, [1, 64]);
  assert.deepEqual(completeStyle({ dash: [3] as unknown as [number, number] }, BUILT_IN_PATH_STYLES["favourite"]!).dash, [3, 4], "a bad dash is the base's");
  assert.equal(completeStyle({ dash: null }, BUILT_IN_PATH_STYLES["favourite"]!).dash, null);
  assert.equal(completeStyle({ color: "  tomato " }, base).color, "tomato");
  assert.equal(completeStyle({ width: Number.NaN }, base).width, base.width);
});

test("the table lays a page's looks over the built-in ones and takes them away on null", () => {
  const table = styleTable({ favourite: { color: "red" }, mine: { width: 4 }, selected: null });
  assert.equal(table["favourite"]!.color, "red");
  assert.equal(table["favourite"]!.width, BUILT_IN_PATH_STYLES["favourite"]!.width, "the rest of the look is the built-in's");
  assert.equal(table["mine"]!.width, 4);
  assert.equal(table["mine"]!.color, BUILT_IN_PATH_STYLES["path"]!.color, "a new name starts from path");
  assert.deepEqual(table["selected"], BUILT_IN_PATH_STYLES["selected"]);
  assert.notEqual(table["path"], BUILT_IN_PATH_STYLES["path"], "a copy, so a page cannot change the built-ins");
});

test("a request is read by name, partial look, or the path look", () => {
  const table = styleTable({});
  assert.equal(styleOf({ id: "mars" }, table).name, "path");
  assert.equal(styleOf({ id: "mars", style: "favourite" }, table).name, "favourite");
  assert.equal(styleOf({ id: "mars", style: "nope" }, table).name, "path");
  const custom = styleOf({ id: "mars", style: { width: 5 } }, table);
  assert.equal(custom.name, "custom");
  assert.equal(custom.style.width, 5);
  assert.equal(custom.style.color, "#ffffff");
});

test("a longer list keeps the last sixteen", () => {
  const list = Array.from({ length: 20 }, (_, i) => i);
  const { kept, dropped } = capPaths(list);
  assert.equal(kept.length, MAX_PATHS);
  assert.equal(dropped, 4);
  assert.deepEqual(kept[0], 4);
  assert.deepEqual(capPaths([1, 2]), { kept: [1, 2], dropped: 0 });
});

test("an id names a body with an orbit, and a craft is refused", () => {
  for (const id of ["earth", "mars", "ceres", "moon", "io", "europa", "titan", "triton", "charon"]) assert.equal(resolvePathId(id, PATH_IDS), id, id);
  assert.equal(resolvePathId(" Mars ", PATH_IDS), "mars", "case and spaces are let go");
  for (const id of ["roadster", "voyager-1", "sun", "", "nowhere", 4, null, undefined, {}]) assert.equal(resolvePathId(id, PATH_IDS), null, String(id));
  assert.ok(!PATH_IDS.has("sun") && !PATH_IDS.has("roadster"));
  for (const id of PATH_IDS) assert.ok(id === "earth" || id === "moon" || ORBITS[id] !== undefined || BODIES_WITH_LINE.has(id), `${id} has an orbit to draw`);
});

test("every moon of the table that has a ring has a period", () => {
  for (const id of PATH_IDS) {
    if (ORBITS[id] === undefined) continue;
    const days = ringPeriodDays(ORBITS[id]!.sid);
    assert.ok(days !== null && days > 0 && days < 1e5, `${id} ${days}`);
  }
  assert.ok(Math.abs(ringPeriodDays(ORBITS["io"]!.sid)! - 1.769) < 0.01, "Io goes round in a day and three quarters");
  assert.ok(Math.abs(ringPeriodDays(ORBITS["titan"]!.sid)! - 15.95) < 0.05, "Titan in sixteen days");
  assert.equal(ringPeriodDays(0), null);
  assert.equal(ringPeriodDays(Number.NaN), null);
});

test("the attributes are read, and what is not a list or a table is nothing", () => {
  assert.deepEqual(parsePaths('["mars", {"id":"io","style":"favourite"}, 4, {"x":1}]'), [{ id: "mars" }, { id: "io", style: "favourite" }]);
  assert.deepEqual(parsePaths("mars, jupiter"), [{ id: "mars" }, { id: "jupiter" }]);
  assert.deepEqual(parsePaths("[not json"), []);
  assert.deepEqual(parsePaths(null), []);
  assert.deepEqual(normalisePaths({ id: "mars" }), []);
  assert.deepEqual(parsePathStyles('{"favourite":{"width":3},"gone":null,"bad":4,"list":[1]}'), { favourite: { width: 3 }, gone: null });
  assert.deepEqual(parsePathStyles("nope"), {});
});

test("path-hit is read as a number of pixels, off, or the default; a touch has twice the reach", () => {
  assert.equal(readPathHit(null), 8);
  assert.equal(readPathHit(""), 8);
  assert.equal(readPathHit("off"), 0);
  assert.equal(readPathHit("0"), 0);
  assert.equal(readPathHit("12"), 12);
  assert.equal(readPathHit("500"), 40);
  assert.equal(readPathHit("-3"), 8);
  assert.equal(readPathHit("wide"), 8);
  assert.equal(hitRadius(8, "mouse"), 8);
  assert.equal(hitRadius(8, "pen"), 8);
  assert.equal(hitRadius(8, "touch"), 16);
  assert.equal(hitRadius(3, "touch"), 16, "at least 16");
  assert.equal(hitRadius(20, "touch"), 40);
  assert.equal(hitRadius(0, "touch"), 0);
});

test("colours are read from hex, rgb and a fallback", () => {
  assert.deepEqual(colourOf("#fff"), [1, 1, 1]);
  assert.deepEqual(colourOf("#ff0000"), [1, 0, 0]);
  assert.deepEqual(colourOf("rgb(0, 255, 0)"), [0, 1, 0]);
  assert.deepEqual(colourOf("rgba(0,0,255,0.5)"), [0, 0, 1]);
  assert.deepEqual(colourOf("not a colour"), [1, 1, 1]);
});

test("the nearest point on a segment and on a line of segments", () => {
  assert.deepEqual(nearestOnSegment(5, 3, 0, 0, 10, 0), { distance: 3, x: 5, y: 0 });
  assert.deepEqual(nearestOnSegment(-4, 3, 0, 0, 10, 0), { distance: 5, x: 0, y: 0 }, "past the end it is the end");
  assert.equal(nearestOnSegment(1, 1, 2, 2, 2, 2).distance, Math.SQRT2, "a point of no length");
  const square = { xy: new Float64Array([0, 0, 100, 0, 100, 100, 0, 100, 0, 0]), ok: new Uint8Array([1, 1, 1, 1, 1]), count: 5 };
  const far = { xy: new Float64Array([300, 0, 400, 0, 400, 100, 300, 100, 300, 0]), ok: new Uint8Array([1, 1, 1, 1, 1]), count: 5 };
  const hit = nearestLine(50, 6, [far, square], 8)!;
  assert.equal(hit.index, 1);
  assert.equal(hit.distance, 6);
  assert.equal(hit.x, 50);
  assert.equal(nearestLine(50, 20, [far, square], 8), null, "beyond the radius");
  assert.equal(nearestLine(50, 50, [square], 8), null, "the middle of a ring is not on it");
  const broken = { xy: square.xy, ok: new Uint8Array([1, 0, 1, 1, 1]), count: 5 };
  assert.equal(nearestLine(50, 2, [broken], 8), null, "a segment with an end that cannot be seen is left out");
});

const view: RibbonView = { eye: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, -1], width: 400, height: 300, half: Math.tan((35 / 2) * (Math.PI / 180)) };

/** A ring of radius `r` round (0, 0, -d), flat to the camera, closed. */
const ring = (r: number, d: number, n = 96): number[] => {
  const out: number[] = [];
  for (let i = 0; i <= n; i += 1) out.push(r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI), -d);
  return out;
};

test("a point in front of the camera is projected to the picture and one behind it is flagged", () => {
  const xy = new Float64Array(4);
  const ok = new Uint8Array(2);
  const depth = new Float64Array(2);
  projectLine(view, [0, 0, -10, 1, 1, 10], 2, xy, ok, depth);
  assert.deepEqual([...ok], [1, 0]);
  assert.equal(xy[0], 200);
  assert.equal(xy[1], 150);
  assert.equal(depth[0], 10);
  // the right edge of the picture is at half * d * aspect
  projectLine(view, [view.half * 10 * (400 / 300), 0, -10], 1, xy, ok, depth);
  assert.ok(Math.abs(xy[0]! - 400) < 1e-9);
});

const drawRing = (dash: [number, number] | null, width: number, r = 3): { buffer: ReturnType<typeof newRibbonBuffer>; quads: number; solidified: boolean } => {
  // shifted so that the ring passes through the middle of the picture, whatever its size
  const points = ring(r, 10).map((v, i) => (i % 3 === 0 ? v + r : v));
  const xy = new Float64Array(97 * 2);
  const ok = new Uint8Array(97);
  const depth = new Float64Array(97);
  projectLine(view, points, 97, xy, ok, depth);
  const buffer = newRibbonBuffer();
  const wrote = writeRibbon(view, { points, count: 97, colour: [1, 0.5, 0.25], width, opacity: 0.5, dash }, { xy, ok, count: 97 }, depth, buffer);
  return { buffer, ...wrote };
};

test("a solid ribbon is one quad a segment, its real width across and its colour and opacity at every vertex", () => {
  const { buffer, quads } = drawRing(null, 4);
  assert.equal(quads, 96);
  assert.equal(buffer.used, 96 * 6);
  // across the line at the first vertex pair: 4 CSS pixels at depth 10
  const pixel = (2 * view.half * 10) / view.height;
  const across = Math.hypot(buffer.positions[0]! - buffer.positions[3]!, buffer.positions[1]! - buffer.positions[4]!);
  assert.ok(Math.abs(across - 4 * pixel) < 1e-6, `${across} ${4 * pixel}`);
  assert.deepEqual([...buffer.colours.slice(0, 4)], [1, 0.5, 0.25, 0.5]);
});

test("dashes are laid along the screen length: a dash and a gap, so about a dash in each period", () => {
  const { buffer, quads } = drawRing([6, 4], 2);
  // the ring's length on the screen
  const radiusPx = (3 / (view.half * 10)) * (view.height / 2);
  const length = 2 * Math.PI * radiusPx;
  const periods = length / 10;
  assert.ok(quads >= Math.floor(periods) && quads <= Math.ceil(periods) + 96, `${quads} for ${periods} periods`);
  // every dash on a straight stretch is 6 px long: measure the quads whose two ends lie on one segment
  const first = Math.hypot(buffer.positions[0]! - buffer.positions[9]!, buffer.positions[1]! - buffer.positions[10]!);
  const pixel = (2 * view.half * 10) / view.height;
  assert.ok(first <= 6 * pixel + 1e-6 && first > 0);
});

test("a dashed line that would take more quads than its share is drawn solid", () => {
  const { solidified, quads } = drawRing([1, 1], 1, 8);
  assert.equal(solidified, true);
  assert.ok(quads > 0 && quads <= 96, "one quad a segment that is on the picture");
});

test("a ribbon wholly off the picture draws nothing and costs no vertices", () => {
  const points = ring(3, 10).map((v, i) => (i % 3 === 0 ? v + 1000 : v));
  const xy = new Float64Array(97 * 2);
  const ok = new Uint8Array(97);
  const depth = new Float64Array(97);
  projectLine(view, points, 97, xy, ok, depth);
  const buffer = newRibbonBuffer();
  const wrote = writeRibbon(view, { points, count: 97, colour: [1, 1, 1], width: 2, opacity: 1, dash: null }, { xy, ok, count: 97 }, depth, buffer);
  assert.equal(wrote.quads, 0);
  assert.equal(buffer.used, 0);
});

test("sixteen dashed paths fit the buffer", () => {
  const buffer = newRibbonBuffer();
  const points = ring(3, 10);
  const xy = new Float64Array(97 * 2);
  const ok = new Uint8Array(97);
  const depth = new Float64Array(97);
  projectLine(view, points, 97, xy, ok, depth);
  let total = 0;
  for (let k = 0; k < 16; k += 1) total += writeRibbon(view, { points, count: 97, colour: [1, 1, 1], width: 2, opacity: 1, dash: [3, 4] }, { xy, ok, count: 97 }, depth, buffer).quads;
  assert.ok(total * 6 === buffer.used && total <= MAX_RIBBON_QUADS);
});
