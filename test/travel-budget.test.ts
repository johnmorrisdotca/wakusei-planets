// The time budget of the planner (`TravelInput.budget`): the planner reads no clock itself, so a test gives it a clock of its own. Without a budget every way is tried and the plan is always the same (every other
// test runs so); with one the planner stops looking when the time is up and keeps the best way so far, which is never worse than the first way it made.
import assert from "node:assert/strict";
import { test } from "node:test";
import { TRAVEL_BUDGET_MS, travelPlan } from "../src/space/index.ts";
import { faultCounts, moveOf, SHAPES, SIDES, walk, type Move } from "./travel-harness.ts";

/** Moves of two moons from plain views that have faults the other ways cure (see the table of scripts/travel-table.ts). */
const MOVES: [string, string, "compressed" | "true", number, number][] = [
  ["titan", "enceladus", "compressed", 2, 1],
  ["titan", "enceladus", "compressed", 0, 5],
  ["phobos", "deimos", "compressed", 2, 0],
  ["callisto", "europa", "true", 0, 6],
  ["triton", "proteus", "true", 1, 0],
];
const build = (m: (typeof MOVES)[number], budget?: { now: () => number; ms: number }): Move => {
  const move = moveOf(m[0] as never, m[1] as never, m[2], SHAPES[m[3]]!.aspect, undefined, SIDES[m[4]]!);
  return budget === undefined ? move : { ...move, input: { ...move.input, budget } };
};
const total = (c: { empty: number; lost: number; drift: number; step: number }): number => c.empty + c.lost + c.drift + c.step;
/** A clock that moves `step` milliseconds each time it is read. */
const clock = (step: number): (() => number) => {
  let t = 0;
  return () => {
    t += step;
    return t;
  };
};

test("the value the space view passes is 40 ms", () => {
  assert.equal(TRAVEL_BUDGET_MS, 40);
});

test("with no time left the planner keeps the first way it made, and with a little it keeps the best so far, never worse than the first and never better than trying every way", () => {
  let better = 0;
  for (const m of MOVES) {
    const none = faultCounts(walk(build(m, { now: clock(100), ms: TRAVEL_BUDGET_MS }))); // the first look at the clock is over the limit: no other way is tried
    const some = faultCounts(walk(build(m, { now: clock(40), ms: TRAVEL_BUDGET_MS }))); // one other way is tried, perhaps two
    const all = faultCounts(walk(build(m)));
    for (const [name, c] of [["some", some], ["all", all]] as const) {
      const key = `${m.join(" ")} ${name}`;
      assert.ok(c.empty <= none.empty && c.lost <= none.lost && c.drift <= none.drift && c.step <= none.step && c.driftWorst <= none.driftWorst + 1e-9, `${key}: ${JSON.stringify(none)} now ${JSON.stringify(c)}`);
    }
    assert.ok(total(all) <= total(some), `${m.join(" ")}: every way is no worse than one`);
    if (total(all) < total(none)) better += 1;
  }
  assert.ok(better > 0, "the other ways cure something in these moves");
});

test("a plan made with a budget is the plan made without one when the time is not used up, and a move is planned once however often it is asked for", () => {
  for (const m of MOVES) {
    const free = build(m);
    const timed = build(m, { now: () => 0, ms: TRAVEL_BUDGET_MS });
    assert.deepEqual(faultCounts(walk(timed)), faultCounts(walk(free)), m.join(" "));
    assert.equal(travelPlan(free.input).route, travelPlan(free.input).route, "the plan of one input is worked out once");
  }
});
