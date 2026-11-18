// The places on the space view's Earth, without a browser: a body as a view draws it made into a picture for chikyu-earth's layout (flat or in perspective), the point the Sun is over, the layout agreeing with chikyu-earth's own
// on a picture drawn straight on, and the entry point handing the views chikyu-earth's reading and layout.
import assert from "node:assert/strict";
import { test } from "node:test";
import { orthoView, layoutPlaces, type Place } from "@johnmorrisdotca/chikyu-earth/markers";
import { layEarthPlaces, readEarthPlaceLayers, readEarthPlaces, shownEarthPlaces } from "../src/earth-places.ts";
import { pointUnder, spotView, type SurfaceSpot, type SurfaceView } from "../src/place-marks.ts";
import { earthPlaceClick, earthPlacesLayout, EARTH_PLACE_LOOKS, inMarkOrder, keepPlaceFields, layWithOwn, readEarthPlaceLook, type EarthPlace } from "../src/scene/earth-places.ts";
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

test("a place keeps its layer, size, look and name priority, and only valid ones", () => {
  const read = readEarthPlaces('[{"id":"a","lon":0,"lat":0,"layer":" harbours ","size":"small","look":"ring","namePriority":"low"},{"id":"b","lon":1,"lat":1,"layer":"","size":"big","look":"star","namePriority":"high"},{"lon":2,"lat":2,"layer":"x"},{"lon":900,"lat":0,"layer":"gone"},{"id":"c","lon":3,"lat":3,"layer":"'.concat("l".repeat(60), '"}]'));
  assert.deepEqual(read.map((p) => [p.id, p.layer?.length ?? null, p.size ?? null, p.look ?? null, p.namePriority ?? null]), [["a", 8, "small", "ring", "low"], ["b", null, null, null, null], ["2", 1, null, null, null], ["c", 40, null, null, null]]);
  assert.equal(read[0]!.layer, "harbours");
  // a reader that has them already, or a text that is not a list, changes nothing
  const own: EarthPlace[] = [{ id: "a", lon: 0, lat: 0, layer: "own" }];
  assert.equal(keepPlaceFields("not json", own), own);
  assert.equal(keepPlaceFields('{"a":1}', own), own);
  assert.equal(keepPlaceFields(null, own), own);
  assert.equal(keepPlaceFields('[3,{"id":"a","lon":0,"lat":0}]', own), own);
});

test("the layer switches: only false hides a layer, a place with no layer is always shown, and nothing hidden is the list as it came", () => {
  assert.deepEqual(readEarthPlaceLayers('{"harbours":false,"airports":true,"x":1,"y":"no"}'), { harbours: false, airports: true });
  assert.deepEqual(["", null, undefined, "nope", "[1]", "null", "3"].map(readEarthPlaceLayers), [{}, {}, {}, {}, {}, {}, {}]);
  const places: EarthPlace[] = [{ id: "yvr", lon: 0, lat: 0, layer: "airports" }, { id: "cavan", lon: 1, lat: 1, layer: "harbours" }, { id: "me", lon: 2, lat: 2 }];
  assert.deepEqual(shownEarthPlaces(places, { harbours: false }).map((p) => p.id), ["yvr", "me"]);
  assert.deepEqual(shownEarthPlaces(places, { harbours: false, airports: false }).map((p) => p.id), ["me"]);
  assert.equal(shownEarthPlaces(places, {}), places);
  assert.equal(shownEarthPlaces(places, { harbours: true, other: false }), places);
});

test("the markers are given out for the reader first, the rest in the order given, and the places whose name is low last", () => {
  const places: EarthPlace[] = [{ id: "a", lon: 0, lat: 0, namePriority: "low" }, { id: "b", lon: 0, lat: 0 }, { id: "me", lon: 0, lat: 0, kind: "here", namePriority: "low" }, { id: "c", lon: 0, lat: 0 }];
  assert.deepEqual(inMarkOrder(places).map((p) => p.id), ["me", "b", "c", "a"]);
});

test("a small place has a shorter stick and a smaller ring, a place whose look is ring has no stick, and its name goes with the stick's top", () => {
  const places: EarthPlace[] = [
    { id: "plain", lon: 10, lat: 20, label: "Plain" },
    { id: "small", lon: 12, lat: 20, label: "Small", size: "small" },
    { id: "flat", lon: 10, lat: 22, label: "Flat", look: "ring" },
    { id: "pin", lon: 14, lat: 20, look: "pin", size: "small" },
  ];
  const options = { size: () => ({ width: 50, height: 18 }) };
  const view = spotView(viewAt(10, 20));
  const laid = layWithOwn(layoutPlaces, places, view, "beam", options);
  const by = (id: string) => laid.shapes.find((shape) => shape.index === places.findIndex((p) => p.id === id))!;
  const plain = by("plain");
  const small = by("small");
  assert.ok(plain.length > 10, "a plain beam is tall");
  assert.ok(small.length > 0 && Math.abs(small.length / plain.length - 0.55) < 0.1, `small ${small.length} of plain ${plain.length}`);
  assert.ok(Math.abs(small.ring / plain.ring - 0.7) < 1e-9);
  assert.equal(by("flat").length, 0);
  assert.equal(by("flat").tipX, by("flat").x);
  assert.equal(by("flat").ring, plain.ring);
  assert.ok(by("pin").length > 0 && by("pin").ring < plain.ring);
  // the tip is where the length says it is, from the foot along the same line
  for (const shape of laid.shapes) assert.ok(Math.abs(Math.hypot(shape.tipX - shape.x, shape.tipY - shape.y) - shape.length) < 1e-6);
  // a name sits against the top of its own stick: as far from it as chikyu-earth's layout puts one beside the beam's
  const spot = (layout: typeof laid, shape: (typeof laid.shapes)[number]) => {
    const label = layout.labels.find((l) => l.index === shape.index)!;
    return [label.left - shape.tipX, label.top - shape.tipY];
  };
  const alone = layoutPlaces([places[2]!], view, "beam", options);
  const there = spot(laid, by("flat"));
  const home = spot(alone, alone.shapes[0]!);
  assert.ok(Math.hypot(there[0]! - home[0]!, there[1]! - home[1]!) < 40, "the name stays beside the mark it names");
  // the list's own look is the look of the places that have none of their own
  const ring = layWithOwn(layoutPlaces, places, view, "ring", options);
  assert.equal(ring.shapes.find((shape) => shape.index === 0)!.length, 0);
  assert.ok(ring.shapes.find((shape) => shape.index === 3)!.length > 0, "a place's own look wins over the list's");
  // nothing of its own: laid as chikyu-earth lays it
  const bare = places.slice(0, 1);
  assert.deepEqual(layWithOwn(layoutPlaces, bare, view, "pin", options), layoutPlaces(bare, view, "pin", options));
});

test("the press event carries the place, its body and where the press was", () => {
  assert.deepEqual(earthPlaceClick("earth", { id: "me", lon: -79.4, lat: 43.7, kind: "here", label: "Home", layer: "mine" }, 210, 190), { body: "earth", id: "me", kind: "here", lon: -79.4, lat: 43.7, x: 210, y: 190, layer: "mine", label: "Home" });
  assert.deepEqual(earthPlaceClick("moon", { id: "moon/tycho", lon: -11.2, lat: -43.3 }, 1, 2), { body: "moon", id: "moon/tycho", kind: "favourite", lon: -11.2, lat: -43.3, x: 1, y: 2 });
});

/** The Earth turned so that longitude `lon`, latitude `lat` is towards the viewer with north up, drawn straight on in a 420-pixel square with 200 pixels of radius: the way chikyu-earth's `orthoView` draws it. */
function viewAt(lon: number, lat: number): SurfaceView {
  const rad = Math.PI / 180;
  const [sl, cl, sp, cp] = [Math.sin(lon * rad), Math.cos(lon * rad), Math.sin(lat * rad), Math.cos(lat * rad)];
  return face({ pole: [0, cp, sp], meridian: [-sl, -sp * cl, cp * cl] });
}
