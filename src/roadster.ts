// Starman and the Tesla Roadster: where the car launched on the first Falcon Heavy is at a date, its distances, speeds, orbit and the moments worth looking at. The path is a table of state vectors from JPL Horizons
// (target -143205, solution s11; scripts/make-roadster-data.py, src/data/roadster.ts) joined by cubic Hermite interpolation on position and velocity, and only this entry point imports it. Positions are heliocentric, in
// kilometres, in the J2000 ecliptic frame, like `spacecraftPosition` (`heliocentric` gives the planets in astronomical units in the same axes). Pure: no DOM, no clock reads, no three.js.
import { ROADSTER_ROWS, ROADSTER_START, ROADSTER_STEP_DAYS, ROADSTER_WORST_KM } from "./data/roadster.ts";
import { toTerrestrialTime, ttMinusUtc } from "./clock.ts";
import { heliocentric } from "./ephemeris.ts";
import { add, cross, dot, length, scale, sub, unit, type Vec3 } from "./vec.ts";
import { moment, type When } from "./when.ts";

export type { When } from "./when.ts";

const AU_KM = 149_597_870.7;
const MILE_KM = 1.609344;
const LIGHT_KM_PER_SECOND = 299_792.458;
/** The Sun's gravitational parameter in cubic kilometres a second squared (the value of the DE440 ephemeris that Horizons uses). */
const GM_SUN = 132_712_440_041.279_42;
const DAY_MS = 86_400_000;
const STRIDE = 7;
/** The launch: 2018-02-06 20:45 UTC, from Horizons' own notes on the object. */
const LAUNCH = Date.UTC(2018, 1, 6, 20, 45);

const ROWS = ROADSTER_ROWS;
const COUNT = ROWS.length / STRIDE;
const SPAN_SECONDS = ROWS[(COUNT - 1) * STRIDE]! * 3600;
const utcOfTerrestrial = (tt: number): number => tt - ttMinusUtc(tt) * 1000;
const RECORD_START = utcOfTerrestrial(ROADSTER_START);
const RECORD_END = utcOfTerrestrial(ROADSTER_START + SPAN_SECONDS * 1000);

/**
 * The names of a thing in English and Japanese.
 *
 * @example
 * ```ts
 * import { ROADSTER, type RoadsterName } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const name: RoadsterName = ROADSTER.name;
 * console.log(name.en, name.ja);
 * ```
 */
export interface RoadsterName {
  /** The name in English. */
  en: string;
  /** The name in Japanese. */
  ja: string;
}

/**
 * What is known about the car: its names, launch, Horizons' number and the span of the path.
 *
 * @example
 * ```ts
 * import { ROADSTER } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * console.log(ROADSTER.name.en, "and the", ROADSTER.car.en, "were launched", new Date(ROADSTER.launch).toISOString());
 * ```
 */
export const ROADSTER = {
  /** The mannequin at the wheel, in English and Japanese. */
  name: { en: "Starman", ja: "スターマン" },
  /** The car, in English and Japanese. */
  car: { en: "Tesla Roadster", ja: "テスラ・ロードスター" },
  /** The launch, in milliseconds since 1970 (UTC): the first flight of the Falcon Heavy, 2018-02-06 20:45, from launch complex 39A of the Kennedy Space Center. */
  launch: LAUNCH,
  /** The number JPL Horizons gives the car. */
  horizonsId: "-143205",
  /** The span the path covers, in milliseconds since 1970 (UTC): from about six hours after the launch (where Horizons' record starts) to 2035-01-01. A date outside it throws a `RangeError`. */
  record: { start: RECORD_START, end: RECORD_END },
} as const;

/**
 * How far to trust the path, stated: the span it covers, the worst error of the interpolation against Horizons' own record as measured when the table was made, and what the table cannot know.
 * The car's path is a prediction from a fit to 374 telescope observations made in February and March 2018 (Horizons' solution s11), with sunlight's push on the car estimated from them: a date years after the fit drifts from where the car really is, by more the further away it is.
 *
 * @example
 * ```ts
 * import { ROADSTER_ACCURACY } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * console.log(`rows ${ROADSTER_ACCURACY.stepDays} days apart, within ${ROADSTER_ACCURACY.interpolationKm} km of Horizons' own path`);
 * ```
 */
export const ROADSTER_ACCURACY = {
  /** The first moment the path covers, in milliseconds since 1970 (UTC). */
  from: RECORD_START,
  /** The last moment the path covers, in milliseconds since 1970 (UTC). */
  to: RECORD_END,
  /** The days between rows of the table once the car is ten days out. */
  stepDays: ROADSTER_STEP_DAYS,
  /** The worst distance, in kilometres, between the table's interpolation and Horizons' own record of the same path, measured every day of the span, every hour of the first 13 days and every hour round the Mars pass of October 2020. */
  interpolationKm: ROADSTER_WORST_KM,
  /** In words, what the numbers leave out. */
  note: "Horizons' path was fitted to observations from February and March 2018 and is a prediction after that; sunlight's push is modelled only as one number fitted to those observations, so the real car drifts from the predicted path, and the further from 2018 the more. The interpolation error above is separate and small beside it.",
} as const;

/** The state from the table at a UTC moment: terrestrial seconds after the start of the table, position and velocity. */
function state(ms: number): { position: Vec3; velocity: Vec3; seconds: number } {
  const seconds = (toTerrestrialTime(ms) - ROADSTER_START) / 1000;
  if (!(seconds >= -1e-3 && seconds <= SPAN_SECONDS + 1e-3)) {
    throw new RangeError(`when ${new Date(ms).toISOString()} is outside the path of the Tesla Roadster, which runs from ${new Date(RECORD_START).toISOString()} to ${new Date(RECORD_END).toISOString()}`);
  }
  let lo = 0;
  let hi = COUNT - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ROWS[mid * STRIDE]! * 3600 <= seconds) lo = mid;
    else hi = mid - 1;
  }
  const a = lo * STRIDE;
  const b = a + STRIDE;
  const t0 = ROWS[a]! * 3600;
  const h = ROWS[b]! * 3600 - t0;
  const s = (seconds - t0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  const d00 = (6 * s2 - 6 * s) / h;
  const d10 = 3 * s2 - 4 * s + 1;
  const d01 = (-6 * s2 + 6 * s) / h;
  const d11 = 3 * s2 - 2 * s;
  const position: [number, number, number] = [0, 0, 0];
  const velocity: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k += 1) {
    const p0 = ROWS[a + 1 + k]!;
    const p1 = ROWS[b + 1 + k]!;
    const v0 = ROWS[a + 4 + k]!;
    const v1 = ROWS[b + 4 + k]!;
    position[k] = h00 * p0 + h10 * h * v0 + h01 * p1 + h11 * h * v1;
    velocity[k] = d00 * p0 + d10 * v0 + d01 * p1 + d11 * v1;
  }
  return { position, velocity, seconds };
}

/**
 * Where the car is at a moment: x, y, z in kilometres from the Sun, in the J2000 ecliptic frame (the axes of `heliocentric`, which is in astronomical units, and of `spacecraftPosition`).
 * The path is Horizons' prediction from 2018's observations (see `ROADSTER_ACCURACY`). A moment outside `ROADSTER.record` throws a `RangeError`.
 *
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The position in kilometres.
 *
 * @example
 * ```ts
 * import { roadsterPosition } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const [x, y, z] = roadsterPosition(new Date("2020-10-07T06:00:00Z"));
 * console.log((Math.hypot(x, y, z) / 149597870.7).toFixed(3), "au from the Sun");
 * ```
 */
export function roadsterPosition(when: When): Vec3 {
  return state(moment(when)).position;
}

/**
 * The same position in astronomical units, the unit `heliocentric` gives the planets in, so the car and a planet subtract directly.
 *
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The position in au.
 *
 * @example
 * ```ts
 * import { heliocentric } from "@johnmorrisdotca/wakusei-planets";
 * import { roadsterPositionAu } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const day = Date.UTC(2020, 9, 7);
 * const [c, m] = [roadsterPositionAu(day), heliocentric("mars", day)];
 * console.log(Math.hypot(c[0] - m[0], c[1] - m[1], c[2] - m[2]).toFixed(3), "au from Mars");
 * ```
 */
export function roadsterPositionAu(when: When): Vec3 {
  return scale(roadsterPosition(when), 1 / AU_KM);
}

/**
 * The car's velocity relative to the Sun at a moment, in kilometres a second, in the same frame as `roadsterPosition`. It is the slope of the interpolation, within 2.3 metres a second of Horizons' own after the first day (up to 115 metres a second in the first day, while the Earth still bends the path).
 *
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The velocity.
 *
 * @example
 * ```ts
 * import { roadsterVelocity } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * console.log(roadsterVelocity(Date.UTC(2024, 0, 1)).map((v) => v.toFixed(2)));
 * ```
 */
export function roadsterVelocity(when: When): Vec3 {
  return state(moment(when)).velocity;
}

/**
 * The car's speed relative to the Sun at a moment, in kilometres a second.
 *
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The speed.
 *
 * @example
 * ```ts
 * import { roadsterSpeed } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * console.log(roadsterSpeed(Date.UTC(2026, 10, 11)).toFixed(1), "km/s");
 * ```
 */
export function roadsterSpeed(when: When): number {
  return length(roadsterVelocity(when));
}

/** A planet's position (km) and velocity (km/s) from the Sun at a UTC moment: `heliocentric`, and its slope over two hours either side (the curve is smooth, so the error is far below a millimetre a second). */
function planetState(id: "earth" | "mars", ms: number): { position: Vec3; velocity: Vec3 } {
  const h = 3_600_000;
  const at = (t: number): Vec3 => scale(heliocentric(id, t), AU_KM);
  return { position: at(ms), velocity: scale(sub(at(ms + h), at(ms - h)), 1 / 7200) };
}

/** The osculating orbit of a state about the Sun. */
function elementsOf(position: Vec3, velocity: Vec3): RoadsterElements {
  const r = length(position);
  const v2 = dot(velocity, velocity);
  const h = cross(position, velocity);
  const hLength = length(h);
  const eccentricityVector = sub(scale(cross(velocity, h), 1 / GM_SUN), scale(position, 1 / r));
  const e = length(eccentricityVector);
  const a = 1 / (2 / r - v2 / GM_SUN);
  const node = unit([-h[1], h[0], 0]);
  const nodeAngle = Math.atan2(h[0], -h[1]);
  const perihelionAngle = Math.atan2(dot(cross(node, eccentricityVector), unit(h)), dot(node, eccentricityVector));
  const trueAnomaly = Math.atan2(dot(cross(eccentricityVector, position), unit(h)), dot(eccentricityVector, position));
  const eccentricAnomaly = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(trueAnomaly / 2), Math.sqrt(1 + e) * Math.cos(trueAnomaly / 2));
  const meanAnomaly = eccentricAnomaly - e * Math.sin(eccentricAnomaly);
  const turn = (radians: number): number => (((radians * 180) / Math.PI) % 360 + 360) % 360;
  return {
    semiMajorAxisKm: a,
    semiMajorAxisAu: a / AU_KM,
    eccentricity: e,
    inclination: (Math.acos(h[2] / hLength) * 180) / Math.PI,
    ascendingNode: turn(nodeAngle),
    argumentOfPerihelion: turn(perihelionAngle),
    meanAnomaly: turn(meanAnomaly),
    trueAnomaly: turn(trueAnomaly),
    periodDays: (2 * Math.PI * Math.sqrt((a * a * a) / GM_SUN)) / 86_400,
    perihelionKm: a * (1 - e),
    perihelionAu: (a * (1 - e)) / AU_KM,
    aphelionKm: a * (1 + e),
    aphelionAu: (a * (1 + e)) / AU_KM,
  };
}

/**
 * The osculating orbit of the car about the Sun at a moment: the ellipse it would follow if only the Sun's pull acted from then on (the real car is pulled by the planets too, so the elements drift).
 *
 * @example
 * ```ts
 * import { roadsterElements, type RoadsterElements } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const orbit: RoadsterElements = roadsterElements(Date.UTC(2026, 10, 11));
 * console.log(orbit.periodDays.toFixed(0), "days");
 * ```
 */
export interface RoadsterElements {
  /** The semi-major axis in kilometres. */
  semiMajorAxisKm: number;
  /** The semi-major axis in astronomical units. */
  semiMajorAxisAu: number;
  /** The eccentricity: 0 is a circle, a little over a quarter for the car. */
  eccentricity: number;
  /** The inclination to the ecliptic of J2000, in degrees. */
  inclination: number;
  /** The longitude of the ascending node, in degrees (0 up to 360). */
  ascendingNode: number;
  /** The argument of perihelion, in degrees (0 up to 360). */
  argumentOfPerihelion: number;
  /** The mean anomaly, in degrees (0 up to 360): the share of the orbit run since the last perihelion, as an angle that grows evenly. */
  meanAnomaly: number;
  /** The true anomaly, in degrees (0 up to 360): the angle from perihelion to the car, seen from the Sun. */
  trueAnomaly: number;
  /** The period in days, about 557. */
  periodDays: number;
  /** The closest the orbit comes to the Sun, in kilometres. */
  perihelionKm: number;
  /** The closest the orbit comes to the Sun, in astronomical units. */
  perihelionAu: number;
  /** The furthest the orbit goes from the Sun, in kilometres. */
  aphelionKm: number;
  /** The furthest the orbit goes from the Sun, in astronomical units. */
  aphelionAu: number;
}

/**
 * The osculating orbital elements about the Sun at a moment, from the state vector (the same numbers Horizons lists as EC, QR, IN, OM, W, A, AD and PR).
 *
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The elements.
 *
 * @example
 * ```ts
 * import { roadsterElements } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const orbit = roadsterElements(new Date("2026-11-11T00:00:00Z"));
 * console.log(`perihelion ${orbit.perihelionAu.toFixed(3)} au, aphelion ${orbit.aphelionAu.toFixed(3)} au, period ${orbit.periodDays.toFixed(0)} days`);
 * ```
 */
export function roadsterElements(when: When): RoadsterElements {
  const { position, velocity } = state(moment(when));
  return elementsOf(position, velocity);
}

/** The angle, in radians, that the car sweeps round the Sun between two states, about the direction of their angular momentum. */
function sweep(p0: Vec3, v0: Vec3, p1: Vec3, v1: Vec3): number {
  const axis = unit(add(cross(p0, v0), cross(p1, v1)));
  return Math.atan2(dot(cross(p0, p1), axis), dot(p0, p1));
}

/** The angle swept round the Sun, in radians, from the first row to each row. A deterministic function of the table, worked out once. */
let swept: Float64Array | undefined;
function sweptAtRows(): Float64Array {
  if (swept !== undefined) return swept;
  const out = new Float64Array(COUNT);
  for (let i = 1; i < COUNT; i += 1) {
    const a = (i - 1) * STRIDE;
    const b = i * STRIDE;
    out[i] = out[i - 1]! + sweep([ROWS[a + 1]!, ROWS[a + 2]!, ROWS[a + 3]!], [ROWS[a + 4]!, ROWS[a + 5]!, ROWS[a + 6]!], [ROWS[b + 1]!, ROWS[b + 2]!, ROWS[b + 3]!], [ROWS[b + 4]!, ROWS[b + 5]!, ROWS[b + 6]!]);
  }
  swept = out;
  return out;
}

/** The orbits of the Sun the car has made at a moment: the angle swept round the Sun since the launch over a full turn. The six hours from the launch to the first row are counted at the rate of that row (under a thousandth of an orbit). */
function orbitsAt(ms: number): number {
  const { position, velocity, seconds } = state(ms);
  let lo = 0;
  let hi = COUNT - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ROWS[mid * STRIDE]! * 3600 <= seconds) lo = mid;
    else hi = mid - 1;
  }
  const a = lo * STRIDE;
  const angle = sweptAtRows()[lo]! + sweep([ROWS[a + 1]!, ROWS[a + 2]!, ROWS[a + 3]!], [ROWS[a + 4]!, ROWS[a + 5]!, ROWS[a + 6]!], position, velocity);
  const first = { position: [ROWS[1]!, ROWS[2]!, ROWS[3]!] as Vec3, velocity: [ROWS[4]!, ROWS[5]!, ROWS[6]!] as Vec3 };
  const rate = length(cross(first.position, first.velocity)) / dot(first.position, first.position);
  const before = Math.max(0, (ROADSTER_START - toTerrestrialTime(LAUNCH)) / 1000);
  return (angle + rate * before) / (2 * Math.PI);
}

/** The scan step for close approaches, in milliseconds. */
const UTC_STEP_MS = 2 * DAY_MS;
/** A closest approach counts when the distance falls under this many astronomical units: the Earth and Mars come to a least distance every few years, and most of those are far off. */
const APPROACH_AU = 1;

/**
 * The two bodies the car's close approaches are found for.
 *
 * @example
 * ```ts
 * import { roadsterApproaches, type RoadsterBody } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const body: RoadsterBody = "earth";
 * console.log(roadsterApproaches(body).length, "close approaches to the", body);
 * ```
 */
export type RoadsterBody = "earth" | "mars";

/**
 * One closest approach of the car to a planet: the moment and the distance between the centres.
 *
 * @example
 * ```ts
 * import { roadsterApproaches, type RoadsterApproach } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const mars: RoadsterApproach = roadsterApproaches("mars")[0]!;
 * console.log(new Date(mars.date).toISOString().slice(0, 10), Math.round(mars.distanceKm / 1e6), "million km");
 * ```
 */
export interface RoadsterApproach {
  /** The moment, in milliseconds since 1970 (UTC). */
  date: number;
  /** The distance between the car and the planet's centre, in kilometres, with no allowance for the light's travel. */
  distanceKm: number;
}

const approachMemo = new Map<RoadsterBody, readonly RoadsterApproach[]>();

/** The distance between the car and a planet at a UTC moment, in kilometres. */
function distanceTo(id: RoadsterBody, ms: number): number {
  return length(sub(state(ms).position, scale(heliocentric(id, ms), AU_KM)));
}

/**
 * Every closest approach of the car to the Earth or to Mars inside the span of the path, in date order: a least value of the distance between the centres that is under one astronomical unit (found by scanning every two days and then narrowing each minimum to about a second).
 * The car's launch, before the span, and the end of the span are not counted. The answer is the same every time, so it is worked out once and kept.
 *
 * @param body - `"earth"` or `"mars"`.
 * @returns The approaches.
 *
 * @example
 * ```ts
 * import { roadsterApproaches } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * for (const a of roadsterApproaches("mars")) console.log(new Date(a.date).toISOString().slice(0, 10), (a.distanceKm / 149597870.7).toFixed(3), "au");
 * ```
 */
export function roadsterApproaches(body: RoadsterBody): readonly RoadsterApproach[] {
  if (body !== "earth" && body !== "mars") throw new RangeError(`body must be "earth" or "mars", got ${JSON.stringify(body)}`);
  const kept = approachMemo.get(body);
  if (kept !== undefined) return kept;
  const times: number[] = [];
  const distances: number[] = [];
  for (let t = RECORD_START; t < RECORD_END; t += UTC_STEP_MS) {
    times.push(t);
    distances.push(distanceTo(body, t));
  }
  times.push(RECORD_END);
  distances.push(distanceTo(body, RECORD_END));
  const found: RoadsterApproach[] = [];
  const phi = (Math.sqrt(5) - 1) / 2;
  for (let i = 1; i < times.length - 1; i += 1) {
    if (!(distances[i]! < distances[i - 1]! && distances[i]! <= distances[i + 1]! && distances[i]! < APPROACH_AU * AU_KM * 1.05)) continue;
    let lo = times[i - 1]!;
    let hi = Math.min(times[i + 1]!, RECORD_END);
    let c = hi - phi * (hi - lo);
    let d = lo + phi * (hi - lo);
    let fc = distanceTo(body, c);
    let fd = distanceTo(body, d);
    while (hi - lo > 1000) {
      if (fc < fd) {
        hi = d;
        d = c;
        fd = fc;
        c = hi - phi * (hi - lo);
        fc = distanceTo(body, c);
      } else {
        lo = c;
        c = d;
        fc = fd;
        d = lo + phi * (hi - lo);
        fd = distanceTo(body, d);
      }
    }
    const date = (lo + hi) / 2;
    const distanceKm = distanceTo(body, date);
    if (distanceKm < APPROACH_AU * AU_KM) found.push({ date, distanceKm });
  }
  approachMemo.set(body, found);
  return found;
}

/**
 * A distance in three units and the time a radio signal takes to cross it.
 *
 * @example
 * ```ts
 * import { roadsterStats, type RoadsterDistance } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const sun: RoadsterDistance = roadsterStats(Date.UTC(2026, 10, 11)).sun;
 * console.log(sun.km, sun.miles, sun.au, sun.lightSeconds);
 * ```
 */
export interface RoadsterDistance {
  /** Kilometres. */
  km: number;
  /** International miles. */
  miles: number;
  /** Astronomical units. */
  au: number;
  /** Seconds a radio signal (or light) takes to cross it. */
  lightSeconds: number;
}

/**
 * The closest approach before a moment and the next one after it, to one planet; `null` where the span holds none on that side.
 *
 * @example
 * ```ts
 * import { roadsterStats, type RoadsterNeighbours } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const mars: RoadsterNeighbours = roadsterStats(Date.UTC(2026, 10, 11)).approaches.mars;
 * console.log(mars.previous?.date, mars.next?.date);
 * ```
 */
export interface RoadsterNeighbours {
  /** The latest approach at or before the moment, or `null`. */
  previous: RoadsterApproach | null;
  /** The earliest approach after the moment, or `null`. */
  next: RoadsterApproach | null;
}

/**
 * The numbers a page shows about the car at a moment.
 *
 * @example
 * ```ts
 * import { roadsterStats, type RoadsterStats } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const stats: RoadsterStats = roadsterStats(Date.UTC(2026, 10, 11));
 * console.log(stats.daysSinceLaunch.toFixed(0), "days since launch");
 * ```
 */
export interface RoadsterStats {
  /** The moment, in milliseconds since 1970 (UTC). */
  when: number;
  /** Distance from the Sun's centre. */
  sun: RoadsterDistance;
  /** Distance from the Earth's centre. */
  earth: RoadsterDistance;
  /** Distance from Mars's centre. */
  mars: RoadsterDistance;
  /** Speed in kilometres a second relative to the Sun, the Earth and Mars. */
  speed: { sun: number; earth: number; mars: number };
  /** Days since the launch (a fraction of a day counts). */
  daysSinceLaunch: number;
  /** The orbits of the Sun made since the launch, with the fraction of the one under way. */
  orbits: number;
  /** The orbits completed: `orbits` without its fraction. */
  orbitsCompleted: number;
  /** The period of the osculating orbit now, in days. */
  periodDays: number;
  /** The closest approaches before and after the moment, to the Earth and to Mars, inside the span. */
  approaches: { earth: RoadsterNeighbours; mars: RoadsterNeighbours };
}

const distanceOf = (km: number): RoadsterDistance => ({ km, miles: km / MILE_KM, au: km / AU_KM, lightSeconds: km / LIGHT_KM_PER_SECOND });

function neighbours(list: readonly RoadsterApproach[], ms: number): RoadsterNeighbours {
  let previous: RoadsterApproach | null = null;
  let next: RoadsterApproach | null = null;
  for (const a of list) {
    if (a.date <= ms) previous = a;
    else {
      next = a;
      break;
    }
  }
  return { previous, next };
}

/**
 * The car's numbers at a moment: its distance from the Sun, the Earth and Mars in kilometres, miles and astronomical units with the light time, its speed relative to each, the days since launch, the orbits of the Sun made, the period of its orbit now,
 * and the closest approaches to the Earth and Mars before and after the moment inside the span. The Earth and Mars come from the package's own positions (`heliocentric`), with no allowance for the light's travel.
 * A moment outside `ROADSTER.record` throws a `RangeError`.
 *
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The numbers.
 *
 * @example
 * ```ts
 * import { roadsterStats } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const stats = roadsterStats(new Date("2026-11-11T12:00:00Z"));
 * console.log(Math.round(stats.earth.km / 1e6), "million km from the Earth,", stats.orbitsCompleted, "orbits of the Sun,", stats.speed.sun.toFixed(1), "km/s");
 * ```
 */
export function roadsterStats(when: When): RoadsterStats {
  const ms = moment(when);
  const { position, velocity } = state(ms);
  const earth = planetState("earth", ms);
  const mars = planetState("mars", ms);
  const orbits = orbitsAt(ms);
  return {
    when: ms,
    sun: distanceOf(length(position)),
    earth: distanceOf(length(sub(position, earth.position))),
    mars: distanceOf(length(sub(position, mars.position))),
    speed: { sun: length(velocity), earth: length(sub(velocity, earth.velocity)), mars: length(sub(velocity, mars.velocity)) },
    daysSinceLaunch: (ms - LAUNCH) / DAY_MS,
    orbits,
    orbitsCompleted: Math.floor(orbits),
    periodDays: elementsOf(position, velocity).periodDays,
    approaches: { earth: neighbours(roadsterApproaches("earth"), ms), mars: neighbours(roadsterApproaches("mars"), ms) },
  };
}

/**
 * What kind of moment an event is: `"launch"`, `"earth-approach"`, `"mars-approach"`, `"perihelion"` or `"aphelion"`.
 *
 * @example
 * ```ts
 * import { roadsterEvents, type RoadsterEventKind } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const kind: RoadsterEventKind = "perihelion";
 * console.log(roadsterEvents().filter((e) => e.kind === kind).length, "perihelia");
 * ```
 */
export type RoadsterEventKind = "launch" | "earth-approach" | "mars-approach" | "perihelion" | "aphelion";

/**
 * A moment in the car's story that a page can jump to.
 *
 * @example
 * ```ts
 * import { roadsterEvents, type RoadsterEvent } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const first: RoadsterEvent = roadsterEvents()[0]!;
 * console.log(first.kind, new Date(first.date).toISOString(), first.name.en);
 * ```
 */
export interface RoadsterEvent {
  /** What happened. */
  kind: RoadsterEventKind;
  /** When, in milliseconds since 1970 (UTC). */
  date: number;
  /** The name in English and Japanese. */
  name: RoadsterName;
  /** The distance in kilometres that goes with the moment: from the planet at a close approach, from the Sun at a perihelion or an aphelion. The launch has none. */
  distanceKm?: number;
}

const NAMES: Readonly<Record<RoadsterEventKind, RoadsterName>> = {
  launch: { en: "Launch", ja: "打ち上げ" },
  "earth-approach": { en: "Closest approach to the Earth", ja: "地球に最接近" },
  "mars-approach": { en: "Closest approach to Mars", ja: "火星に最接近" },
  perihelion: { en: "Perihelion (closest to the Sun)", ja: "近日点通過" },
  aphelion: { en: "Aphelion (furthest from the Sun)", ja: "遠日点通過" },
};

let eventMemo: readonly RoadsterEvent[] | undefined;

/** The moments of perihelion and aphelion: where the radial speed (the dot product of the position and the velocity) changes sign, found between rows and narrowed by bisection. */
function sunExtremes(): RoadsterEvent[] {
  const out: RoadsterEvent[] = [];
  const radial = (i: number): number => ROWS[i * STRIDE + 1]! * ROWS[i * STRIDE + 4]! + ROWS[i * STRIDE + 2]! * ROWS[i * STRIDE + 5]! + ROWS[i * STRIDE + 3]! * ROWS[i * STRIDE + 6]!;
  for (let i = 0; i < COUNT - 1; i += 1) {
    const before = radial(i);
    const after = radial(i + 1);
    if (before === 0 || Math.sign(before) === Math.sign(after)) continue;
    let lo = ROADSTER_START + ROWS[i * STRIDE]! * 3_600_000;
    let hi = ROADSTER_START + ROWS[(i + 1) * STRIDE]! * 3_600_000;
    const at = (tt: number): number => {
      const s = state(utcOfTerrestrial(tt));
      return dot(s.position, s.velocity);
    };
    const sign = Math.sign(before);
    while (hi - lo > 100) {
      const mid = (lo + hi) / 2;
      if (Math.sign(at(mid)) === sign) lo = mid;
      else hi = mid;
    }
    const date = utcOfTerrestrial((lo + hi) / 2);
    const kind: RoadsterEventKind = sign < 0 ? "perihelion" : "aphelion";
    out.push({ kind, date, name: NAMES[kind], distanceKm: length(state(date).position) });
  }
  return out;
}

/**
 * Every moment of the car's story the table can find, in date order, each with a name in English and Japanese: the launch, each closest approach to the Earth and to Mars, and each perihelion and aphelion passage inside the span.
 * A page can list them and jump to any one. The answer is the same every time, so it is worked out once and kept.
 *
 * @returns The events.
 *
 * @example
 * ```ts
 * import { roadsterEvents } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * for (const e of roadsterEvents().slice(0, 5)) console.log(new Date(e.date).toISOString().slice(0, 10), e.name.en);
 * ```
 */
export function roadsterEvents(): readonly RoadsterEvent[] {
  if (eventMemo !== undefined) return eventMemo;
  const list: RoadsterEvent[] = [{ kind: "launch", date: LAUNCH, name: NAMES.launch }];
  for (const a of roadsterApproaches("earth")) list.push({ kind: "earth-approach", date: a.date, name: NAMES["earth-approach"], distanceKm: a.distanceKm });
  for (const a of roadsterApproaches("mars")) list.push({ kind: "mars-approach", date: a.date, name: NAMES["mars-approach"], distanceKm: a.distanceKm });
  list.push(...sunExtremes());
  eventMemo = list.sort((a, b) => a.date - b.date);
  return eventMemo;
}

/**
 * The car's distances and speed sampled over a stretch of time, for a chart: one entry in each array for each moment in `times`.
 *
 * @example
 * ```ts
 * import { roadsterSeries, type RoadsterSeries } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const series: RoadsterSeries = roadsterSeries(Date.UTC(2020, 0, 1), Date.UTC(2021, 0, 1), 86_400_000);
 * console.log(series.times.length, "days");
 * ```
 */
export interface RoadsterSeries {
  /** The moments, in milliseconds since 1970 (UTC), from the start to the end at the step (the end is included when the step lands on it). */
  times: number[];
  /** Distance from the Sun, in kilometres. */
  sunKm: number[];
  /** Distance from the Earth, in kilometres. */
  earthKm: number[];
  /** Distance from Mars, in kilometres. */
  marsKm: number[];
  /** Speed relative to the Sun, in kilometres a second. */
  speed: number[];
}

/** The most moments one series holds, so that one call cannot take the page's time. */
const MAX_SERIES = 100_000;

/**
 * The car's distance from the Sun, the Earth and Mars, and its speed relative to the Sun, at equal steps from one moment to another, ready to graph. Both ends must be inside `ROADSTER.record`; a step that is not positive, or a series of more than 100,000 moments, throws a `RangeError`.
 *
 * @param from - The first moment: a `Date` or milliseconds since 1970 (UTC).
 * @param to - The last moment, not before the first.
 * @param stepMs - The step in milliseconds.
 * @returns The series.
 *
 * @example
 * ```ts
 * import { roadsterSeries } from "@johnmorrisdotca/wakusei-planets/roadster";
 *
 * const { times, earthKm } = roadsterSeries(new Date("2019-01-01T00:00:00Z"), new Date("2020-01-01T00:00:00Z"), 7 * 86_400_000);
 * console.log(times.length, "weeks; nearest", Math.round(Math.min(...earthKm) / 1e6), "million km from the Earth");
 * ```
 */
export function roadsterSeries(from: When, to: When, stepMs: number): RoadsterSeries {
  const start = moment(from, "from");
  const end = moment(to, "to");
  if (!Number.isFinite(stepMs) || !(stepMs > 0)) throw new RangeError(`stepMs must be a positive number of milliseconds, got ${String(stepMs)}`);
  if (end < start) throw new RangeError("to must not be before from");
  const count = Math.floor((end - start) / stepMs) + 1;
  if (count > MAX_SERIES) throw new RangeError(`${count} moments is more than the ${MAX_SERIES} a series holds: use a larger step`);
  const series: RoadsterSeries = { times: [], sunKm: [], earthKm: [], marsKm: [], speed: [] };
  for (let i = 0; i < count; i += 1) {
    const ms = start + i * stepMs;
    const { position, velocity } = state(ms);
    series.times.push(ms);
    series.sunKm.push(length(position));
    series.earthKm.push(length(sub(position, scale(heliocentric("earth", ms), AU_KM))));
    series.marsKm.push(length(sub(position, scale(heliocentric("mars", ms), AU_KM))));
    series.speed.push(length(velocity));
  }
  return series;
}
