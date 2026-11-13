// The standing view's maths: the sky from the Moon's surface (the Sun and the Earth in the right places, with the Earth's phase the opposite of the Moon's), the camera, the height tiles' addresses and decoding,
// the made detail (craters and rocks: seeded, fixed to the place, many small and few large, fading by distance, their slope the slope of their height) and the rocks' mesh. The GLSL holds the same formulas as
// src/surface/detail.ts; the pinned craters below are what both must give, so a change to one is a change to the other.
import assert from "node:assert/strict";
import { test } from "node:test";
import { apparent } from "../src/ephemeris.ts";
import { driveParts, driveStep, driveView, ROVER, startDrive, type DriveState } from "../src/surface/drive.ts";
import { DustField } from "../src/surface/dust.ts";
import { keepAway, objectParts, objectsOf, partShadows, traverseOf } from "../src/surface/objects.ts";
import { craterIn, craterProfile, setKeepOut, madeGround, occupancy, OCTAVES, pcg2d, rimBoost, rocksAround, ROCK_MIN } from "../src/surface/detail.ts";
import { decodeHeight, drop, emptyLevel, fillFromCoarser, groundAt, placeTile, sampleLevel, tileAddress, type TerrainManifest } from "../src/surface/height.ts";
import { loadPlan } from "../src/surface/load.ts";
import { rockMesh, ROCK_VERTICES } from "../src/surface/rocks.ts";
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

test("most craters are old: a few in a hundred are fresh, three in four are worn, and craters over 5 m are half as many", () => {
  let n = 0;
  let freshN = 0;
  let worn = 0;
  for (let octave = 0; octave < 3; octave += 1) {
    for (let i = -40; i < 40; i += 1) {
      for (let j = -40; j < 40; j += 1) {
        const c = craterIn(i, j, octave);
        if (c === undefined) continue;
        n += 1;
        if (c.age < 0.15) freshN += 1;
        if (c.age > 0.7) worn += 1;
      }
    }
  }
  assert.ok(freshN / n < 0.07 && freshN / n > 0.015, `fresh: ${freshN / n}`);
  assert.ok(worn / n > 0.65, `worn: ${worn / n}`);
  assert.ok(occupancy(3) < 0.55 * 0.36 * 2 ** -1.5 && occupancy(3) > 0.45 * 0.36 * 2 ** -1.5, "the larger octaves are thinned by half");
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
  const freshRatio = fresh!.depth / (fresh!.radius * 2);
  assert.ok(freshRatio > 0.11 && freshRatio < 0.21, `a fresh crater is about a fifth as deep as it is wide, a little less when it varies: ${freshRatio}`);
  assert.ok(worn!.depth / (worn!.radius * 2) < 0.09, "a worn one is much shallower");
  assert.ok(craterProfile(fresh!, fresh!.x, fresh!.y).h < -0.08 * fresh!.radius * 2, "the floor is low");
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

test("the rocks' mesh: 240 vertices a rock with unit smooth normals pointing out of it, a shadow a quad strip on the ground away from the Sun", () => {
  const rocks = rocksAround(0, 0, 10, 0.0024).slice(0, 25);
  const mesh = rockMesh(rocks, () => 0, { azimuth: 90, altitude: 15 });
  assert.equal(mesh.count, rocks.length);
  assert.equal(ROCK_VERTICES, 240);
  assert.equal(mesh.position.length, rocks.length * ROCK_VERTICES * 3);
  assert.equal(mesh.tone.length, rocks.length * ROCK_VERTICES);
  for (let i = 0; i < mesh.normal.length; i += 3) assert.ok(Math.abs(Math.hypot(mesh.normal[i]!, mesh.normal[i + 1]!, mesh.normal[i + 2]!) - 1) < 1e-4);
  // a rock's top stands over the ground it lies on, and each normal points away from the rock's middle
  const r0 = rocks[0]!;
  let top = -Infinity;
  for (let i = 0; i < ROCK_VERTICES; i += 1) top = Math.max(top, mesh.position[i * 3 + 1]!);
  assert.ok(top > 0.05 * r0.size, "it stands up");
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

const real = (): TerrainManifest => {
  const level = (id: string, res: number, tiles = 8) => ({ id, res, tiles, half: (256 * tiles * res) / 2 });
  return {
    body: "moon", site: "apollo-17", tile: 256, height: { min: -4000, range: 8000 },
    levels: [level("h5", 5), level("h20", 20), level("h80", 80), level("far", 480, 4)],
    picture: { levels: [level("a5", 5), level("a20", 20), level("a80", 80)] },
    horizon: { cells: 512, sectors: 18, from: -10, to: 60, levels: [{ id: "h5", file: "horizon/h5.webp" }, { id: "h20", file: "horizon/h20.webp" }, { id: "h80", file: "horizon/h80.webp" }] },
  } as unknown as TerrainManifest;
};

test("the first view is the coarse level whole, the finest level's middle sixteen tiles, the pictures of the two and the finest horizon map; the far level comes last", () => {
  const plan = loadPlan(real());
  const first = plan.filter((job) => job.first);
  const count = (kind: string, index: number, list = first) => list.filter((job) => job.kind === kind && job.index === index).length;
  assert.equal(count("height", 2), 64, "h80 whole");
  assert.equal(count("height", 0), 16, "h5 middle");
  assert.equal(count("height", 1) + count("height", 3), 0);
  assert.equal(count("picture", 2), 64);
  assert.equal(count("picture", 0), 16);
  assert.equal(count("horizon", 0), 1);
  assert.equal(first.length, 64 + 16 + 64 + 16 + 1);
  // the middle sixteen of eight are columns and rows 2 to 5, round the site
  assert.ok(first.filter((job) => job.kind === "height" && job.index === 0).every((job) => job.column >= 2 && job.column <= 5 && job.row >= 2 && job.row <= 5));
  // nothing twice, and everything once: 3 x 64 height + 16 far + 3 x 64 picture + 3 horizon
  assert.equal(new Set(plan.map((job) => `${job.kind}:${job.index}:${job.column}:${job.row}`)).size, plan.length);
  assert.equal(plan.length, 3 * 64 + 16 + 3 * 64 + 3);
  // the first view's files are all ahead of the rest, the far level is last
  const firstEnd = plan.findLastIndex((job) => job.first);
  assert.equal(firstEnd, first.length - 1);
  assert.ok(plan.slice(-16).every((job) => job.kind === "height" && job.index === 3), "far last");
  // the rest goes outward: the h5 tiles' distances from the site never fall
  const side = 256 * 5;
  const d = plan.filter((job) => job.kind === "height" && job.index === 0 && !job.first).map((job) => Math.hypot((job.column + 0.5) * side - 5120, (job.row + 0.5) * side - 5120));
  assert.ok(d.every((v, i) => i === 0 || v >= d[i - 1]! - 1e-9), "nearest first");
});

test("a level with none of its tiles is filled from the coarser one in its own encoding, and a tile that is real is left alone", () => {
  const tile = 4;
  const coarse = emptyLevel({ id: "h20", res: 20, tiles: 2, half: 80 }, tile);
  const encoding = { min: -4000, range: 8000 };
  // a slope: height 100 m per sample column, from the west
  for (let y = 0; y < coarse.size; y += 1) {
    for (let x = 0; x < coarse.size; x += 1) {
      const code = Math.round(((x * 100 - encoding.min) / encoding.range) * 65535);
      const i = (y * coarse.size + x) * 4;
      coarse.data[i] = code >> 8;
      coarse.data[i + 1] = code & 255;
    }
  }
  const fine = emptyLevel({ id: "h5", res: 5, tiles: 2, half: 20 }, tile);
  // the finer level is the middle quarter of the coarse one, so its eight samples cover 40 m: the same slope there, 5 m a sample, 25 m of height each
  const fineEncoding = { min: -2000, range: 4000 };
  const realTile = new Uint8Array(tile * tile * 4).fill(7);
  placeTile(fine, tile, 0, 0, realTile);
  fillFromCoarser(fine, coarse, tile, (column, row) => column === 0 && row === 0, { from: encoding, to: fineEncoding });
  assert.equal(fine.data[0], 7, "the real tile is untouched");
  const at = (x: number, y: number): number => {
    const i = (y * fine.size + x) * 4;
    assert.equal(fine.data[i + 3], 255, "filled samples are marked present");
    return decodeHeight(fine.data[i]!, fine.data[i + 1]!, fineEncoding);
  };
  // the fine sample x sits at (x + 0.5) * 5 - 20 m east, which is coarse sample (that + 80) / 20 - 0.5, which is a height of 100 per sample
  for (const x of [4, 5, 7]) {
    const east = (x + 0.5) * 5 - 20;
    const expect = ((east + 80) / 20 - 0.5) * 100;
    assert.ok(Math.abs(at(x, 6) - expect) < 0.2, `x ${x}: ${at(x, 6)} against ${expect}`);
  }
  // a picture fills from the grey, copied to all three colours
  const pic = emptyLevel({ id: "a20", res: 20, tiles: 2, half: 80 }, tile);
  for (let i = 0; i < pic.size * pic.size; i += 1) pic.data.fill(100, i * 4, i * 4 + 3);
  const finer = emptyLevel({ id: "a5", res: 5, tiles: 2, half: 20 }, tile);
  fillFromCoarser(finer, pic, tile, () => false, "grey");
  assert.deepEqual([...finer.data.subarray(0, 4)], [100, 100, 100, 255]);
});

test("a tile's address is .webp where the manifest says so and .png where it says nothing", () => {
  assert.match(tileAddress("t/", { body: "moon", site: "s", format: "webp" }, "h5", 1, 2), /terrain\/h5\/1\/2\.webp$/);
  assert.match(tileAddress("t/", { body: "moon", site: "s" }, "h5", 1, 2), /\.png$/);
});

test("the things at Apollo 17 are at their published places: the lunar module by the site point, the flag a few metres off it, the ALSEP about two hundred metres west, and none elsewhere", () => {
  const things = objectsOf("apollo-17");
  assert.deepEqual(things.map((o) => o.id).sort(), ["alsep", "flag", "lm", "rover", "sep"]);
  const at = (id: string) => things.find((o) => o.id === id)!;
  const dist = (a: string, b: string) => Math.hypot(at(a).east - at(b).east, at(a).north - at(b).north);
  assert.ok(Math.hypot(at("lm").east, at("lm").north) < 25, "the lunar module is within 25 m of the site point");
  assert.ok(dist("lm", "flag") > 15 && dist("lm", "flag") < 40, `the flag is a few tens of metres from the lunar module: ${dist("lm", "flag")}`);
  assert.ok(dist("lm", "alsep") > 190 && dist("lm", "alsep") < 215, `the ALSEP is about 200 m from the lunar module: ${dist("lm", "alsep")}`);
  assert.ok(at("alsep").east < at("lm").east - 150, "and to its west");
  assert.ok(at("sep").east > at("lm").east + 80, "the transmitter is to its east");
  // the published latitudes and longitudes agree with the plane's metres (the tangent plane of the tiles: a sphere of 1737.4 km)
  const lm = at("lm");
  assert.ok(Math.abs(20.1911 + (lm.north / 1_737_400) * (180 / Math.PI) - lm.lat!) < 2e-4);
  assert.deepEqual(objectsOf("nowhere"), []);
});

test("the rover's traverse is nine lines of about a thousand points in all, within eight kilometres of the site, that join end to end", () => {
  const lines = traverseOf("apollo-17");
  assert.equal(lines.length, 9);
  assert.ok(lines.reduce((n, line) => n + line.length / 2, 0) > 1000);
  for (const line of lines) for (let i = 0; i < line.length; i += 2) assert.ok(Math.hypot(line[i]!, line[i + 1]!) < 8000, "within eight kilometres");
  const end = (line: readonly number[]) => [line[line.length - 2]!, line[line.length - 1]!];
  const start = (line: readonly number[]) => [line[0]!, line[1]!];
  assert.ok(Math.hypot(end(lines[7]!)[0]! - start(lines[8]!)[0]!, end(lines[7]!)[1]! - start(lines[8]!)[1]!) < 2, "the last traverse starts where the one before ends");
  const rover = objectsOf("apollo-17").find((o) => o.id === "rover")!;
  const last = end(lines[8]!);
  assert.ok(Math.hypot(rover.east - last[0]!, rover.north - last[1]!) < 0.1, "the rover is where the last line ends");
});

test("the made ground keeps away from the things: nothing is made at the lunar module and all of it from fifteen metres off; rocks keep out too", () => {
  const objects = objectsOf("apollo-17");
  const lm = objects.find((o) => o.id === "lm")!;
  assert.equal(keepAway(lm.east, lm.north, objects), 0);
  assert.equal(keepAway(lm.east + 15, lm.north, objects), 1);
  const mid = keepAway(lm.east + 12, lm.north, objects);
  assert.ok(mid > 0 && mid < 1, `between: ${mid}`);
  setKeepOut(objects);
  try {
    assert.deepEqual(madeGround(lm.east + 1, lm.north, 0.35), { h: 0, gx: 0, gy: 0 });
    assert.ok(rocksAround(lm.east, lm.north, 12, 0.0024).every((r) => Math.hypot(r.x - lm.east, r.y - lm.north) > 5), "no rock under the legs");
  } finally {
    setKeepOut([]);
  }
  assert.notDeepEqual(madeGround(lm.east + 1, lm.north, 0.35), { h: 0, gx: 0, gy: 0 }, "with no list the ground is made as before");
});

test("the shapes stand on the ground at the sizes they should be, and their shadows fall away from the Sun", () => {
  const objects = objectsOf("apollo-17");
  const lander = objectParts(objects.find((o) => o.id === "lm")!, 10);
  let top = -Infinity;
  let bottom = Infinity;
  let spread = 0;
  for (const part of lander) {
    for (let i = 0; i < part.position.length; i += 3) {
      top = Math.max(top, part.position[i + 1]!);
      bottom = Math.min(bottom, part.position[i + 1]!);
      spread = Math.max(spread, Math.hypot(part.position[i]! - objects[0]!.east, part.position[i + 2]! - objects[0]!.north));
    }
    for (let i = 0; i < part.normal.length; i += 3) assert.ok(Math.abs(Math.hypot(part.normal[i]!, part.normal[i + 1]!, part.normal[i + 2]!) - 1) < 1e-6, "unit normals");
  }
  assert.ok(Math.abs(bottom - 10) < 1e-6, "it stands on the ground");
  assert.ok(top - 10 > 3 && top - 10 < 3.5, `the deck is about 3.2 m up: ${top - 10}`);
  assert.ok(spread > 4.4 && spread < 5.2, `the pads are about 4.7 m out: ${spread}`);
  const rover = objectParts(objects.find((o) => o.id === "rover")!, 0);
  let rt = 0;
  for (const part of rover) for (let i = 1; i < part.position.length; i += 3) rt = Math.max(rt, part.position[i]!);
  assert.ok(rt > 2.3 && rt < 2.7, `the rover with its dish on a tall mast (ours, raised so the commander sees under it) is about 2.5 m: ${rt}`);
  // a 2.4 m flag pole with the Sun 13 degrees up in the east throws a shadow of about 10 m to the west
  const flag = objects.find((o) => o.id === "flag")!;
  const shadow = partShadows(objectParts(flag, 0), 0, 90, 13);
  let west = Infinity;
  for (let i = 0; i < shadow.length; i += 3) west = Math.min(west, shadow[i]!);
  assert.ok(flag.east - west > 8 && flag.east - west < 14, `the shadow reaches ${flag.east - west} m west`);
  assert.equal(partShadows(objectParts(flag, 0), 0, 90, 0.2).length, 0, "no shadow when the Sun is down");
});

const run = (state: DriveState, input: { throttle: number; steer: number }, seconds: number, ground: (e: number, n: number) => number = () => 0, blocked?: (e: number, n: number) => boolean): DriveState => {
  let s = state;
  for (let t = 0; t < seconds; t += 1 / 60) s = driveStep(s, input, 1 / 60, ground, blocked);
  return s;
};

test("the rover speeds up at a steady rate to its top speed, 12 km/h, and stops when the throttle is let go", () => {
  const two = run(startDrive(0, 0, 0, 0), { throttle: 1, steer: 0 }, 2);
  assert.ok(Math.abs(two.speed - 2.2) < 0.1, `2 s: ${two.speed}`);
  assert.ok(two.north > 1.8 && two.north < 2.6 && Math.abs(two.east) < 1e-6, `${two.north}`);
  const top = run(two, { throttle: 1, steer: 0 }, 8);
  assert.ok(Math.abs(top.speed - ROVER.maxSpeed) < 0.01 && ROVER.maxSpeed * 3.6 > 11 && ROVER.maxSpeed * 3.6 < 13, `${top.speed}`);
  const stopped = run(top, { throttle: 0, steer: 0 }, 12);
  assert.equal(stopped.speed, 0);
  // on a gentle slope too, it stays where it is once it has stopped
  const parked = run(run(startDrive(0, 0, 0, 0), { throttle: 0, steer: 0 }, 1, (_e, n) => 0.1 * n), { throttle: 0, steer: 0 }, 20, (_e, n) => 0.1 * n);
  assert.equal(parked.speed, 0);
  assert.ok(Math.abs(parked.north) < 0.01);
  const back = run(startDrive(0, 0, 0, 0), { throttle: -1, steer: 0 }, 6);
  assert.ok(back.north < -3 && back.speed >= -ROVER.maxReverse - 1e-9, "backing is slower and goes the other way");
});

test("steering to the right turns the heading to the right, tightly: all four wheels steer", () => {
  const moving = run(startDrive(0, 0, 0, 0), { throttle: 1, steer: 0 }, 3);
  const turned = run(moving, { throttle: 1, steer: 1 }, 2);
  assert.ok(turned.heading > 20 && turned.heading < 200, `heading ${turned.heading}`);
  assert.ok(turned.east > moving.east + 1, "and the rover went round to the east");
  const left = run(moving, { throttle: 1, steer: -1 }, 2);
  assert.ok(left.heading > 160 && left.heading < 340, "left is the other way round");
  // a standing rover does not turn
  assert.equal(run(startDrive(0, 0, 10, 0), { throttle: 0, steer: 1 }, 2).heading, 10);
});

test("the rover follows the ground: it tilts with the slope across it and along it, sits at the mean of its four wheels, and will not climb past 25 degrees", () => {
  const across = run(startDrive(0, 0, 0, 0), { throttle: 0, steer: 0 }, 2, (e) => 0.3 * e);
  assert.ok(Math.abs(across.roll - Math.atan(0.3)) < 0.02, `roll ${across.roll}`);
  assert.ok(Math.abs(across.y) < 0.05, "at the mean of the four");
  const along = run(startDrive(0, 0, 0, 0), { throttle: 0, steer: 0 }, 2, (_e, n) => 0.2 * n);
  assert.ok(Math.abs(along.pitch - Math.atan(0.2)) < 0.02, `pitch ${along.pitch}`);
  // a slope of 30 degrees ahead: it goes up the foot of it and stops
  const wall = run(startDrive(0, -4, 0, 0), { throttle: 1, steer: 0 }, 15, (_e, n) => (n > 0 ? Math.tan(0.52) * n : 0));
  assert.ok(wall.north < 4 && wall.speed === 0, `it stopped at ${wall.north} m with ${wall.speed}`);
  // a gentle slope of 10 degrees it climbs, slower than on the flat
  const hill = run(startDrive(0, 0, 0, 0), { throttle: 1, steer: 0 }, 6, (_e, n) => Math.tan(0.175) * Math.max(0, n));
  assert.ok(hill.north > 5 && hill.speed < ROVER.maxSpeed, `${hill.north} ${hill.speed}`);
});

test("where the ground drops away the rover is in free fall at the Moon's gravity, and lands on its springs", () => {
  const cliff = (_e: number, n: number): number => (n > 1 ? -2 : 0);
  let s = startDrive(0, 0, 0, 0);
  let air = false;
  for (let t = 0; t < 6; t += 1 / 60) {
    s = driveStep(s, { throttle: t < 1.5 ? 1 : 0, steer: 0 }, 1 / 60, cliff);
    air ||= s.airborne;
  }
  assert.ok(s.north > 1, "it went over the edge");
  assert.ok(air, "it was in the air");
  assert.ok(Math.abs(s.y - -2) < 0.1 && !s.airborne, `it landed: ${s.y}`);
  // a fall of 2 m at 1.62 m/s2 takes 1.57 s; at the Earth's 9.8 it would take 0.64 s
  let fall = startDrive(0, 5, 0, 0);
  fall = { ...fall, y: 2 };
  let t = 0;
  while (fall.y > 0.04 && t < 5) {
    fall = driveStep(fall, { throttle: 0, steer: 0 }, 1 / 60, () => 0);
    t += 1 / 60;
  }
  assert.ok(t > 1.3 && t < 1.8, `fell in ${t} s`);
});

test("a blocked place stops the rover, and does not move it", () => {
  const stuck = run(startDrive(0, 0, 0, 0), { throttle: 1, steer: 0 }, 5, () => 0, (_e, n) => n > 3);
  assert.ok(stuck.north < 3.2 && stuck.speed === 0, `${stuck.north}`);
});

test("the drawn rover is turned and placed with it: its heading puts the dish on the way it points, a wheel that has rolled is turned about its axle, and the eyes are behind it or in its seat", () => {
  const east = startDrive(100, 50, 90, 3);
  const dishAt = (parts: ReturnType<typeof driveParts>) => {
    let best = -Infinity;
    for (const part of parts) for (let i = 0; i < part.position.length; i += 3) best = Math.max(best, part.position[i]!);
    return best;
  };
  assert.ok(dishAt(driveParts(east)) > 100 + 1.2, "pointing east the front is to the east");
  const north = driveParts(startDrive(0, 0, 0, 0));
  const wheel = north.find((p) => p.wheel === 0)!;
  const turned = driveParts({ ...startDrive(0, 0, 0, 0), spin: [Math.PI / 2, 0, 0, 0] }).find((p) => p.wheel === 0)!;
  // the hub's lighter colour is a part of its own, so compare the wheel's middle: the same, since a wheel turns about it
  const middle = (p: typeof wheel) => [0, 1, 2].map((k) => p.position.filter((_, i) => i % 3 === k).reduce((a, b) => a + b, 0) / (p.position.length / 3));
  for (let k = 0; k < 3; k += 1) assert.ok(Math.abs(middle(wheel)[k]! - middle(turned)[k]!) < 0.01, "a wheel turns about its own middle");
  assert.notDeepEqual(wheel.position.slice(0, 9), turned.position.slice(0, 9), "and its corners moved");
  for (const part of north) for (let i = 0; i < part.normal.length; i += 3) assert.ok(Math.abs(Math.hypot(part.normal[i]!, part.normal[i + 1]!, part.normal[i + 2]!) - 1) < 1e-5);
  const chase = driveView(startDrive(0, 0, 0, 0), "chase", { azimuth: 0, pitch: 0 }, () => 0);
  assert.ok(Math.abs(chase.eye.north - -6.5) < 1e-6 && chase.eye.up > 2.5 && chase.pitch < 0 && chase.azimuth === 0, "behind and above, looking down at it");
  const seat = driveView(startDrive(0, 0, 90, 0), "seat", { azimuth: 10, pitch: 0 }, () => 0);
  assert.ok(Math.abs(seat.eye.up - ROVER.seat[1]) < 1e-6 && seat.azimuth === 100, "in the seat: the eyes' height, and the view turned by the driver");
});

test("a thrown grain flies a parabola at the Moon's gravity and lands where it should: the same every time for one seed", () => {
  const dust = new DustField(8, 5);
  dust.emit([0, 0.3, 0], [2, 1.5, 0], 10);
  assert.equal(dust.age.filter((a) => a < 1e8).length, 1);
  let t = 0;
  let top = -Infinity;
  while (dust.age.some((a) => a < 1e8) && t < 10) {
    dust.step(1 / 60, () => 0);
    t += 1 / 60;
    top = Math.max(top, dust.position[1]!);
  }
  assert.ok(t > 1.0 && t < 5, `it fell in ${t} s`);
  assert.ok(top > 0.5 && top < 3, `it rose to ${top}`);
  const again = new DustField(8, 5);
  again.emit([0, 0.3, 0], [2, 1.5, 0], 10);
  assert.deepEqual([...again.velocity.slice(0, 3)], [...new DustField(8, 5).velocity.slice(0, 3)].map((_, i) => again.velocity[i]!));
  const other = new DustField(8, 6);
  other.emit([0, 0.3, 0], [2, 1.5, 0], 10);
  assert.notEqual(other.velocity[0], again.velocity[0], "another seed scatters differently");
});
