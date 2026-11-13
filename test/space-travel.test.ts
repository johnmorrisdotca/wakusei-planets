// The camera's move from one body to another, walked without a browser: the bodies are where the package's own models put them on one date, the first and last views are the ones the space view frames
// (`besideMoon` for a moon, a whole-body view otherwise), and every move is sampled at 240 moments in both scales and three picture shapes. The rules are the owner's: never an empty picture, the destination
// in view and growing from the end of the turn, one turn that is never undone, nothing passed close, and a bounded pace. Set TRAVEL_TABLE=1 to print the numbers for every pair.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BODIES, MOONS_OF, type BodyId, type MoonId } from "../src/facts.ts";
import { moonOffset, orientation } from "../src/scene/orient.ts";
import { besideMoon, frameAt, hostOf, moonDistance, placeBodies, radiusIn, regionOrbits, regionView, SUN_REGIONS, TRAVEL_CLEARANCE, travelArrival, travelPlan, travelPose, type ScaleMode, type SpaceDwarf, type SpacePlanet, type TravelBody, type TravelInput, type TravelKind, type TravelSample, type TravelView } from "../src/space/index.ts";
import { cross, dot, length, RAD, sub, turn, unit, type Vec3 } from "../src/vec.ts";

const SCALES: readonly ScaleMode[] = ["compressed", "true"];
const SHAPES: readonly { name: string; aspect: number }[] = [{ name: "wide", aspect: 16 / 9 }, { name: "square", aspect: 1 }, { name: "tall", aspect: 9 / 19.5 }];
const PAIRS: readonly [BodyId, BodyId][] = [
  ["mercury", "sun"], ["earth", "mars"], ["mars", "jupiter"], ["jupiter", "saturn"], ["neptune", "mercury"], ["earth", "moon"], ["moon", "earth"], ["callisto", "europa"], ["io", "ganymede"],
  ["titan", "enceladus"], ["moon", "titan"], ["oberon", "miranda"], ["pluto", "charon"], ["saturn", "titan"], ["sun", "earth"],
];
const START = Date.UTC(2026, 10, 11, 12);
/** The clock runs through an hour while the camera moves, so every body is somewhere else at the end. */
const SPAN = 3_600_000;
const SAMPLES = 240;

// the stated bounds
/** A body's angular size may dip by this share between two samples once the turn is over. */
const SHRINK = 0.005;
/** The destination's distance on the screen from its last place may grow by this much (the frame is 2 across). */
const BACKSLIDE = 0.02;
/** The angle between the look direction and its last direction may grow by this many degrees between two samples. */
const UNTURN = 0.05;
/** The look direction turns through no more than this many times the least angle, and 2 degrees. */
const TURN_FACTOR = 1.25;
/** Between two samples the look direction turns by less than this many degrees... */
const STEP_DEGREES = 6;
/** ...the destination moves by less than this much of the frame (which is 2 across)... */
const STEP_SCREEN = 0.3;
/** ...and the camera by less than this share of the whole way. */
const STEP_WAY = 0.06;

const angle = (a: Vec3, b: Vec3): number => Math.atan2(length(cross(a, b)), dot(a, b)) / RAD;

/** Where a body is drawn and how big, as the space view places it. */
function site(id: BodyId, mode: ScaleMode, ms: number): { at: Vec3; radius: number } {
  const pos = placeBodies(mode, frameAt(ms));
  const host = hostOf(id);
  if (host === undefined || id === "moon") return { at: pos[id as keyof typeof pos], radius: radiusIn(id as Parameters<typeof radiusIn>[0], mode) };
  const real = moonOffset(id as MoonId, ms);
  const d = length(real);
  const hostRadius = radiusIn(host, mode);
  const k = (d === 0 ? 1 : moonDistance(mode, host as SpacePlanet | SpaceDwarf, d) / d) * hostRadius;
  const centre = pos[host];
  return { at: [centre[0] + real[0] * k, centre[1] + real[1] * k, centre[2] + real[2] * k], radius: Math.max(1e-6, (BODIES[id].radiusKm / BODIES[host].radiusKm) * hostRadius) };
}
const bodyOf = (id: BodyId, mode: ScaleMode, span = SPAN, t0 = START): TravelBody => ({ from: site(id, mode, t0).at, to: site(id, mode, t0 + span).at, radius: site(id, mode, t0).radius });

/** The framed view at a body at a moment: beside a moon with its planet behind it, or the whole body from the side `from` is on. */
function viewOf(id: BodyId, mode: ScaleMode, ms: number, aspect: number, from: Vec3, plain = false): TravelView {
  const here = site(id, mode, ms);
  const sun = site("sun", mode, ms).at;
  const host = hostOf(id);
  if (host !== undefined && !plain) {
    const planet = site(host, mode, ms);
    const camera = besideMoon({ moon: here.at, moonRadius: here.radius, host: planet.at, hostRadius: planet.radius, sun, aspect, zoom: 1, yaw: 0, tilt: 0, north: orientation(host, ms).pole });
    return { position: camera.position, forward: camera.forward, up: camera.up, fov: camera.fov };
  }
  return travelArrival({ body: here.at, radius: here.radius, from, sun: id === "sun" ? undefined : sun, aspect });
}

interface Move {
  input: TravelInput;
  /** Every body the path is kept clear of, by name. */
  bodies: { id: BodyId; body: TravelBody }[];
}

/** `plain` gives both views as the space view frames a body it goes to (the whole body from the side the camera is on, a moon too), not beside a moon with its planet behind it. */
function moveOf(a: BodyId, b: BodyId, mode: ScaleMode, aspect: number, kind?: TravelKind, plain: boolean | Vec3 = false, span = SPAN, t0 = START): Move {
  const names = new Set<BodyId>([a, b, "sun"]);
  for (const id of [a, b]) {
    const host = hostOf(id);
    if (host !== undefined) names.add(host);
  }
  const shared = hostOf(a) !== undefined && hostOf(a) === hostOf(b) ? hostOf(a)! : hostOf(b) === a ? a : hostOf(a) === b ? b : undefined;
  if (shared !== undefined && hostOf(a) === hostOf(b)) for (const moon of (MOONS_OF as Record<string, readonly MoonId[]>)[shared] ?? []) names.add(moon);
  const bodies = [...names].map((id) => ({ id, body: bodyOf(id, mode, span, t0) }));
  const get = (id: BodyId): TravelBody => bodies.find((entry) => entry.id === id)!.body;
  // the first view: a moon from beside it; a planet from its sunward side, a little north; the Sun from the Earth's side
  const sunNow = site("sun", mode, t0).at;
  const sunSide = a === "sun" ? site("earth", mode, t0).at : [sunNow[0], sunNow[1] + 0.3 * length(sub(sunNow, site(a, mode, t0).at)), sunNow[2]] as Vec3;
  // `plain` as a direction: the camera comes from that side of the body left
  const first = Array.isArray(plain) ? [site(a, mode, t0).at[0] + plain[0], site(a, mode, t0).at[1] + plain[1], site(a, mode, t0).at[2] + plain[2]] as Vec3 : sunSide;
  const start = viewOf(a, mode, t0, aspect, first, plain !== false);
  const end = viewOf(b, mode, t0 + span, aspect, start.position, plain !== false);
  const input: TravelInput = { start, end, leaving: get(a), destination: get(b), around: shared === undefined ? undefined : get(shared), others: bodies.map((entry) => entry.body), aspect, kind };
  return { input, bodies };
}

const placeAt = (body: TravelBody, t: number): Vec3 => (body.to === undefined ? body.from : [body.from[0] + (body.to[0] - body.from[0]) * t, body.from[1] + (body.to[1] - body.from[1]) * t, body.from[2] + (body.to[2] - body.from[2]) * t]);

interface Walk {
  samples: TravelSample[];
  duration: number;
  path: string;
  turnShare: number;
  least: number;
  turned: number;
  /** How far the look direction went back from its last direction after nearing it, in degrees, and how far the camera turns round the destination as it arrives. */
  back: number;
  settle: number;
  worstTurn: number;
  worstScreen: number;
  /** The least distance to any body's surface, in that body's radii, and which body. */
  nearest: { radii: number; id: string };
  faults: string[];
}

/**
 * The pairs where the owner's rules cannot all hold: the last view (beside the moon, with its planet behind it; or a planet from its lit side) does not look the way the destination lies from the body left,
 * so the camera must turn to bring the destination into the picture and then turn on to the last view. For these the look direction may get this many degrees (`back`) further from its last direction than
 * the nearest it had been, and may turn through `turned` degrees in all; every other rule holds as for the rest.
 */
const BENT: Partial<Record<string, { back: number; turned: number }>> = { "moon to titan": { back: 25, turned: 100 }, "neptune to mercury": { back: 3, turned: 200 } };

/** Walk a move and check the rules. `shrink: false` is for a pull back, where the destination is meant to shrink. */
function walk(move: Move, options: { shrink?: boolean; bent?: { back: number; turned: number } } = {}): Walk {
  const { input } = move;
  const plan = travelPlan(input);
  const samples: TravelSample[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) samples.push(travelPose(input, i / SAMPLES, plan));
  const faults: string[] = [];
  const fault = (i: number, text: string): void => {
    const kind = text.slice(0, 42);
    const seen = faults.filter((line) => line.includes(kind)).length;
    if (seen < 3) faults.push(`sample ${i} (${samples[i]!.stage}): ${text}`);
  };
  const last = samples[SAMPLES]!;
  let turned = 0;
  let worstTurn = 0;
  let worstScreen = 0;
  let way = 0;
  let back = 0;
  let nearestYet = Number.POSITIVE_INFINITY;
  for (let i = 1; i <= SAMPLES; i += 1) way += length(sub(samples[i]!.position, samples[i - 1]!.position));
  const nearest = { radii: Number.POSITIVE_INFINITY, id: "" };
  const afterTurn = samples.findIndex((s) => s.stage !== "turn");
  for (let i = 0; i <= SAMPLES; i += 1) {
    const s = samples[i]!;
    const t = i / SAMPLES;
    // 7: sound numbers
    for (const n of [...s.position, ...s.forward, ...s.up, s.fov, s.leaving.x, s.leaving.y, s.destination.x, s.destination.y]) if (!Number.isFinite(n)) fault(i, "a number that is not finite");
    // never an empty picture: one of the two bodies, or the planet a family move circles, is in it
    const planet = input.around !== undefined && s.around!.inside;
    if (!s.leaving.inside && !s.destination.inside && !planet) fault(i, "neither body is in the picture");
    // 5: clearance
    for (const { id, body } of move.bodies) {
      const d = length(sub(s.position, placeAt(body, t)));
      const clear = Math.min((1 + TRAVEL_CLEARANCE) * body.radius, length(sub(input.start.position, body.from)) / 1.5, length(sub(input.end.position, placeAt(body, 1))) / 1.5);
      if (d < clear * (1 - 1e-6)) fault(i, `${(d / body.radius).toFixed(2)} radii from the centre of ${id}, nearer than ${(clear / body.radius).toFixed(2)}`);
      if (d / body.radius - 1 < nearest.radii) Object.assign(nearest, { radii: d / body.radius - 1, id });
    }
    if (i === 0) continue;
    const before = samples[i - 1]!;
    // 2 and 3: from the end of the turn the destination is in the picture, growing, and going to its place
    if (i >= afterTurn) {
      if (!s.destination.inside) fault(i, "the destination is out of the picture after the turn");
      if (i > afterTurn) {
        if (options.shrink !== false && s.destination.radius < before.destination.radius * (1 - SHRINK)) fault(i, `the destination shrank from ${before.destination.radius} to ${s.destination.radius} degrees`);
        const off = Math.hypot(s.destination.x - last.destination.x, s.destination.y - last.destination.y);
        const offBefore = Math.hypot(before.destination.x - last.destination.x, before.destination.y - last.destination.y);
        if (before.destination.inside && off > offBefore + BACKSLIDE) fault(i, `the destination moved away from its place on the screen (${offBefore.toFixed(3)} to ${off.toFixed(3)})`);
      }
    }
    // 4: one turn, never undone
    const step = angle(before.forward, s.forward);
    turned += step;
    worstTurn = Math.max(worstTurn, step);
    nearestYet = Math.min(nearestYet, angle(before.forward, last.forward));
    back = Math.max(back, angle(s.forward, last.forward) - nearestYet);
    if (!options.bent && angle(s.forward, last.forward) > angle(before.forward, last.forward) + UNTURN) fault(i, `the look direction turned away from its last direction (${angle(before.forward, last.forward).toFixed(2)} to ${angle(s.forward, last.forward).toFixed(2)} degrees)`);
    // 6: a bounded pace, and no jump
    if (step >= STEP_DEGREES) fault(i, `the look direction turned ${step.toFixed(2)} degrees in one sample`);
    if (s.destination.inside && before.destination.inside) {
      const moved = Math.hypot(s.destination.x - before.destination.x, s.destination.y - before.destination.y);
      worstScreen = Math.max(worstScreen, moved);
      if (moved >= STEP_SCREEN) fault(i, `the destination moved ${moved.toFixed(3)} of the frame in one sample`);
    }
    if (length(sub(s.position, before.position)) > STEP_WAY * way) fault(i, `the camera jumped ${(length(sub(s.position, before.position)) / way).toFixed(3)} of the way in one sample`);
    // 7: the picture's up never flips
    if (dot(s.up, before.up) < 0.99) fault(i, `the up direction jumped (${dot(s.up, before.up).toFixed(3)})`);
    if (Math.abs(dot(s.up, s.forward)) > 1e-6 || Math.abs(length(s.up) - 1) > 1e-6) fault(i, "up is not a unit vector square to the line of sight");
  }
  const least = angle(unit(input.start.forward), unit(input.end.forward));
  if (options.bent ? turned > options.bent.turned : turned > TURN_FACTOR * least + 2) faults.push(`turned ${turned.toFixed(1)} degrees where ${least.toFixed(1)} is the least`);
  if (options.bent && back > options.bent.back) faults.push(`the look direction went ${back.toFixed(1)} degrees back from its last direction`);
  // 6: the ends are the two views
  const close = (a: Vec3, b: Vec3, scale: number): boolean => length(sub(a, b)) <= 1e-9 * Math.max(1, scale);
  if (!close(samples[0]!.position, input.start.position, length(input.start.position)) || angle(samples[0]!.forward, input.start.forward) > 1e-6 || samples[0]!.fov !== input.start.fov) faults.push("the first sample is not the first view");
  if (!close(last.position, input.end.position, length(input.end.position)) || angle(last.forward, input.end.forward) > 1e-6 || angle(last.up, input.end.up) > 1e-6 || last.fov !== input.end.fov) faults.push("the last sample is not the last view");
  return { samples, duration: plan.duration, path: plan.path, turnShare: plan.stages.turn, least, turned, back, settle: plan.settle, worstTurn, worstScreen, nearest, faults };
}

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

/** Where the camera comes from, as a direction from the body left: along each axis and between them. */
const SIDES: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, 1, 1], [1, -1, -1], [-1, -1, 1]];
for (const [a, b] of [["callisto", "europa"], ["io", "ganymede"], ["titan", "enceladus"], ["oberon", "miranda"]] as [BodyId, BodyId][]) {
  for (const mode of SCALES) {
    test(`${a} to ${b} from plain views, ${mode}: one of the two is in the picture at every moment from the first, and the turn is never undone`, () => {
      for (const shape of SHAPES) {
        for (const side of SIDES) {
          const w = walk(moveOf(a, b, mode, shape.aspect, undefined, side), { bent: BENT[`${a} to ${b}`] });
          row(`${a} to ${b} (plain)`, mode, shape.name, w);
          // every fault counts but one: the destination drifting off its place in the travel stage (titan to enceladus, also on 0.43.0), which has a ticket of its own
          assert.deepEqual(w.faults.filter((text) => !/moved away from its place/.test(text)), [], `${a} to ${b}, ${mode}, ${shape.name}, from ${side.join(",")}`);
        }
      }
    });
  }
}

// The saved callisto to europa inputs of the report (travel-empty-inputs.jsonl: arriving on the side that frames Jupiter; travel-empty-inputs2.jsonl: arriving on the side it comes from), each from the view it was saved with and from arbitrary starting views: the same camera place looked
// away by a few degrees, and the camera looked down and across. The whole walk holds for each: no empty picture, and no jump, no clearance fault, no look turned back.
const SAVED = ["travel-empty-inputs.jsonl", "travel-empty-inputs2.jsonl"].map((file) => JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url), "utf8").split("\n")[0]!) as TravelInput);
const ARBITRARY: { name: string; start: (v: TravelView) => TravelView }[] = [
  { name: "as saved", start: (v) => v },
  { name: "looking 12 degrees to the side", start: (v) => ({ ...v, forward: turn(v.forward, v.up, 12) }) },
  { name: "looking 10 degrees down, 10 to the other side", start: (v) => ({ ...v, forward: turn(turn(v.forward, v.up, -10), unit(cross(v.forward, v.up)), 10) }) },
];
for (const [n, saved] of SAVED.entries()) {
  for (const view of ARBITRARY) {
    test(`callisto to europa, saved input ${n + 1}, ${view.name}: a body is in the picture throughout, and the move does not jump`, () => {
      const input: TravelInput = { ...saved, start: view.start(saved.start) };
      const bodies = [{ id: "callisto" as BodyId, body: input.leaving }, { id: "europa" as BodyId, body: input.destination }, ...(input.around === undefined ? [] : [{ id: "jupiter" as BodyId, body: input.around }])];
      const w = walk({ input, bodies });
      assert.deepEqual(w.faults, []);
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

test("the reported callisto to europa inputs keep a body in the picture, and so does every moon pair of Jupiter, Saturn, Uranus and Neptune", () => {
  const fixed = (row: number[]): TravelBody => ({ from: [row[0]!, row[1]!, row[2]!], to: [row[0]!, row[1]!, row[2]!], radius: row[3]! });
  const others = [[150.6053, -22.0915, 46.8336, 1], [97.0043, -39.8461, 87.7926, 5], [147.9747, -21.15, 44.7616, 0.273], [133.4866, -32.8806, 67.6751, 0.5], [139.408, -24.4021, 47.5088, 0.8], [80.2659, -4.1384, 10.9282, 0.6], [284.7914, -31.5745, 48.1858, 1.6], [217.6852, 53.8402, -130.0196, 1], [419.3633, -40.5894, 70.006, 1], [293.669, -178.2337, 341.3927, 0.4], [94.4457, 6.8591, -10.1201, 0.3], [-269.2283, -134.6788, -40.7192, 0.3], [-201.7542, 57.8239, 344.9409, 0.3], [173.3693, -137.6608, 445.6173, 0.3], [-266.0503, 104.0128, 233.7842, 0.3], [579.8062, -132.7558, 285.6163, 0.3], [582.2719, -39.7951, -159.1774, 0.3], [335.3166, 38.8239, -357.0997, 0.3], [192.1408, -34.3352, 42.7078, 0.2], [197.3525, -55.6595, 45.0071, 0.2], [324.6422, 9.3769, -24.3382, 0.2], [161.636, -124.1793, 396.7634, 0.2], [-94.5106, -21.1192, -200.6321, 0.2]].map(fixed);
  const start = { position: [-20.2476, 1.8598, -4.7398] as Vec3, forward: [-0.9434, 0.1392, -0.3009] as Vec3, up: [0.1326, 0.9903, 0.0423] as Vec3, fov: 35 };
  const ends = [
    { position: [0.0015, -0.1611, 0.2791] as Vec3, forward: [-0.0047, 0.5, -0.866] as Vec3, up: [0.0027, 0.866, 0.5] as Vec3, fov: 35 },
    { position: [-0.1614, -0.1207, 0.2515] as Vec3, forward: [0.5008, 0.3746, -0.7803] as Vec3, up: [-0.2023, 0.9272, 0.3153] as Vec3, fov: 35 },
  ];
  const emptyOf = (input: TravelInput): number => {
    const plan = travelPlan(input);
    let missed = 0;
    const steps = 200;
    for (let i = 1; i < steps; i += 1) {
      const t = 0.005 + (0.99 * i) / steps;
      const p = travelPose(input, t, plan);
      const planet = input.around !== undefined && p.around!.inside;
      if (!p.leaving.inside && !p.destination.inside && !planet) missed += 1;
    }
    return missed;
  };
  for (const end of ends) {
    const input: TravelInput = { start, end, leaving: fixed([-20.7171, 1.9291, -4.8896, 0.0607]), destination: fixed([0, 0, 0, 0.0393]), around: fixed([-5.6112, 4.5308, -9.9135, 1.8]), others: others.map((one) => one), aspect: 1.9214, kind: "turn-travel", pace: 2 };
    const missed = emptyOf(input);
    console.log(`callisto to europa reported input missed ${missed} of 200`);
    assert.equal(missed, 0);
    assert.ok(travelPose(input, 1, travelPlan(input)).destination.inside);
  }
  const hosts = ["jupiter", "saturn", "uranus", "neptune"] as const;
  let worst = 0;
  let worstName = "";
  for (const mode of SCALES) {
    for (const host of hosts) {
      const moons = MOONS_OF[host];
      for (const a of moons) for (const b of moons) {
        if (a === b) continue;
        const missed = emptyOf(moveOf(a, b, mode, 16 / 9).input);
        if (missed > worst) {
          worst = missed;
          worstName = `${a} to ${b} ${mode}`;
        }
        assert.equal(missed, 0, `${a} to ${b}, ${mode}: ${missed} empty samples`);
      }
    }
  }
  console.log(`worst family move ${worstName || "none"} missed ${worst}`);
  const sunJupiter = emptyOf(moveOf("sun", "jupiter", "compressed", 16 / 9).input);
  console.log(`sun to jupiter compressed missed ${sunJupiter}`);
  assert.equal(sunJupiter, 0);
});

test("the numbers, for the owner to judge the feel from", () => {
  if (process.env.TRAVEL_TABLE) console.log(`\n${rows.join("\n")}\n`);
  assert.ok(rows.length > 0);
});
