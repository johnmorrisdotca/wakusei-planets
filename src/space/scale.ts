// The two scales the space view can show. The true one is the Earth's radius for a unit and the real distances in it; the compressed one keeps every direction but squeezes the
// distances so that the Moon, the Sun and Neptune fit one view. Pure.
import { BODIES } from "../facts.ts";
import type { Vec3 } from "../vec.ts";
import { AU_IN_EARTH_RADII, EARTH_RADIUS_KM, type SpacePlanet } from "./frame.ts";

/**
 * The scale the space view is drawn in: `compressed` squeezes the distances so the Moon, the Sun and Neptune fit one view, and `true` keeps the real ones.
 *
 * @example
 * ```ts
 * import { placeMoon, type ScaleMode } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const mode: ScaleMode = "compressed";
 * console.log(placeMoon(mode, [0.00257, 0, 0]));
 * ```
 */
export type ScaleMode = "compressed" | "true";

const MOON_AU = 0.00257;
/**
 * The Moon's distance in a compressed view, in Earth radii (the true one is about 60).
 *
 * @example
 * ```ts
 * import { MOON_COMPRESSED } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(MOON_COMPRESSED);
 * ```
 */
export const MOON_COMPRESSED = 10;
/**
 * The Sun's distance from the Earth in a compressed view, in Earth radii (the true one is about 23,500). One astronomical unit is this long there.
 *
 * @example
 * ```ts
 * import { SUN_COMPRESSED } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(SUN_COMPRESSED);
 * ```
 */
export const SUN_COMPRESSED = 44;

const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
const scaled = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];

/**
 * A place in astronomical units from the Earth's centre, at true distance, in Earth radii.
 *
 * @param v - The place, in astronomical units.
 * @returns The same direction, in Earth radii.
 *
 * @example
 * ```ts
 * import { truePosition } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(truePosition([0.00257, 0, 0]).map(Math.round));
 * ```
 */
export const truePosition = (v: Vec3): Vec3 => scaled(v, AU_IN_EARTH_RADII);

/**
 * The same direction at a compressed distance from the Earth: the Moon is 10 Earth radii away, and a body k times further than the Moon is k^0.25 times as far here.
 *
 * @param v - The place, in astronomical units from the Earth's centre.
 * @returns The place in Earth radii, compressed; the centre stays at the centre.
 *
 * @example
 * ```ts
 * import { compress } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(compress([0.00257, 0, 0]), compress([0, 0, 0]));
 * ```
 */
export function compress(v: Vec3): Vec3 {
  const l = length(v);
  return l === 0 ? [0, 0, 0] : scaled(v, (MOON_COMPRESSED * (l / MOON_AU) ** 0.25) / l);
}

/**
 * The Moon, from the Earth's centre.
 *
 * @param mode - The scale.
 * @param geo - The Moon's place in astronomical units from the Earth's centre.
 * @returns Where to draw it, in Earth radii.
 *
 * @example
 * ```ts
 * import { placeMoon } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(placeMoon("true", [0.00257, 0, 0]).map(Math.round));
 * ```
 */
export const placeMoon = (mode: ScaleMode, geo: Vec3): Vec3 => (mode === "true" ? truePosition(geo) : compress(geo));

/**
 * The Sun, from the Earth's centre: in a compressed view always 44 Earth radii away, in its real direction.
 *
 * @param mode - The scale.
 * @param geo - The Sun's place in astronomical units from the Earth's centre.
 * @returns Where to draw it, in Earth radii.
 *
 * @example
 * ```ts
 * import { placeSun } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(placeSun("compressed", [1, 0, 0]));
 * ```
 */
export function placeSun(mode: ScaleMode, geo: Vec3): Vec3 {
  if (mode === "true") return truePosition(geo);
  const l = length(geo);
  return l === 0 ? [0, 0, 0] : scaled(geo, SUN_COMPRESSED / l);
}

/**
 * A place `helio` astronomical units from the Sun (a planet, or a point on its orbit), round the Sun at `sun`. True: as it is. Compressed: the same direction from
 * the Sun, at 44 Earth radii times its distance in astronomical units to the power 0.45, so the Earth's own orbit is the 44 and Neptune's is about 200 (30 times as far, really).
 *
 * @param mode - The scale.
 * @param sun - Where the Sun is drawn, in Earth radii.
 * @param helio - The place in astronomical units from the Sun.
 * @returns Where to draw the place, in Earth radii from the Earth's centre.
 *
 * @example
 * ```ts
 * import { placeAround } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(placeAround("compressed", [44, 0, 0], [1, 0, 0]));
 * ```
 */
export function placeAround(mode: ScaleMode, sun: Vec3, helio: Vec3): Vec3 {
  if (mode === "true") return [sun[0] + helio[0] * AU_IN_EARTH_RADII, sun[1] + helio[1] * AU_IN_EARTH_RADII, sun[2] + helio[2] * AU_IN_EARTH_RADII];
  const l = length(helio);
  if (l === 0) return sun;
  const d = (SUN_COMPRESSED * l ** 0.45) / l;
  return [sun[0] + helio[0] * d, sun[1] + helio[1] * d, sun[2] + helio[2] * d];
}

/** The sizes a compressed view gives bodies large enough to see, in Earth radii. */
const COMPRESSED_RADIUS: Record<"sun" | "earth" | "moon" | SpacePlanet, number> = { sun: 5, earth: 1, moon: 0.9, mercury: 0.5, venus: 0.8, mars: 0.6, jupiter: 1.8, saturn: 1.6, uranus: 1.0, neptune: 1.0, pluto: 0.4 };

/**
 * A body's radius in Earth radii: the real one, or one large enough to see in a compressed view.
 *
 * @param id - The Sun, the Earth, the Moon or a planet.
 * @param mode - The scale.
 * @returns The radius to draw it at, in Earth radii.
 *
 * @example
 * ```ts
 * import { radiusIn } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(radiusIn("moon", "true").toFixed(3), radiusIn("moon", "compressed"));
 * ```
 */
export function radiusIn(id: "sun" | "earth" | "moon" | SpacePlanet, mode: ScaleMode): number {
  return mode === "true" ? BODIES[id].radiusKm / EARTH_RADIUS_KM : COMPRESSED_RADIUS[id];
}
