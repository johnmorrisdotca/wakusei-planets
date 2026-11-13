// The camera's move from one body to another, as one pure function of time: the two views and the bodies' places in, the camera at any moment out. No clock, no DOM, no state, so a test can walk the
// whole move without a browser. The move is the one a camera operator makes: TURN (or back up) beside the body being left until the destination is in the picture, APPROACH it in a straight line with it
// in view the whole way, and ARRIVE by settling it into its framed view.
//
// How the path is built (`turn-travel`, the default):
//   1. The turn pivots about one body, which is held in the picture by its place on the screen and its distance: the body being left, or the planet when both ends are of one planet's family (`around`).
//      The look direction swings along the one shortest arc from the first view's to the last view's, and the roll about it is spread evenly, so no turn is made that is not needed and none is undone.
//   2. Where the last view's own direction can see the destination from beside the pivot, the whole turn is made there and the rest is one straight line with the camera's direction fixed: whatever is in
//      the picture at both ends of a straight line stays in it between them, so the destination, and its planet for a moon, never leave.
//   3. Where it cannot (the last view looks at the destination from another side), the turn stops with the destination just inside the picture, the camera goes straight at it, and the rest of the turn
//      is made round the destination over the last stretch, with the destination held in the picture by its place on the screen.
//   4. Distance goes geometrically: the camera leaves at a speed in proportion to how near the body left is and arrives at one in proportion to how near the destination is, so both are slow and the
//      middle is fast, whatever the scale. Turning is eased on its own.
//   5. Every place is then kept clear of every body by a shell round it that the path slides over.
//
// The awkward cases, by name:
//   - the destination directly behind the body being left, or the two in one direction: the pivot puts the body left to one side, backing up until the straight line to the destination clears it;
//   - the destination is the Sun, or a planet that is a point until the last stretch (the true scale): its place on the screen is reported at every moment, so a marker can stand for it;
//   - the camera starts inside a beside-a-moon view: the moon, or its planet for a move within the planet's family, is the pivot;
//   - the two views almost the same: no turn stage, a short move;
//   - a view of a region (a set of orbits round a body): a straight pull back or push in with no turn of its own.
import { add, cross, dot, length, RAD, scale, sub, unit, type Vec3 } from "../vec.ts";

/**
 * How a move is made. The names and their order are the same as `Transition` in `glide.ts` (the list the space view's `transition` takes), so one value serves both: `turn-travel` (the default: turn or back
 * up until the destination is in the picture, approach it directly, settle), `direct` (a straight glide with a slow launch, turning evenly on the way), `look-back` (the same straight glide, watching the body
 * being left and turning to the destination over the last part), `auto` (`turn-travel`, which already goes straight at a destination that is in view) and `cut` (the last view at once).
 *
 * @example
 * ```ts
 * import type { TravelKind } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const kind: TravelKind = "turn-travel";
 * console.log(kind);
 * ```
 */
export type TravelKind = "turn-travel" | "direct" | "look-back" | "auto" | "cut";

/**
 * How near a move may come to a body, in that body's radii above its surface: 1, so a body passed is never more than 60 degrees across. A move that starts or ends nearer than one and a half times that keeps two thirds of the nearer distance.
 *
 * @example
 * ```ts
 * import { TRAVEL_CLEARANCE } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(TRAVEL_CLEARANCE);
 * ```
 */
export const TRAVEL_CLEARANCE = 1;

/**
 * A camera: where it is, the unit vectors it looks along and has up in the picture, and its vertical field of view in degrees. The same four as `besideMoon` and `ridePose` give.
 *
 * @example
 * ```ts
 * import type { TravelView } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const view: TravelView = { position: [0, 0, 4.1], forward: [0, 0, -1], up: [0, 1, 0], fov: 35 };
 * console.log(view.fov);
 * ```
 */
export interface TravelView {
  position: Vec3;
  forward: Vec3;
  up: Vec3;
  fov: number;
}

/**
 * A body of a move: where it is when the move starts (`from`) and when it ends (`to`, the same place when left out), and its radius, all in the scene's unit for the scale in use. Places are given at the two
 * ends, not as a function, so the input is plain data and the same input always gives the same camera; between the ends a body goes in a straight line, which over the seconds of a move is its orbit to well
 * under a pixel. `reach` marks a view of a region round the body (the radius of the outermost orbit in the picture).
 *
 * @example
 * ```ts
 * import type { TravelBody } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const moon: TravelBody = { from: [60.3, 0, 0], to: [60.3, 0, 0.01], radius: 0.273 };
 * console.log(moon.radius);
 * ```
 */
export interface TravelBody {
  from: Vec3;
  to?: Vec3;
  radius: number;
  /** Set for a view of a region round this body, from `regionView`: how far out the region goes. The move is then a straight pull back or push in. */
  reach?: number;
}

/**
 * What `travelPose` and `travelPlan` are asked: the camera now (`start`) and the framed view to end in (`end`, worked out for the destination's place at the end of the move), the body being left and the
 * destination, the planet when both are of one planet's family, any other body to keep clear of, and the picture's width over its height.
 *
 * @example
 * ```ts
 * import type { TravelInput } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const input: TravelInput = {
 *   start: { position: [0, 0, 4.1], forward: [0, 0, -1], up: [0, 1, 0], fov: 35 },
 *   end: { position: [300, 0, 1], forward: [1, 0, -0.2], up: [0, 1, 0], fov: 35 },
 *   leaving: { from: [0, 0, 0], radius: 1 },
 *   destination: { from: [303, 0, 0.4], radius: 0.5 },
 *   aspect: 16 / 9,
 * };
 * console.log(input.aspect.toFixed(2));
 * ```
 */
export interface TravelInput {
  start: TravelView;
  end: TravelView;
  /** The body the camera is at when the move starts. */
  leaving: TravelBody;
  /** The body the move goes to. For a view of a region, the body at its middle, with `reach`. */
  destination: TravelBody;
  /** The planet, when both ends are of one planet's family (two of its moons, or the planet and one of its moons; pass the planet itself then): the camera circles it and it stays in the picture the whole way. */
  around?: TravelBody;
  /** Any other body the path could pass: the Sun, the planets, the Moon, the dwarf planets and the small bodies of the view, as they go by their `to`. They are only kept clear of. */
  others?: readonly TravelBody[];
  /** The picture's width over its height. */
  aspect: number;
  /** How to move: `turn-travel` when left out. */
  kind?: TravelKind;
  /** True for a reader who asked for reduced motion: the move is a `cut` whatever `kind` says. */
  reduced?: boolean;
  /** Scales the suggested length of the move: 2 is twice as slow. 1 when left out. */
  pace?: number;
  /** How near the path may come to a body, in its radii above its surface: `TRAVEL_CLEARANCE` when left out. */
  clearance?: number;
}

/**
 * Where a body is in the picture at one moment: `inside` when its centre (the place of its marker) is within the frame, `x` and `y` from -1 at the left and bottom edges to 1 at the right and top, and `radius`,
 * its angular radius in degrees. A body behind the camera is not inside, and its `x` and `y` say which side it is off.
 *
 * @example
 * ```ts
 * import type { TravelSight } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const marker = (sight: TravelSight): string => (sight.inside ? `${(50 + 50 * sight.x).toFixed(0)}% across` : "off the picture");
 * console.log(marker({ inside: true, x: 0.2, y: 0, radius: 0.01 }));
 * ```
 */
export interface TravelSight {
  inside: boolean;
  x: number;
  y: number;
  radius: number;
}

/**
 * The camera at one moment of a move, with the stage the move is in and where the two bodies (and the planet circled, when one was given) are in the picture, so a page can mark a body too small to see.
 *
 * @example
 * ```ts
 * import type { TravelSample } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const say = (sample: TravelSample): string => `${sample.stage}: destination ${sample.destination.inside ? "in" : "out of"} the picture`;
 * console.log(typeof say);
 * ```
 */
export interface TravelSample extends TravelView {
  stage: "turn" | "travel" | "arrive";
  leaving: TravelSight;
  destination: TravelSight;
  around?: TravelSight;
}

/**
 * What `travelPlan` works out: the way the move is made, the share of its time each stage takes (they add up to 1), how long it should last in milliseconds (from how far the picture turns and how many times
 * over the distances change, never under 1200 or over 9000 before `pace`; a page may use any length of its own), the angle the look direction turns through in degrees, and how each stage is eased.
 * `route` is the worked-out path for `travelPose`: hand the plan back to it to save working it out at every frame.
 *
 * @example
 * ```ts
 * import type { TravelPlan } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const seconds = (plan: TravelPlan): string => (plan.duration / 1000).toFixed(1);
 * console.log(typeof seconds);
 * ```
 */
export interface TravelPlan {
  /** What the move really is: `auto` reads `turn-travel`, and a reduced move reads `cut`. */
  kind: Exclude<TravelKind, "auto">;
  /** `pivot` (turn beside the body left, then go), `circle` (round the planet of one family), `line` (one straight line), `cut`. */
  path: "pivot" | "circle" | "line" | "cut";
  stages: { turn: number; travel: number; arrive: number };
  duration: number;
  /** The angle between the first and the last look directions, in degrees: the least any move must turn. */
  turn: number;
  /** Turning follows a smooth step of its stage's time; distance grows geometrically out of the start and shrinks geometrically into the end, under a smooth step of the time. */
  easing: { turn: "smooth-step"; distance: "geometric" };
  /** The angle the camera turns round the destination as it arrives, in degrees: 0 when the whole turn is made before the way on. */
  settle: number;
  /** The path itself, for `travelPose`. */
  route: unknown;
}

// ---- small tools ----------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** A camera's direction: the unit vectors it looks along and has up, square to each other. */
interface Facing {
  f: Vec3;
  u: Vec3;
}
/** The tangents of half the picture across and up. */
interface Frame {
  th: number;
  tv: number;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
/** Slow out, fast between, slow in, with no jerk at either end. */
const ease = (x: number): number => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const smooth = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const placeOf = (body: TravelBody, t: number): Vec3 => (body.to === undefined ? body.from : mix(body.from, body.to, clamp01(t)));
const angleOf = (a: Vec3, b: Vec3): number => Math.atan2(length(cross(a, b)), dot(a, b));

/** `v` turned about the unit vector `axis` by `angle` radians. */
function spin(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(axis, v);
  const d = dot(axis, v) * (1 - c);
  return [v[0] * c + kv[0] * s + axis[0] * d, v[1] * c + kv[1] * s + axis[1] * d, v[2] * c + kv[2] * s + axis[2] * d];
}

/** Any unit vector square to `f`. */
function squareTo(f: Vec3): Vec3 {
  const pick: Vec3 = Math.abs(f[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return unit(sub(pick, scale(f, dot(pick, f))));
}

function facingOf(view: TravelView): Facing {
  const f = length(view.forward) < 1e-12 ? ([0, 0, -1] as Vec3) : unit(view.forward);
  const across = sub(view.up, scale(f, dot(view.up, f)));
  return { f, u: length(across) < 1e-9 ? squareTo(f) : unit(across) };
}

/** A vector of the scene in the camera's own axes: x to the picture's right, y up, z along the line of sight. */
function toCamera(o: Facing, w: Vec3): Vec3 {
  return [dot(w, cross(o.f, o.u)), dot(w, o.u), dot(w, o.f)];
}
function toScene(o: Facing, v: Vec3): Vec3 {
  const r = cross(o.f, o.u);
  return [r[0] * v[0] + o.u[0] * v[1] + o.f[0] * v[2], r[1] * v[0] + o.u[1] * v[1] + o.f[1] * v[2], r[2] * v[0] + o.u[2] * v[1] + o.f[2] * v[2]];
}

const frameOf = (fov: number, aspect: number): Frame => {
  const tv = Math.tan((Math.min(170, Math.max(1, fov)) / 2) * RAD);
  return { th: tv * Math.max(1e-3, aspect), tv };
};
/** A field of view between two, even in the size things are drawn at. */
const fovBetween = (a: number, b: number, t: number): number => (a === b ? a : (2 * Math.atan(Math.tan((a / 2) * RAD) + (Math.tan((b / 2) * RAD) - Math.tan((a / 2) * RAD)) * t)) / RAD);

const within = (v: Vec3, frame: Frame, margin: number): boolean => v[2] > 0 && Math.abs(v[0]) <= margin * frame.th * v[2] && Math.abs(v[1]) <= margin * frame.tv * v[2];

/** The direction inside the picture (by `margin` of its half width and height) nearest to `v`, in the camera's axes. */
function intoFrame(v: Vec3, frame: Frame, margin: number): Vec3 {
  const mh = margin * frame.th;
  const mv = margin * frame.tv;
  if (v[2] > 1e-9 * (Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]))) return unit([Math.min(mh, Math.max(-mh, v[0] / v[2])), Math.min(mv, Math.max(-mv, v[1] / v[2])), 1]);
  // beside or behind the camera: the edge on the side it is off
  const k = Math.max(Math.abs(v[0]) / mh, Math.abs(v[1]) / mv);
  return k < 1e-12 ? unit([mh, 0, 1]) : unit([v[0] / k, v[1] / k, 1]);
}

/** One direction turned to another along the shortest arc. */
function arc(a: Vec3, b: Vec3, t: number): Vec3 {
  const angle = angleOf(a, b);
  if (angle < 1e-9) return a;
  const axis = cross(a, b);
  return spin(a, length(axis) < 1e-9 ? squareTo(a) : unit(axis), angle * t);
}

/** A turn from one facing to another: the look direction along the shortest arc, then the roll about it that is left, both spread evenly. */
interface Swing {
  from: Facing;
  axis: Vec3;
  angle: number;
  roll: number;
}
function swingOf(a: Facing, b: Facing): Swing {
  const c = cross(a.f, b.f);
  const angle = angleOf(a.f, b.f);
  // looking the opposite way has no shortest arc: turn about the picture's own up, as a head turns
  const axis = length(c) < 1e-9 ? a.u : unit(c);
  const carried = spin(a.u, axis, angle);
  return { from: a, axis, angle: angle < 1e-9 ? 0 : angle, roll: Math.atan2(dot(cross(carried, b.u), b.f), dot(carried, b.u)) };
}
function swingAt(s: Swing, t: number): Facing {
  const f = unit(spin(s.from.f, s.axis, s.angle * t));
  const carried = spin(s.from.u, s.axis, s.angle * t);
  const rolled = spin(carried, f, s.roll * t);
  return { f, u: unit(sub(rolled, scale(f, dot(rolled, f)))) };
}
const swingDegrees = (s: Swing): number => (s.angle + Math.abs(s.roll)) / RAD;

/** The nearest point to `p` that is inside two pictures at once: the pivot inside the frame (`fv`), and the camera backed off from the last view inside the frame (`fb`, about `apex`). Dykstra's projections on the eight planes. */
function project(p: Vec3, apex: Vec3, fv: Frame, mv: number, fb: Frame, mb: number): Vec3 {
  const planes: { n: Vec3; c: number }[] = [];
  const cone = (frame: Frame, margin: number, at: Vec3): void => {
    for (const n of [[1, 0, -margin * frame.th], [-1, 0, -margin * frame.th], [0, 1, -margin * frame.tv], [0, -1, -margin * frame.tv]] as Vec3[]) {
      const nn = unit(n);
      planes.push({ n: nn, c: dot(nn, at) });
    }
  };
  cone(fv, mv, [0, 0, 0]);
  cone(fb, mb, apex);
  const kept: Vec3[] = planes.map(() => [0, 0, 0]);
  let x = p;
  for (let round = 0; round < 80; round += 1) {
    for (let i = 0; i < planes.length; i += 1) {
      const y = add(x, kept[i]!);
      const over = dot(planes[i]!.n, y) - planes[i]!.c;
      const next = over > 0 ? sub(y, scale(planes[i]!.n, over)) : y;
      kept[i] = sub(y, next);
      x = next;
    }
  }
  return x;
}

/** How near the straight way from `a` to `b` comes to `x`. */
function missOf(a: Vec3, b: Vec3, x: Vec3): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 < 1e-30 ? 0 : clamp01(dot(sub(x, a), ab) / l2);
  return length(sub(x, add(a, scale(ab, t))));
}

/** Directions inside the picture to try for the pivot, nearest to `first` first. */
function spots(first: Vec3, frame: Frame, margin: number): Vec3[] {
  const grid: Vec3[] = [];
  for (const i of [-1, -0.5, 0, 0.5, 1]) for (const j of [-1, -0.5, 0, 0.5, 1]) grid.push(unit([i * margin * frame.th, j * margin * frame.tv, 1]));
  grid.sort((a, b) => angleOf(a, first) - angleOf(b, first));
  return [first, ...grid];
}

/** Distance left to go, of `l`, at `q` from 0 to 1: it grows geometrically out of the start (from a length `ea`) and shrinks geometrically into the end (to a length `eb`), so both are slow and the middle is fast. */
function leftOf(q: number, l: number, ea: number, eb: number): number {
  if (l <= 0) return 0;
  const gone = (ea * Math.expm1(q * Math.log1p(l / ea))) / l;
  const left = (eb * Math.expm1((1 - q) * Math.log1p(l / eb))) / l;
  const m = smooth(q);
  return l * ((1 - m) * (1 - gone) + m * left);
}

// ---- the route ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** The turn: the pivot held by its place in the picture (`u0` to `u1`, in the camera's axes) and its distance (`d0` to `d1`, lifted by `lift` in the middle), while the camera turns. */
interface Turn {
  pivot: TravelBody;
  swing: Swing;
  u0: Vec3;
  u1: Vec3;
  d0: number;
  d1: number;
  lift: number;
  fov0: number;
  fov1: number;
  /** Where the camera starts near the body left and the pivot is far off: the turn begins as a turn about that body (kept at `u`, `d` away, backing off to `far` times that) and gives way to the pivot's circle over the first `q` of the turn. */
  hold?: { body: TravelBody; u: Vec3; d: number; q: number; far: number };
}
/** The way on, from the camera's place relative to the body `about`: a straight `line`, or straight at the body and then round it (`swing`). */
interface Leg {
  about: TravelBody;
  type: "line" | "swing";
  swing: Swing;
  fov0: number;
  fov1: number;
  /** line: the offsets from `about` at the two ends. */
  from: Vec3;
  to: Vec3;
  /** swing: the distance and the place in the picture of `about` at the two ends, and the distance the turn round it starts at. */
  d0: number;
  d1: number;
  dn: number;
  u0: Vec3;
  u1: Vec3;
  l: number;
  ea: number;
  eb: number;
  /** look-back: watch this body until the last part. */
  watch?: TravelBody;
}
interface Route {
  cut: boolean;
  turn: Turn | null;
  /** The share of the time the turn takes, and the moment the arrival starts. */
  share: number;
  arrive: number;
  leg: Leg;
  shells: { body: TravelBody; clear: number }[];
  frameAspect: number;
  input: TravelInput;
}

const LOOK_BACK_TURN = 0.4;

function turnAt(turn: Turn, p: number, t: number): { position: Vec3; o: Facing; fov: number } {
  const o = swingAt(turn.swing, p);
  // the lift is early: the camera backs off as it starts to turn, so the body left goes into the picture, not out of its side
  const w = Math.sqrt(p);
  const d = Math.exp(Math.log(turn.d0) + (Math.log(turn.d1) - Math.log(turn.d0)) * p + turn.lift * 4 * w * (1 - w));
  const position = sub(placeOf(turn.pivot, t), scale(toScene(o, arc(turn.u0, turn.u1, p)), d));
  if (turn.hold === undefined) return { position, o, fov: fovBetween(turn.fov0, turn.fov1, p) };
  // the turn about the body left, kept where it was in the picture, handing over to the circle of the pivot
  const near = sub(placeOf(turn.hold.body, t), scale(toScene(o, turn.hold.u), turn.hold.d * (1 + (turn.hold.far - 1) * smooth(p / turn.hold.q))));
  return { position: mix(near, position, smooth(p / turn.hold.q)), o, fov: fovBetween(turn.fov0, turn.fov1, p) };
}

function legAt(leg: Leg, q: number, t: number): { position: Vec3; o: Facing; fov: number } {
  const centre = placeOf(leg.about, t);
  if (leg.type === "line") {
    const left = leftOf(q, leg.l, leg.ea, leg.eb);
    const position = add(centre, leg.l <= 0 ? leg.to : add(leg.to, scale(sub(leg.from, leg.to), left / leg.l)));
    let o = swingAt(leg.swing, q);
    if (leg.watch) {
      // look-back: turn to the body being left, hold it, and turn to the last view over the last part
      const toBody = sub(placeOf(leg.watch, t), position);
      const held = length(toBody) < 1e-12 ? leg.swing.from : swingAt(swingOf(leg.swing.from, { f: unit(toBody), u: leg.swing.from.u }), 1);
      const watching = swingAt(swingOf(leg.swing.from, held), smooth(q / 0.15));
      o = swingAt(swingOf(watching, swingAt(leg.swing, 1)), smooth((q - (1 - LOOK_BACK_TURN)) / LOOK_BACK_TURN));
    }
    return { position, o, fov: fovBetween(leg.fov0, leg.fov1, q) };
  }
  const d = leg.l > 0 ? leg.d1 + leftOf(q, leg.l, leg.ea, leg.eb) : Math.exp(Math.log(leg.d0) + (Math.log(leg.d1) - Math.log(leg.d0)) * q);
  const k = leg.l > 0 && leg.dn > leg.d1 * 1.0001 ? smooth(Math.log(leg.dn / d) / Math.log(leg.dn / leg.d1)) : q;
  const o = swingAt(leg.swing, k);
  return { position: sub(centre, scale(toScene(o, arc(leg.u0, leg.u1, k)), d)), o, fov: fovBetween(leg.fov0, leg.fov1, k) };
}

/** A place kept clear of every body: inside one and a half times a body's clear distance the place is moved out along the line from the body's centre, smoothly, so a path slides over a shell and never goes in. */
function clearOf(route: Route, position: Vec3, t: number): Vec3 {
  let p = position;
  for (const { body, clear } of route.shells) {
    if (clear <= 0) continue;
    const centre = placeOf(body, t);
    const away = sub(p, centre);
    const d = length(away);
    if (d >= 1.5 * clear) continue;
    const out = d < 1e-12 ? squareTo(route.leg.swing.from.f) : scale(away, 1 / d);
    // from the clear distance at the centre to one and a half of it, where it meets the untouched path with no corner
    p = add(centre, scale(out, clear + (4 * d * d * d) / (27 * clear * clear)));
  }
  return p;
}

function along(route: Route, t: number): { position: Vec3; o: Facing; fov: number; stage: "turn" | "travel" | "arrive" } {
  const inTurn = route.turn !== null && t < route.share;
  const at = inTurn ? turnAt(route.turn!, ease(t / route.share), t) : legAt(route.leg, ease(route.share >= 1 ? 1 : (t - route.share) / (1 - route.share)), t);
  return { position: clearOf(route, at.position, t), o: at.o, fov: at.fov, stage: inTurn ? "turn" : t < route.arrive ? "travel" : "arrive" };
}

function sightOf(body: TravelBody, t: number, position: Vec3, o: Facing, frame: Frame): TravelSight {
  const v = toCamera(o, sub(placeOf(body, t), position));
  const d = length(v);
  const z = Math.abs(v[2]) < 1e-12 * Math.max(1, d) ? 1e-12 * Math.max(1, d) : Math.abs(v[2]);
  const x = v[0] / (z * frame.th);
  const y = v[1] / (z * frame.tv);
  return { inside: v[2] > 0 && Math.abs(x) <= 1 && Math.abs(y) <= 1, x, y, radius: d <= body.radius ? 90 : Math.asin(body.radius / d) / RAD };
}

/** The pivot's stand at the end of the turn, for a moment `tm` of the move. */
function standAt(input: TravelInput, tm: number, family: boolean): { turn: Turn; leg: Leg } {
  const o0 = facingOf(input.start);
  const o1 = facingOf(input.end);
  const clearance = input.clearance ?? TRAVEL_CLEARANCE;
  const pivot = family ? input.around! : input.leaving;
  const b = placeOf(input.destination, tm);
  const v = placeOf(pivot, tm);
  const e1 = sub(input.end.position, placeOf(input.destination, 1));
  const d1 = Math.max(1e-12, length(e1));
  const last = add(b, e1);
  const fromPivot = sub(pivot.from, input.start.position);
  const d0 = Math.max(1e-12, length(fromPivot));
  const u0 = unit(toCamera(o0, fromPivot));
  const frame0 = frameOf(input.start.fov, input.aspect);
  const frame1 = frameOf(input.end.fov, input.aspect);
  const whole = swingOf(o0, o1);
  const still = swingOf(o1, o1);
  const tries = [1, 1.6, 2.5, 4, 6.5];

  // the whole turn at the pivot, then one straight line: the camera backs off from the last view inside its own picture, to a place that sees the pivot too
  const apex = toCamera(o1, sub(v, last));
  const first = intoFrame(toCamera(o1, toScene(o0, u0)), frame1, 0.85);
  let straight: Vec3 | null = null;
  let fallback: Vec3 | null = null;
  // first choice: back off along the line of sight to the destination, so it keeps its place on the screen all the way in
  const sight = unit(toCamera(o1, scale(e1, -1)));
  const lines: Vec3[] = [];
  for (const far of tries) {
    const along = dot(apex, sight);
    const root = along * along - dot(apex, apex) + far * d0 * (far * d0);
    if (root >= 0 && Math.sqrt(root) - along > 0) lines.push(add(apex, scale(sight, Math.sqrt(root) - along)));
  }
  search: for (const far of tries) {
    for (const spot of [...(far === tries[0] ? lines : []), ...spots(first, frame1, 0.85)]) {
      const fixed = lines.includes(spot);
      const wanted = fixed ? spot : scale(spot, far * d0);
      const p = fixed ? spot : project(wanted, apex, frame1, 0.9, frame1, 0.8);
      if (!fixed) fallback ??= p;
      const size = length(p);
      if (size < 1e-12 || (!family && length(sub(p, wanted)) > 0.4 * far * d0)) continue;
      const stand = sub(v, toScene(o1, p));
      if (!within(p, frame1, 0.93) || !within(toCamera(o1, sub(b, stand)), frame1, 0.93)) continue;
      const need = Math.min(1.52 * (1 + clearance) * pivot.radius, 0.9 * size, 0.98 * length(apex));
      if (missOf(stand, last, v) < need) continue;
      straight = p;
      break search;
    }
  }
  if (straight === null && family) straight = fallback;
  if (straight !== null) {
    const dm = Math.max(1e-12, length(straight));
    const stand = sub(v, toScene(o1, straight));
    const from = sub(stand, b);
    const l = length(sub(e1, from));
    const leaving = placeOf(input.leaving, tm);
    return {
      turn: { pivot, swing: whole, u0, u1: scale(straight, 1 / dm), d0, d1: dm, lift: 0, fov0: input.start.fov, fov1: input.end.fov },
      leg: { about: input.destination, type: "line", swing: still, fov0: input.end.fov, fov1: input.end.fov, from, to: e1, d0: length(from), d1, dn: d1, u0, u1: u0, l, ea: Math.max(1e-9, Math.min(dm, length(sub(leaving, stand)))), eb: d1 },
    };
  }

  // the last view looks at the destination from another side: turn until the destination is just inside the picture, go straight at it, and make the rest of the turn round it
  const way = unit(sub(b, add(input.start.position, sub(v, pivot.from))));
  let om: Facing | null = null;
  for (let k = 50; k >= 0 && om === null; k -= 1) {
    const o = swingAt(whole, k / 50);
    if (within(toCamera(o, way), frame0, 0.8)) om = o;
  }
  if (om === null) {
    // the arc never shows the destination: leave it where it comes nearest, by the least turn that brings the destination inside
    let best = o0;
    for (let k = 0; k <= 50; k += 1) {
      const o = swingAt(whole, k / 50);
      if (angleOf(o.f, way) < angleOf(best.f, way)) best = o;
    }
    const room = Math.atan(0.75 * Math.min(frame0.th, frame0.tv));
    const off = angleOf(best.f, way);
    const axis = length(cross(best.f, way)) < 1e-9 ? best.u : unit(cross(best.f, way));
    om = { f: unit(spin(best.f, axis, Math.max(0, off - room))), u: unit(spin(best.u, axis, Math.max(0, off - room))) };
  }
  const first0 = intoFrame(toCamera(om, toScene(o0, u0)), frame0, 0.85);
  let chosen: { stand: Vec3; u: Vec3; d: number; miss: number } | null = null;
  search: for (const far of tries) {
    for (const spot of spots(first0, frame0, 0.85)) {
      const stand = sub(v, scale(toScene(om, spot), far * d0));
      const miss = missOf(stand, b, v);
      const seen = within(toCamera(om, sub(b, stand)), frame0, 0.9);
      if (seen && (chosen === null || miss > chosen.miss)) chosen = { stand, u: spot, d: far * d0, miss };
      if (seen && miss >= Math.min(1.52 * (1 + clearance) * pivot.radius, 0.9 * far * d0)) {
        chosen = { stand, u: spot, d: far * d0, miss };
        break search;
      }
    }
  }
  chosen ??= { stand: sub(v, scale(toScene(om, first0), d0)), u: first0, d: d0, miss: 0 };
  const from = sub(chosen.stand, b);
  const dm = Math.max(1e-12, length(from));
  const rest = swingOf(om, o1);
  return {
    turn: { pivot, swing: swingOf(o0, om), u0, u1: chosen.u, d0, d1: chosen.d, lift: 0, fov0: input.start.fov, fov1: input.start.fov },
    leg: {
      about: input.destination, type: "swing", swing: rest, fov0: input.start.fov, fov1: input.end.fov, from, to: e1, d0: dm, d1, dn: Math.min(dm, d1 * Math.exp(2 + swingDegrees(rest) / 15)),
      u0: unit(toCamera(om, scale(from, -1))), u1: unit(toCamera(o1, scale(e1, -1))), l: dm - d1, ea: Math.max(1e-9, chosen.d), eb: d1,
    },
  };
}

function lineLeg(input: TravelInput, about: TravelBody, watch: TravelBody | undefined): Leg {
  const from = sub(input.start.position, about.from);
  const to = sub(input.end.position, placeOf(about, 1));
  const near = (view: Vec3, t: number): number => Math.max(1e-9, Math.min(...[input.leaving, input.destination, ...(input.around ? [input.around] : [])].map((body) => length(sub(view, placeOf(body, t))))));
  return {
    about, type: "line", swing: swingOf(facingOf(input.start), facingOf(input.end)), fov0: input.start.fov, fov1: input.end.fov, from, to, d0: length(from), d1: length(to), dn: length(to),
    u0: [0, 0, 1], u1: [0, 0, 1], l: length(sub(to, from)), ea: near(input.start.position, 0), eb: near(input.end.position, 1), watch,
  };
}

/** The way on is never hurried by a long turn: it takes at least 45 percent of the turn's time. */
const legMs = (leg: Leg, turn: number = 0): number => Math.max(0.45 * turn, 900 + 320 * Math.max(Math.log1p(leg.l / (leg.ea + leg.eb)), Math.abs(Math.log(Math.max(1e-12, leg.d1) / Math.max(1e-12, leg.d0)))) + 16 * swingDegrees(leg.swing));
const turnMs = (turn: Turn): number => {
  const ms = 16 * swingDegrees(turn.swing) + 8 * (angleOf(turn.u0, turn.u1) / RAD) + 400 * Math.abs(Math.log(turn.d1 / turn.d0)) + 600 * turn.lift;
  return ms < 40 ? 0 : Math.max(500, ms);
};

function routeOf(input: TravelInput): { route: Route; plan: Omit<TravelPlan, "route"> } {
  const wanted = input.reduced ? "cut" : (input.kind ?? "turn-travel");
  const kind: Exclude<TravelKind, "auto"> = wanted === "auto" ? "turn-travel" : wanted;
  const clearance = input.clearance ?? TRAVEL_CLEARANCE;
  const bodies = [...new Set([input.leaving, input.destination, ...(input.around ? [input.around] : []), ...(input.others ?? [])])];
  const shells = bodies.map((body) => ({ body, clear: Math.min((1 + clearance) * body.radius, length(sub(input.start.position, body.from)) / 1.5, length(sub(input.end.position, placeOf(body, 1))) / 1.5) }));
  const least = angleOf(facingOf(input.start).f, facingOf(input.end).f) / RAD;
  const region = input.leaving.reach !== undefined || input.destination.reach !== undefined;
  const base = { shells, frameAspect: input.aspect, input };
  const easing = { turn: "smooth-step", distance: "geometric" } as const;
  if (kind === "cut") {
    const leg = lineLeg(input, input.destination, undefined);
    return { route: { ...base, cut: true, turn: null, share: 0, arrive: 0, leg }, plan: { kind, path: "cut", stages: { turn: 0, travel: 0, arrive: 1 }, duration: 0, turn: least, settle: 0, easing } };
  }
  let turn: Turn | null = null;
  let leg: Leg;
  let share = 0;
  let path: TravelPlan["path"] = "line";
  if (kind !== "turn-travel" || region) {
    // one straight line: a region's view is held on the body at its middle (or the planet circled), so that body stays in the picture
    leg = lineLeg(input, region ? (input.around ?? input.destination) : input.destination, kind === "look-back" ? input.leaving : undefined);
  } else {
    const family = input.around !== undefined;
    path = family ? "circle" : "pivot";
    // already facing the way the last view faces, with the destination in the picture and the straight way clear of the body left: there is nothing to turn, and a straight line keeps in the picture all that is in it at both ends
    const o0 = facingOf(input.start);
    const d0 = length(sub(input.leaving.from, input.start.position));
    const facing = swingDegrees(swingOf(o0, facingOf(input.end))) < 1 && within(toCamera(o0, sub(input.destination.from, input.start.position)), frameOf(input.start.fov, input.aspect), 0.93);
    const open = missOf(input.start.position, input.end.position, input.leaving.from) >= Math.min(1.52 * (1 + clearance) * input.leaving.radius, 0.9 * d0);
    let stand = facing && open ? { turn: { pivot: input.leaving, swing: swingOf(o0, o0), u0: [0, 0, 1] as Vec3, u1: [0, 0, 1] as Vec3, d0: 1, d1: 1, lift: 0, fov0: input.start.fov, fov1: input.start.fov }, leg: lineLeg(input, input.destination, undefined) } : standAt(input, 0.25, family);
    // the stand is worked out for the moment the turn ends, which is the share of the move its own length gives: found by trying, until the two agree (the bodies move, so a stand for another moment would not meet the way on)
    let tm = 0.25;
    for (let pass = 0; pass < 8; pass += 1) {
      const t0 = turnMs(stand.turn);
      share = t0 === 0 ? 0 : t0 / (t0 + legMs(stand.leg, t0));
      if ((facing && open) || share === 0 || Math.abs(share - tm) < 0.002) break;
      tm = pass === 0 ? share : (tm + share) / 2;
      stand = standAt(input, tm, family);
    }
    if (share > 0 && !(facing && open)) share = tm;
    turn = stand.turn;
    leg = stand.leg;
    if (share === 0) {
      // nothing to turn: the way on starts from the camera's own place
      turn = null;
      if (leg.type === "line") leg = { ...leg, from: sub(input.start.position, input.destination.from), l: length(sub(leg.to, sub(input.start.position, input.destination.from))), swing: swingOf(facingOf(input.start), facingOf(input.end)), fov0: input.start.fov };
      else {
        const from = sub(input.start.position, input.destination.from);
        const o0 = facingOf(input.start);
        leg = { ...leg, from, d0: length(from), l: length(from) - leg.d1, dn: Math.min(length(from), leg.dn), u0: unit(toCamera(o0, scale(from, -1))), swing: swingOf(o0, facingOf(input.end)) };
      }
    } else if (family && turn.pivot !== input.leaving) {
      // the planet is held, not the moon left: back the turn off in its middle until one of the two bodies is in the picture at every moment of it
      const frameAt = (fov: number): Frame => frameOf(fov, input.aspect);
      // the stand is for the moment the turn ends, so when the backed-off turn takes another share of the move the stand is worked out again for that moment, until the two agree
      for (let round = 0; round < 4; round += 1) {
        const missing = (candidate: Turn): number => {
          let missed = 0;
          for (let i = 1; i < 64; i += 1) {
            // the first moments are sampled finely: the body left is nearest then, and nearest to being lost
            for (const x of i === 1 ? [0.0005, 0.001, 0.002, 0.004, 0.008, 1 / 64] : [i / 64]) {
              const t = share * x;
              const at = turnAt(candidate, ease(x), t);
              const frame = frameAt(at.fov);
              const seen = (body: TravelBody): boolean => {
                const sight = sightOf(body, t, at.position, at.o, frame);
                return sight.inside && Math.abs(sight.x) <= 0.9 && Math.abs(sight.y) <= 0.9;
              };
              if (!seen(input.leaving) && !seen(input.destination)) missed += 1;
            }
          }
          return missed;
        };
        let best: { turn: Turn; missed: number } = { turn, missed: Number.POSITIVE_INFINITY };
        for (let lift = 0; lift <= 6.61 && best.missed > 0; lift += 0.3) {
          const missed = missing({ ...turn, lift });
          if (missed < best.missed) best = { turn: { ...turn, lift }, missed };
        }
        if (best.missed > 0) {
          // the body left is near the camera and the planet far off, so the circle of the planet carries the camera away from the body left at once: begin by turning about the body left instead
          const u = unit(toCamera(facingOf(input.start), sub(input.leaving.from, input.start.position)));
          const d = Math.max(1e-12, length(sub(input.leaving.from, input.start.position)));
          for (const far of [1, 2, 4, 8, 16, 32, 64]) {
            for (const q of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
              for (let lift = 0; lift <= 6.61 && best.missed > 0; lift += 0.3) {
                const candidate: Turn = { ...turn, lift, hold: { body: input.leaving, u, d, q, far } };
                const missed = missing(candidate);
                if (missed < best.missed) best = { turn: candidate, missed };
              }
            }
          }
        }
        turn = best.turn;
        const t0 = turnMs(turn);
        const next = t0 / (t0 + legMs(leg, t0));
        if (Math.abs(next - share) < 0.002 || round === 3) break;
        share = (share + next) / 2;
        const again = standAt(input, share, family);
        turn = again.turn;
        leg = again.leg;
      }
    }
  }
  const total = (turn ? turnMs(turn) : 0) + legMs(leg, turn ? turnMs(turn) : 0);
  // the arrival is the last stretch: within two of the last distances on a line, or the turn round the destination
  const near = leg.type === "line" ? 2 * leg.eb : leg.dn - leg.d1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (leftOf(ease(mid), leg.l, leg.ea, leg.eb) > near) lo = mid;
    else hi = mid;
  }
  const arrive = share + (1 - share) * Math.min(0.9, Math.max(0.6, hi));
  const route: Route = { ...base, cut: false, turn, share, arrive, leg };
  return { route, plan: { kind, path, stages: { turn: share, travel: arrive - share, arrive: 1 - arrive }, duration: Math.round(Math.min(9000, Math.max(1200, total)) * Math.max(0.05, input.pace ?? 1)), turn: least, settle: leg.type === "swing" ? swingDegrees(leg.swing) : 0, easing } };
}

/**
 * The plan of a move: its stages and the share of the time each takes, how long it should last, and how it is eased. The length is a suggestion from how far the picture changes (16 milliseconds a degree
 * turned, 320 for each time the distance changes by a factor of e, between 1.2 and 9 seconds, times `pace`); a page may use its own, since `travelPose` takes the moment as a share of the move.
 *
 * @param input - The two views, the bodies and the picture's shape.
 * @returns The plan. Hand it to `travelPose` as its third argument to save working the path out at every frame.
 *
 * @example
 * ```ts
 * import { travelPlan } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const plan = travelPlan({
 *   start: { position: [0, 0, 4.1], forward: [0, 0, -1], up: [0, 1, 0], fov: 35 },
 *   end: { position: [297.6, 0, 0], forward: [1, 0, 0], up: [0, 1, 0], fov: 35 },
 *   leaving: { from: [0, 0, 0], radius: 1 },
 *   destination: { from: [300, 0, 0], radius: 0.6 },
 *   aspect: 16 / 9,
 * });
 * console.log(plan.path, plan.duration, plan.stages.turn.toFixed(2));
 * ```
 */
export function travelPlan(input: TravelInput): TravelPlan {
  const { route, plan } = routeOf(input);
  return { ...plan, route };
}

/**
 * The camera at the moment `t` of a move, from 0 (the first view) to 1 (the last view), with where the two bodies are in the picture. The same input and moment always give the same camera. The default move,
 * `turn-travel`, never shows an empty picture between two framed views: the body being left (or the planet circled) is held in the picture through the turn, and the destination from the end of the turn on,
 * where it only grows; the look direction turns one way only; no place is nearer a body than `TRAVEL_CLEARANCE`. `direct` and `look-back` are a straight eased glide and promise only the clearance. `cut`, or
 * `reduced`, gives the last view for every `t` above 0.
 *
 * The bodies' places are taken at the two ends of the move (`from` and `to`): work out `end` for the destination's place at the end, and start a new move if the clock's speed changes on the way.
 *
 * @param input - The two views, the bodies and the picture's shape.
 * @param t - The moment, as a share of the move from 0 to 1.
 * @param plan - The plan from `travelPlan(input)`, to save working it out again.
 * @returns The camera, the stage, and where the bodies are in the picture.
 *
 * @example
 * ```ts
 * import { travelPlan, travelPose, type TravelInput } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const input: TravelInput = {
 *   start: { position: [0, 0, 4.1], forward: [0, 0, -1], up: [0, 1, 0], fov: 35 },
 *   end: { position: [297.6, 0, 0], forward: [1, 0, 0], up: [0, 1, 0], fov: 35 },
 *   leaving: { from: [0, 0, 0], radius: 1 },
 *   destination: { from: [300, 0, 0], radius: 0.6 },
 *   aspect: 16 / 9,
 * };
 * const plan = travelPlan(input);
 * for (const t of [0, 0.25, 0.5, 0.75, 1]) {
 *   const camera = travelPose(input, t, plan);
 *   console.log(camera.stage, camera.leaving.inside || camera.destination.inside);
 * }
 * ```
 */
export function travelPose(input: TravelInput, t: number, plan?: TravelPlan): TravelSample {
  const route = (plan?.route as Route | undefined)?.input === input ? (plan!.route as Route) : routeOf(input).route;
  const at = Number.isFinite(t) ? clamp01(t) : 1;
  let view: TravelView;
  let stage: TravelSample["stage"];
  if (at <= 0) {
    view = { position: input.start.position, forward: facingOf(input.start).f, up: facingOf(input.start).u, fov: input.start.fov };
    stage = route.turn ? "turn" : "travel";
  } else if (at >= 1 || route.cut) {
    view = { position: input.end.position, forward: facingOf(input.end).f, up: facingOf(input.end).u, fov: input.end.fov };
    stage = "arrive";
  } else {
    const now = along(route, at);
    view = { position: now.position, forward: now.o.f, up: now.o.u, fov: now.fov };
    stage = now.stage;
  }
  const time = route.cut && at > 0 ? 1 : at;
  const o: Facing = { f: view.forward, u: view.up };
  const frame = frameOf(view.fov, input.aspect);
  const sample: TravelSample = { ...view, stage, leaving: sightOf(input.leaving, time, view.position, o, frame), destination: sightOf(input.destination, time, view.position, o, frame) };
  if (input.around) sample.around = sightOf(input.around, time, view.position, o, frame);
  return sample;
}

/**
 * One body that might keep an arrival from being an empty black picture: where it is, and which rule it belongs to.
 * `1` is the body's own moon, or its planet when the body is a moon. `2` is the body the camera came from, or the nearest planet in that direction. `3` is the Sun.
 *
 * @example
 * ```ts
 * import type { ArrivalCompanion } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const moon: ArrivalCompanion = { id: "io", at: [10, 0, 0], rank: 1 };
 * console.log(moon.rank);
 * ```
 */
export interface ArrivalCompanion {
  /** A name the page can put on the marker. Left out, the side is still chosen. */
  id?: string;
  at: Vec3;
  rank: 1 | 2 | 3;
}

/**
 * The side of a body to stand on so a companion is in the picture, and the body stays at least half lit.
 * Companions are tried in rank order (1, then 2, then 3). The first rank that fits wins; within a rank the side nearest the approach is kept.
 * A side more than 90 degrees from the Sun is refused, so a lit globe is never traded for a black one. With no companion that fits, the side is the
 * approach, swung toward the Sun when it would show less than about three fifths of the body lit (never more than 75 degrees off the Sun).
 *
 * @param input - The body, where the move comes from, the Sun, and the companions in rank order.
 * @returns A unit side from the body toward the camera, how much of the disc is lit, and the companion's id (null when none was framed).
 *
 * @example
 * ```ts
 * import { arrivalSide } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const side = arrivalSide({ body: [0, 0, 0], radius: 1, from: [0, 0, 20], sun: [0, 0, 100], companions: [{ id: "io", at: [8, 1, 0], rank: 1 }] });
 * console.log(side.companion, side.lit >= 0.5);
 * ```
 */
export function arrivalSide(input: { body: Vec3; radius: number; from: Vec3; sun?: Vec3; companions?: readonly ArrivalCompanion[]; fov?: number; aspect?: number; fit?: number }): { side: Vec3; lit: number; companion: string | null } {
  let approach = sub(input.from, input.body);
  approach = length(approach) < 1e-9 ? ([0, 0, 1] as Vec3) : unit(approach);
  const sunFar = input.sun ? sub(input.sun, input.body) : null;
  const sunDir = sunFar && length(sunFar) > 1e-9 ? unit(sunFar) : null;
  const litOf = (side: Vec3): number => (sunDir ? (1 + Math.cos(Math.min(Math.PI, angleOf(side, sunDir)))) / 2 : 1);
  const swing = (side: Vec3): Vec3 => {
    if (!sunDir) return side;
    const off = angleOf(side, sunDir);
    const most = 75 * RAD;
    return off > most ? arc(side, sunDir, (off - most) / off) : side;
  };
  const distance = Math.max(1e-6, input.radius) * (input.fit ?? 4.1) * Math.max(1, 1 / Math.max(1e-3, input.aspect ?? 1));
  const fov = ((input.fov ?? 35) / 2) * RAD;
  const tv = Math.tan(fov);
  const aspect = Math.max(1e-3, input.aspect ?? 1);
  const frames = (side: Vec3, at: Vec3): boolean => {
    const forward = scale(side, -1);
    const north = sub([0, 1, 0], scale(forward, forward[1]));
    const up = length(north) < 1e-6 ? squareTo(forward) : unit(north);
    const camera = add(input.body, scale(side, distance));
    const v = sub(at, camera);
    const z = dot(v, forward);
    if (!(z > 0)) return false;
    if (Math.abs(dot(v, cross(forward, up))) > 0.92 * tv * aspect * z) return false;
    if (Math.abs(dot(v, up)) > 0.92 * tv * z) return false;
    const limb = Math.atan(input.radius / distance);
    return angleOf(forward, unit(v)) > limb * 1.15;
  };
  const found: { side: Vec3; rank: number; near: number; id: string | null }[] = [];
  const half = Math.PI / 2 + 1e-4;
  const companions = input.companions ?? [];
  const consider = (side: Vec3): void => {
    const u = length(side) < 1e-9 ? approach : unit(side);
    if (sunDir && angleOf(u, sunDir) > half) return;
    let rank = 99;
    let id: string | null = null;
    for (const companion of companions) {
      if (companion.rank < rank && frames(u, companion.at)) {
        rank = companion.rank;
        id = companion.id ?? null;
      }
    }
    if (rank === 99) return;
    const near = angleOf(u, approach);
    const top = found[0];
    if (top === undefined || rank < top.rank || (rank === top.rank && near < top.near - 1e-6)) found[0] = { side: u, rank, near, id };
  };
  consider(approach);
  for (const companion of companions) {
    const away = sub(input.body, companion.at);
    if (length(away) < 1e-6) continue;
    const u = unit(away);
    const perp = Math.abs(u[1]) < 0.9 ? unit(cross(u, [0, 1, 0])) : unit(cross(u, [1, 0, 0]));
    const perp2 = unit(cross(u, perp));
    for (const deg of [8, 14, 22, 32, 48, 70]) {
      const e = deg * RAD;
      for (const axis of [perp, perp2]) {
        consider(add(scale(u, Math.cos(e)), scale(axis, Math.sin(e))));
        consider(add(scale(u, Math.cos(e)), scale(axis, -Math.sin(e))));
      }
    }
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lon = 0; lon < 360; lon += 15) {
      const c = Math.cos(lat * RAD);
      consider([c * Math.cos(lon * RAD), Math.sin(lat * RAD), c * Math.sin(lon * RAD)]);
    }
  }
  const picked = found[0];
  const side = picked?.side ?? swing(approach);
  return { side, lit: litOf(side), companion: picked?.id ?? null };
}

/**
 * A framed view of a whole body to arrive at, from the side the move comes from, so the approach is straight and nothing has to be turned back: the camera stands on the line towards `from`, moved round
 * towards the Sun where that side would show less than about three fifths of the body lit (never more than 75 degrees off the Sun's direction), and further round, still at least half lit, when that puts a
 * companion in the picture (`arrivalSide`). It stands at `fit` radii away (4.1, and as much again as a tall picture is taller than wide), looking at the body with `north` up.
 *
 * @param input - The body's place and radius, where the move comes from, the Sun's place (left out for the Sun itself), the picture's shape, the companions to keep in the picture, and optionally `fov`, `fit` and `north`.
 * @returns The view, `lit` (the share of the disc that is lit from there, 1 when no Sun is given), and `companion` (the id framed beside it, or null).
 *
 * @example
 * ```ts
 * import { travelArrival } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const view = travelArrival({ body: [300, 0, 0], radius: 0.6, from: [0, 0, 0], sun: [100, 0, 150], aspect: 16 / 9 });
 * console.log(view.position.map((n) => n.toFixed(1)).join(", "), view.lit.toFixed(2));
 * ```
 */
export function travelArrival(input: { body: Vec3; radius: number; from: Vec3; sun?: Vec3; aspect: number; fov?: number; fit?: number; north?: Vec3; companions?: readonly ArrivalCompanion[] }): TravelView & { lit: number; companion: string | null } {
  const picked = arrivalSide(input);
  const side = picked.side;
  const distance = input.radius * (input.fit ?? 4.1) * Math.max(1, 1 / Math.max(1e-3, input.aspect));
  const forward = scale(side, -1);
  const north = input.north ?? ([0, 1, 0] as Vec3);
  const across = sub(north, scale(forward, dot(north, forward)));
  return { position: add(input.body, scale(side, distance)), forward, up: length(across) < 1e-6 ? squareTo(forward) : unit(across), fov: input.fov ?? 35, lit: picked.lit, companion: picked.companion };
}
