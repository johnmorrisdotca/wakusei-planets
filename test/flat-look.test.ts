// The flat map of any body: which bodies it draws and that each has its picture, its credit and a Sun; the Sun's place and the sunrise line on several bodies; the projection the picture lies on; the line map's tones; the marks a page adds; the words; the element's attributes.
// The element itself, its attributes included, is played in a real browser (e2e/flat-look.demo.ts); here is everything that is numbers, and the readers its attributes go through.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { PICTURE_CREDITS, picturesCredit } from "../src/picture-credits.ts";
import {
  FLAT_BODIES,
  FLAT_LOOKS,
  FLAT_WORDS,
  MAP_LAND,
  MAP_SEA,
  MARK_SHAPES,
  bandEdges,
  creditLicence,
  creditWho,
  flatBody,
  flatSun,
  flatSunRate,
  gridText,
  markName,
  pictureWidth,
  pictureWidths,
  projectFlat,
  readLook,
  readMarks,
  say,
  sunriseLine,
  toneMap,
  toneRamp,
  unprojectFlat,
  wrapLongitude,
} from "../src/flat/index.ts";
import { angleBetween, isDaylight } from "../src/places.ts";

const T = Date.UTC(2026, 10, 12, 12);
const textures = new URL("../textures/", import.meta.url);

test("every body the map draws has its picture in the package, its credit row and a short credit that is true, and a Sun with a pace", () => {
  for (const id of FLAT_BODIES) {
    for (const width of pictureWidths(id)) assert.ok(existsSync(new URL(`${id}-${width}.webp`, textures)), `${id}-${width}.webp`);
    const row = PICTURE_CREDITS.find((one) => one.id === id);
    assert.ok(row, `${id} has a credit row`);
    // the short credit names only people the row names
    for (const name of creditWho(id).split(" / ")) assert.ok(row.credit.en.toLowerCase().includes(name.toLowerCase()), `${id}: ${name} is in "${row.credit.en}"`);
    assert.equal(creditLicence(id, "en"), row.licence === "CC BY 4.0" ? "CC BY 4.0" : "public domain");
    assert.ok(picturesCredit([id], "en").length > 20 && picturesCredit([id], "ja").length > 10);
    const info = flatBody(id);
    assert.ok(info.radiusKm > 5 && info.twilightDeg >= 1 && info.twilightDeg <= 12, id);
    assert.match(info.ground, /^#[0-9a-f]{6}$/i);
    assert.ok(info.night[3] > 0.5 && info.night[3] < 0.9);
    assert.ok(info.centres.length >= 1 && info.centres[0]!.lon === 0);
    const sun = flatSun(id, T);
    assert.ok(Number.isFinite(sun.lat) && Math.abs(sun.lat) <= 90 && sun.lon >= -180 && sun.lon < 180, id);
    const rate = flatSunRate(id, T);
    assert.ok(rate > 0 && rate < 0.05, `${id}: the Sun moves ${rate} degrees a second`);
  }
  // only the Moon and Mars have orbiters to draw
  for (const id of FLAT_BODIES) assert.equal(flatBody(id).orbiters.length > 0, id === "moon" || id === "mars", id);
});

test("the pictures a view needs: the narrowest that has a pixel for each, and Europa has no 2048", () => {
  assert.deepEqual(pictureWidths("mars"), [1024, 2048]);
  assert.deepEqual(pictureWidths("europa"), [1024]);
  assert.equal(pictureWidth("mars", 500), 1024);
  assert.equal(pictureWidth("mars", 1024), 1024);
  assert.equal(pictureWidth("mars", 1025), 2048);
  assert.equal(pictureWidth("mars", 9000), 2048);
  assert.equal(pictureWidth("europa", 9000), 1024);
});

test("the Sun's place is right where it can be checked: the solstices on the Earth, the day side lit and the far side dark", () => {
  const june = flatSun("earth", Date.UTC(2026, 5, 21, 12));
  assert.ok(Math.abs(june.lat - 23.44) < 0.1, `the Sun is over ${june.lat}`);
  assert.ok(Math.abs(june.lon) < 3, "and over the Greenwich meridian at noon UT, give or take the equation of time");
  const december = flatSun("earth", Date.UTC(2026, 11, 21, 12));
  assert.ok(Math.abs(december.lat + 23.44) < 0.1);
  for (const id of FLAT_BODIES) {
    const sun = flatSun(id, T);
    assert.equal(isDaylight(id, sun.lat, sun.lon, T), true, `${id}: lit under the Sun`);
    assert.equal(isDaylight(id, -sun.lat, wrapLongitude(sun.lon + 180), T), false, `${id}: dark opposite it`);
  }
});

test("the Sun moves across the ground at a day's pace: a day a turn on the Earth, Mars and the Moon, and a Venus day is long and backwards", () => {
  assert.ok(Math.abs(flatSunRate("earth", T) - 360 / 86_400) / (360 / 86_400) < 0.01);
  assert.ok(Math.abs(flatSunRate("mars", T) - 360 / 88_775) / (360 / 88_775) < 0.01);
  assert.ok(Math.abs(flatSunRate("moon", T) - 360 / (29.53 * 86_400)) / (360 / (29.53 * 86_400)) < 0.05);
  assert.ok(Math.abs(flatSunRate("venus", T) - 360 / (116.75 * 86_400)) / (360 / (116.75 * 86_400)) < 0.05);
  // a moon that keeps one face to its planet has the Sun go round once a turn of the planet round the Sun: Io's day is its 1.77-day orbit
  assert.ok(Math.abs(flatSunRate("io", T) - 360 / (1.7691 * 86_400)) / (360 / (1.7691 * 86_400)) < 0.05);
});

test("the sunrise and sunset line: every point of it is 90 degrees from the Sun, and it runs once round the longitude", () => {
  for (const id of ["earth", "mars", "moon", "venus", "uranus", "pluto"] as const) {
    const sun = flatSun(id, T);
    const line = sunriseLine(sun, 72);
    assert.equal(line.length, 73);
    for (const [lon, lat] of line) assert.ok(Math.abs(angleBetween(sun.lat, sun.lon, lat, lon) - 90) < 1e-6, `${id}: ${lon}, ${lat}`);
    assert.ok(Math.abs(Math.abs(line[72]![0] - line[0]![0]) - 360) < 1e-6, `${id}: a whole turn of longitude`);
  }
  // with the Sun over the equator the line is two meridians 90 degrees either side of it
  const meridian = sunriseLine({ lat: 0, lon: 30 }, 4);
  assert.ok(Math.abs(Math.abs(meridian[1]![0] - 30) - 90) < 1e-6);
});

test("the projection the picture lies on: longitude -180 at the left edge, a degree is a degree both ways, and the places of a body fall where the picture has them", () => {
  const view = { width: 720, height: 360, centerLon: 0, centerLat: 0, zoom: 1 };
  assert.deepEqual(projectFlat(view, -180, 90), { x: 0, y: 0 });
  assert.deepEqual(projectFlat(view, 0, 0), { x: 360, y: 180 });
  // Olympus Mons on Mars: 18.65 degrees north, 133.8 degrees west: at the picture's pixel (u, v) of a 1024 by 512 map
  const at = projectFlat(view, -133.8, 18.65);
  assert.ok(Math.abs(at.x / 720 - (-133.8 + 180) / 360) < 1e-9 && Math.abs(at.y / 360 - (90 - 18.65) / 180) < 1e-9);
  const back = unprojectFlat(view, at.x, at.y);
  assert.ok(Math.abs(back.lon + 133.8) < 1e-9 && Math.abs(back.lat - 18.65) < 1e-9);
  // another body, the same: Jupiter's Great Red Spot at 22 degrees south, and the map turned half round
  const turned = projectFlat({ ...view, centerLon: 180 }, 0, -22);
  assert.ok(Math.abs(turned.x - 720) < 1e-9 || Math.abs(turned.x) < 1e-9, "longitude 0 is at the edge when 180 is in the middle");
});

test("the looks: map and photo, any case, and the photo when nothing sensible is asked for", () => {
  assert.deepEqual([...FLAT_LOOKS], ["map", "photo"]);
  assert.equal(readLook("map"), "map");
  assert.equal(readLook(" MAP "), "map");
  assert.equal(readLook("photo"), "photo");
  assert.equal(readLook(null), "photo");
  assert.equal(readLook(undefined), "photo");
  assert.equal(readLook(""), "photo");
  assert.equal(readLook("sepia"), "photo");
});

test("the line map's tones: five of equal area from dark to light, a line where one meets the next, and nothing drawn from a flat picture", () => {
  const ramp = toneRamp(MAP_SEA, MAP_LAND);
  assert.equal(ramp.length, 5);
  assert.deepEqual(ramp[0], MAP_SEA);
  assert.deepEqual(ramp[4], MAP_LAND);
  assert.ok(ramp.every((tone, i) => i === 0 || tone[0] >= ramp[i - 1]![0]), "darkest first");
  // the edges split the pixels into groups of nearly equal size
  const values = Array.from({ length: 100 }, (_, i) => i * 2);
  const edges = bandEdges(values, 5);
  assert.equal(edges.length, 4);
  const groups = [0, 0, 0, 0, 0];
  for (const value of values) groups[edges.filter((edge) => value >= edge).length]! += 1;
  assert.ok(groups.every((n) => Math.abs(n - 20) <= 1), `groups of ${groups.join(", ")}`);
  // a picture whose brightness rises from left to right: tones rise with it, and there are lines between them
  const width = 64;
  const height = 8;
  const gradient = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) gradient.set([x * 4, x * 4, x * 4, 255], (y * width + x) * 4);
  const out = toneMap(gradient, width, height);
  assert.equal(out.length, gradient.length);
  const redAt = (x: number, y = 4): number => out[(y * width + x) * 4]!;
  assert.ok(redAt(8) < redAt(32) && redAt(32) < redAt(56), "the darker side is the darker tone");
  assert.ok(out.every((value, i) => i % 4 !== 3 || value === 255), "every pixel is opaque");
  let lines = 0;
  for (let x = 0; x < width; x += 1) if (!ramp.some((tone) => tone[0] === redAt(x))) lines += 1;
  assert.ok(lines >= 3 && lines <= 12, `${lines} columns are a line between tones`);
  // a flat picture is one tone with no line
  const flat = new Uint8ClampedArray(width * height * 4).fill(120);
  const plain = toneMap(flat, width, height);
  assert.equal(new Set(Array.from({ length: width * height }, (_, i) => plain[i * 4])).size, 1);
  // the same picture gives the same map
  assert.deepEqual(toneMap(gradient, width, height), out);
});

test("the line map keeps the picture's shapes: a bright island in a dark sea is the lightest tone, ringed by a line, and the seam wraps", () => {
  const width = 128;
  const height = 64;
  const picture = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const island = Math.hypot(x - 64, (y - 32) * 2) < 36;
      const value = island ? 230 : 20 + ((x * 7 + y * 3) % 5);
      picture.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  const out = toneMap(picture, width, height);
  const tone = (x: number, y: number): number => out[(y * width + x) * 4]!;
  const ramp = toneRamp(MAP_SEA, MAP_LAND);
  assert.equal(tone(64, 32), ramp[4]![0], "the island is the lightest tone");
  assert.ok(ramp.slice(0, 4).some((one) => one[0] === tone(8, 8)), "the sea is a dark tone");
  // a line of lighter pixels where the island ends
  let across = 0;
  for (let x = 0; x < width; x += 1) if (!ramp.some((one) => one[0] === tone(x, 32))) across += 1;
  assert.ok(across >= 1, "a line crosses the shore");
});

test("the marks a page adds: kept in order, a bad one dropped, the longitude wrapped, a later id replacing an earlier, the name in either language", () => {
  const held = readMarks("moons", [
    { id: "io", lat: 0, lon: 190, name: { en: "Io", ja: "イオ" } },
    { id: "bad-lat", lat: Number.NaN, lon: 0, name: "No" },
    { id: "", lat: 0, lon: 0, name: "No id" },
    { id: "nameless", lat: 0, lon: 0, name: "" },
    { id: "io", lat: 91, lon: -10, name: "Io again", shape: "star", size: 40, group: "other" },
    { id: "odd", lat: 5, lon: 5, name: "Odd", shape: "blob" as never, size: 0.1 },
  ]);
  assert.deepEqual(held.map((m) => m.id), ["io", "odd"], "the later Io replaced the earlier and went to the end of the order");
  assert.equal(held[0]!.lat, 90);
  assert.equal(held[0]!.lon, -10);
  assert.equal(held[0]!.group, "other");
  assert.equal(held[0]!.size, 12, "held to 12 pixels");
  assert.equal(held[1]!.shape, "dot", "a shape the map does not know is a dot");
  assert.equal(held[1]!.size, 2);
  assert.equal(held[1]!.group, "moons");
  assert.equal(readMarks("g", [{ id: "a", lat: 0, lon: 190, name: "A" }])[0]!.lon, -170);
  assert.equal(markName({ en: "Io", ja: "イオ" }, "ja"), "イオ");
  assert.equal(markName({ en: "Io", ja: "イオ" }, "en"), "Io");
  assert.equal(markName({ en: "Io" }, "ja"), "Io");
  assert.equal(markName("Io", "ja"), "Io");
  assert.equal(markName(undefined, "en"), "");
  assert.ok(MARK_SHAPES.includes("star") && MARK_SHAPES.length === 6);
});

test("the grid's labels: degrees with their hemisphere, in both languages, the equator and the prime meridian bare", () => {
  assert.equal(gridText("en", "lat", 30), "30°N");
  assert.equal(gridText("en", "lat", -60), "60°S");
  assert.equal(gridText("en", "lon", -60), "60°W");
  assert.equal(gridText("en", "lon", 150), "150°E");
  assert.equal(gridText("ja", "lat", -30), "南緯30°");
  assert.equal(gridText("ja", "lon", 90), "東経90°");
  assert.equal(gridText("en", "lat", 0), "0°");
  assert.equal(gridText("en", "lon", 0), "0°");
  assert.equal(gridText("en", "lon", -180), "180°");
});

test("the words of the look, the key and the credit: both languages, the same keys as chikyu-earth's flat map where it has them", () => {
  assert.deepEqual(Object.keys(FLAT_WORDS.ja).sort(), Object.keys(FLAT_WORDS.en).sort());
  // the wording a page keeps when it swaps this map for the Earth's
  assert.equal(FLAT_WORDS.en.lookGroup, "Look of the map");
  assert.equal(FLAT_WORDS.en.lookMap, "Map");
  assert.equal(FLAT_WORDS.en.lookPhoto, "Photo");
  assert.equal(FLAT_WORDS.ja.lookGroup, "地図の見た目");
  assert.equal(FLAT_WORDS.ja.lookMap, "地図");
  assert.equal(FLAT_WORDS.ja.lookPhoto, "写真");
  assert.equal(FLAT_WORDS.en.key, "Key");
  assert.equal(FLAT_WORDS.ja.key, "凡例");
  assert.equal(FLAT_WORDS.en.keyShow, "Show the key to the map");
  assert.equal(say("en", "creditWide", { body: "Mars", who: creditWho("mars"), licence: creditLicence("mars", "en") }), "Mars: NASA / USGS (public domain)");
  assert.equal(say("ja", "creditShort", { body: "木星", who: creditWho("jupiter") }), "木星：Nestaeric");
  assert.equal(say("ja", "announceMark", { name: "イオ", lat: "北緯1.00°", lon: "東経2.00°" }), "イオ、北緯1.00°、東経2.00°");
});
