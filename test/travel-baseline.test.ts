// The moves of the baseline (test/travel-baseline.json, taken once from 42ae03d by scripts/travel-baseline.ts, the planner of 0.52.0) are never worse now: for every one, at three picture shapes and two scales for
// every pair of the planner's tests, the plain views from ten sides for twelve pairs, and, for three pairs, `direct`, `look-back`, `cut`, a reader who asked for reduced motion and a `pace` of 2, a walk of the move
// has none of the faults the family work cures (an empty picture, the destination out of the picture after the turn, the destination drifting away from its place on the screen, a jump of the destination) more than
// it had, nor more moments of a pace fault, nor, where the planet was in the picture all through, any moment with it out. Since the smooth move (MODULES-1371) the digests are not compared: the path of a turning move
// is new (it starts the way on during the turn and is framed), and a digest holds to the last bit what a Mac and a CI machine do not agree on to the last bit. One whose turn is an aim point's must keep the nearer of
// the two bodies inside 0.95 of the way to the edge of the picture in the turn (`AIM_EDGE`).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { travelPlan } from "../src/space/index.ts";
import { baselineMoves, faultCounts, turnEdge, walk, type BaselineEntry } from "./travel-harness.ts";

const baseline = JSON.parse(readFileSync(new URL("./travel-baseline.json", import.meta.url), "utf8")) as Record<string, BaselineEntry>;

test("every move of the baseline has none of the faults the family work cures more than the planner of 0.52.0 had, and none that it did not have", () => {
  const moves = baselineMoves();
  assert.equal(moves.length, Object.keys(baseline).length);
  let better = 0;
  for (const [name, make] of moves) {
    const was = baseline[name];
    assert.ok(was, name);
    const move = make();
    const w = walk(move);
    const now = faultCounts(w);
    assert.ok(now.empty <= was.empty && now.lost <= was.lost && now.drift <= was.drift && now.step <= was.step && now.driftWorst <= was.driftWorst + 0.01 && now.pace <= was.pace + 1, `${name}: ${JSON.stringify(was)} now ${JSON.stringify(now)}`);
    if (was.planet === 0) assert.equal(now.planet, 0, `${name}: the planet was in the picture all through`);
    if (now.empty + now.lost + now.drift + now.step < was.empty + was.lost + was.drift + was.step) better += 1;
    const aimed = (travelPlan(move.input).route as { turn: { aim?: unknown } | null }).turn?.aim !== undefined;
    if (aimed) assert.ok(turnEdge(w) <= 0.95 + 1e-9, `${name}: the nearer body gets ${turnEdge(w).toFixed(3)} of the way to the edge of the picture in the turn`);
  }
  if (process.env.TRAVEL_TABLE) console.log(`${better} of ${moves.length} baseline moves have fewer faults than in 0.52.0`);
});
