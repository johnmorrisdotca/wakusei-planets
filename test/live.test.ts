import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES, BODY_IDS } from "../src/facts.ts";
import { createLive, defaultTurn, type LiveRequest } from "../src/live.ts";
import { dot, length } from "../src/vec.ts";

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

test("a portrait turns by default, backwards when the body does, and turn 0 stays still", () => {
  for (const id of BODY_IDS) assert.equal(defaultTurn(id), BODIES[id].rotationHours < 0 ? -12 : 12, id);
  for (const id of BODY_IDS) {
    const live = createLive();
    const spinning = request({ id, start: undefined, moons: false, turn: defaultTurn(id) });
    assert.notDeepEqual(live.at(spinning, 0).pose.meridian, live.at(spinning, 500).pose.meridian, id);
  }
  const held = createLive();
  const still = request({ id: "venus", start: undefined, moons: false, turn: 0 });
  assert.deepEqual(held.at(still, 0).pose.meridian, held.at(still, 1000).pose.meridian);
});

test("every dated body turns between two moments", () => {
  for (const id of BODY_IDS) {
    const live = createLive();
    const r = request({ id, start: Date.UTC(2026, 10, 2), startedAt: 0, rate: 1, moons: false, turn: defaultTurn(id) });
    live.at(r, 0);
    assert.notDeepEqual(live.at(r, 0).pose.meridian, live.at(r, 500).pose.meridian, id);
  }
});

test("a dated picture's turn keeps going past one second", () => {
  const live = createLive();
  const r = request({ id: "mars", start: Date.UTC(2026, 10, 2), startedAt: 0, rate: 1, moons: false, turn: 12 });
  const a = live.at(r, 0).pose.meridian;
  const b = live.at(r, 2500).pose.meridian;
  const angle = (Math.acos(Math.min(1, Math.max(-1, dot(a, b)))) * 180) / Math.PI;
  assert.ok(angle > 20, String(angle));
});

test("a dated picture keeps that date's orientation and adds the turn", () => {
  const at = (turn: number) => {
    const live = createLive();
    const r = request({ id: "jupiter", start: Date.UTC(2026, 10, 2), startedAt: 0, rate: 1, moons: false, turn });
    live.at(r, 0);
    return live.at(r, 500).pose.meridian;
  };
  assert.notDeepEqual(at(12), at(0));
});

test("a portrait with no date turns by its own rate and needs no ephemeris", () => {
  const live = createLive();
  const r = request({ start: undefined, moons: false, turn: 20 });
  const a = live.at(r, 0).pose.meridian;
  const b = live.at(r, 1000).pose.meridian;
  assert.notDeepEqual(a, b);
  assert.equal(live.at(r, 0).time, undefined);
});
