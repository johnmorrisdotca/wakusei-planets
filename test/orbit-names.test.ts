import assert from "node:assert/strict";
import test from "node:test";
import { placeOrbitNames } from "../src/moon-pages/names.ts";

test("every moon is named, and two moons in the same place do not share a label", () => {
  assert.deepEqual(placeOrbitNames([], 12), []);
  const one = placeOrbitNames([{ id: "himalia", x: 100, y: 0, text: "Himalia" }], 12);
  assert.equal(one.length, 1);
  assert.ok(Math.hypot(one[0]!.x - 100, one[0]!.y) < 40, `${one[0]!.x},${one[0]!.y}`);
  const piled = placeOrbitNames(
    [
      { id: "a", x: 0, y: 200, text: "Ananke" },
      { id: "b", x: 0, y: 200, text: "Carme" },
    ],
    12,
  );
  assert.deepEqual(piled.map((name) => name.id).sort(), ["a", "b"]);
  assert.ok(Math.hypot(piled[0]!.x - piled[1]!.x, piled[0]!.y - piled[1]!.y) > 8);
});
