// The bright-star table against published values: positions from SIMBAD and the Yale catalogue's own rows (J2000, to the catalogue's 0.1 s and 1 arc-second), counts by magnitude, proper motion over decades,
// and the colour of the hot and cool ends. The table is read, never fitted.
import assert from "node:assert/strict";
import { test } from "node:test";
import { blackBodyColour, starByHr, starByName, starColour, starDistanceLightYears, starPosition, starTemperatureK, stars } from "../src/stars.ts";

function hms(h: number, m: number, s: number): number {
  return (h + m / 60 + s / 3600) * 15;
}
function dms(sign: 1 | -1, d: number, m: number, s: number): number {
  return sign * (d + m / 60 + s / 3600);
}
const ARC_SECOND = 1 / 3600;

test("the brightest stars are where the catalogue puts them, to its resolution", () => {
  const expected: Array<[string, number, number]> = [
    ["Sirius", hms(6, 45, 8.9), dms(-1, 16, 42, 58)],
    ["Vega", hms(18, 36, 56.3), dms(1, 38, 47, 1)],
    ["Arcturus", hms(14, 15, 39.7), dms(1, 19, 10, 57)],
    ["Betelgeuse", hms(5, 55, 10.3), dms(1, 7, 24, 25)],
    ["Rigel", hms(5, 14, 32.3), dms(-1, 8, 12, 6)],
    ["Polaris", hms(2, 31, 48.7), dms(1, 89, 15, 51)],
    ["Canopus", hms(6, 23, 57.1), dms(-1, 52, 41, 45)],
    ["Antares", hms(16, 29, 24.4), dms(-1, 26, 25, 55)],
  ];
  for (const [name, ra, dec] of expected) {
    const star = starByName(name);
    assert.ok(star, name);
    // 0.1 s of time is 1.5 arc-seconds of right ascension at the equator, so allow 1.5 and 1 arc-seconds for the rounding of each
    assert.ok(Math.abs(star.rightAscension - ra) < 1.6 * ARC_SECOND, `${name} RA ${star.rightAscension} vs ${ra}`);
    assert.ok(Math.abs(star.declination - dec) < 1.1 * ARC_SECOND, `${name} Dec ${star.declination} vs ${dec}`);
  }
});

test("the table holds the stars to magnitude 6.0 and no more, brightest first", () => {
  assert.equal(stars().length, 5080);
  const counts: Array<[number, number]> = [[1, 15], [2, 50], [3, 174], [4, 518], [5, 1630], [6, 5080]];
  for (const [limit, count] of counts) assert.equal(stars({ magnitude: limit }).length, count, `magnitude ${limit}`);
  const all = stars();
  for (let i = 1; i < all.length; i += 1) assert.ok(all[i - 1]!.magnitude <= all[i]!.magnitude, `order at ${i}`);
  assert.ok(all.at(-1)!.magnitude <= 6);
  assert.equal(all[0]!.name, "Sirius");
  assert.throws(() => stars({ magnitude: Number.NaN }), TypeError);
});

test("every star has an HR number nobody else has, and names and designations find the star", () => {
  const all = stars();
  assert.equal(new Set(all.map((s) => s.hr)).size, all.length);
  const names = all.flatMap((s) => (s.name === undefined ? [] : [s.name]));
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.length >= 100);
  assert.equal(starByHr(2491)?.name, "Sirius");
  assert.equal(starByName("sirius"), starByHr(2491));
  assert.equal(starByName(" α CMa "), starByHr(2491));
  assert.equal(starByName("α1 Cen")?.name, "Rigil Kentaurus");
  assert.equal(starByName("no such star"), undefined);
  assert.equal(starByHr(0), undefined);
});

test("proper motion moves a star by the catalogue's rate, in a straight line", () => {
  const arcturus = starByName("Arcturus")!;
  const atJ2000 = starPosition(arcturus);
  assert.equal(atJ2000.declination, arcturus.declination);
  assert.ok(Math.abs(atJ2000.rightAscension - arcturus.rightAscension) < 1e-12);
  // Arcturus moves -1.998 arc-seconds a year in declination: 100 Julian years is -199.8 arc-seconds
  const later = starPosition(arcturus, Date.UTC(2100, 0, 1, 12));
  assert.ok(Math.abs((later.declination - arcturus.declination) * 3600 + 199.8) < 0.05);
  // and -1.093 arc-seconds a year in right ascension on the sky, which is longer in right ascension by 1 / cos(dec)
  const expectedRa = (-1.093 * 100) / Math.cos((arcturus.declination * Math.PI) / 180) / 3600;
  assert.ok(Math.abs(later.rightAscension - arcturus.rightAscension - expectedRa) < 1e-4);
  // going back is the same distance the other way
  const earlier = starPosition(arcturus, Date.UTC(1900, 0, 1, 12));
  assert.ok(Math.abs(earlier.declination - arcturus.declination - (arcturus.declination - later.declination)) < 1e-4);
  assert.throws(() => starPosition(arcturus, Number.NaN), RangeError);
});

test("near a pole the right ascension stays finite and between 0 and 360", () => {
  const polaris = starByName("Polaris")!;
  const far = starPosition(polaris, Date.UTC(3000, 0, 1));
  assert.ok(Number.isFinite(far.rightAscension) && far.rightAscension >= 0 && far.rightAscension < 360);
  assert.ok(far.declination <= 90);
});

test("distance comes from parallax, and is unknown without one", () => {
  const sirius = starByName("Sirius")!;
  assert.ok(Math.abs(starDistanceLightYears(sirius)! - 8.7) < 0.2);
  const rigil = starByName("Rigil Kentaurus")!;
  assert.ok(Math.abs(starDistanceLightYears(rigil)! - 4.3) < 0.1);
  assert.equal(starDistanceLightYears({ ...sirius, parallaxMas: 0 }), undefined);
});

test("temperature and colour follow the colour index: hot stars blue-white, the Sun-like warm, cool stars orange", () => {
  assert.ok(Math.abs(starTemperatureK(0.65) - 5800) < 150, "the Sun's B-V of 0.65 is about 5,800 K");
  assert.ok(starTemperatureK(-0.3) > 15000, "the hottest blue stars");
  assert.ok(starTemperatureK(1.85) < 3600);
  assert.ok(starTemperatureK(0) > starTemperatureK(0.5) && starTemperatureK(0.5) > starTemperatureK(1.5));
  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const [rr, , rb] = rgb(starColour(starByName("Rigel")!));
  const [br, , bb] = rgb(starColour(starByName("Betelgeuse")!));
  assert.ok(rb >= rr, "Rigel is blue-white");
  assert.ok(br > bb + 50, "Betelgeuse is orange");
  assert.equal(blackBodyColour(6600), "#ffffff");
  assert.match(blackBodyColour(3000), /^#[0-9a-f]{6}$/);
  assert.throws(() => blackBodyColour(0), RangeError);
  assert.throws(() => starTemperatureK(Number.NaN), RangeError);
  const none = stars().find((s) => s.colourIndex === undefined)!;
  assert.equal(starColour(none), "#ffffff");
});

test("the table's size stays within its budget", async () => {
  const { gzipSync } = await import("node:zlib");
  const { readFileSync } = await import("node:fs");
  const bytes = gzipSync(readFileSync(new URL("../src/data/stars.ts", import.meta.url))).byteLength;
  assert.ok(bytes < 110_000, `the star table is ${bytes} bytes gzipped`);
});
