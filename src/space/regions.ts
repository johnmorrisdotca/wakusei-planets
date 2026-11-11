// Views of a region round the Sun: the inner planets, the asteroid belt, the outer planets, the Kuiper belt and the whole system, each a set of orbits framed so the outermost fits the picture. The sets are
// names of bodies; how far out each goes is read from the package's own orbits at the moment asked, in either scale, never typed in. Pure.
import type { Vec3 } from "../vec.ts";
import { cross, dot, length, sub, unit } from "../vec.ts";
import { frameAt, planetOrbit, SPACE_DWARFS, SPACE_MINORS, SPACE_PLANETS, type SpaceDwarf, type SpaceMinor, type SpacePlanet } from "./frame.ts";
import { placeAround, placeSun, type ScaleMode } from "./scale.ts";
import type { TravelView } from "./travel.ts";

type Orbiter = "earth" | SpacePlanet | SpaceDwarf | SpaceMinor;

/**
 * The stages a view steps out through from the Sun, nearest first: each has an `id`, a name in English and Japanese for a button or a step, and the bodies whose orbits make it. The inner planets are Mercury
 * to Mars; the asteroid belt is Vesta, Ceres and Pallas, whose orbits reach its outer edge; the outer planets are Jupiter to Neptune; the Kuiper belt is Pluto and the dwarf planets out to Eris; the whole
 * system is every orbit the space view draws, Sedna's and Halley's among them.
 *
 * @example
 * ```ts
 * import { SUN_REGIONS } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(SUN_REGIONS.map((region) => `${region.id}: ${region.name.en} / ${region.name.ja}`).join("\n"));
 * ```
 */
export const SUN_REGIONS = [
  { id: "inner-planets", name: { en: "Inner planets", ja: "内太陽系" }, bodies: ["mercury", "venus", "earth", "mars"] },
  { id: "asteroid-belt", name: { en: "Asteroid belt", ja: "小惑星帯" }, bodies: ["vesta", "ceres", "pallas"] },
  { id: "outer-planets", name: { en: "Outer planets", ja: "外太陽系" }, bodies: ["jupiter", "saturn", "uranus", "neptune"] },
  { id: "kuiper-belt", name: { en: "Kuiper belt", ja: "カイパーベルト" }, bodies: ["pluto", "orcus", "haumea", "quaoar", "makemake", "gonggong", "eris"] },
  { id: "whole-system", name: { en: "Whole solar system", ja: "太陽系全体" }, bodies: ["earth", ...SPACE_PLANETS, ...SPACE_DWARFS, ...SPACE_MINORS] },
] as const satisfies readonly { id: string; name: { en: string; ja: string }; bodies: readonly Orbiter[] }[];

/**
 * The `id` of one of the stages in `SUN_REGIONS`.
 *
 * @example
 * ```ts
 * import type { SunRegion } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const stage: SunRegion = "asteroid-belt";
 * console.log(stage);
 * ```
 */
export type SunRegion = (typeof SUN_REGIONS)[number]["id"];

/**
 * The orbit lines of a stage as the space view draws them at `ms`: one line of points for each of its bodies, in the scene's unit (Earth radii from the Earth's centre) for the scale asked, from `planetOrbit`
 * and the same mapping that places the bodies.
 *
 * @param region - The stage's `id`.
 * @param mode - The scale.
 * @param ms - The moment, in milliseconds since the Unix epoch.
 * @param count - How many segments each orbit is cut into.
 * @returns One line for each body of the stage.
 *
 * @example
 * ```ts
 * import { regionOrbits } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const lines = regionOrbits("inner-planets", "compressed", Date.UTC(2026, 10, 11));
 * console.log(lines.length, lines[0]!.length);
 * ```
 */
export function regionOrbits(region: SunRegion, mode: ScaleMode, ms: number, count = 96): Vec3[][] {
  const sun = placeSun(mode, frameAt(ms).sun);
  const bodies: readonly Orbiter[] = SUN_REGIONS.find((entry) => entry.id === region)!.bodies;
  return bodies.map((id) => planetOrbit(id, ms, count).map((p) => placeAround(mode, sun, p)));
}

/**
 * The view that fits a region: the camera looks at `centre` along `forward` with `up` up (pass the view's own, so stepping out or in does not swing the picture), from the nearest distance at which every point
 * of `orbits` is inside the picture with `margin` of its half width and height to spare (0.9 when left out). `reach` is how far the farthest point is from the centre: give it to the `TravelBody` of the
 * centre so `travelPose` makes the move a straight pull back or push in.
 *
 * @param input - The centre's place, the orbit lines, the picture's width over its height, the direction to look along and its up, and optionally the field of view in degrees (35) and the margin.
 * @returns The camera, and the region's `reach`.
 *
 * @example
 * ```ts
 * import { frameAt, placeSun, regionOrbits, regionView } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const ms = Date.UTC(2026, 10, 11);
 * const sun = placeSun("compressed", frameAt(ms).sun);
 * const view = regionView({ centre: sun, orbits: regionOrbits("outer-planets", "compressed", ms), aspect: 16 / 9, forward: [0, -0.6, -0.8], up: [0, 0.8, -0.6] });
 * console.log(view.reach.toFixed(0), view.fov);
 * ```
 */
export function regionView(input: { centre: Vec3; orbits: readonly (readonly Vec3[])[]; aspect: number; forward: Vec3; up: Vec3; fov?: number; margin?: number }): TravelView & { reach: number } {
  const forward = unit(input.forward);
  const lifted = sub(input.up, [forward[0] * dot(input.up, forward), forward[1] * dot(input.up, forward), forward[2] * dot(input.up, forward)]);
  const up = unit(length(lifted) < 1e-9 ? cross(Math.abs(forward[1]) < 0.9 ? cross(forward, [0, 1, 0]) : cross(forward, [1, 0, 0]), forward) : lifted);
  const right = cross(forward, up);
  const fov = input.fov ?? 35;
  const margin = input.margin ?? 0.9;
  const tv = Math.tan((fov / 2) * (Math.PI / 180)) * margin;
  const th = tv * Math.max(1e-3, input.aspect);
  let distance = 0;
  let reach = 0;
  for (const line of input.orbits) {
    for (const point of line) {
      const v = sub(point, input.centre);
      reach = Math.max(reach, length(v));
      // the camera is `distance` back along the line of sight: the point is inside when its offset across and up is within the frame at its depth
      distance = Math.max(distance, Math.abs(dot(v, right)) / th - dot(v, forward), Math.abs(dot(v, up)) / tv - dot(v, forward));
    }
  }
  return { position: [input.centre[0] - forward[0] * distance, input.centre[1] - forward[1] * distance, input.centre[2] - forward[2] * distance], forward, up, fov, reach };
}
