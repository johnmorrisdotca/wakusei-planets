// The sun and moon from a place with the conventions of suncalc 1.x, so code written for it changes only its import: angles in radians, the azimuth measured from south toward west, the Sun's altitude
// without refraction and the Moon's with it, an event that does not happen as an invalid `Date`, the Moon's day running from midnight (local, or UTC) for 24 hours, and a bright-limb angle that is
// negative while the Moon waxes. The numbers come from the same engine as `suncalc` (VSOP87B and ELP2000-82B, seconds of time). Pure: no DOM, no three.js.
import { horizontalOf, moonEquatorial, moonPhase, refraction, sunEquatorial } from "./sky/engine.ts";
import { moment, moonDay, place, sunDay } from "./sky/events.ts";

const RAD = Math.PI / 180;
/** An azimuth in degrees clockwise from north as radians from south toward west (south 0, west a quarter turn). */
const fromSouth = (azimuth: number): number => (((azimuth - 180 + 540) % 360) - 180) * RAD;

/**
 * Where a body is: the azimuth in radians from south toward west (0 south, a quarter turn west) and the altitude in radians.
 *
 * @example
 * ```ts
 * import { getPosition, type LegacyPosition } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const p: LegacyPosition = getPosition(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
 * console.log(p.altitude > 0);
 * ```
 */
export interface LegacyPosition {
  azimuth: number;
  altitude: number;
}

/**
 * The Moon in a place's sky: the LegacyPosition, the distance in kilometres and the parallactic angle in radians.
 *
 * @example
 * ```ts
 * import { getMoonPosition, type LegacyMoonPosition } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const p: LegacyMoonPosition = getMoonPosition(new Date(Date.UTC(2026, 10, 7, 12)), 35.7, 139.7);
 * console.log(p.distance > 350000);
 * ```
 */
export interface LegacyMoonPosition extends LegacyPosition {
  distance: number;
  parallacticAngle: number;
}

/**
 * The Moon's illumination in suncalc 1's terms: the lit fraction, the phase 0 to 1, and the bright limb's angle in radians, negative while the Moon waxes and positive while it wanes.
 *
 * @example
 * ```ts
 * import { getMoonIllumination, type LegacyMoonIllumination } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const m: LegacyMoonIllumination = getMoonIllumination(new Date(Date.UTC(2026, 10, 24, 14)));
 * console.log(m.fraction >= 0 && m.fraction <= 1);
 * ```
 */
export interface LegacyMoonIllumination {
  fraction: number;
  phase: number;
  angle: number;
}

/**
 * The Sun's times with every one a `Date`: an invalid `Date` (`NaN`) when the Sun does not reach that height that day.
 *
 * @example
 * ```ts
 * import { getTimes, type LegacySunTimes } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const t: LegacySunTimes = getTimes(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
 * console.log(Object.keys(t).length);
 * ```
 */
export type LegacySunTimes = Record<string, Date>;

/**
 * The Moon's rise and set; `alwaysUp` or `alwaysDown` is `true` when the Moon never rises or sets in the day.
 *
 * @example
 * ```ts
 * import { getMoonTimes, type LegacyMoonTimes } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const t: LegacyMoonTimes = getMoonTimes(new Date(Date.UTC(2026, 10, 7, 12)), 35.7, 139.7, true);
 * console.log(t.rise === undefined || t.rise instanceof Date);
 * ```
 */
export interface LegacyMoonTimes {
  rise?: Date;
  set?: Date;
  alwaysUp?: boolean;
  alwaysDown?: boolean;
}

/**
 * The times suncalc 1 gives, as `[altitude in degrees, morning name, evening name]`.
 *
 * @example
 * ```ts
 * import { times } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * console.log(times.length);
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
 * Add a time to the ones `getTimes` gives: when the Sun reaches an altitude in degrees.
 *
 * @param angle - The altitude in degrees.
 * @param riseName - The name when the Sun goes up through it.
 * @param setName - The name when the Sun goes down through it.
 *
 * @example
 * ```ts
 * import { addTime, times } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * addTime(-4, "morningBlue", "eveningBlue");
 * console.log(times.some((row) => row[1] === "morningBlue"));
 * ```
 */
export function addTime(angle: number, riseName: string, setName: string): void {
  times.push([angle, riseName, setName]);
}

/**
 * The Sun's place in the sky, as suncalc 1 gave it: the altitude has no refraction in it.
 *
 * @param date - The moment.
 * @param lat - Degrees north.
 * @param lng - Degrees east.
 * @returns The azimuth in radians from south toward west and the altitude in radians.
 *
 * @example
 * ```ts
 * import { getPosition } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const { altitude } = getPosition(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
 * console.log((altitude * 180 / Math.PI).toFixed(0));
 * ```
 */
export function getPosition(date: Date | number, lat: number, lng: number): LegacyPosition {
  const ms = moment(date);
  const h = horizontalOf(sunEquatorial(ms), ms, place(lat, lng));
  return { azimuth: fromSouth(h.azimuth), altitude: h.altitude * RAD };
}

/**
 * The Moon's place in the sky, as suncalc 1 gave it: the altitude includes refraction.
 *
 * @param date - The moment.
 * @param lat - Degrees north.
 * @param lng - Degrees east.
 * @returns The azimuth and altitude in radians, the distance in kilometres and the parallactic angle in radians.
 *
 * @example
 * ```ts
 * import { getMoonPosition } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const { distance } = getMoonPosition(new Date(Date.UTC(2026, 10, 7, 12)), 35.7, 139.7);
 * console.log(Math.round(distance / 1000));
 * ```
 */
export function getMoonPosition(date: Date | number, lat: number, lng: number): LegacyMoonPosition {
  const ms = moment(date);
  const moon = moonEquatorial(ms);
  const h = horizontalOf(moon, ms, place(lat, lng));
  return { azimuth: fromSouth(h.azimuth), altitude: (h.altitude + refraction(h.altitude)) * RAD, distance: moon.distanceKm, parallacticAngle: h.parallacticAngle * RAD };
}

/**
 * The Moon's phase, as suncalc 1 gave it.
 *
 * @param date - The moment; now when left out.
 * @returns The lit fraction, the phase 0 to 1 and the bright limb's angle in radians (negative while waxing).
 *
 * @example
 * ```ts
 * import { getMoonIllumination } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const { fraction, angle } = getMoonIllumination(new Date(Date.UTC(2026, 10, 24, 14)));
 * console.log(fraction.toFixed(2), angle < 0);
 * ```
 */
export function getMoonIllumination(date: Date | number = new Date()): LegacyMoonIllumination {
  const p = moonPhase(moment(date));
  // suncalc 1 reckons the angle from the Moon's own side of the Sun, which makes it negative while the Moon waxes
  const wrapped = (((p.angle + 180) % 360) + 360) % 360 - 180;
  return { fraction: p.fraction, phase: p.phase, angle: (p.waxing ? -Math.abs(wrapped) : Math.abs(wrapped)) * RAD };
}

/**
 * The Sun's times for the solar day nearest a moment, as suncalc 1 gave them: every time a `Date`, invalid when it does not happen.
 *
 * @param date - Any moment of the day.
 * @param lat - Degrees north.
 * @param lng - Degrees east.
 * @param height - The observer's height in metres (default 0).
 * @returns The times by name.
 *
 * @example
 * ```ts
 * import { getTimes } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const t = getTimes(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
 * console.log(t.sunrise!.getTime() < t.sunset!.getTime());
 * ```
 */
export function getTimes(date: Date | number, lat: number, lng: number, height = 0): LegacySunTimes {
  const day = sunDay(moment(date), place(lat, lng, height), undefined, times);
  const result: LegacySunTimes = { solarNoon: new Date(day.noon), nadir: new Date(day.nadir) };
  for (const [name, at] of day.events) result[name] = new Date(at ?? Number.NaN);
  return result;
}

/**
 * The Moon's rise and set over the 24 hours from midnight of the moment's day, in the machine's zone or, with `inUTC`, in UTC.
 *
 * @param date - Any moment of the day.
 * @param lat - Degrees north.
 * @param lng - Degrees east.
 * @param inUTC - Search the UTC day instead of the local one.
 * @returns `rise` and `set` when they happen, and `alwaysUp` or `alwaysDown` when the Moon stays up or down.
 *
 * @example
 * ```ts
 * import { getMoonTimes } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
 *
 * const t = getMoonTimes(new Date(Date.UTC(2026, 10, 7, 12)), 35.7, 139.7, true);
 * console.log(t.rise === undefined || t.rise instanceof Date);
 * ```
 */
export function getMoonTimes(date: Date | number, lat: number, lng: number, inUTC = false): LegacyMoonTimes {
  const day = new Date(moment(date));
  if (inUTC) day.setUTCHours(0, 0, 0, 0);
  else day.setHours(0, 0, 0, 0);
  const start = day.getTime();
  const observer = place(lat, lng);
  const found = moonDay(start, start + 24 * 3_600_000, observer);
  const result: LegacyMoonTimes = {};
  if (found.rise !== null) result.rise = new Date(found.rise);
  if (found.set !== null) result.set = new Date(found.set);
  if (found.alwaysUp) result.alwaysUp = true;
  if (found.alwaysDown) result.alwaysDown = true;
  return result;
}
