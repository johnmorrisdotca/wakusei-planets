// The rule a way on is taken by (`betterThan` in src/space/travel.ts): one test for each clause, with faults made up, so that dropping any one of them is found.
import assert from "node:assert/strict";
import { test } from "node:test";
import { betterThan, total, type Faults } from "../src/space/travel.ts";

const was: Faults = { empty: 5, lost: 4, drift: 3, driftWorst: 0.2, step: 2, pace: 1, planet: 0 };
const KINDS = ["empty", "lost", "drift", "step"] as const;

test("a way with fewer faults in total and none of any kind more is taken", () => {
  assert.ok(betterThan({ ...was, empty: 4 }, was));
  assert.ok(betterThan({ empty: 0, lost: 0, drift: 0, driftWorst: 0, step: 0, pace: 0, planet: 0 }, was));
  assert.ok(betterThan({ ...was, drift: 1, driftWorst: 0.1, pace: 0 }, was));
});

test("a way with the same faults in total is not taken, however it is shared out", () => {
  assert.ok(!betterThan(was, was));
  assert.equal(total({ ...was, empty: 4, lost: 5 }), total(was));
  assert.ok(!betterThan({ ...was, empty: 4, lost: 5 }, was));
});

test("a way with more of any one kind is not taken, though it has far fewer faults in total", () => {
  for (const kind of KINDS) {
    const now: Faults = { ...was, empty: 0, lost: 0, drift: 0, step: 0, driftWorst: 0, pace: 0 };
    now[kind] = was[kind] + 1;
    assert.ok(total(now) < total(was), kind);
    assert.ok(!betterThan(now, was), `${kind}: one more of it is refused`);
  }
});

test("a way with the same faults but a worse pace is not taken", () => {
  assert.ok(!betterThan({ ...was, empty: 0, pace: was.pace + 1 }, was));
  assert.ok(betterThan({ ...was, empty: 0, pace: was.pace }, was));
});

test("a way whose worst drift in a sample is worse is not taken, however few the drifting samples", () => {
  assert.ok(!betterThan({ ...was, drift: 0, driftWorst: was.driftWorst + 0.05 }, was));
  assert.ok(betterThan({ ...was, drift: 0, driftWorst: was.driftWorst }, was));
});

test("a way that takes the planet out of a picture that had it all through is not taken; where the planet was out already it only breaks a tie", () => {
  assert.ok(!betterThan({ ...was, empty: 0, planet: 1 }, { ...was, planet: 0 }), "the views promised the planet");
  assert.ok(betterThan({ ...was, empty: 0, planet: 0 }, { ...was, planet: 0 }));
  assert.ok(betterThan({ ...was, empty: 0, planet: 9 }, { ...was, planet: 5 }), "plain views never promised it: more samples with it out do not refuse a way");
});
