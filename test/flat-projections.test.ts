// Map projections for the painted maps: every projection round-trips, the shapes and the poles are right, the graticule is cut where it has to be, and the resampler wraps across the seam and holds at the poles.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { PROJECTED_BODIES } from "../demo/flat-projections.ts";
import { MERCATOR_LIMIT, PROJECTIONS, fitMap, graticule, isProjection, mapExtent, mapOutline, mapPixels, mapSun, projectMap, resampleMap, unprojectMap, type ProjectionId } from "../src/flat/index.ts";

const near = (a: number, b: number, eps: number, what: string): void => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not within ${eps} of ${b}`);
const lonDiff = (a: number, b: number): number => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

test("the demo offers a projection for every painted surface map served by Pages", () => {
  const maps = readdirSync(new URL("../textures/", import.meta.url))
    .filter((file) => file.endsWith("-1024.webp") && file !== "sun-1024.webp")
    .map((file) => file.slice(0, -"-1024.webp".length));
  assert.deepEqual([...PROJECTED_BODIES].sort(), maps.sort());
});

test("every projection takes a place out and back again, about any centre", () => {
  for (const id of PROJECTIONS) {
    for (const centre of [{ lon: 0, lat: 0 }, { lon: 137, lat: 0 }, { lon: -60, lat: 35 }]) {
      for (let lat = -80; lat <= 80; lat += 20) {
        for (let lon = -170; lon <= 170; lon += 20) {
          if (id !== "azimuthal" && centre.lat !== 0) continue;
          const p = projectMap(id, lon, lat, centre);
          const back = unprojectMap(id, p.x, p.y, centre);
          assert.ok(back, `${id} ${lon},${lat} is on the map`);
          near(back.lat, lat, 1e-6, `${id} lat`);
          assert.ok(lonDiff(back.lon, lon) < 1e-6, `${id} lon ${back.lon} vs ${lon}`);
        }
      }
    }
  }
});

test("the middle is the middle, and the equator and the prime meridian are straight where they should be", () => {
  for (const id of PROJECTIONS) {
    const middle = projectMap(id, 20, 0, { lon: 20, lat: 0 });
    near(middle.x, 0, 1e-12, `${id} x`);
    near(middle.y, 0, 1e-12, `${id} y`);
    assert.equal(projectMap(id, 100, 0).y, 0, `${id}: the equator is at y 0`);
  }
  near(projectMap("equirectangular", 90, 45).x, Math.PI / 2, 1e-12, "a quarter turn is a quarter of the width");
  near(projectMap("sinusoidal", 90, 60).x, (Math.PI / 2) * 0.5, 1e-12, "a parallel keeps its true length: cos 60");
  near(projectMap("mollweide", 179.999999, 0).x, 2 * Math.SQRT2, 1e-5, "Mollweide is twice as wide as tall at the equator");
  near(projectMap("azimuthal", 90, 0).x, Math.PI / 2, 1e-12, "a quarter turn is a quarter of the way to the rim");
});

test("the seam: a place just across it lands at the far edge, the short way round", () => {
  const view = { lon: 170, lat: 0 };
  const east = projectMap("equirectangular", -175, 0, view);
  near(east.x, (15 * Math.PI) / 180, 1e-12, "15 degrees east of the middle, over the picture's seam");
  assert.ok(projectMap("mollweide", -179.9, 10, { lon: 179.9, lat: 0 }).x > 0);
});

test("the poles: Mercator holds at its limit, the sinusoidal and Mollweide maps make a point of them, the disc puts them where they belong", () => {
  near(MERCATOR_LIMIT, 85.0511287798, 1e-6, "Mercator's limit");
  const top = projectMap("mercator", 0, 90);
  near(top.y, Math.PI, 1e-9, "a pole is held at the top edge, not at infinity");
  assert.ok(Number.isFinite(projectMap("mercator", 30, -90).y));
  for (const id of ["sinusoidal", "mollweide"] as const) {
    near(projectMap(id, 120, 90).x, 0, 1e-12, `${id}: every longitude is the one point at the north pole`);
    near(projectMap(id, -77, -90).x, 0, 1e-12, `${id}: and at the south`);
    assert.equal(projectMap(id, 0, 90).y, mapExtent(id).halfHeight, `${id}: the pole is the top of the map`);
  }
  const pole = { lon: 0, lat: 90 };
  near(projectMap("azimuthal", 33, 90, pole).x, 0, 1e-12, "the pole is the middle of a polar disc");
  near(Math.hypot(projectMap("azimuthal", 33, 0, pole).x, projectMap("azimuthal", 33, 0, pole).y), Math.PI / 2, 1e-12, "the equator is half way to the rim");
  const south = projectMap("azimuthal", 0, -90, pole);
  near(Math.hypot(south.x, south.y), Math.PI, 1e-12, "the opposite pole is on the rim");
  near(Math.hypot(projectMap("azimuthal", 10, -90, { lon: 10, lat: 0 }).x, projectMap("azimuthal", 10, -90, { lon: 10, lat: 0 }).y), Math.PI / 2, 1e-12, "and a pole seen from the equator is a quarter of the way");
  // the Mollweide angle at a latitude close to a pole still solves
  for (const lat of [89, 89.9, 89.999, 89.999999]) {
    const p = projectMap("mollweide", 45, lat);
    const back = unprojectMap("mollweide", p.x, p.y)!;
    near(back.lat, lat, 1e-4, `Mollweide ${lat}`);
  }
});

test("outside the shape there is no place: beyond the leaf, the ellipse, the disc and the box", () => {
  assert.equal(unprojectMap("sinusoidal", 3.0, 1.5), null, "beyond the leaf near the pole");
  assert.equal(unprojectMap("mollweide", 2.8, 1.3), null, "beyond the ellipse's corner");
  assert.equal(unprojectMap("azimuthal", 3, 2), null, "beyond the rim");
  assert.equal(unprojectMap("equirectangular", 0, 1.6), null);
  assert.equal(unprojectMap("mercator", 0, 3.2), null);
  assert.equal(unprojectMap("sinusoidal", 0.5, Math.PI / 2), null, "the pole is a point");
  assert.ok(unprojectMap("sinusoidal", 0, Math.PI / 2), "and the point is on the map");
  assert.equal(unprojectMap("mollweide", Number.NaN, 0), null);
  assert.ok(unprojectMap("equirectangular", 0, 0));
});

test("equal area: the sinusoidal and Mollweide maps cover the same share of the sphere with the same area", () => {
  // the leaf and the ellipse both have the area of 4 pi, the sphere's, in radii squared; counted by a grid of points inside the outline
  for (const id of ["sinusoidal", "mollweide"] as const) {
    const { halfWidth, halfHeight } = mapExtent(id);
    const n = 600;
    let inside = 0;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (unprojectMap(id, -halfWidth + ((i + 0.5) / n) * 2 * halfWidth, -halfHeight + ((j + 0.5) / n) * 2 * halfHeight)) inside += 1;
    near((inside / (n * n)) * 4 * halfWidth * halfHeight, 4 * Math.PI, 0.05, `${id} area`);
  }
});

test("a projection that is not one is refused", () => {
  assert.ok(isProjection("mollweide"));
  assert.equal(isProjection("robinson"), false);
  assert.equal(isProjection(3), false);
});

test("the graticule: meridians and parallels at the step, the equator always, the seam drawn at both edges, and no line across the map", () => {
  for (const id of PROJECTIONS) {
    const lines = graticule(id, 30);
    assert.ok(lines.some((l) => l.kind === "parallel" && l.value === 0), `${id} has the equator`);
    assert.ok(lines.some((l) => l.kind === "meridian" && l.value === 0), `${id} has the prime meridian`);
    const { halfWidth, halfHeight } = mapExtent(id);
    for (const line of lines)
      for (const piece of line.lines)
        for (const p of piece) {
          assert.ok(Math.abs(p.x) <= halfWidth + 1e-9 && Math.abs(p.y) <= halfHeight + 1e-9, `${id} ${line.kind} ${line.value} stays in the box`);
          if (id !== "equirectangular" && id !== "mercator") assert.ok(unprojectMap(id, p.x * (1 - 1e-9), p.y * (1 - 1e-9)) !== null, `${id} ${line.kind} ${line.value} stays on the map`);
        }
  }
  const flat = graticule("equirectangular", 30);
  assert.equal(flat.filter((l) => l.kind === "meridian").length, 13, "from -180 to 180 every 30 degrees, the seam at both edges");
  assert.equal(flat.filter((l) => l.kind === "parallel").length, 5, "the equator and 30 and 60 north and south, not the poles");
  assert.equal(flat.find((l) => l.kind === "meridian" && l.value === 0)!.lines.length, 1, "a meridian is one line");
  assert.equal(graticule("mercator", 30).every((l) => l.lines.flat().every((p) => Math.abs(p.y) <= Math.PI + 1e-9)), true, "Mercator stops at its limit");
  const mercator = graticule("mercator", 15).filter((l) => l.kind === "parallel").map((l) => l.value);
  assert.ok(!mercator.includes(90) && !mercator.includes(-90) && mercator.includes(75) && mercator.includes(-75));
  // a step that does not divide 90 still has the equator
  assert.ok(graticule("mollweide", 40).some((l) => l.kind === "parallel" && l.value === 0));
});

test("the graticule is turned with the centre: the meridians run from the left edge to the right whatever the middle is", () => {
  assert.equal(graticule("mollweide", 30, { lon: 100, lat: 0 }).filter((l) => l.kind === "meridian").length, 12, "an edge that is not a multiple of the step has no line");
  const lines = graticule("mollweide", 30, { lon: 90, lat: 0 });
  assert.equal(lines.filter((l) => l.kind === "meridian").length, 13);
  const west = lines.find((l) => l.kind === "meridian" && Math.min(...l.lines[0]!.map((p) => p.x)) < -2.7);
  assert.ok(west, "one meridian is at the left edge");
  assert.equal(Math.round(Math.abs(lonDiff(west.value, 90))), 180, "the one 180 degrees from the middle");
});

test("on the disc a line is cut where it reaches the rim, so none crosses the map", () => {
  const lines = graticule("azimuthal", 30, { lon: 0, lat: 90 });
  for (const line of lines) for (const piece of line.lines) for (let i = 1; i < piece.length; i += 1) assert.ok(Math.hypot(piece[i]!.x - piece[i - 1]!.x, piece[i]!.y - piece[i - 1]!.y) <= 0.25, `${line.kind} ${line.value} does not jump`);
  const equatorFromTheEquator = graticule("azimuthal", 30, { lon: 0, lat: 0 }).find((l) => l.kind === "parallel" && l.value === 0)!;
  assert.ok(equatorFromTheEquator.lines.length >= 1);
  // a meridian from a polar centre is a straight spoke
  const spoke = lines.find((l) => l.kind === "meridian" && l.value === 90)!;
  assert.ok(spoke.lines.length >= 1);
  for (const p of spoke.lines[0]!) near(p.y, 0, 1e-9, "the 90 degree meridian from the pole's centre lies along an axis");
});

test("the outline is closed and sits on the map's edge", () => {
  for (const id of PROJECTIONS) {
    const edge = mapOutline(id);
    assert.deepEqual(edge[0], edge[edge.length - 1], `${id} is closed`);
    const { halfWidth, halfHeight } = mapExtent(id);
    for (const p of edge) assert.ok(Math.abs(p.x) <= halfWidth + 1e-9 && Math.abs(p.y) <= halfHeight + 1e-9);
  }
  const rim = mapOutline("azimuthal");
  for (const p of rim) near(Math.hypot(p.x, p.y), Math.PI, 1e-9, "on the rim");
});

test("fitting a map in a box: the whole shows, the middle is the box's, and the pixels are the right way up", () => {
  for (const id of PROJECTIONS) {
    const fit = fitMap(id, 800, 400);
    const { halfWidth, halfHeight } = mapExtent(id);
    assert.ok(halfWidth * fit.scale * 2 <= 800 && halfHeight * fit.scale * 2 <= 400, `${id} fits`);
    assert.equal(fit.cx, 400);
  }
  const fit = fitMap("equirectangular", 720, 368);
  const north = mapPixels(fit, projectMap("equirectangular", 0, 60));
  assert.ok(north.y < 184, "north is up");
  assert.equal(fitMap("mollweide", 2, 2).scale, 0, "a box with no room has no map");
  assert.equal(fitMap("mollweide", 800, 400, 3).scale, fitMap("mollweide", 800, 400).scale * 3);
});

test("the Sun's mark is where the body's own pole and spin put it, on any projection", () => {
  const when = Date.UTC(1969, 6, 20, 20, 17, 40);
  const flat = mapSun("equirectangular", "moon", when);
  assert.ok(flat.lon >= -180 && flat.lon < 180 && Math.abs(flat.lat) < 2, "the Moon's Sun is within a degree and a half of its equator");
  near(flat.x, (flat.lon * Math.PI) / 180, 1e-12, "x");
  const moll = mapSun("mollweide", "moon", when);
  assert.equal(moll.lon, flat.lon);
  for (const body of ["mars", "mercury", "ceres", "io", "titan", "pluto", "earth", "jupiter"] as const) {
    const sun = mapSun("sinusoidal", body, when);
    assert.ok(Number.isFinite(sun.x) && Number.isFinite(sun.y) && Math.abs(sun.lat) <= 90, body);
  }
});

function checker(w: number, h: number): { width: number; height: number; data: Uint8ClampedArray } {
  // a picture whose red grows to the east, green to the south, blue is the half it is in
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4;
      data[o] = (255 * x) / (w - 1);
      data[o + 1] = (255 * y) / (h - 1);
      data[o + 2] = x < w / 2 ? 0 : 255;
      data[o + 3] = 255;
    }
  return { width: w, height: h, data };
}

test("resampling: the same projection gives the picture back, the corners of the other shapes are empty, the middle is the middle", () => {
  const source = checker(64, 32);
  const same = resampleMap(source, "equirectangular", 128, 64);
  assert.equal(same.length, 128 * 64 * 4);
  // fitted with a 4 pixel margin, so the middle of the answer is the middle of the picture
  const mid = (32 * 128 + 64) * 4;
  near(same[mid]!, 128, 8, "red is half way in the middle");
  near(same[mid + 1]!, 128, 8, "green too");
  const moll = resampleMap(source, "mollweide", 200, 100);
  assert.equal(moll[3], 0, "the corner of a Mollweide box is empty");
  assert.equal(moll[(99 * 200 + 199) * 4 + 3], 0);
  assert.equal(moll[(50 * 200 + 100) * 4 + 3], 255, "the middle is drawn");
  const disc = resampleMap(source, "azimuthal", 100, 100);
  assert.equal(disc[3], 0);
  assert.equal(disc[(50 * 100 + 50) * 4 + 3], 255);
});

test("resampling wraps across the seam and holds at the poles", () => {
  // a picture one pixel tall and four wide: the colours only change with longitude, so the seam is where the last pixel meets the first
  const strip = { width: 4, height: 1, data: [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255] };
  // centred on the seam: the middle of the map shows -180/180, blending the last pixel (yellow) into the first (red)
  const out = resampleMap(strip, "equirectangular", 80, 40, { centre: { lon: 180, lat: 0 } });
  const o = (20 * 80 + 40) * 4;
  assert.ok(out[o]! > 200, "red stays strong across the seam");
  assert.ok(out[o + 1]! > 100 && out[o + 1]! < 160, "and green is half way from yellow to red");
  const left = (20 * 80 + 39) * 4;
  assert.ok(out[left + 1]! > 100 && out[left + 1]! < 170, "the pixel just before the seam blends the last pixel into the first, it is not held yellow");
  // the same strip at the poles: a row is read the same all the way up
  const tall = { width: 2, height: 2, data: [10, 20, 30, 255, 10, 20, 30, 255, 200, 100, 50, 255, 200, 100, 50, 255] };
  const pole = resampleMap(tall, "mollweide", 160, 80);
  const top = (6 * 160 + 80) * 4;
  assert.equal(pole[top + 3], 255);
  near(pole[top]!, 10, 1, "north of the top row of pixels holds the top row");
  assert.deepEqual([...resampleMap({ width: 0, height: 0, data: [] }, "mollweide", 4, 4)], new Array(64).fill(0), "an empty picture gives an empty map");
  assert.equal(resampleMap(tall, "mercator", 0, 0).length, 0);
});

test("a map turned about its centre shows the other side of the body", () => {
  const source = checker(64, 32);
  const a = resampleMap(source, "mollweide", 100, 50, { centre: { lon: 0, lat: 0 } });
  const b = resampleMap(source, "mollweide", 100, 50, { centre: { lon: 90, lat: 0 } });
  assert.notDeepEqual([...a.slice(0, 2000)], [...b.slice(0, 2000)]);
  const id: ProjectionId = "mollweide";
  assert.equal(unprojectMap(id, 0, 0, { lon: 90, lat: 0 })!.lon, 90);
});
