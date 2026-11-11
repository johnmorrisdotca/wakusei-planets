// The close approaches of /approaches against what JPL's close-approach API returned on 2026-11-11 (scripts/make-approaches-data.py): the counts pinned, known records (Apophis on 2029-04-13), the functions that list, filter and
// search them, the sizes the absolute magnitude implies, the errors a bad input gives, and that the table is a chunk of its own.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import {
  APPROACH_ALBEDO,
  APPROACH_NOTE,
  approachDiameterKm,
  approachList,
  approachesBetween,
  approachesOf,
  approachesWhere,
  approachSizeRange,
  nearestApproaches,
  nextApproach,
} from "../src/approaches.ts";

const all = approachList();
const AU_KM = 149_597_870.7;
const FETCHED = Date.UTC(2026, 10, 11);

test("the counts are pinned to what JPL returned on 2026-11-11", () => {
  assert.equal(APPROACH_NOTE.fetched, "2026-11-11");
  assert.equal(all.length, 4183);
  const wide = all.filter((a) => a.date >= Date.UTC(2026, 0, 1));
  const close = all.filter((a) => a.date < Date.UTC(2026, 0, 1));
  assert.equal(wide.length, 3013, "every approach within 0.05 au from 2026-01-01 to 2036-12-31");
  assert.equal(close.length, 1170, "the approaches within 0.002 au from 1900 to the end of 2025");
  assert.ok(wide.every((a) => a.distanceAu <= 0.05 && a.date < Date.UTC(2037, 0, 1)));
  assert.ok(close.every((a) => a.distanceAu <= 0.002 && a.date >= Date.UTC(1900, 0, 1)));
  assert.deepEqual(APPROACH_NOTE.coverage, { wide: { from: "2026-01-01", to: "2036-12-31", maxAu: 0.05 }, close: { from: "1900-01-01", to: "2025-12-31", maxAu: 0.002 } });
  assert.equal(all.filter((a) => a.predicted).length, 1468);
  assert.ok(all.every((a) => a.predicted === a.date >= FETCHED));
  assert.equal(approachesBetween(Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1)).length, 1582);
  assert.equal(approachesBetween(Date.UTC(2029, 0, 1), Date.UTC(2030, 0, 1)).length, 161);
  assert.equal(all.filter((a) => a.diameterKm !== undefined).length, 39);
  assert.equal(all.filter((a) => a.number !== undefined).length, 122);
  assert.equal(all.filter((a) => a.name !== undefined).length, 10);
  assert.equal(all.filter((a) => a.predicted && a.distanceLunar < 1).length, 14);
});

test("the list is in date order and each record is consistent", () => {
  for (let i = 1; i < all.length; i += 1) assert.ok(all[i]!.date >= all[i - 1]!.date, `record ${i} is out of order`);
  assert.equal(new Date(all[0]!.date).toISOString(), "1910-05-09T08:36:26.860Z");
  assert.equal(new Date(all[all.length - 1]!.date).toISOString(), "2036-12-29T16:47:01.184Z");
  for (const a of all) {
    assert.ok(Math.abs(a.distanceKm - a.distanceAu * AU_KM) < 1e-3 && Math.abs(a.distanceLunar - a.distanceKm / 384_400) < 1e-9);
    assert.ok(a.minDistanceAu <= a.distanceAu * (1 + 1e-5) && a.maxDistanceAu >= a.distanceAu * (1 - 1e-5), `${a.fullName}: the least and greatest bracket the nominal distance`);
    assert.ok(a.timeSigma.minutes >= 0 && a.speedKmS > 0 && a.H > 9 && a.H < 36, a.fullName);
    assert.ok(a.sizeRange.minKm < a.sizeRange.maxKm && Math.abs(a.sizeRange.maxKm / a.sizeRange.minKm - Math.sqrt(5)) < 1e-9);
    assert.equal(Math.abs(a.jdTdb - 2_440_587.5 - a.date / 86_400_000) < 0.002, true, `${a.fullName}: UTC and TDB differ by about a minute`);
    if (a.number !== undefined) assert.equal(a.designation, String(a.number));
  }
});

test("Apophis on 2029-04-13: where it is pinned to what JPL returned", () => {
  const apophis = approachesOf("Apophis");
  assert.equal(apophis.length, 1);
  const a = apophis[0]!;
  assert.equal(a.designation, "99942");
  assert.equal(a.number, 99942);
  assert.equal(a.name, "Apophis");
  assert.equal(a.fullName, "99942 Apophis (2004 MN4)");
  assert.equal(new Date(a.date).toISOString().slice(0, 16), "2029-04-13T21:45", "JPL's 21:46 is TDB; the UTC is a minute earlier");
  assert.ok(Math.abs(a.distanceAu - 0.000254091) < 1e-9, `${a.distanceAu} au`);
  assert.ok(Math.abs(a.distanceKm - 38_011) < 1, "about 38,000 km from the Earth's centre, 31,600 km above its surface");
  assert.ok(Math.abs(a.distanceLunar - 0.0989) < 0.001, "about a tenth of the Moon's distance");
  assert.deepEqual(a.timeSigma, { minutes: 1, lessThan: true });
  assert.ok(Math.abs(a.speedKmS - 7.423) < 1e-9);
  assert.equal(a.diameterKm, 0.34);
  assert.equal(a.predicted, true);
  assert.equal(a.H, 19.09, "JPL's close-approach table has its own H, which is not the 19.7 of the orbit database: the size range follows this H");
  assert.equal(approachesOf(99942)[0], a);
  assert.equal(approachesOf("99942 apophis (2004 mn4)")[0], a);
  assert.equal(approachesOf(" APOPHIS ").length, 1);
  assert.equal(approachesOf("2004 MN4").length, 0, "only the designation JPL gives, a number, the name or the full name");
});

test("nearest approaches: nearest first, and with a filter", () => {
  const nearest = nearestApproaches(5);
  assert.deepEqual(nearest.map((a) => a.fullName), ["(2025 UC11)", "(2020 VT4)", "(2025 TF)", "(2026 TP128)", "(2024 XA)"]);
  assert.deepEqual(nearest.map((a) => Math.round(a.distanceKm)), [6599, 6746, 6780, 7490, 7726]);
  const next = nearestApproaches(3, { from: FETCHED });
  assert.deepEqual(next.map((a) => a.fullName), ["99942 Apophis (2004 MN4)", "(2008 DB)", "(2017 FU102)"]);
  assert.deepEqual(nearestApproaches(0), []);
  assert.equal(nearestApproaches(100_000).length, all.length);
  for (let i = 1; i < 50; i += 1) assert.ok(nearestApproaches(50)[i]!.distanceAu >= nearestApproaches(50)[i - 1]!.distanceAu);
});

test("next approach of an object, and the filters", () => {
  assert.equal(nextApproach("Apophis", FETCHED)!.fullName, "99942 Apophis (2004 MN4)");
  assert.equal(nextApproach("Apophis", Date.UTC(2029, 3, 14)), undefined, "none after the one in the table");
  assert.equal(nextApproach("Apophis", Date.UTC(2029, 3, 13, 21, 45, 3)) === undefined, false, "the moment itself is excluded only if it is later than the approach");
  assert.equal(new Date(nextApproach("2024 YR4", FETCHED)!.date).toISOString().slice(0, 10), "2032-12-22");
  assert.equal(nextApproach("no such body", FETCHED), undefined);
  assert.equal(nextApproach("", FETCHED), undefined);
  const near = approachesWhere({ from: FETCHED, to: Date.UTC(2030, 0, 1), maxLunar: 1 });
  assert.ok(near.length > 0 && near.every((a) => a.distanceLunar <= 1 && a.date >= FETCHED && a.date < Date.UTC(2030, 0, 1)));
  const big = approachesWhere({ from: FETCHED, minDiameterKm: 0.3 });
  assert.ok(big.length > 0 && big.every((a) => approachDiameterKm(a) >= 0.3));
  assert.ok(big.some((a) => a.name === "Apophis"));
  const small = approachesWhere({ maxDiameterKm: 0.005, predicted: false });
  assert.ok(small.length > 0 && small.every((a) => approachDiameterKm(a) <= 0.005 && !a.predicted));
  assert.equal(approachesWhere({ maxAu: 0.0003, predicted: true }).every((a) => a.distanceAu <= 0.0003), true);
  assert.equal(approachesWhere({}).length, all.length);
  assert.equal(approachesWhere({ object: "Apophis", maxLunar: 1 }).length, 1);
  assert.equal(approachesWhere({ object: "Apophis", maxLunar: 0.01 }).length, 0);
});

test("the size the absolute magnitude implies, and the albedo assumed", () => {
  assert.deepEqual(APPROACH_ALBEDO, { dark: 0.05, bright: 0.25 });
  const h22 = approachSizeRange(22);
  assert.ok(Math.abs(h22.minKm - 0.1058) < 0.001 && Math.abs(h22.maxKm - 0.2366) < 0.001, `H 22 is 106 to 237 metres, got ${h22.minKm} to ${h22.maxKm}`);
  assert.ok(Math.abs(approachSizeRange(17.75).maxKm - 1.676) < 0.01);
  assert.ok(approachSizeRange(30).maxKm < approachSizeRange(25).minKm);
  assert.throws(() => approachSizeRange(Number.NaN), RangeError);
  assert.throws(() => approachSizeRange(Infinity), RangeError);
  const measured = approachesOf("Apophis")[0]!;
  assert.equal(approachDiameterKm(measured), 0.34, "a measured diameter wins");
  const guess = all.find((a) => a.diameterKm === undefined)!;
  assert.ok(approachDiameterKm(guess) > guess.sizeRange.minKm && approachDiameterKm(guess) < guess.sizeRange.maxKm);
});

test("the note says what the table is, and bad input throws", () => {
  assert.ok(/predictions/.test(APPROACH_NOTE.text) && /2026-11-11/.test(APPROACH_NOTE.text) && /0\.05 and 0\.25/.test(APPROACH_NOTE.text));
  assert.throws(() => approachesBetween(Number.NaN, Date.UTC(2030, 0, 1)), RangeError);
  assert.throws(() => approachesBetween(Date.UTC(2029, 0, 1), "2030" as unknown as number), TypeError);
  assert.throws(() => nextApproach("Apophis", new Date(Number.NaN)), RangeError);
  assert.throws(() => nearestApproaches(-1), RangeError);
  assert.throws(() => nearestApproaches(1.5), RangeError);
  assert.throws(() => approachesWhere({ maxLunar: -1 }), RangeError);
  assert.throws(() => approachesWhere({ minDiameterKm: Number.NaN }), RangeError);
  assert.deepEqual(approachesBetween(Date.UTC(2030, 0, 1), Date.UTC(2029, 0, 1)), [], "an empty range gives none");
});

test("the table is a chunk of its own: no other entry point of the package carries it", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const bundle = async (contents: string) => {
    const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", minify: true, write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"], loader: { ".css": "text", ".svg": "text", ".txt": "text" } });
    return result.outputFiles.map((file) => file.text).join("");
  };
  // a full name that appears only in the table
  const marks = ["99942 Apophis (2004 MN4)"];
  const approaches = await bundle(`export * from "./src/approaches.ts";`);
  for (const mark of marks) assert.ok(approaches.includes(mark), `the /approaches bundle holds the table (${mark})`);
  for (const entry of ["./src/index.ts", "./src/space/index.ts", "./src/spacecraft.ts", "./src/roadster.ts", "./src/asteroids.ts", "./src/nearest.ts", "./src/element.ts", "./src/space/element.ts"]) {
    const text = await bundle(`import ${JSON.stringify(entry)};`);
    for (const mark of marks) assert.ok(!text.includes(mark), `${entry} does not carry the approaches table`);
  }
  const raw = readFileSync(new URL("../src/data/approaches.ts", import.meta.url));
  const table = gzipSync(raw, { level: 9 }).length;
  console.log(`approaches: ${all.length} records, table source ${raw.length} bytes, ${table} bytes gzipped`);
  assert.ok(table < 150_000);
});
