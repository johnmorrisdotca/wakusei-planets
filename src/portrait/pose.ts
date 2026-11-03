// How one body of a portrait is turned: from its own spin, tilt and pitch, or from the sky at a date, then carried forward by its own turning. Pure.
import { apparent, type Pose } from "../ephemeris.ts";
import { BODIES, type BodyId } from "../facts.ts";
import { portrait } from "../pose.ts";
import { turn, type Vec3 } from "../vec.ts";
import { lightVector, type Item } from "./model.ts";

/** The pitch a body is drawn at when none is chosen: a little over the pole, more for a body with rings. */
export const defaultPitch = (id: BodyId): number => (BODIES[id].rings !== undefined ? 22 : 12);

/**
 * The pole and the prime meridian of a body in the picture's frame (x right, y up, z toward the viewer), after `seconds` of its own turning.
 * With a date the body is turned as the Earth sees it then, and the item's `spin` is how far it is turned from that (from the longitude its portrait shows).
 */
export function poseOf(item: Pick<Item, "body" | "spin" | "tilt" | "pitch" | "turn">, ms: number | undefined, seconds: number, light: { az: number; el: number }): Pose {
  const facts = BODIES[item.body];
  const toSun = lightVector(light);
  let pole: Vec3;
  let meridian: Vec3;
  if (ms !== undefined) {
    const sky = apparent(item.body, ms);
    pole = sky.pole;
    meridian = turn(sky.meridian, pole, -(item.spin - (facts.showLon ?? 0)));
  } else {
    const base = portrait(item.body, { spin: item.spin, pitch: item.pitch ?? defaultPitch(item.body), ...(item.tilt !== undefined ? { tilt: item.tilt } : {}) });
    pole = base.pole;
    meridian = base.meridian;
  }
  if (item.turn !== 0 && seconds !== 0) meridian = turn(meridian, pole, item.turn * seconds);
  return { pole, meridian, light: toSun };
}
