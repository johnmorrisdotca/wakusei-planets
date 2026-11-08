// The spacecraft paths against JPL Horizons: positions and speeds at times that were never in the fit (test/data/spacecraft-horizons.json, fetched by scripts/make-spacecraft-data.py), every flyby event against the closest approach
// of the fitted path to the body Horizons puts it at, the light time of Voyager 1, the size of each table, and the errors a bad input gives.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { craftSpan, craftTable } from "../src/data/craft.ts";
import { BODIES } from "../src/facts.ts";
import {
  loadSpacecraft,
  SPACECRAFT,
  SPACECRAFT_IDS,
  spacecraftEarthDistance,
  spacecraftErrorKm,
  spacecraftLightTime,
  spacecraftPosition,
  spacecraftSpeed,
  spacecraftSunDistance,
  spacecraftVelocity,
  type SpacecraftId,
} from "../src/spacecraft.ts";
import { ttMinusUtc } from "../src/time.ts";
import { length, sub, type Vec3 } from "../src/vec.ts";

interface Fixture {
  craft: Record<SpacecraftId, number[][]>;
  flybys: { craft: SpacecraftId; body: string; horizons: string; jd: number; distanceKm: number; bodyState: number[]; inRecord: boolean }[];
}
const fixture = JSON.parse(readFileSync(new URL("./data/spacecraft-horizons.json", import.meta.url), "utf8")) as Fixture;

/** A Julian date in TDB (taken as terrestrial time) as the UTC milliseconds the functions take. */
const utcOf = (jd: number): number => {
  const tt = (jd - 2440587.5) * 86400000;
  return tt - ttMinusUtc(tt) * 1000;
};
/** The limit the tables were fitted to: 1,000 km, or a millionth of the distance from the Sun where that is more. */
const limitKm = (r: number): number => Math.max(1000, 1e-6 * r);

test("a path that has not been loaded says so", () => {
  assert.throws(() => spacecraftPosition("voyager1", Date.UTC(2026, 0, 1)), /voyager1/);
});

await loadSpacecraft();

test("positions and speeds match Horizons at times that were not in the fit", () => {
  for (const id of SPACECRAFT_IDS) {
    const rows = fixture.craft[id];
    assert.ok(rows.length >= 8, `${id} has fixture rows`);
    for (const [jd, x, y, z, vx, vy, vz] of rows as [number, number, number, number, number, number, number][]) {
      const when = utcOf(jd);
      const miss = length(sub(spacecraftPosition(id, when), [x, y, z]));
      assert.ok(miss <= limitKm(Math.hypot(x, y, z)) * 1.05, `${id} at JD ${jd}: ${miss.toFixed(0)} km from Horizons`);
      const speed = Math.hypot(vx, vy, vz);
      const off = length(sub(spacecraftVelocity(id, when), [vx, vy, vz]));
      assert.ok(off <= 0.02 * speed, `${id} at JD ${jd}: velocity off by ${(off * 1000).toFixed(0)} m/s of ${speed.toFixed(1)} km/s`);
      assert.ok(Math.abs(spacecraftSpeed(id, when) - speed) <= 0.02 * speed);
    }
  }
});

test("every flyby, orbit insertion and the page's date agree with the closest approach of the fitted path to the body", () => {
  let checked = 0;
  for (const id of SPACECRAFT_IDS) {
    const near = fixture.flybys.filter((f) => f.craft === id);
    for (const event of SPACECRAFT[id].events) {
      if (event.kind !== "flyby" && event.kind !== "orbit-insertion") continue;
      const closest = near.reduce((best, f) => (Math.abs(utcOf(f.jd) - event.date) < Math.abs(utcOf(best.jd) - event.date) ? f : best));
      const gap = Math.abs(utcOf(closest.jd) - event.date);
      assert.ok(gap <= (event.precision === "minute" ? 10 * 60_000 : 18 * 3_600_000), `${id} ${event.name.en}: the page says ${new Date(event.date).toISOString()}, Horizons' closest approach is ${new Date(utcOf(closest.jd)).toISOString()}`);
      assert.ok(closest.inRecord, `${id} ${event.name.en} is inside the record`);
      if (event.distanceKm !== undefined) {
        const radius = event.body === undefined ? 0 : BODIES[event.body].radiusKm;
        const reported = event.distanceKm + radius;
        // a small body's own ephemeris is uncertain by thousands of kilometres (Arrokoth's is 2,000 km from where New Horizons found it)
        const slack = event.body === undefined ? 3000 : Math.max(0.08 * closest.distanceKm, 400);
        assert.ok(Math.abs(reported - closest.distanceKm) <= slack, `${id} ${event.name.en}: the page's ${event.distanceKm} km (${reported.toFixed(0)} from the centre), Horizons ${closest.distanceKm} km`);
      }
      // the fitted path against the body, which moves in a straight line for a few hours about the closest approach
      const t0 = utcOf(closest.jd);
      const body = closest.bodyState;
      let best = Infinity;
      let bestAt = t0;
      for (let dt = -3 * 3600; dt <= 3 * 3600; dt += 20) {
        const at = t0 + dt * 1000;
        const place: Vec3 = [body[0]! + body[3]! * dt, body[1]! + body[4]! * dt, body[2]! + body[5]! * dt];
        const d = length(sub(spacecraftPosition(id, at), place));
        if (d < best) {
          best = d;
          bestAt = at;
        }
      }
      assert.ok(Math.abs(bestAt - t0) <= 10 * 60_000, `${id} ${event.name.en}: the path's closest approach is ${((bestAt - t0) / 60000).toFixed(1)} minutes from Horizons'`);
      assert.ok(Math.abs(best - closest.distanceKm) <= Math.max(1500, 0.02 * closest.distanceKm), `${id} ${event.name.en}: the path passes at ${best.toFixed(0)} km, Horizons at ${closest.distanceKm} km`);
      checked += 1;
    }
  }
  assert.ok(checked >= 30, `${checked} events checked`);
});

test("Voyager 1 is about a light-day away", () => {
  const today = spacecraftLightTime("voyager1", Date.UTC(2026, 10, 8)) / 3600;
  assert.ok(today > 22.5 && today < 24.5, `${today.toFixed(2)} hours`);
  // NASA's page: one light-day from Earth on 2026-11-18 at 5:16 EST
  const day = spacecraftLightTime("voyager1", Date.UTC(2026, 10, 18, 10, 16)) / 3600;
  assert.ok(Math.abs(day - 24) < 0.25, `${day.toFixed(2)} hours`);
  assert.ok(Math.abs(spacecraftEarthDistance("voyager1", Date.UTC(2026, 10, 8)) / 299792.458 - spacecraftLightTime("voyager1", Date.UTC(2026, 10, 8))) < 1e-6);
});

test("distances from the Sun and the Earth are what the craft's story says", () => {
  assert.ok(Math.abs(spacecraftSunDistance("parker", Date.UTC(2024, 11, 24, 11, 53)) / 1e6 - 6.9) < 0.3, "Parker's closest pass is 6.9 million km from the Sun's centre");
  const webb = spacecraftEarthDistance("webb", Date.UTC(2026, 10, 8)) / 1e6;
  assert.ok(webb > 1.3 && webb < 1.7, `Webb is ${webb.toFixed(2)} million km from the Earth`);
  assert.ok(spacecraftSunDistance("voyager2", Date.UTC(2026, 10, 8)) / 149597870.7 > 130);
});

test("the facts hold together", () => {
  for (const id of SPACECRAFT_IDS) {
    const craft = SPACECRAFT[id];
    const table = craftTable(id)!;
    const [first, last] = craftSpan(table);
    assert.equal(craft.id, id);
    assert.ok(craft.name.en.length > 0 && /[぀-ヿ]/.test(craft.name.ja), `${id} has an English and a Japanese name`);
    assert.match(craft.url, /^https:\/\/science\.nasa\.gov\/mission\//);
    const startUtc = first - ttMinusUtc(first) * 1000;
    const endUtc = last - ttMinusUtc(last) * 1000;
    assert.ok(Math.abs(craft.record.start - startUtc) < 5000 && Math.abs(craft.record.end - endUtc) < 5000, `${id}'s record in the facts is the table's span`);
    const launch = craft.launch.date;
    assert.ok(craft.record.start >= launch - 12 * 3600_000 && craft.record.start - launch < 3 * 86_400_000, `${id}'s record begins soon after its launch`);
    for (const join of craft.joins) {
      const step = length(sub(spacecraftPosition(id, join.date + 1), spacecraftPosition(id, join.date - 1)));
      assert.ok(step > 0.9 * join.km && step < 1.1 * join.km, `${id}: a join of ${join.km} km at ${new Date(join.date).toISOString()} steps ${step.toFixed(0)} km`);
    }
    assert.deepEqual(craft.events.map((e) => e.date), craft.events.map((e) => e.date).sort((a, b) => a - b), `${id}'s events are in order`);
    assert.equal(craft.events[0]!.kind, "launch");
    assert.equal(craft.events[0]!.date, launch);
    assert.equal(craft.status === "ended", craft.end !== undefined || id === "cassini");
    for (const event of craft.events) assert.ok(/[぀-ヿ一-鿿]/.test(event.name.ja), `${id}: ${event.name.en} has a Japanese name`);
    assert.ok(craft.events.some((e) => e.kind === "flyby" || e.kind === "orbit-insertion" || e.kind === "arrival"));
  }
});

test("each table fits its size budget (gzipped)", () => {
  const budgets: Record<SpacecraftId, number> = { voyager1: 4, voyager2: 5.5, newhorizons: 3, pioneer10: 3.5, pioneer11: 4.5, cassini: 140, galileo: 28, juno: 85, parker: 30, webb: 4 };
  for (const id of SPACECRAFT_IDS) {
    const kilobytes = gzipSync(readFileSync(new URL(`../src/craft/${id}.ts`, import.meta.url))).length / 1024;
    assert.ok(kilobytes <= budgets[id], `${id} is ${kilobytes.toFixed(1)} kB gzipped, over its ${budgets[id]} kB budget`);
  }
});

test("the error each table reports is inside the limit it was fitted to", () => {
  for (const id of SPACECRAFT_IDS) {
    const worst = spacecraftErrorKm(id);
    assert.ok(worst > 0 && worst < 60_000, `${id}: ${worst} km`);
  }
});

test("bad inputs throw a RangeError that names the value", () => {
  assert.throws(() => spacecraftPosition("voyager1", NaN), (e: unknown) => e instanceof RangeError && /NaN/.test(e.message));
  assert.throws(() => spacecraftPosition("voyager1", new Date(NaN)), (e: unknown) => e instanceof RangeError && /Invalid Date/.test(e.message));
  assert.throws(() => spacecraftSpeed("voyager1", Infinity), (e: unknown) => e instanceof RangeError && /Infinity/.test(e.message));
  assert.throws(() => spacecraftPosition("nope" as SpacecraftId, 0), (e: unknown) => e instanceof RangeError && /"nope"/.test(e.message));
  assert.throws(() => spacecraftPosition("voyager1", Date.UTC(1977, 8, 5)), (e: unknown) => e instanceof RangeError && /1977-09-05T00:00:00\.000Z/.test(e.message) && /Voyager 1/.test(e.message));
  assert.throws(() => spacecraftPosition("cassini", Date.UTC(2018, 0, 1)), (e: unknown) => e instanceof RangeError && /2018-01-01/.test(e.message));
  assert.throws(() => spacecraftSunDistance("webb", Date.UTC(2040, 0, 1)), RangeError);
  assert.throws(() => spacecraftLightTime("galileo", -1e20), RangeError);
  assert.throws(() => spacecraftErrorKm("nope" as SpacecraftId), (e: unknown) => e instanceof RangeError && /"nope"/.test(e.message));
  return assert.rejects(loadSpacecraft("nope" as SpacecraftId), (e: unknown) => e instanceof RangeError && /"nope"/.test(e.message));
});
