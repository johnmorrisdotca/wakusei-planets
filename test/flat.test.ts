// The flat maps: the geometry shared with the Earth's flat map, the Sun's place, the orbiters over the ground, the night's shading, coverage circles, ground tracks and the words.
// The element is played in a real browser (e2e/flat.demo.ts); here is everything that is numbers.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FLAT_BODIES,
  FLAT_WORDS,
  circleOutline,
  clampView,
  coordinateText,
  flatBody,
  flatOrbiter,
  flatSun,
  flatTrack,
  hasPath,
  isFlatBody,
  orbiterColour,
  orbiterName,
  pixelsPerDegree,
  projectFlat,
  say,
  shadeNight,
  trackPieces,
  unprojectFlat,
  wrapLongitude,
  zoomAbout,
} from "../src/flat/index.ts";
import { ORBITER_FACTS, ORBITER_IDS, orbiterCentre } from "../src/orbiters.ts";
import { PLACES_MARS } from "../src/places/mars.ts";
import { PLACES_MOON } from "../src/places/moon.ts";
import { angleBetween, isDaylight } from "../src/places.ts";

const T = Date.UTC(2026, 10, 12, 12);

test("the bodies: every planet and moon with a painted picture, case does not matter, anything else is refused by name", () => {
  assert.equal(FLAT_BODIES.length, 28);
  for (const id of ["mercury", "venus", "earth", "moon", "mars", "ceres", "jupiter", "saturn", "uranus", "neptune", "pluto", "io", "titan", "charon"]) assert.equal(isFlatBody(id), true, id);
  assert.equal(isFlatBody("Mars"), true);
  assert.equal(isFlatBody("sun"), false);
  assert.equal(isFlatBody("halley"), false);
  assert.equal(isFlatBody(null), false);
  assert.equal(flatBody("MOON").radiusKm, 1737.4);
  assert.equal(flatBody("mars").radiusKm, 3389.5);
  assert.throws(() => flatBody("sun"), /not "sun"/);
});

test("every orbiter of the package goes round a body the map draws, and the lists agree", () => {
  const all = FLAT_BODIES.flatMap((body) => flatBody(body).orbiters);
  assert.deepEqual([...all].sort(), [...ORBITER_IDS].sort());
  for (const body of FLAT_BODIES) for (const id of flatBody(body).orbiters) assert.equal(orbiterCentre(id), body);
  // the ones with no public path are not drawn: they are named, so a page can say so
  assert.deepEqual(ORBITER_IDS.filter((id) => !hasPath(id)).sort(), ["capstone", "tianwen-1"]);
  assert.equal(flatOrbiter("tianwen-1", T), undefined);
  assert.equal(flatOrbiter("capstone", T), undefined);
});

test("the geometry is chikyu-earth's: the same projection, wrap and zoom", () => {
  const view = { width: 720, height: 360, centerLon: 155, centerLat: 0, zoom: 1 };
  assert.equal(pixelsPerDegree(view), 2);
  assert.deepEqual(projectFlat(view, 155, 0), { x: 360, y: 180 });
  // the short way round: -170 is 35 degrees east of 155, across the date line
  assert.equal(projectFlat(view, -170, 0).x, 360 + 35 * 2);
  const back = unprojectFlat(view, 430, 100);
  assert.ok(Math.abs(back.lon - wrapLongitude(155 + 35)) < 1e-9 && Math.abs(back.lat - 40) < 1e-9);
  assert.equal(wrapLongitude(190), -170);
  const zoomed = zoomAbout(view, 2, 540, 90);
  const under = unprojectFlat(zoomed, 540, 90);
  const was = unprojectFlat(view, 540, 90);
  assert.ok(Math.abs(under.lon - was.lon) < 1e-9 && Math.abs(under.lat - was.lat) < 1e-9, "the place under the pointer stays under it");
  assert.equal(clampView({ ...view, zoom: 50 }).zoom, 8);
  // a tall box (a phone) is filled by the height, so the map wraps round its sides
  assert.ok(pixelsPerDegree({ width: 360, height: 540, centerLon: 0, centerLat: 0, zoom: 1 }) === 3);
});

test("the Sun's place: low in the east at Tranquility Base at the Apollo 11 landing, and the site is lit", () => {
  const when = Date.UTC(1969, 6, 20, 20, 17, 40);
  const sun = flatSun("moon", when);
  assert.ok(Math.abs(sun.lon - 102.9) < 0.5, `the Sun is over ${sun.lon}`);
  assert.ok(Math.abs(sun.lat) < 2);
  const site = PLACES_MOON.find((place) => place.id === "moon/apollo-11-lunar-module")!;
  assert.ok(isDaylight("moon", site.lat, site.lon, when));
  // the angle between the site and the Sun is about 90 degrees less the Sun's height there: about 79 degrees
  assert.ok(Math.abs(angleBetween(site.lat, site.lon, sun.lat, sun.lon) - 79) < 3);
  assert.ok(flatSun("mars", T).lon >= -180 && flatSun("mars", T).lon < 180);
});

test("an orbiter over the ground: a point on the map, a height, and a status that dims the ones whose place is only approximate", () => {
  for (const body of FLAT_BODIES) {
    for (const id of flatBody(body).orbiters.filter(hasPath)) {
      const o = flatOrbiter(id, T)!;
      assert.ok(o.lat >= -90 && o.lat <= 90 && o.lon >= -180 && o.lon < 180, id);
      assert.ok(o.altitudeKm > 0 && o.altitudeKm < 60_000, `${id} is ${o.altitudeKm} km up`);
      assert.ok(["tracked", "predicted", "modelled"].includes(o.status));
    }
  }
  // outside the days its path was fitted for, a craft is only a mean orbit and is dim
  assert.equal(flatOrbiter("lro", Date.UTC(2030, 0, 1))!.status, "modelled");
  assert.equal(flatOrbiter("lro", Date.UTC(2030, 0, 1))!.dim, true);
});

test("an orbiter's latitude never passes its orbit's tilt, and it goes round in about its period", () => {
  const lro = flatOrbiter("lro", T)!;
  let widest = 0;
  const start = T;
  for (let m = 0; m < 240; m += 2) widest = Math.max(widest, Math.abs(flatOrbiter("lro", start + m * 60_000)!.lat));
  assert.ok(widest <= 90 && widest > 80, `LRO reaches ${widest} degrees (a polar orbit)`);
  assert.ok(lro.altitudeKm > 20 && lro.altitudeKm < 200);
});

test("the night: dark where the Sun is down, clear where it is up, sharp on the Moon and soft on Mars", () => {
  const view = { width: 36, height: 18, centerLon: 0, centerLat: 0, zoom: 1 };
  const grid = (body: (typeof FLAT_BODIES)[number]): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(36 * 18 * 4);
    shadeNight(out, 36, 18, 1, view, { lat: 0, lon: 0 }, body);
    return out;
  };
  const alphaAt = (out: Uint8ClampedArray, col: number, row = 9): number => out[(row * 36 + col) * 4 + 3]!;
  for (const body of FLAT_BODIES) {
    const out = grid(body);
    assert.equal(alphaAt(out, 18), 0, `${body}: noon is clear`);
    assert.ok(alphaAt(out, 0) > 150, `${body}: midnight is dark`);
    assert.ok(alphaAt(out, 35) > 150);
  }
  // the edge: one cell (10 degrees) either side of the terminator
  const moon = grid("moon");
  const mars = grid("mars");
  assert.equal(alphaAt(moon, 26), 0, "the Moon is clear 8 degrees before the terminator");
  assert.ok(alphaAt(moon, 28) > 150, "and dark 12 degrees past it");
  assert.ok(alphaAt(mars, 27) > 0 && alphaAt(mars, 27) < alphaAt(mars, 29), "Mars's dusk is a gradient");
  // moving the middle of the view moves the shading with the ground: the same longitude is as dark
  const shifted = new Uint8ClampedArray(36 * 18 * 4);
  shadeNight(shifted, 36, 18, 1, { ...view, centerLon: 180 }, { lat: 0, lon: 0 }, "moon");
  assert.ok(alphaAt(shifted, 18) > 150 && alphaAt(shifted, 0) === 0);
});

test("a coverage circle: a closed ring round the point, a pole inside is flagged, and it runs on past the date line", () => {
  const ring = circleOutline(10, 20, 15, 36);
  assert.equal(ring.points.length, 37);
  assert.equal(ring.pole, 0);
  assert.ok(Math.abs(ring.points[0]![0] - ring.points[36]![0]) < 1e-9 && Math.abs(ring.points[0]![1] - ring.points[36]![1]) < 1e-9, "closed");
  for (const [lon, lat] of ring.points) assert.ok(angleBetween(10, 20, lat, lon) < 15.01 && angleBetween(10, 20, lat, lon) > 14.99);
  const edge = circleOutline(0, 175, 20, 36);
  assert.ok(Math.max(...edge.points.map((p) => p[0])) > 180, "the longitude is carried on, not wrapped");
  const polar = circleOutline(85, 0, 20, 36);
  assert.equal(polar.pole, 1);
  assert.ok(Math.abs(polar.points[36]![0] - polar.points[0]![0]) > 300, "a whole turn of longitude");
  assert.equal(circleOutline(-88, 0, 10).pole, -1);
});

test("a ground track: one trip round, half behind and half ahead, cut where it crosses the date line or a pole so no line crosses the map", () => {
  const track = flatTrack("lro", T, 80);
  assert.equal(track.length, 81);
  assert.ok(track[0]!.ms < T && track[80]!.ms > T);
  assert.ok(Math.abs(track[40]!.ms - T) < 1);
  const here = flatOrbiter("lro", T)!;
  assert.ok(Math.abs(track[40]!.lat - here.lat) < 0.01 && Math.abs(wrapLongitude(track[40]!.lon - here.lon)) < 0.01, "the track passes through the dot");
  const pieces = trackPieces(track);
  for (const [a, b] of pieces) assert.ok(Math.abs(b.lon - a.lon) < 180, "no piece crosses the map");
  assert.equal(flatTrack("tianwen-1", T).length, 0);
  assert.equal(trackPieces([{ lat: 0, lon: 170 }, { lat: 5, lon: -170 }]).length, 2);
});

test("the names and colours: every orbiter is named in both languages and keeps its colour", () => {
  for (const id of ORBITER_IDS) {
    assert.ok(orbiterName(id, "en").length > 0 && orbiterName(id, "ja").length > 0);
    assert.equal(orbiterName(id, "en", true), ORBITER_FACTS[id].short.en);
    assert.match(orbiterColour(id), /^#[0-9a-f]{6}$/);
  }
  const colours = ORBITER_IDS.map(orbiterColour);
  assert.equal(new Set(colours).size, colours.length, "no two orbiters share a colour");
});

test("the words: English and Japanese have the same keys, every {place} is filled, and the shared keys match chikyu-earth's", () => {
  assert.deepEqual(Object.keys(FLAT_WORDS.ja).sort(), Object.keys(FLAT_WORDS.en).sort());
  for (const lang of ["en", "ja"] as const) for (const [key, text] of Object.entries(FLAT_WORDS[lang])) assert.ok(text.trim().length > 0, `${lang}.${key}`);
  assert.equal(say("en", "map", { body: "Mars" }), "Flat map of Mars");
  assert.equal(say("ja", "map", { body: "火星" }), "火星の平面地図");
  assert.equal(say("ja", "nosuchkey"), "nosuchkey");
  // the wording a page keeps when it swaps this map for the Earth's
  assert.equal(FLAT_WORDS.en.footprint, "Footprint");
  assert.equal(FLAT_WORDS.ja.footprint, "可視範囲");
  assert.equal(FLAT_WORDS.ja.myPlace, "自分の場所");
  assert.equal(coordinateText("en", "lat", -3.01), "3.01° S");
  assert.equal(coordinateText("ja", "lon", -23.47), "西経23.47°");
  // every kind of place has its word
  for (const place of [...PLACES_MOON, ...PLACES_MARS]) assert.ok(FLAT_WORDS.en[`kind_${place.kind}`], place.kind);
});
