// The places on any body in the space view, without a browser: the list keyed by body read as `earth-places` is, the layout of several bodies in one draw on chikyu-earth's layout, the rows of a search list made into beams, and the ids a
// favourites page saved turned back into rows. (The element's drawing, the press and the cover are the e2e test's: e2e/space-body-places.demo.ts.)
import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutPlaces, readPlaces } from "@johnmorrisdotca/chikyu-earth/markers";
import { readBodyPlaces } from "../src/earth-places.ts";
import { hitToBodyPlace, loadPlaceHits, loadPlaceSearch } from "../src/places/search.ts";
import { bodiesOf, bodyScale, layBodyPlaces, readBodyPlacesWith, type BodySurface, type PlaceOnBody } from "../src/scene/body-places.ts";
import type { EarthPlacesLayout } from "../src/scene/earth-places.ts";

const using: EarthPlacesLayout = { read: readPlaces, layout: layoutPlaces };
/** A body face on, longitude 0 towards the viewer, in a 420-pixel square with 200 pixels of radius. */
const face = (id: string, extra: Partial<BodySurface> = {}): BodySurface => ({
  id, centre: [0, 0, 0], radius: 1, pole: [0, 1, 0], meridian: [0, 0, 1], eye: [0, 0, 50], width: 420, height: 420, radiusPx: 200, sun: null,
  project: (p) => ({ x: 210 + p[0] * 200, y: 210 - p[1] * 200 }),
  ...extra,
});
const place = (body: string, id: string, lon: number, lat: number, extra: Partial<PlaceOnBody> = {}): PlaceOnBody => ({ body, id, lon, lat, ...extra });
const options = { width: (text: string) => text.length * 7 + 10, taken: [] as { left: number; top: number; width: number; height: number }[] };

test("the list keyed by body is read like earth-places: grouped by body, each group by chikyu-earth's reader, the Earth's and the bodiless dropped", () => {
  const text = JSON.stringify([
    { body: "moon", id: "a", lon: 10, lat: 5, label: "A", kind: "here" }, { body: "mars", id: "b", lon: -20, lat: 30 }, { body: "moon", id: "c", lon: 400, lat: 0 },
    { body: "earth", id: "e", lon: 0, lat: 0 }, { id: "nobody", lon: 1, lat: 1 }, { body: "Moon", id: "caps", lon: 1, lat: 1 }, { body: 7, id: "num", lon: 1, lat: 1 }, null, "text",
    { body: "moon", id: "d", lon: 1, lat: 1, kind: "other", label: "x".repeat(200), color: "url(javascript:alert(1))" },
  ]);
  const list = readBodyPlaces(text);
  assert.deepEqual(list.map((p) => `${p.body}:${p.id}`), ["moon:a", "moon:d", "mars:b"], "the bodies in the order they first appear; a longitude of 400 is dropped by the Earth's own reader");
  assert.equal(list[0]?.kind, "here");
  const d = list[1] as PlaceOnBody;
  assert.equal(d.kind, "favourite", "a kind that is not here is favourite");
  assert.equal((d.label ?? "").length, 80);
  assert.equal(d.color, undefined, "an unsafe colour is dropped");
  assert.deepEqual(bodiesOf(list), ["moon", "mars"]);
  for (const bad of [null, undefined, "", "not json", "{}", "42", '"moon"']) assert.deepEqual(readBodyPlaces(bad), [], String(bad));
  assert.equal(readBodyPlacesWith('[{"body":"io","lon":1,"lat":2}]', readPlaces)[0]?.id, readPlaces('[{"lon":1,"lat":2}]')[0]?.id, "an entry with no id is given the one the reader gives");
  const many = JSON.stringify(Array.from({ length: 6000 }, (_, i) => ({ body: i % 2 ? "moon" : "mars", id: `p${i}`, lon: 0, lat: 0 })));
  assert.ok(readBodyPlaces(many).length <= 5000);
});

test("the shape a body's places lie on follows its axes, and a body the package has no facts for has none", () => {
  const moon = bodyScale("moon")!;
  assert.ok(moon.every((v) => v > 0.99 && v <= 1.01));
  assert.ok(bodyScale("mars")![1] < 1, "Mars is flattened");
  assert.equal(bodyScale("nonesuch"), undefined);
});

test("one draw lays the places of each body in sight on its own picture: the near side stands, the far side is left out, the indexes point into the list given back", () => {
  const places = [place("moon", "m1", 0, 0, { label: "Tranquility" }), place("moon", "m-far", 180, 0), place("mars", "r1", 30, 10, { label: "Olympus" })];
  const laid = layBodyPlaces(places, [face("moon"), face("mars")], using, "beam", options);
  assert.deepEqual(laid.places.map((p) => p.id).sort(), ["m-far", "m1", "r1"], "the list given back is the places of the bodies in sight");
  const shown = laid.layout.shapes.map((shape) => laid.places[shape.index]!.id).sort();
  assert.deepEqual(shown, ["m1", "r1"], "the far side of the Moon is not drawn");
  const m1 = laid.layout.shapes.find((shape) => laid.places[shape.index]!.id === "m1")!;
  assert.ok(Math.hypot(m1.x - 210, m1.y - 210) < 1e-6, "under the camera, in the middle");
  assert.equal(laid.omitted, 0);
  assert.ok(laid.layout.labels.every((spot) => laid.places[spot.index]!.label !== undefined));
  assert.ok(laid.layout.labels.some((spot) => laid.places[spot.index]!.id === "m1"), "its name is written beside it");
});

test("a body too small on the screen, one under another's disc, one with no facts and one with no places carry none", () => {
  const places = [place("moon", "m", 0, 0), place("mars", "r", 0, 0), place("nonesuch", "x", 0, 0), place("io", "i", 0, 0)];
  const surfaces = [face("moon", { radiusPx: 39 }), face("mars"), face("nonesuch"), face("europa")];
  const laid = layBodyPlaces(places, surfaces, using, "pin", { ...options, covered: (id) => id === "mars" });
  assert.deepEqual(laid.layout.shapes, []);
  assert.deepEqual(laid.places, []);
  const ok = layBodyPlaces(places, [face("moon", { radiusPx: 40 })], using, "ring", options);
  assert.equal(ok.layout.shapes.length, 1, "40 CSS pixels of radius is the least");
});

test("the limit is for all the bodies together, the reader's places first on any of them, and the rest are counted", () => {
  const places = [
    ...Array.from({ length: 5 }, (_, i) => place("moon", `m${i}`, i - 2, 0)),
    ...Array.from({ length: 5 }, (_, i) => place("mars", `r${i}`, i - 2, 5)),
    place("mars", "me", 0, -20, { kind: "here" }),
  ];
  const laid = layBodyPlaces(places, [face("moon"), face("mars")], using, "beam", { ...options, marks: 4 });
  const ids = laid.layout.shapes.map((shape) => laid.places[shape.index]!.id);
  assert.equal(ids.length, 4);
  assert.equal(ids[0], "me", "the reader's place is first, though it is on the second body");
  assert.equal(laid.omitted, 11 - 4);
  assert.ok(laid.layout.labels.every((spot) => ids.includes(laid.places[spot.index]!.id)), "a name belongs to a marker that stands");
  const all = layBodyPlaces(places, [face("moon"), face("mars")], using, "beam", options);
  assert.equal(all.layout.shapes.length, 11);
});

test("names keep clear of the names already written, across bodies", () => {
  const places = [place("moon", "a", 0, 0, { label: "A long name for a place" }), place("mars", "b", 0, 0, { label: "Another long name too" })];
  const laid = layBodyPlaces(places, [face("moon"), face("mars")], using, "beam", options);
  assert.equal(laid.layout.shapes.length, 2);
  const [one, two] = laid.layout.labels.map((spot) => ({ ...spot, width: options.width(laid.places[spot.index]!.label ?? "") }));
  if (one !== undefined && two !== undefined) {
    const overlap = one.left < two.left + two.width && two.left < one.left + one.width && one.top < two.top + 18 && two.top < one.top + 18;
    assert.equal(overlap, false, "two names on two bodies at one spot do not overlap");
  }
  const blocked = layBodyPlaces([place("moon", "a", 0, 0, { label: "Name" })], [face("moon")], using, "beam", { ...options, taken: [{ left: 0, top: 0, width: 420, height: 420 }] });
  assert.equal(blocked.layout.shapes.length, 1);
  assert.equal(blocked.layout.labels.length, 0, "a name with no room is not written, and its marker stands");
});

test("a search row becomes a beam: its body, id and position, named in the language asked for, and a favourite unless it says here", async () => {
  const mars = await loadPlaceSearch("mars");
  const olympus = mars.find((hit) => hit.id === "mars/olympus-mons")!;
  assert.deepEqual(hitToBodyPlace(olympus), { body: "mars", id: "mars/olympus-mons", lon: -133.803, lat: 18.653, label: "Olympus Mons" });
  assert.deepEqual(hitToBodyPlace(olympus, { lang: "ja", kind: "here", color: "#ff8844" }), { body: "mars", id: "mars/olympus-mons", lon: -133.803, lat: 18.653, label: "オリンポス山", kind: "here", color: "#ff8844" });
  assert.equal("label" in hitToBodyPlace(olympus, { label: false }), false);
  assert.equal(hitToBodyPlace(olympus, { label: "My volcano" }).label, "My volcano");
  const read = readBodyPlaces(JSON.stringify([hitToBodyPlace(olympus, { color: "#ff8844" })]));
  assert.equal(read.length, 1, "what the helper makes passes the reader");
  assert.equal(read[0]?.color, "#ff8844");
});

test("the ids a favourites page saved give the rows back, current ids, each once, in the order saved; only the lists needed are fetched", async () => {
  const hits = await loadPlaceHits(["moon/tycho", "mars/olympus-mons", "mercury/kunisada-2", "moon/tycho-a", "moon/tycho", "nowhere/nothing", "moon/no-such-place", "mars/perseverance-parachute", "noslash"]);
  assert.deepEqual(hits.map((hit) => hit.id), ["moon/tycho", "mars/olympus-mons", "mercury/kunisada", "moon/tycho-a", "mars/perseverance-parachute"], "an alias is made current; a lettered crater is found; unknown ids and repeats are dropped");
  assert.equal(hits[3]?.type, "Satellite Feature");
  assert.deepEqual(await loadPlaceHits([]), []);
  assert.deepEqual((await loadPlaceHits(["moon/apollo-11-lunar-module"])).map((hit) => hit.kind), ["crewed"]);
});
