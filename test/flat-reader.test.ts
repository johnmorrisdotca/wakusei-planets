// The reader's places on the flat map: the Earth's list, another body's list, a layer switched off, and a place that is not a place.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFlatPlaces, readerMarks } from "../src/flat/reader-places.ts";

const EARTH = '[{"id":"me","lon":-79.4,"lat":43.7,"label":"You are here","kind":"here"},{"id":"yvr","lon":-123.18,"lat":49.19,"label":"Vancouver","layer":"airports"},{"id":"cavan","lon":-123.1,"lat":49.29,"label":"Cavan","layer":"harbours"},{"lon":500,"lat":0}]';
const BODIES = '[{"body":"mars","id":"home","lon":77.45,"lat":18.44,"label":"A place on Mars","kind":"favourite"},{"body":"earth","id":"nope","lon":0,"lat":0,"label":"Not here"},{"body":"moon","id":"tycho","lon":-11.36,"lat":-43.31,"label":"Tycho"}]';

test("a place out of range is left out, and a missing id takes its index", () => {
  const places = readFlatPlaces(EARTH);
  assert.deepEqual(places.map((place) => place.id), ["me", "yvr", "cavan"]);
  assert.equal(readFlatPlaces("[]").length, 0);
  assert.equal(readFlatPlaces("nope").length, 0);
  assert.equal(readFlatPlaces('[{"lon":1,"lat":2}]')[0]!.id, "0");
});

test("the Earth draws its own list, here first, and a layer switched off is left out", () => {
  const marks = readerMarks("earth", EARTH, BODIES, null);
  assert.deepEqual(marks.map((mark) => mark.id), ["place:me", "place:yvr", "place:cavan"]);
  assert.equal(marks[0]!.shape, "star");
  assert.equal(marks[1]!.shape, "dot");
  assert.equal(marks[1]!.labelled, false);
  assert.equal(marks[2]!.shape, "square");
  const off = readerMarks("earth", EARTH, BODIES, '{"airports":false,"harbours":false}');
  assert.deepEqual(off.map((mark) => mark.id), ["place:me"]);
});

test("another body draws its own list, and the Earth's list is not drawn there", () => {
  const mars = readerMarks("mars", EARTH, BODIES, null);
  assert.deepEqual(mars.map((mark) => mark.name), ["A place on Mars"]);
  assert.equal(mars[0]!.shape, "ring");
  assert.equal(readerMarks("moon", EARTH, BODIES, null)[0]!.name, "Tycho");
  assert.equal(readerMarks("venus", EARTH, BODIES, null).length, 0);
  assert.equal(readerMarks("mars", EARTH, "nope", null).length, 0);
  assert.equal(readerMarks("mars", EARTH, "{}", null).length, 0);
});
