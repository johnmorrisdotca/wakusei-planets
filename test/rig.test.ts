// A rover model's rig, without a browser: the measures a drive step takes from where a model's wheel nodes are, the angles the wheels and pivots are set to, and a drive with a rig of another size.
import assert from "node:assert/strict";
import { test } from "node:test";
import { driveStep, driveView, ROVER, startDrive } from "../src/surface/drive.ts";
import { fromModelFrame, MODEL_NODES, modelPose, modelShadowParts, rigOf } from "../src/surface/rig.ts";

// a small rover as glTF has it: +Z forward, the left on +X, wheels 1.1 m either side of the middle and 0.8 m ahead and behind it
const nodes = { at: { "wheel-fl": [1.1, 0.3, 0.8], "wheel-fr": [-1.1, 0.3, 0.8], "wheel-rl": [1.1, 0.3, -0.8], "wheel-rr": [-1.1, 0.3, -0.8], eye: [-0.5, 1.9, -0.2] }, wheelRadius: 0.3, length: 2.4 } as const;
const inDrive = (at: Record<string, readonly [number, number, number]>): Record<string, [number, number, number]> => Object.fromEntries(Object.entries(at).map(([k, v]) => [k, fromModelFrame(v)]));

test("the rig is read from the wheel nodes: wheelbase, track, wheel size, the eye, and the left and right swapped from glTF's", () => {
  const rig = rigOf({ ...nodes, at: inDrive(nodes.at) })!;
  assert.ok(Math.abs(rig.wheelbase - 1.6) < 1e-9);
  assert.ok(Math.abs(rig.track - 2.2) < 1e-9);
  assert.equal(rig.wheelRadius, 0.3);
  assert.equal(rig.length, 2.4);
  assert.deepEqual(rig.wheels[0], [-1.1, 0.3, 0.8], "front left is on the left (negative x) of the drive frame");
  assert.deepEqual(rig.seat, [0.5, 1.9, -0.2], "the eye is on the model's right, which is positive x in the drive frame");
  assert.deepEqual(rigOf({ ...nodes, at: { ...inDrive(nodes.at), eye: undefined as never, "seat-commander": [0.3, 1.4, -0.25] } })!.seat, [0.3, 1.4, -0.25], "seat-commander stands in for an eye");
});

test("a model with a corner wheel missing has no rig; what is not said is the lunar rover's", () => {
  const three = inDrive(nodes.at);
  delete three["wheel-rr"];
  assert.equal(rigOf({ ...nodes, at: three }), undefined);
  const noEye = inDrive(nodes.at);
  delete noEye["eye"];
  assert.deepEqual(rigOf({ ...nodes, at: noEye })!.seat, ROVER.seat);
  assert.deepEqual(MODEL_NODES.eyes, ["eye", "seat-commander"]);
});

test("the wheels roll as the drive state has them, the middle ones with the mean of the pair beside them, and the pivots turn with the steer, the rear the other way", () => {
  const pose = modelPose({ steer: 0.3, spin: [1, 2, 3, 5] });
  assert.deepEqual(pose.roll, { "wheel-fl": 1, "wheel-fr": 2, "wheel-ml": 2, "wheel-mr": 3.5, "wheel-rl": 3, "wheel-rr": 5 });
  assert.deepEqual(pose.steer, { "steer-fl": 0.3, "steer-fr": 0.3, "steer-rl": -0.3, "steer-rr": -0.3 });
});

test("a drive with a model's rig uses its size: the wheels turn by the distance over its wheel radius, and the pitch follows its wheelbase", () => {
  const rig = rigOf({ ...nodes, at: inDrive(nodes.at) })!;
  const slope = (_e: number, n: number): number => 0.5 * n;
  let lunar = startDrive(0, 0, 0, 0);
  let small = startDrive(0, 0, 0, 0);
  for (let i = 0; i < 30; i += 1) {
    lunar = driveStep(lunar, { throttle: 1, steer: 0 }, 1 / 60, () => 0);
    small = driveStep(small, { throttle: 1, steer: 0 }, 1 / 60, () => 0, undefined, rig);
  }
  assert.ok(Math.abs(small.spin[0]! / lunar.spin[0]! - ROVER.wheelRadius / rig.wheelRadius) < 1e-6, "the smaller wheel turns more for the same distance, in the ratio of the radii");
  const tilted = driveStep(startDrive(0, 0, 0, 0), { throttle: 0, steer: 0 }, 0.05, slope, undefined, rig);
  assert.ok(tilted.pitch > 0, "nose up on a rising slope");
  const eye = driveView(startDrive(0, 0, 90, 0), "seat", { azimuth: 0, pitch: 0 }, () => 0, "head", rig).eye;
  assert.ok(Math.abs(eye.up - 1.9) < 1e-9 && Math.abs(eye.north - -0.5) < 1e-9, "the seat view is at the model's eye");
  assert.ok(Math.abs(eye.east - -0.2) < 1e-9, "heading east: 0.2 m behind the middle is 0.2 m west, and the model's right (0.5 m) is south");
});

test("the shadow of a model is a box the size of its body, placed where the vehicle is", () => {
  const rig = rigOf({ ...nodes, at: inDrive(nodes.at) })!;
  const [part] = modelShadowParts({ east: 10, north: 20, heading: 0, pitch: 0, roll: 0, y: 5 }, rig, 1.2);
  const xs = part!.position.filter((_, i) => i % 3 === 0);
  const zs = part!.position.filter((_, i) => i % 3 === 2);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 2.2 * 0.8) < 1e-9);
  assert.ok(Math.abs((Math.max(...zs) + Math.min(...zs)) / 2 - 20) < 1e-9);
  assert.ok(Math.min(...part!.position.filter((_, i) => i % 3 === 1)) >= 5 + rig.wheelRadius - 1e-9, "above the wheels' axles");
});
