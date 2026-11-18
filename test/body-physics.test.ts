// The physics sheets (MODULES-1553): every figure is a fact read from NASA's NSSDC planetary fact sheets on 2026-11-18, with the page and the day it was read. The numbers below are the ones the pages print, checked by hand against the saved copies.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bodyPhysics, PHYSICS_IDS } from "../src/body-physics.ts";

test("there is a sheet for the Sun, the eight planets, Pluto and the Moon, and none for anything else", () => {
  assert.equal(PHYSICS_IDS.length, 11);
  for (const id of PHYSICS_IDS) assert.equal(bodyPhysics(id).id, id);
  assert.equal(bodyPhysics("ceres"), null, "a dwarf planet has no sheet");
  assert.equal(bodyPhysics("io"), null, "nor has another planet's moon");
  assert.equal(bodyPhysics(""), null);
  assert.notEqual(bodyPhysics("earth"), bodyPhysics("earth"), "a new object each call");
});

test("the masses, GMs and surface gravities are what the pages print", () => {
  const rows: [string, number, number, number][] = [
    ["sun", 1.9884e30, 1.32712e11, 274.0],
    ["mercury", 3.301e23, 22032, 3.7],
    ["venus", 4.8673e24, 324860, 8.87],
    ["earth", 5.9722e24, 398600, 9.82],
    ["moon", 7.346e22, 4900, 1.62],
    ["mars", 6.4169e23, 42828, 3.73],
    ["jupiter", 1.89813e27, 1.26687e8, 25.92],
    ["saturn", 5.6832e26, 3.7931e7, 11.19],
    ["uranus", 8.6811e25, 5.794e6, 9.01],
    ["neptune", 1.02409e26, 6.8351e6, 11.27],
    ["pluto", 1.303e22, 870, 0.62],
  ];
  for (const [id, mass, gm, gravity] of rows) {
    const p = bodyPhysics(id as never);
    assert.equal(p.mass?.value, mass, `${id} mass`);
    assert.equal(p.gm?.value, gm, `${id} GM`);
    assert.equal(p.surfaceGravity?.value, gravity, `${id} gravity`);
    // the mass and GM agree: GM = G M, G = 6.6743e-11, to the digits the pages print
    assert.ok(Math.abs((p.gm!.value * 1e9) / (p.mass!.value * 6.6743e-11) - 1) < 0.002, `${id}: GM and mass agree`);
  }
});

test("the gas giants' gravity, air density, pressure and temperature are at the 1 bar level, and say so", () => {
  for (const [id, density, kelvin] of [["jupiter", 0.16, 165], ["saturn", 0.19, 134], ["uranus", 0.42, 76], ["neptune", 0.45, 72]] as const) {
    const p = bodyPhysics(id);
    assert.equal(p.surfaceGravity?.level, "1 bar", id);
    assert.equal(p.airDensity?.value, density);
    assert.equal(p.airDensity?.level, "1 bar");
    assert.equal(p.pressure?.value, 100_000);
    assert.equal(p.pressure?.level, "1 bar");
    assert.equal(p.temperature?.value, kelvin);
    assert.equal(p.temperature?.level, "1 bar");
  }
  assert.equal(bodyPhysics("earth").surfaceGravity?.level, undefined);
});

test("the rocky planets' air: Earth, Venus and Mars as the pages give it; none where the page has none", () => {
  const earth = bodyPhysics("earth");
  assert.deepEqual([earth.pressure?.value, earth.airDensity?.value, earth.temperature?.value], [101_400, 1.217, 288]);
  const venus = bodyPhysics("venus");
  assert.deepEqual([venus.pressure?.value, venus.airDensity?.value, venus.airDensity?.bound, venus.temperature?.value], [9_200_000, 65, "about", 737]);
  const mars = bodyPhysics("mars");
  assert.deepEqual([mars.pressure?.value, mars.pressure?.low, mars.pressure?.high, mars.airDensity?.value, mars.airDensity?.uncertainty, mars.temperature?.value], [636, 400, 870, 0.016, 0.006, 214]);
  for (const id of ["sun", "mercury", "moon", "pluto"] as const) assert.equal(bodyPhysics(id).airDensity, null, `${id} has no air density`);
});

test("a sheet that gives a limit, an approximation or a range keeps it, and a range with no single figure has none", () => {
  assert.equal(bodyPhysics("mercury").pressure?.bound, "below");
  assert.equal(bodyPhysics("mercury").pressure?.value, 5e-10);
  assert.equal(bodyPhysics("pluto").pressure?.bound, "about");
  assert.equal(bodyPhysics("pluto").pressure?.value, 1.3);
  const moon = bodyPhysics("moon");
  assert.equal(moon.temperature?.value, null);
  assert.deepEqual([moon.temperature?.low, moon.temperature?.high], [95, 390]);
  assert.match(moon.pressure?.note ?? "", /night/);
  const pluto = bodyPhysics("pluto");
  assert.equal(pluto.temperature?.value, null);
  assert.deepEqual([pluto.temperature?.low, pluto.temperature?.high], [24, 38]);
  assert.equal(bodyPhysics("sun").pressure?.level, "top of photosphere");
  assert.equal(bodyPhysics("sun").temperature?.value, 5772);
});

test("every figure names its page, the day the page says it was updated, and the day it was read", () => {
  for (const id of PHYSICS_IDS) {
    const p = bodyPhysics(id);
    for (const reading of [p.mass, p.gm, p.surfaceGravity, p.airDensity, p.pressure, p.temperature]) {
      if (reading === null) continue;
      assert.equal(reading.source.url, `https://nssdc.gsfc.nasa.gov/planetary/factsheet/${id}fact.html`);
      assert.equal(reading.source.read, "2026-11-18");
      assert.match(reading.source.pageUpdated, /^20(24|25)-\d\d-\d\d$/);
      assert.ok(reading.source.pageUpdated <= reading.source.read);
      assert.match(reading.source.name, /^NASA NSSDC Planetary Fact Sheet: /);
    }
  }
  assert.equal(bodyPhysics("mars").mass?.source.pageUpdated, "2025-05-19");
  assert.equal(bodyPhysics("earth").mass?.source.pageUpdated, "2024-11-15");
  // the source of a figure is its own object: changing one does not change the next call
  const first = bodyPhysics("earth");
  first.mass!.source.read = "1999-01-01";
  assert.equal(bodyPhysics("earth").mass?.source.read, "2026-11-18");
});

test("pressures in pascals carry no float noise, and every figure is finite and positive", () => {
  for (const id of PHYSICS_IDS) {
    const p = bodyPhysics(id);
    for (const reading of [p.mass, p.gm, p.surfaceGravity, p.airDensity, p.pressure, p.temperature]) {
      if (reading === null || reading.value === null) continue;
      assert.ok(Number.isFinite(reading.value) && reading.value > 0, `${id}`);
      assert.equal(Number(reading.value.toPrecision(12)), reading.value, `${id}: ${reading.value}`);
    }
  }
});
