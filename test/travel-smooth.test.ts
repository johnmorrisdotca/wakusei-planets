// The smooth move (MODULES-1371): the camera does not move in an L (a turn, a stop, a straight line), it moves along one continuous curve; where the body left and the destination can share the picture the body left is
// large on one side and the destination small on the other; bodies near the way are passed, never flown through; a move begun while another is going starts from where the camera is; and the body left stays in the
// picture on the way, or, where it cannot, it is at the back left or right of the destination at the end. All walked without a browser, as in space-travel.test.ts. Set TRAVEL_TABLE=1 to print the numbers.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type BodyId } from "../src/facts.ts";
import { hostOf, TRAVEL_CLEARANCE, travelArrival, travelPlan, travelPose, type TravelBody, type TravelInput, type TravelView } from "../src/space/index.ts";
import { dot, length, RAD, sub, unit, type Vec3 } from "../src/vec.ts";
import { holdSite } from "../src/space/hold.ts";
import { angle, moveOf, SAMPLES, SCALES, SHAPES, site, walk, type Walk } from "./travel-harness.ts";

const FOV = 35;
const table = (line: string): void => {
  if (process.env.TRAVEL_TABLE) console.log(line);
};

/** What the camera's path does between samples: whether its speed drops to almost nothing between two faster stretches (a stop between two motions), and the most the direction it goes in turns between two samples while it is moving at more than a tenth of its top speed (a corner). */
function pathOf(w: Walk): { stop: boolean; corner: number } {
  const steps: Vec3[] = [];
  for (let i = 1; i < w.samples.length; i += 1) steps.push(sub(w.samples[i]!.position, w.samples[i - 1]!.position));
  const speed = steps.map((step) => length(step));
  const top = Math.max(...speed);
  let stop = false;
  for (let i = 10; i < speed.length - 10; i += 1) {
    if (speed[i]! > speed[i - 1]! || speed[i]! > speed[i + 1]!) continue;
    const before = Math.max(...speed.slice(0, i));
    const after = Math.max(...speed.slice(i));
    if (speed[i]! < 0.12 * Math.min(before, after)) stop = true;
  }
  let corner = 0;
  for (let i = 1; i < steps.length; i += 1) if (speed[i]! > 0.1 * top && speed[i - 1]! > 0.1 * top) corner = Math.max(corner, angle(steps[i - 1]!, steps[i]!));
  return { stop, corner };
}

test("a move that turns beside the body left and then goes to the destination is one curve: no corner, and for most no stop between the two", () => {
  let stops = 0;
  for (const [a, b] of [["earth", "mars"], ["mars", "jupiter"], ["jupiter", "saturn"], ["mercury", "sun"]] as [BodyId, BodyId][]) {
    for (const shape of SHAPES) {
      const w = walk(moveOf(a, b, "true", shape.aspect));
      const { stop, corner } = pathOf(w);
      table(`# curve ${a} to ${b} true ${shape.name}: blend ${w.plan.blend}, ${(w.duration / 1000).toFixed(1)} s, stop ${stop}, worst corner ${corner.toFixed(2)} degrees`);
      assert.deepEqual(w.faults, [], `${a} to ${b}, ${shape.name}`);
      stops += stop ? 1 : 0;
      assert.ok(corner < 5, `${a} to ${b}, ${shape.name}: a corner of ${corner.toFixed(1)} degrees in one sample`);
    }
  }
  // the turn holds the body left in the picture, so a way on that starts during it may overlap only as far as that lets it
  assert.ok(stops <= 6, `${stops} of 12 moves stop between the turn and the way on`);
});

test("across fifty-four moves the camera stops between its turn and its way on in few, and the plan says how much of the turn the way on overlaps", () => {
  let stops = 0;
  let blended = 0;
  let n = 0;
  for (const [a, b] of [["mercury", "sun"], ["earth", "mars"], ["mars", "jupiter"], ["jupiter", "saturn"], ["neptune", "mercury"], ["earth", "moon"], ["moon", "earth"], ["sun", "earth"], ["moon", "titan"]] as [BodyId, BodyId][]) {
    for (const mode of SCALES) {
      for (const shape of SHAPES) {
        const w = walk(moveOf(a, b, mode, shape.aspect), { bent: a === "moon" && b === "titan" ? { back: 25, turned: 100 } : a === "neptune" ? { back: 3, turned: 200 } : undefined });
        n += 1;
        if (pathOf(w).stop) stops += 1;
        const blend = w.plan.blend;
        assert.ok(blend >= 0 && blend <= 1);
        if (blend > 0) blended += 1;
      }
    }
  }
  table(`# ${n} moves: ${stops} with a stop between the turn and the way on, ${blended} with the way on starting during the turn`);
  assert.ok(stops <= 30, `${stops} of ${n} moves stop between the turn and the way on`);
  assert.ok(blended >= n / 2, `${blended} of ${n} moves start the way on during the turn`);
});

const start = (): TravelView => ({ position: [0, 0, 4.1], forward: [0, 0, -1], up: [0, 1, 0], fov: FOV });

test("B1: where the body left and the destination can share the picture, the body left is large on one side and the destination small on the other, at about half the picture's height", () => {
  for (const place of [[40, 0, 0], [-40, 0, 0], [0, 0, 40], [30, 0, 30]] as Vec3[]) {
    const from = start();
    const input: TravelInput = { start: from, end: travelArrival({ body: place, radius: 0.5, from: from.position, aspect: 16 / 9 }), leaving: { from: [0, 0, 0], radius: 1 }, destination: { from: place, radius: 0.5 }, aspect: 16 / 9 };
    const plan = travelPlan(input);
    let found: { height: number; left: number; right: number } | null = null;
    for (let i = 0; i <= 200; i += 1) {
      const s = travelPose(input, i / 200, plan);
      const height = (s.leaving.radius * 2) / FOV;
      if (s.leaving.inside && s.destination.inside && s.leaving.x * s.destination.x < 0 && height >= 0.4 && height <= 0.6) found = found === null || Math.abs(height - 0.5) < Math.abs(found.height - 0.5) ? { height, left: s.leaving.x, right: s.destination.x } : found;
    }
    table(`# B1 ${JSON.stringify(place)}: ${found === null ? "none" : `body left ${(found.height * 100).toFixed(0)}% of the height at ${found.left.toFixed(2)}, destination at ${found.right.toFixed(2)}`}`);
    assert.ok(found !== null, `${JSON.stringify(place)}: no moment with the body left at 40 to 60 percent of the height on one side and the destination on the other`);
    assert.ok(Math.abs(found!.left) >= 0.3 && Math.abs(found!.right) >= 0.3, "each on its own side of the middle");
    const w = walk({ input, bodies: [{ id: "earth", body: input.leaving }, { id: "mars", body: input.destination }] });
    assert.deepEqual(w.faults.filter((text) => !/turned away from its last direction|degrees where/.test(text)), [], JSON.stringify(place));
  }
});

test("B2: a destination just off the picture is brought in by a small shift, with the body left kept in the picture", () => {
  const from = start();
  const place: Vec3 = [30 * Math.sin(50 * RAD), 0, 4.1 - 30 * Math.cos(50 * RAD)];
  const input: TravelInput = { start: from, end: travelArrival({ body: place, radius: 0.5, from: from.position, aspect: 16 / 9 }), leaving: { from: [0, 0, 0], radius: 1 }, destination: { from: place, radius: 0.5 }, aspect: 16 / 9 };
  const plan = travelPlan(input);
  for (let i = 0; i <= SAMPLES; i += 1) {
    const s = travelPose(input, i / SAMPLES, plan);
    if (!s.destination.inside) {
      assert.ok(s.leaving.inside, `sample ${i}: neither body in the picture`);
      continue;
    }
    // the first moment the destination is in: the camera has moved less than its own distance from the body left, and turned less than the angle to the destination
    assert.ok(length(sub(s.position, from.position)) < 4.1, `the camera moved ${length(sub(s.position, from.position)).toFixed(2)} before the destination was in the picture`);
    assert.ok(Math.acos(Math.min(1, dot(s.forward, from.forward))) / RAD < 50, "the look direction turned more than the angle to the destination");
    break;
  }
});

test("passing is allowed: a body beside the way is passed closer than before, and the path is never nearer than its radius plus the margin", () => {
  const place: Vec3 = [200, 0, 0];
  const from = start();
  const other: TravelBody = { from: [100, 0, 3.3], radius: 1 };
  const input: TravelInput = { start: from, end: travelArrival({ body: place, radius: 0.5, from: from.position, aspect: 16 / 9 }), leaving: { from: [0, 0, 0], radius: 1 }, destination: { from: place, radius: 0.5 }, others: [other], aspect: 16 / 9 };
  const plan = travelPlan(input);
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= 1000; i += 1) nearest = Math.min(nearest, length(sub(travelPose(input, i / 1000, plan).position, other.from)));
  table(`# passing: the nearest the path comes to a body on the way is ${nearest.toFixed(2)} radii from its centre (the margin is ${1 + TRAVEL_CLEARANCE})`);
  assert.ok(nearest >= (1 + TRAVEL_CLEARANCE) * (1 - 1e-6), `${nearest} radii`);
  assert.ok(nearest < 1.7, `the path keeps ${nearest.toFixed(2)} radii from a body it could pass closer`);
  assert.equal(TRAVEL_CLEARANCE, 0.35);
});

test("a move begun while another is going starts from the camera's place at that moment, with no jump, whatever moment it is", () => {
  for (const [a, b, c] of [["earth", "mars", "moon"], ["mars", "jupiter", "earth"], ["callisto", "europa", "io"]] as [BodyId, BodyId, BodyId][]) {
    const first = moveOf(a, b, "compressed", 16 / 9);
    const plan = travelPlan(first.input);
    for (const t of [0.05, 0.2, 0.35, 0.5, 0.7, 0.9]) {
      const at = travelPose(first.input, t, plan);
      const next = moveOf(b, c, "compressed", 16 / 9);
      const input: TravelInput = { ...next.input, start: { position: at.position, forward: at.forward, up: at.up, fov: at.fov } };
      const second = travelPlan(input);
      const s0 = travelPose(input, 0, second);
      assert.deepEqual(s0.position, at.position);
      assert.ok(angle(s0.forward, at.forward) < 1e-9, "the look direction is the camera's");
      // the first moments of the second move are small steps from there, not a jump
      const way = length(sub(input.end.position, at.position));
      let before = s0;
      let step = 0;
      for (let i = 1; i <= 12; i += 1) {
        const s = travelPose(input, i / SAMPLES, second);
        const now = length(sub(s.position, before.position));
        assert.ok(i > 1 || now <= 0.01 * Math.max(way, 1e-9) + 1e-9, `${a}, ${b}, ${c} at ${t}: the first step is ${now}, of a way of ${way}`);
        assert.ok(now >= step * 0.999 - 1e-12, `${a}, ${b}, ${c} at ${t}: the camera slowed in its first moments (${step} then ${now}), so it does not start from rest`);
        step = now;
        assert.ok(angle(s.forward, before.forward) < 3, `${a}, ${b}, ${c} at ${t}: the look direction jumped at sample ${i}`);
        before = s;
      }
    }
  }
});

// ---- the lit side wins; the body left stays in the picture as long as it can -------------------------------------------------------------------------------------------------------------------

const KEEP: readonly (readonly [BodyId, BodyId])[] = [
  ["sun", "mercury"], ["sun", "venus"], ["sun", "earth"], ["sun", "mars"],
  ["earth", "moon"], ["mars", "phobos"], ["jupiter", "io"], ["saturn", "titan"],
  ["moon", "mars"], ["moon", "earth"], ["io", "saturn"], ["titan", "jupiter"], ["earth", "jupiter"],
];
/** The rules of a turn that never goes round the destination do not hold for one that does (it may come round to put the body left behind it): the others do. */
const ROUND = /turned away from its last direction|degrees where|went .* degrees back/;
const START = Date.UTC(2026, 10, 11, 12);

test("arriving, the body gone to is at least half lit and the body left stays in the picture until the destination is in it (and a planet and its moon all through) (the Sun to each inner planet, a planet to its moon, a moon to another planet, the Earth to Jupiter)", () => {
  const lines: string[] = [];
  let always = 0;
  let atEnd = 0;
  let early = 0;
  for (const [a, b] of KEEP) {
    for (const mode of SCALES) {
      for (const shape of SHAPES) {
        const move = moveOf(a, b, mode, shape.aspect, undefined, false, undefined, undefined, true);
        const w = walk(move, { bent: { back: 400, turned: 800 } });
        assert.deepEqual(w.faults.filter((text) => !ROUND.test(text)), [], `${a} to ${b}, ${mode}, ${shape.name}`);
        // the lit side wins: at least half of the body gone to is lit in the last view
        if (b !== "sun") {
          const side = unit(sub(move.input.end.position, move.input.destination.to ?? move.input.destination.from));
          const toSun = unit(sub(site("sun", mode, START).at, move.input.destination.to ?? move.input.destination.from));
          assert.ok((1 + dot(side, toSun)) / 2 >= 0.5 - 1e-6, `${a} to ${b}, ${mode}, ${shape.name}: ${((1 + dot(side, toSun)) / 2).toFixed(2)} lit`);
        }
        const out = w.samples.filter((s) => !s.leaving.inside).length;
        const last = w.samples[SAMPLES]!.leaving;
        // the body left is in the picture until the destination is (no moment with neither: the walk's own rule), so it stays for as long as the way allows
        if (hostOf(b) === a) assert.equal(out, 0, `${a} to ${b}, ${mode}, ${shape.name}: a planet and its moon stay together`);
        if (out === 0) always += 1;
        else if (last.inside) atEnd += 1;
        else early += 1;
        lines.push(`${`${a} to ${b}`.padEnd(18)} ${mode.padEnd(10)} ${shape.name.padEnd(6)} out of the picture ${String(out).padStart(3)} of ${SAMPLES + 1} moments; last view ${last.inside ? `in at (${last.x.toFixed(2)}, ${last.y.toFixed(2)})` : "not in it"}`);
      }
    }
  }
  table(`\n${lines.join("\n")}\n# ${always} walks keep the body left in the picture all through, ${atEnd} bring it back behind the destination, ${early} lose it for the rest of the way and the last view (the lit side won)`);
});

test("an arrival keeps a moon of a planet gone to outward (Jupiter from the Earth, wide and tall, both scales): the lit side, with a moon in the picture", () => {
  const ms = START;
  for (const mode of SCALES) {
    for (const aspect of [1280 / 900, 390 / 844]) {
      const jupiter = holdSite("jupiter", mode, ms);
      const earth = holdSite("earth", mode, ms);
      const companions = ["io", "europa", "ganymede", "callisto"].map((id) => ({ id, at: holdSite(id as BodyId, mode, ms).at, rank: 1 as const }));
      const view = travelArrival({ body: jupiter.at, radius: jupiter.radius, from: earth.at, sun: holdSite("sun", mode, ms).at, aspect, behind: earth.at, companions });
      assert.equal(view.behind, false, `${mode} ${aspect}: the Earth behind Jupiter would show its night side`);
      assert.ok(view.lit >= 0.5, `${mode} ${aspect}: ${view.lit} lit`);
      assert.ok(["io", "europa", "ganymede", "callisto"].includes(view.companion ?? ""), `${mode} ${aspect}: ${view.companion}`);
    }
  }
});

test("the body left is kept behind the body gone to where that body is still at least half lit, and not where it would show its night side", () => {
  const body: Vec3 = [100, 0, 0];
  const from: Vec3 = [0, 0, 0];
  // the Sun on the far side from the body left: behind it the body is lit; with the Sun on the body left's side it would be dark
  const lit = travelArrival({ body, radius: 1, from, sun: [300, 0, 0], aspect: 16 / 9, behind: from });
  assert.equal(lit.behind, true);
  assert.ok(lit.lit >= 0.5);
  const dark = travelArrival({ body, radius: 1, from, sun: [-300, 0, 0], aspect: 16 / 9, behind: from });
  assert.equal(dark.behind, false);
  assert.ok(dark.lit >= 0.5, "the lit side won");
});

test("without `behind` an arrival is as it was, and with it the side puts the body left clear of the disc at the back left or right", () => {
  const body: Vec3 = [100, 0, 0];
  const from: Vec3 = [0, 0, 0];
  const plain = travelArrival({ body, radius: 1, from, sun: [100, 0, 150], aspect: 16 / 9 });
  assert.equal(plain.behind, false);
  assert.ok(plain.lit >= 0.5);
  const kept = travelArrival({ body, radius: 1, from, sun: [100, 0, 150], aspect: 16 / 9, behind: from });
  assert.equal(kept.behind, true);
  // the body left is in the picture, off to a side of the disc
  const v = sub(from, kept.position);
  const z = dot(v, kept.forward);
  const across = Math.abs(dot(v, [kept.forward[1] * kept.up[2] - kept.forward[2] * kept.up[1], kept.forward[2] * kept.up[0] - kept.forward[0] * kept.up[2], kept.forward[0] * kept.up[1] - kept.forward[1] * kept.up[0]])) / z;
  assert.ok(across > Math.tan((FOV / 2) * RAD) * 0.4 && across < Math.tan((FOV / 2) * RAD) * (16 / 9) * 0.93, `${across}`);
});
