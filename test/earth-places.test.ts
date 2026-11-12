// The places on the space view's Earth, without a browser: a body as a view draws it made into a picture for chikyu-earth's layout (flat or in perspective), the point the Sun is over, the layout agreeing with chikyu-earth's own
// on a picture drawn straight on, and the entry point handing the views chikyu-earth's reading and layout.
import assert from "node:assert/strict";
import { test } from "node:test";
import { orthoView, layoutPlaces, type Place } from "@johnmorrisdotca/chikyu-earth/markers";
import { layEarthPlaces, readEarthPlaces } from "../src/earth-places.ts";
import { pointUnder, spotView, type SurfaceSpot, type SurfaceView } from "../src/place-marks.ts";
import { earthPlacesLayout, EARTH_PLACE_LOOKS, readEarthPlaceLook } from "../src/scene/earth-places.ts";
import type { Vec3 } from "../src/vec.ts";

/** The Earth face on, longitude 0 towards the viewer, in a 420-pixel square with 200 pixels of radius. */
const face = (extra: Partial<SurfaceView> = {}): SurfaceView => ({
  centre: [0, 0, 0],
  radius: 1,
  pole: [0, 1, 0],
  meridian: [0, 0, 1],
  scale: [1, 1, 1],
  toward: [0, 0, 1],
  project: (p) => ({ x: 210 + p[0] * 200, y: 210 - p[1] * 200 }),
  width: 420,
  height: 420,
  radiusPx: 200,
  ...extra,
});
const spot = (): SurfaceSpot => ({ x: 0, y: 0, upX: 0, upY: 0, facing: 0 });

test("a point under the camera faces it and stands straight at it; one at the edge is side on", () => {
  const view = spotView(face());
  const out = spot();
  assert.equal(view.at(0, 0, out), true);
  assert.deepEqual([out.x, out.y, out.facing], [210, 210, 1]);
  assert.deepEqual([out.upX, out.upY], [0, 0], "looking straight down on it, there is no upright to see");
  view.at(45, 0, out);
  assert.ok(Math.abs(out.facing - Math.SQRT1_2) < 1e-9);
  assert.ok(out.upX > 0.7 && out.upX < 0.72 && Math.abs(out.upY) < 1e-9, "it leans out to the right, as much as the ground slopes away");
  view.at(0, 60, out);
  assert.ok(out.upY < 0 && Math.abs(out.upX) < 1e-9, "the north leans up the screen");
  view.at(90, 0, out);
  assert.ok(Math.abs(out.facing) < 1e-9 && Math.abs(out.upX - 1) < 1e-6);
  view.at(180, 0, out);
  assert.ok(out.facing < -0.99, "the far side faces away");
  assert.equal(view.width, 420);
  assert.equal(view.radius, 200);
});

test("with the camera close (perspective) the ground faces it by less than on a flat view", () => {
  const eye: Vec3 = [0, 0, 3];
  const view = spotView(face({ eye, toward: undefined }));
  const out = spot();
  view.at(60, 0, out);
  // the normal is (sin 60, 0, cos 60) and the way to the camera from the point is (-sin 60, 0, 3 - cos 60)
  assert.ok(Math.abs(out.facing - (-0.75 + 1.25) / Math.hypot(0.75 ** 0.5, 2.5)) < 1e-9, `facing ${out.facing}`);
  const flat = spot();
  spotView(face()).at(60, 0, flat);
  assert.ok(out.facing < flat.facing, "from near, a point 60 degrees out is seen more from the side");
});

test("a point the projection cannot place is left out", () => {
  const view = spotView(face({ project: (p) => (p[2] < 0 ? null : { x: 210 + p[0] * 200, y: 210 - p[1] * 200 }) }));
  assert.equal(view.at(180, 0, spot()), false);
  assert.equal(view.at(0, 0, spot()), true);
});

test("the layout on a flat view agrees with chikyu-earth's own on the picture it draws straight on", () => {
  const places: Place[] = [
    { id: "me", lon: 12, lat: 20, label: "You are here", kind: "here" },
    { id: "a", lon: -40, lat: -10, label: "A", kind: "favourite" },
    { id: "b", lon: 70, lat: 55 },
    { id: "far", lon: 170, lat: 0 },
  ];
  for (const look of EARTH_PLACE_LOOKS) {
    const theirs = layoutPlaces(places, orthoView({ lon: 10, lat: 20, radius: 200, cx: 210, cy: 210, width: 420, height: 420 }), look, { size: () => ({ width: 50, height: 18 }) });
    const ours = layEarthPlaces(places, viewAt(10, 20), look, { size: () => ({ width: 50, height: 18 }) });
    assert.ok(theirs.shapes.length >= 3, "most of the places are in sight");
    assert.equal(ours.shapes.length, theirs.shapes.length, `${look}: the same places are in sight`);
    for (const [i, shape] of ours.shapes.entries()) {
      const other = theirs.shapes[i]!;
      assert.equal(shape.index, other.index);
      for (const key of ["x", "y", "tipX", "tipY", "length", "squash", "opacity"] as const) assert.ok(Math.abs(shape[key] - other[key]) < 0.6, `${look}: ${key} ${shape[key]} against ${other[key]}`);
    }
    assert.deepEqual(ours.labels.map((l) => l.index), theirs.labels.map((l) => l.index));
  }
});

test("the point the Sun is over comes out of its direction and the body's axes", () => {
  const near = (a: { lon: number; lat: number }, lon: number, lat: number): boolean => Math.abs(a.lon - lon) < 1e-9 && Math.abs(a.lat - lat) < 1e-9;
  assert.ok(near(pointUnder([0, 0, 1], [0, 1, 0], [0, 0, 1]), 0, 0));
  assert.ok(near(pointUnder([1, 0, 0], [0, 1, 0], [0, 0, 1]), 90, 0), "east of the prime meridian is +x when the meridian faces the viewer");
  assert.ok(near(pointUnder([0, 3, 0], [0, 1, 0], [0, 0, 1]), 0, 90));
  assert.ok(near(pointUnder([0, 0, -2], [0, 1, 0], [0, 0, 1]), 180, 0) || near(pointUnder([0, 0, -2], [0, 1, 0], [0, 0, 1]), -180, 0));
});

test("the views are handed chikyu-earth's reading and layout by importing the entry point", () => {
  const using = earthPlacesLayout();
  assert.ok(using !== undefined, "importing /earth-places registers the layout");
  assert.equal(typeof using.layout, "function");
  assert.deepEqual(readEarthPlaces('[{"id":"me","lon":-79.4,"lat":43.7,"kind":"here","label":" Home "},{"lon":500,"lat":0},{"lon":2.35,"lat":48.86,"color":"url(x)"},{"lon":2.35,"lat":48.86,"color":"#e8475f"}]'), [
    { id: "me", lon: -79.4, lat: 43.7, kind: "here", label: "Home" },
    { id: "2", lon: 2.35, lat: 48.86, kind: "favourite" },
    { id: "3", lon: 2.35, lat: 48.86, kind: "favourite", color: "#e8475f" },
  ]);
  assert.deepEqual(readEarthPlaces("not json"), []);
  assert.deepEqual(readEarthPlaces(null), []);
});

test("the look is beam unless the attribute says pin or ring", () => {
  assert.deepEqual(["beam", "pin", "ring", "dot", "", null].map(readEarthPlaceLook), ["beam", "pin", "ring", "beam", "beam", "beam"]);
  assert.deepEqual([...EARTH_PLACE_LOOKS], ["beam", "pin", "ring"]);
});

/** The Earth turned so that longitude `lon`, latitude `lat` is towards the viewer with north up, drawn straight on in a 420-pixel square with 200 pixels of radius: the way chikyu-earth's `orthoView` draws it. */
function viewAt(lon: number, lat: number): SurfaceView {
  const rad = Math.PI / 180;
  const [sl, cl, sp, cp] = [Math.sin(lon * rad), Math.cos(lon * rad), Math.sin(lat * rad), Math.cos(lat * rad)];
  return face({ pole: [0, cp, sp], meridian: [-sl, -sp * cl, cp * cl] });
}
