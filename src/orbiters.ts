// The spacecraft in orbit round the Moon and Mars: where each is at a moment, from mean orbital elements with secular rates fitted to JPL Horizons' track (src/data/orbiters.ts, made by
// scripts/make-orbiter-data.py), and what is known about each (src/orbiter-facts.ts). Pure: no DOM, no clock reads. Positions are from the centre of the body, in kilometres, ecliptic and
// equinox J2000, the same axes as `/roadster` and the ten deep-space craft; `eclipticToScene` from `/space` turns them into the space view's axes.
import { ORBITER_FITS } from "./data/orbiters.ts";
import { ORBITER_FACTS, type OrbiterFacts } from "./orbiter-facts.ts";
import type { When } from "./when.ts";
import type { Vec3 } from "./vec.ts";

export { ORBITER_FACTS, type OrbiterFacts, type OrbiterInstrument } from "./orbiter-facts.ts";
export type { When } from "./when.ts";

/**
 * The orbiters the package knows: six round the Moon and seven round Mars.
 *
 * @example
 * ```ts
 * import { ORBITER_IDS } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(ORBITER_IDS.join(", "));
 * ```
 */
export const ORBITER_IDS = Object.keys(ORBITER_FITS) as readonly OrbiterId[];

/**
 * The name of an orbiter: `lro`, `chandrayaan-2`, `danuri`, `artemis-p1`, `artemis-p2`, `capstone`, `mro`, `odyssey`, `maven`, `mars-express`, `tgo`, `hope` or `tianwen-1`.
 *
 * @example
 * ```ts
 * import type { OrbiterId } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const id: OrbiterId = "lro";
 * console.log(id);
 * ```
 */
export type OrbiterId = keyof typeof ORBITER_FITS;

/**
 * The body an orbiter goes round.
 *
 * @example
 * ```ts
 * import { orbiterCentre } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(orbiterCentre("lro"), orbiterCentre("mro"));
 * ```
 */
export type OrbiterCentre = "moon" | "mars";

/**
 * Where an orbiter's path comes from at a moment: `tracked` (inside the window the ellipse was fitted over, where its error against Horizons was measured: `fitErrorKm`), `predicted` (after that window
 * and within as many days again as it was long: the same ellipse carried on, its error against Horizons measured there too: `predictedErrorKm`, usually the larger), `modelled` (a mean orbit only: outside
 * both, or the track ended, or no ellipse follows the craft closely) or `none` (no path at all: Tianwen-1 has no public orbit track, CAPSTONE's halo orbit is no ellipse).
 *
 * @example
 * ```ts
 * import { orbiterStatus } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(orbiterStatus("lro", Date.UTC(2026, 10, 11)), orbiterStatus("tianwen-1", Date.UTC(2026, 10, 11)));
 * ```
 */
export type OrbiterStatus = "tracked" | "predicted" | "modelled" | "none";

/** GM of the Moon and Mars in km^3/s^2 (JPL DE440). */
const GM: Record<OrbiterCentre, number> = { moon: 4902.800118, mars: 42828.375816 };
const UNIX_EPOCH_JD = 2440587.5;
/**
 * TDB minus UTC in seconds. The fitted epochs and Horizons' vectors are in TDB; a `Date` is UTC. TAI - UTC is 37 s (since 2017-01-01; a later leap second would add one) and TT - TAI is 32.184 s; TDB differs
 * from TT by under 2 ms, which this package ignores. Left out, the craft would lag its true place by about 69 s of its motion: 110 km for LRO, 235 km for MRO.
 */
const TDB_MINUS_UTC_S = 37 + 32.184;
const RAD = Math.PI / 180;

/**
 * The fitted mean elements of an orbiter: a Kepler ellipse round the body with its node and periapsis drifting at fitted rates, the epoch of the fit, the window it is good for, and its error against Horizons.
 *
 * @example
 * ```ts
 * import { orbiterElements } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const lro = orbiterElements("lro")!;
 * console.log(lro.a.toFixed(0), "km", lro.i.toFixed(1), "degrees", lro.periodDays.toFixed(4), "days");
 * ```
 */
export interface OrbiterElements {
  /** The semi-major axis in kilometres from the body's centre. */
  a: number;
  e: number;
  /** Inclination, node, argument of periapsis and mean anomaly at the epoch, in degrees, ecliptic J2000. */
  i: number;
  raan: number;
  argp: number;
  m0: number;
  /** How fast the node and the periapsis drift, in degrees a day. */
  raanRate: number;
  argpRate: number;
  /** The fitted mean motion's difference from the Kepler mean motion of `a`, in degrees a day. */
  meanMotionCorrection: number;
  /** One trip round the body, in days. */
  periodDays: number;
  /** The fit's epoch, as a Julian date in TDB (a moment in UTC is turned into TDB, 69.184 s later, before it is used). */
  epochJd: number;
  /** The window the fit was made over (`validFrom` to `fitUntil`, ISO dates in UTC: `tracked`) and the end of the days after it the ellipse is carried on for (`validUntil`: `predicted`). */
  validFrom: string;
  fitUntil: string;
  validUntil: string;
  /** The date Horizons was read on, as `yyyy-mm-dd` (UTC): the age of the elements. */
  retrieved: string;
  /** How far Horizons' tracking data reached when the fit was made, as Horizons writes it. */
  trackedUntil: string;
  /** The error of the ellipse against Horizons over the fit's window (`tracked`), in kilometres: median and worst. */
  fitErrorKm: { median: number; max: number };
  /** The error of the same ellipse against Horizons over the days after the window (`predicted`), in kilometres: median and worst; `null` where Horizons has nothing there (a craft whose track has ended). */
  predictedErrorKm: { median: number; max: number } | null;
  /** `tracked` when the ellipse follows Horizons within the limit the script sets; `modelled` when not, or when the track had ended. */
  basis: "tracked" | "modelled";
}

type Fit = (typeof ORBITER_FITS)[OrbiterId];
const hasElements = (fit: Fit): fit is Fit & { a: number } => "a" in fit && typeof (fit as { a?: number }).a === "number";

function idOf(id: string): OrbiterId {
  if (!(id in ORBITER_FITS)) throw new Error(`wakusei-planets: no orbiter called ${id}`);
  return id as OrbiterId;
}

/**
 * The body an orbiter goes round.
 *
 * @param id - The orbiter.
 * @returns `moon` or `mars`.
 *
 * @example
 * ```ts
 * import { orbiterCentre } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(orbiterCentre("hope"));
 * ```
 */
export function orbiterCentre(id: OrbiterId): OrbiterCentre {
  return ORBITER_FITS[idOf(id)].center;
}

/**
 * The fitted elements of an orbiter, or `undefined` for one with no path (`orbiterStatus` says `none`).
 *
 * @param id - The orbiter.
 * @returns The elements, or `undefined`.
 *
 * @example
 * ```ts
 * import { orbiterElements } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(orbiterElements("capstone"), orbiterElements("mro")?.e.toFixed(4));
 * ```
 */
export function orbiterElements(id: OrbiterId): OrbiterElements | undefined {
  const fit = ORBITER_FITS[idOf(id)];
  if (!hasElements(fit)) return undefined;
  const f = fit as unknown as OrbiterElements;
  return { a: f.a, e: f.e, i: f.i, raan: f.raan, argp: f.argp, m0: f.m0, raanRate: f.raanRate, argpRate: f.argpRate, meanMotionCorrection: f.meanMotionCorrection, periodDays: f.periodDays, epochJd: f.epochJd, validFrom: f.validFrom, fitUntil: f.fitUntil, validUntil: f.validUntil, retrieved: f.retrieved, trackedUntil: f.trackedUntil, fitErrorKm: { ...f.fitErrorKm }, predictedErrorKm: f.predictedErrorKm === null ? null : { ...f.predictedErrorKm }, basis: f.basis };
}

const msOf = (when: When): number => (when instanceof Date ? when.getTime() : when);
/** The Julian date in TDB of a moment given in UTC (see `TDB_MINUS_UTC_S`). */
const tdbJdOf = (when: When): number => (msOf(when) / 1000 + TDB_MINUS_UTC_S) / 86_400 + UNIX_EPOCH_JD;

/**
 * Where an orbiter's path comes from at a moment: see `OrbiterStatus`. `tracked` ends with the fit's window (`fitUntil`); after it, up to `validUntil`, a path is `predicted`. A moment before the window or after
 * `validUntil` is `modelled` (the ellipse is extended, not measured there). `trackedUntil`, how far Horizons' own tracking data reached, is not used: where Horizons' track is itself an agency's prediction, "tracked" says the
 * ellipse follows that track.
 *
 * @param id - The orbiter.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The status.
 *
 * @example
 * ```ts
 * import { orbiterStatus } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(orbiterStatus("mro", Date.UTC(2026, 10, 1)), orbiterStatus("mro", Date.UTC(2030, 0, 1)));
 * ```
 */
export function orbiterStatus(id: OrbiterId, when: When): OrbiterStatus {
  const fit = ORBITER_FITS[idOf(id)];
  if (!hasElements(fit)) return "none";
  const f = fit as unknown as OrbiterElements;
  if (f.basis === "modelled") return "modelled";
  const ms = msOf(when);
  if (ms < Date.parse(f.validFrom) || ms > Date.parse(f.validUntil)) return "modelled";
  return ms > Date.parse(f.fitUntil) ? "predicted" : "tracked";
}

/**
 * Where an orbiter is at a moment, in kilometres from the centre of the body it goes round, ecliptic and equinox J2000. The mean ellipse is propagated with its drifting node and periapsis: good to the
 * `fitErrorKm` of its elements within the fit's window and the larger `predictedErrorKm` in the days after it, rougher beyond (`orbiterStatus`). `when` is UTC; the elements' TDB epoch is allowed for (69.184 s). Throws for a craft with no path.
 *
 * @param id - The orbiter.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns x, y, z in kilometres.
 *
 * @example
 * ```ts
 * import { orbiterPosition } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const [x, y, z] = orbiterPosition("lro", Date.UTC(2026, 10, 11));
 * console.log(Math.hypot(x, y, z).toFixed(0), "km from the Moon's centre");
 * ```
 */
export function orbiterPosition(id: OrbiterId, when: When): Vec3 {
  return stateOf(id, when).position;
}

/**
 * How fast an orbiter moves at a moment, in kilometres a second relative to the body it goes round (from the ellipse).
 *
 * @param id - The orbiter.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The speed in km/s.
 *
 * @example
 * ```ts
 * import { orbiterSpeed } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(orbiterSpeed("lro", Date.UTC(2026, 10, 11)).toFixed(2), "km/s");
 * ```
 */
export function orbiterSpeed(id: OrbiterId, when: When): number {
  const { velocity } = stateOf(id, when);
  return Math.hypot(velocity[0], velocity[1], velocity[2]);
}

/**
 * The numbers a page shows for an orbiter at a moment: its height above the body's mean surface, its speed, its period and inclination, where its path comes from, and how far wrong it may be (`errorKm`: the worst error
 * measured against Horizons for that status, `fitErrorKm.max` when `tracked`, `predictedErrorKm.max` when `predicted`; `null` when `modelled`).
 *
 * @param id - The orbiter.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The numbers, or `undefined` for a craft with no path.
 *
 * @example
 * ```ts
 * import { orbiterNumbers } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const mro = orbiterNumbers("mro", Date.UTC(2026, 10, 11))!;
 * console.log(mro.altitudeKm.toFixed(0), "km up,", mro.speedKmS.toFixed(2), "km/s,", (mro.periodDays * 24 * 60).toFixed(0), "minutes round,", mro.status, "within", mro.errorKm, "km");
 * ```
 */
export function orbiterNumbers(id: OrbiterId, when: When): { altitudeKm: number; speedKmS: number; periodDays: number; inclinationDeg: number; status: OrbiterStatus; errorKm: number | null } | undefined {
  const elements = orbiterElements(id);
  if (elements === undefined) return undefined;
  const { position, velocity } = stateOf(id, when);
  const status = orbiterStatus(id, when);
  const errorKm = status === "tracked" ? elements.fitErrorKm.max : status === "predicted" ? (elements.predictedErrorKm?.max ?? null) : null;
  return { altitudeKm: Math.hypot(position[0], position[1], position[2]) - MEAN_RADIUS_KM[orbiterCentre(id)], speedKmS: Math.hypot(velocity[0], velocity[1], velocity[2]), periodDays: elements.periodDays, inclinationDeg: elements.i, status, errorKm };
}

/** The mean radius of the Moon and Mars in kilometres (IAU), for heights above the surface. */
const MEAN_RADIUS_KM: Record<OrbiterCentre, number> = { moon: 1737.4, mars: 3389.5 };

/**
 * How far a predicted path may miss Horizons, as a share of its body's mean radius, and still be drawn as a tracked one is: 2 per cent, about 35 km at the Moon and 68 km at Mars, a hair's breadth
 * on a picture of the body.
 *
 * @example
 * ```ts
 * import { ORBITER_DIM_SHARE } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log((ORBITER_DIM_SHARE * 3389.5).toFixed(0), "km at Mars");
 * ```
 */
export const ORBITER_DIM_SHARE = 0.02;

/**
 * Whether a page should draw an orbiter dim at a moment: a `modelled` path always (outside the fit's days, or a mean orbit only), and a `predicted` one when its worst error measured against
 * Horizons in the days after the fit (`predictedErrorKm.max`) is more than `ORBITER_DIM_SHARE` of its body's mean radius. A `tracked` path is never dim; a craft with no path (`none`) is not drawn at all,
 * and answers `true`.
 *
 * @param id - The orbiter.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns `true` to draw it dim.
 *
 * @example
 * ```ts
 * import { orbiterDim, orbiterStatus } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const when = Date.UTC(2026, 10, 12);
 * console.log(orbiterStatus("hope", when), orbiterDim("hope", when), orbiterStatus("lro", when), orbiterDim("lro", when));
 * ```
 */
export function orbiterDim(id: OrbiterId, when: When): boolean {
  const status = orbiterStatus(id, when);
  if (status === "tracked") return false;
  if (status !== "predicted") return true;
  const error = orbiterElements(id)?.predictedErrorKm?.max;
  return error === undefined || error > ORBITER_DIM_SHARE * MEAN_RADIUS_KM[orbiterCentre(id)];
}

/**
 * The orbit as points round one trip, in kilometres from the body's centre, ecliptic J2000, at the moment's node and periapsis: for an orbit line.
 *
 * @param id - The orbiter.
 * @param when - A `Date` or milliseconds since 1970 (UTC): the ellipse's orientation then.
 * @param points - How many points round the trip (the first is repeated at the end).
 * @returns The points, or an empty list for a craft with no path.
 *
 * @example
 * ```ts
 * import { orbiterPath } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(orbiterPath("hope", Date.UTC(2026, 10, 11), 8).length);
 * ```
 */
export function orbiterPath(id: OrbiterId, when: When, points = 96): Vec3[] {
  const elements = orbiterElements(id);
  if (elements === undefined) return [];
  const dt = tdbJdOf(when) - elements.epochJd;
  const out: Vec3[] = [];
  // evenly spaced in eccentric anomaly, not mean: a lopsided orbit (ARTEMIS P1, e about 0.8) is then sampled fastest where it bends least, and has no sharp corner at periapsis
  for (let k = 0; k <= points; k += 1) out.push(placeAt(elements, dt, (2 * Math.PI * k) / points));
  return out;
}

function stateOf(id: OrbiterId, when: When): { position: Vec3; velocity: Vec3 } {
  const elements = orbiterElements(id);
  if (elements === undefined) throw new RangeError(`wakusei-planets: ${id} has no path to follow (${orbiterStatus(id, when)})`);
  const centre = orbiterCentre(id);
  const dt = tdbJdOf(when) - elements.epochJd;
  const n = meanMotion(elements, centre);
  const m = (elements.m0 + n * dt) % 360;
  const position = placeOf(elements, centre, dt, undefined, m);
  // the velocity from the ellipse: a small step along it in time
  const later = placeOf(elements, centre, dt + 1 / 86_400, undefined, (elements.m0 + n * (dt + 1 / 86_400)) % 360);
  return { position, velocity: [later[0] - position[0], later[1] - position[1], later[2] - position[2]] };
}

/** The mean motion in degrees a day: Kepler's for `a`, corrected by the fit. */
const meanMotion = (elements: OrbiterElements, centre: OrbiterCentre): number => (Math.sqrt(GM[centre] / elements.a ** 3) * 86_400) / RAD + elements.meanMotionCorrection;

/** A point of the ellipse `dt` days after the epoch: at the true anomaly of mean anomaly `meanAnomaly` (degrees), or at the given mean anomaly. */
function placeOf(elements: OrbiterElements, centre: OrbiterCentre, dt: number, meanAnomalyDeg?: number, mDeg?: number): Vec3 {
  void centre;
  const e = elements.e;
  const m = ((meanAnomalyDeg ?? mDeg ?? 0) * RAD) % (2 * Math.PI);
  let ea = m;
  for (let k = 0; k < 30; k += 1) ea -= (ea - e * Math.sin(ea) - m) / (1 - e * Math.cos(ea));
  return placeAt(elements, dt, ea);
}

/** A point of the ellipse `dt` days after the epoch at the eccentric anomaly `ea` (radians). */
function placeAt(elements: OrbiterElements, dt: number, ea: number): Vec3 {
  const e = elements.e;
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(ea / 2), Math.sqrt(1 - e) * Math.cos(ea / 2));
  const r = elements.a * (1 - e * Math.cos(ea));
  const raan = (elements.raan + elements.raanRate * dt) * RAD;
  const argp = (elements.argp + elements.argpRate * dt) * RAD;
  const inc = elements.i * RAD;
  const u = argp + nu;
  return [
    r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(inc)),
    r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(inc)),
    r * Math.sin(u) * Math.sin(inc),
  ];
}

/**
 * What is known about an orbiter: names, operator, launch, instruments, a line about it, and the state of its path.
 *
 * @param id - The orbiter.
 * @returns The facts.
 *
 * @example
 * ```ts
 * import { orbiterFacts } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const lro = orbiterFacts("lro");
 * console.log(lro.name.en, lro.operator, lro.launch.date, lro.launch.vehicle);
 * ```
 */
export function orbiterFacts(id: OrbiterId): OrbiterFacts {
  return ORBITER_FACTS[idOf(id)];
}

/** An ecliptic J2000 vector in the space view's axes (equatorial J2000, y north): the same turn `eclipticToScene` from `/space` makes, kept here so `/orbiters` imports nothing of the view. */
const OBLIQUITY = 23.4392911 * RAD;
const toScene = (v: Vec3): Vec3 => [v[0], v[1] * Math.sin(OBLIQUITY) + v[2] * Math.cos(OBLIQUITY), -(v[1] * Math.cos(OBLIQUITY) - v[2] * Math.sin(OBLIQUITY))];

/**
 * An orbiter as a point the space view can ride along with (`space.ride(orbiterRidePoint("lro"), { around: "moon" })`): where it is and which way it goes at a moment, in kilometres and kilometres a
 * second from the centre of the body it goes round, in the view's axes (equatorial J2000, y north). It answers `null` for a craft with no path.
 *
 * @param id - The orbiter.
 * @returns The point: its `at` gives the place and velocity, or `null` for a craft with no path (`orbiterStatus` says `none`), which the view then does not ride.
 *
 * @example
 * ```ts
 * import { orbiterRidePoint } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const point = orbiterRidePoint("mro").at(Date.UTC(2026, 10, 11));
 * console.log(point === null ? "no path" : Math.hypot(...point.velocity).toFixed(2) + " km/s");
 * ```
 */
export function orbiterRidePoint(id: OrbiterId): { at(ms: number): { position: Vec3; velocity: Vec3 } | null } {
  idOf(id);
  return {
    at(ms) {
      if (orbiterElements(id) === undefined) return null;
      const { position, velocity } = stateOf(id, ms);
      return { position: toScene(position), velocity: toScene(velocity) };
    },
  };
}
