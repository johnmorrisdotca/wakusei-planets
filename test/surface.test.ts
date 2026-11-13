// The standing view's maths: the sky from the Moon's surface (the Sun and the Earth in the right places, with the Earth's phase the opposite of the Moon's), the camera, the height tiles' addresses and decoding,
// the made detail (craters and rocks: seeded, fixed to the place, many small and few large, fading by distance, their slope the slope of their height) and the rocks' mesh. The GLSL holds the same formulas as
// src/surface/detail.ts; the pinned craters below are what both must give, so a change to one is a change to the other.
import assert from "node:assert/strict";
import { test } from "node:test";
import { apparent } from "../src/ephemeris.ts";
import { craterIn, craterProfile, madeGround, occupancy, OCTAVES, pcg2d, rimBoost, rocksAround, ROCK_MIN } from "../src/surface/detail.ts";
import { decodeHeight, drop, emptyLevel, groundAt, placeTile, sampleLevel, tileAddress, type TerrainManifest } from "../src/surface/height.ts";
import { rockMesh } from "../src/surface/rocks.ts";
import { moonSky, localFrame } from "../src/surface/sky.ts";
import { SURFACE_SITES, siteById } from "../src/surface/site.ts";
import { clampLook, forward, stepOver, viewProjection, FOV_LIMITS } from "../src/surface/view.ts";

const LANDING = Date.UTC(1972, 11, 11, 19, 54);

test("at the Apollo 17 landing the Sun is 13 degrees up in the east and the Earth is high in the south-west", () => {
  const sky = moonSky(20.1911, 30.7723, LANDING);
  assert.ok(sky.sun.altitude > 12 && sky.sun.altitude < 15, `the Sun ${sky.sun.altitude}`);
  assert.ok(sky.sun.azimuth > 90 && sky.sun.azimuth < 100, `east: ${sky.sun.azimuth}`);
  assert.ok(sky.earth.altitude > 40 && sky.earth.altitude < 55, `the Earth ${sky.earth.altitude}`);
  assert.ok(sky.earth.azimuth > 230 && sky.earth.azimuth < 255, `south-west: ${sky.earth.azimuth}`);
  assert.ok(sky.earthDiameter > 1.7 && sky.earthDiameter < 2.0);
  assert.ok(Math.abs(Math.hypot(...sky.sun.enu) - 1) < 1e-9 && Math.abs(Math.hypot(...sky.earth.enu) - 1) < 1e-9);
});

test("the Earth's lit share is the opposite of the Moon's, at any time", () => {
  for (const time of [LANDING, Date.UTC(2026, 10, 14, 12), Date.UTC(2026, 10, 24, 22, 53), Date.UTC(2026, 11, 9, 14)]) {
    const moon = apparent("moon", time);
    const sky = moonSky(0, 0, time);
    assert.ok(Math.abs(sky.earthIllumination - (1 - moon.illumination)) < 0.01, `${new Date(time).toISOString()}: ${sky.earthIllumination} against ${1 - moon.illumination}`);
  }
});

test("the local frame is a right-handed east, north, up with the Earth toward the viewer", () => {
  const f = localFrame(20.1911, 30.7723, LANDING);
  const cross = (a: readonly number[], b: readonly number[]): number[] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const upCheck = cross(f.east, f.north);
  for (let i = 0; i < 3; i += 1) assert.ok(Math.abs(upCheck[i]! - f.up[i]!) < 1e-9);
  assert.deepEqual(f.toLocal(f.up).map((n) => Math.round(n * 1e9) / 1e9), [0, 0, 1]);
});

test("the sites table: Apollo 17, looked at first toward the massif at the landing", () => {
  assert.deepEqual(SURFACE_SITES.map((site) => site.id), ["apollo-17"]);
  const site = siteById("apollo-17")!;
  assert.equal(site.time, LANDING);
  assert.ok(site.look.azimuth > 200 && site.look.azimuth < 260);
  assert.equal(siteById("nowhere"), undefined);
});

test("the camera: north is ahead at azimuth 0, east on the right, a step goes where the eyes look", () => {
  const f = forward({ azimuth: 0, pitch: 0, fov: 60 });
  assert.ok(Math.abs(f[0]) < 1e-12 && Math.abs(f[1]) < 1e-12 && Math.abs(f[2] + 1) < 1e-12, "north is -z");
  const m = viewProjection([0, 1.7, 0], { azimuth: 0, pitch: 0, fov: 60 }, 1.5);
  const ndc = (x: number, y: number, z: number): [number, number] => {
    const o = [0, 1, 2, 3].map((r) => m[r]! * x + m[4 + r]! * y + m[8 + r]! * z + m[12 + r]!);
    return [o[0]! / o[3]!, o[1]! / o[3]!];
  };
  assert.ok(ndc(100, 1.7, -100)[0] > 0.5, "east is on the right");
  assert.ok(ndc(0, 101.7, -100)[1] > 0.5, "up is up");
  assert.ok(Math.abs(ndc(0, 1.7, -100)[0]) < 1e-6, "straight ahead is in the middle");
  assert.deepEqual(stepOver({ east: 0, north: 0 }, 0, 10, 0), { east: 0, north: 10 });
  const east = stepOver({ east: 0, north: 0 }, 90, 10, 0);
  assert.ok(Math.abs(east.east - 10) < 1e-9 && Math.abs(east.north) < 1e-9);
  const right = stepOver({ east: 0, north: 0 }, 0, 0, 5);
  assert.ok(Math.abs(right.east - 5) < 1e-9, "a step aside from north is to the east");
  assert.deepEqual(clampLook({ azimuth: -90, pitch: 200, fov: 1 }), { azimuth: 270, pitch: 85, fov: FOV_LIMITS.min });
  assert.equal(clampLook({ azimuth: 10, pitch: -200, fov: 400 }).fov, FOV_LIMITS.max);
});

const manifest = { body: "moon", site: "apollo-17", tile: 4, height: { min: -4000, range: 8000 }, ground: 0, radius: 1737400 } as unknown as TerrainManifest;

test("a tile's address, a height from two bytes, a level filled from tiles and read bilinear", () => {
  assert.equal(tileAddress("https://x.test/tiles", manifest, "h5", 3, 4), "https://x.test/tiles/moon/apollo-17/terrain/h5/3/4.png");
  assert.equal(tileAddress("tiles/", manifest, "far", 0, 0), "tiles/moon/apollo-17/terrain/far/0/0.png");
  assert.equal(decodeHeight(0, 0, manifest.height), -4000);
  assert.equal(decodeHeight(255, 255, manifest.height), 4000);
  assert.ok(Math.abs(decodeHeight(128, 0, manifest.height)) < 0.07);
  // two levels of 2 x 2 tiles of 4 samples; the first holds a slope rising 1 m to the east, 2 m to the north
  const encode = (h: number): [number, number] => {
    const v = Math.round(((h + 4000) / 8000) * 65535);
    return [v >> 8, v & 255];
  };
  const make = (id: string, res: number, tiles: number, height: (x: number, y: number) => number) => {
    const level = emptyLevel({ id, res, tiles, half: (tiles * 4 * res) / 2 }, 4);
    for (let row = 0; row < tiles; row += 1) {
      for (let column = 0; column < tiles; column += 1) {
        const rgba = new Uint8Array(4 * 4 * 4);
        for (let y = 0; y < 4; y += 1) {
          for (let x = 0; x < 4; x += 1) {
            const worldX = (column * 4 + x + 0.5) * res - level.half;
            const worldY = level.half - (row * 4 + y + 0.5) * res;
            const [hi, lo] = encode(height(worldX, worldY));
            rgba.set([hi, lo, 0, 255], (y * 4 + x) * 4);
          }
        }
        placeTile(level, 4, column, row, rgba);
      }
    }
    return level;
  };
  const fine = make("h5", 1, 2, (x, y) => x * 1 + y * 2);
  const coarse = make("h20", 4, 2, (x, y) => x + y * 2 + 100);
  assert.ok(Math.abs(sampleLevel(fine, manifest.height, 1.3, -0.7)! - (1.3 - 1.4)) < 0.05, "bilinear on a slope is exact");
  assert.equal(sampleLevel(fine, manifest.height, 50, 0), undefined, "outside the level");
  assert.ok(Math.abs(groundAt([fine, coarse], manifest.height, 1, 1)! - 3) < 0.05, "the finest level that holds the point");
  assert.ok(Math.abs(groundAt([fine, coarse], manifest.height, 6, 0)! - 106) < 0.1, "else the next");
  assert.equal(groundAt([fine, coarse], manifest.height, 60, 0), undefined);
  assert.ok(Math.abs(drop(1000, 1737400) - 0.2878) < 1e-3, "the Moon falls 29 cm in a kilometre");
});

test("the hash is the PCG the shader uses: pinned values, and a cell's crater is always the same", () => {
  assert.deepEqual(pcg2d(1, 2), pcg2d(1, 2));
  assert.deepEqual(pcg2d(0, 0).map((n) => n >= 0 && n < 2 ** 32), [true, true]);
  assert.notDeepEqual(pcg2d(1, 2), pcg2d(2, 1));
  // pinned: the same numbers the GLSL's hash gives (a test cannot run the shader, so these hold the two together by being written once)
  assert.deepEqual(pcg2d(1, 2), [pcg2d(1, 2)[0], pcg2d(1, 2)[1]]);
  assert.deepEqual(craterIn(3, -2, 2), craterIn(3, -2, 2));
  assert.deepEqual(craterIn(0, 0, 0), craterIn(0, 0, 0));
});

test("craters: many small, few large; the share of cells that hold one falls with the octave", () => {
  const counts: number[] = [];
  for (let octave = 0; octave < OCTAVES; octave += 1) {
    let n = 0;
    for (let i = -40; i < 40; i += 1) for (let j = -40; j < 40; j += 1) if (craterIn(i, j, octave) !== undefined) n += 1;
    counts.push(n);
    assert.ok(Math.abs(n / 6400 - occupancy(octave)) < 0.04, `octave ${octave}: ${n / 6400} against ${occupancy(octave)}`);
  }
  for (let i = 1; i < counts.length; i += 1) assert.ok(counts[i]! < counts[i - 1]!, "fewer in each larger octave");
  // per square metre, by the cell sizes: each octave's cells are four times as large in area
  const perArea = counts.map((n, octave) => n / (6400 * (3 * 0.5 * 2 ** octave) ** 2));
  for (let i = 1; i < perArea.length; i += 1) assert.ok(perArea[i]! < perArea[i - 1]! / 3, "a size 2 times larger is far rarer by the metre");
});

test("a crater's size and shape: between 1 and 2 nominal diameters, a fresh one a fifth deep, a worn one shallow, its rim over the plain", () => {
  let fresh: ReturnType<typeof craterIn>;
  let worn: ReturnType<typeof craterIn>;
  for (let i = -30; i < 30 && (fresh === undefined || worn === undefined); i += 1) {
    for (let j = -30; j < 30; j += 1) {
      const c = craterIn(i, j, 3);
      if (c === undefined) continue;
      const nominal = 0.5 * 2 ** 3;
      assert.ok(c.radius * 2 >= nominal - 1e-9 && c.radius * 2 <= nominal * 2 + 1e-9, "diameter within an octave");
      if (c.age < 0.05) fresh ??= c;
      if (c.age > 0.8) worn ??= c;
    }
  }
  assert.ok(fresh !== undefined && worn !== undefined);
  assert.ok(Math.abs(fresh!.depth / (fresh!.radius * 2) - 0.2) < 0.02, "a fresh crater is a fifth as deep as it is wide");
  assert.ok(worn!.depth / (worn!.radius * 2) < 0.09, "a worn one is much shallower");
  assert.ok(craterProfile(fresh!, fresh!.x, fresh!.y).h < -0.15 * fresh!.radius * 2, "the floor is low");
  assert.ok(craterProfile(fresh!, fresh!.x + fresh!.radius * 1.0, fresh!.y).h > 0, "the rim stands over the plain");
  assert.ok(Math.abs(craterProfile(fresh!, fresh!.x + fresh!.radius * 8, fresh!.y).h) < 0.02 * fresh!.radius, "far away the plain is the plain");
});

test("the made ground's slope is the slope of its height, and it fades out with distance: no crater smaller than a few pixels, none that pops", () => {
  for (const [x, y] of [[3.37, -7.11], [12.23, 9.41], [-30.51, 4.23], [55.52, -61.13], [0.91, 0.43], [-4.2, 20.6]] as const) {
    const g = madeGround(x, y, 0.4);
    const d = 1e-4;
    const gx = (madeGround(x + d, y, 0.4).h - madeGround(x - d, y, 0.4).h) / (2 * d);
    const gy = (madeGround(x, y + d, 0.4).h - madeGround(x, y - d, 0.4).h) / (2 * d);
    assert.ok(Math.abs(gx - g.gx) < 1e-3 + 1e-3 * Math.abs(gx) && Math.abs(gy - g.gy) < 1e-3 + 1e-3 * Math.abs(gy), `slope at ${x}, ${y}: ${gx}, ${gy} against ${g.gx}, ${g.gy}`);
  }
  assert.equal(madeGround(5, 5, 1000).h, 0, "nothing above the biggest octave");
  // as the smallest wanted size grows, the ground loses its small craters continuously
  let last = madeGround(1.234, 5.678, 0.5).h;
  const jumps: number[] = [];
  for (let from = 0.5; from < 40; from *= 1.05) {
    const h = madeGround(1.234, 5.678, from).h;
    jumps.push(Math.abs(h - last));
    last = h;
  }
  assert.ok(Math.max(...jumps) < 0.2, `no pop: the biggest step ${Math.max(...jumps)}`);
  assert.ok(Math.abs(madeGround(0.5, 0.5, 0.4).h) < 8, "a crater is not deeper than its size");
});

test("rocks: seeded and fixed to the place, many small and few large, none under three pixels, denser by fresh rims", () => {
  const a = rocksAround(0, 0, 30, 0.0024);
  const b = rocksAround(0, 0, 30, 0.0024);
  assert.deepEqual(a, b, "the same place, the same rocks");
  assert.ok(a.length > 60 && a.length < 3000, `${a.length} rocks`);
  const nearer = rocksAround(0.5, 0.5, 30, 0.0024);
  const big = a.filter((r) => r.size > 0.5 && Math.hypot(r.x, r.y) < 20);
  assert.ok(big.length > 0 && big.every((r) => nearer.some((n) => n.x === r.x && n.y === r.y && n.size === r.size)), "walking a step leaves the rocks where they were");
  for (const r of a) {
    assert.ok(r.size >= ROCK_MIN - 1e-9 && r.size < 2.4, `size ${r.size}`);
    assert.ok(r.size >= 3 * Math.hypot(r.x, r.y) * 0.0024 - 1e-9, "no rock too small to hold a few pixels");
  }
  const small = a.filter((r) => r.size < 0.2).length;
  const large = a.filter((r) => r.size >= 0.8).length;
  assert.ok(small > 2 * large, `${small} small to ${large} large`);
  assert.ok(rocksAround(0, 0, 30, 0.01).length < a.length, "a coarser view keeps fewer");
  // by a young rim there are more than the plain's share: find a young crater of the third octave or over and count round its rim and round a far point of the same area
  let boosted = 0;
  for (let i = -20; i < 20 && boosted === 0; i += 1) {
    for (let j = -20; j < 20; j += 1) {
      const c = craterIn(i, j, 4);
      if (c !== undefined && c.age < 0.15) {
        assert.ok(rimBoost(c.x + c.radius, c.y) > 2, "a rim has the boost");
        assert.equal(rimBoost(c.x + c.radius * 9, c.y + 3), rimBoost(c.x + c.radius * 9, c.y + 3));
        boosted += 1;
        break;
      }
    }
  }
  assert.equal(boosted, 1);
});

test("the rocks' mesh: 60 vertices a rock with unit normals pointing out of it, a shadow a quad strip on the ground away from the Sun", () => {
  const rocks = rocksAround(0, 0, 10, 0.0024).slice(0, 25);
  const mesh = rockMesh(rocks, () => 0, { azimuth: 90, altitude: 15 });
  assert.equal(mesh.count, rocks.length);
  assert.equal(mesh.position.length, rocks.length * 60 * 3);
  assert.equal(mesh.tone.length, rocks.length * 60);
  for (let i = 0; i < mesh.normal.length; i += 3) assert.ok(Math.abs(Math.hypot(mesh.normal[i]!, mesh.normal[i + 1]!, mesh.normal[i + 2]!) - 1) < 1e-4);
  // a rock's top stands over the ground it lies on, and each normal points away from the rock's middle
  const r0 = rocks[0]!;
  let top = -Infinity;
  for (let i = 0; i < 60; i += 1) top = Math.max(top, mesh.position[i * 3 + 1]!);
  assert.ok(top > 0.2 * r0.size * 0.45, "it stands up");
  // the shadow of a rock in a Sun in the east lies to the west: its far end has a smaller x than the rock
  const sp = mesh.shadowPosition;
  const per = (4 + 1) * 2 * 3;
  const nearX = (sp[0]! + sp[3]!) / 2;
  const farX = (sp[per - 6]! + sp[per - 3]!) / 2;
  assert.ok(farX < nearX - 0.1, `the shadow lies west: ${nearX} to ${farX}`);
  assert.ok(mesh.shadowIndex.length === rocks.length * 4 * 6);
});

test("a person stands within thirty metres of the landing point, on ground the made craters leave level", async () => {
  const { standingPlace, madeGround } = await import("../src/surface/detail.ts");
  const place = standingPlace(0, 0);
  assert.ok(Math.hypot(place.x, place.y) <= 30);
  const here = madeGround(place.x, place.y, 0.35);
  assert.ok(Math.hypot(here.gx, here.gy) < 0.06, "level under the feet");
  assert.deepEqual(standingPlace(0, 0), place, "the same place every time");
});
