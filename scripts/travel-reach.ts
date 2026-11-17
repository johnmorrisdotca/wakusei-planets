// How far out the camera goes in a move, as the site makes it from the Earth view (test/travel-harness.ts `siteMoveOf`): the most, over a walk, of its distance from the nearer of the two bodies, in the larger of the distance
// between them and what it was at the first view (1 or under for a straight way). Run: node scripts/travel-reach.ts [from:to ...]   (from:to:187 starts that many radii out, from:to:187:20 with the destination 20 degrees off)
import type { BodyId } from "../src/facts.ts";
import { length, sub } from "../src/vec.ts";
import { out, SCALES, SHAPES, siteMoveOf, walk } from "../test/travel-harness.ts";

const PAIRS: [BodyId, BodyId, number | undefined, number][] = [
  ["earth", "mars", 187, 0], ["earth", "mars", 187, 20], ["earth", "sun", 187, 0], ["earth", "jupiter", 187, 0], ["earth", "jupiter", 187, 20], ["earth", "pluto", 187, 0], ["earth", "pluto", 187, 20],
  ["io", "europa", undefined, 0], ["titan", "enceladus", undefined, 0], ["mars", "phobos", 30, 0],
];
const asked = process.argv.slice(2).map((text) => text.split(":")).map(([a, b, r, o]) => [a, b, r === undefined ? undefined : Number(r), Number(o ?? 0)] as [BodyId, BodyId, number | undefined, number]);
for (const [a, b, startRadii, offAxis] of asked.length > 0 ? asked : PAIRS) {
  for (const mode of SCALES) {
    for (const shape of SHAPES) {
      const move = siteMoveOf(a, b, mode, shape.aspect, { startRadii, offAxis });
      const w = walk(move, { bent: { back: 400, turned: 800 } });
      const d = length(sub(move.input.leaving.from, move.input.destination.from));
      console.log(`${`${a} to ${b}`.padEnd(20)} ${String(startRadii ?? "").padStart(4)} ${String(offAxis).padStart(3)} ${mode.padEnd(10)} ${shape.name.padEnd(6)} out ${out(move, w).toFixed(2).padStart(6)} (D ${d.toFixed(0).padStart(7)})  ${(w.duration / 1000).toFixed(1)} s  ${w.path.padEnd(7)} faults ${w.faults.length}`);
    }
  }
}
