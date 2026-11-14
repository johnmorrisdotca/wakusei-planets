// The moves the family-move work was not meant to change are the same as the planner of 0.52.0 made them (test/travel-baseline.json, taken once from 42ae03d by scripts/travel-baseline.ts): the same plan (kind,
// path, shares of the move, length in milliseconds, least turn, settle, easing) and the same camera at every one of 240 moments. It covers the default kind, `turn-travel`, at three picture shapes and two
// scales for every pair of the planner's tests, the plain views from ten sides for twelve pairs, and, for three pairs, `direct`, `look-back`, `cut`, a reader who asked for reduced motion and a `pace` of 2.
// A move whose digest has changed must be a move of two bodies of one planet's family that had empty pictures, and must have fewer of them now.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { travelPlan } from "../src/space/index.ts";
import { baselineMoves, digestOf, walk, type BaselineEntry } from "./travel-harness.ts";

const baseline = JSON.parse(readFileSync(new URL("./travel-baseline.json", import.meta.url), "utf8")) as Record<string, BaselineEntry>;

test("every move that had no empty picture in 0.52.0 is the same now, sample for sample, and every other move has fewer", () => {
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
    const empty = w.events.filter((e) => e.kind === "empty").length;
    assert.ok(was.empty > 0 && empty < was.empty, `${name}: changed, with ${empty} empty samples where there were ${was.empty}`);
    assert.equal(travelPlan(move.input).path, "circle", `${name}: changed, and it is not a move round a planet`);
  }
  if (process.env.TRAVEL_TABLE) console.log(`${changed.length} of ${moves.length} baseline moves changed`);
});
