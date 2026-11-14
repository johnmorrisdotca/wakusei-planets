// The walk of a camera move without a browser, shared by the unit tests and by scripts/travel-table.ts: the bodies are where the package's own models put them on one date, the first and last views are the
// ones the space view frames, and a move is sampled at 240 moments. `walk` checks the owner's rules and reports every fault with the stage it is in; `survey` (below) walks one pair from the ten sides at the
// three picture shapes and two scales and counts the faults by kind.
import { createHash } from "node:crypto";
import { BODIES, MOONS_OF, type BodyId, type MoonId } from "../src/facts.ts";
import { moonOffset, orientation } from "../src/scene/orient.ts";
import { besideMoon, frameAt, hostOf, moonDistance, placeBodies, radiusIn, TRAVEL_CLEARANCE, travelArrival, travelPlan, travelPose, type ScaleMode, type SpaceDwarf, type SpacePlanet, type TravelBody, type TravelInput, type TravelKind, type TravelSample, type TravelView } from "../src/space/index.ts";
import { cross, dot, length, RAD, sub, unit, type Vec3 } from "../src/vec.ts";

export const SCALES: readonly ScaleMode[] = ["compressed", "true"];
export const SHAPES: readonly { name: string; aspect: number }[] = [{ name: "wide", aspect: 16 / 9 }, { name: "square", aspect: 1 }, { name: "tall", aspect: 9 / 19.5 }];
export const START = Date.UTC(2026, 10, 11, 12);
/** The clock runs through an hour while the camera moves, so every body is somewhere else at the end. */
export const SPAN = 3_600_000;
export const SAMPLES = 240;

// the stated bounds
/** A body's angular size may dip by this share between two samples once the turn is over. */
export const SHRINK = 0.005;
/** The destination's distance on the screen from its last place may grow by this much (the frame is 2 across). */
export const BACKSLIDE = 0.02;
/** The angle between the look direction and its last direction may grow by this many degrees between two samples. */
export const UNTURN = 0.05;
/** The look direction turns through no more than this many times the least angle, and 2 degrees. */
export const TURN_FACTOR = 1.25;
/** Between two samples the look direction turns by less than this many degrees... */
export const STEP_DEGREES = 6;
/** ...the destination moves by less than this much of the frame (which is 2 across)... */
export const STEP_SCREEN = 0.3;
/** ...and the camera by less than this share of the whole way. */
export const STEP_WAY = 0.06;

export const angle = (a: Vec3, b: Vec3): number => Math.atan2(length(cross(a, b)), dot(a, b)) / RAD;

/** Where a body is drawn and how big, as the space view places it. */
export function site(id: BodyId, mode: ScaleMode, ms: number): { at: Vec3; radius: number } {
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
export const bodyOf = (id: BodyId, mode: ScaleMode, span = SPAN, t0 = START): TravelBody => ({ from: site(id, mode, t0).at, to: site(id, mode, t0 + span).at, radius: site(id, mode, t0).radius });

/** The framed view at a body at a moment: beside a moon with its planet behind it, or the whole body from the side `from` is on. */
export function viewOf(id: BodyId, mode: ScaleMode, ms: number, aspect: number, from: Vec3, plain = false): TravelView {
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

export interface Move {
  input: TravelInput;
  /** Every body the path is kept clear of, by name. */
  bodies: { id: BodyId; body: TravelBody }[];
}

/** `plain` gives both views as the space view frames a body it goes to (the whole body from the side the camera is on, a moon too), not beside a moon with its planet behind it. */
export function moveOf(a: BodyId, b: BodyId, mode: ScaleMode, aspect: number, kind?: TravelKind, plain: boolean | Vec3 = false, span = SPAN, t0 = START): Move {
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

export const placeAt = (body: TravelBody, t: number): Vec3 => (body.to === undefined ? body.from : [body.from[0] + (body.to[0] - body.from[0]) * t, body.from[1] + (body.to[1] - body.from[1]) * t, body.from[2] + (body.to[2] - body.from[2]) * t]);

/** The kinds of fault the survey counts. `drift` and `empty` are the two the family move has; the rest are summed as "other". */
export type FaultKind = "drift" | "empty" | "planet" | "lost" | "shrink" | "clear" | "turn" | "step" | "up" | "numbers";
export interface FaultEvent {
  sample: number;
  stage: TravelSample["stage"];
  kind: FaultKind;
  value: number;
  text: string;
}
const KINDS: readonly [RegExp, FaultKind][] = [
  [/neither body/, "empty"], [/moved away from its place on the screen/, "drift"], [/planet circled/, "planet"], [/out of the picture after the turn/, "lost"], [/shrank/, "shrink"], [/radii from the centre/, "clear"],
  [/turned away from|degrees in one sample/, "turn"], [/in one sample|jumped \(|jumped \d/, "step"], [/up direction|unit vector/, "up"], [/not finite/, "numbers"],
];
const kindOf = (text: string): FaultKind => KINDS.find(([pattern]) => pattern.test(text))?.[1] ?? "step";

export interface Walk {
  samples: TravelSample[];
  /** What the plan says: the kind, the path, the shares of the move, its length in milliseconds, the least turn, the settle and the easing. */
  plan: { kind: string; path: string; stages: { turn: number; travel: number; arrive: number }; duration: number; turn: number; settle: number; easing: { turn: string; distance: string } };
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
  /** Every fault, not only the first six: the sample it is at, the stage the move is in there, what kind it is and (for a drift) by how much the destination moved away from its last place on the screen. */
  events: FaultEvent[];
}

/**
 * The pairs where the owner's rules cannot all hold: the last view (beside the moon, with its planet behind it; or a planet from its lit side) does not look the way the destination lies from the body left,
 * so the camera must turn to bring the destination into the picture and then turn on to the last view. For these the look direction may get this many degrees (`back`) further from its last direction than
 * the nearest it had been, and may turn through `turned` degrees in all; every other rule holds as for the rest.
 */
export const BENT: Partial<Record<string, { back: number; turned: number }>> = { "moon to titan": { back: 25, turned: 100 }, "neptune to mercury": { back: 3, turned: 200 } };

/** Walk a move and check the rules. `shrink: false` is for a pull back, where the destination is meant to shrink. */
export function walk(move: Move, options: { shrink?: boolean; bent?: { back: number; turned: number } } = {}): Walk {
  const { input } = move;
  const plan = travelPlan(input);
  const samples: TravelSample[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) samples.push(travelPose(input, i / SAMPLES, plan));
  const faults: string[] = [];
  const events: FaultEvent[] = [];
  const fault = (i: number, text: string, value = 0): void => {
    events.push({ sample: i, stage: samples[i]!.stage, kind: kindOf(text), value, text });
    if (faults.length < 6) faults.push(`sample ${i} (${samples[i]!.stage}): ${text}`);
  };
  /** A fault of the whole move, not of a sample: it is counted at the last sample. */
  const whole = (text: string, kind: FaultKind): void => {
    events.push({ sample: SAMPLES, stage: samples[SAMPLES]!.stage, kind, value: 0, text });
    faults.push(text);
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
    // 1: never an empty picture
    if (!s.leaving.inside && !s.destination.inside) fault(i, "neither body is in the picture");
    // moon to moon of one planet: the planet stays in the picture
    if (input.around && !s.around!.inside) fault(i, "the planet circled is out of the picture");
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
        if (before.destination.inside && off > offBefore + BACKSLIDE) fault(i, `the destination moved away from its place on the screen (${offBefore.toFixed(3)} to ${off.toFixed(3)})`, off - offBefore);
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
  if (options.bent ? turned > options.bent.turned : turned > TURN_FACTOR * least + 2) whole(`turned ${turned.toFixed(1)} degrees where ${least.toFixed(1)} is the least`, "turn")
  if (options.bent && back > options.bent.back) whole(`the look direction went ${back.toFixed(1)} degrees back from its last direction`, "turn")
  // 6: the ends are the two views
  const close = (a: Vec3, b: Vec3, scale: number): boolean => length(sub(a, b)) <= 1e-9 * Math.max(1, scale);
  if (!close(samples[0]!.position, input.start.position, length(input.start.position)) || angle(samples[0]!.forward, input.start.forward) > 1e-6 || samples[0]!.fov !== input.start.fov) whole("the first sample is not the first view", "step")
  if (!close(last.position, input.end.position, length(input.end.position)) || angle(last.forward, input.end.forward) > 1e-6 || angle(last.up, input.end.up) > 1e-6 || last.fov !== input.end.fov) whole("the last sample is not the last view", "step")
  return { samples, plan: { kind: plan.kind, path: plan.path, stages: plan.stages, duration: plan.duration, turn: plan.turn, settle: plan.settle, easing: plan.easing }, duration: plan.duration, path: plan.path, turnShare: plan.stages.turn, least, turned, back, settle: plan.settle, worstTurn, worstScreen, nearest, faults, events };
}

/** Where the camera comes from, as a direction from the body left: along each axis and between them. */
export const SIDES: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, 1, 1], [1, -1, -1], [-1, -1, 1]];

// ---- the survey -----------------------------------------------------------------------------------------------------------------------------------------------------------------------

type Stage = TravelSample["stage"];
/** What one kind of fault came to over the ten sides: how many sides had it, how many samples in all, the worst number, and the stage the first fault of each side started in. */
export interface KindStats {
  /** Sides (walks) with at least one fault of the kind. */
  walks: number;
  samples: number;
  /** For a drift, the most the destination moved away from its place on the screen in one sample (the frame is 2 across); for an empty picture, the longest run of samples. */
  worst: number;
  /** The stage the first fault of a side is in, counted over the sides. */
  first: Record<Stage, number>;
}
export interface Survey {
  a: BodyId;
  b: BodyId;
  mode: ScaleMode;
  shape: string;
  /** How many sides were walked. */
  sides: number;
  drift: KindStats;
  empty: KindStats;
  /** Every other fault, by kind: `kinds` says how many samples of each. */
  other: KindStats & { kinds: Partial<Record<FaultKind, number>> };
}

const statsOf = (walks: Walk[], pick: (event: FaultEvent) => boolean, measure: (events: FaultEvent[]) => number): KindStats => {
  const stats: KindStats = { walks: 0, samples: 0, worst: 0, first: { turn: 0, travel: 0, arrive: 0 } };
  for (const w of walks) {
    const events = w.events.filter(pick);
    if (events.length === 0) continue;
    stats.walks += 1;
    stats.samples += events.length;
    stats.worst = Math.max(stats.worst, measure(events));
    stats.first[events[0]!.stage] += 1;
  }
  return stats;
};
/** The longest run of neighbouring samples. */
const longestRun = (events: FaultEvent[]): number => {
  let best = 0;
  let run = 0;
  let previous = -2;
  for (const event of events) {
    run = event.sample === previous + 1 ? run + 1 : 1;
    previous = event.sample;
    best = Math.max(best, run);
  }
  return best;
};

/** Walk the move from `a` to `b` as plain views (the whole body from the side the camera comes from, a moon too) from every one of `sides`, at one scale and one picture shape, and count the faults by kind. */
export function survey(a: BodyId, b: BodyId, mode: ScaleMode, shape: { name: string; aspect: number }, sides: readonly Vec3[] = SIDES): Survey {
  const walks = sides.map((side) => walk(moveOf(a, b, mode, shape.aspect, undefined, side)));
  const other = statsOf(walks, (e) => e.kind !== "drift" && e.kind !== "empty", () => 0);
  const kinds: Partial<Record<FaultKind, number>> = {};
  for (const w of walks) for (const e of w.events) if (e.kind !== "drift" && e.kind !== "empty") kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
  return {
    a, b, mode, shape: shape.name, sides: sides.length,
    drift: statsOf(walks, (e) => e.kind === "drift", (events) => Math.max(...events.map((e) => e.value))),
    empty: statsOf(walks, (e) => e.kind === "empty", longestRun),
    other: { ...other, kinds },
  };
}

const stages = (first: Record<Stage, number>): string => `${first.turn}/${first.travel}/${first.arrive}`;
/** The table for some pairs: one line for each pair, scale and picture shape. Columns: sides with the fault / samples with it / worst number / sides whose first fault is in the turn / travel / arrive stage. */
export function surveyTable(pairs: readonly (readonly [BodyId, BodyId])[], sides: readonly Vec3[] = SIDES): string[] {
  const lines: string[] = [];
  lines.push(`${"".padEnd(22)} ${"".padEnd(10)} ${"".padEnd(6)} | drift: sides samples worst/sample  first t/t/a | empty: sides samples longest  first t/t/a | other: sides samples (kinds)`);
  for (const [a, b] of pairs) {
    for (const mode of SCALES) {
      for (const shape of SHAPES) {
        const s = survey(a, b, mode, shape, sides);
        const kinds = Object.entries(s.other.kinds).map(([kind, n]) => `${kind} ${n}`).join(", ");
        lines.push(
          `${`${a} to ${b}`.padEnd(22)} ${mode.padEnd(10)} ${shape.name.padEnd(6)} | drift: ${String(s.drift.walks).padStart(2)}/${s.sides} ${String(s.drift.samples).padStart(5)} ${s.drift.worst.toFixed(3).padStart(6)}  ${stages(s.drift.first).padEnd(7)} | empty: ${String(s.empty.walks).padStart(2)}/${s.sides} ${String(s.empty.samples).padStart(5)} ${String(s.empty.worst).padStart(4)}  ${stages(s.empty.first).padEnd(7)} | other: ${String(s.other.walks).padStart(2)}/${s.sides} ${String(s.other.samples).padStart(5)}${kinds ? ` (${kinds})` : ""}`,
        );
      }
    }
  }
  return lines;
}

// ---- the baseline ---------------------------------------------------------------------------------------------------------------------------------------------------------------------


/** A digest of the plan of a walk (the kind, the path, the shares, the length in milliseconds, the least turn, the settle, the easing) and of every sample of it (the camera, the stage and where the two bodies are in the picture, to nine decimals): two walks are the same, plan and sample for sample, when their digests are. */
export function digestOf(w: Walk): string {
  const hash = createHash("sha256");
  const r = (n: number): string => (Math.round(n * 1e9) / 1e9).toString();
  const { plan } = w;
  hash.update(`${plan.kind} ${plan.path} ${r(plan.stages.turn)} ${r(plan.stages.travel)} ${r(plan.stages.arrive)} ${plan.duration} ${r(plan.turn)} ${r(plan.settle)} ${plan.easing.turn} ${plan.easing.distance}\n`);
  for (const s of w.samples) hash.update([s.stage, ...s.position.map(r), ...s.forward.map(r), ...s.up.map(r), r(s.fov), r(s.leaving.x), r(s.leaving.y), r(s.destination.x), r(s.destination.y), s.around ? `${r(s.around.x)},${r(s.around.y)}` : "-"].join(" ") + "\n");
  return hash.digest("hex").slice(0, 16);
}

/** The moves the baseline holds: every pair of the planner's tests at three shapes and two scales as the space view frames them, and the plain views from the ten sides of the pairs below. */
export const BASELINE_PAIRS: readonly (readonly [BodyId, BodyId])[] = [
  ["mercury", "sun"], ["earth", "mars"], ["mars", "jupiter"], ["jupiter", "saturn"], ["neptune", "mercury"], ["earth", "moon"], ["moon", "earth"], ["callisto", "europa"], ["io", "ganymede"],
  ["titan", "enceladus"], ["moon", "titan"], ["oberon", "miranda"], ["pluto", "charon"], ["saturn", "titan"], ["sun", "earth"], ["phobos", "deimos"], ["triton", "proteus"],
];
export const BASELINE_PLAIN: readonly (readonly [BodyId, BodyId])[] = [
  ["mercury", "sun"], ["earth", "mars"], ["mars", "jupiter"], ["jupiter", "saturn"], ["neptune", "mercury"], ["sun", "earth"],
  ["callisto", "europa"], ["io", "ganymede"], ["titan", "enceladus"], ["oberon", "miranda"], ["phobos", "deimos"], ["triton", "proteus"],
];
export interface BaselineEntry {
  digest: string;
  /** The empty pictures the move had when the baseline was taken. */
  empty: number;
}
/** Every baseline move by name: `default a>b scale shape` and `plain a>b scale shape side`. */
export function baselineMoves(): [string, () => Move][] {
  const moves: [string, () => Move][] = [];
  for (const [a, b] of BASELINE_PAIRS) for (const mode of SCALES) for (const shape of SHAPES) moves.push([`default ${a}>${b} ${mode} ${shape.name}`, () => moveOf(a, b, mode, shape.aspect)]);
  // the other kinds, a reader who asked for reduced motion and a changed pace, on three pairs at the shapes and scales
  for (const [a, b] of [["earth", "mars"], ["mercury", "sun"], ["callisto", "europa"]] as const) {
    for (const mode of SCALES) {
      for (const shape of SHAPES) {
        for (const kind of ["direct", "look-back", "cut"] as const) moves.push([`kind ${kind} ${a}>${b} ${mode} ${shape.name}`, () => moveOf(a, b, mode, shape.aspect, kind)]);
        moves.push([`reduced ${a}>${b} ${mode} ${shape.name}`, () => { const m = moveOf(a, b, mode, shape.aspect); return { ...m, input: { ...m.input, reduced: true } }; }]);
        moves.push([`pace 2 ${a}>${b} ${mode} ${shape.name}`, () => { const m = moveOf(a, b, mode, shape.aspect); return { ...m, input: { ...m.input, pace: 2 } }; }]);
      }
    }
  }
  for (const [a, b] of BASELINE_PLAIN) for (const mode of SCALES) for (const shape of SHAPES) SIDES.forEach((side, i) => moves.push([`plain ${a}>${b} ${mode} ${shape.name} ${i}`, () => moveOf(a, b, mode, shape.aspect, undefined, side)]));
  return moves;
}

/** The furthest from the middle of the picture the nearer of the two bodies gets during the turn (1 is the edge of the picture, infinity is neither in it at some moment). */
export function turnEdge(w: Walk): number {
  const off = (x: TravelSample["leaving"]): number => (x.inside ? Math.max(Math.abs(x.x), Math.abs(x.y)) : Number.POSITIVE_INFINITY);
  let edge = 0;
  for (const s of w.samples) if (s.stage === "turn") edge = Math.max(edge, Math.min(off(s.leaving), off(s.destination)));
  return edge;
}
