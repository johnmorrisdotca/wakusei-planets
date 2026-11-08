// Which way the camera sits from the body it looks at: over a place on the Earth's surface as the stars saw it at one moment. Pure.
import { orientation } from "../scene/orient.ts";
import { cross, RAD, type Vec3 } from "../vec.ts";

/**
 * The unit direction, in the scene's axes, of a longitude and latitude on the Earth as the stars see it at `ms`: the camera fixed to the stars looks at the same place on the ground only at that moment, and the Earth turns away under it as time runs.
 *
 * @param lon - Degrees east.
 * @param lat - Degrees north.
 * @param ms - The moment, in milliseconds since the Unix epoch.
 * @returns The direction from the Earth's centre.
 *
 * @example
 * ```ts
 * import { groundDirection } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const [x, y, z] = groundDirection(0, 90, Date.UTC(2026, 10, 2));
 * console.log(y.toFixed(2));
 * ```
 */
export function groundDirection(lon: number, lat: number, ms: number): Vec3 {
  const { pole, meridian } = orientation("earth", ms);
  const east = cross(pole, meridian);
  const c = Math.cos(lat * RAD);
  const along = c * Math.cos(lon * RAD);
  const across = c * Math.sin(lon * RAD);
  const up = Math.sin(lat * RAD);
  return [meridian[0] * along + east[0] * across + pole[0] * up, meridian[1] * along + east[1] * across + pole[1] * up, meridian[2] * along + east[2] * across + pole[2] * up];
}
