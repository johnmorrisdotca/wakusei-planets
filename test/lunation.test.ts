// moonLunation is Brown's count of new moons, with the new moon of 17 January 1923 as number 1.
import assert from "node:assert/strict";
import { test } from "node:test";
import { moonLunation } from "../src/sky.ts";

test("Brown's lunation number counts from the new moon of 17 January 1923", () => {
  assert.equal(moonLunation(Date.UTC(1923, 0, 17, 12)), 1);
  assert.equal(moonLunation(Date.UTC(1923, 0, 16, 12)), 0);
  assert.equal(moonLunation(Date.UTC(2000, 0, 7, 12)), 953);
  assert.equal(moonLunation(Date.UTC(2026, 0, 18, 20)), 1275);
  assert.equal(moonLunation(Date.UTC(2026, 0, 18, 18)), 1274);
});
