// The names of the craft in the space view give way (MODULES-1535): a body's name always wins, craft names give way to each other (the chosen one, then a favourite, then the nearer to the body in view), a name goes round its dot before it
// is left out, and a page's keep-out rectangles are never written under. Pure: the layout is checked here, with no browser.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseLabels, craftRank, craftSize, nameAlternates, nameSpot, placeLabels, type KeepOut, type LabelBox } from "../src/space/index.ts";

const box = (id: string, x: number, y: number, rank: number, size = 1, width = 40): LabelBox => ({ id, x, y, width, height: 16, rank, size });
const FRAME = { width: 400, height: 300 };

test("a craft's name gives way to a body's, whatever the craft's distance, and the dot is not the name's business", () => {
  // JUICE's long name runs over the Earth's: the Earth's stays, the craft's is left out
  const shown = chooseLabels([box("earth", 100, 100, 2, 30, 36), box("juice", 110, 104, craftRank({ chosen: true, favourite: true }), craftSize(0), 190)]);
  assert.deepEqual([...shown], ["earth"]);
  // a moon is a body too: it wins over a craft it touches
  assert.deepEqual([...chooseLabels([box("moon", 100, 100, 4, 2), box("webb", 105, 100, craftRank({ chosen: true, favourite: false }), craftSize(0))])], ["moon"]);
  // apart, both stay
  assert.deepEqual([...chooseLabels([box("earth", 0, 0, 2, 30), box("webb", 200, 0, 7)])].sort(), ["earth", "webb"]);
});

test("craft names give way to each other: the chosen craft, then a favourite, then the nearer to the body in view", () => {
  assert.deepEqual([craftRank({ chosen: true, favourite: false }), craftRank({ chosen: false, favourite: true }), craftRank({ chosen: false, favourite: false })], [5, 6, 7]);
  assert.ok(craftRank({ chosen: true, favourite: true }) > 4, "every craft is after the moons, the last body");
  const overlap = (a: LabelBox, b: LabelBox): string[] => [...chooseLabels([a, b])];
  const at = (id: string, chosen: boolean, favourite: boolean, pixels: number): LabelBox => box(id, 50, 50, craftRank({ chosen, favourite }), craftSize(pixels), 80);
  assert.deepEqual(overlap(at("bepi", false, true, 400), at("hayabusa2", true, false, 900)), ["hayabusa2"], "the chosen one wins over a favourite nearer");
  assert.deepEqual(overlap(at("bepi", false, false, 100), at("hayabusa2", false, true, 900)), ["hayabusa2"], "a favourite wins over one that is nearer");
  assert.deepEqual(overlap(at("bepi", false, false, 100), at("hayabusa2", false, false, 900)), ["bepi"], "of two that are neither, the nearer one wins");
  assert.ok(craftSize(10) > craftSize(300) && craftSize(0) > craftSize(1));
  // the same on a tie of everything: the id, so the answer never depends on the order given
  assert.deepEqual(overlap(at("b", false, false, 50), at("a", false, false, 50)), ["a"]);
  assert.deepEqual(overlap(at("a", false, false, 50), at("b", false, false, 50)), ["a"]);
});

test("a craft's name goes round its dot before it is left out: to the left, above, below", () => {
  const dot = { x: 200, y: 150, r: 2 };
  const size = { width: 80, height: 16 };
  const first = nameSpot(dot, size, FRAME);
  const others = nameAlternates(dot, size, FRAME);
  assert.equal(others.length, 3);
  // the three are on the three other sides of the dot, inside the view
  assert.ok(others[0]!.x + size.width <= dot.x, "left");
  assert.ok(others[1]!.y + size.height <= dot.y, "above");
  assert.ok(others[2]!.y >= dot.y, "below");
  for (const spot of others) assert.ok(spot.x >= 0 && spot.y >= 0 && spot.x + size.width <= FRAME.width && spot.y + size.height <= FRAME.height);
  // a body's name sits on the first place: the craft moves to the next that is free
  const earth = box("earth", first.x, first.y, 2, 30, 80);
  const craft: LabelBox = { id: "juice", x: first.x, y: first.y, width: 80, height: 16, rank: 5, size: 1, alternates: others };
  const placed = placeLabels([earth, craft]);
  assert.deepEqual(placed.get("earth"), { x: first.x, y: first.y });
  assert.deepEqual(placed.get("juice"), others[0], "the craft's name is on its left, since the first place is taken");
  // all four taken: left out
  const blockers = others.map((spot, i) => box(`body${i}`, spot.x, spot.y, 3, 1, 80));
  assert.equal(placeLabels([earth, ...blockers, craft]).has("juice"), false);
});

test("a name is never placed under a keep-out rectangle, and moves to a place that is clear", () => {
  const bar: KeepOut = { x: 0, y: 270, w: 400, h: 30 };
  // Voyager 1 at the foot of the view: its first place is under the bar
  const dot = { x: 120, y: 268, r: 2 };
  const size = { width: 90, height: 16 };
  const first = nameSpot(dot, size, FRAME);
  const craft: LabelBox = { id: "voyager1", ...first, width: size.width, height: size.height, rank: 6, size: 1, alternates: nameAlternates(dot, size, FRAME) };
  assert.ok(first.y + size.height > bar.y, "the first place is over the bar");
  assert.equal(chooseLabels([craft]).has("voyager1"), true, "with no keep-out it is shown where it falls");
  const placed = placeLabels([craft], 3, [bar]);
  const spot = placed.get("voyager1");
  assert.ok(spot !== undefined, "it moved");
  assert.ok(spot.y + size.height <= bar.y, `the name's foot ${spot.y + size.height} is above the bar at ${bar.y}`);
  // a keep-out that leaves it nowhere to go: left out, and the dot is not the name's business
  const everywhere: KeepOut = { x: 0, y: 0, w: 400, h: 300 };
  assert.equal(placeLabels([craft], 3, [everywhere]).size, 0);
  // several rectangles, in the view's own coordinates; a body's name is kept out too
  const notice: KeepOut = { x: 150, y: 120, w: 200, h: 40 };
  assert.deepEqual([...chooseLabels([box("mars", 160, 125, 2, 10), box("earth", 10, 10, 2, 20)], 3, [notice])], ["earth"]);
  // touching the edge of a rectangle is not under it
  assert.deepEqual([...chooseLabels([box("mars", 350, 120, 2, 10)], 3, [notice])], ["mars"]);
});

test("the placement is the same whatever order the names come in, and one name is never placed twice", () => {
  const boxes = [box("a", 10, 10, 2, 5), box("b", 20, 12, 3, 4), box("c", 100, 100, 5, 1), box("d", 110, 104, 7, 9), box("e", 400, 10, 7, 1)];
  const keep: KeepOut[] = [{ x: 380, y: 0, w: 20, h: 40 }];
  const forward = [...placeLabels(boxes, 3, keep)].sort();
  const backward = [...placeLabels([...boxes].reverse(), 3, keep)].sort();
  assert.deepEqual(forward, backward);
  assert.equal(new Set(forward.map(([id]) => id)).size, forward.length);
});
