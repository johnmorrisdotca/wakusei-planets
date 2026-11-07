import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { meanObliquity, type CoordinateObserver, type EquatorialCoordinates } from "../src/coordinates.ts";
import { julianCenturies } from "../src/clock.ts";
import { nutation } from "../src/sidereal.ts";
import { eclipticJ2000ToTrueEquatorialOfDate } from "../src/sky/frames.ts";
import type { Equatorial, Observer } from "../src/sky/engine.ts";

test("frame stages preserve vector length and share mean obliquity across epochs", () => {
  for (const year of [1800, 1900, 2000, 2026, 2050, 2100, 2200]) {
    const ms = Date.UTC(year, 5, 21, 12);
    const T = julianCenturies(ms);
    assert.ok(Math.abs(meanObliquity(ms) - nutation(T).meanObliquity * 180 / Math.PI) < 1e-12);
    for (const vector of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, -2, 3]] as const) {
      const result = eclipticJ2000ToTrueEquatorialOfDate(vector, T);
      assert.ok(Math.abs(Math.hypot(...result) - Math.hypot(...vector)) < 1e-12);
    }
  }
});

test("the scientific engine does not reach compatibility wrappers or rendering", async () => {
  const result = await build({ entryPoints: ["src/sky/engine.ts"], bundle: true, platform: "neutral", format: "esm", write: false, metafile: true });
  for (const input of Object.keys(result.metafile!.inputs)) assert.ok(!/(suncalc|scene|bodies|element|portrait)/.test(input), input);
  assert.ok(!/document\.|window\.|three/.test(new TextDecoder().decode(result.outputFiles[0]!.contents)));
});

// The public aliases retain their structural contracts; lengths keep their units.
export function observerAndPositionContracts(observer: CoordinateObserver, engine: Equatorial, coordinates: EquatorialCoordinates): void {
  const sameObserver: Observer = observer;
  const sameCoordinatesObserver: CoordinateObserver = sameObserver;
  const direction: Pick<Equatorial, "rightAscension" | "declination"> = coordinates;
  console.log(sameCoordinatesObserver, direction, engine.distanceKm);
}
