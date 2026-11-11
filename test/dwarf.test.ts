import assert from "node:assert/strict";
import { test } from "node:test";
import { kepler, moonVector } from "../src/ephemeris.ts";
import { BODIES, BODY_IDS, DWARF_IDS, heliocentric, lineSvg, MOONS_OF } from "../src/index.ts";
import { portrait, silhouette } from "../src/pose.ts";
import { length, sub } from "../src/vec.ts";

// JPL Horizons, heliocentric ecliptic J2000 vectors for 2026-11-03 00:00 TDB (ssd.jpl.nasa.gov/api/horizons.api, read 2026-11-03), in au.
const HORIZONS: Record<string, [number, number, number]> = {
  ceres: [-0.0669408055, 2.6459854504, 0.0960958735],
  eris: [85.0665427457, 39.7248311994, -17.2125720475],
  haumea: [-36.5957410406, -24.1418484235, 23.5064837913],
  sedna: [38.6363460123, 71.2516364963, -16.9893620358],
  quaoar: [8.5906874499, -41.3032761248, 5.9154631203],
};

test("the dwarf planets are where JPL Horizons has them, within 0.0002 au", () => {
  for (const [id, expected] of Object.entries(HORIZONS)) {
    const got = heliocentric(id as "ceres", Date.UTC(2026, 10, 3));
    assert.ok(length(sub(got, expected)) < 2e-4, `${id}: ${length(sub(got, expected))}`);
  }
});

test("there are eight dwarf planets besides Pluto, each a body with the facts of one", () => {
  assert.equal(DWARF_IDS.length, 8);
  for (const id of DWARF_IDS) {
    assert.ok(BODY_IDS.includes(id), id);
    assert.equal(BODIES[id].kind, "dwarf-planet");
    assert.equal(BODIES[id].parent, undefined);
    assert.ok(BODIES[id].radiusKm > 400 && BODIES[id].radiusKm < 1200, id);
  }
  assert.deepEqual(MOONS_OF.eris, ["dysnomia"]);
  assert.deepEqual(MOONS_OF.haumea, ["hiiaka", "namaka"]);
  assert.deepEqual(MOONS_OF.orcus, ["vanth"]);
});

test("the dwarf planets' moons are as far from their planet as their published orbits say, at the epoch of each", () => {
  const dys = length(moonVector("dysnomia", Date.UTC(2006, 7, 29, 12)));
  assert.ok(Math.abs(dys - 37273) < 37273 * 0.0062 * 1.1, String(dys));
  const vanth = length(moonVector("vanth", (2454439.28 - 2440587.5) * 86_400_000));
  assert.ok(Math.abs(vanth - 8980) < 1, String(vanth));
  const namaka = length(moonVector("namaka", (2454615 - 2440587.5) * 86_400_000));
  assert.ok(namaka > 25657 * (1 - 0.249) && namaka < 25657 * (1 + 0.249));
  const hiiaka = length(moonVector("hiiaka", (2454615 - 2440587.5) * 86_400_000));
  assert.ok(hiiaka > 49880 * (1 - 0.0513) && hiiaka < 49880 * (1 + 0.0513));
});

test("Haumea is drawn as the long shape it is, and its line drawing is not a circle", () => {
  const f = BODIES.haumea;
  const axes = f.axesKm!.map((k) => k / f.radiusKm) as [number, number, number];
  const s = silhouette(portrait("haumea", { pitch: 0, tilt: 0 }), 0, axes);
  assert.ok(s.a / s.b > 1.3, `${s.a} ${s.b}`);
  assert.ok(f.axesKm![0] / f.axesKm![2] > 2, "about two to one along its longest axis");
  assert.ok(Math.abs(f.rotationHours - 3.915341) < 1e-6);
  assert.ok(lineSvg("haumea").includes("<ellipse"));
});

test("every dwarf planet and moon has a line drawing in both languages", () => {
  for (const id of [...DWARF_IDS, "dysnomia", "hiiaka", "namaka", "vanth"] as const) {
    assert.ok(lineSvg(id).includes(BODIES[id].name.en), id);
    assert.ok(lineSvg(id, { lang: "ja" }).includes(BODIES[id].name.ja), id);
  }
});

test("Kepler's equation is solved for a long orbit like Sedna's (e 0.86) at every mean anomaly, positive or negative", () => {
  for (const e of [0.5, 0.8, 0.86, 0.95]) {
    for (let k = -180; k <= 180; k += 7) {
      const m = (k * Math.PI) / 180;
      const E = kepler(m, e);
      assert.ok(Math.abs(E - e * Math.sin(E) - m) < 1e-9, `e ${e}, M ${k} degrees: ${E - e * Math.sin(E) - m}`);
    }
  }
});
