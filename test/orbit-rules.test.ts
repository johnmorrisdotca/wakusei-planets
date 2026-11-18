// Which orbit lines a close view keeps and which part it lets go (MODULES-1569). The Moon's ring round the Earth does not pass through the Earth, so it is not faded near it: in the squeezed scale it is 4 to 5 Earth radii out, inside the band the fade takes away.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fadesNearBody, isOwnLine, nearBodyKeep } from "../src/space/orbit-rules.ts";

test("a body's own line is kept when it is close, and the Moon's ring is kept for the Earth and the Moon; no other line is", () => {
  assert.equal(isOwnLine("earth", "earth"), true);
  assert.equal(isOwnLine("mars", "mars"), true);
  assert.equal(isOwnLine("moon", "earth"), true);
  assert.equal(isOwnLine("moon", "moon"), true);
  assert.equal(isOwnLine("mars", "earth"), false);
  assert.equal(isOwnLine("earth", "mars"), false);
  assert.equal(isOwnLine("moon", "mars"), false);
  assert.equal(isOwnLine("jupiter", "moon"), false);
});

test("the part near the body is let go only for a line that passes through it: a planet's own line, and the Moon's ring when the Moon is close; not the Moon's ring when the Earth is", () => {
  assert.equal(fadesNearBody("earth", "earth", true), true, "the Earth's line round the Sun passes through the Earth");
  assert.equal(fadesNearBody("saturn", "saturn", true), true);
  assert.equal(fadesNearBody("moon", "moon", true), true, "the Moon is on its ring");
  assert.equal(fadesNearBody("moon", "earth", true), false, "the ring round the Earth never meets the Earth, so it stays whole");
  // not close: nothing is faded, and a line that is not the body's own is hidden by the caller, not faded
  assert.equal(fadesNearBody("earth", "earth", false), false);
  assert.equal(fadesNearBody("moon", "moon", false), false);
  assert.equal(fadesNearBody("mars", "earth", true), false);
});

test("the keep curve: none within 3 radii, all from 12, a smooth step between, rising", () => {
  assert.equal(nearBodyKeep(0), 0);
  assert.equal(nearBodyKeep(3), 0);
  assert.equal(nearBodyKeep(12), 1);
  assert.equal(nearBodyKeep(500), 1);
  assert.ok(Math.abs(nearBodyKeep(7.5) - 0.5) < 1e-12);
  let last = 0;
  for (let away = 3; away <= 12; away += 0.25) {
    const now = nearBodyKeep(away);
    assert.ok(now >= last);
    last = now;
  }
  // the Moon's squeezed ring at 4.6 Earth radii would have kept under a fifth of its colour: the reason the rule above exists
  assert.ok(nearBodyKeep(4.6) < 0.2);
});
