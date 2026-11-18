// A planet's moons by family (`moonFamilies`), the key to the orbit colours (`moonOrbitKey`), an orbit as a line (`catalogueMoonOrbit`), the space view's choice of planets that show every moon (`moons`, `moons-of`), and the
// moon layer that draws the dots and the orbits: once for a scale, a colouring and a month, and only moved after that.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MOON_CATALOGUE,
  catalogueMoonOrbit,
  catalogueMoonPosition,
  catalogueMoonsOf,
  findCatalogueMoon,
  moonFamilies,
  moonOrbitColor,
  moonOrbitKey,
  type HostId,
  type MoonFamilyId,
} from "../src/moon-catalogue.ts";
import { createMoonLayer, MOON_ORBIT_KEEP_MS, MOON_ORBIT_OPACITY, MOON_ORBIT_POINTS, moonDotOffset, type DotsThree, type MoonLayerInput } from "../src/space/all-moons.ts";
import { catalogueMoonIdOf, catalogueMoonKey, hostsShowingAll, moonSourceOf, MOON_HOSTS, readMoonColors, readMoonsChoice, readMoonsOf } from "../src/space/moon-settings.ts";
import * as catalogue from "../src/moon-catalogue.ts";

const HOSTS = [...new Set(MOON_CATALOGUE.map((m) => m.host))] as HostId[];
const FAMILIES: Record<string, MoonFamilyId[]> = {
  jupiter: ["galilean", "inner", "himalia", "ananke", "carme", "pasiphae", "other"],
  saturn: ["inner", "inuit", "gallic", "norse"],
  uranus: ["inner", "irregular"],
  neptune: ["inner", "irregular"],
};

test("every host's moons are in exactly one family, in the families the brief names, nearest first", () => {
  for (const host of HOSTS) {
    const families = moonFamilies(host);
    assert.deepEqual(families.map((f) => f.id), FAMILIES[host] ?? ["moons"], host);
    const ids = families.flatMap((f) => f.moons.map((m) => m.id));
    assert.equal(ids.length, new Set(ids).size, `${host}: no moon in two families`);
    assert.deepEqual([...ids].sort(), catalogueMoonsOf(host).map((m) => m.id).sort(), `${host}: every moon of the catalogue is in a family`);
    for (const family of families) {
      assert.equal(family.count, family.moons.length);
      const along = family.moons.map((m) => m.moon.orbit?.a ?? Infinity);
      assert.deepEqual(along, [...along].sort((a, b) => a - b), `${host} ${family.id} is nearest first`);
    }
  }
  assert.deepEqual(moonFamilies("nowhere" as HostId), []);
});

test("the families hold the moons the sources put in them", () => {
  const of = (host: HostId, id: string) => moonFamilies(host).find((f) => f.id === id)!.moons.map((m) => m.id);
  assert.deepEqual(of("jupiter", "galilean"), ["io", "europa", "ganymede", "callisto"]);
  assert.deepEqual(of("jupiter", "inner").slice(0, 4), ["metis", "adrastea", "amalthea", "thebe"]);
  assert.ok(of("jupiter", "himalia").includes("himalia"));
  assert.ok(of("jupiter", "ananke").includes("ananke"));
  assert.ok(of("jupiter", "carme").includes("carme"));
  assert.ok(of("jupiter", "pasiphae").includes("pasiphae"));
  assert.deepEqual(["themisto", "carpo", "valetudo"].filter((id) => !of("jupiter", "other").includes(id)), []);
  assert.ok(of("saturn", "inner").includes("titan") && of("saturn", "inner").includes("enceladus") && of("saturn", "inner").includes("hyperion"));
  assert.ok(of("saturn", "inuit").includes("siarnaq") && of("saturn", "gallic").includes("albiorix") && of("saturn", "norse").includes("phoebe"));
  assert.ok(of("uranus", "inner").includes("miranda") && of("uranus", "irregular").includes("caliban"));
  assert.ok(of("neptune", "inner").includes("triton") && of("neptune", "irregular").includes("nereid"));
});

test("a family counts its moons, their sizes, and says which sizes are estimates", () => {
  const total = (host: HostId): number => moonFamilies(host).reduce((n, f) => n + f.count, 0);
  assert.deepEqual([total("jupiter"), total("saturn"), total("uranus"), total("neptune")], [115, 293, 29, 16]);
  for (const family of HOSTS.flatMap((h) => moonFamilies(h))) {
    const sized = family.moons.filter((m) => m.radiusKm !== null);
    assert.equal(family.sized, sized.length);
    assert.equal(family.estimated, sized.filter((m) => m.moon.radiusFrom === "derived").length);
    assert.ok(family.named <= family.count && family.estimated <= family.sized);
    if (sized.length === 0) assert.deepEqual([family.largestKm, family.smallestKm], [null, null]);
    else {
      assert.equal(family.largestKm, Math.max(...sized.map((m) => m.radiusKm!)));
      assert.equal(family.smallestKm, Math.min(...sized.map((m) => m.radiusKm!)));
    }
    for (const moon of family.moons) assert.equal(moon.estimate, moon.moon.radiusFrom === "derived", `${moon.id}: the flag is the size's source`);
  }
  const galilean = moonFamilies("jupiter")[0]!;
  assert.equal(galilean.estimated, 0, "the Galilean moons are measured");
  assert.equal(galilean.largestKm, 2631.2, "Ganymede");
  assert.equal(galilean.largestIsEstimate, false);
  const ananke = moonFamilies("jupiter").find((f) => f.id === "ananke")!;
  assert.ok(ananke.estimated >= ananke.sized - 2 && ananke.largestIsEstimate !== undefined, "Ananke's group is sized from magnitudes");
});

test("a family names which way its moons go, and has its names in both languages", () => {
  const way = (host: HostId, id: string) => moonFamilies(host).find((f) => f.id === id)!.direction;
  assert.equal(way("jupiter", "galilean"), "prograde");
  assert.equal(way("jupiter", "carme"), "retrograde");
  assert.equal(way("jupiter", "ananke"), "retrograde");
  assert.equal(way("saturn", "inuit"), "prograde");
  assert.equal(way("saturn", "norse"), "retrograde");
  for (const family of HOSTS.flatMap((h) => moonFamilies(h))) {
    assert.match(family.names.en, /^[A-Z]/);
    assert.match(family.names.ja, /[\u3040-\u30ff\u4e00-\u9fff]/, `${family.id} has Japanese`);
    assert.match(family.color, /^#[0-9a-f]{6}$/);
  }
});

test("the key says what each colour means, once, with the moons that wear it", () => {
  const byGroup = moonOrbitKey("group");
  assert.equal(new Set(byGroup.map((e) => e.color + e.id)).size, byGroup.length);
  assert.equal(byGroup.reduce((n, e) => n + e.count, 0), MOON_CATALOGUE.filter((m) => m.orbit !== null).length);
  const direction = moonOrbitKey("direction");
  assert.deepEqual(direction.map((e) => e.id), ["prograde", "retrograde"]);
  assert.equal(direction[0]!.count + direction[1]!.count, MOON_CATALOGUE.filter((m) => m.orbit !== null).length);
  assert.deepEqual(moonOrbitKey("group", ["saturn"]).map((e) => e.id), ["inner", "inuit", "gallic", "norse"]);
  assert.deepEqual(moonOrbitKey("direction", ["earth"]).map((e) => e.id), ["prograde"]);
  assert.deepEqual(moonOrbitKey("group", []), []);
  const carme = findCatalogueMoon("carme")!;
  assert.equal(moonOrbitColor(carme, "direction"), direction[1]!.color);
  assert.equal(moonOrbitColor(carme, "group"), byGroup.find((e) => e.id === "carme")!.color);
  assert.equal(moonOrbitColor({ ...carme, retrograde: null }, "direction"), "#c9cdd4");
});

test("an orbit is a closed line the moon is on", () => {
  const when = new Date("2026-11-18T00:00:00Z");
  for (const name of ["Himalia", "Carme", "Nereid", "Titan", "Siarnaq", "Caliban", "Triton", "Phobos"]) {
    const moon = findCatalogueMoon(name)!;
    const ring = catalogueMoonOrbit(moon, when, 180)!;
    assert.equal(ring.length, 181);
    assert.deepEqual(ring[0], ring.at(-1), `${name} closes`);
    const at = catalogueMoonPosition(moon, when)!;
    const near = Math.min(...ring.map((p) => Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2])));
    assert.ok(near < moon.orbit!.a * 0.1, `${name} is on its orbit (${near.toFixed(0)} km off, a = ${moon.orbit!.a} km)`);
    const reach = ring.map((p) => Math.hypot(...p));
    const e = moon.osculating !== null ? moon.osculating.e : moon.orbit!.e;
    const a = moon.osculating !== null ? moon.osculating.a : moon.orbit!.a;
    assert.ok(Math.abs(Math.max(...reach) - a * (1 + e)) < a * 0.02 && Math.abs(Math.min(...reach) - a * (1 - e)) < a * 0.02, `${name} has its apses`);
  }
  assert.equal(catalogueMoonOrbit(MOON_CATALOGUE.find((m) => m.orbit === null)!, when), undefined);
  assert.equal(catalogueMoonOrbit("io", when, 1)!.length, 9, "at least 8 points");
  assert.equal(catalogueMoonOrbit("io", when, 1e6)!.length, 721, "at most 720");
  assert.throws(() => catalogueMoonOrbit("no such moon", when), RangeError);
});

test("moons and moons-of say which planets show every moon, and the planet's own word beats the default", () => {
  assert.equal(readMoonsChoice("all"), "all");
  assert.equal(readMoonsChoice(" ALL "), "all");
  for (const other of [null, undefined, "major", "off", "", "everything"]) assert.equal(readMoonsChoice(other), "major");
  assert.equal(readMoonColors("direction"), "direction");
  for (const other of [null, "group", "nonsense"]) assert.equal(readMoonColors(other), "group");
  assert.deepEqual(readMoonsOf("jupiter=all saturn=major, pluto=all"), { jupiter: "all", saturn: "major", pluto: "all" });
  assert.deepEqual(readMoonsOf("earthling=all jupiter=most mars saturn=ALL"), { saturn: "all" });
  assert.deepEqual(readMoonsOf(null), {});
  assert.deepEqual([...hostsShowingAll("major", {})], []);
  assert.deepEqual([...hostsShowingAll("major", { saturn: "all" })], ["saturn"]);
  assert.deepEqual([...hostsShowingAll("all", { saturn: "major" })].includes("saturn"), false);
  assert.equal(hostsShowingAll("all", {}).size, MOON_HOSTS.length);
  assert.equal(catalogueMoonIdOf(catalogueMoonKey("dia")), "dia");
  assert.equal(catalogueMoonIdOf("dia"), undefined);
});

/** The opacity the layer draws its orbit lines with: what tells them from the dots in the fake. */
const LINE_OPACITY = 0.6;

// A three.js with only what the layer asks of it, counting what it is asked to do.
function fakeThree() {
  const calls = { positionSets: 0 };
  class Attribute {
    needsUpdate = false;
    array: Float32Array;
    itemSize: number;
    constructor(array: Float32Array, itemSize: number) {
      this.array = array;
      this.itemSize = itemSize;
    }
  }
  class Geometry {
    attributes: Record<string, Attribute> = {};
    range: [number, number] = [0, Infinity];
    setAttribute(name: string, attribute: Attribute) {
      if (name === "position") calls.positionSets += 1;
      this.attributes[name] = attribute;
    }
    setDrawRange(start: number, count: number) {
      this.range = [start, count];
    }
    dispose() {}
  }
  class Material {
    size = 1;
    options: object;
    constructor(options: object) {
      this.options = options;
    }
    dispose() {}
  }
  class Thing {
    visible = true;
    frustumCulled = true;
    position = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { Object.assign(this, { x, y, z }); } };
    scale = { s: 1, setScalar(s: number) { this.s = s; } };
    geometry: Geometry;
    material: Material;
    constructor(geometry: Geometry, material: Material) {
      this.geometry = geometry;
      this.material = material;
    }
  }
  const T = { BufferAttribute: Attribute, BufferGeometry: Geometry, Points: Thing, LineSegments: Thing, PointsMaterial: Material, LineBasicMaterial: Material } as unknown as DotsThree;
  const children = new Set<Thing>();
  const parent = { add: (o: Thing) => children.add(o), remove: (o: Thing) => children.delete(o) } as unknown as import("three").Object3D;
  return { T, parent, children, calls };
}

const source = moonSourceOf(catalogue);
const inputOf = (over: Partial<MoonLayerInput> = {}): MoonLayerInput => ({
  source,
  hosts: new Set(["jupiter"]),
  by: "group",
  mode: "compressed",
  time: Date.UTC(2026, 10, 18),
  orbits: true,
  at: () => [10, 20, 30],
  radius: () => 2,
  ratio: 1,
  spot: () => ({ x: 5, y: 6 }),
  ...over,
});

test("the layer draws the dots of the moons the view does not draw in full, and an orbit for every moon, of the planets chosen", () => {
  const { T, parent, children } = fakeThree();
  const layer = createMoonLayer(T, parent);
  const jupiter = MOON_CATALOGUE.filter((m) => m.host === "jupiter" && m.orbit !== null);
  const drawn = layer.update(inputOf());
  assert.equal(drawn.dots, jupiter.filter((m) => !m.full).length);
  assert.equal(drawn.orbits, jupiter.length);
  assert.equal(drawn.spots.length, drawn.dots, "every dot on the screen can be pressed");
  assert.ok(drawn.spots.every((s) => s.host === "jupiter") && !drawn.spots.some((s) => s.id === "io"), "Io is a body, not a dot");
  const both = layer.update(inputOf({ hosts: new Set(["jupiter", "saturn"]) }));
  assert.equal(both.dots, MOON_CATALOGUE.filter((m) => (m.host === "jupiter" || m.host === "saturn") && m.orbit !== null && !m.full).length);
  const none = layer.update(inputOf({ hosts: new Set() }));
  assert.deepEqual([none.dots, none.orbits, none.spots.length], [0, 0, 0]);
  assert.ok([...children].every((o) => !o.visible), "nothing is left on the screen");
  const off = layer.update(inputOf({ orbits: false }));
  assert.equal(off.orbits, 0, "the orbits go with `orbits=off`, the dots stay");
  assert.ok(off.dots > 0);
  layer.dispose();
  assert.equal(children.size, 0);
});

test("each planet's orbit lines say which moon every segment belongs to, and share one material", () => {
  const { T, parent } = fakeThree();
  const layer = createMoonLayer(T, parent);
  layer.update(inputOf());
  const jupiter = MOON_CATALOGUE.filter((m) => m.host === "jupiter" && m.orbit !== null);
  const owners = layer.orbitMoons("jupiter");
  assert.equal(owners.length, jupiter.length);
  assert.ok(owners.every((o) => o.segments === MOON_ORBIT_POINTS));
  assert.equal(new Set(owners.map((o) => o.id)).size, owners.length, "one line for each moon");
  assert.deepEqual(layer.orbitMoons("saturn"), [], "a planet not drawn has none");
  assert.equal(MOON_ORBIT_OPACITY, LINE_OPACITY, "the opacity of the lines is one constant");
});

test("the orbits are made once and then only moved: nothing is built again for a draw at the same scale, colouring and month", () => {
  const { T, parent, calls } = fakeThree();
  const layer = createMoonLayer(T, parent);
  layer.update(inputOf());
  const built = calls.positionSets;
  for (let k = 0; k < 20; k += 1) layer.update(inputOf({ at: () => [k, 0, 0], radius: () => 1 + k, time: Date.UTC(2026, 10, 18) + k * 86_400_000 }));
  assert.equal(calls.positionSets, built, "twenty draws over twenty days build no orbit again");
  layer.update(inputOf({ time: Date.UTC(2026, 10, 18) + MOON_ORBIT_KEEP_MS + 1 }));
  assert.ok(calls.positionSets > built, "a month later they turn, so they are made again");
  const month = calls.positionSets;
  layer.update(inputOf({ time: Date.UTC(2026, 10, 18) + MOON_ORBIT_KEEP_MS + 1, by: "direction" }));
  assert.ok(calls.positionSets > month, "another colouring makes them again");
  const colouring = calls.positionSets;
  layer.update(inputOf({ time: Date.UTC(2026, 10, 18) + MOON_ORBIT_KEEP_MS + 1, by: "direction", mode: "true" }));
  assert.ok(calls.positionSets > colouring, "another scale makes them again");
});

test("an orbit follows its planet: placed at the planet and scaled by its drawn radius, in colours that say the family or the direction", () => {
  const { T, parent, children } = fakeThree();
  const layer = createMoonLayer(T, parent);
  layer.update(inputOf({ at: () => [7, 8, 9], radius: () => 3 }));
  const lines = [...children].filter((o) => (o as unknown as { material: { options: { opacity: number } } }).material.options.opacity === LINE_OPACITY && o.visible && (o as unknown as { scale: { s: number } }).scale.s === 3);
  assert.equal(lines.length, 1, "one line for Jupiter");
  const jupiter = lines[0] as unknown as { position: { x: number; y: number; z: number }; geometry: { attributes: Record<string, { array: Float32Array }> } };
  assert.deepEqual([jupiter.position.x, jupiter.position.y, jupiter.position.z], [7, 8, 9]);
  const colours = (by: "group" | "direction") => {
    const f = fakeThree();
    const l = createMoonLayer(f.T, f.parent);
    l.update(inputOf({ by }));
    const line = [...f.children].find((o) => (o as unknown as { material: { options: { opacity: number } } }).material.options.opacity === LINE_OPACITY && o.visible) as unknown as { geometry: { attributes: Record<string, { array: Float32Array }> } };
    return new Set(Array.from({ length: line.geometry.attributes["color"]!.array.length / 3 }, (_, k) => [...line.geometry.attributes["color"]!.array.slice(k * 3, k * 3 + 3)].map((v) => Math.round(v * 255)).join()));
  };
  assert.ok(colours("group").size >= 6, "Jupiter's seven families are seven colours");
  assert.equal(colours("direction").size, 2, "two directions are two colours");
});

test("a dot is where the moon is, in the planet's radii, drawn nearer in the compressed view", () => {
  const himalia = source.moons.find((m) => m.id === "himalia")!;
  const km = source.position(himalia, Date.UTC(2026, 10, 18));
  const compressed = moonDotOffset("compressed", { host: "jupiter", km });
  const real = moonDotOffset("true", { host: "jupiter", km });
  assert.ok(Math.hypot(...compressed) < Math.hypot(...real));
});
