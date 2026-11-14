// The camera's move from one body to another, walked without a browser: the bodies are where the package's own models put them on one date, the first and last views are the ones the space view frames
// (`besideMoon` for a moon, a whole-body view otherwise), and every move is sampled at 240 moments in both scales and three picture shapes. The rules are the owner's: never an empty picture, the destination
// in view and growing from the end of the turn, one turn that is never undone, nothing passed close, and a bounded pace. Set TRAVEL_TABLE=1 to print the numbers for every pair.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type BodyId } from "../src/facts.ts";
import { regionOrbits, regionView, SUN_REGIONS, travelArrival, travelPlan, travelPose, hostOf, type TravelBody, type TravelInput, type TravelSample, type TravelView } from "../src/space/index.ts";
import { cross, dot, length, RAD, sub, type Vec3 } from "../src/vec.ts";
import { angle, BENT, bodyOf, moveOf, SAMPLES, SCALES, SHAPES, SIDES, site, SPAN, START, walk, type Walk } from "./travel-harness.ts";

const PAIRS: readonly [BodyId, BodyId][] = [
  ["mercury", "sun"], ["earth", "mars"], ["mars", "jupiter"], ["jupiter", "saturn"], ["neptune", "mercury"], ["earth", "moon"], ["moon", "earth"], ["callisto", "europa"], ["io", "ganymede"],
  ["titan", "enceladus"], ["moon", "titan"], ["oberon", "miranda"], ["pluto", "charon"], ["saturn", "titan"], ["sun", "earth"],
];

const rows: string[] = [];
const row = (name: string, mode: string, shape: string, w: Walk): void => {
  rows.push(`${name.padEnd(22)} ${mode.padEnd(10)} ${shape.padEnd(6)} ${w.path.padEnd(6)} ${(w.duration / 1000).toFixed(1).padStart(4)} s  turn ${w.turned.toFixed(0).padStart(3)} of ${w.least.toFixed(0).padStart(3)} deg (back ${w.back.toFixed(0).padStart(2)}, settle ${w.settle.toFixed(0).padStart(3)}) in ${(w.turnShare * 100).toFixed(0).padStart(2)}%  nearest ${w.nearest.radii.toFixed(2).padStart(9)} radii (${w.nearest.id})  worst step ${w.worstTurn.toFixed(2)} deg, ${w.worstScreen.toFixed(3)} frame`);
};

for (const [a, b] of PAIRS) {
  for (const mode of SCALES) {
    test(`${a} to ${b}, ${mode}: one of the two is always in the picture, the destination stays and grows after the turn, the turn is never undone, nothing is passed close, at three picture shapes`, () => {
      for (const shape of SHAPES) {
        const w = walk(moveOf(a, b, mode, shape.aspect), { bent: BENT[`${a} to ${b}`] });
        row(`${a} to ${b}`, mode, shape.name, w);
        assert.deepEqual(w.faults, [], `${a} to ${b}, ${mode}, ${shape.name}`);
      }
    });
  }
}

// the views the space view really frames: a moon is looked at whole, from the side the camera comes from, with its planet wherever it lies, so the first view may have its planet out of the picture and
// the body left near the camera while the planet is far off (the bodies of a moon to moon move are then a long way from the planet's circle)
// the clock runs while the camera moves: at an hour a second a move of five seconds is five game hours, and the Moon has gone about three Earth radii. Every body is where the clock takes it by the end
// (`to`), and the last view is framed for the destination there.
for (const hours of [5, 9]) {
  for (const [a, b] of [["earth", "moon"], ["moon", "earth"], ["moon", "mars"], ["callisto", "europa"], ["io", "ganymede"], ["mars", "jupiter"]] as [BodyId, BodyId][]) {
    for (const mode of SCALES) {
      test(`${a} to ${b} while the clock runs ${hours} game hours, ${mode}: one of the two is always in the picture, the destination grows, the turn is never undone, nothing is passed close`, () => {
        for (const shape of SHAPES) {
          const w = walk(moveOf(a, b, mode, shape.aspect, undefined, false, hours * 3_600_000), { bent: BENT[`${a} to ${b}`] });
          row(`${a} to ${b} (${hours} h)`, mode, shape.name, w);
          assert.deepEqual(w.faults, [], `${a} to ${b}, ${mode}, ${shape.name}, ${hours} hours`);
        }
      });
    }
  }
}

// one move after another: the second starts where the first ended, or where it was when the reader asked for the second (a press while the camera is on its way), with the same bodies the other way
for (const [a, b] of [["earth", "mars"], ["mercury", "sun"], ["callisto", "europa"], ["earth", "moon"]] as [BodyId, BodyId][]) {
  for (const mode of SCALES) {
    test(`${a} to ${b} and then back, ${mode}: the second move starts at the last view of the first, and at the camera's place part way along it, and is sound from there`, () => {
      for (const shape of SHAPES) {
        const first = moveOf(a, b, mode, shape.aspect);
        const plan = travelPlan(first.input);
        for (const [name, moment] of [["at its end", 1], ["a third of the way", 0.33], ["two thirds of the way", 0.66]] as const) {
          const at = moment === 1 ? first.input.end : travelPose(first.input, moment, plan);
          // the second move leaves the destination of the first (it is where the camera is going, or has come), from the view the first gave
          const start: TravelView = { position: at.position, forward: at.forward, up: at.up, fov: at.fov };
          // the bodies are where the clock has taken them by then
          const back = moveOf(b, a, mode, shape.aspect, undefined, false, SPAN, START + moment * SPAN);
          const input: TravelInput = { ...back.input, start };
          const w = walk({ ...back, input }, { bent: BENT[`${b} to ${a}`] });
          row(`${a} to ${b}, then back ${name}`, mode, shape.name, w);
          assert.ok(angle(travelPose(input, 0, travelPlan(input)).forward, at.forward) < 1e-6, "the second move's first view is the first move's");
          // Begun against the way the first arrived (back the way it came, or while it is under way) a move may have to turn on past its last direction and may sweep a far body quickly across a narrow picture,
          // and begun before the first has brought its destination into the picture it cannot promise the body left in it. Every other rule holds: sound numbers, clearance, no jump of the camera, up never flipped.
          const allowed = moment < 1 ? /turned away from its last direction|of the frame in one sample|neither body|the planet circled/ : /turned away from its last direction|of the frame in one sample/;
          assert.deepEqual(w.faults.filter((text) => !allowed.test(text)), [], `${a} to ${b} then back ${name}, ${mode}, ${shape.name}`);
        }
      }
    });
  }
}

// The plain views (the whole body from the side the camera comes from, a moon too), from ten sides: the walk reports every fault of every move, and the test fails for the empty picture, which the aim point's
// turn cures, and for the kinds the planner has never had (clearance, a turn that undoes itself, a jump of the up direction, a number that is not finite, a shrinking destination). The faults it does not cure
// (the destination drifting on the screen and the destination out of the picture after the turn, which are the way on's, and the planet out of a picture that never showed it) are printed as a count with each move.
/** The sides and shapes of the plain views that still pass through an empty picture, and how many samples: the turn of a move that has to be made faster than the pace limits allow in its share of the move is left as it was, and the two moons of Titan's tall pictures are lost in the way on. It may only get shorter. */
const PLAIN_EMPTY: Record<string, number> = {
  "callisto to europa|true|wide|6": 9,
  "callisto to europa|true|tall|0": 1,
  "titan to enceladus|compressed|tall|1": 5,
  "titan to enceladus|compressed|tall|2": 3,
  "titan to enceladus|compressed|tall|3": 3,
  "titan to enceladus|compressed|tall|5": 4,
  "titan to enceladus|compressed|tall|6": 3,
  "titan to enceladus|compressed|tall|7": 2,
  "titan to enceladus|compressed|tall|8": 4,
  "titan to enceladus|compressed|tall|9": 2,
  "titan to enceladus|true|wide|7": 3,
  "titan to enceladus|true|wide|8": 64,
  "titan to enceladus|true|wide|9": 11,
  "titan to enceladus|true|tall|1": 3,
  "titan to enceladus|true|tall|2": 3,
  "titan to enceladus|true|tall|3": 3,
  "titan to enceladus|true|tall|5": 3,
  "titan to enceladus|true|tall|6": 3,
  "titan to enceladus|true|tall|8": 3,
  "titan to enceladus|true|tall|9": 1,
  "oberon to miranda|compressed|tall|8": 4,
  "phobos to deimos|compressed|square|4": 8,
  "phobos to deimos|compressed|tall|4": 15,
  "phobos to deimos|true|square|0": 13,
  "phobos to deimos|true|square|5": 13,
  "phobos to deimos|true|square|8": 13,
  "phobos to deimos|true|tall|0": 26,
  "phobos to deimos|true|tall|1": 57,
  "phobos to deimos|true|tall|5": 36,
  "phobos to deimos|true|tall|8": 33,
  "phobos to deimos|true|tall|9": 43,
};
const PLAIN_NEVER = /^(clear|turn|up|numbers|shrink)$/;
for (const [a, b] of [["callisto", "europa"], ["io", "ganymede"], ["titan", "enceladus"], ["oberon", "miranda"], ["phobos", "deimos"], ["triton", "proteus"]] as [BodyId, BodyId][]) {
  for (const mode of SCALES) {
    test(`${a} to ${b} from plain views, ${mode}: an empty picture only where it is listed, and none of the faults the planner has never had`, () => {
      const counts: Record<string, number> = {};
      let left = 0;
      for (const shape of SHAPES) {
        SIDES.forEach((side, i) => {
          const w = walk(moveOf(a, b, mode, shape.aspect, undefined, side), { bent: BENT[`${a} to ${b}`] });
          row(`${a} to ${b} (plain)`, mode, shape.name, w);
          const key = `${a} to ${b}|${mode}|${shape.name}|${i}`;
          for (const e of w.events) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
          const empty = w.events.filter((e) => e.kind === "empty").length;
          left += PLAIN_EMPTY[key] ?? 0;
          assert.ok(empty <= (PLAIN_EMPTY[key] ?? 0), `${key}: ${empty} samples with neither body in the picture, ${PLAIN_EMPTY[key] ?? 0} listed; the first at sample ${w.events.find((e) => e.kind === "empty")?.sample}`);
          assert.deepEqual(w.events.filter((e) => PLAIN_NEVER.test(e.kind)).map((e) => `sample ${e.sample} (${e.stage}): ${e.text}`), [], key);
        });
      }
      const others = Object.entries(counts).filter(([kind]) => kind !== "empty").map(([kind, n]) => `${kind} ${n}`).join(", ");
      console.log(`# plain ${a} to ${b}, ${mode}: ${counts.empty ?? 0} empty samples (${left} listed); not counted against it: ${others || "none"}`);
      if ((counts.empty ?? 0) < left) console.log(`# NOTICE: ${a} to ${b}, ${mode}: ${left - (counts.empty ?? 0)} fewer empty samples than listed; lower the ceilings in PLAIN_EMPTY`);
    });
  }
}

test("a cut, and a reader who asked for reduced motion, are at the last view for every moment after the first", () => {
  for (const options of [{ kind: "cut" as const }, { reduced: true }]) {
    const move = moveOf("earth", "mars", "true", 16 / 9);
    const input = { ...move.input, ...options };
    const plan = travelPlan(input);
    assert.equal(plan.kind, "cut");
    assert.deepEqual(travelPose(input, 0, plan).position, input.start.position);
    for (const t of [1e-9, 0.01, 0.5, 0.99, 1]) {
      const s = travelPose(input, t, plan);
      assert.deepEqual(s.position, input.end.position);
      assert.ok(angle(s.forward, input.end.forward) < 1e-9 && s.fov === input.end.fov && s.destination.inside);
    }
  }
});

test("the same input gives the same camera, with the plan or without it, and auto is turn-travel", () => {
  const move = moveOf("mars", "jupiter", "compressed", 1);
  const plan = travelPlan(move.input);
  for (const t of [0, 0.1, 0.37, 0.5, 0.92, 1]) {
    assert.deepEqual(travelPose(move.input, t, plan), travelPose(move.input, t));
    assert.deepEqual(travelPose({ ...move.input, kind: "auto" }, t), travelPose(move.input, t));
  }
  assert.equal(travelPlan({ ...move.input, kind: "auto" }).kind, "turn-travel");
  const shares = plan.stages.turn + plan.stages.travel + plan.stages.arrive;
  assert.ok(Math.abs(shares - 1) < 1e-12 && plan.duration >= 1200 && plan.duration <= 9000);
  assert.ok(Math.abs(travelPlan({ ...move.input, pace: 2 }).duration - plan.duration * 2) <= 1);
});

for (const kind of ["direct", "look-back"] as const) {
  test(`${kind} is a straight glide between the two views that keeps clear of every body, and its place never jumps`, () => {
    for (const [a, b] of [["earth", "mars"], ["callisto", "europa"], ["mercury", "sun"]] as [BodyId, BodyId][]) {
      for (const mode of SCALES) {
        const w = walk(moveOf(a, b, mode, 16 / 9, kind));
        row(`${a} to ${b} (${kind})`, mode, "wide", w);
        const kept = w.faults.filter((text) => /radii from the centre|jumped|not finite|first view|last view|unit vector/.test(text));
        assert.deepEqual(kept, [], `${a} to ${b}, ${mode}`);
      }
    }
  });
}

test("two views that are almost the same make a short move with no turn stage", () => {
  const move = moveOf("earth", "mars", "compressed", 16 / 9);
  const input: TravelInput = { ...move.input, destination: move.input.leaving, end: { ...move.input.start, position: [move.input.start.position[0], move.input.start.position[1] + 0.05, move.input.start.position[2]] } };
  const plan = travelPlan(input);
  assert.equal(plan.stages.turn, 0);
  assert.equal(plan.duration, 1200);
  for (let i = 0; i <= 20; i += 1) assert.ok(travelPose(input, i / 20, plan).leaving.inside);
});

test("an arrival from the side the move comes from shows at least half the body lit", () => {
  for (const mode of SCALES) {
    for (const [a, b] of PAIRS) {
      if (hostOf(b) !== undefined || b === "sun") continue;
      const sun = site("sun", mode, START).at;
      const here = site(b, mode, START);
      const view = travelArrival({ body: here.at, radius: here.radius, from: site(a, mode, START).at, sun, aspect: 1 });
      assert.ok(view.lit >= 0.5, `${a} to ${b}: ${view.lit}`);
      assert.ok(angle(sub(view.position, here.at), sub(sun, here.at)) <= 75 + 1e-6);
      assert.ok(Math.abs(length(sub(view.position, here.at)) / here.radius - 4.1) < 1e-9);
    }
  }
});

// ---- regions -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const REGIONS = SUN_REGIONS.map((region) => region.id);
/** The direction the stepping view looks along: down on the Sun from 35 degrees above the plane of the Earth's orbit, roughly. */
const LOOK: { forward: Vec3; up: Vec3 } = (() => {
  const view = regionView({ centre: [0, 0, 0], orbits: [], aspect: 1, forward: [0.2, -0.6, -0.77], up: [0, 1, 0] });
  return { forward: view.forward, up: view.up };
})();

function inFrame(view: TravelView, aspect: number, p: Vec3, margin = 1): boolean {
  const v = sub(p, view.position);
  const z = dot(v, view.forward);
  const tv = Math.tan((view.fov / 2) * RAD);
  return z > 0 && Math.abs(dot(v, cross(view.forward, view.up))) <= margin * tv * aspect * z && Math.abs(dot(v, view.up)) <= margin * tv * z;
}

test("the five stages are named in English and Japanese, each further out than the one before in both scales", () => {
  assert.deepEqual(REGIONS, ["inner-planets", "asteroid-belt", "outer-planets", "kuiper-belt", "whole-system"]);
  for (const region of SUN_REGIONS) assert.ok(region.name.en.length > 0 && region.name.ja.length > 0);
  for (const mode of SCALES) {
    const sun = site("sun", mode, START).at;
    const reaches = REGIONS.map((id) => regionView({ centre: sun, orbits: regionOrbits(id, mode, START), aspect: 1, ...LOOK }).reach);
    for (let i = 1; i < reaches.length; i += 1) assert.ok(reaches[i]! > reaches[i - 1]! * 1.2, `${mode}: ${REGIONS[i]} reaches ${reaches[i]}, ${REGIONS[i - 1]} ${reaches[i - 1]}`);
  }
});

for (const mode of SCALES) {
  test(`stepping out from the Sun through the five stages and back in, ${mode}: every orbit of a stage is in its picture and the next stage's is not, the Sun never leaves, the view never turns, the zoom goes one way`, () => {
    for (const shape of SHAPES) {
      const sun = bodyOf("sun", mode);
      const sunAt = (ms: number): Vec3 => site("sun", mode, ms).at;
      const stage = (id: (typeof REGIONS)[number], ms: number): TravelView & { reach: number } => regionView({ centre: sunAt(ms), orbits: regionOrbits(id, mode, ms), aspect: shape.aspect, ...LOOK });
      // each stage frames its own orbits and not the next one's
      for (let i = 0; i < REGIONS.length; i += 1) {
        const view = stage(REGIONS[i]!, START);
        for (const line of regionOrbits(REGIONS[i]!, mode, START)) for (const p of line) assert.ok(inFrame(view, shape.aspect, p, 1 + 1e-9), `${REGIONS[i]}, ${shape.name}: a point of its orbits is out of the picture`);
        if (i + 1 < REGIONS.length) assert.ok(regionOrbits(REGIONS[i + 1]!, mode, START).some((line) => line.some((p) => !inFrame(view, shape.aspect, p))), `${REGIONS[i]}, ${shape.name}: the next stage's orbits are all in the picture too`);
      }
      // the Sun's own view, looking the same way, then out through the stages and back
      const close: TravelView = { position: sub(sunAt(START), [LOOK.forward[0] * 4.1 * sun.radius / Math.min(1, shape.aspect), LOOK.forward[1] * 4.1 * sun.radius / Math.min(1, shape.aspect), LOOK.forward[2] * 4.1 * sun.radius / Math.min(1, shape.aspect)]), ...LOOK, fov: 35 };
      const closeEnd: TravelView = { ...close, position: [close.position[0] + sun.to![0] - sun.from[0], close.position[1] + sun.to![1] - sun.from[1], close.position[2] + sun.to![2] - sun.from[2]] };
      const steps: { name: string; from: TravelView; to: TravelView; leaving: TravelBody; destination: TravelBody }[] = [];
      const order = [null, ...REGIONS];
      for (let i = 0; i + 1 < order.length; i += 1) {
        const inner = order[i] === null ? null : order[i]!;
        const outer = order[i + 1]!;
        const near = (ms: number): TravelView & { reach?: number } => (inner === null ? (ms === START ? close : closeEnd) : stage(inner, ms));
        steps.push({ name: `out to ${outer}`, from: near(START), to: stage(outer, START + SPAN), leaving: { ...sun, reach: near(START).reach }, destination: { ...sun, reach: stage(outer, START + SPAN).reach } });
        steps.push({ name: `in from ${outer}`, from: stage(outer, START), to: near(START + SPAN), leaving: { ...sun, reach: stage(outer, START).reach }, destination: { ...sun, reach: near(START + SPAN).reach } });
      }
      for (const step of steps) {
        const input: TravelInput = { start: step.from, end: step.to, leaving: step.leaving, destination: step.destination, around: step.destination, aspect: shape.aspect };
        const w = walk({ input, bodies: [{ id: "sun", body: step.destination }] }, { shrink: false });
        row(`Sun ${step.name}`, mode, shape.name, w);
        assert.deepEqual(w.faults, [], `${step.name}, ${shape.name}`);
        assert.equal(w.path, "line");
        const out = step.name.startsWith("out");
        for (let i = 0; i <= SAMPLES; i += 1) {
          const s = w.samples[i]!;
          assert.ok(s.destination.inside && s.around!.inside, `${step.name}: the Sun left the picture at sample ${i}`);
          assert.ok(angle(s.forward, LOOK.forward) < 1e-6 && angle(s.up, LOOK.up) < 1e-6, `${step.name}: the view turned at sample ${i}`);
          if (i > 0) {
            const before = w.samples[i - 1]!.destination.radius;
            assert.ok(out ? s.destination.radius <= before * (1 + 1e-9) : s.destination.radius >= before * (1 - 1e-9), `${step.name}: the zoom went back at sample ${i}`);
          }
        }
      }
    }
  });

  test(`from Jupiter out to the outer planets and then the whole system, ${mode}: Jupiter or the Sun is always in the picture, the view never turns`, () => {
    for (const shape of SHAPES) {
      const sun = bodyOf("sun", mode);
      const jupiter = bodyOf("jupiter", mode);
      const start = { ...LOOK, fov: 35, position: sub(jupiter.from, [LOOK.forward[0] * 4.1 * jupiter.radius / Math.min(1, shape.aspect), LOOK.forward[1] * 4.1 * jupiter.radius / Math.min(1, shape.aspect), LOOK.forward[2] * 4.1 * jupiter.radius / Math.min(1, shape.aspect)]) };
      const stage = (id: (typeof REGIONS)[number], ms: number): TravelView & { reach: number } => regionView({ centre: site("sun", mode, ms).at, orbits: regionOrbits(id, mode, ms), aspect: shape.aspect, ...LOOK });
      const outer = stage("outer-planets", START + SPAN);
      const first: TravelInput = { start, end: outer, leaving: jupiter, destination: { ...sun, reach: outer.reach }, aspect: shape.aspect };
      const second: TravelInput = { start: stage("outer-planets", START), end: stage("whole-system", START + SPAN), leaving: { ...sun, reach: outer.reach }, destination: { ...sun, reach: stage("whole-system", START + SPAN).reach }, aspect: shape.aspect };
      for (const [name, input] of [["Jupiter out to outer-planets", first], ["outer-planets out to whole-system", second]] as [string, TravelInput][]) {
        const plan = travelPlan(input);
        assert.equal(plan.path, "line");
        let seenSun = false;
        let before: TravelSample | undefined;
        const w = walk({ input, bodies: [{ id: "sun", body: input.destination }, { id: "jupiter", body: jupiter }] }, { shrink: false });
        row(name, mode, shape.name, w);
        assert.deepEqual(w.faults.filter((text) => !/after the turn/.test(text)), [], `${name}, ${shape.name}`);
        for (const s of w.samples) {
          assert.ok(angle(s.forward, LOOK.forward) < 1e-6, `${name}: the view turned`);
          assert.ok(s.leaving.inside || s.destination.inside, `${name}: an empty picture`);
          if (seenSun) assert.ok(s.destination.inside, `${name}: the Sun left the picture after coming in`);
          seenSun ||= s.destination.inside;
          if (before) assert.ok(length(sub(s.position, input.destination.from)) >= length(sub(before.position, input.destination.from)) * (1 - 1e-3) || !seenSun, `${name}: the camera came back in`);
          before = s;
        }
        assert.ok(seenSun);
      }
    }
  });
}

test("the numbers, for the owner to judge the feel from", () => {
  if (process.env.TRAVEL_TABLE) console.log(`\n${rows.join("\n")}\n`);
  assert.ok(rows.length > 0);
});
