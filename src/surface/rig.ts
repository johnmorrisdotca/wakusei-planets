// A rover model's rig, without a DOM and without three.js: the names of the nodes a model (a GLB) must give, the measures a drive step needs read from where those nodes are, and the angles the wheels and
// steering pivots are turned to for a drive state. The loader (`model.ts`) finds the nodes; this decides what the numbers mean, so it is tested in node.
import { ROVER, toWorld, type DriveState } from "./drive.ts";
import type { Part, V3 } from "./shapes.ts";

/**
 * The nodes a rover model may name: `wheel-fl`, `wheel-fr`, `wheel-ml`, `wheel-mr`, `wheel-rl` and `wheel-rr` roll about X (their origin is the wheel's centre), `steer-fl`, `steer-fr`, `steer-rl` and `steer-rr`
 * turn about Y (a pivot holding the wheel and its leg), and the eye is `eye`, or `seat-commander` (the left seat) when the model has no `eye`. The model's metres have +Y up and its front on +Z.
 *
 * @example
 * ```ts
 * import { MODEL_NODES } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(MODEL_NODES.wheels.join(" "), MODEL_NODES.eyes.join(" or "));
 * ```
 */
export const MODEL_NODES = {
  wheels: ["wheel-fl", "wheel-fr", "wheel-ml", "wheel-mr", "wheel-rl", "wheel-rr"],
  steers: ["steer-fl", "steer-fr", "steer-rl", "steer-rr"],
  eyes: ["eye", "seat-commander"],
} as const;

/**
 * The measures a drive step takes from a vehicle: where its four corner wheels touch the ground, how big they are and where the eyes are. `ROVER` is the lunar rover's; a model gives its own (`rigOf`).
 *
 * @example
 * ```ts
 * import { ROVER, type Rig } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const rig: Rig = ROVER;
 * console.log(rig.wheels.length, rig.wheelRadius);
 * ```
 */
export interface Rig {
  length: number;
  wheelbase: number;
  track: number;
  wheelRadius: number;
  /** The four corner wheels' centres in the vehicle's frame (x right, y up, z forward): front left, front right, rear left, rear right. */
  wheels: readonly V3[];
  /** The eyes of the view from the vehicle. */
  seat: V3;
}

/**
 * What the loader finds in a model: where each named node's origin is (in the drive frame, metres), the radius of the wheels and the length of the model along Z.
 *
 * @example
 * ```ts
 * import type { ModelNodes } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const nodes: ModelNodes = { at: { eye: [0, 1.9, 0] }, wheelRadius: 0.3, length: 2.4 };
 * console.log(Object.keys(nodes.at).length, nodes.length);
 * ```
 */
export interface ModelNodes {
  /** The world position of each named node that exists. */
  at: Readonly<Record<string, V3>>;
  /** The radius of the wheels, metres, from the biggest wheel's size (`0` when it could not be told). */
  wheelRadius: number;
  /** The model's length along Z, metres. */
  length: number;
}

/**
 * The rig of a model: its four corner wheels where its `wheel-fl`, `wheel-fr`, `wheel-rl` and `wheel-rr` nodes are, its wheelbase and track from them, its eyes where `eye` (or `seat-commander`) is. What a model does
 * not say is the lunar rover's value; a model with no corner wheel at all is `undefined` (it cannot be driven by its wheels).
 *
 * @param nodes - What was found in the model.
 * @returns The rig, or `undefined` when a corner wheel is missing.
 *
 * @example
 * ```ts
 * import { rigOf } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const rig = rigOf({ at: { "wheel-fl": [-1, 0.25, 1], "wheel-fr": [1, 0.25, 1], "wheel-rl": [-1, 0.25, -1], "wheel-rr": [1, 0.25, -1], eye: [0, 2, 0] }, wheelRadius: 0.25, length: 3 });
 * console.log(rig?.wheelbase, rig?.track, rig?.seat);
 * ```
 */
export function rigOf(nodes: ModelNodes): Rig | undefined {
  const [fl, fr, rl, rr] = ["wheel-fl", "wheel-fr", "wheel-rl", "wheel-rr"].map((name) => nodes.at[name]);
  if (fl === undefined || fr === undefined || rl === undefined || rr === undefined) return undefined;
  const eye = nodes.at["eye"] ?? nodes.at["seat-commander"] ?? ROVER.seat;
  const wheelbase = Math.abs((fl[2] + fr[2]) / 2 - (rl[2] + rr[2]) / 2);
  const track = Math.abs((fr[0] + rr[0]) / 2 - (fl[0] + rl[0]) / 2);
  const radius = nodes.wheelRadius > 0 ? nodes.wheelRadius : Math.max(0.05, (fl[1] + fr[1] + rl[1] + rr[1]) / 4);
  return { length: nodes.length > 0 ? nodes.length : wheelbase + 2 * radius, wheelbase, track, wheelRadius: radius, wheels: [fl, fr, rl, rr], seat: eye };
}

/**
 * How far each named node of a rover model is turned for a drive state: the wheels' roll about X (the four corner wheels as `spin` has them, each middle wheel the mean of the two beside it) and the steering pivots'
 * turn about Y (the front ones with the steer, the rear ones the other way, as the lunar rover's four wheels steer).
 *
 * @param state - The vehicle.
 * @returns Radians for each node name: `roll` for the `wheel-xx` nodes about X, `steer` for the `steer-xx` nodes about Y.
 *
 * @example
 * ```ts
 * import { modelPose, startDrive } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const rover = { ...startDrive(0, 0, 0, 0), steer: 0.2, spin: [1, 1, 3, 3] };
 * const pose = modelPose(rover);
 * console.log(pose.roll["wheel-ml"], pose.steer["steer-fl"], pose.steer["steer-rr"]);
 * ```
 */
export function modelPose(state: Pick<DriveState, "spin" | "steer">): { roll: Record<string, number>; steer: Record<string, number> } {
  const [fl, fr, rl, rr] = state.spin as [number, number, number, number];
  return {
    roll: { "wheel-fl": fl, "wheel-fr": fr, "wheel-ml": (fl + rl) / 2, "wheel-mr": (fr + rr) / 2, "wheel-rl": rl, "wheel-rr": rr },
    steer: { "steer-fl": state.steer, "steer-fr": state.steer, "steer-rl": -state.steer, "steer-rr": -state.steer },
  };
}

/**
 * Where a model's glTF frame (+Y up, front +Z, the left on +X) puts a point of the model in the drive frame (x right, y up, z forward): the left and right swapped.
 *
 * @param p - A point in the model's metres.
 * @returns The point in the drive frame.
 *
 * @example
 * ```ts
 * import { fromModelFrame } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(fromModelFrame([0.5, 1.2, 2]));
 * ```
 */
export const fromModelFrame = (p: readonly [number, number, number]): V3 => [-p[0], p[1], p[2]];

/**
 * The shadow of a model: the points of its meshes, placed as the drive state puts the vehicle. One cloud is one mesh, in the drive frame at rest (x right, y up, z forward). `partShadows` takes the hull of each cloud, so the shadow follows the rover.
 *
 * @param state - The vehicle.
 * @param clouds - The meshes' points, as `VehicleModel.shadowClouds` keeps them.
 * @returns One part a mesh, to hand to `partShadows`.
 *
 * @example
 * ```ts
 * import { modelShadowParts, partShadows, startDrive } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const parts = modelShadowParts(startDrive(0, 0, 0, 0), [[[-0.4, 0.5, 0.8], [0.4, 0.5, 0.8], [0, 1.2, 0]]]);
 * console.log(partShadows(parts, 0, 90, 20).length / 9, "triangles of shadow");
 * ```
 */
export function modelShadowParts(state: Pick<DriveState, "east" | "north" | "heading" | "pitch" | "roll" | "y">, clouds: readonly (readonly V3[])[]): Part[] {
  const out: Part[] = [];
  for (const cloud of clouds) {
    if (cloud.length < 3) continue;
    const position: number[] = [];
    for (const p of cloud) {
      const w = toWorld(state, [p[0], p[1], p[2]]);
      position.push(w[0], w[1], w[2]);
    }
    out.push({ position, normal: [], tone: 1 });
  }
  return out;
}
