// The sky as a person standing on the Moon sees it: where the Sun and the Earth are, and how much of the Earth is lit. Pure: no DOM, no clock; the date is an argument.
import { apparent, heliocentric } from "../ephemeris.ts";
import { surfacePoint } from "../pose.ts";
import { cross, dot, length, unit, DEG, type Vec3 } from "../vec.ts";

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
 * @param body - `moon` (the default) or `mars`; on Mars `[0, 0, 1]` is toward the Earth too, the frame being the viewer's.
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
export function localFrame(lat: number, lon: number, time: number, body: "moon" | "mars" = "moon"): { east: Vec3; north: Vec3; up: Vec3; toLocal(v: Vec3): Vec3; light: Vec3; distanceKm: number } {
  const moon = apparent(body, time);
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

/**
 * A colour as red, green and blue, 0 to 1, in linear light.
 *
 * @example
 * ```ts
 * import { marsAir, type Rgb } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const zenith: Rgb = marsAir(40).zenith;
 * console.log(zenith.map((c) => c.toFixed(2)).join(", "));
 * ```
 */
export type Rgb = readonly [number, number, number];

/**
 * The air over a site, for a body that has some (Mars): the colours of the sky and the light the ground gets from it. All are stylised from a few facts, not measured: NASA says the Martian sky is hazy and
 * reddish-tan by day from suspended dust; the pale blue round the Sun when it is low, and the long twilight, are chosen here, not taken from a measurement.
 *
 * @example
 * ```ts
 * import { marsAir } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const noon = marsAir(60);
 * const dusk = marsAir(2);
 * console.log(noon.glowSize > dusk.glowSize, marsAir(-30).daylight);
 * ```
 */
export interface SkyAir {
  /** 0 (night) to 1 (full day): the share of day the sky shows. */
  daylight: number;
  /** The sky at the horizon, at the zenith and round the Sun, already scaled by the daylight. */
  horizon: Rgb;
  zenith: Rgb;
  glow: Rgb;
  /** The glow's width as the sine of its half angle. */
  glowSize: number;
  /** The share of a lit slope's light the shade gets from the sky (the ground's `uEarthshine`); 0.05 on the Moon. */
  ambient: number;
  /** The ground's colour over its grey. */
  tint: Rgb;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The sky colours of Mars for a height of the Sun: butterscotch by day, a blue glow round a low Sun, black at night, with a twilight that lasts until the Sun is about 12 degrees down (dust holds the light).
 *
 * @param sunAltitude - The Sun's height over the horizon in degrees.
 * @returns The colours and the light the sky gives the ground.
 *
 * @example
 * ```ts
 * import { marsAir } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const air = marsAir(25);
 * console.log(air.daylight.toFixed(2), air.zenith.map((c) => c.toFixed(2)).join(" "));
 * ```
 */
export function marsAir(sunAltitude: number): SkyAir {
  const day = smooth(-12, 8, sunAltitude);
  const low = 1 - smooth(2, 28, sunAltitude); // 1 with the Sun at the horizon: the blue glow
  const horizon: Rgb = [0.62, 0.40, 0.26];
  const zenith: Rgb = [0.30, 0.17, 0.10];
  const tan: Rgb = [0.75, 0.50, 0.34];
  const blue: Rgb = [0.16, 0.32, 0.62];
  const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const k = (c: Rgb): Rgb => [c[0] * day, c[1] * day, c[2] * day];
  return {
    daylight: day,
    horizon: k(horizon),
    zenith: k(zenith),
    glow: k(mix(tan, blue, low)),
    glowSize: 0.12 + 0.2 * (1 - low),
    ambient: 0.05 + 0.22 * day,
    tint: [1.0, 0.72, 0.5],
  };
}

/**
 * How a cast shadow is painted. With no air the shadow is black. On Mars the dusty sky fills it, so in daylight it is a dark brown-grey, and at night it is black again.
 *
 * @param air - The sky's light, or `null` where there is none (the Moon).
 * @returns The colour the shade is drawn toward, and how much of the ground it covers.
 */
export function shadowFill(air: SkyAir | null): { rgb: Rgb; cover: number } {
  if (air === null) return { rgb: [0, 0, 0], cover: 0.85 };
  const share = 0.4;
  return {
    rgb: [air.zenith[0] * share, air.zenith[1] * share, air.zenith[2] * share],
    cover: 0.85 - 0.25 * air.daylight,
  };
}

/**
 * What a standing view's sky holds: the Moon's (the Sun and the Earth, no air) or Mars's (the Sun, the Earth as a point, and the air).
 *
 * @example
 * ```ts
 * import { standSky, type StandSky } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const sky: StandSky = standSky("mars", 18.4446, 77.4508, Date.UTC(2021, 1, 18, 20, 43));
 * console.log(sky.body, sky.air !== null, `${sky.sunDiameter.toFixed(2)} degrees`);
 * ```
 */
export interface StandSky extends MoonSky {
  body: "moon" | "mars";
  /** The air, or `null` where there is none (the Moon: a black sky). */
  air: SkyAir | null;
  /** Whether the Earth is drawn as a disc (the Moon's sky has it 1.9 degrees across; from Mars it is a point). */
  earthDisc: boolean;
}

/**
 * The sky at a point on the Moon or Mars at a moment, from the package's own ephemeris. On Mars the Sun's disc is its size from Mars's own distance (about 0.35 degrees, 0.533 over its distance in astronomical units).
 *
 * @param body - `moon` or `mars`.
 * @param lat - Latitude in degrees, positive north.
 * @param lon - Longitude in degrees, positive east.
 * @param time - Milliseconds since 1970.
 * @returns The Sun, the Earth, and the air.
 *
 * @example
 * ```ts
 * import { standSky } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const sky = standSky("mars", -4.5895, 137.4417, Date.UTC(2012, 7, 6, 5, 17));
 * console.log(`the Sun is ${sky.sun.altitude.toFixed(0)} degrees up and ${sky.sunDiameter.toFixed(2)} degrees across`);
 * ```
 */
export function standSky(body: "moon" | "mars", lat: number, lon: number, time: number): StandSky {
  if (body === "moon") return { ...moonSky(lat, lon, time), body, air: null, earthDisc: true };
  const frame = localFrame(lat, lon, time, "mars");
  const sun = frame.toLocal(unit(frame.light));
  const earth = frame.toLocal([0, 0, 1]);
  const sunAu = length(heliocentric("mars", time));
  const sunDirection = direction(sun);
  return {
    body,
    sun: sunDirection,
    sunDiameter: 0.533 / sunAu,
    earth: direction(earth),
    earthDiameter: 0.003,
    earthIllumination: (1 - dot(sun, earth)) / 2,
    air: marsAir(sunDirection.altitude),
    earthDisc: false,
  };
}
