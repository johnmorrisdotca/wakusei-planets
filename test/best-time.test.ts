// bestTimeToLook is the highest moment of a calendar day while the body is up and the Sun's centre is at least 6 degrees down.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bestTimeToLook, riseSetTimes } from "../src/sky.ts";

const VANCOUVER = { observer: { latitude: 49.28, longitude: -123.12 }, timeZone: "America/Vancouver" };
const WINTER = Date.UTC(2026, 0, 15, 20);

test("Jupiter's best time on a winter night in Vancouver is its transit", () => {
  const day = riseSetTimes("jupiter", WINTER, VANCOUVER);
  const best = bestTimeToLook("jupiter", WINTER, VANCOUVER);
  assert.ok(day.transit);
  assert.ok(best);
  assert.ok(Math.abs(best.getTime() - day.transit.getTime()) < 2000, best.toISOString());
});

test("a midnight sun has no dark sky to look in", () => {
  const polar = { observer: { latitude: 89, longitude: 0 }, timeZone: "UTC" };
  assert.equal(bestTimeToLook("mars", Date.UTC(2026, 5, 21, 12), polar), null);
});

test("the Sun is refused, and a bad time zone is refused", () => {
  assert.throws(() => bestTimeToLook("sun", WINTER, VANCOUVER), /not the sun/);
  assert.throws(() => bestTimeToLook("mars", WINTER, { observer: VANCOUVER.observer, timeZone: "Mars/Olympus" }), /timeZone/);
});
