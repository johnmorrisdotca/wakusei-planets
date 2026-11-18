import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { SHAPE_DEIMOS } from "../src/data/shapes/deimos.ts";
import { SHAPE_HYDRA } from "../src/data/shapes/hydra.ts";
import { SHAPE_HYPERION } from "../src/data/shapes/hyperion.ts";
import { SHAPE_NIX } from "../src/data/shapes/nix.ts";
import { SHAPE_PHOBOS } from "../src/data/shapes/phobos.ts";
import { SHAPE_PHOEBE } from "../src/data/shapes/phoebe.ts";
import { BODY_IDS } from "../src/index.ts";
import { lookOf } from "../src/scene/look.ts";
import { shapeBasis, shapeNote } from "../src/shape-basis.ts";
import { shapeGeometry, shapeRadii, type ShapeTable } from "../src/scene/shape.ts";
import "../src/bodies/all.ts";

// the mean (volume) radius of each shape in kilometres: JPL's table of the body, to within the cut of the table's grid
const SHAPES: Record<string, { table: ShapeTable; mean: number; within: number }> = {
  phobos: { table: SHAPE_PHOBOS, mean: 11.08, within: 0.05 },
  deimos: { table: SHAPE_DEIMOS, mean: 6.2, within: 0.05 },
  nix: { table: SHAPE_NIX, mean: 18.6, within: 0.05 },
  hydra: { table: SHAPE_HYDRA, mean: 19.0, within: 0.06 },
  phoebe: { table: SHAPE_PHOEBE, mean: 106.5, within: 0.05 },
  hyperion: { table: SHAPE_HYPERION, mean: 135, within: 0.05 },
};

function volumeRadius(table: ShapeTable): number {
  const radii = shapeRadii(table);
  let sum = 0;
  let weight = 0;
  for (let row = 1; row < table.lat; row += 1) {
    const w = Math.sin((Math.PI * row) / table.lat);
    for (let column = 0; column < table.lon; column += 1) {
      sum += (radii[row * table.lon + column] as number) ** 3 * w;
      weight += w;
    }
  }
  return Math.cbrt(sum / weight);
}

test("a table reads back as the radii it was cut from: steps along a row of latitude, 16-bit, little-endian", () => {
  // two columns, two rows of latitude: row 0 is 4, 4 (steps +4, 0), row 1 is 2, 3 (steps +2, +1), unit 2
  const bytes = new Uint8Array([4, 0, 0, 0, 2, 0, 1, 0]);
  const steps = btoa(String.fromCharCode(...bytes));
  assert.deepEqual([...shapeRadii({ lon: 2, lat: 1, unit: 2, steps })], [2, 2, 1, 1.5]);
  // a negative step
  const down = btoa(String.fromCharCode(10, 0, 0xfe, 0xff));
  assert.deepEqual([...shapeRadii({ lon: 2, lat: 0, unit: 1, steps: down })], [10, 8]);
  assert.throws(() => shapeRadii({ lon: 4, lat: 4, unit: 1, steps: btoa("x") }), RangeError);
});

test("each shape is a table of its own grid, and its volume radius is the body's", () => {
  for (const [name, { table, mean, within }] of Object.entries(SHAPES)) {
    assert.equal(shapeRadii(table).length, table.lon * (table.lat + 1), name);
    const r = volumeRadius(table);
    assert.ok(Math.abs(r - mean) / mean < within, `${name}: ${r.toFixed(2)} km against ${mean}`);
  }
});

test("a shape has no hole: every radius is positive, and the poles are one radius all round", () => {
  for (const [name, { table }] of Object.entries(SHAPES)) {
    const radii = shapeRadii(table);
    assert.ok(radii.every((r) => r > 0), name);
    for (const row of [0, table.lat]) {
      const first = radii[row * table.lon] as number;
      for (let column = 1; column < table.lon; column += 1) assert.ok(Math.abs((radii[row * table.lon + column] as number) - first) < 0.2, `${name} pole`);
    }
  }
});

test("the geometry is the globe moved to the radii, in units of the mean radius, with unit normals the seam and the poles share", () => {
  const table = SHAPE_NIX;
  const mean = 18.6;
  const geometry = shapeGeometry(THREE, table, mean);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const radii = shapeRadii(table);
  const wide = table.lon + 1;
  for (const [row, column] of [[10, 5], [24, 40], [47, 95]] as const) {
    const i = row * wide + column;
    assert.ok(Math.abs(Math.hypot(position.getX(i), position.getY(i), position.getZ(i)) - (radii[row * table.lon + column] as number) / mean) < 1e-5);
  }
  for (let i = 0; i < normal.count; i += 1) assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-4);
  for (let row = 0; row <= table.lat; row += 1) {
    const a = row * wide;
    const b = a + table.lon;
    assert.ok(Math.abs(normal.getX(a) - normal.getX(b)) + Math.abs(normal.getY(a) - normal.getY(b)) + Math.abs(normal.getZ(a) - normal.getZ(b)) < 1e-6, `seam of row ${row}`);
  }
  for (let column = 1; column <= table.lon; column += 1) assert.ok(Math.abs(normal.getY(column) - normal.getY(0)) < 1e-6, "north pole");
  geometry.dispose();
});

test("Phobos has Stickney: its crater is lower than the ground round it", () => {
  const table = SHAPE_PHOBOS;
  const radii = shapeRadii(table);
  // the vertex of longitude -49 east (the package's east: the sphere's x is -cos(phi) from the shader's frame), latitude 1
  const at = (lon: number, lat: number): number => {
    let best = 1e9;
    let value = 0;
    for (let row = 0; row <= table.lat; row += 1) {
      for (let column = 0; column < table.lon; column += 1) {
        const phi = (2 * Math.PI * column) / table.lon;
        const east = (Math.atan2(-Math.cos(phi), Math.sin(phi)) * 180) / Math.PI;
        const d = Math.hypot(((east - lon + 540) % 360) - 180, 90 - (180 * row) / table.lat - lat);
        if (d < best) {
          best = d;
          value = radii[row * table.lon + column] as number;
        }
      }
    }
    return value;
  };
  const floor = at(-49, 1);
  for (const [lon, lat] of [[-49, 15], [-49, -13], [-70, 1], [-28, 1]] as const) assert.ok(at(lon, lat) > floor + 0.2, `${lon},${lat}`);
});

test("the looks that carry a shape load it lazily, the same table", async () => {
  for (const [id, table] of [["phobos", SHAPE_PHOBOS], ["deimos", SHAPE_DEIMOS], ["nix", SHAPE_NIX], ["hydra", SHAPE_HYDRA]] as const) {
    const look = lookOf(id);
    assert.ok(look?.shape, id);
    assert.equal(await look.shape(), table);
  }
});

test("the line a card says matches the looks: a measured shape with no map says its colour is from its brightness, with a map says its surface is measured, and any other body says nothing", () => {
  for (const id of BODY_IDS) {
    const look = lookOf(id);
    const basis = shapeBasis(id);
    if (look?.shape === undefined) assert.equal(basis, undefined, id);
    else assert.equal(basis, look.painted === undefined ? "shape" : "shape-and-map", id);
    assert.equal(shapeNote(id, "en") === "", basis === undefined, id);
    assert.equal(shapeNote(id, "ja") === "", basis === undefined, id);
  }
  assert.equal(shapeNote("nix", "en"), "shape measured; colour from its measured brightness");
  assert.equal(shapeNote("hydra", "ja"), "形は測定したもの。色は測定した明るさから");
  assert.equal(shapeNote("mars", "en"), "");
});
