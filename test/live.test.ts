import assert from "node:assert/strict";
import { test } from "node:test";
import { createLive, type LiveRequest } from "../src/live.ts";
import { length } from "../src/vec.ts";

const request = (over: Partial<LiveRequest> = {}): LiveRequest => ({ id: "jupiter", start: Date.UTC(2026, 10, 2), startedAt: 0, rate: 3600, moons: true, portrait: {}, turn: 0, ...over });

test("the sky is worked out in full about once a second, and carried forward between", () => {
  const live = createLive();
  const r = request();
  let last = live.at(r, 0);
  for (let t = 33; t < 3000; t += 33) last = live.at(r, t);
  assert.ok(live.anchors >= 3 && live.anchors <= 4, String(live.anchors));
  assert.equal(last.moons.length, 4);
});

test("a moon keeps its distance from the planet as it is carried forward", () => {
  const live = createLive();
  const r = request({ rate: 86400 });
  const first = live.at(r, 0).moons[0]!;
  const later = live.at(r, 900).moons[0]!;
  assert.ok(Math.abs(length([later.x, later.y, later.z]) - length([first.x, first.y, first.z])) < 0.2);
  assert.ok(Math.hypot(later.x - first.x, later.y - first.y) > 0.1);
});

test("a portrait with no date turns by its own rate and needs no ephemeris", () => {
  const live = createLive();
  const r = request({ start: undefined, moons: false, turn: 20 });
  const a = live.at(r, 0).pose.meridian;
  const b = live.at(r, 1000).pose.meridian;
  assert.notDeepEqual(a, b);
  assert.equal(live.at(r, 0).time, undefined);
});
