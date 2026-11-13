// The survey of a move's faults (test/travel-harness.ts, printed by scripts/travel-table.ts): it counts every fault, not the first six, names the stage each starts in, and reports the same numbers each time.
// It states no limit on the planner: the planner's own rules are in space-travel.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { travelPlan } from "../src/space/index.ts";
import { moveOf, SAMPLES, SHAPES, SIDES, survey, surveyTable, walk, type FaultKind } from "./travel-harness.ts";

const STAGES = ["turn", "travel", "arrive"];

test("a clean move has no fault of any kind, and its events are empty", () => {
  const w = walk(moveOf("earth", "mars", "compressed", 16 / 9));
  assert.deepEqual(w.faults, []);
  assert.deepEqual(w.events, []);
});

test("a move whose last view looks away from the destination has its faults counted all the way, each with a stage and a kind", () => {
  const move = moveOf("callisto", "europa", "compressed", 1);
  const away = { ...move.input.end, forward: move.input.end.forward.map((n) => -n) as [number, number, number] };
  const w = walk({ ...move, input: { ...move.input, end: away } });
  assert.ok(w.events.length > w.faults.length, "more faults than the six the strings keep");
  for (const e of w.events) {
    assert.ok(STAGES.includes(e.stage));
    assert.ok(e.sample >= 0 && e.sample <= SAMPLES);
    assert.ok(Number.isFinite(e.value));
  }
  // the strings are the first events, in order
  assert.ok(w.events.slice(0, 6).every((e, i) => !w.faults[i] || w.faults[i]!.startsWith(`sample ${e.sample} (${e.stage}):`) || e.sample === SAMPLES));
});

test("the survey adds up: each side counted once for each kind, the first stage tallied once for each side with the fault, and the same numbers each time", () => {
  for (const [a, b] of [["titan", "enceladus"], ["phobos", "deimos"]] as const) {
    const shape = SHAPES[2]!;
    const one = survey(a, b, "compressed", shape);
    const again = survey(a, b, "compressed", shape);
    assert.deepEqual(one, again);
    assert.equal(one.sides, SIDES.length);
    for (const stats of [one.drift, one.empty, one.other]) {
      assert.ok(stats.walks >= 0 && stats.walks <= one.sides);
      assert.equal(stats.first.turn + stats.first.travel + stats.first.arrive, stats.walks);
      assert.ok(stats.samples >= stats.walks);
    }
    assert.equal(Object.values(one.other.kinds).reduce((sum, n) => sum + n, 0), one.other.samples);
    // the same counts as walking each side by hand
    let drift = 0;
    let empty = 0;
    let other = 0;
    for (const side of SIDES) {
      for (const e of walk(moveOf(a, b, "compressed", shape.aspect, undefined, side)).events) {
        const kind: FaultKind = e.kind;
        if (kind === "drift") drift += 1;
        else if (kind === "empty") empty += 1;
        else other += 1;
      }
    }
    assert.deepEqual([one.drift.samples, one.empty.samples, one.other.samples], [drift, empty, other], `${a} to ${b}`);
  }
});

test("the table has a line for every pair, scale and picture shape, and each line is the survey's numbers", () => {
  const lines = surveyTable([["callisto", "europa"]], SIDES.slice(0, 3));
  assert.equal(lines.length, 1 + 2 * SHAPES.length);
  const s = survey("callisto", "europa", "compressed", SHAPES[0]!, SIDES.slice(0, 3));
  assert.ok(lines[1]!.startsWith("callisto to europa     compressed wide"));
  assert.ok(lines[1]!.includes(`empty: ${String(s.empty.walks).padStart(2)}/3 ${String(s.empty.samples).padStart(5)} ${String(s.empty.worst).padStart(4)}`));
  assert.ok(travelPlan(moveOf("callisto", "europa", "compressed", 1).input).duration > 0);
});
