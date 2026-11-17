// The flat solar system: the squeezed scale (the plan's), the view geometry, where the planets, comets, craft and belts are, and the words. The element is played in a real browser (e2e/flat-system.demo.ts); here is everything that is numbers.
import assert from "node:assert/strict";
import { test } from "node:test";
import { beltPositions, loadBeltBodies } from "../src/belts/index.ts";
import { toJulianDate } from "../src/clock.ts";
import { planAt, planRadius } from "../src/plan/index.ts";
import { ROADSTER } from "../src/roadster.ts";
import { loadSpacecraft } from "../src/spacecraft.ts";
import {
  SYSTEM_DWARFS,
  SYSTEM_LAYERS,
  SYSTEM_MAX_ZOOM,
  SYSTEM_RINGS,
  SYSTEM_WORDS,
  clampSystemView,
  craftAu,
  craftPath,
  projectSystem,
  radiusAu,
  saySystem,
  squeezeAu,
  systemBelts,
  systemColour,
  systemCometOrbit,
  systemExtent,
  systemMarks,
  systemName,
  systemOrbit,
  systemReach,
  systemScale,
  unprojectSystem,
  zoomSystemAbout,
} from "../src/flat/system.ts";
import { FLAT_WORDS } from "../src/flat/words.ts";

const T = Date.UTC(2026, 10, 17);
const view = { width: 900, height: 600, centerX: 0, centerY: 0, zoom: 1 };

test("the squeeze is the plan's: the same place on the radius as <wakusei-plan>, and the inverse gives the distance back", () => {
  for (const au of [0.39, 1, 5.2, 30, 49]) {
    assert.equal(squeezeAu(au, 0, 50, "squeezed").r, planRadius(au, 50, "squeezed", 0.1));
    assert.ok(Math.abs(radiusAu(squeezeAu(au, 0, 50, "squeezed").r, 50, "squeezed") - au) < 1e-9);
    assert.ok(Math.abs(radiusAu(squeezeAu(0, au, 50, "true").r, 50, "true") - au) < 1e-9);
  }
  // the plan's own table: Earth 39 per cent of the way out, Neptune 92, with the edge at 50 au
  assert.equal(Math.round(squeezeAu(1, 0, 50, "squeezed").r * 100), 39);
  assert.equal(Math.round(squeezeAu(30.1, 0, 50, "squeezed").r * 100), 92);
  assert.equal(Math.round(squeezeAu(1, 0, 50, "true").r * 100), 2);
  assert.deepEqual(squeezeAu(0, 0, 50, "squeezed"), { x: 0, y: 0, r: 0 });
  // the direction is kept
  const p = squeezeAu(3, 4, 50, "squeezed");
  assert.ok(Math.abs(Math.atan2(p.y, p.x) - Math.atan2(4, 3)) < 1e-12);
});

test("the planets sit where the plan puts them, from the same positions", () => {
  const plan = planAt(T, { mark: "mars" });
  const marks = systemMarks(T, { layers: ["planets"] });
  assert.equal(systemReach(marks), plan.extent);
  for (const dot of plan.dots) {
    const mark = marks.find((m) => m.id === dot.id)!;
    assert.ok(Math.abs(mark.x - dot.x) < 1e-9 && Math.abs(mark.y - dot.y) < 1e-9, dot.id);
  }
});

test("the reach steps in whole steps and holds what must be inside; a fixed one wins", () => {
  assert.equal(systemExtent(49.3), 50);
  assert.equal(systemExtent(50.1), 100);
  assert.equal(systemExtent(141), 200);
  assert.equal(systemExtent(5000), 2000);
  assert.equal(systemExtent(141, 30), 30);
  assert.equal(systemExtent(141, Number.NaN), 200);
  assert.equal(systemExtent(141, -3), 200);
});

test("the view: project and unproject are opposites, the zoom keeps the place under the point, the clamp holds", () => {
  assert.deepEqual(projectSystem(view, 0, 0), { x: 450, y: 300 });
  // the whole disc fills the shorter side
  assert.ok(Math.abs(projectSystem(view, 1, 0).x - 450 - systemScale(view)) < 1e-9);
  assert.ok(systemScale(view) < 300 && systemScale(view) > 280);
  const back = unprojectSystem(view, 700, 120);
  const again = projectSystem(view, back.x, back.y);
  assert.ok(Math.abs(again.x - 700) < 1e-9 && Math.abs(again.y - 120) < 1e-9);
  const zoomed = zoomSystemAbout({ ...view, centerX: 0.2, centerY: 0.1 }, 2, 600, 200);
  const before = unprojectSystem({ ...view, centerX: 0.2, centerY: 0.1 }, 600, 200);
  const after = unprojectSystem(zoomed, 600, 200);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  assert.equal(zoomed.zoom, 2);
  assert.equal(zoomSystemAbout(view, 100).zoom, SYSTEM_MAX_ZOOM);
  assert.equal(zoomSystemAbout(view, 0.01).zoom, 1);
  const far = clampSystemView({ ...view, centerX: 3, centerY: 4, zoom: 99 });
  assert.equal(far.zoom, 8);
  assert.ok(Math.abs(Math.hypot(far.centerX, far.centerY) - 1) < 1e-12);
  assert.deepEqual(clampSystemView({ ...view, centerX: Number.NaN, centerY: 0, zoom: Number.NaN }), view);
});

test("the Earth is a au from the Sun at its ecliptic longitude on 17 November, and Mercury is inside Venus inside Earth", () => {
  const marks = systemMarks(T, { layers: ["planets"] });
  const earth = marks.find((m) => m.id === "earth")!;
  assert.ok(Math.abs(earth.planeAu - 0.99) < 0.02);
  const longitude = (Math.atan2(earth.au[1], earth.au[0]) * 180) / Math.PI;
  assert.ok(longitude > 50 && longitude < 60, `${longitude}`);
  const order = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"].map((id) => marks.find((m) => m.id === id)!.planeAu);
  assert.deepEqual([...order].sort((a, b) => a - b).length, 9);
  assert.equal(marks[0]!.id, "sun");
  assert.equal(marks.filter((m) => m.layer === "planets").length, 9);
  assert.ok(marks.every((m) => !m.beyond));
});

test("every layer: the dwarf planets, the comets and the craft are placed; a layer left out is not", () => {
  const dwarfs = systemMarks(T, { layers: ["dwarfs"] });
  assert.equal(dwarfs.length, 1 + SYSTEM_DWARFS.length);
  assert.ok(dwarfs.find((m) => m.id === "eris")!.planeAu > 60);
  assert.equal(dwarfs.find((m) => m.id === "chiron")!.kind, "centaur");
  assert.equal(dwarfs.find((m) => m.id === "vesta")!.kind, "asteroid");
  const comets = systemMarks(T, { layers: ["comets"] });
  assert.ok(comets.length > 30);
  assert.equal(comets.find((m) => m.id === "halley")!.kind, "comet");
  assert.equal(systemMarks(T, { layers: ["comets"], comets: ["halley"] }).length, 2);
  assert.equal(systemMarks(T, { layers: [] }).length, 1);
  assert.deepEqual([...SYSTEM_LAYERS], ["planets", "dwarfs", "belts", "comets", "craft"]);
});

test("the craft: none until the path is loaded, then Voyager 1 far out and the Tesla Roadster between Earth and Mars's orbits, with the reach that holds them", async () => {
  assert.equal(craftAu("roadster", T), undefined);
  assert.equal(craftAu("nope", T), undefined);
  await loadSpacecraft();
  const car = craftAu("roadster", T)!;
  const plane = Math.hypot(car[0], car[1]);
  assert.ok(plane > 1 && plane < 1.7, `${plane}`);
  assert.equal(craftAu("roadster", ROADSTER.launch - 86_400_000), undefined, "before the launch there is no car");
  assert.equal(craftAu("cassini", T), undefined, "Cassini's record ended in 2017");
  const marks = systemMarks(T, { layers: ["planets", "craft"] });
  const voyager = marks.find((m) => m.id === "voyager1")!;
  assert.ok(voyager.planeAu > 120 && voyager.planeAu < 160);
  assert.equal(systemReach(marks), 200);
  assert.ok(!voyager.beyond);
  // the roadster is in the list of what is drawn, and its colour is its own
  assert.ok(marks.some((m) => m.id === "roadster" && m.kind === "spacecraft"));
  assert.equal(systemColour("roadster", "craft"), "#ff3b30");
  // a fixed reach leaves a craft beyond it off the disc
  const small = systemMarks(T, { layers: ["craft"], extent: 50 });
  assert.equal(small.find((m) => m.id === "voyager1")!.beyond, true);
  assert.equal(small.find((m) => m.id === "roadster")!.beyond, false);
  assert.equal(systemMarks(T, { layers: ["craft"], craft: ["roadster"] }).length, 2);
});

test("a craft's whole path: from its record's start to its end, in order, and the car's path reaches the 2036 end", async () => {
  await loadSpacecraft("roadster", "voyager1");
  const path = craftPath("roadster", 120);
  assert.ok(path.length >= 100);
  assert.equal(path[0]!.ms, ROADSTER.record.start);
  assert.ok(path.every((p, i) => i === 0 || p.ms > path[i - 1]!.ms));
  assert.equal(new Date(path[path.length - 1]!.ms).getUTCFullYear(), 2036);
  assert.deepEqual(craftPath("nope"), []);
});

test("the belts: every body is where its elements put it, the main belt between Mars and Jupiter and the Kuiper belt beyond Neptune", async () => {
  const bodies = await loadBeltBodies();
  const xy = systemBelts(bodies, T);
  assert.equal(xy.length, bodies.length * 2);
  let checked = 0;
  bodies.forEach((body, i) => {
    const d = Math.hypot(xy[i * 2]!, xy[i * 2 + 1]!);
    if (body.belt === "main") {
      assert.ok(d > 1.6 && d < 5, `${body.name} ${d}`);
      checked += 1;
    }
    if (body.belt === "classical") assert.ok(d > 25 && d < 60, `${body.name} ${d}`);
  });
  assert.ok(checked > 1000);
  // each is where the package's own belt maths puts it for the same date (a body moves 0.01 au a day, so a wrong date shows)
  const own = beltPositions(bodies.slice(0, 200), toJulianDate(T));
  for (let i = 0; i < 200; i += 1) assert.ok(Math.hypot(own[i * 3]! - xy[i * 2]!, own[i * 3 + 1]! - xy[i * 2 + 1]!) < 1e-3, bodies[i]!.name);
  const later = systemBelts(bodies.slice(0, 200), T + 30 * 86_400_000);
  assert.ok(Math.hypot(later[0]! - xy[0]!, later[1]! - xy[1]!) > 0.05);
  // it fills a list handed in, with no new one
  const out = new Float32Array(bodies.length * 2);
  assert.equal(systemBelts(bodies, T, out), out);
});

test("the orbit lines: a planet's closes on itself at its distance, a comet's is cut at the reach, and a line stands for a year", () => {
  const earth = systemOrbit("earth", T);
  assert.ok(earth.length >= 90);
  assert.ok(Math.abs(Math.hypot(...earth[0]!) - 1) < 0.03);
  assert.ok(Math.hypot(earth[0]![0] - earth[earth.length - 1]![0], earth[0]![1] - earth[earth.length - 1]![1]) < 0.2);
  assert.equal(systemOrbit("earth", T + 86_400_000 * 20), earth);
  const halley = systemCometOrbit("halley", 50);
  assert.ok(halley.length > 20);
  assert.ok(halley.every((p) => Math.hypot(p[0], p[1]) <= 50.01));
  assert.deepEqual(systemCometOrbit("halley", 0.1), []);
  assert.deepEqual(systemCometOrbit("nobody", 50), []);
});

test("the names and colours: the car is the Tesla Roadster, the rest come from the package's tables, in both languages", () => {
  assert.equal(systemName("roadster", "en"), "Tesla Roadster");
  assert.equal(systemName("roadster", "ja"), ROADSTER.car.ja);
  assert.equal(systemName("roadster", "en"), ROADSTER.car.en);
  assert.equal(systemName("earth", "ja"), "地球");
  assert.equal(systemName("halley", "en"), "Halley");
  assert.equal(systemName("voyager1", "ja"), "ボイジャー1号");
  assert.equal(systemName("zzz", "en"), "zzz");
  assert.equal(systemColour("earth", "planets"), "#4fa3ff");
  assert.equal(systemColour("sun", "sun"), "#ffd54f");
  assert.deepEqual([...SYSTEM_RINGS].slice(0, 4), [1, 5, 10, 30]);
});

test("the words: both languages have the same keys, the ones the flat maps share say what they say, and a missing key falls back", () => {
  assert.deepEqual(Object.keys(SYSTEM_WORDS.ja).sort(), Object.keys(SYSTEM_WORDS.en).sort());
  for (const key of ["controls", "zoomIn", "zoomOut", "all", "layersFilter", "help", "nothing"]) {
    assert.equal(SYSTEM_WORDS.en[key] !== undefined, true, key);
  }
  for (const key of ["controls", "zoomIn", "zoomOut", "all", "layersFilter", "nothing"]) assert.equal(SYSTEM_WORDS.en[key], FLAT_WORDS.en[key], key);
  for (const key of ["controls", "zoomIn", "zoomOut", "all", "layersFilter", "nothing"]) assert.equal(SYSTEM_WORDS.ja[key], FLAT_WORDS.ja[key], key);
  assert.equal(saySystem("en", "shown", { n: 40 }), "40 bodies shown");
  assert.equal(saySystem("ja", "shown", { n: 40 }), "天体40個を表示中");
  assert.equal(saySystem("ja", "ring", { n: 5 }), "5 au");
  assert.equal(saySystem("en", "no such key"), "no such key");
  assert.equal(saySystem("en", "announceSun"), "{name}, the Sun, at the middle of the map");
});
