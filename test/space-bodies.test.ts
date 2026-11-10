// The order a hopper goes through the bodies, and reading a body from what a reader types: every body once, the planets in order from the Sun with each one's moons after it, names in any case and in Japanese.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BODY_IDS, BODIES, MOONS_OF } from "../src/facts.ts";
import { bodyKindOf, findBody, HOP_ORDER, hopFrom, hostOf } from "../src/space/index.ts";

test("the hopper's order holds every body once, the Sun first, and each planet is followed by its moons nearest first", () => {
  assert.equal(HOP_ORDER.length, BODY_IDS.length);
  assert.deepEqual([...HOP_ORDER].sort(), [...BODY_IDS].sort());
  assert.deepEqual(HOP_ORDER.slice(0, 9), ["sun", "mercury", "venus", "earth", "moon", "mars", "phobos", "deimos", "ceres"]);
  const at = (id: string): number => HOP_ORDER.indexOf(id as (typeof HOP_ORDER)[number]);
  for (const [host, moons] of Object.entries(MOONS_OF)) {
    for (const [i, moon] of (moons as readonly string[]).entries()) assert.equal(at(moon), at(host) + 1 + i, `${moon} follows ${host}`);
  }
  assert.ok(at("jupiter") < at("saturn") && at("saturn") < at("uranus") && at("uranus") < at("neptune") && at("neptune") < at("pluto") && at("pluto") < at("eris"));
});

test("a hop goes to the next body and round: the last goes to the Sun, the Sun back to the last; a body the view cannot reach is passed over", () => {
  assert.equal(hopFrom("earth", 1), "moon");
  assert.equal(hopFrom("moon", -1), "earth");
  assert.equal(hopFrom("sedna", 1), "sun");
  assert.equal(hopFrom("sun", -1), "sedna");
  assert.equal(hopFrom("mars", 1, (id) => id !== "phobos"), "deimos");
  assert.equal(hopFrom("sun", 1, (id) => id === "sun"), "sun");
  // going round the whole order returns to where it started
  let id = HOP_ORDER[0]!;
  for (let i = 0; i < HOP_ORDER.length; i += 1) id = hopFrom(id, 1);
  assert.equal(id, HOP_ORDER[0]);
  for (let i = 0; i < HOP_ORDER.length; i += 1) id = hopFrom(id, -1);
  assert.equal(id, HOP_ORDER[0]);
});

test("a body is read from its name in any case, in English or in Japanese; anything else is none", () => {
  assert.equal(findBody("Saturn"), "saturn");
  assert.equal(findBody("  TITAN "), "titan");
  assert.equal(findBody("土星"), "saturn");
  assert.equal(findBody("Hiʻiaka"), "hiiaka");
  assert.equal(findBody("nowhere"), undefined);
  assert.equal(findBody(""), undefined);
  for (const id of BODY_IDS) assert.equal(findBody(BODIES[id].name.en), id);
});

test("kinds and hosts: a moon has its planet, the Moon has the Earth, a planet has none", () => {
  assert.equal(bodyKindOf("sun"), "star");
  assert.equal(bodyKindOf("mars"), "planet");
  assert.equal(bodyKindOf("pluto"), "dwarf-planet");
  assert.equal(bodyKindOf("eris"), "dwarf-planet");
  assert.equal(bodyKindOf("titan"), "moon");
  assert.equal(hostOf("titan"), "saturn");
  assert.equal(hostOf("moon"), "earth");
  assert.equal(hostOf("dysnomia"), "eris");
  assert.equal(hostOf("mars"), undefined);
});
