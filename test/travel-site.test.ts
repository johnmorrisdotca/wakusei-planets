// The moves as the site makes them (MODULES-1371): each input here is what the space view handed the planner for a move of the site's gallery, taken from a real element (the Earth view's hand-over at 187 Earth radii with the
// destination turned into the picture, the squeezed scale, 21 June 2026; and a moon of a planet, or a planet and its moon, with the camera beside the first). The planner takes the straight way: the camera never goes out farther from the
// two bodies than the larger of the distance between them and the distance it began at (it does not back off to a view of the whole system and in again), the rules of the walk all hold, and the Earth is passed, not left from afar.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type TravelInput } from "../src/space/index.ts";
import { length, sub } from "../src/vec.ts";
import { out, walk, type Move } from "./travel-harness.ts";

const inputs = JSON.parse(readFileSync(new URL("./data/travel-site-inputs.json", import.meta.url), "utf8")) as Record<string, TravelInput>;
const moveOf = (input: TravelInput): Move => ({ input, bodies: [{ id: "earth", body: input.leaving }, { id: "mars", body: input.destination }, ...(input.others ?? []).map((body, i) => ({ id: `moon${i}`, body }))] as Move["bodies"] });

for (const [name, input] of Object.entries(inputs)) {
  test(`the site's move ${name} goes straight: it never backs off to a view of the whole system, and no rule of the walk is broken`, () => {
    const move = moveOf(input);
    const w = walk(move, { bent: { back: 400, turned: 800 } });
    const far = out(move, w);
    if (process.env.TRAVEL_TABLE) console.log(`# site ${name}: ${w.path}, out ${far.toFixed(2)}, ${(w.duration / 1000).toFixed(1)} s`);
    assert.deepEqual(w.faults, [], name);
    assert.ok(far <= 1.1, `${name}: the camera went out to ${far.toFixed(2)} times the larger of the distance between the bodies and where it began`);
    // from the Earth view the camera never goes farther from the Earth than the planet is, or than it began
    if (name.startsWith("earth-to")) {
      const pivot = input.leaving.from;
      const way = Math.max(length(sub(input.destination.from, pivot)), length(sub(input.start.position, pivot)));
      for (const s of w.samples) assert.ok(length(sub(s.position, pivot)) <= 1.05 * way, `${name}: ${length(sub(s.position, pivot)).toFixed(0)} from the Earth, of ${way.toFixed(0)}`);
    }
  });
}
