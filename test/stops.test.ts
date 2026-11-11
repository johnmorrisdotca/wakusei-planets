import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES, BODY_IDS, JOURNEY_STOPS, journeyStop, stopPlaceAu } from "../src/index.ts";

const at = Date.UTC(2026, 10, 2);
const G = 6.6743e-20;

// Pages read on 2026-11-04 (and, for the minor bodies, JPL's Small-Body Database on 2026-11-10) print no mass for these. A new body with no mass fails this list on purpose.
const NO_MASS = ["orcus", "quaoar", "gonggong", "sedna", "chiron", "pholus", "halley", "nereid", "vanth", "hiiaka", "namaka", "dysnomia"];

const apart = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

test("every body is a stop, and the fields are filled or honestly empty", () => {
  assert.equal(JOURNEY_STOPS.length, BODY_IDS.length);
  assert.deepEqual(JOURNEY_STOPS.map((stop) => stop.id), [...BODY_IDS]);
  const empty = JOURNEY_STOPS.filter((stop) => stop.gmKm3s2 === null).map((stop) => stop.id);
  assert.deepEqual(empty, NO_MASS);
  for (const id of BODY_IDS) {
    const stop = journeyStop(id);
    const facts = BODIES[id];
    assert.equal(stop.kind, facts.kind, id);
    assert.equal(stop.radiusKm, facts.radiusKm, id);
    assert.equal(stop.name.en, facts.name.en, id);
    assert.equal(stop.name.ja, facts.name.ja, id);
    assert.equal(stop.parent, facts.parent, id);
    assert.equal(stop.massKg === null, stop.gmKm3s2 === null, id);
    assert.equal(stop.escapeKmS === null, stop.gmKm3s2 === null, id);
    if (stop.gmKm3s2 !== null && stop.massKg !== null && stop.escapeKmS !== null) {
      assert.ok(stop.gmKm3s2 > 0 && stop.massKg > 0 && stop.escapeKmS > 0, id);
      assert.ok(Math.abs(stop.massKg - stop.gmKm3s2 / G) / stop.massKg < 1e-9, id);
    }
    if (id === "sun") assert.equal(stop.sunAu, 0);
    else assert.ok(stop.sunAu > 0, id);
  }
});

test("the published gravity and escape speeds are the pages' own figures", () => {
  const earth = journeyStop("earth");
  assert.equal(earth.gmKm3s2, 398_600.436);
  assert.equal(earth.escapeKmS, 11.19);
  assert.ok(Math.abs(earth.massKg! - 5.97217e24) / 5.97217e24 < 0.0001);
  assert.equal(journeyStop("sun").gmKm3s2, 132_712_000_000);
  assert.equal(journeyStop("sun").escapeKmS, 617.6);
  assert.equal(journeyStop("moon").gmKm3s2, 4_902.8);
  const moon = journeyStop("moon");
  assert.ok(Math.abs(moon.escapeKmS! - Math.sqrt((2 * moon.gmKm3s2!) / moon.radiusKm)) < 1e-12);
  const ceres = journeyStop("ceres");
  assert.equal(ceres.gmKm3s2, 938.416e18 * G);
  assert.equal(ceres.escapeKmS, 0.51);
  assert.ok(Math.abs(ceres.sunAu - 2.765) < 0.01);
  assert.ok(journeyStop("sedna").sunAu > 500);
  assert.equal(journeyStop("titan").parent, "saturn");
  assert.equal(journeyStop("io").sunAu, journeyStop("jupiter").sunAu);
});

test("a stop's place is the Sun, its orbit, or its parent plus the moon's offset", () => {
  assert.deepEqual(stopPlaceAu("sun", at), [0, 0, 0]);
  const earth = stopPlaceAu("earth", at);
  const earthAu = Math.hypot(...earth);
  assert.ok(earthAu > 0.98 && earthAu < 1.02, String(earthAu));
  const io = apart(stopPlaceAu("io", at), stopPlaceAu("jupiter", at));
  assert.ok(io > 0.002 && io < 0.004, String(io));
  const dysnomia = apart(stopPlaceAu("dysnomia", at), stopPlaceAu("eris", at));
  assert.ok(dysnomia > 0 && dysnomia < 0.001, String(dysnomia));
  const ceres = Math.hypot(...stopPlaceAu("ceres", at));
  assert.ok(ceres > 2.4 && ceres < 3.1, String(ceres));
});
