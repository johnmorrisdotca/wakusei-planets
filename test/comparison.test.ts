// The published comparison column is recomputed offline; no external comparators
// or browser are needed for this regression gate.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as A from "astronomy-engine";

type Vector = readonly [number, number, number];
interface Helpers {
  arcsec(a: readonly number[], b: readonly number[]): number;
  dateEclipticToJ2000(a: Vector, ms: number): number[];
  removeRefraction(h: number, correction: (n: number) => number): number;
}
interface Ours {
  ourVector(body: string, ms: number, group: string): Vector;
  ourHorizontal(body: string, date: string, observer: { latitude: number; longitude: number }): Vector;
}
const helpers = await import(new URL("../scripts/compare/math.mjs", import.meta.url).href) as Helpers;
const ours = await import(new URL("../scripts/compare/our.mjs", import.meta.url).href) as Ours;
const renderer = await import(new URL("../scripts/compare/render.mjs", import.meta.url).href) as { render(data: unknown, limits: Record<string, number>, ja: boolean): string };
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const limits = JSON.parse(read("../scripts/compare/limits.json")) as Record<string, number>;
const results = JSON.parse(read("../scripts/compare/results.json")) as {
  fixtureSha256: string;
  observerFixtureSha256: string;
  rows: { body: string; group: string; date: string; reference: Vector; errors: Record<string, number | null> }[];
  configuration: { observer: { latitude: number; longitude: number } };
};

test("every published wakusei comparison stays below its frozen limit on every reference date", () => {
  const measured = new Set<string>();
  for (const row of results.rows) {
    const value = row.group === "apparentAirlessTopocentric"
      ? ours.ourHorizontal(row.body.startsWith("sun") ? "sun" : "moon", row.date, results.configuration.observer)
      : ours.ourVector(row.body, Date.parse(row.date), row.group);
    const error = helpers.arcsec(value, row.reference);
    const limit = limits[row.body];
    assert.ok(Number.isFinite(limit), `no published limit for ${row.body}`);
    assert.ok(error <= limit, `${row.body} ${row.date}: ${error} arcsec > ${limit}`);
    measured.add(row.body);
  }
  assert.deepEqual([...measured].sort(), Object.keys(limits).sort(), "every limit has measured samples");
});

test("the comparison covers every body/date in the underlying Horizons vector fixture", () => {
  const raw = readFileSync(new URL("./data/horizons.json", import.meta.url));
  assert.equal(createHash("sha256").update(raw).digest("hex"), results.fixtureSha256);
  assert.equal(createHash("sha256").update(read("../scripts/compare/horizons-observer.json")).digest("hex"), results.observerFixtureSha256);
  const ref = JSON.parse(raw.toString()) as Record<string, unknown>;
  for (const [group, key] of [["planets", "planetDates"], ["dwarfs", "dwarfDates"], ["moons", "moonDates"]]) {
    const bodies = ref[group!] as Record<string, Vector[]>;
    const dates = ref[key!] as string[];
    for (const [body, vectors] of Object.entries(bodies)) vectors.forEach((v, i) => {
      const row = results.rows.find(r => r.body === body && r.date === dates[i]);
      assert.ok(row, `${body} ${dates[i]} is missing`);
      assert.deepEqual(row.reference, v);
    });
  }
});

test("both language sections are generated from the same recorded measurements and limits", () => {
  for (const ja of [false, true]) {
    const guide = read(`../docs/guides/${ja ? "ja/" : ""}accuracy.md`);
    assert.ok(guide.includes(renderer.render(results, limits, ja)));
  }
});

test("angle comparison resolves sub-milliarcsecond directions and opposite vectors", () => {
  assert.equal(helpers.arcsec([1, 0, 0], [1, 0, 0]), 0);
  assert.ok(Math.abs(helpers.arcsec([1, 0, 0], [-1, 0, 0]) - 648000) < 1e-8);
  assert.ok(Math.abs(helpers.arcsec([1, 0, 0], [1, 1e-9, 0]) - 0.000206264806247) < 1e-12);
  assert.throws(() => helpers.arcsec([0, 0, 0], [1, 0, 0]));
  assert.throws(() => helpers.arcsec([NaN, 0, 0], [1, 0, 0]));
});

test("mean-of-date frame adapter agrees with independent true-of-date rotations within nutation", () => {
  for (const year of [1800, 1900, 2000, 2050, 2100]) {
    const date = new Date(Date.UTC(year, 0, 1, 12));
    const rotation = A.Rotation_ECT_EQJ(date);
    for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const) {
      const q = A.RotateVector(rotation, new A.Vector(v[0], v[1], v[2], A.MakeTime(date)));
      const fixed = A.RotateVector(A.Rotation_EQJ_ECL(), q);
      assert.ok(helpers.arcsec(helpers.dateEclipticToJ2000(v, date.getTime()), [fixed.x, fixed.y, fixed.z]) < 25,
        `frame sign/epoch mismatch at ${year}`);
    }
  }
});

test("numerical atmospheric inversion recovers known geometric altitudes", () => {
  const rad = Math.PI / 180;
  const correction = (h: number) => 0.0002967 / Math.tan(Math.max(0, h) * rad + 0.00312536 / (Math.max(0, h) * rad + 0.08901179)) / rad;
  for (const h of [-80, -2, 0, 1, 15, 60, 89]) {
    assert.ok(Math.abs(helpers.removeRefraction(h + correction(h), correction) - h) < 1e-10);
  }
});
