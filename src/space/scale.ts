// The two scales the space view can show. The true one is the Earth's radius for a unit and the real distances in it; the compressed one keeps every direction but squeezes the
// distances so that the Moon, the Sun and Neptune fit one view. Pure.
import { BODIES, MOONS_OF, type MoonId } from "../facts.ts";
import { meanSunAu } from "../ephemeris.ts";
import { moonOffset } from "../scene/orient.ts";
import type { Vec3 } from "../vec.ts";
import { AU_IN_EARTH_RADII, EARTH_RADIUS_KM, type SpaceFrame, type SpacePlanet } from "./frame.ts";

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
 * The Moon's distance in a compressed view, in Earth radii (the true one is about 60). It is well inside the gap between the Earth's orbit and the next one in.
 *
 * @example
 * ```ts
 * import { MOON_COMPRESSED } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(MOON_COMPRESSED);
 * ```
 */
export const MOON_COMPRESSED = 3.5;
/**
 * One astronomical unit in a compressed view, in Earth radii (the true one is about 23,500): the Sun is this far from the Earth, and each planet's distance from the Sun is this times its distance in astronomical units to the power 0.45.
 *
 * @example
 * ```ts
 * import { SUN_COMPRESSED } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(SUN_COMPRESSED);
 * ```
 */
export const SUN_COMPRESSED = 70;
const SPREAD = 0.45;

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
 * The Sun, from the Earth's centre. In a compressed view it is in its real direction at the distance the Earth's orbit has from the Sun there, so the Earth lies on its own orbit.
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
  return l === 0 ? [0, 0, 0] : scaled(geo, (SUN_COMPRESSED * l ** SPREAD) / l);
}

/**
 * A place `helio` astronomical units from the Sun (a planet, or a point on its orbit), round the Sun at `sun`. True: as it is. Compressed: the same direction from
 * the Sun, at `SUN_COMPRESSED` Earth radii times its distance in astronomical units to the power 0.45, so Neptune's orbit is about 4.6 times the Earth's (30 times as far, really).
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
  const d = (SUN_COMPRESSED * l ** SPREAD) / l;
  return [sun[0] + helio[0] * d, sun[1] + helio[1] * d, sun[2] + helio[2] * d];
}

type BaseBody = "sun" | "earth" | "moon" | SpacePlanet;

/** The sizes a compressed view gives bodies large enough to see, in Earth radii. The Moon is at its true size beside the Earth (0.273 of it), so it never looks as big as the Earth. */
const COMPRESSED_RADIUS: Record<"sun" | "earth" | "moon" | SpacePlanet, number> = { sun: 5, earth: 1, moon: 0.273, mercury: 0.5, venus: 0.8, mars: 0.6, jupiter: 1.8, saturn: 1.6, uranus: 1.0, neptune: 1.0, pluto: 0.4 };

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

/** The planets, nearest the Sun first, whose orbits a moon's orbit must not reach across in a compressed view. */
const ORBIT_ROW = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
const compressedOrbit = (au: number): number => SUN_COMPRESSED * au ** SPREAD;

/** The room a planet's moons have round it in a compressed view, in Earth radii: well inside the gap to the nearer of the orbits next to its own. */
function room(host: SpacePlanet): number {
  const at = ORBIT_ROW.indexOf(host as (typeof ORBIT_ROW)[number]);
  if (at < 0) return Number.POSITIVE_INFINITY;
  const mine = compressedOrbit(meanSunAu(host));
  const gaps = [ORBIT_ROW[at - 1], ORBIT_ROW[at + 1]].filter((id) => id !== undefined).map((id) => Math.abs(compressedOrbit(meanSunAu(id)) - mine));
  return 0.35 * Math.min(...gaps);
}

const reaches = new Map<SpacePlanet, number>();
/** How far out a body's moons go, in its radii: the farthest any of them is found in a year of looks. */
function reachOf(host: SpacePlanet): number {
  let reach = reaches.get(host);
  if (reach === undefined) {
    reach = 0;
    const start = Date.UTC(2026, 0, 1);
    for (const moon of (MOONS_OF as Record<string, readonly MoonId[]>)[host] ?? []) for (let i = 0; i < 24; i += 1) reach = Math.max(reach, length(moonOffset(moon, start + i * 15 * 86_400_000)));
    reaches.set(host, reach);
  }
  return reach;
}

/**
 * How far from its planet a moon is drawn, in the planet's radii, when it is really `distance` radii away. True: as it is. Compressed: the same, until the farthest of the planet's moons would
 * reach across the gap to the next planet's orbit; then every moon is drawn nearer, the farthest at about a third of the gap and the nearer ones in the order they are, so no moon's orbit crosses another planet's.
 *
 * @param mode - The scale.
 * @param host - The planet or dwarf planet the moon goes round.
 * @param distance - The moon's distance from the centre of the planet, in the planet's radii.
 * @returns The distance to draw it at, in the planet's radii.
 *
 * @example
 * ```ts
 * import { moonDistance } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(moonDistance("compressed", "neptune", 222).toFixed(1));
 * ```
 */
export function moonDistance(mode: ScaleMode, host: SpacePlanet, distance: number): number {
  if (mode === "true") return distance;
  const reach = reachOf(host);
  const radius = radiusIn(host, "compressed");
  const space = room(host);
  if (reach === 0 || reach * radius <= space) return distance;
  return Math.min(distance, (space * Math.sqrt(distance / reach)) / radius);
}

/**
 * Where every body of the view is, in Earth radii from the Earth's centre, at one moment: the Earth at the centre, the Moon, the Sun and the planets. The same mapping places
 * the bodies and the lines of their orbits (`orbitLine`), so a body is always on its own orbit.
 *
 * @param mode - The scale.
 * @param frame - Where everything is, from `frameAt`.
 * @returns The place of each body.
 *
 * @example
 * ```ts
 * import { frameAt, placeBodies } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const places = placeBodies("compressed", frameAt(Date.UTC(2026, 10, 2)));
 * console.log(Object.keys(places).length);
 * ```
 */
export function placeBodies(mode: ScaleMode, frame: SpaceFrame): Record<BaseBody, Vec3> {
  const sun = placeSun(mode, frame.sun);
  const all = { earth: [0, 0, 0] as Vec3, moon: placeMoon(mode, frame.moon), sun } as Record<BaseBody, Vec3>;
  const helio = (geo: Vec3): Vec3 => [geo[0] - frame.sun[0], geo[1] - frame.sun[1], geo[2] - frame.sun[2]];
  for (const [id, geo] of Object.entries(frame.planets) as [SpacePlanet, Vec3][]) all[id] = placeAround(mode, sun, helio(geo));
  return all;
}

/**
 * The line of a body's orbit as the view draws it: the points from `planetOrbit` (astronomical units from the Sun) placed round the Sun at `sun` by the same mapping as the bodies.
 *
 * @param mode - The scale.
 * @param sun - Where the Sun is drawn, from `placeSun` or `placeBodies`.
 * @param points - The orbit, from `planetOrbit`.
 * @returns The same points, in Earth radii from the Earth's centre.
 *
 * @example
 * ```ts
 * import { frameAt, orbitLine, placeSun, planetOrbit } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const ms = Date.UTC(2026, 10, 2);
 * console.log(orbitLine("compressed", placeSun("compressed", frameAt(ms).sun), planetOrbit("earth", ms, 24)).length);
 * ```
 */
export const orbitLine = (mode: ScaleMode, sun: Vec3, points: readonly Vec3[]): Vec3[] => points.map((p) => placeAround(mode, sun, p));
