// The engine behind /suncalc: the apparent places of the Sun and the Moon and the Earth's turn, against astronomy-engine, and the size of the entry points.
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import * as Astronomy from "astronomy-engine";
import { greenwichSiderealTime, moonEquatorial, refraction, sunEquatorial } from "../src/sky/engine.ts";

const DATES = ["1900-06-01T00:00:00Z", "1950-03-20T12:00:00Z", "2000-01-01T12:00:00Z", "2026-11-07T12:00:00Z", "2040-12-21T06:00:00Z", "2080-07-01T00:00:00Z"];

/** The geocentric apparent right ascension and declination of date from astronomy-engine, in degrees. */
function reference(body: Astronomy.Body, date: Date): { ra: number; dec: number } {
  const time = Astronomy.MakeTime(date);
  const v = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(time), Astronomy.GeoVector(body, time, true));
  return { ra: ((Math.atan2(v.y, v.x) * 180) / Math.PI + 360) % 360, dec: (Math.asin(v.z / Math.hypot(v.x, v.y, v.z)) * 180) / Math.PI };
}
const arcseconds = (a: { ra: number; dec: number }, b: { ra: number; dec: number }): number => Math.hypot((a.ra - b.ra) * Math.cos((b.dec * Math.PI) / 180), a.dec - b.dec) * 3600;

test("the Sun's apparent place is within 5 arc-seconds of astronomy-engine's, aberration included (it is worth 20), from 1900 to 2080", () => {
  for (const day of DATES) {
    const date = new Date(day);
    const mine = sunEquatorial(date.getTime());
    const miss = arcseconds({ ra: mine.rightAscension, dec: mine.declination }, reference(Astronomy.Body.Sun, date));
    assert.ok(miss < 5, `the Sun on ${day} is ${miss.toFixed(1)} arc-seconds from astronomy-engine`);
  }
});

test("the Moon's apparent place is within 10 arc-seconds of astronomy-engine's to 2040 (its own Moon is 78 arc-seconds off Horizons by 2100)", () => {
  for (const day of DATES.slice(0, 5)) {
    const date = new Date(day);
    const mine = moonEquatorial(date.getTime());
    const miss = arcseconds({ ra: mine.rightAscension, dec: mine.declination }, reference(Astronomy.Body.Moon, date));
    assert.ok(miss < 10, `the Moon on ${day} is ${miss.toFixed(1)} arc-seconds from astronomy-engine`);
  }
});

test("the Earth's turn is Greenwich apparent sidereal time to a thousandth of a degree, and refraction is 34 arc-minutes at the horizon and fades below it", () => {
  for (const day of DATES) {
    const date = new Date(day);
    const want = Astronomy.SiderealTime(Astronomy.MakeTime(date)) * 15;
    assert.ok(Math.abs(((greenwichSiderealTime(date.getTime()) - want + 540) % 360) - 180) < 0.001, `sidereal time on ${day}`);
  }
  assert.ok(Math.abs(refraction(0) - 0.4833) < 0.02, `refraction at the horizon is about 29 arc-minutes by Saemundsson's formula, got ${refraction(0)}`);
  assert.ok(refraction(45) < 0.02 && refraction(-1.5) < refraction(-0.5) && refraction(-3) === 0);
});

test("the suncalc entry points import only the engine and stay small", async () => {
  for (const [entry, limit] of [["src/suncalc.ts", 12 * 1024], ["src/suncalc-legacy.ts", 12 * 1024]] as const) {
    const result = await build({ entryPoints: [entry], bundle: true, minify: true, format: "esm", write: false, platform: "neutral", logLevel: "silent" });
    const bytes = gzipSync(result.outputFiles[0]!.contents).byteLength;
    assert.ok(bytes <= limit, `${entry} is ${bytes} bytes gzipped, over its budget of ${limit}`);
    assert.ok(!/document\.|window\.|three/.test(new TextDecoder().decode(result.outputFiles[0]!.contents)), `${entry} reaches a browser global or rendering`);
    console.log(`${entry}: ${bytes} gzip bytes`);
  }
});
