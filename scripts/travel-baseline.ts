// Writes test/travel-baseline.json: a digest of every sample of every baseline move (test/travel-harness.ts), as the planner makes them now. It was taken once, from the planner as released in 0.52.0, so that a
// change to the planner can be shown to leave every move it was not meant to touch the same, sample for sample. Do not run it to make a failing test pass.
import { writeFileSync } from "node:fs";
import { baselineMoves, digestOf, walk, type BaselineEntry } from "../test/travel-harness.ts";

const out: Record<string, BaselineEntry> = {};
for (const [name, make] of baselineMoves()) {
  const w = walk(make());
  out[name] = { digest: digestOf(w), empty: w.events.filter((e) => e.kind === "empty").length };
}
writeFileSync(new URL("../test/travel-baseline.json", import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${Object.keys(out).length} moves`);
