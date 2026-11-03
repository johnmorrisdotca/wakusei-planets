// How a body is turned in space at a time, in the axes of an equatorial J2000 scene with y up (x to the vernal equinox, y to the celestial north pole, z toward -y of the equator).
// Pure: no three.js. The painter uses it to turn each body about its real pole, and to find where a moon is round its planet.
import { moonVector } from "../ephemeris.ts";
import { BODIES, type BodyId, type MoonId } from "../facts.ts";
import { cross, dot, fromRaDec, OBLIQUITY, RAD, unit, wrap360, type Vec3 } from "../vec.ts";

const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY = 86_400_000;

/** An equatorial vector (x to the vernal equinox, z to the north pole) in the scene's axes. */
const toScene = (v: Vec3): Vec3 => [v[0], v[2], -v[1]];

/** An ecliptic J2000 vector in equatorial J2000 axes. */
const fromEcliptic = (v: Vec3): Vec3 => {
  const c = Math.cos(OBLIQUITY * RAD);
  const s = Math.sin(OBLIQUITY * RAD);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
};

/**
 * Where a moon is from its planet's centre, in planet radii, in the scene's axes (x to the vernal equinox, y north).
 *
 * @param id - The moon's name.
 * @param ms - The instant, in milliseconds since 1970.
 * @returns The offset, in radii of the planet the moon goes round.
 *
 * @example
 * ```ts
 * import { moonOffset } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const [x, y, z] = moonOffset("io", Date.UTC(2026, 10, 2));
 * console.log(Math.hypot(x, y, z).toFixed(1));
 * ```
 */
export function moonOffset(id: MoonId, ms: number): Vec3 {
  const facts = BODIES[id];
  const radius = BODIES[facts.parent ?? "earth"].radiusKm;
  const v = toScene(fromEcliptic(moonVector(id, ms)));
  return [v[0] / radius, v[1] / radius, v[2] / radius];
}

/**
 * The north pole and the prime meridian of a body at a time, as unit vectors in the scene's axes (x to the vernal equinox, y north). A moon that keeps one face to its planet is
 * given the direction to the planet as its meridian, so its near side faces the planet.
 *
 * @param id - The body's name.
 * @param ms - The instant, in milliseconds since 1970.
 * @returns The pole and the direction of longitude 0, both unit vectors.
 *
 * @example
 * ```ts
 * import { orientation } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const { pole } = orientation("mars", Date.UTC(2026, 10, 2));
 * console.log(pole.map((n) => n.toFixed(2)).join(", "));
 * ```
 */
export function orientation(id: BodyId, ms: number): { pole: Vec3; meridian: Vec3 } {
  const facts = BODIES[id];
  const { ra, dec } = facts.pole;
  const pole = fromRaDec(ra, dec);
  let meridian: Vec3;
  if (facts.synchronous === true && facts.parent !== undefined) {
    const planetward = unit(fromEcliptic(moonVector(id as MoonId, ms)).map((n) => -n) as unknown as Vec3);
    const d = dot(planetward, pole);
    meridian = unit([planetward[0] - pole[0] * d, planetward[1] - pole[1] * d, planetward[2] - pole[2] * d]);
  } else {
    const w = wrap360(facts.prime.w0 + facts.prime.rate * ((ms - J2000) / DAY));
    const node = fromRaDec(ra + 90, 0);
    const third = cross(pole, node);
    const c = Math.cos(w * RAD);
    const s = Math.sin(w * RAD);
    meridian = [node[0] * c + third[0] * s, node[1] * c + third[1] * s, node[2] * c + third[2] * s];
  }
  return { pole: toScene(pole), meridian: toScene(meridian) };
}
