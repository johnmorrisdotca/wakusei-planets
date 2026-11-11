// The belts as data (MODULES-558): seven belts of numbered small bodies from NASA/JPL's Small-Body Database, a source for the data door, positions, counts, density by distance, the honest spacing, and the flight through a belt.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import {
  BELT_EPOCH,
  BELT_IDS,
  BELT_TOTALS,
  BELTS,
  beltCounts,
  beltDensity,
  beltFlight,
  beltNote,
  beltPositions,
  beltSpacing,
  beltsSource,
  loadBeltBodies,
  OORT,
  parseBeltRows,
} from "../src/belts/index.ts";
import { BELT_SAMPLE } from "../src/belts/totals.ts";
import { readSmallBodies, smallBodyAt } from "../src/door/index.ts";
import { createSmallBodyPoints, type PointsThree } from "../src/door/points.ts";
import { createSourceBook } from "../src/door/book.ts";
import { creditLine, validateSource } from "../src/data-door.ts";
import { ridePose } from "../src/space/ride.ts";
import { length } from "../src/vec.ts";

const AU_KM = 149_597_870.7;
const bodies = await loadBeltBodies();

test("a few thousand numbered bodies in seven belts, each carrying the belt it is in, with real counts beside them", () => {
  assert.deepEqual([...BELT_IDS], ["main", "hilda", "trojan", "centaur", "classical", "resonant", "scattered"]);
  assert.ok(bodies.length > 2000 && bodies.length < 6000, String(bodies.length));
  const counts = beltCounts(bodies);
  for (const id of BELT_IDS) {
    assert.equal(counts[id], BELT_SAMPLE[id], id);
    assert.equal(BELTS[id].sample, counts[id]);
    assert.ok(BELTS[id].known >= BELTS[id].sample, `${id}: the database knows at least what is carried`);
    assert.ok(BELTS[id].name.en.length > 0 && BELTS[id].name.ja.length > 0 && BELTS[id].about.en.length > 0 && BELTS[id].about.ja.length > 0);
  }
  // what the database held when it was read: about 1.58 million asteroids and about 8,300 trans-Neptunian objects
  assert.ok(BELT_TOTALS.all > 1_500_000 && BELT_TOTALS.all < 2_000_000);
  assert.ok(BELT_TOTALS.tno > 7000 && BELT_TOTALS.tno < 12_000);
  assert.equal(BELT_TOTALS.classical + BELT_TOTALS.resonant + BELT_TOTALS.scattered <= BELT_TOTALS.tno, true);
  assert.equal(BELT_EPOCH, 2461200.5);
});

test("every body is a real ellipse the shader can draw, and sits in the part of the sky its belt does", () => {
  const range: Record<string, [number, number]> = { main: [2, 3.3], hilda: [3.8, 4.2], trojan: [4.6, 5.8], centaur: [4, 60], classical: [38, 50], resonant: [35, 66], scattered: [25, 5000] };
  for (const body of bodies) {
    assert.ok(body.a > 0 && body.e >= 0 && body.e < 1 && body.H > -2 && body.H < 22, body.name);
    const [lo, hi] = range[body.belt]!;
    assert.ok(body.a >= lo && body.a <= hi, `${body.name} (${body.belt}): a=${body.a}`);
    assert.equal(body.epoch, BELT_EPOCH);
  }
  // the famous ones are there: Achilles leads Jupiter's Trojans, Hygiea is in the main belt
  assert.ok(bodies.some((b) => b.name === "588 Achilles" && b.belt === "trojan"));
  assert.ok(bodies.some((b) => b.name === "10 Hygiea" && b.belt === "main"));
  // the bodies the package draws as bodies of their own are not in a belt as well
  for (const own of ["1 Ceres", "4 Vesta", "2 Pallas", "2060 Chiron", "5145 Pholus", "134340 Pluto"]) assert.ok(!bodies.some((b) => b.name === own), own);
});

test("the Jupiter Trojans are two swarms, in two crowded places a good way apart in the sky", () => {
  const lon = (b: (typeof bodies)[number]): number => {
    const [x, y] = smallBodyAt(b, BELT_EPOCH);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };
  const trojans = bodies.filter((b) => b.belt === "trojan").map(lon);
  const bins = new Array<number>(36).fill(0);
  for (const l of trojans) bins[Math.floor(l / 10)]! += 1;
  const peaks = bins.map((n, k) => [n, k] as const).sort((a, b) => b[0] - a[0]);
  assert.ok(peaks[0]![0] > trojans.length * 0.08, "a crowded place");
  // the second swarm is the best bin that is not beside the first
  const second = peaks.find(([, k]) => Math.min(Math.abs(k - peaks[0]![1]), 36 - Math.abs(k - peaks[0]![1])) >= 5);
  assert.ok(second !== undefined && second[0] > trojans.length * 0.05, "and another, well away from it");
});

test("the source is the package's own, a record source the door accepts, credited with its licence, read once, and every body arrives", async () => {
  const source = beltsSource();
  validateSource(source, []);
  assert.equal(source.kind, "records");
  assert.ok(creditLine([{ source: source.info, own: true, used: 1 }], "en").includes("Small-Body Database"));
  assert.ok(creditLine([{ source: source.info, own: true, used: 1 }], "ja").includes("小天体データベース"));
  assert.equal(source.info.licence.nonCommercial, undefined);
  assert.equal(source.info.licence.shareAlike, undefined);
  const read = await readSmallBodies(source, new AbortController().signal);
  assert.equal(read.status, "ok");
  assert.equal(read.records.length, bodies.length);
  assert.equal(read.skipped, 0);
  const book = createSourceBook({ kinds: ["records"] });
  book.addSource(source);
  assert.equal(book.isOwn(source), true, "the package's own, so data=own keeps it");
  await book.ready();
  assert.equal(book.smallBodies().length, bodies.length);
  book.ownOnly(true);
  assert.equal(book.smallBodies().length, bodies.length);
  book.dispose();
});

test("positions, counts and density by distance are pure functions of the bodies and the date", () => {
  const jd = 2461350.5;
  const main = bodies.filter((b) => b.belt === "main");
  const place = beltPositions(main, jd);
  assert.equal(place.length, main.length * 3);
  const r = main.map((_, k) => Math.hypot(place[k * 3]!, place[k * 3 + 1]!, place[k * 3 + 2]!));
  assert.ok(Math.min(...r) > 1.2 && Math.max(...r) < 4.6, `${Math.min(...r)} to ${Math.max(...r)}`);
  const density = beltDensity(main, jd, { from: 1, to: 5, bins: 8 });
  assert.equal(density.count.reduce((a, b) => a + b, 0), main.length);
  assert.equal(density.start.length, 8);
  assert.ok(density.perCubicAu.every((n) => n >= 0 && Number.isFinite(n)));
  // the main belt is between 2 and 3.3 au: the slices of 2.5 to 3.5 au hold most of it
  assert.ok(density.count[3]! + density.count[4]! > 0.6 * main.length, String(density.count));
  assert.ok(density.perCubicAu[3]! > density.perCubicAu[0]!);
  // the whole sky, to 60 au, in 60 slices by default
  assert.equal(beltDensity(bodies, jd).count.length, 60);
});

test("space is mostly empty: even the known main belt's neighbours are millions of kilometres apart, and the drawn ones much further", () => {
  const jd = BELT_EPOCH;
  const main = beltSpacing("main", bodies, jd);
  assert.ok(main.innerAu > 1.8 && main.outerAu < 3.5 && main.thicknessAu > 0.2 && main.thicknessAu < 2, JSON.stringify(main));
  // 1.4 million known bodies in a ring of some cubic au: neighbours a few million km apart, several times the Moon's distance (384,400 km)
  assert.ok(main.known > 1.5e6 && main.known < 8e6, String(main.known));
  assert.ok(main.drawn > 4 * main.known, "the ones drawn are far fewer, so further apart");
  const kuiper = beltSpacing("classical", bodies, jd);
  assert.ok(kuiper.known > 5 * main.known, "the Kuiper belt is emptier still");
  for (const id of BELT_IDS) assert.ok(beltSpacing(id, bodies, jd).known > 384_400, `${id} is emptier than the Moon's distance`);
});

test("the sentence on the view says how many are known, how far apart they are in Moon distances, that the dots are only the brightest, and is in both languages", () => {
  const spacing = beltSpacing("main", bodies, BELT_EPOCH);
  const en = beltNote("main", spacing, "en");
  const ja = beltNote("main", spacing, "ja");
  assert.match(en, /1,429,419 bodies are known/);
  assert.match(en, /Moon distances/);
  assert.match(en, /1,300 drawn are only the brightest/);
  assert.match(ja, /1,429,419個/);
  assert.match(ja, /約[0-9,]+万km/);
  assert.match(ja, /月までの距離/);
  assert.match(ja, /1,300個/);
  assert.equal(OORT.innerAu, 2000);
  assert.ok(OORT.outerAu > OORT.innerAu * 10);
});

test("rows are read back as the data holds them, and a short or damaged line is left out", () => {
  const read = parseBeltRows("trojan", "588 Achilles|5.216|.148|10.3|316.5|134.3|93.3|8.2\nnot a row\n|1|2", 2461200.5);
  assert.equal(read.length, 1);
  assert.deepEqual({ ...read[0]! }, { name: "588 Achilles", a: 5.216, e: 0.148, i: 10.3, node: 316.5, peri: 134.3, M0: 93.3, epoch: 2461200.5, H: 8.2, belt: "trojan" });
});

test("the flight goes round the Sun in the belt's middle, tilted to the ecliptic, at the speed it says, and its camera looks the way it goes with north at the top", () => {
  const point = beltFlight("main");
  const day = 86_400_000;
  const t = Date.UTC(2026, 10, 10);
  const a = point.at(t);
  const b = point.at(t + day);
  assert.ok(Math.abs(length(a.position) / AU_KM - 2.7) < 1e-6);
  assert.ok(Math.abs(length(b.position) / AU_KM - 2.7) < 1e-6);
  // 0.3 au a day, along the way it goes
  assert.ok(Math.abs((length(a.velocity) * 86_400) / AU_KM - 0.3) < 1e-6);
  assert.ok(Math.abs(length([b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]]) / AU_KM - 0.3) < 0.01);
  // it stays out of the ecliptic plane by a tilt of 6 degrees at most, so it passes through the belt's thickness: the ecliptic's pole in the scene's axes is (0, cos e, sin e)
  const pole = [0, Math.cos((23.4392911 * Math.PI) / 180), Math.sin((23.4392911 * Math.PI) / 180)] as const;
  let reach = 0;
  for (let k = 0; k < 200; k += 1) {
    const p = point.at(t + k * day).position;
    reach = Math.max(reach, Math.abs(p[0] * pole[0] + p[1] * pole[1] + p[2] * pole[2]) / length(p));
  }
  assert.ok(Math.abs(Math.asin(reach) - (6 * Math.PI) / 180) < 0.01, String(reach));
  const pose = ridePose({ position: a.position, velocity: a.velocity, radius: 1, look: "ahead", yaw: 0, tilt: 0, zoom: 1 });
  const v = a.velocity;
  const along = (pose.forward[0] * v[0] + pose.forward[1] * v[1] + pose.forward[2] * v[2]) / length(v);
  assert.ok(along > 0.999999, "looks along the way it goes");
  assert.ok(pose.up[0] * pole[0] + pose.up[1] * pole[1] + pose.up[2] * pole[2] > 0.9, "north at the top");
  assert.ok(Math.abs(pose.up[0] * pose.forward[0] + pose.up[1] * pose.forward[1] + pose.up[2] * pose.forward[2]) < 1e-9);
  for (const id of BELT_IDS) assert.ok(length(beltFlight(id).at(t).position) > 0);
});

test("one instanced draw for each belt, in its own colour; a body with no belt is drawn with the rest, and the draws follow what is given", () => {
  const T = THREE as unknown as PointsThree;
  const points = createSmallBodyPoints(T, { colours: Object.fromEntries(BELT_IDS.map((id) => [id, BELTS[id].colour])) });
  points.set(bodies);
  points.update({ jd: BELT_EPOCH, mode: "compressed", sun: [0, 0, 0], width: 800, height: 600, ratio: 1 });
  assert.equal(points.count, bodies.length);
  assert.equal(points.draws, 7);
  for (const id of BELT_IDS) assert.equal(points.countOf(id), BELT_SAMPLE[id]);
  const meshes = points.object.children as THREE.Mesh[];
  assert.equal(meshes.length, 7);
  const colours = new Set(meshes.map((m) => JSON.stringify((m.material as THREE.ShaderMaterial).uniforms["uColour"]!.value.toArray())));
  assert.equal(colours.size, 7, "each belt has its own colour");
  // a belt taken out, a body of a page's own added: the draws follow
  points.set([...bodies.filter((b) => b.belt !== "hilda"), { name: "mine", a: 2, e: 0.1, i: 1, node: 0, peri: 0, M0: 0, epoch: BELT_EPOCH, H: 9 }]);
  points.update({ jd: BELT_EPOCH, mode: "true", sun: [0, 0, 0], width: 800, height: 600, ratio: 1 });
  assert.equal(points.draws, 7);
  assert.equal(points.countOf("hilda"), 0);
  assert.equal(points.countOf(""), 1);
  points.dispose();
});
