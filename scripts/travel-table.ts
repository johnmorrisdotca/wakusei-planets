// The table of faults in a camera move between two bodies, walked from ten sides at three picture shapes and two scales (test/travel-harness.ts). Run with pairs as `from:to`, or with none for the six the
// family move is judged by:  node scripts/travel-table.ts callisto:europa io:ganymede
import type { BodyId } from "../src/facts.ts";
import { surveyTable } from "../test/travel-harness.ts";

const PAIRS: [BodyId, BodyId][] = [["callisto", "europa"], ["io", "ganymede"], ["titan", "enceladus"], ["oberon", "miranda"], ["phobos", "deimos"], ["triton", "proteus"]];
const asked = process.argv.slice(2).map((text) => text.split(":") as [BodyId, BodyId]);
const started = Date.now();
console.log(surveyTable(asked.length > 0 ? asked : PAIRS).join("\n"));
console.log(`\n${((Date.now() - started) / 1000).toFixed(1)} s`);
