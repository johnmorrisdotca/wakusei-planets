// The sun and moon from a place, with the names, arguments and results of suncalc 2 (degrees, azimuth clockwise from north), written from the public methods on this package's own positions:
// the Sun from VSOP87B, the Moon from ELP2000-82B, with parallax, refraction and the Earth's turn. It is accurate to seconds of time for the Sun and about ten seconds for the Moon, where
// suncalc is accurate to a minute or two. Pure: no DOM, no three.js. `import { getTimes } from "@johnmorrisdotca/wakusei-planets/suncalc"` instead of from "suncalc" changes nothing else.
import { horizontalOf, moonEquatorial, moonPhase, refraction, sunEquatorial } from "./sky/engine.ts";
import { dayWindow, moment, moonDay, place, sunDay } from "./sky/events.ts";

/**
 * Where a body is in a place's sky: the azimuth in degrees clockwise from north (0 north, 90 east, 180 south, 270 west) and the apparent altitude (refraction included) in degrees.
 *
 * @example
 * ```ts
 * import { getPosition, type Position } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const p: Position = getPosition(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
 * console.log(p.altitude > 0);
 * ```
 */
export interface Position {
  azimuth: number;
  altitude: number;
}

/**
 * The Moon in a place's sky: the Position, the Moon's distance in kilometres and the parallactic angle in degrees.
 *
 * @example
 * ```ts
 * import { getMoonPosition, type MoonPosition } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const p: MoonPosition = getMoonPosition(new Date(Date.UTC(2026, 10, 7, 12)), 35.7, 139.7);
 * console.log(p.distance > 350000);
 * ```
 */
export interface MoonPosition extends Position {
  distance: number;
  parallacticAngle: number;
}

/**
 * The names of the Sun's times that `getTimes` gives.
 *
 * @example
 * ```ts
 * import { type SunTimeName } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const name: SunTimeName = "goldenHour";
 * console.log(name);
 * ```
 */
export type SunTimeName = "sunrise" | "sunset" | "sunriseEnd" | "sunsetStart" | "dawn" | "dusk" | "nauticalDawn" | "nauticalDusk" | "nightEnd" | "night" | "goldenHourEnd" | "goldenHour";

/**
 * The Sun's times for a day: each a `Date` or `null` when the Sun does not reach that height that day, `solarNoon` and `nadir` always there, and `alwaysUp` or `alwaysDown` when the Sun stays above or below the sunrise height all day.
 *
 * @example
 * ```ts
 * import { getTimes, type SunTimes } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const t: SunTimes = getTimes(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
 * console.log(t.sunrise instanceof Date, t.solarNoon instanceof Date);
 * ```
 */
export type SunTimes = Record<SunTimeName, Date | null> & {
  solarNoon: Date;
  nadir: Date;
  alwaysUp?: boolean;
  alwaysDown?: boolean;
  [custom: string]: Date | boolean | null | undefined;
};

/**
 * The Moon's illumination: the lit fraction 0 to 1, the phase 0 to 1 (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter), the position angle of the bright limb in degrees eastward from north, and whether it is waxing.
 *
 * @example
 * ```ts
 * import { getMoonIllumination, type MoonIllumination } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const m: MoonIllumination = getMoonIllumination(new Date(Date.UTC(2026, 10, 24, 14)));
 * console.log(m.fraction >= 0 && m.fraction <= 1);
 * ```
 */
export interface MoonIllumination {
  fraction: number;
  phase: number;
  angle: number;
  waxing: boolean;
}

/**
 * The Moon's rise, set and transits over a day. An event that does not happen that day is absent; `alwaysUp` or `alwaysDown` is set when the Moon stays above or below the horizon all day.
 *
 * @example
 * ```ts
 * import { getMoonTimes, type MoonTimes } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const t: MoonTimes = getMoonTimes(new Date(Date.UTC(2026, 10, 7, 12)), 35.7, 139.7, 540);
 * console.log(t.rise instanceof Date || t.alwaysUp === true || t.alwaysDown === true || t.rise === undefined);
 * ```
 */
export interface MoonTimes {
  rise?: Date;
  set?: Date;
  transit?: Date;
  lowerTransit?: Date;
  alwaysUp?: boolean;
  alwaysDown?: boolean;
}

/**
 * The altitudes of the Sun's times in degrees: the morning name when it rises through the angle, the evening name when it sets through it. The ones at the horizon move with the observer's height.
 *
 * @example
 * ```ts
 * import { times } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * console.log(times.map((row) => row[1]).join(", "));
 * ```
 */
export const times: Array<[number, string, string]> = [
  [-0.833, "sunrise", "sunset"],
  [-0.3, "sunriseEnd", "sunsetStart"],
  [-6, "dawn", "dusk"],
  [-12, "nauticalDawn", "nauticalDusk"],
  [-18, "nightEnd", "night"],
  [6, "goldenHourEnd", "goldenHour"],
];

/**
 * Add a time to the ones `getTimes` gives: when the Sun reaches an altitude in degrees, going up under the morning name and going down under the evening name.
 *
 * @param angle - The altitude in degrees.
 * @param riseName - The name of the time when the Sun goes up through it.
 * @param setName - The name of the time when the Sun goes down through it.
 *
 * @example
 * ```ts
 * import { addTime, times } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * addTime(-4, "morningBlueHourEnd", "blueHour");
 * console.log(times.some((row) => row[2] === "blueHour"));
 * ```
 */
export function addTime(angle: number, riseName: string, setName: string): void {
  times.push([angle, riseName, setName]);
}

/**
 * The Sun's place in the sky from a place on the Earth.
 *
 * @param date - The moment, as a `Date` (or milliseconds since 1970).
 * @param lat - Degrees north, -90 to 90.
 * @param lng - Degrees east (west negative).
 * @returns The azimuth (degrees clockwise from north) and the apparent altitude (degrees).
 *
 * @example
 * ```ts
 * import { getPosition } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const { azimuth, altitude } = getPosition(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
 * console.log(azimuth.toFixed(0), altitude.toFixed(0));
 * ```
 */
export function getPosition(date: Date | number, lat: number, lng: number): Position {
  const ms = moment(date);
  const h = horizontalOf(sunEquatorial(ms), ms, place(lat, lng));
  return { azimuth: h.azimuth, altitude: h.altitude + refraction(h.altitude) };
}

/**
 * The Moon's place in the sky from a place on the Earth.
 *
 * @param date - The moment, as a `Date` (or milliseconds since 1970).
 * @param lat - Degrees north, -90 to 90.
 * @param lng - Degrees east (west negative).
 * @returns The azimuth (degrees clockwise from north), apparent altitude (degrees), distance from the Earth's centre (kilometres) and parallactic angle (degrees).
 *
 * @example
 * ```ts
 * import { getMoonPosition } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const { distance } = getMoonPosition(new Date(Date.UTC(2026, 10, 7, 12)), 35.7, 139.7);
 * console.log(Math.round(distance / 1000));
 * ```
 */
export function getMoonPosition(date: Date | number, lat: number, lng: number): MoonPosition {
  const ms = moment(date);
  const moon = moonEquatorial(ms);
  const h = horizontalOf(moon, ms, place(lat, lng));
  return { azimuth: h.azimuth, altitude: h.altitude + refraction(h.altitude), distance: moon.distanceKm, parallacticAngle: h.parallacticAngle };
}

/**
 * The Moon's phase.
 *
 * @param date - The moment, as a `Date` (or milliseconds since 1970); now when left out.
 * @returns The lit fraction, the phase, the bright limb's position angle in degrees and whether it is waxing.
 *
 * @example
 * ```ts
 * import { getMoonIllumination } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const { fraction, waxing } = getMoonIllumination(new Date(Date.UTC(2026, 10, 24, 14)));
 * console.log(fraction.toFixed(2), waxing);
 * ```
 */
export function getMoonIllumination(date: Date | number = new Date()): MoonIllumination {
  return moonPhase(moment(date));
}

/**
 * The Sun's times for a day at a place.
 *
 * @param date - Any moment of the day, as a `Date` (or milliseconds since 1970).
 * @param lat - Degrees north, -90 to 90.
 * @param lng - Degrees east (west negative).
 * @param height - The observer's height above the horizon in metres (default 0): it lowers the sunrise and sunset altitudes by the dip of the horizon.
 * @param utcOffset - Minutes east of UTC: when given the day is the local calendar day holding `date`; when left out it is the solar day (from one solar midnight to the next) holding `date`.
 * @returns The times as `Date`s, `null` for one that does not happen that day, and `alwaysUp` or `alwaysDown` at the poles.
 *
 * @example
 * ```ts
 * import { getTimes } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const t = getTimes(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1, 0, 60);
 * console.log(t.sunrise!.toISOString().slice(0, 13));
 * ```
 */
export function getTimes(date: Date | number, lat: number, lng: number, height = 0, utcOffset?: number): SunTimes {
  const day = sunDay(moment(date), place(lat, lng, height), utcOffset, times);
  const result = { solarNoon: new Date(day.noon), nadir: new Date(day.nadir) } as SunTimes;
  for (const [name, at] of day.events) result[name] = at === null ? null : new Date(at);
  if (day.alwaysUp) result.alwaysUp = true;
  if (day.alwaysDown) result.alwaysDown = true;
  return result;
}

/**
 * The Moon's rise, set and transits over a day at a place.
 *
 * @param date - Any moment of the day, as a `Date` (or milliseconds since 1970).
 * @param lat - Degrees north, -90 to 90.
 * @param lng - Degrees east (west negative).
 * @param utcOffset - Minutes east of UTC: when given the day is the local calendar day holding `date`; when left out it is the solar day holding `date`.
 * @returns `rise`, `set`, `transit` (the Moon highest) and `lowerTransit` (lowest) as `Date`s, each absent on a day without it, with `alwaysUp` or `alwaysDown` when the Moon never crosses the horizon.
 *
 * @example
 * ```ts
 * import { getMoonTimes } from "@johnmorrisdotca/wakusei-planets/suncalc";
 *
 * const t = getMoonTimes(new Date(Date.UTC(2026, 10, 7, 12)), 35.7, 139.7, 540);
 * console.log(Object.keys(t).length > 0);
 * ```
 */
export function getMoonTimes(date: Date | number, lat: number, lng: number, utcOffset?: number): MoonTimes {
  const ms = moment(date);
  const observer = place(lat, lng);
  const [start, end] = dayWindow(ms, observer, utcOffset);
  const day = moonDay(start, end, observer);
  const result: MoonTimes = {};
  if (day.rise !== null) result.rise = new Date(day.rise);
  if (day.set !== null) result.set = new Date(day.set);
  if (day.transit !== null) result.transit = new Date(day.transit);
  if (day.lowerTransit !== null) result.lowerTransit = new Date(day.lowerTransit);
  if (day.alwaysUp) result.alwaysUp = true;
  if (day.alwaysDown) result.alwaysDown = true;
  return result;
}
