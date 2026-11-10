// The scene's axes for a test: a direction from right ascension and declination, and an equatorial vector as the scene (J2000 equatorial, y north) has it. Not a test file.
import { fromRaDec as direction } from "../src/vec.ts";

export const fromRaDec = (ra: number, dec: number): [number, number, number] => [...direction(ra, dec)] as [number, number, number];
/** The scene takes the pole as an equatorial vector with y north: x to the vernal equinox, z along the equator's other axis. */
export const toScene = (v: [number, number, number]): [number, number, number] => {
  return [v[0], v[2], -v[1]];
};
