import assert from "node:assert/strict";
import { test } from "node:test";
import { interiorLegend, interiorOf } from "../src/interior.ts";

test("the Earth and Mars use the figures read from NASA, and a body with none is left out", () => {
  const earth = interiorOf("earth");
  assert.ok(earth);
  assert.equal(earth.radiusKm, 6371);
  assert.deepEqual(earth.layers.map((layer) => [layer.id, layer.outerKm, layer.about]), [
    ["inner-core", 1221, true],
    ["outer-core", 3485, false],
    ["mantle", 6341, true],
    ["crust", 6371, false],
  ]);
  const mars = interiorOf("mars");
  assert.ok(mars);
  assert.equal(mars.radiusKm, 3389.5);
  assert.deepEqual(mars.layers.map((layer) => layer.outerKm), [1830, 3389.5]);
  for (const id of ["moon", "mercury", "venus", "jupiter", "saturn", "uranus", "neptune", "io", "europa", "ganymede", "titan"]) {
    assert.equal(interiorOf(id), undefined, id);
  }
});

test("the legend lists each layer from the surface, outermost first, in English and Japanese", () => {
  assert.deepEqual(interiorLegend("earth", "en")?.map((row) => [row.name, row.depth, row.madeOf]), [
    ["Crust", "0 km to about 30 km", "rock"],
    ["Mantle", "about 30 km to 2886 km", "rock"],
    ["Outer core", "2886 km to about 5150 km", "iron and nickel, fluid"],
    ["Inner core", "about 5150 km to 6371 km", "iron and nickel, solid"],
  ]);
  assert.equal(interiorLegend("earth", "ja")?.[0]?.name, "地殻");
  assert.equal(interiorLegend("earth", "ja")?.[0]?.depth, "0 km から 約 30 km");
  assert.deepEqual(interiorLegend("mars", "en")?.map((row) => row.depth), ["0 km to 1559.5 km", "1559.5 km to 3389.5 km"]);
  assert.equal(interiorLegend("moon", "en"), undefined);
});
