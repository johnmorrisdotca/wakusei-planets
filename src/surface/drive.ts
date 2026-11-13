// Driving the lunar rover: a vehicle on four wheels over the same ground the eyes walk on. The step is pure and small: throttle and steering in, the rover's place, heading, height, pitch and roll out, the chassis
// settling on a spring over the four places its wheels touch, free in the air where the ground falls away (the Moon's gravity is a sixth of ours, so a crest throws it). The ground is whatever function the page gives:
// the measured heights and the made craters, so the rover follows the craters exactly. What is real: the rover's size, the gravity and a top speed near the published one. What is made: the feel of the spring, the
// steering, the limits on a slope. No DOM.
import { roverParts, type Part, type V3 } from "./shapes.ts";

/**
 * The rover's measures: those published (its length and width, the wheels' size and the wheelbase, the gravity of the Moon) and those chosen here (the speeds, the steering, the slope it will not climb, the spring).
 *
 * @example
 * ```ts
 * import { ROVER } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(`${(ROVER.maxSpeed * 3.6).toFixed(0)} km/h at most, wheelbase ${ROVER.wheelbase} m`);
 * ```
 */
export const ROVER = {
  length: 3.05,
  width: 2.13,
  wheelbase: 2.3,
  /** Metres between the wheels' middles across the rover. */
  track: 1.9,
  wheelRadius: 0.41,
  /** The Moon's surface gravity, m/s2. */
  gravity: 1.62,
  /** About 12 km/h, a little under the speed the rover was designed for. */
  maxSpeed: 3.4,
  maxReverse: 1.4,
  accel: 1.1,
  brake: 2.6,
  /** The most a wheel is turned, radians (30 degrees), at the front and, the other way, at the back. */
  maxSteer: 0.52,
  /** The steepest slope it will climb, radians (25 degrees). */
  maxSlope: 0.436,
  /** The wheels' middles in the rover's frame (x right, y up, z forward), front left, front right, rear left, rear right. */
  wheels: [
    [-0.95, 0.41, 1.15],
    [0.95, 0.41, 1.15],
    [-0.95, 0.41, -1.15],
    [0.95, 0.41, -1.15],
  ] as readonly V3[],
  /** The commander's eyes in the rover's frame, the left seat. */
  seat: [-0.42, 1.45, -0.3] as V3,
} as const;

/**
 * Where the rover is and how it moves: all of it, so a step needs nothing else.
 *
 * @example
 * ```ts
 * import { startDrive, type DriveState } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const rover: DriveState = startDrive(0, 0, 90, 0);
 * console.log(`${rover.heading} degrees, ${rover.speed} m/s, wheels turned ${rover.spin.length}`);
 * ```
 */
export interface DriveState {
  /** Metres east and north of the site point, and the heading in degrees clockwise from north. */
  east: number;
  north: number;
  heading: number;
  /** Metres a second along the heading (negative going back) and the wheels' turn in radians (positive to the right). */
  speed: number;
  steer: number;
  /** The height of the ground plane under the wheels over the site's ground, in metres, and how fast it is changing. */
  y: number;
  vy: number;
  /** Nose up and right side up, in radians. */
  pitch: number;
  roll: number;
  /** How far each wheel has turned, in radians. */
  spin: number[];
  /** Whether the wheels are off the ground. */
  airborne: boolean;
  /** Metres driven. */
  distance: number;
}

/**
 * What the driver asks for: the throttle (-1 full reverse to 1 full ahead) and the steering (-1 full left to 1 full right).
 *
 * @example
 * ```ts
 * import { driveStep, startDrive, type DriveInput } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const input: DriveInput = { throttle: 1, steer: -0.5 };
 * console.log(driveStep(startDrive(0, 0, 0, 0), input, 0.02, () => 0).speed > 0);
 * ```
 */
export interface DriveInput {
  throttle: number;
  steer: number;
}

/**
 * A rover at rest at a place, on the ground.
 *
 * @param east - Metres east of the site point.
 * @param north - Metres north of it.
 * @param heading - Degrees clockwise from north.
 * @param ground - The ground's height over the site's ground at the place.
 * @returns The state.
 *
 * @example
 * ```ts
 * import { startDrive } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const rover = startDrive(77, 11, 264, 0);
 * console.log(rover.heading, rover.speed);
 * ```
 */
export function startDrive(east: number, north: number, heading: number, ground: number): DriveState {
  return { east, north, heading, speed: 0, steer: 0, y: ground, vy: 0, pitch: 0, roll: 0, spin: [0, 0, 0, 0], airborne: false, distance: 0 };
}

const RAD = Math.PI / 180;

/** Where a point of the rover's frame is in the site's plane and height (before the wheels' own turns): the heading, then the pitch, then the roll. */
export function toWorld(state: Pick<DriveState, "east" | "north" | "heading" | "pitch" | "roll" | "y">, p: V3): V3 {
  const [x, y, z] = p;
  const [cr, sr, cp, sp] = [Math.cos(state.roll), Math.sin(state.roll), Math.cos(state.pitch), Math.sin(state.pitch)];
  // roll about the forward axis, then pitch about the right axis
  const x1 = x * cr - y * sr;
  const y1 = x * sr + y * cr;
  const y2 = y1 * cp + z * sp;
  const z2 = -y1 * sp + z * cp;
  const h = state.heading * RAD;
  const [c, s] = [Math.cos(h), Math.sin(h)];
  return [state.east + x1 * c + z2 * s, state.y + y2, state.north - x1 * s + z2 * c];
}

/** The ground under each wheel, at the places the four wheels are. */
function wheelGrounds(state: DriveState, ground: (east: number, north: number) => number): number[] {
  const h = state.heading * RAD;
  const [c, s] = [Math.cos(h), Math.sin(h)];
  return ROVER.wheels.map(([x, , z]) => ground(state.east + x * c + z * s, state.north - x * s + z * c));
}

/**
 * One step of driving: the speed follows the throttle (slowed uphill by the Moon's gravity, stopped by a slope over 25 degrees and by anything in `blocked`), the heading follows the steering (the four wheels steer, the
 * back ones the other way), the rover moves, and its height, pitch and roll follow the four places its wheels touch, the height on a spring and in free fall (at lunar gravity) when the ground drops away.
 *
 * @param state - The rover now.
 * @param input - The throttle and the steering.
 * @param dt - Seconds (at most 0.05 are used; call it more often for a longer time).
 * @param ground - The ground's height over the site's ground at a place.
 * @param blocked - True at a place the rover cannot go (a big rock, the lunar module).
 * @returns The rover a moment later.
 *
 * @example
 * ```ts
 * import { driveStep, startDrive } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * let rover = startDrive(0, 0, 0, 0);
 * for (let i = 0; i < 120; i += 1) rover = driveStep(rover, { throttle: 1, steer: 0 }, 1 / 60, () => 0);
 * console.log(`${rover.north.toFixed(1)} m north after two seconds, at ${rover.speed.toFixed(1)} m/s`);
 * ```
 */
export function driveStep(state: DriveState, input: DriveInput, dt: number, ground: (east: number, north: number) => number, blocked?: (east: number, north: number) => boolean): DriveState {
  const d = Math.min(Math.max(dt, 0), 0.05);
  const next: DriveState = { ...state, spin: [...state.spin] };
  const throttle = Math.min(1, Math.max(-1, input.throttle));
  const wanted = Math.min(1, Math.max(-1, input.steer));
  next.steer += (wanted * ROVER.maxSteer - next.steer) * (1 - Math.exp(-d * 6));
  // the speed: toward what the throttle asks, quickly when braking; uphill the Moon's gravity takes some, and past 25 degrees nothing goes uphill
  const target = throttle >= 0 ? throttle * ROVER.maxSpeed : throttle * ROVER.maxReverse;
  const braking = Math.sign(target) !== Math.sign(next.speed) && next.speed !== 0;
  const a = braking || Math.abs(target) < Math.abs(next.speed) ? ROVER.brake : ROVER.accel;
  const delta = target - next.speed;
  next.speed += Math.sign(delta) * Math.min(Math.abs(delta), a * d);
  if (Math.abs(throttle) < 0.02) next.speed -= Math.sign(next.speed) * Math.min(Math.abs(next.speed), 0.35 * d); // a little rolling resistance
  next.speed -= ROVER.gravity * Math.sin(state.pitch) * d;
  if ((state.pitch > ROVER.maxSlope && next.speed > 0) || (state.pitch < -ROVER.maxSlope && next.speed < 0)) next.speed = 0; // uphill past 25 degrees: it does not go
  // the brake holds it once it has nearly stopped, on any slope it could climb: a rover left alone stays where it is
  if (Math.abs(throttle) < 0.02 && Math.abs(next.speed) < 0.08 && Math.abs(state.pitch) < ROVER.maxSlope) next.speed = 0;
  // the heading: four wheels steer, so the turn is tight; the move
  const yaw = (next.speed * 2 * Math.tan(next.steer)) / ROVER.wheelbase;
  next.heading = (((state.heading + yaw * d * (180 / Math.PI)) % 360) + 360) % 360;
  const h = next.heading * RAD;
  const [e, n] = [state.east + Math.sin(h) * next.speed * d, state.north + Math.cos(h) * next.speed * d];
  const front = [e + Math.sin(h) * ROVER.length * 0.5, n + Math.cos(h) * ROVER.length * 0.5];
  if (next.speed !== 0 && blocked !== undefined && (blocked(e, n) || blocked(front[0]!, front[1]!))) {
    next.speed = 0;
  } else {
    next.east = e;
    next.north = n;
    next.distance += Math.abs(next.speed) * d;
  }
  // the ground under the four wheels: the plane they make, and where the rover sits over it
  const g = wheelGrounds(next, ground);
  const [fl, fr, rl, rr] = [g[0]!, g[1]!, g[2]!, g[3]!];
  const rest = (fl + fr + rl + rr) / 4;
  const pitchTarget = Math.atan2((fl + fr) / 2 - (rl + rr) / 2, ROVER.wheelbase);
  const rollTarget = Math.atan2((fr + rr) / 2 - (fl + rl) / 2, ROVER.track);
  const settle = 1 - Math.exp(-d * 10);
  next.pitch += (pitchTarget - next.pitch) * settle;
  next.roll += (rollTarget - next.roll) * settle;
  // the height: on its springs while the wheels are down (stiffness 81, damping 12.6, a quick and well damped settle), free where the ground has dropped more than a few centimetres away
  next.airborne = next.y - rest > 0.03;
  if (next.airborne) next.vy -= ROVER.gravity * d;
  else next.vy += (81 * (rest - next.y) - 12.6 * next.vy) * d;
  next.y += next.vy * d;
  if (next.y < rest - 0.04) {
    next.y = rest - 0.04;
    if (next.vy < 0) next.vy *= -0.15; // the springs take most of a landing
  }
  const turn = (next.speed * d) / ROVER.wheelRadius;
  for (let i = 0; i < 4; i += 1) next.spin[i] = (next.spin[i]! + turn) % (Math.PI * 2);
  return next;
}

/**
 * The rover's shape as it is now, turned and placed: the parts of `roverParts` with each wheel turned by how far it has rolled and steered (the back wheels the other way), then moved by the rover's heading, pitch, roll
 * and place. Everything is in the site's plane (x east, y up, z north).
 *
 * @param state - The rover.
 * @returns The parts.
 *
 * @example
 * ```ts
 * import { driveParts, startDrive } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const parts = driveParts(startDrive(0, 0, 90, 0));
 * console.log(parts.length, "parts");
 * ```
 */
export function driveParts(state: DriveState): Part[] {
  const [cr, sr, cp, sp] = [Math.cos(state.roll), Math.sin(state.roll), Math.cos(state.pitch), Math.sin(state.pitch)];
  const h = state.heading * RAD;
  const [ch, sh] = [Math.cos(h), Math.sin(h)];
  const rotate = (p: V3): V3 => {
    const x1 = p[0] * cr - p[1] * sr;
    const y1 = p[0] * sr + p[1] * cr;
    const y2 = y1 * cp + p[2] * sp;
    const z2 = -y1 * sp + p[2] * cp;
    return [x1 * ch + z2 * sh, y2, -x1 * sh + z2 * ch];
  };
  return roverParts().map((part) => {
    const out: Part = { ...part, position: [], normal: [] };
    const wheel = part.wheel;
    const centre: V3 = wheel === undefined ? [0, 0, 0] : [...ROVER.wheels[wheel]!];
    const steer = wheel === undefined ? 0 : (wheel < 2 ? 1 : -1) * state.steer;
    const spin = wheel === undefined ? 0 : state.spin[wheel]!;
    const [cs, ss, cy, sy] = [Math.cos(spin), Math.sin(spin), Math.cos(steer), Math.sin(steer)];
    const turnWheel = (p: V3): V3 => {
      // about the wheel's own axle (x), then about the up axis through its middle
      const y1 = p[1] * cs - p[2] * ss;
      const z1 = p[1] * ss + p[2] * cs;
      return [p[0] * cy + z1 * sy, y1, -p[0] * sy + z1 * cy];
    };
    for (let i = 0; i < part.position.length; i += 3) {
      let p: V3 = [part.position[i]!, part.position[i + 1]!, part.position[i + 2]!];
      let nrm: V3 = [part.normal[i]!, part.normal[i + 1]!, part.normal[i + 2]!];
      if (wheel !== undefined) {
        p = turnWheel([p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]]);
        p = [p[0] + centre[0], p[1] + centre[1], p[2] + centre[2]];
        nrm = turnWheel(nrm);
      }
      const w = rotate(p);
      out.position.push(state.east + w[0], state.y + w[1], state.north + w[2]);
      const m = rotate(nrm);
      out.normal.push(m[0], m[1], m[2]);
    }
    return out;
  });
}

/**
 * Where the eyes are and where they look from a view of the rover: from behind and above (`chase`) or from the left seat (`seat`).
 *
 * @example
 * ```ts
 * import { driveView, startDrive, type DriveView } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const view: DriveView = driveView(startDrive(0, 0, 0, 0), "seat", { azimuth: 0, pitch: 0 }, () => 0);
 * console.log(view.azimuth, view.eye.up);
 * ```
 */
export interface DriveView {
  eye: { east: number; north: number; up: number };
  /** Degrees clockwise from north and degrees up. */
  azimuth: number;
  pitch: number;
}

/**
 * The eyes for a view of the rover. The chase view stands 6.5 m behind it and 2.8 m up (never under the ground), looking at it; the seat view is the commander's eyes in the left seat, looking along the rover's heading
 * and tilting with it. `offset` is the driver's own turn of the view from a drag (degrees), added to the direction either looks in.
 *
 * @param state - The rover.
 * @param view - `chase` or `seat`.
 * @param offset - The driver's turn of the view, degrees right and up.
 * @param ground - The ground's height over the site's ground at a place.
 * @returns The eyes.
 *
 * @example
 * ```ts
 * import { driveView, startDrive } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const view = driveView(startDrive(0, 0, 0, 0), "chase", { azimuth: 0, pitch: 0 }, () => 0);
 * console.log(view.eye.north.toFixed(1), view.eye.up.toFixed(1));
 * ```
 */
export function driveView(state: DriveState, view: "chase" | "seat", offset: { azimuth: number; pitch: number }, ground: (east: number, north: number) => number): DriveView {
  if (view === "seat") {
    const eye = toWorld(state, ROVER.seat);
    return { eye: { east: eye[0], north: eye[2], up: eye[1] }, azimuth: (((state.heading + offset.azimuth) % 360) + 360) % 360, pitch: state.pitch / RAD + offset.pitch };
  }
  const a = (state.heading + offset.azimuth) * RAD;
  const [east, north] = [state.east - Math.sin(a) * 6.5, state.north - Math.cos(a) * 6.5];
  const up = Math.max(state.y + 2.8, ground(east, north) + 1.4);
  const drop = (up - (state.y + 1.0)) / 6.5;
  return { eye: { east, north, up }, azimuth: (((state.heading + offset.azimuth) % 360) + 360) % 360, pitch: -Math.atan(drop) / RAD + offset.pitch };
}
