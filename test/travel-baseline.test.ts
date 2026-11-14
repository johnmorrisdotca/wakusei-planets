// The moves the family-move work was not meant to change are the same as the planner of 0.52.0 made them (test/travel-baseline.json, taken once from 42ae03d by scripts/travel-baseline.ts): the same plan (kind,
// path, shares of the move, length in milliseconds, least turn, settle, easing) and the same camera at every one of 240 moments. It covers the default kind, `turn-travel`, at three picture shapes and two
// scales for every pair of the planner's tests, the plain views from ten sides for twelve pairs, and, for three pairs, `direct`, `look-back`, `cut`, a reader who asked for reduced motion and a `pace` of 2.
// A move whose digest has changed must be a move of two bodies of one planet's family that had faults of the kinds the family work cures (an empty picture, the destination out of the picture after the turn,
// the destination drifting away from its place on the screen, a jump of the destination), must have none of those kinds more now, and fewer in all; and one whose turn is an aim point's must keep the nearer of the two bodies inside 0.95 of the way to the
// edge of the picture in the turn (`AIM_EDGE`).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { travelPlan } from "../src/space/index.ts";
import { baselineMoves, digestOf, faultCounts, turnEdge, walk, type BaselineEntry } from "./travel-harness.ts";

const baseline = JSON.parse(readFileSync(new URL("./travel-baseline.json", import.meta.url), "utf8")) as Record<string, BaselineEntry>;
const total = (c: { empty: number; lost: number; drift: number; step: number }): number => c.empty + c.lost + c.drift + c.step;

test("every move that had none of the faults the family work cures in 0.52.0 is the same now, sample for sample, and every other move has none of them more and fewer in all", () => {
  const moves = baselineMoves();
  assert.equal(moves.length, Object.keys(baseline).length);
  const changed: string[] = [];
  for (const [name, make] of moves) {
    const was = baseline[name];
    assert.ok(was, name);
    const move = make();
    const w = walk(move);
    if (digestOf(w) === was.digest) continue;
    changed.push(name);
    const now = faultCounts(w);
    assert.ok(total(was) > 0, `${name}: changed, and it had none of the faults the family work cures`);
    assert.ok(now.empty <= was.empty && now.lost <= was.lost && now.drift <= was.drift && now.step <= was.step && now.driftWorst <= was.driftWorst + 1e-9 && total(now) < total(was), `${name}: ${JSON.stringify(was)} now ${JSON.stringify(now)}`);
    const aimed = (travelPlan(move.input).route as { turn: { aim?: unknown } | null }).turn?.aim !== undefined;
    if (aimed) assert.ok(turnEdge(w) <= 0.95 + 1e-9, `${name}: the nearer body gets ${turnEdge(w).toFixed(3)} of the way to the edge of the picture in the turn`);
    assert.equal(travelPlan(move.input).path, "circle", `${name}: changed, and it is not a move round a planet`);
  }
  if (process.env.TRAVEL_TABLE) console.log(`${changed.length} of ${moves.length} baseline moves changed`);
});
