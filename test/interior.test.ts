import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { lineSvg } from "../src/line.ts";
import { createCutaway } from "../src/scene/cutaway.ts";
import { cutOpening, inCutOpening, interiorDepthHeading, interiorLegend, interiorOf } from "../src/interior.ts";

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
  assert.equal(interiorLegend("mercury", "en")?.[0]?.depth, "0 km to about 366 km");
  assert.equal(interiorLegend("mercury", "ja")?.[0]?.name, "マントルと地殻");
  assert.equal(interiorLegend("sun", "en")?.[0]?.depth, "0 km to about 558,000 km");
  assert.equal(interiorLegend("sun", "en")?.[0]?.name, "Radiative and convective zones");
  assert.equal(interiorLegend("sun", "ja")?.[0]?.name, "放射層と対流層");
  assert.equal(interiorLegend("sun", "ja")?.[1]?.madeOf, "水素がヘリウムに変わる");
  assert.equal(interiorLegend("jupiter", "en")?.length, 5);
  assert.equal(interiorLegend("jupiter", "en")?.[0]?.depth, "0 km to 11,900 km");
  assert.equal(interiorLegend("jupiter", "en")?.[2]?.depth, "19,600 km to about 25,900 km");
  assert.equal(interiorLegend("jupiter", "en")?.[1]?.madeOf, "helium falls as droplets");
  assert.equal(interiorLegend("jupiter", "ja")?.[1]?.madeOf, "ヘリウムが液滴になって沈む");
  assert.equal(interiorLegend("jupiter", "ja")?.[3]?.name, "遷移層");
  assert.equal(interiorLegend("jupiter", "ja")?.[4]?.name, "均質な内層");
  assert.equal(interiorLegend("saturn", "ja")?.[1]?.name, "境界のぼやけた核");
  assert.equal(interiorLegend("saturn", "ja")?.[1]?.madeOf, "氷と岩石が混ざっている");
  assert.equal(interiorLegend("earth", "ja")?.[2]?.madeOf, "鉄とニッケル、液体");
  assert.equal(interiorDepthHeading("en"), "From the surface down");
  assert.equal(interiorDepthHeading("ja"), "表面から下へ");
  assert.equal(inCutOpening([0, 0, 1]), true);
  assert.equal(inCutOpening([1, 0, 0]), false);
});

test("the legend lists each layer from the surface, outermost first, in English and Japanese", () => {
  assert.deepEqual(interiorLegend("earth", "en")?.map((row) => [row.name, row.depth, row.madeOf]), [
    ["Crust", "0 km to about 30 km", "rock"],
    ["Mantle", "about 30 km to 2,890 km", "rock"],
    ["Outer core", "2,890 km to about 5,150 km", "iron and nickel, fluid"],
    ["Inner core", "about 5,150 km to 6,370 km", "iron and nickel, solid"],
  ]);
  assert.equal(interiorLegend("earth", "ja")?.[0]?.name, "地殻");
  assert.equal(interiorLegend("earth", "ja")?.[0]?.depth, "0 km から 約30 km");
  assert.deepEqual(interiorLegend("mars", "en")?.map((row) => row.depth), ["0 km to 1,560 km", "1,560 km to 3,390 km"]);
  assert.equal(interiorLegend("venus", "en"), undefined);
});

test("the SVG shows the approved layers and only the approved flow bands move", () => {
  const earth = lineSvg("earth", { cutaway: true, size: 240 });
  const flowing = lineSvg("earth", { cutaway: true, size: 240, cutawaySeconds: 2 });
  assert.match(earth, /aria-label="Earth cross-section"/);
  assert.notEqual(earth, flowing);
  assert.deepEqual(earth.match(/<path data-layer[^>]+>/g), flowing.match(/<path data-layer[^>]+>/g));
  assert.match(earth, /data-magma/);
  assert.equal(lineSvg("sun", { cutaway: true, cutawaySeconds: 2 }), lineSvg("sun", { cutaway: true }));
  assert.equal(lineSvg("iapetus", { cutaway: true }), lineSvg("iapetus"));
});

test("half and quarter faces share the camera opening and release their resources", () => {
  const earth = interiorOf("earth")!;
  for (const size of ["half", "quarter"] as const) {
    const [centre, halfWidth] = cutOpening(size);
    const sample = (angle: number) => [Math.sin(angle), 0, Math.cos(angle)] as const;
    assert.equal(inCutOpening(sample(centre), size), true);
    assert.equal(inCutOpening(sample(centre + halfWidth + .01), size), false);
    assert.equal(inCutOpening(sample(centre - halfWidth - .01), size), false);
    const cut = createCutaway(THREE, earth, size);
    const shape = cut.faceMesh.geometry;
    const positions = shape.getAttribute("position");
    for (const [j, angle] of [centre + halfWidth, centre - halfWidth].entries()) {
      const equator = j * positions.count / 2 + (earth.layers.length - 1) * 97 * 2 + 97;
      assert.ok(Math.abs(positions.getX(equator) - Math.sin(angle)) < 1e-6);
      assert.ok(Math.abs(positions.getZ(equator) - Math.cos(angle)) < 1e-6);
    }
    cut.setTime(2.5);
    assert.equal(cut.faceMesh.material.uniforms.uTime?.value, 2.5);
    let disposed = 0;
    for (const resource of [shape, cut.faceMesh.material]) resource.addEventListener("dispose", () => { disposed++; });
    cut.dispose();
    assert.equal(disposed, 2);
  }
});
