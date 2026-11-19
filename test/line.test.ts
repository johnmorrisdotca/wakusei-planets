import assert from "node:assert/strict";
import { test } from "node:test";
import { BODY_IDS, lineSvg, mix, ringOpacity, ringStrip, BODIES, portrait } from "../src/index.ts";

test("every body draws as one SVG with a title, in both languages", () => {
  for (const id of BODY_IDS) {
    const en = lineSvg(id, { size: 200 });
    assert.ok(en.startsWith("<svg") && en.endsWith("</svg>"), id);
    assert.ok(en.includes(`<title>`), id);
    assert.ok(en.includes(BODIES[id].name.en), id);
    assert.ok(lineSvg(id, { lang: "ja" }).includes(BODIES[id].name.ja), id);
    assert.ok(!/NaN|undefined/.test(en), `${id} has a bad number`);
  }
});

test("a portrait is the same every time, and a date changes it", () => {
  assert.equal(lineSvg("mars"), lineSvg("mars"));
  assert.notEqual(lineSvg("saturn", { time: Date.UTC(2017, 8, 15) }), lineSvg("saturn", { time: Date.UTC(2025, 2, 23) }));
});

test("Saturn is drawn with its rings, the Sun with rays, a planet with its moons", () => {
  assert.ok((lineSvg("saturn").match(/<path/g) ?? []).length > 20);
  assert.ok(lineSvg("sun").includes("stroke-linecap=\"round\""));
  const system = lineSvg("jupiter", { moons: true, time: Date.UTC(2026, 10, 2) });
  for (const name of ["Io", "Europa", "Ganymede", "Callisto"]) assert.ok(system.includes(name), name);
});

test("the pose of a portrait leans the pole by the body's own tilt", () => {
  const p = portrait("uranus");
  assert.ok(p.pole[0] > 0.9, "Uranus's pole lies nearly sideways");
  assert.ok(Math.abs(portrait("venus").pole[1]) > 0.9, "Venus is drawn nearly upright");
});

test("mix blends two colours", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
});

test("every ringed planet draws its rings", () => {
  for (const id of ["jupiter", "saturn", "uranus", "neptune"] as const) {
    const strip = ringStrip(BODIES[id], 256);
    assert.ok(strip !== null && strip.outer > strip.inner && strip.inner > 1, id);
    assert.ok((BODIES[id].rings ?? []).length >= 4, id);
  }
  for (const id of ["mercury", "venus", "earth", "mars"] as const) assert.equal(ringStrip(BODIES[id], 32), null, id);
});

test("a ring strip has soft, gapped bands: opaque in the B ring, clear in the Cassini division", () => {
  const strip = ringStrip(BODIES.saturn, 512)!;
  const alphaAt = (km: number): number => strip.data[Math.floor(((km / BODIES.saturn.radiusKm - strip.inner) / (strip.outer - strip.inner)) * strip.width) * 4 + 3]!;
  assert.ok(alphaAt(105000) > 150);
  assert.ok(alphaAt(119800) < 40);
  assert.equal(ringStrip(BODIES.mars, 64), null);
});

test("a ring band's opacity is 1 - exp(-tau), and a thin system is lifted to a floor in its strip", () => {
  assert.equal(ringOpacity(0), 0);
  assert.ok(Math.abs(ringOpacity(1) - 0.6321) < 1e-4 && Math.abs(ringOpacity(1e-6) - 1e-6) < 1e-12);
  for (const id of ["jupiter", "saturn", "uranus", "neptune"] as const) {
    const bands = BODIES[id].rings!;
    assert.deepEqual(bands.map((band) => band.alpha), bands.map((band) => ringOpacity(band.tau)), id);
    assert.ok(bands.every((band) => band.tau > 0 && band.alpha >= 0 && band.alpha < 1), id);
  }
  const peak = (id: "jupiter" | "saturn" | "uranus" | "neptune"): number => Math.max(...ringStrip(BODIES[id], 1024)!.data.filter((_, i) => i % 4 === 3)) / 255;
  assert.ok(Math.abs(peak("jupiter") - 0.12) < 0.005, "Jupiter's ring is lifted to the floor, and no further");
  assert.ok(Math.abs(peak("neptune") - 0.12) < 0.005, "so is Neptune's");
  assert.ok(peak("saturn") > 0.7 && peak("uranus") > 0.3, "a system above the floor is not changed");
  const jupiter = ringStrip(BODIES.jupiter, 1024)!;
  const alphaAt = (km: number): number => jupiter.data[Math.floor(((km / BODIES.jupiter.radiusKm - jupiter.inner) / (jupiter.outer - jupiter.inner)) * jupiter.width) * 4 + 3]!;
  assert.ok(alphaAt(125000) > 3 * alphaAt(150000) && alphaAt(150000) < 2, "and its dust and gossamer stay fainter than the main ring");
});
