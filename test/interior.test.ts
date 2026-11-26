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
  for (const id of ["venus", "uranus", "neptune", "io", "europa", "ganymede", "titan"]) {
    assert.equal(interiorOf(id), undefined, id);
  }
});

test("the Moon, Mercury, the Sun, Jupiter and Saturn use one named model each (MODULES-1691)", () => {
  const moon = interiorOf("moon");
  assert.ok(moon);
  assert.equal(moon.radiusKm, 1737.4);
  assert.equal(moon.source.read, "2026-11-26");
  assert.deepEqual(moon.layers.map((layer) => [layer.id, layer.outerKm, layer.about]), [
    ["inner-core", 240, false],
    ["outer-core", 330, false],
    ["mantle", 1697.4, true],
    ["crust", 1737.4, false],
  ]);
  const mercury = interiorOf("mercury");
  assert.ok(mercury);
  assert.equal(mercury.radiusKm, 2439.7);
  assert.deepEqual(mercury.layers.map((layer) => [layer.id, layer.outerKm, layer.about]), [
    ["core", 2074, true],
    ["mantle-crust", 2439.7, false],
  ]);
  const sun = interiorOf("sun");
  assert.ok(sun);
  assert.equal(sun.radiusKm, 695700);
  assert.deepEqual(sun.layers.map((layer) => [layer.id, layer.outerKm, layer.about]), [
    ["core", 138000, true],
    ["outside-core", 695700, false],
  ]);
  const jupiter = interiorOf("jupiter");
  assert.ok(jupiter);
  assert.equal(jupiter.radiusKm, 69911);
  assert.deepEqual(jupiter.layers.map((layer) => [layer.outerKm, layer.about]), [
    [0.41 * 69911, true],
    [0.63 * 69911, true],
    [0.72 * 69911, false],
    [0.83 * 69911, false],
    [69911, false],
  ]);
  const saturn = interiorOf("saturn");
  assert.ok(saturn);
  assert.equal(saturn.radiusKm, 58232);
  assert.deepEqual(saturn.layers.map((layer) => [layer.outerKm, layer.about]), [
    [0.6 * 58232, true],
    [58232, false],
  ]);
  assert.equal(interiorLegend("moon", "en")?.[0]?.depth, "0 km to about 40 km");
  assert.equal(interiorLegend("moon", "ja")?.[0]?.name, "地殻");
  assert.equal(interiorLegend("mercury", "en")?.[0]?.depth, "0 km to about 365.7 km");
  assert.equal(interiorLegend("mercury", "ja")?.[0]?.name, "マントルと地殻");
  assert.equal(interiorLegend("sun", "en")?.[0]?.depth, "0 km to about 557700 km");
  assert.equal(interiorLegend("sun", "en")?.[0]?.name, "Radiative and convective zones");
  assert.equal(interiorLegend("sun", "ja")?.[0]?.name, "放射層と対流層");
  assert.equal(interiorLegend("jupiter", "en")?.length, 5);
  assert.equal(interiorLegend("jupiter", "ja")?.[3]?.name, "遷移層");
  assert.equal(interiorLegend("jupiter", "ja")?.[4]?.name, "均質な内層");
  assert.equal(interiorLegend("saturn", "ja")?.[1]?.name, "境界のぼやけた核");
  assert.equal(interiorLegend("earth", "ja")?.[2]?.madeOf, "鉄とニッケル、液体");
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
  assert.equal(interiorLegend("venus", "en"), undefined);
});
