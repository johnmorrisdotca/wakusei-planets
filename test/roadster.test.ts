// The Tesla Roadster path against JPL Horizons (target -143205): positions, speeds and the orbit at 15 times that are on no row of the table (test/data/roadster-horizons.json, fetched by scripts/make-roadster-data.py:
// the car from the Sun, the Earth and Mars, and Horizons' own osculating elements), the closest approaches against Horizons' vectors from the planets at the moments found, Horizons' own table of encounters, the errors a bad input gives,
// and that the table is a chunk of its own, which none of the package's other entry points carry.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import { ROADSTER_ROWS, ROADSTER_START } from "../src/data/roadster.ts";
import {
  ROADSTER,
  ROADSTER_ACCURACY,
  roadsterApproaches,
  roadsterElements,
  roadsterEvents,
  roadsterPosition,
  roadsterPositionAu,
  roadsterSeries,
  roadsterSpeed,
  roadsterStats,
  roadsterVelocity,
} from "../src/roadster.ts";
import { heliocentric } from "../src/ephemeris.ts";
import { ttMinusUtc } from "../src/time.ts";
import { length, sub, type Vec3 } from "../src/vec.ts";

type Row = number[];
interface Fixture {
  times: number[];
  sun: Row[];
  earth: Row[];
  mars: Row[];
  elements: Row[];
  approachTimes: { earth: number[]; mars: number[] };
  approachEarth: Row[];
  approachMars: Row[];
}
const fixture = JSON.parse(readFileSync(new URL("./data/roadster-horizons.json", import.meta.url), "utf8")) as Fixture;

const AU_KM = 149_597_870.7;
/** A Julian date in TDB (taken as terrestrial time) as the UTC milliseconds the functions take. */
const utcOf = (jd: number): number => {
  const tt = (jd - 2_440_587.5) * 86_400_000;
  return tt - ttMinusUtc(tt) * 1000;
};
const DAY = 86_400_000;

test("the span starts where Horizons' record starts and ends on 2035-01-01", () => {
  assert.equal(new Date(ROADSTER.record.start).toISOString(), "2018-02-07T02:58:50.816Z");
  assert.equal(new Date(ROADSTER.record.end).toISOString(), "2035-01-01T02:58:50.816Z");
  assert.equal(ROADSTER_ACCURACY.from, ROADSTER.record.start);
  assert.equal(ROADSTER_ACCURACY.to, ROADSTER.record.end);
  assert.equal(ROADSTER.launch, Date.UTC(2018, 1, 6, 20, 45));
  assert.equal(ROADSTER.horizonsId, "-143205");
  assert.equal(ROADSTER_ROWS.length % 7, 0);
  assert.equal(ROADSTER_START, (2458156.625 - 2440587.5) * 86_400_000);
  assert.equal(ROADSTER.name.ja, "スターマン");
  assert.equal(ROADSTER.car.ja, "テスラ・ロードスター");
});

test("the rows are in time order, the first day's two hours apart and a step of days after day 10", () => {
  const hours: number[] = [];
  for (let i = 0; i < ROADSTER_ROWS.length; i += 7) hours.push(ROADSTER_ROWS[i]!);
  assert.deepEqual(hours.slice(0, 13), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
  for (let i = 1; i < hours.length; i += 1) assert.ok(hours[i]! > hours[i - 1]!);
  assert.deepEqual(hours.slice(13, 22), [48, 72, 96, 120, 144, 168, 192, 216, 240]);
  assert.equal(hours[22]! - hours[21]!, ROADSTER_ACCURACY.stepDays * 24);
});

test("positions and velocities match Horizons at 15 times that are on no row, including 2018-02-10 and the Mars pass of October 2020", () => {
  assert.ok(fixture.times.length >= 8);
  let worst = 0;
  let worstVelocity = 0;
  for (let i = 0; i < fixture.times.length; i += 1) {
    const ms = utcOf(fixture.times[i]!);
    const [, x, y, z, vx, vy, vz] = fixture.sun[i]!;
    const miss = length(sub(roadsterPosition(ms), [x!, y!, z!]));
    worst = Math.max(worst, miss);
    assert.ok(miss <= 1000, `${new Date(ms).toISOString()}: ${miss.toFixed(0)} km from Horizons`);
    const off = length(sub(roadsterVelocity(ms), [vx!, vy!, vz!]));
    worstVelocity = Math.max(worstVelocity, off);
    assert.ok(off <= 0.005, `${new Date(ms).toISOString()}: velocity off by ${(off * 1000).toFixed(1)} m/s`);
    assert.ok(Math.abs(roadsterSpeed(ms) - Math.hypot(vx!, vy!, vz!)) <= 0.005);
  }
  assert.ok(fixture.times.some((jd) => new Date(utcOf(jd)).toISOString().startsWith("2018-02-10")));
  assert.ok(fixture.times.some((jd) => new Date(utcOf(jd)).toISOString().startsWith("2020-10-07")));
  assert.ok(fixture.times.some((jd) => new Date(utcOf(jd)).toISOString().startsWith("2026-11-11")));
  console.log(`roadster: worst position miss ${worst.toFixed(0)} km, worst velocity miss ${(worstVelocity * 1000).toFixed(1)} m/s at 15 times; the table's own measured worst is ${ROADSTER_ACCURACY.interpolationKm} km`);
});

test("the measured accuracy is stated, under 1,000 km, with the span and a note", () => {
  assert.ok(ROADSTER_ACCURACY.interpolationKm > 0 && ROADSTER_ACCURACY.interpolationKm < 1000);
  assert.equal(ROADSTER_ACCURACY.stepDays, 10);
  assert.match(ROADSTER_ACCURACY.note, /prediction/);
});

test("the position in au is the position in km over an astronomical unit, in the planets' own axes", () => {
  const ms = Date.UTC(2020, 9, 7, 6);
  const [x, y, z] = roadsterPositionAu(ms);
  const km = roadsterPosition(ms);
  assert.ok(Math.abs(x * AU_KM - km[0]) < 1e-3 && Math.abs(y * AU_KM - km[1]) < 1e-3 && Math.abs(z * AU_KM - km[2]) < 1e-3);
  const mars = heliocentric("mars", ms);
  assert.ok(Math.hypot(x - mars[0], y - mars[1], z - mars[2]) < 0.06, "the car is 0.05 au from Mars then");
});

test("the distances, light times and speeds match Horizons' vectors from the Earth and from Mars", () => {
  for (let i = 0; i < fixture.times.length; i += 1) {
    const ms = utcOf(fixture.times[i]!);
    const stats = roadsterStats(ms);
    const label = new Date(ms).toISOString();
    const earth = fixture.earth[i]!;
    const mars = fixture.mars[i]!;
    const sun = fixture.sun[i]!;
    // the planets are the package's own (VSOP87B): a few thousand kilometres at most, on distances of tens of millions
    assert.ok(Math.abs(stats.earth.km - Math.hypot(earth[1]!, earth[2]!, earth[3]!)) < 5000, `${label} Earth`);
    assert.ok(Math.abs(stats.mars.km - Math.hypot(mars[1]!, mars[2]!, mars[3]!)) < 6000, `${label} Mars`);
    assert.ok(Math.abs(stats.sun.km - Math.hypot(sun[1]!, sun[2]!, sun[3]!)) < 1000, `${label} Sun`);
    assert.ok(Math.abs(stats.speed.sun - Math.hypot(sun[4]!, sun[5]!, sun[6]!)) < 0.005);
    assert.ok(Math.abs(stats.speed.earth - Math.hypot(earth[4]!, earth[5]!, earth[6]!)) < 0.005, `${label} speed from the Earth`);
    assert.ok(Math.abs(stats.speed.mars - Math.hypot(mars[4]!, mars[5]!, mars[6]!)) < 0.005, `${label} speed from Mars`);
    for (const d of [stats.sun, stats.earth, stats.mars]) {
      assert.equal(d.miles, d.km / 1.609344);
      assert.equal(d.au, d.km / AU_KM);
      assert.equal(d.lightSeconds, d.km / 299_792.458);
    }
  }
  // the Sun's light takes about 705 seconds to reach the car on 2026-11-11 (1.41 au at 499.0 seconds an au)
  const stats = roadsterStats(Date.UTC(2026, 10, 11, 7, 19));
  assert.ok(Math.abs(stats.sun.lightSeconds - stats.sun.au * 499.004784) < 0.5);
});

test("days since launch, the orbits made and the period", () => {
  assert.equal(roadsterStats(Date.UTC(2018, 1, 16, 20, 45)).daysSinceLaunch, 10);
  const stats = roadsterStats(Date.UTC(2026, 10, 11, 7, 19));
  assert.ok(Math.abs(stats.daysSinceLaunch - 3199.44) < 0.01);
  assert.equal(stats.orbitsCompleted, 5);
  assert.equal(Math.floor(stats.orbits), 5);
  // the angle swept round the Sun, worked out another way: the days since launch over the period (the period is not constant, so only roughly)
  assert.ok(Math.abs(stats.orbits - stats.daysSinceLaunch / stats.periodDays) < 0.15, `${stats.orbits} orbits`);
  assert.ok(Math.abs(stats.periodDays - 557.2) < 0.5);
  // each perihelion adds one orbit
  const perihelia = roadsterEvents().filter((e) => e.kind === "perihelion");
  for (let i = 1; i < perihelia.length; i += 1) {
    const gap = roadsterStats(perihelia[i]!.date).orbits - roadsterStats(perihelia[i - 1]!.date).orbits;
    assert.ok(Math.abs(gap - 1) < 0.01, `orbits between perihelia ${i - 1} and ${i}: ${gap}`);
  }
  const first = roadsterStats(ROADSTER.record.start).orbits;
  assert.ok(first > 0 && first < 0.003, `${first} orbits at the start of the record`);
});

test("the orbital elements match Horizons' own at the same moments", () => {
  for (let i = 0; i < fixture.times.length; i += 1) {
    const ms = utcOf(fixture.times[i]!);
    const [, ec, qr, inc, om, w, , , ma, ta, a, ad, pr] = fixture.elements[i]!;
    const o = roadsterElements(ms);
    const label = new Date(ms).toISOString();
    assert.ok(Math.abs(o.eccentricity - ec!) < 1e-4, `${label} e`);
    assert.ok(Math.abs(o.perihelionKm - qr!) < 8000, `${label} perihelion`);
    assert.ok(Math.abs(o.aphelionKm - ad!) < 16000, `${label} aphelion`);
    assert.ok(Math.abs(o.semiMajorAxisKm - a!) < 8000, `${label} a`);
    assert.ok(Math.abs(o.inclination - inc!) < 1e-3, `${label} i`);
    assert.ok(Math.abs(o.ascendingNode - om!) < 2e-3, `${label} node`);
    assert.ok(Math.abs(o.argumentOfPerihelion - w!) < 0.05, `${label} w`);
    assert.ok(Math.abs(o.periodDays - pr! / 86_400) < 0.05, `${label} period`);
    const turn = (d: number): number => ((d + 540) % 360) - 180;
    assert.ok(Math.abs(turn(o.meanAnomaly - ma!)) < 0.05, `${label} mean anomaly`);
    assert.ok(Math.abs(turn(o.trueAnomaly - ta!)) < 0.05, `${label} true anomaly`);
    assert.equal(o.perihelionAu, o.perihelionKm / AU_KM);
    assert.equal(o.aphelionAu, o.aphelionKm / AU_KM);
    assert.equal(o.semiMajorAxisAu, o.semiMajorAxisKm / AU_KM);
  }
  // about 0.986 au to 1.664 au in about 557 days, on the plane tilted 1 degree
  const now = roadsterElements(Date.UTC(2026, 10, 11));
  assert.ok(now.perihelionAu > 0.98 && now.perihelionAu < 0.99 && now.aphelionAu > 1.66 && now.aphelionAu < 1.67);
  assert.ok(now.inclination > 1 && now.inclination < 1.1);
});

test("a close approach is a least distance: the distances from Horizons' vectors at the moments found are what the function says, and either side is further", () => {
  const { earth, mars } = fixture.approachTimes;
  for (const [body, times, rows] of [["earth", earth, fixture.approachEarth], ["mars", mars, fixture.approachMars]] as const) {
    const found = roadsterApproaches(body);
    assert.equal(found.length, times.length);
    found.forEach((a, i) => {
      assert.ok(Math.abs(a.date - utcOf(times[i]!)) < 1000, `${body} ${i}`);
      const horizons = Math.hypot(rows[i]![1]!, rows[i]![2]!, rows[i]![3]!);
      assert.ok(Math.abs(a.distanceKm - horizons) < 6000, `${body} ${new Date(a.date).toISOString()}: ${a.distanceKm.toFixed(0)} km, Horizons ${horizons.toFixed(0)}`);
      assert.ok(a.distanceKm < AU_KM);
      const planet = (ms: number): number => length(sub(roadsterPosition(ms), [0, 1, 2].map((k) => heliocentric(body, ms)[k]! * AU_KM) as unknown as Vec3));
      assert.ok(planet(a.date - DAY) > a.distanceKm && planet(a.date + DAY) > a.distanceKm);
    });
    for (let i = 1; i < found.length; i += 1) assert.ok(found[i]!.date > found[i - 1]!.date);
  }
  assert.ok(earth.length >= 5 && mars.length >= 5);
});

test("the close approach to Mars in October 2020 is Horizons' own: the date to a few minutes and the distance to a fraction of a per cent", () => {
  // Horizons' table of the object's encounters (read 2026-11-11): 2020 Oct 07.26842 TDB, Mars, 0.049505 au
  const horizonsDate = utcOf(2_459_129.5 + 0.26842);
  const october = roadsterApproaches("mars").find((a) => Math.abs(a.date - horizonsDate) < 2 * DAY)!;
  assert.ok(october !== undefined);
  assert.ok(Math.abs(october.date - horizonsDate) < 10 * 60_000, `${new Date(october.date).toISOString()} against ${new Date(horizonsDate).toISOString()}`);
  assert.ok(Math.abs(october.distanceKm / AU_KM - 0.049505) < 0.0005, `${(october.distanceKm / AU_KM).toFixed(6)} au`);
});

test("the stats name the closest approaches before and after a moment, inside the span", () => {
  const mid = Date.UTC(2026, 10, 11);
  const stats = roadsterStats(mid);
  for (const body of ["earth", "mars"] as const) {
    const n = stats.approaches[body];
    assert.ok(n.previous !== null && n.previous.date <= mid && n.next !== null && n.next.date > mid);
    assert.ok(!roadsterApproaches(body).some((a) => a.date > n.previous!.date && a.date < n.next!.date));
  }
  // before the first approach there is no previous one, after the last no next one
  assert.equal(roadsterStats(ROADSTER.record.start).approaches.mars.previous, null);
  assert.equal(roadsterStats(ROADSTER.record.end).approaches.earth.next, null);
});

test("the events: the launch first, then close approaches, perihelia and aphelia in date order with names in two languages", () => {
  const events = roadsterEvents();
  assert.equal(events[0]!.kind, "launch");
  assert.equal(events[0]!.date, ROADSTER.launch);
  for (let i = 1; i < events.length; i += 1) assert.ok(events[i]!.date >= events[i - 1]!.date);
  const kinds = new Set(events.map((e) => e.kind));
  assert.deepEqual([...kinds].sort(), ["aphelion", "earth-approach", "launch", "mars-approach", "perihelion"]);
  for (const e of events) assert.ok(e.name.en.length > 0 && e.name.ja.length > 0);
  const sunSide = events.filter((e) => e.kind === "perihelion" || e.kind === "aphelion");
  sunSide.forEach((e, i) => {
    if (i > 0) assert.notEqual(e.kind, sunSide[i - 1]!.kind, "perihelion and aphelion alternate");
    const r = length(roadsterPosition(e.date)) / AU_KM;
    assert.ok(Math.abs(e.distanceKm! / AU_KM - r) < 1e-9);
    if (e.kind === "perihelion") assert.ok(r > 0.98 && r < 0.99, `${r}`);
    else assert.ok(r > 1.66 && r < 1.67, `${r}`);
    // the speed is greatest at perihelion and least at aphelion, and the distance is a least or greatest there
    const near = (d: number): number => length(roadsterPosition(e.date + d)) / AU_KM;
    assert.ok(e.kind === "perihelion" ? near(-DAY) > r && near(DAY) > r : near(-DAY) < r && near(DAY) < r);
  });
  // Horizons' own elements give the first perihelion's time, 2458153.6205 TDB (2018-02-03, before the span), and the period of 557 days: the next is at about 2019-08-15
  const perihelia = sunSide.filter((e) => e.kind === "perihelion");
  assert.ok(Math.abs(perihelia[0]!.date - Date.UTC(2019, 7, 15, 0, 44)) < 3 * 3_600_000, new Date(perihelia[0]!.date).toISOString());
});

test("the series gives the distances and the speed at equal steps, equal to the single-moment answers", () => {
  const from = Date.UTC(2020, 8, 1);
  const to = Date.UTC(2020, 10, 1);
  const s = roadsterSeries(from, to, DAY);
  assert.equal(s.times.length, 62);
  assert.equal(s.times[0], from);
  assert.equal(s.times[61], to);
  for (const k of [0, 17, 36, 61]) {
    const one = roadsterStats(s.times[k]!);
    assert.equal(s.sunKm[k], one.sun.km);
    assert.equal(s.earthKm[k], one.earth.km);
    assert.equal(s.marsKm[k], one.mars.km);
    assert.equal(s.speed[k], one.speed.sun);
  }
  const nearest = s.marsKm.indexOf(Math.min(...s.marsKm));
  assert.equal(new Date(s.times[nearest]!).toISOString().slice(0, 10), "2020-10-07");
  assert.deepEqual(roadsterSeries(new Date(from), new Date(from), 1).times, [from]);
  assert.throws(() => roadsterSeries(from, to, 0), RangeError);
  assert.throws(() => roadsterSeries(from, to, -1), RangeError);
  assert.throws(() => roadsterSeries(to, from, DAY), /not be before/);
  assert.throws(() => roadsterSeries(ROADSTER.record.start, ROADSTER.record.end, 1000), /larger step/);
  assert.throws(() => roadsterSeries(from, ROADSTER.record.end + 5 * DAY, DAY), /outside the path/);
});

test("a date outside the span throws a RangeError that names the span; the ends themselves are inside", () => {
  for (const fn of [roadsterPosition, roadsterPositionAu, roadsterVelocity, roadsterSpeed, roadsterElements, roadsterStats]) {
    assert.throws(() => fn(ROADSTER.record.start - 60_000), (e: Error) => e instanceof RangeError && /2018-02-07T02:58:50.816Z/.test(e.message) && /2035-01-01T02:58:50.816Z/.test(e.message));
    assert.throws(() => fn(ROADSTER.record.end + 60_000), RangeError);
    assert.throws(() => fn(Date.UTC(2018, 1, 6, 21)), RangeError, "the launch itself is before the record");
    assert.throws(() => fn(Number.NaN), RangeError);
    assert.throws(() => fn(new Date(Number.NaN)), RangeError);
    assert.throws(() => fn("2020-01-01" as unknown as number), TypeError);
    assert.doesNotThrow(() => fn(ROADSTER.record.start));
    assert.doesNotThrow(() => fn(ROADSTER.record.end));
    assert.doesNotThrow(() => fn(new Date(Date.UTC(2020, 0, 1))));
  }
  assert.throws(() => roadsterApproaches("venus" as "mars"), RangeError);
});

test("the table is a chunk of its own: no other entry point of the package carries it", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const bundle = async (contents: string) => {
    const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", minify: true, write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"], loader: { ".css": "text", ".svg": "text", ".txt": "text" } });
    return result.outputFiles.map((file) => file.text).join("");
  };
  // the first row's x and the last row's y, which appear only in the table
  const marks = ["109705979", "9990610"];
  const roadster = await bundle(`export * from "./src/roadster.ts";`);
  for (const mark of marks) assert.ok(roadster.includes(mark), `the /roadster bundle holds the table (${mark})`);
  for (const entry of ["./src/index.ts", "./src/space/index.ts", "./src/spacecraft.ts", "./src/nearest.ts", "./src/element.ts", "./src/space/element.ts"]) {
    const text = await bundle(`import ${JSON.stringify(entry)};`);
    for (const mark of marks) assert.ok(!text.includes(mark), `${entry} does not carry the Roadster table`);
  }
  const table = gzipSync(readFileSync(new URL("../src/data/roadster.ts", import.meta.url)), { level: 9 }).length;
  console.log(`roadster: ${ROADSTER_ROWS.length / 7} rows, table source ${table} bytes gzipped`);
  assert.ok(table < 30_000);
});
