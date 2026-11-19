// A move planned before the click (src/space/ahead.ts), without a browser: the plan is the plan of the input it reports, it is kept for the move it was made for and for no other, and a view with no up is left to the draw.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type BodyId } from "../src/facts.ts";
import { closeEnough, planAhead, type AheadMove } from "../src/space/ahead.ts";
import { SPACE_BODIES } from "../src/space/scene.ts";
import { travelPose } from "../src/space/travel.ts";
import { groundDirection } from "../src/space/aim.ts";

const T0 = Date.UTC(2026, 10, 2, 14);
const move = (id: BodyId, leaving: BodyId, over: Partial<AheadMove> = {}): AheadMove => ({
  id,
  leaving,
  kind: "turn-travel",
  pace: 1,
  mode: "compressed",
  time: T0,
  aspect: 16 / 9,
  bodies: SPACE_BODIES as readonly BodyId[],
  pose: { p: [0, 0, 4.1], q: [0, 0, 0, 1], fov: 35 },
  end: { aim: groundDirection(30, 10, T0), distance: 4.1, up: [0, 1, 0], fov: 35 },
  ...over,
});

test("a move planned ahead carries the plan of its own input, and the camera it starts from is the one given", () => {
  for (const [id, from] of [["jupiter", "earth"], ["moon", "earth"], ["callisto", "europa"], ["sun", "neptune"]] as [BodyId, BodyId][]) {
    const ahead = planAhead(move(id, from));
    assert.ok(ahead, id);
    assert.equal(ahead.id, id);
    assert.equal(ahead.plan.kind, "turn-travel");
    const first = travelPose(ahead.input, 0, ahead.plan);
    assert.deepEqual([...first.position], [...ahead.input.start.position]);
    assert.ok(ahead.plan.duration >= 1200 && ahead.plan.duration <= 9000 * 1.01, `${id}: ${ahead.plan.duration}`);
    const last = travelPose(ahead.input, 1, ahead.plan);
    assert.deepEqual([...last.position], [...ahead.input.end.position]);
  }
});

test("the body gone to is the origin of the plan, and the bodies are where the clock holds them at that moment", () => {
  const ahead = planAhead(move("mars", "earth"))!;
  assert.deepEqual([...ahead.input.destination.from], [0, 0, 0]);
  assert.equal(ahead.input.destination.to, ahead.input.destination.from);
  assert.ok(Math.hypot(...ahead.input.leaving.from) > 1);
  assert.equal(ahead.input.others!.some((b) => b === ahead.input.destination || b === ahead.input.leaving), false);
  assert.equal(ahead.input.around, undefined);
});

test("two moons of one planet are planned round that planet", () => {
  const ahead = planAhead(move("europa", "callisto"))!;
  assert.ok(ahead.input.around, "the planet is circled");
  assert.equal(ahead.input.others!.length, SPACE_BODIES.length - 1, "every body but the planet is kept clear of");
});

test("a move is the same move when its numbers are within a millionth, and not when a body or the camera is elsewhere", () => {
  const a = planAhead(move("jupiter", "earth"))!;
  assert.ok(closeEnough(a.input, planAhead(move("jupiter", "earth"))!.input), "the same move, planned twice");
  assert.ok(closeEnough(a.input, { ...a.input, start: { ...a.input.start, position: [a.input.start.position[0] + 1e-8, a.input.start.position[1], a.input.start.position[2]] } }), "a hair off");
  assert.equal(closeEnough(a.input, { ...a.input, start: { ...a.input.start, position: [a.input.start.position[0] + 0.01, a.input.start.position[1], a.input.start.position[2]] } }), false, "the camera is elsewhere");
  assert.equal(closeEnough(a.input, planAhead(move("jupiter", "earth", { time: T0 + 3_600_000 }))!.input), false, "an hour later the bodies are elsewhere");
  assert.equal(closeEnough(a.input, planAhead(move("saturn", "earth"))!.input), false, "another destination");
  assert.equal(closeEnough(a.input, planAhead(move("jupiter", "earth", { kind: "direct" }))!.input), false, "another kind of move");
  assert.equal(closeEnough(a.input, planAhead(move("jupiter", "earth", { aspect: 1 }))!.input), false, "another shape of picture");
});

test("a camera straight over a pole, which has no up to lay the picture by, is left to the draw", () => {
  assert.equal(planAhead(move("mars", "earth", { end: { aim: [0, 1, 0], distance: 4.1, up: [0, 1, 0], fov: 35 } })), null);
});

test("the budget's clock is no part of the comparison", () => {
  const a = planAhead(move("saturn", "sun"))!;
  assert.ok(closeEnough(a.input, { ...a.input, budget: { now: () => 0, ms: a.input.budget!.ms } }));
});
