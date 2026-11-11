// The asteroids and distant small bodies of /asteroids: what the table holds (counts by kind pinned, no body twice, none the package already has), the lookups, two-body positions against JPL Horizons at five times round each of
// 16 bodies' epochs (test/data/asteroids-horizons.json, fetched by scripts/make-asteroids-data.py), the orbit line, the door's small-body record, a body made from elements, and that the table is a chunk of its own.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import {
  ASTEROID_ACCURACY,
  ASTEROID_KINDS,
  ASTEROIDS,
  ASTEROIDS_FETCHED,
  asteroidAsSmallBody,
  asteroidDistances,
  asteroidFromElements,
  asteroidList,
  asteroidOrbitPoints,
  asteroidPeriodDays,
  asteroidPosition,
  asteroidPositionAu,
  asteroidsOfKind,
  findAsteroid,
  type AsteroidKind,
} from "../src/asteroids.ts";
import { smallBodyAt } from "../src/door/small-bodies.ts";
import { DWARF_IDS, MINOR_IDS } from "../src/facts.ts";
import { ttMinusUtc } from "../src/time.ts";
import { length, sub } from "../src/vec.ts";

interface Fixture {
  fetched: string;
  bodies: { id: string; kind: AsteroidKind; rows: number[][] }[];
}
const fixture = JSON.parse(readFileSync(new URL("./data/asteroids-horizons.json", import.meta.url), "utf8")) as Fixture;
const AU_KM = 149_597_870.7;
/** A Julian date in TDB (taken as terrestrial time) as the UTC milliseconds the functions take. */
const utcOf = (jd: number): number => {
  const tt = (jd - 2_440_587.5) * 86_400_000;
  return tt - ttMinusUtc(tt) * 1000;
};

test("the counts by kind and group are pinned", () => {
  const count = (kind: AsteroidKind): number => asteroidsOfKind(kind).length;
  assert.equal(ASTEROIDS.length, 104);
  assert.deepEqual(ASTEROID_KINDS.map(count), [29, 38, 16, 7, 14]);
  assert.deepEqual(["Atira", "Aten", "Apollo", "Amor"].map((g) => asteroidsOfKind("near-earth", g as "Amor").length), [1, 4, 20, 4]);
  assert.equal(asteroidList(), ASTEROIDS);
  assert.equal(ASTEROIDS_FETCHED, "2026-11-11");
  assert.equal(fixture.fetched, "2026-11-11");
  for (const a of ASTEROIDS) assert.equal(a.group !== undefined, a.kind === "near-earth", `${a.id}: a group only for the near-Earth asteroids`);
});

test("no id or number twice, and none of the bodies the package already has", () => {
  const ids = ASTEROIDS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  const numbers = ASTEROIDS.flatMap((a) => (a.number === undefined ? [] : [a.number]));
  assert.equal(new Set(numbers).size, numbers.length);
  const own = [...DWARF_IDS, ...MINOR_IDS, "pluto", "roadster", "starman"] as string[];
  for (const id of ids) assert.ok(!own.includes(id), `${id} is a body the package already has`);
  // Ceres 1, Pallas 2, Vesta 4, Chiron 2060, Pholus 5145, Orcus 90482, Haumea 136108, Quaoar 50000, Makemake 136472, Gonggong 225088, Eris 136199, Sedna 90377, Pluto 134340, Halley 1P
  for (const n of [1, 2, 4, 2060, 5145, 90482, 136108, 50000, 136472, 225088, 136199, 90377, 134340]) assert.equal(findAsteroid(n), undefined, `number ${n} is already in the package`);
});

test("every record is complete: names in both languages, an ellipse, a source, a year, a kind that agrees with the orbit", () => {
  for (const a of ASTEROIDS) {
    const el = a.elements;
    assert.ok(a.name.en.length > 0 && a.name.ja.length > 0, a.id);
    assert.ok(a.source.startsWith("JPL"), a.id);
    assert.ok(el.a > 0 && el.e >= 0 && el.e < 1 && Math.abs(el.q - el.a * (1 - el.e)) < 1e-9, `${a.id}: an ellipse with a consistent perihelion`);
    assert.ok(Math.abs(el.n - 360 / (Math.sqrt(el.a ** 3) * 365.256363)) / el.n < 1e-4, `${a.id}: the mean motion matches the axis`);
    assert.equal(el.epochJd, 2_461_200.5, `${a.id}: every orbit is from 2026-06-09`);
    assert.ok(a.discoveryYear !== undefined && a.discoveryYear >= 1800 && a.discoveryYear <= 2026, `${a.id}: a year of discovery`);
    assert.ok(Number.isInteger(a.spkid) && a.spkid > 20_000_000, a.id);
    const rebuilt = asteroidFromElements(a.name.en, el);
    assert.equal(rebuilt.kind, a.kind === "main-belt" && el.q < 1.3 ? "near-earth" : a.kind, `${a.id}: JPL's rules give the kind from the orbit`);
    if (a.kind === "near-earth") assert.equal(rebuilt.group, a.group, `${a.id}: the group from the orbit`);
    for (const m of a.missions) assert.ok(m.year >= 1990 && m.year <= 2035, `${a.id}: ${m.name}`);
  }
});

test("known records: names, years, sizes, groups, hazard flags and missions as the source gives them", () => {
  const eros = findAsteroid("Eros")!;
  assert.equal(eros.number, 433);
  assert.equal(eros.group, "Amor");
  assert.equal(eros.discoveryYear, 1898);
  assert.equal(eros.name.ja, "エロス");
  assert.ok(eros.diameterKm! > 16 && eros.diameterKm! < 18, "Eros is about 17 km across");
  assert.equal(findAsteroid("Apophis")!.group, "Aten");
  assert.equal(findAsteroid("Apophis")!.hazardous, true);
  assert.equal(findAsteroid("Eros")!.hazardous, false);
  assert.equal(findAsteroid("Atira")!.group, "Atira");
  assert.equal(findAsteroid("Apollo")!.group, "Apollo");
  assert.equal(findAsteroid("Amor")!.group, "Amor");
  assert.equal(findAsteroid("Hektor")!.kind, "trojan");
  assert.equal(findAsteroid("Chariklo")!.kind, "centaur");
  assert.equal(findAsteroid("Arrokoth")!.kind, "trans-neptunian");
  assert.equal(findAsteroid("Hygiea")!.discoveryYear, 1849);
  assert.equal(findAsteroid("Ryugu")!.missions[0]!.name, "Hayabusa2");
  assert.equal(findAsteroid("Bennu")!.missions[0]!.year, 2018);
  assert.equal(findAsteroid("Itokawa")!.missions[0]!.year, 2005);
  assert.deepEqual(findAsteroid("Didymos")!.missions.map((m) => m.name), ["DART", "Hera"]);
  assert.equal(findAsteroid("Didymos")!.satellites, 1);
  assert.equal(findAsteroid("Psyche")!.missions[0]!.planned, true);
  assert.equal(findAsteroid("2024 YR4")!.name.en, "2024 YR4");
  assert.equal(findAsteroid("2024 YR4")!.discoveryYear, 2024);
  assert.equal(findAsteroid("Leleākūhonua")!.designation, "2015 TG387");
  // the Lucy targets and the visits already made
  assert.deepEqual(["Eurybates", "Polymele", "Leucus", "Orus", "Patroclus"].map((n) => findAsteroid(n)!.missions[0]!.name), ["Lucy", "Lucy", "Lucy", "Lucy", "Lucy"]);
  assert.equal(ASTEROIDS.filter((a) => a.missions.some((m) => !m.planned)).length, 18);
  assert.equal(ASTEROIDS.filter((a) => a.hazardous).length, 17);
});

test("findAsteroid reads an id, a number, a designation, an English or a Japanese name, and nothing else", () => {
  const eros = findAsteroid("Eros");
  for (const q of ["eros", "EROS", " Eros ", 433, "433", "A898 PA", "エロス"]) assert.equal(findAsteroid(q), eros, String(q));
  assert.equal(findAsteroid("Kamo`oalewa")!.id, "kamooalewa");
  assert.equal(findAsteroid("kamo‘oalewa"), findAsteroid("KAMOOALEWA"));
  assert.equal(findAsteroid("Steins")!.number, 2867);
  assert.equal(findAsteroid("Šteins"), findAsteroid("steins"));
  assert.equal(findAsteroid("2024 yr4")!.id, "2024-yr4");
  for (const q of ["", "   ", "nothing", "ceres", "Pluto", 0, -1, 1.5]) assert.equal(findAsteroid(q), undefined, String(q));
});

test("two-body positions against JPL Horizons within a year of each epoch: the error is measured and bounded", () => {
  assert.ok(fixture.bodies.length >= 16);
  const kinds = new Set(fixture.bodies.map((b) => b.kind));
  assert.equal(kinds.size, 5, "every kind is measured");
  // measured worst error in au at (the epoch, half a year, a year) by kind when the bounds were set: near-Earth 2e-8 / 1.6e-4 / 6e-4, main belt 2e-8 / 9.5e-4 / 3.7e-3, trojan, centaur and trans-Neptunian 1e-8 / 1.7e-4 / 7e-4
  const bound: Record<AsteroidKind, number[]> = { "near-earth": [1e-7, 4e-4, 1e-3], "main-belt": [1e-7, ASTEROID_ACCURACY.halfYearAu, ASTEROID_ACCURACY.yearAu], trojan: [1e-7, 4e-4, 1e-3], centaur: [1e-7, 4e-4, 1e-3], "trans-neptunian": [1e-7, 4e-4, 1e-3] };
  const worst = { epoch: 0, half: 0, year: 0 };
  for (const body of fixture.bodies) {
    const rec = findAsteroid(body.id)!;
    assert.equal(rec.kind, body.kind);
    assert.equal(body.rows.length, 5);
    for (const row of body.rows) {
      const dt = Math.abs(row[0]! - rec.elements.epochJd);
      const err = length(sub(asteroidPosition(rec, utcOf(row[0]!)), [row[1]!, row[2]!, row[3]!])) / AU_KM;
      const level = dt < 1 ? 0 : dt < 200 ? 1 : 2;
      assert.ok(err < bound[body.kind][level]!, `${body.id} ${dt.toFixed(0)} days from the epoch: ${err.toExponential(2)} au`);
      const key = (["epoch", "half", "year"] as const)[level]!;
      worst[key] = Math.max(worst[key], err);
    }
  }
  console.log("asteroids against Horizons, worst au at the epoch / half a year / a year:", worst.epoch.toExponential(2), worst.half.toExponential(2), worst.year.toExponential(2));
  assert.ok(worst.epoch < ASTEROID_ACCURACY.epochAu && worst.half < ASTEROID_ACCURACY.halfYearAu && worst.year < ASTEROID_ACCURACY.yearAu);
});

test("positions: km and au agree, a body can be given by name, number or record, and the same moment gives the same answer", () => {
  const day = Date.UTC(2026, 10, 11);
  const au = asteroidPositionAu("Eros", day);
  const km = asteroidPosition("Eros", new Date(day));
  for (let k = 0; k < 3; k += 1) assert.ok(Math.abs(km[k]! - au[k]! * AU_KM) < 1e-3);
  assert.deepEqual(asteroidPositionAu(433, day), au);
  assert.deepEqual(asteroidPositionAu(findAsteroid("Eros")!, day), au);
  const r = length(au);
  const el = findAsteroid("Eros")!.elements;
  assert.ok(r >= el.q - 1e-6 && r <= el.a * (1 + el.e) + 1e-6, "between perihelion and aphelion");
  assert.throws(() => asteroidPositionAu("Ceres", day), RangeError);
  assert.throws(() => asteroidPositionAu("Eros", Number.NaN), RangeError);
  assert.throws(() => asteroidPositionAu("Eros", "2026-11-11" as unknown as number), TypeError);
  assert.throws(() => asteroidPositionAu({} as unknown as string, day), TypeError);
  assert.throws(() => asteroidPositionAu(null as unknown as string, day), TypeError);
});

test("distances from the Sun and the Earth", () => {
  const day = Date.UTC(2026, 10, 11);
  const d = asteroidDistances("Apophis", day);
  assert.ok(d.sunAu > 0.7 && d.sunAu < 1.1);
  assert.ok(Math.abs(d.earthKm - d.earthAu * AU_KM) < 1e-3);
  assert.ok(Math.abs(d.earthLunar - d.earthKm / 384_400) < 1e-9);
  assert.ok(Math.abs(d.lightMinutes - d.earthKm / 299_792.458 / 60) < 1e-9);
  // Hygiea is always more than 1.5 au from the Earth, Apophis' orbit is nearly the Earth's
  assert.ok(asteroidDistances("Hygiea", day).earthAu > 1.5);
  // the Earth is where the package puts it
  const earth = d.earthAu;
  assert.ok(earth > 0 && earth < 2.2);
});

test("the orbit line closes, is an ellipse of the elements, and has the points asked for", () => {
  const pts = asteroidOrbitPoints("Eros", 90);
  assert.equal(pts.length, 91);
  assert.deepEqual(pts[0], pts[90]);
  const el = findAsteroid("Eros")!.elements;
  const radii = pts.map((p) => length(p));
  assert.ok(Math.abs(Math.min(...radii) - el.q) < 1e-3 && Math.abs(Math.max(...radii) - el.a * (1 + el.e)) < 2e-3);
  assert.equal(asteroidOrbitPoints("Eros").length, 181);
  assert.equal(asteroidOrbitPoints("Eros", 2).length, 9, "at least eight segments");
  // every point lies in the orbit's plane: the normal from the node and the inclination
  const i = (el.i * Math.PI) / 180;
  const o = (el.node * Math.PI) / 180;
  const normal = [Math.sin(i) * Math.sin(o), -Math.sin(i) * Math.cos(o), Math.cos(i)];
  for (const p of pts) assert.ok(Math.abs(p[0] * normal[0]! + p[1] * normal[1]! + p[2] * normal[2]!) < 1e-9);
  // the body is on its line: its position at the epoch is one of the line's points on the same ellipse
  const here = asteroidPositionAu("Eros", utcOf(el.epochJd));
  const near = Math.min(...asteroidOrbitPoints("Eros", 720).map((p) => length(sub(p, here))));
  assert.ok(near < 0.02);
  assert.ok(Math.abs(asteroidPeriodDays("Eros") - 643.2) < 1, "Eros' year is about 643 days");
});

test("the door: a record as the data door's small body, and a body made from elements", () => {
  const jd = 2_461_200.5;
  for (const id of ["eros", "hektor", "salacia"]) {
    const door = asteroidAsSmallBody(id);
    // the door counts from the epoch in the same Julian date (TT): the same orbit, the same place
    const ours = asteroidPositionAu(id, utcOf(jd + 100));
    const at = smallBodyAt(door, jd + 100);
    assert.ok(length(sub(at, ours)) < 1e-9, `${id}: ${length(sub(at, ours)).toExponential(2)}`);
    assert.equal(door.name, findAsteroid(id)!.name.en);
  }
  assert.equal(asteroidAsSmallBody(asteroidFromElements("X", { epochJd: 2_461_200.5, a: 2.5, e: 0.1, i: 5, node: 10, peri: 20, ma: 30 })).H, 99);
  const mine = asteroidFromElements("2026 XX", { epochJd: 2_461_200.5, a: 1.8, e: 0.4, i: 12, node: 80, peri: 120, ma: 10 });
  assert.equal(mine.kind, "near-earth");
  assert.equal(mine.group, "Amor", "q 1.08 au: outside the Earth's orbit");
  assert.equal(mine.id, "2026-xx");
  assert.equal(mine.source, "elements given by the caller");
  assert.ok(Math.abs(mine.elements.n - 360 / (Math.sqrt(1.8 ** 3) * 365.256363)) < 1e-9);
  assert.equal(asteroidFromElements("a", { epochJd: 1, a: 0.7, e: 0.2, i: 0, node: 0, peri: 0, ma: 0 }).group, "Atira");
  assert.equal(asteroidFromElements("b", { epochJd: 1, a: 0.9, e: 0.5, i: 0, node: 0, peri: 0, ma: 0 }).group, "Aten");
  assert.equal(asteroidFromElements("c", { epochJd: 1, a: 1.5, e: 0.5, i: 0, node: 0, peri: 0, ma: 0 }).group, "Apollo");
  assert.equal(asteroidFromElements("d", { epochJd: 1, a: 2.7, e: 0.1, i: 0, node: 0, peri: 0, ma: 0 }).kind, "main-belt");
  assert.equal(asteroidFromElements("e", { epochJd: 1, a: 5.2, e: 0.05, i: 0, node: 0, peri: 0, ma: 0 }).kind, "trojan");
  assert.equal(asteroidFromElements("f", { epochJd: 1, a: 5.2, e: 0.5, i: 0, node: 0, peri: 0, ma: 0 }).kind, "centaur");
  assert.equal(asteroidFromElements("g", { epochJd: 1, a: 20, e: 0.2, i: 0, node: 0, peri: 0, ma: 0 }).kind, "centaur");
  assert.equal(asteroidFromElements("h", { epochJd: 1, a: 40, e: 0.2, i: 0, node: 0, peri: 0, ma: 0 }).kind, "trans-neptunian");
  assert.throws(() => asteroidFromElements("i", { epochJd: 1, a: 3, e: 1.2, i: 0, node: 0, peri: 0, ma: 0 }), RangeError);
  assert.throws(() => asteroidFromElements("j", { epochJd: 1, a: -3, e: 0.1, i: 0, node: 0, peri: 0, ma: 0 }), RangeError);
  assert.throws(() => asteroidFromElements("k", { epochJd: Number.NaN, a: 3, e: 0.1, i: 0, node: 0, peri: 0, ma: 0 }), RangeError);
});

test("the table is a chunk of its own: no other entry point of the package carries it", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const bundle = async (contents: string) => {
    const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", minify: true, write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"], loader: { ".css": "text", ".svg": "text", ".txt": "text" } });
    return result.outputFiles.map((file) => file.text).join("");
  };
  // Eros' semi-major axis, which appears only in the table
  const marks = ["1.458243716760167"];
  const asteroids = await bundle(`export * from "./src/asteroids.ts";`);
  for (const mark of marks) assert.ok(asteroids.includes(mark), `the /asteroids bundle holds the table (${mark})`);
  for (const entry of ["./src/index.ts", "./src/space/index.ts", "./src/spacecraft.ts", "./src/roadster.ts", "./src/nearest.ts", "./src/element.ts", "./src/space/element.ts", "./src/door/index.ts"]) {
    const text = await bundle(`import ${JSON.stringify(entry)};`);
    for (const mark of marks) assert.ok(!text.includes(mark), `${entry} does not carry the asteroid table`);
  }
  const raw = readFileSync(new URL("../src/data/asteroids.ts", import.meta.url));
  const table = gzipSync(raw, { level: 9 }).length;
  console.log(`asteroids: ${ASTEROIDS.length} bodies, table source ${raw.length} bytes, ${table} bytes gzipped`);
  assert.ok(table < 25_000);
});
