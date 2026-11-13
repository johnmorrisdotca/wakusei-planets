// The catalogue of every known moon (/moon-catalogue): the counts per planet pinned to what JPL listed on the day it was read, every row complete and the package's own moons in it, the lookups, the mean-orbit positions
// against JPL Horizons at four dates (test/data/moon-catalogue-horizons.json, fetched by scripts/make-moon-catalogue.py) agreeing with each moon's stated accuracy, the sizes, the dots of the space view, and that the
// rows are a chunk of their own that no other entry point carries.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import {
  ASSUMED_ALBEDO,
  MOON_CATALOGUE,
  MOON_CATALOGUE_FETCHED,
  MOON_GROUPS,
  catalogueMoonPosition,
  catalogueMoonsOf,
  findCatalogueMoon,
  moonCounts,
} from "../src/moon-catalogue.ts";
import { BODIES, MOONS_OF } from "../src/facts.ts";
import { moonVector } from "../src/ephemeris.ts";
import { moonDotOffset } from "../src/space/all-moons.ts";
import { moonOffset } from "../src/scene/orient.ts";
import { ttMinusUtc } from "../src/time.ts";

interface Fixture {
  fetched: string;
  near: number[];
  far: number[];
  moons: Record<string, Record<string, [number, number, number]>>;
}
const fixture = JSON.parse(readFileSync(new URL("./data/moon-catalogue-horizons.json", import.meta.url), "utf8")) as Fixture;
/** A Julian date in TDB (taken as terrestrial time) as the UTC milliseconds the functions take. */
const utcOf = (jd: number): number => {
  const tt = (jd - 2_440_587.5) * 86_400_000;
  return tt - ttMinusUtc(tt) * 1000;
};
const angle = (a: readonly number[], b: readonly number[]): number => {
  const dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(a[0]!, a[1]!, a[2]!) * Math.hypot(b[0]!, b[1]!, b[2]!))))) * 180) / Math.PI;
};

test("the counts per planet and dwarf planet are pinned to JPL's lists of the day they were read", () => {
  assert.equal(MOON_CATALOGUE_FETCHED, "2026-11-11");
  assert.equal(fixture.fetched, MOON_CATALOGUE_FETCHED);
  const counts = Object.fromEntries(Object.entries(moonCounts()).map(([host, c]) => [host, c!.total]));
  assert.deepEqual(counts, COUNTS);
  assert.equal(MOON_CATALOGUE.length, Object.values(COUNTS).reduce((a, b) => a + b, 0));
});

test("no id twice, and every moon the package draws in full is in the catalogue under its own id, with its Japanese name", () => {
  const ids = MOON_CATALOGUE.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  const codes = MOON_CATALOGUE.flatMap((m) => (m.code === null ? [] : [m.code]));
  assert.equal(new Set(codes).size, codes.length);
  const own = Object.values(MOONS_OF).flat() as string[];
  for (const id of own) {
    const moon = findCatalogueMoon(id);
    assert.ok(moon !== undefined, `${id} is in the catalogue`);
    assert.equal(moon.id, id);
    assert.equal(moon.full, true, id);
    assert.equal(moon.ja, BODIES[id as keyof typeof BODIES].name.ja, `${id}: the Japanese name is the package's own`);
    assert.equal(moon.host, BODIES[id as keyof typeof BODIES].parent, `${id}: the same planet`);
  }
  assert.equal(MOON_CATALOGUE.filter((m) => m.full).length, own.length);
  assert.ok(MOON_CATALOGUE.every((m) => m.full || m.ja === null), "no Japanese name that has not been checked");
});

test("every row is complete: a label, a planet, a year, an ellipse with a period, a group, and a grade that agrees with its accuracy", () => {
  for (const m of MOON_CATALOGUE) {
    assert.ok(m.label.length > 0 && (m.name !== null || m.designation !== null), m.id);
    assert.ok(m.host in BODIES, m.id);
    assert.ok(MOON_GROUPS.includes(m.group), `${m.id}: ${m.group}`);
    assert.equal(m.named, m.name !== null);
    if (m.id !== "moon") assert.ok(m.discovery.year !== null && m.discovery.year >= 1610 && m.discovery.year <= 2026, `${m.id}: a year of discovery`);
    if (m.orbit === null) {
      assert.equal(m.grade, "none");
      assert.equal(m.group, "none");
      continue;
    }
    const o = m.orbit;
    assert.ok(o.a > 0 && o.e >= 0 && o.e < 1 && o.periodDays > 0 && o.i >= 0 && o.i <= 180, `${m.id}: an ellipse`);
    assert.equal(o.pole === undefined, o.frame === "ecliptic", `${m.id}: a pole for a plane of its own`);
    assert.equal(m.retrograde, o.i > 90);
    if (m.accuracy === null) assert.equal(m.grade, "unmeasured");
    else assert.equal(m.grade, m.accuracy.worstDegrees < 1 ? "close" : m.accuracy.worstDegrees < 10 ? "rough" : "loose", m.id);
    // Kepler's third law holds for the mean orbit to a few per cent (the planet's mass from the Moon's period would be off; this checks the row is one moon's)
    if (m.host !== "earth") {
      const gm = (4 * Math.PI ** 2 * o.a ** 3) / (o.periodDays * 86_400) ** 2;
      const peers = MOON_CATALOGUE.filter((p) => p.host === m.host && p.orbit !== null).map((p) => (4 * Math.PI ** 2 * p.orbit!.a ** 3) / (p.orbit!.periodDays * 86_400) ** 2);
      const median = peers.sort((a, b) => a - b)[Math.floor(peers.length / 2)]!;
      assert.ok(Math.abs(gm / median - 1) < 0.08, `${m.id}: a and the period belong together (${(gm / median).toFixed(3)})`);
    }
  }
});

test("known moons: discovery, designation, names and groups as the sources give them", () => {
  const io = findCatalogueMoon("Io")!;
  assert.deepEqual(io.discovery, { year: 1610, by: "Galileo", reference: "IAU WGPSN" });
  assert.equal(io.number, "I");
  assert.equal(io.code, 501);
  assert.equal(io.group, "major");
  assert.equal(findCatalogueMoon("Himalia")!.group, "himalia");
  assert.equal(findCatalogueMoon("Carme")!.group, "carme");
  assert.equal(findCatalogueMoon("Ananke")!.group, "ananke");
  assert.equal(findCatalogueMoon("Pasiphae")!.group, "pasiphae");
  assert.equal(findCatalogueMoon("Kiviuq")!.group, "inuit");
  assert.equal(findCatalogueMoon("Albiorix")!.group, "gallic");
  assert.equal(findCatalogueMoon("Phoebe")!.group, "norse");
  assert.equal(findCatalogueMoon("Amalthea")!.group, "inner");
  assert.equal(findCatalogueMoon("Triton")!.retrograde, true);
  assert.equal(findCatalogueMoon("Megaclite")!.name, "Megaclite", "the discovery page's spelling, not the element page's");
  assert.equal(findCatalogueMoon("Neptune")?.host, undefined);
  const nep = findCatalogueMoon("Hippocamp")!;
  assert.equal(nep.discovery.year, 2013);
  assert.equal(nep.designation, "S/2004 N 1");
  const unnamed = findCatalogueMoon("S/2003 J 18")!;
  assert.equal(unnamed.named, false);
  assert.equal(unnamed.host, "jupiter");
  assert.equal(findCatalogueMoon("Dysnomia")!.host, "eris");
  assert.equal(findCatalogueMoon("Dysnomia")!.orbit, null, "no mean orbit in JPL's lists: the package's own orbit places it");
});

test("findCatalogueMoon reads an id, a name, a Japanese name, a designation in any spacing and a JPL code, and nothing else", () => {
  const himalia = findCatalogueMoon("Himalia");
  for (const q of ["himalia", "HIMALIA", " Himalia ", 506, "506"]) assert.equal(findCatalogueMoon(q), himalia, String(q));
  assert.equal(findCatalogueMoon("イオ"), findCatalogueMoon("io"));
  const s = findCatalogueMoon("S/2003 J 18");
  for (const q of ["s2003j18", "S/2003 J18", "s-2003-j-18"]) assert.equal(findCatalogueMoon(q), s, q);
  for (const q of ["", "  ", "nothing", "jupiter", 0, -1]) assert.equal(findCatalogueMoon(q), undefined, String(q));
  assert.throws(() => catalogueMoonPosition("nothing", 0), RangeError);
});

test("catalogueMoonsOf lists a planet's moons nearest first, and a group narrows it", () => {
  const jupiter = catalogueMoonsOf("jupiter");
  assert.equal(jupiter.length, COUNTS.jupiter);
  assert.equal(jupiter[0]!.name, "Metis");
  for (let k = 1; k < jupiter.length; k += 1) assert.ok((jupiter[k - 1]!.orbit?.a ?? Infinity) <= (jupiter[k]!.orbit?.a ?? Infinity));
  assert.deepEqual(catalogueMoonsOf("jupiter", "major").map((m) => m.id), ["io", "europa", "ganymede", "callisto"]);
  assert.equal(catalogueMoonsOf("mercury").length, 0);
});

test("mean-orbit positions against JPL Horizons: every moon is within the accuracy it states, and the grades are counted", () => {
  const grades: Record<string, number> = {};
  let measured = 0;
  for (const m of MOON_CATALOGUE) {
    grades[m.grade] = (grades[m.grade] ?? 0) + 1;
    const rows = fixture.moons[m.id];
    if (m.accuracy === null) {
      assert.ok(rows === undefined || m.orbit === null || fixture.near.every((jd) => rows[String(jd)] === undefined), `${m.id}: measured near 2026 but no accuracy stated`);
      continue;
    }
    assert.ok(rows !== undefined && Object.keys(rows).length > 0, `${m.id}: the positions it was measured against`);
    let worstKm = 0;
    let worstDeg = 0;
    let farDeg: number | null = null;
    for (const [jd, horizons] of Object.entries(rows)) {
      const ours = catalogueMoonPosition(m, utcOf(Number(jd)))!;
      if (fixture.far.includes(Number(jd))) {
        farDeg = Math.max(farDeg ?? 0, angle(ours, horizons));
        continue;
      }
      worstKm = Math.max(worstKm, Math.hypot(ours[0] - horizons[0], ours[1] - horizons[1], ours[2] - horizons[2]));
      worstDeg = Math.max(worstDeg, angle(ours, horizons));
    }
    if (farDeg === null) assert.equal(m.accuracy.farDegrees, null, m.id);
    else assert.ok(Math.abs(farDeg - m.accuracy.farDegrees!) < 0.06, `${m.id}: ${farDeg.toFixed(2)} degrees decades away against ${m.accuracy.farDegrees} stated`);
    // the stated numbers were worked out by the build script's own copy of the same sums: the two agree, to the rounding of the fixture
    assert.ok(Math.abs(worstKm - m.accuracy.worstKm) <= 2 + 1e-6 * m.orbit!.a, `${m.id}: ${worstKm.toFixed(0)} km against ${m.accuracy.worstKm} stated`);
    assert.ok(Math.abs(worstDeg - m.accuracy.worstDegrees) < 0.002, `${m.id}: ${worstDeg.toFixed(4)} degrees against ${m.accuracy.worstDegrees} stated`);
    measured += 1;
  }
  console.log(`moon catalogue: ${measured} moons measured against Horizons; grades ${JSON.stringify(grades)}`);
  assert.deepEqual(grades, GRADES);
});

test("the package's own moons are placed far better by the main entry point than by the catalogue's mean orbit", () => {
  const when = utcOf(fixture.near[1]!);
  for (const id of ["io", "titan", "triton", "charon"]) {
    const rows = fixture.moons[id]!;
    const horizons = rows[String(fixture.near[1])]!;
    const own = angle(moonVector(id as "io", when), horizons);
    const mean = findCatalogueMoon(id)!.accuracy!.worstDegrees;
    assert.ok(own < 0.05, `${id}: the package's own place is within 0.05 degrees (${own.toFixed(4)})`);
    assert.ok(own <= mean, `${id}: ${own.toFixed(4)} against the catalogue's worst ${mean}`);
  }
});

test("sizes: measured where JPL measured them, from the Horizons sheet next, else worked out from the brightness and flagged", () => {
  const io = findCatalogueMoon("Io")!;
  assert.equal(io.radiusFrom, "measured");
  assert.ok(Math.abs(io.radiusKm! - BODIES.io.radiusKm) < 2, "the package's own radius and JPL's agree");
  for (const m of MOON_CATALOGUE.filter((x) => x.radiusFrom === "derived")) {
    assert.ok(m.magnitude !== null, m.id);
    const d = 10 ** (3.1236 - 0.5 * Math.log10(m.albedo ?? ASSUMED_ALBEDO) - 0.2 * m.magnitude);
    assert.ok(Math.abs(m.radiusKm! - d / 2) <= 0.05, `${m.id}: the radius is half the estimator's diameter`);
  }
  for (const m of MOON_CATALOGUE) if (m.radiusFrom === null) assert.equal(m.radiusKm, null, m.id);
  const counts = { measured: 0, sheet: 0, derived: 0, none: 0 };
  for (const m of MOON_CATALOGUE) counts[m.radiusFrom ?? "none"] += 1;
  console.log(`moon catalogue sizes: ${JSON.stringify(counts)}`);
  assert.deepEqual(counts, SIZES);
});

test("the space view's dots: a moon in the true scale is where its kilometres put it, in the scene's axes, like the drawn moons", () => {
  const when = Date.UTC(2026, 10, 11);
  const io = findCatalogueMoon("io")!;
  const km = moonVector("io", when);
  const dot = moonDotOffset("true", { host: "jupiter", km });
  const drawn = moonOffset("io", when);
  for (let k = 0; k < 3; k += 1) assert.ok(Math.abs(dot[k]! - drawn[k]!) < 1e-9, "the same turn into the scene as moonOffset");
  const himalia = catalogueMoonPosition("Himalia", when)!;
  const far = moonDotOffset("compressed", { host: "jupiter", km: himalia });
  assert.ok(Math.hypot(...far) < Math.hypot(...himalia) / BODIES.jupiter.radiusKm, "drawn nearer in the compressed view");
  assert.ok(io.full, "Io is drawn in full, so the view leaves it out of the dots");
});

test("the rows are a chunk of their own: no other entry point carries them, and the space element fetches them only when asked", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const bundle = async (contents: string, splitting = false) => {
    const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, splitting, format: "esm", minify: true, outdir: "out", write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"], loader: { ".css": "text", ".svg": "text", ".txt": "text" } });
    return result.outputFiles.map((file) => ({ path: file.path, text: file.text, gzip: gzipSync(file.contents, { level: 9 }).length }));
  };
  // a discoverer's line that appears only in the rows
  const mark = "Cassini Imaging Science Team";
  const [own] = await bundle(`export * from "./src/moon-catalogue.ts";`);
  assert.ok(own!.text.includes(mark), "the /moon-catalogue bundle holds the rows");
  for (const entry of ["./src/index.ts", "./src/space/index.ts", "./src/element.ts", "./src/asteroids.ts", "./src/comets.ts", "./src/plan/index.ts"]) {
    const [text] = await bundle(`import ${JSON.stringify(entry)};`);
    assert.ok(!text!.text.includes(mark), `${entry} does not carry the moon catalogue`);
  }
  const split = await bundle(`import "./src/space/element.ts";`, true);
  const entry = split.find((file) => file.path.endsWith("/stdin.js"))!;
  assert.ok(!entry.text.includes(mark), "the space element's own chunk does not hold the rows");
  assert.equal(split.filter((file) => file.text.includes(mark)).length, 1, "the rows are one chunk, fetched by all-moons");
  const raw = readFileSync(new URL("../src/data/moon-catalogue.ts", import.meta.url));
  console.log(`moon catalogue: ${MOON_CATALOGUE.length} moons; rows ${raw.length} bytes, ${gzipSync(raw, { level: 9 }).length} gzipped; /moon-catalogue bundled ${own!.text.length} bytes, ${own!.gzip} gzipped`);
  assert.ok(own!.gzip < BUDGET_GZIP, `/moon-catalogue is ${own!.gzip} bytes gzipped`);
});

// The numbers the tests above pin, from the read of MOON_CATALOGUE_FETCHED. A new read changes them on purpose: update them with the changes the build script printed.
const COUNTS: Record<string, number> = { earth: 1, mars: 2, jupiter: 115, saturn: 293, uranus: 29, neptune: 16, pluto: 5, orcus: 1, haumea: 2, quaoar: 1, makemake: 1, gonggong: 1, eris: 1 };
const GRADES: Record<string, number> = { close: 37, rough: 140, loose: 282, unmeasured: 1, none: 8 };
const SIZES = { measured: 46, sheet: 19, derived: 26, none: 377 };
const BUDGET_GZIP = 40_000;
