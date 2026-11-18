// A view that tumbles about all three axes keeps a body whose pole is tipped in the picture moving smoothly. The controller (kazoku-ui) turns its orientation in small steps and reports it as yaw, tilt and roll, which fold at a pole;
// the pose drawn from those numbers must not jump where they fold.
import assert from "node:assert/strict";
import { test } from "node:test";
import { eulerFromQuat, quatIdentity, spinLocal } from "@johnmorrisdotca/kazoku-ui/view-controls";
import type { Pose } from "../src/ephemeris.ts";
import { viewPose } from "../src/scene/tumble.ts";
import { RAD, turn, type Vec3 } from "../src/vec.ts";

const angleBetween = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / RAD;
/** A body whose pole is tipped 22 degrees toward the viewer and 23.4 degrees across, as a portrait's pole and an axial tilt tip it. */
const base = (): Pose => {
  const pole = turn(turn([0, 1, 0], [1, 0, 0], 22), [0, 0, 1], 23.4);
  const meridian = turn(turn([0, 0, 1], [1, 0, 0], 22), [0, 0, 1], 23.4);
  return { pole, meridian, light: [0, 0.3, 0.95] };
};

/** The element turns by minus the controller's tilt, and by minus its roll except in a tumble, where the roll goes in as it is (`#sceneOf`), which this does too. The biggest step the pole or the meridian takes between two frames of a tumble, in degrees, and the tumble's own step. */
function worstStep(tumble: boolean): number {
  let q = quatIdentity();
  let last: Pose | undefined;
  let worst = 0;
  for (let i = 0; i < 3000; i += 1) {
    q = spinLocal(q, 0.2, 1.1, 0.3);
    const { yaw, tilt, roll } = eulerFromQuat(q);
    const pose = tumble ? viewPose(base(), yaw, -tilt, roll, true) : viewPose(base(), yaw, -tilt, -roll, false);
    if (last !== undefined) worst = Math.max(worst, angleBetween(pose.pole, last.pole), angleBetween(pose.meridian, last.meridian));
    last = pose;
  }
  return worst;
}

test("a tumbling view with a tipped pole moves by about its own step, never jumping where yaw and roll fold", () => {
  assert.ok(worstStep(true) < 3, `${worstStep(true)} degrees in one frame`);
});

test("a body turned about its pole does jump at the fold, which is why a tumble draws about the picture's vertical", () => {
  assert.ok(worstStep(false) > 20, `${worstStep(false)} degrees in one frame`);
});

test("with the pole upright the two ways give the same pose, with no roll, so an ordinary yaw and tilt do not change", () => {
  const upright: Pose = { pole: [0, 1, 0], meridian: [0, 0, 1], light: [0.3, 0.2, 0.9] };
  for (const [yaw, tilt, roll] of [[40, 0, 0], [-120, 30, 0], [75, -50, 0]] as const) {
    const a = viewPose(upright, yaw, tilt, roll, false);
    const b = viewPose(upright, yaw, tilt, roll, true);
    assert.ok(angleBetween(a.pole, b.pole) < 1e-6 && angleBetween(a.meridian, b.meridian) < 1e-6, `${yaw},${tilt},${roll}`);
  }
});
