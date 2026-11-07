import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { cartesianToSpherical, sphericalToCartesian, eclipticToEquatorial, equatorialToEcliptic, equatorialToHorizontal, meanObliquity, type CoordinateContext } from "../src/coordinates.ts";

const base = { origin: "geocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric" } as const;
const near = (a: number, b: number, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} vs ${b}`);
const angleNear = (a: number, b: number) => near(((a - b + 180) % 360 + 360) % 360 - 180, 0);

test("spherical/Cartesian round trips, scales, frames, poles and wrapping", () => {
  for (const frame of ["eclipticJ2000", "equatorialJ2000", "eclipticOfDate", "equatorialOfDate"] as const) {
    const context: CoordinateContext = { ...base, frame, epoch: frame.endsWith("J2000") ? "J2000" : 0 };
    for (const longitude of [-720, -180, -1, 0, 90, 180, 359, 720]) for (const latitude of [-90, -89.999, -30, 0, 45, 89.999, 90]) for (const distanceAu of [1e-200, 1, 1e200]) {
      const input = { ...context, longitude, latitude, distanceAu };
      const result = cartesianToSpherical(sphericalToCartesian(input));
      near(result.distanceAu / distanceAu, 1);
      near(result.latitude, latitude);
      if (Math.abs(latitude) !== 90) angleNear(result.longitude, longitude);
      else assert.equal(result.longitude, 0);
      assert.equal(result.origin, context.origin);
      assert.equal(result.frame, frame);
      assert.equal(result.epoch, context.epoch);
      assert.deepEqual(input, { ...context, longitude, latitude, distanceAu });
    }
  }
});

test("Meeus 13.a: ecliptic longitude 113.215630, latitude 6.684170", () => {
  // Astronomical Algorithms, 2nd ed., ch. 13: epsilon = 23.4392911 degrees.
  const eq = eclipticToEquatorial({ ...base, eclipticLongitude: 113.215630, eclipticLatitude: 6.684170 });
  near(eq.rightAscension, 116.328942, 0.000002);
  near(eq.declination, 28.026183, 0.000002);
  near(meanObliquity(Date.UTC(1987, 3, 10)), 23.440946, 0.000002); // Meeus 22.a, mean obliquity.
});

test("ecliptic/equatorial rotations invert at J2000 and several date epochs, including poles", () => {
  for (const epoch of ["J2000", Date.UTC(1800, 0, 1), Date.UTC(2000, 0, 1), Date.UTC(2050, 0, 1)] as const) {
    for (let l = 0; l < 360; l += 30) for (const b of [-90, -89, -30, 0, 30, 89, 90]) {
      const input = { ...base, frame: epoch === "J2000" ? "eclipticJ2000" : "eclipticOfDate", epoch, eclipticLongitude: l, eclipticLatitude: b } as const;
      const eq = eclipticToEquatorial(input), result = equatorialToEcliptic(eq);
      near(result.eclipticLatitude, b);
      if (Math.abs(b) !== 90) angleNear(result.eclipticLongitude, l);
      assert.equal(result.frame, input.frame);
      assert.equal(result.epoch, epoch);
    }
  }
  const date = new Date("2026-11-07T12:00:00Z");
  const ms = date.getTime();
  assert.equal(meanObliquity(date), meanObliquity(ms));
  assert.equal(date.getTime(), ms);
});

test("Meeus 13.b: Washington horizontal direction, north-based azimuth", () => {
  const epoch = Date.UTC(1987, 3, 10, 19, 21);
  const result = equatorialToHorizontal({ ...base, frame: "equatorialOfDate", epoch, rightAscension: (23 + 9 / 60 + 16.641 / 3600) * 15, declination: -(6 + 43 / 60 + 11.61 / 3600) }, epoch, { observer: { latitude: 38 + 55 / 60 + 17 / 3600, longitude: -(77 + 3 / 60 + 56 / 3600) } });
  // The book uses apparent sidereal time; this API uses mean sidereal time.
  // Nutation accounts for the few arcseconds difference (tolerance 3.6 arcsec).
  near(result.altitude, 15.1249, 0.001);
  near(result.azimuth, 248.0337, 0.001);
  assert.equal(result.origin, "geocentric"); // A rotation never invents a topocentric translation.
});

test("horizontal grid: both poles, date line, zenith, nadir, Date parity, finite results", () => {
  for (const epoch of [0, Date.UTC(1800, 0, 1), Date.UTC(2050, 0, 1)]) for (const latitude of [-90, -89.999, 0, 89.999, 90]) for (const declination of [-90, 0, 90]) {
    const input = { ...base, frame: "equatorialOfDate", epoch, rightAscension: 123, declination } as const;
    const a = equatorialToHorizontal(input, epoch, { observer: { latitude, longitude: -180 } });
    const b = equatorialToHorizontal(input, new Date(epoch), { observer: { latitude, longitude: 180, heightM: 2000 } });
    near(a.altitude, b.altitude);
    angleNear(a.azimuth, b.azimuth);
    assert.ok(Number.isFinite(a.altitude) && Number.isFinite(a.azimuth));
    assert.ok(a.altitude >= -90 && a.altitude <= 90 && a.azimuth >= 0 && a.azimuth < 360);
  }
  for (const declination of [-90, 90]) {
    const result = equatorialToHorizontal({ ...base, frame: "equatorialOfDate", epoch: 0, rightAscension: 0, declination }, 0, { observer: { latitude: 90, longitude: 0 } });
    assert.equal(result.azimuth, 0);
    near(result.altitude, declination);
  }
});

test("bad values, mismatched frames/epochs, zero and overflow throw rather than returning NaN", () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => meanObliquity(bad), RangeError);
    assert.throws(() => sphericalToCartesian({ ...base, longitude: bad, latitude: 0, distanceAu: 1 }), RangeError);
    assert.throws(() => cartesianToSpherical({ ...base, xAu: bad, yAu: 0, zAu: 0 }), RangeError);
  }
  assert.throws(() => meanObliquity(new Date(NaN)), /when/);
  assert.throws(() => sphericalToCartesian({ ...base, longitude: 0, latitude: 91, distanceAu: 1 }), /latitude/);
  assert.throws(() => sphericalToCartesian({ ...base, longitude: 0, latitude: 0, distanceAu: -1 }), /distanceAu/);
  assert.throws(() => cartesianToSpherical({ ...base, xAu: 0, yAu: 0, zAu: 0 }), /no direction/);
  assert.throws(() => cartesianToSpherical({ ...base, xAu: Number.MAX_VALUE, yAu: Number.MAX_VALUE, zAu: 0 }), /distanceAu/);
  assert.throws(() => eclipticToEquatorial({ ...base, epoch: 0, eclipticLongitude: 0, eclipticLatitude: 0 }), /epoch/);
  assert.throws(() => equatorialToHorizontal({ ...base, frame: "equatorialJ2000", rightAscension: 0, declination: 0 }, 0, { observer: { latitude: 0, longitude: 0 } }), /frame\/epoch/);
  const eq = { ...base, frame: "equatorialOfDate", epoch: 0, rightAscension: 0, declination: 0 } as const;
  for (const observer of [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: 0, longitude: 0, heightM: NaN }]) assert.throws(() => equatorialToHorizontal(eq, 0, { observer }), RangeError);
  assert.throws(() => equatorialToHorizontal(eq, 1, { observer: { latitude: 0, longitude: 0 } }), /epoch/);
});

test("coordinates import graph stays pure and below 4 KiB minified gzip", async () => {
  const result = await build({ entryPoints: ["src/coordinates.ts"], bundle: true, minify: true, format: "esm", platform: "neutral", write: false, metafile: true });
  assert.deepEqual(Object.keys(result.metafile!.inputs).sort(), ["src/clock.ts", "src/coordinates.ts", "src/when.ts"]);
  const bytes = gzipSync(result.outputFiles[0]!.contents).byteLength;
  assert.ok(bytes <= 4096, `${bytes} bytes exceeds coordinates budget`);
  console.log(`coordinates: ${result.outputFiles[0]!.contents.byteLength} minified bytes, ${bytes} gzip bytes`);
});

// Compile-time contracts: angles are named, lengths have units, and frames match the conversion.
export function coordinateTypeContracts(): void {
  // @ts-expect-error Cartesian components carry AU units, never bare x/y/z.
  cartesianToSpherical({ ...base, x: 1, y: 0, z: 0 });
  // @ts-expect-error An equatorial frame cannot label ecliptic angles.
  eclipticToEquatorial({ ...base, frame: "equatorialJ2000", eclipticLongitude: 0, eclipticLatitude: 0 });
  // @ts-expect-error An ecliptic frame cannot label right ascension and declination.
  equatorialToEcliptic({ ...base, rightAscension: 0, declination: 0 });
}
