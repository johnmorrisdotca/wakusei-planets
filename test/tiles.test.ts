import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/bodies/saturn.ts";
import { BODIES } from "../src/facts.ts";
import { lookOf } from "../src/scene/look.ts";
import { mapWidthOf, ringWidthOf, zoomLimit, ZOOM_CEILING, ZOOM_FLOOR } from "../src/scene/reach.ts";
import { BASE_WIDTH, chooseWindow, covers, parseManifest, texelAngle, tilePath, seenRegion, visibleRegion, windowOf, windowRect, windowTiles, TILE_SIZE, WINDOW_TILES, type Axes, type Sight, type TileLevel } from "../src/scene/tiles.ts";

const level = (n: number): TileLevel => ({ level: n, width: BASE_WIDTH * 2 ** n, height: BASE_WIDTH * 2 ** (n - 1), columns: (BASE_WIDTH * 2 ** n) / TILE_SIZE, rows: (BASE_WIDTH * 2 ** (n - 1)) / TILE_SIZE });
const levels = [1, 2, 3].map(level);
const deg = (d: number): number => (d * Math.PI) / 180;
const unit: [number, number, number] = [1, 1, 1];
/** A body with the prime meridian facing the viewer, the pole up, east to the right. */
const front: Axes = { east: [1, 0, 0], pole: [0, 1, 0], meridian: [0, 0, 1], scale: unit };
const box = (half: number, cx = 0, cy = 0) => ({ left: cx - half, right: cx + half, bottom: cy - half, top: cy + half });

test("a manifest is read level by level, and a level that does not fit the pyramid is left out", () => {
  const manifest = parseManifest({
    tileSize: 512,
    bodies: {
      mars: { levels: [level(2), level(1), { ...level(3), columns: 7 }] },
      moon: { levels: [] },
      junk: 3,
    },
  });
  assert.deepEqual(Object.keys(manifest!.bodies), ["mars"]);
  assert.deepEqual(manifest!.bodies["mars"]!.map((l) => l.level), [1, 2]);
  assert.equal(parseManifest({ tileSize: 256, bodies: {} }), undefined, "another tile size is not this loader's");
  assert.equal(parseManifest([]), undefined);
  assert.equal(parseManifest(null), undefined);
});

test("the part of the surface in view: a small box shows a small patch, the whole disc shows half the globe", () => {
  const small = visibleRegion(box(0.1), front, 0)!;
  assert.ok(Math.abs(small.lonMin + deg(5.7)) < deg(1) && Math.abs(small.lonMax - deg(5.7)) < deg(1), `${small.lonMin} ${small.lonMax}`);
  assert.ok(Math.abs(small.latMax - deg(5.7)) < deg(1) && Math.abs(small.latMin + deg(5.7)) < deg(1));
  const whole = visibleRegion(box(1.2), front, 0)!;
  assert.ok(whole.lonMax - whole.lonMin > deg(170) && whole.lonMax - whole.lonMin < deg(185), "half a turn of longitude");
  assert.ok(whole.latMax > deg(85) && whole.latMin < -deg(85));
  assert.equal(visibleRegion(box(0.1, 5, 5), front), undefined, "a box off the disc shows none of it");
  const padded = visibleRegion(box(0.1), front)!;
  assert.ok(padded.lonMax - padded.lonMin > small.lonMax - small.lonMin, "a margin is added");
});

test("a pole in the box means every longitude, and a box across the antimeridian is one stretch of longitude", () => {
  const polar = visibleRegion(box(0.3), { east: [1, 0, 0], pole: [0, 0, 1], meridian: [0, -1, 0], scale: unit }, 0)!;
  assert.ok(polar.lonMax - polar.lonMin >= 2 * Math.PI - 1e-9, "the whole turn");
  assert.ok(Math.abs(polar.latMax - Math.PI / 2) < 1e-9, "up to the pole");
  const behind = visibleRegion(box(0.1), { east: [-1, 0, 0], pole: [0, 1, 0], meridian: [0, 0, -1], scale: unit }, 0)!;
  const middle = (behind.lonMin + behind.lonMax) / 2;
  assert.ok(Math.abs(Math.abs(middle) - Math.PI) < deg(1), `centred on 180: ${middle}`);
  assert.ok(behind.lonMax - behind.lonMin < deg(15), "a small box is a small stretch, not 360");
});

test("a window is whole tiles of one level, wrapping at the antimeridian, and is refused when it would be too many", () => {
  const l1 = level(1);
  const across = windowOf(l1, { lonMin: deg(170), lonMax: deg(190), latMin: deg(-10), latMax: deg(10) })!;
  assert.deepEqual([across.col0, across.cols], [7, 2], "the last column and the first");
  assert.deepEqual(windowTiles(across).slice(0, 2).map((t) => t.col), [7, 0]);
  assert.equal(windowTiles(across).length, across.cols * across.rows);
  assert.deepEqual(windowTiles(across)[1]!.x, TILE_SIZE);
  assert.equal(windowOf(level(3), { lonMin: -deg(90), lonMax: deg(90), latMin: -deg(40), latMax: deg(40) }), undefined, "180 degrees at level 3 is far too many tiles");
  const pole = windowOf(l1, { lonMin: -Math.PI, lonMax: Math.PI, latMin: deg(60), latMax: Math.PI / 2 })!;
  assert.ok(pole.cols === 8 && pole.row0 === 0 && pole.cols * pole.rows <= WINDOW_TILES, "a polar cap is the whole row of columns");
  const rect = windowRect(across);
  assert.ok(Math.abs(rect.du - 2 / 8) < 1e-12 && rect.u0 === 7 / 8 && rect.vTop <= 1 && rect.dv > 0);
  assert.equal(tilePath("mars", { level: 3, col: 12, row: 5 }), "mars/3/12/5");
});

test("the level follows the zoom: none while the 2048 picture is sharp, finer as the disc grows, never past what fits", () => {
  const patch = (half: number) => visibleRegion(box(half), front)!;
  assert.equal(chooseWindow(patch(1.1), levels, 300), undefined, "a small disc: the package's own picture is sharp");
  assert.equal(chooseWindow(patch(0.1), levels, 400), undefined, "326 texels a radian at a quarter of slack: 407 device pixels a radian or less is sharp");
  const l1 = chooseWindow(patch(0.5), levels, 600)!;
  assert.equal(l1.level, 1);
  const l2 = chooseWindow(patch(0.2), levels, 1100)!;
  assert.equal(l2.level, 2);
  const l3 = chooseWindow(patch(0.05), levels, 4000)!;
  assert.equal(l3.level, 3, "the finest there is when the zoom wants more than it has");
  assert.ok(l3.cols * l3.rows <= WINDOW_TILES);
  // a view that wants level 3 over a wide patch gets the finest level whose window fits
  const wide = chooseWindow(patch(0.5), levels, 4000);
  assert.ok(wide === undefined || wide.level < 3);
  assert.equal(chooseWindow(patch(0.1), [], 4000), undefined);
  assert.equal(chooseWindow(patch(0.1), levels, 0), undefined);
});

test("a window covers the view while it lies inside it, and not once it has moved out", () => {
  const view = visibleRegion(box(0.08), front, 0)!;
  const window = chooseWindow(visibleRegion(box(0.08), front)!, levels, 2500)!;
  assert.ok(covers(window, view));
  const moved = visibleRegion(box(0.08, 0.7, 0.3), front, 0)!;
  assert.equal(covers(window, moved), false);
  const across = windowOf(level(1), { lonMin: deg(170), lonMax: deg(190), latMin: deg(-10), latMax: deg(10) })!;
  assert.ok(covers(across, { lonMin: deg(175), lonMax: deg(185), latMin: 0, latMax: deg(5) }));
  assert.ok(covers(across, { lonMin: -deg(185), lonMax: -deg(175), latMin: 0, latMax: deg(5) }), "the same place a turn away");
  assert.equal(covers(across, { lonMin: deg(100), lonMax: deg(110), latMin: 0, latMax: deg(5) }), false);
  assert.equal(texelAngle(2048).toFixed(5), (Math.PI / 1024).toFixed(5));
});

test("the zoom limit grows with the finest map and with the picture's reach, and never drops under what the shaded looks always had", () => {
  assert.equal(zoomLimit(2.2, 0, false), ZOOM_FLOOR);
  const alone = zoomLimit(2.2, 2048, false);
  const moons = zoomLimit(6, 2048, false);
  assert.ok(alone >= ZOOM_FLOOR && moons > alone, `${alone} ${moons}`);
  assert.ok(zoomLimit(2.2, 2048, true) > alone, "a soft body is carried further by the generic detail");
  assert.ok(zoomLimit(2.2, 16384, false) > 6 * alone / 2, "finer tiles take a body much further");
  assert.equal(zoomLimit(100, 16384, true), ZOOM_CEILING);
  assert.equal(mapWidthOf(undefined, true, undefined), 4096, "a body drawn by its shader alone");
  assert.equal(mapWidthOf({ id: "mars", surface: "", painted: { map: "mars", widths: [512, 1024, 2048] } }, true, levels), 8192 * 2);
  assert.equal(mapWidthOf({ id: "mars", surface: "", painted: { map: "mars", widths: [512, 1024, 2048] } }, true, undefined), 2048);
  assert.equal(mapWidthOf({ id: "mars", surface: "", painted: { map: "mars", widths: [512, 1024, 2048] } }, false, levels), 4096, "the illustrated look has no map");
});

test("Saturn goes as far as its rings' detail does, which is further than its globe's", () => {
  const saturn = lookOf("saturn")!;
  const rings = ringWidthOf(saturn, BODIES.saturn.radiusKm);
  assert.ok(rings > 10_000 && rings < 14_000, `a strip of 2048 samples across 62,000 km is a 12,000 texel equator: ${rings}`);
  assert.equal(ringWidthOf(undefined, 1), 0);
  assert.equal(ringWidthOf({ id: "mars", surface: "" }, 3389), 0, "a body with no picture of rings");
  const globe = zoomLimit(2.2, 2048, true);
  const withRings = zoomLimit(2.2, 2048, true, rings);
  assert.ok(withRings > 3 * globe, `${withRings} against ${globe}`);
});

// --- a camera of any kind (the portrait's orthographic one, the space view's perspective one) ---------------------------------------------------------------------------------------------------
/** An orthographic camera looking down -z from z = 10, `half` high (units), `aspect` wide to high, in a view `height` pixels high. */
const ortho = (half: number, height = 400, aspect = 1): Sight => ({
  eye: null,
  forward: [0, 0, -1],
  width: height * aspect,
  height,
  ray: (x, y) => ({ origin: [x * half * aspect, y * half, 10], direction: [0, 0, -1] }),
  project: (p) => (p[2] >= 10 ? undefined : { x: p[0] / (half * aspect), y: p[1] / half }),
});
/** A pinhole camera at `eye` looking down -z with a vertical field of view of `fov` degrees, in a view `height` pixels high. */
const pinhole = (eye: [number, number, number], fov = 35, height = 420, aspect = 1): Sight => {
  const t = Math.tan((fov / 2) * (Math.PI / 180));
  return {
    eye,
    forward: [0, 0, -1],
    width: height * aspect,
    height,
    ray: (x, y) => {
      const d: [number, number, number] = [x * t * aspect, y * t, -1];
      const l = Math.hypot(...d);
      return { origin: eye, direction: [d[0] / l, d[1] / l, d[2] / l] };
    },
    project: (p) => {
      const depth = eye[2] - p[2];
      return depth <= 0 ? undefined : { x: (p[0] - eye[0]) / (depth * t * aspect), y: (p[1] - eye[1]) / (depth * t) };
    },
  };
};
const at = (centre: [number, number, number], radius = 1, axes: Axes = front) => ({ centre, radius, axes });

test("an orthographic camera sees the same patch as the box it replaces", () => {
  const seen = seenRegion(ortho(0.1), at([0, 0, 0]), 0)!;
  const old = visibleRegion(box(0.1), front, 0)!;
  for (const key of ["lonMin", "lonMax", "latMin", "latMax"] as const) assert.ok(Math.abs(seen.inside[key] - old[key]) < deg(1), `${key}: ${seen.inside[key]} against ${old[key]}`);
  assert.equal(seenRegion(ortho(0.1), at([5, 5, 0])), undefined, "a body out of the view is not seen");
  // 400 pixels for 0.2 units across: 2000 pixels along a radius of the body, so along a radian
  assert.ok(Math.abs(seen.radiansPixels - 2000) < 20, String(seen.radiansPixels));
  const padded = seenRegion(ortho(0.1), at([0, 0, 0]))!;
  assert.ok(padded.region.lonMax - padded.region.lonMin > padded.inside.lonMax - padded.inside.lonMin, "the margin is added");
});

test("a perspective camera near a body sees a small patch of it, and the finest pixels run along the nearest point", () => {
  const near = seenRegion(pinhole([0, 0, 1.05]), at([0, 0, 0]), 0)!;
  // 0.05 radii up with a 35 degree view: 0.05 * tan(17.5 degrees) = 0.016 radii each side of the middle, about 1.8 degrees of longitude across
  assert.ok(near.inside.lonMax - near.inside.lonMin < deg(2.5) && near.inside.lonMax - near.inside.lonMin > deg(1.3), `${near.inside.lonMax - near.inside.lonMin}`);
  assert.ok(Math.abs(near.inside.lonMin + near.inside.lonMax) < deg(0.5) && Math.abs(near.inside.latMin + near.inside.latMax) < deg(0.5), "centred on the body's front");
  // the focal length in pixels is 210 / tan(17.5 degrees) = 666; the nearest point is 0.05 radii away
  assert.ok(Math.abs(near.radiansPixels / ((210 / Math.tan((17.5 * Math.PI) / 180)) / 0.05) - 1) < 0.05, String(near.radiansPixels));
  const far = seenRegion(pinhole([0, 0, 3.4]), at([0, 0, 0]), 0)!;
  assert.ok(far.inside.lonMax - far.inside.lonMin > deg(120), "from three and a half radii most of the near side is in view");
  assert.ok(far.radiansPixels < near.radiansPixels / 20);
  assert.equal(seenRegion(pinhole([0, 0, 0.9]), at([0, 0, 0])), undefined, "a camera inside the body sees none of its surface");
  assert.equal(seenRegion(pinhole([0, 0, 3.4]), at([60, 0, 0])), undefined, "a body far off to one side is not in the view");
});

test("a body that is turned, off-centre or flattened is seen at the longitudes and latitudes it really shows", () => {
  // the prime meridian turned 90 degrees east: the middle of the view is at longitude -90 (east is to the right, so the meridian is on the left)
  const turned = seenRegion(pinhole([0, 0, 1.2]), at([0, 0, 0], 1, { east: [0, 0, 1], pole: [0, 1, 0], meridian: [-1, 0, 0], scale: unit }), 0)!;
  const middle = (turned.inside.lonMin + turned.inside.lonMax) / 2;
  assert.ok(Math.abs(middle - deg(90)) < deg(1), `${middle}`);
  // a body to the right of the middle: its patch is the one facing the camera's sight line, not its front
  const side = seenRegion(pinhole([0, 0, 3]), at([0.9, 0, 0]), 0)!;
  assert.ok(side.inside.lonMax > side.inside.lonMin, "the near side is in view");
  // looking straight down the pole: every longitude
  const polar = seenRegion(pinhole([0, 0, 1.3]), at([0, 0, 0], 1, { east: [1, 0, 0], pole: [0, 0, 1], meridian: [0, -1, 0], scale: unit }), 0)!;
  assert.ok(polar.inside.lonMax - polar.inside.lonMin >= 2 * Math.PI - 1e-9, "the whole turn");
  assert.ok(Math.abs(polar.inside.latMax - Math.PI / 2) < 1e-9, "up to the pole");
  // a flattened body: the polar radius is shorter, so the pole is nearer the camera's middle than a sphere's would be: it still shows its pole
  const flat = seenRegion(pinhole([0, 0, 1.3]), at([0, 0, 0], 1, { east: [1, 0, 0], pole: [0, 0, 1], meridian: [0, -1, 0], scale: [1, 0.9, 1] }), 0)!;
  assert.ok(Math.abs(flat.inside.latMax - Math.PI / 2) < 1e-9);
});

test("the window a camera needs: the finest level near the surface, none from far away", () => {
  const near = seenRegion(pinhole([0, 0, 1.05]), at([0, 0, 0]))!;
  const window = chooseWindow(near.region, levels, near.radiansPixels)!;
  assert.equal(window.level, 3, "13,000 pixels along a radian wants the finest level the body has");
  assert.ok(window.cols * window.rows <= WINDOW_TILES);
  const far = seenRegion(pinhole([0, 0, 3.4]), at([0, 0, 0]))!;
  assert.equal(chooseWindow(far.region, levels, far.radiansPixels), undefined, "from afar the body's own picture is sharp enough");
});
