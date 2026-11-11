// The minor bodies: Vesta, Pallas, Chiron, Pholus and Halley's comet as bodies with the facts of one, placed from tables fitted to JPL Horizons (accuracy is in accuracy.test.ts), in the space view's frame.
import assert from "node:assert/strict";
import { test } from "node:test";
import { heliocentric, heliocentricModel, poleOf } from "../src/ephemeris.ts";
import { BODIES, BODY_IDS, lineSvg, MINOR_IDS } from "../src/index.ts";
import { tableOf } from "../src/data/tables.ts";
import { frameAt, planetOrbit, radiusIn, SPACE_MINORS } from "../src/space/index.ts";
import { cross, DEG, dot, length, sub } from "../src/vec.ts";
import "../src/tables/all.ts";

const ms = Date.UTC(2026, 10, 10, 12);

test("there are five minor bodies, each a body of its kind with the facts of one", () => {
  assert.deepEqual([...MINOR_IDS], ["vesta", "pallas", "chiron", "pholus", "halley"]);
  const kinds = { vesta: "asteroid", pallas: "asteroid", chiron: "centaur", pholus: "centaur", halley: "comet" } as const;
  for (const id of MINOR_IDS) {
    assert.ok(BODY_IDS.includes(id), id);
    assert.equal(BODIES[id].kind, kinds[id]);
    assert.equal(BODIES[id].parent, undefined);
    assert.ok(BODIES[id].name.en.length > 0 && BODIES[id].name.ja.length > 0, id);
    assert.ok(BODIES[id].radiusKm > 1 && BODIES[id].radiusKm < 300, id);
  }
  // the sizes JPL's Small-Body Database gives (read 2026-11-10): Vesta 569.24 x 554.48 x 452.66 km, Pallas 568 x 532 x 448 km, Halley 14.9 x 8.2 km
  assert.ok(Math.abs(BODIES.vesta.axesKm![0] * 2 - 569.24) < 1 && Math.abs(BODIES.vesta.axesKm![2] * 2 - 452.66) < 1);
  assert.ok(Math.abs(BODIES.pallas.axesKm![0] * 2 - 568) < 1 && Math.abs(BODIES.pallas.axesKm![2] * 2 - 448) < 1);
  assert.ok(Math.abs(BODIES.halley.axesKm![0] * 2 - 14.9) < 0.1);
  assert.ok(Math.abs(BODIES.vesta.rotationHours - 5.3421276) < 1e-6 && Math.abs(BODIES.pallas.rotationHours - 7.8132214) < 1e-6);
});

test("each one has a line drawing in both languages, and a table of its own", () => {
  for (const id of MINOR_IDS) {
    assert.ok(lineSvg(id).includes(BODIES[id].name.en), id);
    assert.ok(lineSvg(id, { lang: "ja" }).includes(BODIES[id].name.ja), id);
    assert.ok(tableOf(id) !== undefined, id);
    assert.equal(heliocentricModel(id, ms).theory, "chebyshev", id);
    assert.ok(heliocentricModel(id, ms).worstArcseconds! <= 1.0001, id);
  }
});

test("a minor body is on its published orbit: its distance from the Sun is between its perihelion and its aphelion", () => {
  // Horizons' own elements (OBJ_DATA, read 2026-11-10): perihelion and aphelion in au
  const reach: Record<string, [number, number]> = { vesta: [2.15, 2.58], pallas: [2.13, 3.42], chiron: [8.4, 18.9], pholus: [8.69, 31.92], halley: [0.574, 35.29] };
  for (const id of MINOR_IDS) {
    const [q, Q] = reach[id]!;
    for (let k = 0; k < 40; k += 1) {
      const r = length(heliocentric(id, ms + k * 400 * 86_400_000));
      assert.ok(r > q - 0.05 && r < Q + 0.05, `${id}: ${r.toFixed(3)} au`);
    }
  }
});

test("a body that turns, turns about its axis the way its tilt says: Vesta 27 degrees from its orbit's pole and Pallas on its side", () => {
  for (const id of ["vesta", "pallas", "chiron", "pholus"] as const) {
    const f = BODIES[id];
    const a = heliocentric(id, ms);
    const b = heliocentric(id, ms + 86_400_000);
    const r = cross(a, sub(b, a));
    const normal: [number, number, number] = [r[0] / length(r), r[1] / length(r), r[2] / length(r)];
    const pole = poleOf(id);
    const tilt = Math.acos(Math.max(-1, Math.min(1, dot(pole, normal)))) * DEG;
    assert.ok(Math.abs(tilt - f.tiltDeg) < 3.5, `${id}: ${tilt.toFixed(2)} degrees from its orbit's pole, facts say ${f.tiltDeg}`);
  }
});

test("the space view's frame holds them, each as far from the Earth as it is from the Sun to within an astronomical unit, and the compressed scale gives each a size to see", () => {
  const frame = frameAt(ms);
  assert.deepEqual(Object.keys(frame.minors).sort(), [...SPACE_MINORS].sort());
  for (const id of SPACE_MINORS) {
    const fromSun = length(heliocentric(id, ms));
    const fromEarth = length(frame.minors[id]);
    assert.ok(Math.abs(fromEarth - fromSun) <= 1.0001, `${id}: ${fromEarth.toFixed(2)} au from the Earth, ${fromSun.toFixed(2)} from the Sun`);
    assert.equal(radiusIn(id, "true"), BODIES[id].radiusKm / 6378.137);
    assert.ok(radiusIn(id, "compressed") >= 0.2);
  }
});

test("an orbit line goes once round: it starts at the body, and ends near where it started (the comet's cut at equal steps of its anomaly, so its turn near the Sun has as many points as its far side)", () => {
  for (const id of SPACE_MINORS) {
    const line = planetOrbit(id, ms, 96);
    assert.equal(line.length, 97);
    const first = line[0]!;
    const here = frameAt(ms).minors[id];
    const sun = frameAt(ms).sun;
    // the first point is the body's own place from the Sun
    assert.ok(length(sub(first, [here[0] - sun[0], here[1] - sun[1], here[2] - sun[2]])) < 1e-3 * Math.max(1, length(first)), id);
    const size = Math.max(...line.map(length));
    assert.ok(length(sub(line[96]!, first)) < 0.15 * size, `${id}: the line ends ${length(sub(line[96]!, first)).toFixed(2)} au from where it began`);
  }
  // Halley's line has points close to the Sun and far from it
  const halley = planetOrbit("halley", ms, 96).map(length);
  assert.ok(Math.min(...halley) < 1.5 && Math.max(...halley) > 30);
});
