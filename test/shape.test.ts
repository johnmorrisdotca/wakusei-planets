import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { SHAPE_JANUS } from "../src/data/shapes/janus.ts";
import { SHAPE_EPIMETHEUS } from "../src/data/shapes/epimetheus.ts";
import { SHAPE_PROMETHEUS } from "../src/data/shapes/prometheus.ts";
import { SHAPE_PANDORA } from "../src/data/shapes/pandora.ts";
import { SHAPE_ATLAS } from "../src/data/shapes/atlas.ts";
import { SHAPE_PAN } from "../src/data/shapes/pan.ts";
import { SHAPE_DAPHNIS } from "../src/data/shapes/daphnis.ts";
import { SHAPE_HELENE } from "../src/data/shapes/helene.ts";
import { SHAPE_TELESTO } from "../src/data/shapes/telesto.ts";
import { SHAPE_CALYPSO } from "../src/data/shapes/calypso.ts";
import { SHAPE_AMALTHEA } from "../src/data/shapes/amalthea.ts";
import { SHAPE_THEBE } from "../src/data/shapes/thebe.ts";
import { SHAPE_LARISSA } from "../src/data/shapes/larissa.ts";
import { SHAPE_DEIMOS } from "../src/data/shapes/deimos.ts";
import { SHAPE_HYDRA } from "../src/data/shapes/hydra.ts";
import { SHAPE_HYPERION } from "../src/data/shapes/hyperion.ts";
import { SHAPE_NIX } from "../src/data/shapes/nix.ts";
import { SHAPE_PHOBOS } from "../src/data/shapes/phobos.ts";
import { SHAPE_PROTEUS } from "../src/data/shapes/proteus.ts";
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
  proteus: { table: SHAPE_PROTEUS, mean: 210, within: 0.06 },
  janus: { table: SHAPE_JANUS, mean: 89.5, within: 0.09 },
  epimetheus: { table: SHAPE_EPIMETHEUS, mean: 58.1, within: 0.09 },
  prometheus: { table: SHAPE_PROMETHEUS, mean: 43.1, within: 0.09 },
  pandora: { table: SHAPE_PANDORA, mean: 40.7, within: 0.09 },
  atlas: { table: SHAPE_ATLAS, mean: 15.1, within: 0.09 },
  pan: { table: SHAPE_PAN, mean: 14.1, within: 0.09 },
  daphnis: { table: SHAPE_DAPHNIS, mean: 3.8, within: 0.09 },
  helene: { table: SHAPE_HELENE, mean: 17.6, within: 0.09 },
  telesto: { table: SHAPE_TELESTO, mean: 12.4, within: 0.09 },
  calypso: { table: SHAPE_CALYPSO, mean: 9.5, within: 0.09 },
  amalthea: { table: SHAPE_AMALTHEA, mean: 83.5, within: 0.09 },
  thebe: { table: SHAPE_THEBE, mean: 49.3, within: 0.09 },
  larissa: { table: SHAPE_LARISSA, mean: 97, within: 0.09 },
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

test("a table reads back as the radii it was cut from: each is the difference from the one its neighbours predict, 16-bit, little-endian", () => {
  // two columns, two rows of latitude, unit 2: the radii are 4 6 / 5 9 half-kilometres, so the residuals are 4 (from 0), 2 (from the west, 4), 1 (from the north, 4) and 2 (from 5 + 6 - 4 = 7)
  const steps = btoa(String.fromCharCode(...new Uint8Array([4, 0, 2, 0, 1, 0, 2, 0])));
  assert.deepEqual([...shapeRadii({ lon: 2, lat: 1, unit: 2, steps })], [2, 3, 2.5, 4.5]);
  // a negative residual
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

test("the geometry is the globe moved to the radii, in units of the mean radius, on a globe no coarser than 192 by 96, with unit normals the seam and the poles share", () => {
  const table = SHAPE_NIX; // 96 by 48: the globe is twice as fine and passes through every radius of the table
  const mean = 18.6;
  const geometry = shapeGeometry(THREE, table, mean);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const radii = shapeRadii(table);
  const lon = 192;
  const lat = 96;
  const wide = lon + 1;
  assert.equal(position.count, (lon + 1) * (lat + 1));
  const at = (row: number, column: number): number => Math.hypot(position.getX(row * wide + column), position.getY(row * wide + column), position.getZ(row * wide + column));
  for (const [row, column] of [[5, 5], [12, 20], [23, 47]] as const) assert.ok(Math.abs(at(row * 2, column * 2) - (radii[row * table.lon + column] as number) / mean) < 1e-5, `${row},${column}`);
  // between two radii of the table the globe is between them (a smooth curve may overshoot a little)
  const a = radii[10 * table.lon + 30] as number;
  const b = radii[10 * table.lon + 31] as number;
  assert.ok(Math.abs(at(20, 61) * mean - (a + b) / 2) < Math.abs(a - b) / 2 + 0.3);
  for (let i = 0; i < normal.count; i += 1) assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-4);
  for (let row = 0; row <= lat; row += 1) {
    const first = row * wide;
    const last = first + lon;
    assert.ok(Math.abs(normal.getX(first) - normal.getX(last)) + Math.abs(normal.getY(first) - normal.getY(last)) + Math.abs(normal.getZ(first) - normal.getZ(last)) < 1e-6, `seam of row ${row}`);
  }
  for (let column = 1; column <= lon; column += 1) assert.ok(Math.abs(normal.getY(column) - normal.getY(0)) < 1e-6, "north pole");
  geometry.dispose();
  // a table finer than the globe keeps its own grid
  const fine = shapeGeometry(THREE, SHAPE_PHOBOS, 11.08);
  assert.equal(fine.getAttribute("position").count, 193 * 97);
  fine.dispose();
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
  for (const [id, table] of [["phobos", SHAPE_PHOBOS], ["deimos", SHAPE_DEIMOS], ["nix", SHAPE_NIX], ["hydra", SHAPE_HYDRA], ["proteus", SHAPE_PROTEUS]] as const) {
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
