// The marks of places over a view, without a browser: the layers an attribute asks for, a place's point on a body's ellipsoid, which marks face the viewer and are kept, and the turn that brings a place to the middle.
import assert from "node:assert/strict";
import { test } from "node:test";
import { layerOf, MARK_RULES, placeMarks, readPlaceLayers, surfacePoint, turnToPlace, type SurfaceView } from "../src/place-marks.ts";
import { findPlace, type Place } from "../src/places.ts";
import { PLACES_MARS } from "../src/places/mars.ts";
import { PLACES_MOON } from "../src/places/moon.ts";
import { placeLine } from "../src/scene/place-layer.ts";
import { turn, type Vec3 } from "../src/vec.ts";

const RAD = Math.PI / 180;

/** The Moon face on, longitude 0 towards the viewer, as `<wakusei-body>` draws it in a 400-pixel square at zoom 1 (180 pixels of radius). */
const face = (radiusPx = 180, meridian: Vec3 = [0, 0, 1]): SurfaceView => ({
  centre: [0, 0, 0],
  radius: 1,
  pole: [0, 1, 0],
  meridian,
  scale: [1, 1, 1],
  toward: [0, 0, 1],
  project: (p) => ({ x: 200 + p[0] * radiusPx, y: 200 - p[1] * radiusPx }),
  width: 400,
  height: 400,
  radiusPx,
});

test("the layers an attribute asks for", () => {
  assert.deepEqual(readPlaceLayers(null), []);
  assert.deepEqual(readPlaceLayers(""), ["landing", "crash", "planned", "feature"]);
  assert.deepEqual(readPlaceLayers("all"), ["landing", "crash", "planned", "feature"]);
  assert.deepEqual(readPlaceLayers("feature, landing nonsense"), ["landing", "feature"]);
  assert.deepEqual(readPlaceLayers("none"), []);
  assert.deepEqual(["crewed", "landing", "rover", "crash", "impact", "entry", "planned", "feature"].map((kind) => layerOf(kind as Place["kind"])), ["landing", "landing", "landing", "crash", "crash", "crash", "planned", "feature"]);
});

test("a place's point lies on the ellipsoid along its planetocentric direction, with the outward normal", () => {
  const view = { ...face(), radius: 2 };
  const east = surfacePoint(view, 0, 90);
  assert.deepEqual(east.point.map((n) => Math.round(n * 1e9) / 1e9), [2, 0, 0], "east of the prime meridian is +x when the meridian faces the viewer");
  // a flattened body: the point at 45 degrees planetocentric is along that direction, and its normal leans poleward
  const flat = { ...face(), scale: [1, 0.9, 1] as Vec3 };
  const p = surfacePoint(flat, 45, 0);
  assert.ok(Math.abs(Math.atan2(p.point[1], p.point[2]) / RAD - 45) < 1e-9);
  assert.ok(Math.abs((p.point[2] / 1) ** 2 + (p.point[1] / 0.9) ** 2 - 1) < 1e-12, "on the surface");
  assert.ok(Math.atan2(p.normal[1], p.normal[2]) / RAD > 45, "the normal is steeper than the radius");
});

test("the marks: only the near side, nothing crowded, the visited sites before the features, and a feature only when it is big enough to show", () => {
  const moon = PLACES_MOON as readonly Place[];
  const marks = placeMarks(moon, ["landing", "crash", "planned", "feature"], face(), 1737.4);
  assert.ok(marks.length > 10 && marks.length <= Math.min(MARK_RULES.most, 180 / MARK_RULES.sharePx));
  assert.ok(placeMarks(moon, ["landing", "crash", "planned", "feature"], face(60), 1737.4).length <= 15, "a small disc gets few marks");
  const ids = marks.map((mark) => mark.place.id);
  assert.ok(ids.includes("moon/apollo-11-lunar-module"), "Tranquility Base is on the near side");
  assert.ok(!ids.includes("moon/chang-e-4"), "von Kármán is on the far side");
  for (const mark of marks) {
    assert.ok(mark.x >= 0 && mark.x <= 400 && mark.y >= 0 && mark.y <= 400);
    // planetocentric longitude: a near-side place is within 90 degrees of the meridian facing the viewer
    assert.ok(Math.cos(mark.place.lat * RAD) * Math.cos(mark.place.lon * RAD) > 0, mark.place.id);
  }
  for (let i = 0; i < marks.length; i += 1) for (let j = i + 1; j < marks.length; j += 1) assert.ok(Math.hypot(marks[i]!.x - marks[j]!.x, marks[i]!.y - marks[j]!.y) >= MARK_RULES.gapPx);
  const firstFeature = marks.findIndex((mark) => mark.layer === "feature");
  assert.ok(firstFeature > 0 && marks.slice(firstFeature).every((mark) => mark.layer === "feature"), "the sites come first");
  for (const mark of marks) if (mark.layer === "feature" && mark.place.famous !== true) assert.ok((mark.place.feature!.diameterKm / 1737.4) * 180 >= MARK_RULES.featureFromPx, mark.place.id);
  // Apollo 11's mark is where its latitude and longitude put it on the disc
  const eagle = marks.find((mark) => mark.place.id === "moon/apollo-11-lunar-module")!;
  assert.ok(Math.abs(eagle.x - (200 + 180 * Math.cos(eagle.place.lat * RAD) * Math.sin(eagle.place.lon * RAD))) < 1e-6);
  // turned half round, the far side is shown and Tranquility Base is not
  const far = placeMarks(moon, ["landing"], face(180, [0, 0, -1]), 1737.4).map((mark) => mark.place.id);
  assert.ok(far.includes("moon/chang-e-4") && !far.includes("moon/apollo-11-lunar-module"));
  // a body too small for marks gets none, and no layer gives none
  assert.deepEqual(placeMarks(moon, ["landing"], face(MARK_RULES.fromPx - 1), 1737.4), []);
  assert.deepEqual(placeMarks(moon, [], face(), 1737.4), []);
  // zoomed in, more features are big enough; a single layer gives only its own kinds
  const close = placeMarks(moon, ["feature"], face(1800), 1737.4);
  assert.ok(close.every((mark) => mark.layer === "feature"));
  const planned = placeMarks(PLACES_MARS as readonly Place[], ["planned"], { ...face(180, [Math.sin(-25.71 * RAD), 0, Math.cos(-25.71 * RAD)]) }, 3389.5);
  assert.deepEqual(planned.map((mark) => mark.place.id), ["mars/rosalind-franklin"]);
});

test("a view with perspective hides what faces away from the eye, not from a fixed direction", () => {
  const moon = PLACES_MOON as readonly Place[];
  const eye: Vec3 = [0, 0, 1.2];
  const near = placeMarks(moon, ["landing"], { ...face(), toward: undefined, eye, project: (p) => ({ x: 200 + (p[0] / (eye[2] - p[2])) * 40, y: 200 - (p[1] / (eye[2] - p[2])) * 40 }) }, 1737.4);
  // so close, only the middle of the disc is in sight: every mark is within the cap the eye sees (cos of the angle from the sub-eye point over 1/1.2)
  for (const mark of near) assert.ok(Math.cos(mark.place.lat * RAD) * Math.cos(mark.place.lon * RAD) > 1 / 1.2, mark.place.id);
});

test("the turn that brings a place to the middle of the disc", () => {
  const cases: [Vec3, Vec3][] = [
    [[0, 1, 0], [0, 0, 1]],
    [[0.2, 0.95, 0.24], [0, -0.25, 0.97]],
    [[-0.5, 0.6, 0.62], [0.3, -0.5, 0.81]],
  ];
  for (const [rawPole, rawMeridian] of cases) {
    const norm = (v: Vec3): Vec3 => v.map((n) => n / Math.hypot(...v)) as unknown as Vec3;
    const pole = norm(rawPole);
    const d0 = rawMeridian.map((n, i) => n - pole[i]! * (rawMeridian[0] * pole[0] + rawMeridian[1] * pole[1] + rawMeridian[2] * pole[2])) as unknown as Vec3;
    const meridian = norm(d0);
    for (const [lat, lon] of [[0.67, 23.47], [-44, -170], [20, 100], [-10, -30]] as const) {
      const { yaw, tilt } = turnToPlace(pole, meridian, lat, lon);
      // as <wakusei-body> turns: the meridian about the pole by the yaw, then everything about x by the tilt
      const m1 = turn(meridian, pole, yaw);
      const e1: Vec3 = [pole[1] * m1[2] - pole[2] * m1[1], pole[2] * m1[0] - pole[0] * m1[2], pole[0] * m1[1] - pole[1] * m1[0]];
      const c = Math.cos(lat * RAD);
      const d = [0, 1, 2].map((i) => c * Math.cos(lon * RAD) * m1[i]! + c * Math.sin(lon * RAD) * e1[i]! + Math.sin(lat * RAD) * pole[i]!) as unknown as Vec3;
      const out = turn(d, [1, 0, 0], tilt);
      // reachable unless the pole leans so far that the place's circle about it misses the y-z plane
      const reach = Math.abs(pole[0] * (pole[0] * d[0] + pole[1] * d[1] + pole[2] * d[2])) <= Math.hypot(d[0] - pole[0] * (pole[0] * d[0] + pole[1] * d[1] + pole[2] * d[2]), pole[1] * d[2] - pole[2] * d[1]);
      if (reach) assert.ok(out[2] > 0.999999, `${lat}, ${lon}: ${out.map((n) => n.toFixed(4))}`);
      else assert.ok(out[2] > 0, `${lat}, ${lon} comes to the near side`);
    }
  }
});

test("the line under a place's name, in both languages", () => {
  const moon = PLACES_MOON as readonly Place[];
  const eagle = findPlace(moon, "Apollo 11 lunar module")!;
  assert.equal(placeLine(eagle, "en"), "crewed landing, 1969");
  assert.equal(placeLine(eagle, "ja"), "有人着陸、1969年");
  const im3 = findPlace(moon, "moon/im-3")!;
  assert.equal(placeLine(im3, "en"), "planned landing, launch 2027");
  assert.equal(placeLine(im3, "ja"), "着陸予定 (2027年打ち上げ)");
  const imbrium = findPlace(moon, "Mare Imbrium")!;
  assert.match(placeLine(imbrium, "en"), /^sea, 1,1\d\d km$/);
  assert.match(placeLine(imbrium, "ja"), /^海、1,1\d\d km$/);
});
