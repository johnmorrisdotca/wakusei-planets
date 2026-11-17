// The pose a view asks for: the body's own pose, turned by the controller's yaw, tilt and roll. Pure.
import type { Pose } from "../ephemeris.ts";
import { turn, type Vec3 } from "../vec.ts";

const VERTICAL: Vec3 = [0, 1, 0];
const ACROSS: Vec3 = [1, 0, 0];
const TOWARD: Vec3 = [0, 0, 1];

function turnAll(pose: Pose, axis: Vec3, degrees: number): void {
  pose.pole = turn(pose.pole, axis, degrees);
  pose.meridian = turn(pose.meridian, axis, degrees);
  pose.light = turn(pose.light, axis, degrees);
}

/**
 * The pose for a view. Usually `yaw` turns the body about its own pole. While the view tumbles (the controller turns it about all three axes) `yaw` turns the whole picture about the picture's vertical,
 * as the controller's own orientation does, because a turn about a pole that is tipped in the picture is not the same pose for the two sets of angles `(yaw, tilt, roll)` and `(yaw + 180, 180 - tilt, roll + 180)`
 * that the controller swaps between at a pole, and the body would jump there.
 * @param base The body's pose before the view.
 * @param yaw Degrees about the pole, or about the picture's vertical while `tumble` is true.
 * @param tilt Degrees about the picture's horizontal axis, as the element turns it (minus the controller's).
 * @param roll Degrees about the line of sight, as the element turns it: minus the controller's roll, except in a tumble, where the controller's roll goes in as it is. The orientation the controller tumbles has the three turns in the opposite handedness to the element's ordinary pose, and with the roll's sign kept the pose is a smooth function of it.
 * @param tumble True while the controller tumbles the view.
 * @returns A new pose.
 */
export function viewPose(base: Pose, yaw: number, tilt: number, roll: number, tumble: boolean): Pose {
  const pose: Pose = { pole: base.pole, meridian: base.meridian, light: base.light };
  if (yaw !== 0) {
    if (tumble) turnAll(pose, VERTICAL, yaw);
    else pose.meridian = turn(pose.meridian, pose.pole, yaw);
  }
  if (tilt !== 0) turnAll(pose, ACROSS, tilt);
  if (roll !== 0) turnAll(pose, TOWARD, roll);
  return pose;
}
