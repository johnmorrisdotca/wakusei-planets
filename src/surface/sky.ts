// The sky as a person standing on the Moon sees it: where the Sun and the Earth are, and how much of the Earth is lit. Pure: no DOM, no clock; the date is an argument.
import { apparent } from "../ephemeris.ts";
import { surfacePoint } from "../pose.ts";
import { cross, dot, unit, DEG, type Vec3 } from "../vec.ts";

/**
 * A direction in the viewer's own sky: a unit vector east, north and up (`enu`), and the same as an azimuth (degrees clockwise from north) and an altitude (degrees above the horizon).
 *
 * @example
 * ```ts
 * import { moonSky, type SkyDirection } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const sun: SkyDirection = moonSky(20.1911, 30.7723, Date.UTC(1972, 11, 11, 19, 54)).sun;
 * console.log(`${sun.azimuth.toFixed(0)} degrees clockwise from north, ${sun.altitude.toFixed(0)} degrees up`);
 * ```
 */
export interface SkyDirection {
  enu: Vec3;
  azimuth: number;
  altitude: number;
}

/**
 * What the sky holds at one place and moment.
 *
 * @example
 * ```ts
 * import { moonSky, type MoonSky } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const sky: MoonSky = moonSky(20.1911, 30.7723, Date.UTC(1972, 11, 11, 19, 54));
 * console.log(`the Earth is ${(sky.earthIllumination * 100).toFixed(0)}% lit and ${sky.earthDiameter.toFixed(1)} degrees across`);
 * ```
 */
export interface MoonSky {
  /** The Sun's centre. */
  sun: SkyDirection;
  /** The Sun's angular diameter in degrees (about 0.53 from the Moon). */
  sunDiameter: number;
  /** The Earth's centre. */
  earth: SkyDirection;
  /** The Earth's angular diameter in degrees (about 1.9). */
  earthDiameter: number;
  /** The share of the Earth's disc that is lit, 0 (new) to 1 (full). It is the opposite of the Moon's phase from the Earth: a full Moon is a new Earth. */
  earthIllumination: number;
}

const direction = (enu: Vec3): SkyDirection => ({
  enu,
  azimuth: (Math.atan2(enu[0], enu[1]) * DEG + 360) % 360,
  altitude: Math.asin(Math.max(-1, Math.min(1, enu[2]))) * DEG,
});

/**
 * The local frame of a point on the Moon at a moment: its east, north and up as unit vectors in the frame of `apparent`, in which `[0, 0, 1]` is toward the Earth.
 *
 * @param lat - Latitude in degrees, positive north.
 * @param lon - Longitude in degrees, positive east.
 * @param time - Milliseconds since 1970.
 * @returns The axes, and `toLocal`, which turns a vector of that frame into east, north and up.
 *
 * @example
 * ```ts
 * import { localFrame } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const frame = localFrame(20.1911, 30.7723, Date.UTC(1972, 11, 11, 19, 54));
 * console.log(frame.toLocal([0, 0, 1]).map((n) => n.toFixed(2)).join(", "));
 * ```
 */
export function localFrame(lat: number, lon: number, time: number): { east: Vec3; north: Vec3; up: Vec3; toLocal(v: Vec3): Vec3; light: Vec3; distanceKm: number } {
  const moon = apparent("moon", time);
  const up = surfacePoint(moon, lon, lat);
  const east = unit(cross(moon.pole, up));
  const north = cross(up, east);
  return { east, north, up, toLocal: (v) => [dot(v, east), dot(v, north), dot(v, up)], light: moon.light, distanceKm: moon.distanceKm };
}

/**
 * The Sun and the Earth in the sky of a point on the Moon at a moment, from the package's own ephemeris: the Moon's real turn and libration, the Sun's real place.
 *
 * @param lat - Latitude in degrees, positive north.
 * @param lon - Longitude in degrees, positive east.
 * @param time - Milliseconds since 1970.
 * @returns The two directions, their sizes and the Earth's lit share.
 *
 * @example
 * ```ts
 * import { moonSky } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const sky = moonSky(20.1911, 30.7723, Date.UTC(1972, 11, 11, 19, 54));
 * console.log(`the Sun is ${sky.sun.altitude.toFixed(0)} degrees up, the Earth ${sky.earth.altitude.toFixed(0)}`);
 * ```
 */
export function moonSky(lat: number, lon: number, time: number): MoonSky {
  const frame = localFrame(lat, lon, time);
  const sun = frame.toLocal(unit(frame.light));
  const earth = frame.toLocal([0, 0, 1]);
  return {
    sun: direction(sun),
    sunDiameter: 0.533,
    earth: direction(earth),
    earthDiameter: (2 * Math.asin(6371 / frame.distanceKm)) * DEG,
    earthIllumination: (1 - dot(sun, earth)) / 2,
  };
}
