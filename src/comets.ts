// Comets: a set of well-known ones with their orbits, where each is at a date and how far from the Sun and the Earth, the line of its orbit, and a door to add a newly found one. The orbits are the elements of the NASA/JPL
// Small-Body Database (scripts/make-comet-data.py, src/data/comets.ts), run as two-body motion round the Sun, and only this entry point imports the table. Positions are heliocentric, in astronomical units, in the J2000
// ecliptic frame, like `heliocentric` (which gives the planets in the same axes). Pure: no DOM, no clock reads, no three.js.
import { COMET_TABLE } from "./data/comets.ts";
import { DAY_MS, UNIX_EPOCH_JD, toTerrestrialTime, ttMinusUtc } from "./clock.ts";
import { heliocentric } from "./ephemeris.ts";
import { length, RAD, sub, type Vec3 } from "./vec.ts";
import { moment, type When } from "./when.ts";

export type { When } from "./when.ts";

/** The Gaussian gravitational constant in radians a day: the Sun's pull for an orbit measured in astronomical units and days (the constant JPL's elements are written with). */
const GAUSS_K = 0.017_202_098_95;
const YEAR_DAYS = 365.25;
/** The distance, in days from an orbit's epoch, within which the position was measured against Horizons (see `COMET_ACCURACY`). */
const TRUSTED_DAYS = 365;

/**
 * What a comet is: `periodic` (a closed orbit of under 200 years that has come back more than once), `long-period` (a closed orbit of 200 years or more, or one open to within what the orbit fit can tell) or
 * `interstellar` (an open orbit that comes from outside the Sun's family: 1I, 2I and 3I).
 *
 * @example
 * ```ts
 * import { listComets, type CometKind } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const kind: CometKind = "interstellar";
 * console.log(listComets(kind).map((comet) => comet.designation));
 * ```
 */
export type CometKind = "periodic" | "long-period" | "interstellar";

/**
 * A meteor shower a comet feeds.
 *
 * @example
 * ```ts
 * import { findComet } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const shower = findComet("1P")!.showers[0]!;
 * console.log(shower.code, shower.en, shower.ja);
 * ```
 */
export interface CometShower {
  /** The shower's code in the IAU's list of meteor showers: `PER`, `LEO`, `ORI`. */
  code: string;
  /** The shower's name in English. */
  en: string;
  /** The shower's name in Japanese. */
  ja: string;
}

/**
 * A comet and its orbit.
 *
 * The orbit is one solution of the NASA/JPL Small-Body Database: heliocentric osculating elements at one `epoch`, in the ecliptic and equinox of J2000. Angles are in degrees, distances in astronomical units and times
 * are Julian dates in TDB (the scale the database uses; it differs from terrestrial time by under 2 milliseconds).
 *
 * @example
 * ```ts
 * import { findComet, type CometRecord } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const comet: CometRecord = findComet("109P")!;
 * console.log(comet.name.en, comet.e, comet.q, comet.periodYears);
 * ```
 */
export interface CometRecord {
  /** A short name for the comet in lower case with hyphens: `halley`, `hale-bopp`. The comet in `heliocentric` and the space view is `halley`; the same id names it here. */
  id: string;
  /** The comet's designation: `1P`, `C/1995 O1`, `2I`. */
  designation: string;
  /** The database's full name for it: `1P/Halley`, `C/1995 O1 (Hale-Bopp)`. */
  fullName: string;
  /** The name of the comet in English and in Japanese. */
  name: { en: string; ja: string };
  /** What kind of comet it is. */
  kind: CometKind;
  /** The eccentricity: under 1 a closed orbit, 1 a parabola, over 1 an open one. */
  e: number;
  /** The perihelion distance, in astronomical units. */
  q: number;
  /** The inclination to the ecliptic, in degrees. 90 to 180 is a backwards (retrograde) orbit. */
  i: number;
  /** The longitude of the ascending node, in degrees. */
  node: number;
  /** The argument of perihelion, in degrees. */
  w: number;
  /** The time of perihelion, as a Julian date in TDB. For a periodic comet it is the passage the solution was made with, not necessarily the latest. */
  tp: number;
  /** The epoch of the elements, as a Julian date in TDB: the moment the osculating orbit is exact for. */
  epoch: number;
  /** The semi-major axis in astronomical units, for a closed orbit; `null` for a parabola or an open orbit. */
  a: number | null;
  /** The orbital period in years (365.25 days) of the osculating ellipse; `null` for a parabola or an open orbit. */
  periodYears: number | null;
  /** The database's orbit condition code, 0 (best) to 9 (worst) for how well the orbit is determined, where the database gives one; `null` where it does not. */
  condition: number | null;
  /** How many observations the solution used. */
  observations: number | null;
  /** The days between the first and last observation the solution used. */
  arcDays: number | null;
  /** The date of the solution, `YYYY-MM-DD`. */
  solution: string | null;
  /** The nucleus's effective diameter in kilometres where the database has one, else `null`. */
  nucleusKm: number | null;
  /** The nucleus's size along its axes where the database has them, as text in kilometres (`14.9x8.2`), else `null`. */
  nucleusExtentKm: string | null;
  /** The meteor showers the comet feeds, where that is well established. Empty for most comets. */
  showers: readonly CometShower[];
  /** The number JPL gives the comet for Horizons and its other services, or `null` for a comet added with `cometFromElements`. */
  spkid: string | null;
  /**
   * For a periodic comet of the set, its last and next perihelion as JPL gives them (Julian dates in TDB): JPL Horizons' osculating elements of the comet's latest apparition record at the passage nearest 2026-11-11. `lastObserved` is true when
   * that solution has observations of the last passage, false when the date is JPL's prediction for it (21P and 46P: the solution is older than their passages of 2025 and 2024). `source` names the record. Absent on any other comet.
   */
  perihelion?: { last: number; lastObserved: boolean; next: number; source: string };
}

/**
 * How far to trust a comet's position, stated. The elements are one osculating orbit: the planets pull on a comet, and a comet's own jets push on it, so the real orbit drifts from the ellipse, a little in a year and
 * more the further from the epoch. A comet that has not been near a planet is good to the numbers below within a year of its epoch; a long-period comet's position is good only near its epoch, and a periodic comet's
 * period is the osculating one, which is not the mean (Halley's comes out a year off).
 *
 * @example
 * ```ts
 * import { COMET_ACCURACY } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * console.log(COMET_ACCURACY.read, COMET_ACCURACY.note);
 * ```
 */
export const COMET_ACCURACY = {
  /** The date the elements were read from the Small-Body Database, `YYYY-MM-DD`. */
  read: "2026-11-11",
  /** The source of the elements. */
  source: "NASA/JPL Small-Body Database, https://ssd-api.jpl.nasa.gov/sbdb.api",
  /** The days from an epoch within which `cometTrust` says a position is inside what was measured. */
  trustedDays: TRUSTED_DAYS,
  /** In words, what the numbers leave out. */
  note: "The orbit is two-body motion on the elements of one epoch: the planets' pull and a comet's own jets move the real orbit away from it, so a position is good near the epoch and drifts away from it, by days or years later a comet's closest approach to the Sun may be off. A long-period comet is good only near its epoch; a periodic comet's last and next perihelion are JPL's own dates inside the span they cover and are repeated from the osculating period outside it. For a close look at one date use JPL Horizons.",
} as const;

const RECORDS: readonly CometRecord[] = COMET_TABLE;
const BY_KEY = new Map<string, CometRecord>();
for (const record of RECORDS) {
  BY_KEY.set(record.id, record);
  BY_KEY.set(record.designation.toLowerCase(), record);
  BY_KEY.set(record.name.en.toLowerCase(), record);
}

/**
 * The well-known comets of the set, in the order of the table (the periodic ones by number, then the long-period ones and the interstellar ones). Give a kind to list only that kind.
 * The comet `halley` is the same one `heliocentric("halley", ...)` draws; the table here is the plain two-body orbit of the Small-Body Database, and inside 1800 to 2200 `heliocentric` has the more exact one (see `COMET_ACCURACY`).
 *
 * @param kind - `periodic`, `long-period` or `interstellar`; leave it out for all.
 * @returns A new array of the comets.
 *
 * @example
 * ```ts
 * import { listComets } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * console.log(listComets("periodic").map((comet) => comet.designation).join(" "));
 * ```
 */
export function listComets(kind?: CometKind): CometRecord[] {
  return kind === undefined ? [...RECORDS] : RECORDS.filter((comet) => comet.kind === kind);
}

/**
 * The comet with an id (`halley`), a designation (`1P`, `C/1995 O1`) or an English name (`Halley`), or `undefined` when the set has none. Case does not matter.
 *
 * @param key - The id, designation or English name.
 * @returns The comet, or `undefined`.
 *
 * @example
 * ```ts
 * import { findComet } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const comet = findComet("c/1995 o1");
 * console.log(comet?.name.en, comet?.name.ja);
 * ```
 */
export function findComet(key: string): CometRecord | undefined {
  return typeof key === "string" ? BY_KEY.get(key.trim().toLowerCase()) : undefined;
}

function resolve(comet: CometRecord | string): CometRecord {
  if (typeof comet !== "string") {
    if (comet === null || typeof comet !== "object" || !Number.isFinite(comet.e) || !Number.isFinite(comet.q) || !Number.isFinite(comet.tp)) throw new TypeError("comet must be a comet of this set, one made by cometFromElements, or the id of one");
    return comet;
  }
  const found = findComet(comet);
  if (found === undefined) throw new RangeError(`no comet "${comet}" in the set; the ids are ${RECORDS.map((one) => one.id).join(", ")}`);
  return found;
}

// Stumpff's functions C(z) and S(z) of the universal Kepler equation.
function stumpff(z: number): [number, number] {
  if (Math.abs(z) < 0.1) {
    const c = 1 / 2 - z / 24 + (z * z) / 720 - (z * z * z) / 40_320 + (z * z * z * z) / 3_628_800 - (z * z * z * z * z) / 479_001_600;
    const s = 1 / 6 - z / 120 + (z * z) / 5_040 - (z * z * z) / 362_880 + (z * z * z * z) / 39_916_800 - (z * z * z * z * z) / 6_227_020_800;
    return [c, s];
  }
  if (z > 0) {
    const r = Math.sqrt(z);
    return [(1 - Math.cos(r)) / z, (r - Math.sin(r)) / (r * r * r)];
  }
  const r = Math.sqrt(-z);
  return [(Math.cosh(r) - 1) / -z, (Math.sinh(r) - r) / (r * r * r)];
}

/** The position in the orbit's own plane (x toward perihelion), in au, `days` after perihelion, from the universal form of Kepler's equation: elliptic, parabolic and open orbits all in one. */
function inPlane(e: number, q: number, days: number): [number, number] {
  let dt = days;
  const alpha = (1 - e) / q;
  if (e < 1) {
    const a = q / (1 - e);
    const period = (2 * Math.PI * Math.sqrt(a * a * a)) / GAUSS_K;
    dt -= period * Math.round(dt / period);
  }
  if (dt === 0) return [q, 0];
  const sign = dt < 0 ? -1 : 1;
  const target = GAUSS_K * Math.abs(dt);
  const f = (chi: number): number => {
    const [, s] = stumpff(alpha * chi * chi);
    return q * chi + e * chi * chi * chi * s;
  };
  // the start: Barker's cubic, a parabola's solution, found by Cardano's formula; then Newton's method held inside a bracket that bisection falls back on
  let chi = target / q;
  if (e > 1e-3) {
    const w = Math.cbrt((3 * target) / e + Math.sqrt(9 * (target / e) ** 2 + 8 * (q / e) ** 3));
    if (Number.isFinite(w) && w > 0) chi = w - (2 * q) / (e * w);
  }
  let lo = 0;
  let hi = Math.max(chi * 2, 1e-9);
  for (let guard = 0; f(hi) < target && guard < 200; guard += 1) hi *= 2;
  for (let round = 0; round < 100; round += 1) {
    const z = alpha * chi * chi;
    const [c, s] = stumpff(z);
    const value = q * chi + e * chi * chi * chi * s - target;
    if (value > 0) hi = Math.min(hi, chi);
    else lo = Math.max(lo, chi);
    if (Math.abs(value) < 1e-14 * Math.max(1, target)) break;
    const r = chi * chi * c + q * (1 - z * c);
    let next = chi - value / r;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    if (next === chi) break;
    chi = next;
  }
  const z = alpha * chi * chi;
  const [c, s] = stumpff(z);
  const fx = 1 - (chi * chi * c) / q;
  const gx = Math.abs(dt) - (chi * chi * chi * s) / GAUSS_K;
  const speed = GAUSS_K * Math.sqrt((1 + e) / q);
  return [fx * q, sign * gx * speed];
}

function rotate(x: number, y: number, comet: CometRecord): Vec3 {
  const node = comet.node * RAD;
  const w = comet.w * RAD;
  const inc = comet.i * RAD;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  return [(cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y, (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y, sw * si * x + cw * si * y];
}

/** A Julian date in TDB as milliseconds since 1970 in UTC. */
function utcOfJulianDate(jd: number): number {
  const tt = (jd - UNIX_EPOCH_JD) * DAY_MS;
  return tt - ttMinusUtc(tt) * 1000;
}

/**
 * Where a comet is at a moment: x, y, z in astronomical units from the Sun, in the J2000 ecliptic frame (the axes of `heliocentric`), from two-body motion on the comet's elements. Closed, parabolic and open orbits all work.
 * A date far from the comet's epoch is accepted and answered, but the real comet is not where two-body motion puts it, see `COMET_ACCURACY` and `cometTrust`. A comet that is not in the set throws a `RangeError`, a `when`
 * that is not a date or a finite number a `TypeError` or `RangeError`.
 *
 * @param comet - A comet of the set, one from `cometFromElements`, or the id, designation or name of one in the set.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The position in astronomical units.
 *
 * @example
 * ```ts
 * import { cometPosition } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const [x, y, z] = cometPosition("67P", Date.UTC(2021, 10, 2));
 * console.log(Math.hypot(x, y, z).toFixed(3), "au from the Sun");
 * ```
 */
export function cometPosition(comet: CometRecord | string, when: When): Vec3 {
  const record = resolve(comet);
  const ms = moment(when);
  const days = (toTerrestrialTime(ms) / DAY_MS + UNIX_EPOCH_JD) - record.tp;
  const [x, y] = inPlane(record.e, record.q, days);
  const out = rotate(x, y, record);
  if (!Number.isFinite(out[0]) || !Number.isFinite(out[1]) || !Number.isFinite(out[2])) throw new RangeError(`${record.designation} has no position at ${new Date(ms).toISOString()} on two-body motion: too far from its perihelion`);
  return out;
}

/**
 * How far a comet is from the Sun and from the Earth at a moment, in astronomical units (the Earth from `heliocentric`).
 *
 * @param comet - A comet of the set, one from `cometFromElements`, or the id, designation or name of one in the set.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns `sunAu` and `earthAu`.
 *
 * @example
 * ```ts
 * import { cometDistance } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const d = cometDistance("hale-bopp", Date.UTC(1997, 2, 22));
 * console.log(`${d.sunAu.toFixed(2)} au from the Sun, ${d.earthAu.toFixed(2)} au from the Earth`);
 * ```
 */
export function cometDistance(comet: CometRecord | string, when: When): { sunAu: number; earthAu: number } {
  const ms = moment(when);
  const position = cometPosition(comet, ms);
  return { sunAu: length(position), earthAu: length(sub(position, heliocentric("earth", ms))) };
}

/**
 * A comet's orbit as points to draw a line through: x, y, z in astronomical units from the Sun, in the J2000 ecliptic frame, three numbers a point. A closed orbit whose far end is within `maxAu` is the whole
 * ellipse, with its first point repeated at the end so a line closes; any other orbit is the arc through perihelion from where it comes in to where it goes out, up to `maxAu` from the Sun. Points are closer
 * together near the Sun, where the orbit bends.
 *
 * @param comet - A comet of the set, one from `cometFromElements`, or the id, designation or name of one in the set.
 * @param points - How many points, from 8 (default 180).
 * @param maxAu - The furthest distance from the Sun to draw, in astronomical units (default 40: past Neptune).
 * @returns The points, `3 * points` numbers (one more point for a closed ellipse).
 *
 * @example
 * ```ts
 * import { cometOrbit } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const line = cometOrbit("halley", 120);
 * console.log(line.length / 3, "points, the first at", line[0]!.toFixed(2), line[1]!.toFixed(2), line[2]!.toFixed(2));
 * ```
 */
export function cometOrbit(comet: CometRecord | string, points = 180, maxAu = 40): Float32Array {
  const record = resolve(comet);
  if (!Number.isInteger(points) || points < 8 || points > 100_000) throw new RangeError(`points must be a whole number from 8 to 100000, got ${String(points)}`);
  if (!(maxAu > record.q) || !Number.isFinite(maxAu)) throw new RangeError(`maxAu must be a finite number beyond the perihelion distance ${record.q}, got ${String(maxAu)}`);
  const { e, q } = record;
  const closed = e < 1 && (q * (1 + e)) / (1 - e) <= maxAu;
  const count = closed ? points + 1 : points;
  const out = new Float32Array(count * 3);
  const put = (k: number, x: number, y: number): void => {
    const p = rotate(x, y, record);
    out[k * 3] = p[0];
    out[k * 3 + 1] = p[1];
    out[k * 3 + 2] = p[2];
  };
  if (closed) {
    const a = q / (1 - e);
    const b = a * Math.sqrt(1 - e * e);
    for (let k = 0; k < count; k += 1) {
      const eccentric = (k / points) * 2 * Math.PI;
      put(k, a * (Math.cos(eccentric) - e), b * Math.sin(eccentric));
    }
    return out;
  }
  const p = q * (1 + e);
  const cosMax = e === 0 ? -1 : Math.max(-1, Math.min(1, (p / maxAu - 1) / e));
  const reach = Math.acos(Math.max(cosMax, e >= 1 ? -1 / e + 1e-9 : -1));
  for (let k = 0; k < count; k += 1) {
    const u = (2 * k) / (count - 1) - 1;
    const nu = reach * Math.sign(u) * u * u;
    const r = p / (1 + e * Math.cos(nu));
    put(k, r * Math.cos(nu), r * Math.sin(nu));
  }
  return out;
}

/**
 * The last and the next time a comet is at perihelion, relative to a moment, in milliseconds since 1970 (UTC). For a periodic comet of the set between the two dates JPL gives (`CometRecord.perihelion`: the last, observed or predicted
 * from JPL's solution, and the next, JPL's prediction by integrating that orbit) they are those, `basis` is `"jpl"`, and `lastObserved` says whether the last passage was observed. Outside that span the passages are repeated from the
 * nearest JPL date with the osculating period and `basis` is `"estimated"` (good to months for a short orbit and to a year or more for a long one). A comet of the set on a parabola or an open orbit has one perihelion, JPL's, which is the last when
 * it is behind and the next when it is ahead (the other is `null`). A comet from `cometFromElements` has the date it was given (`"elements"`) or the repetition of it (`"estimated"`).
 *
 * @param comet - A comet of the set, one from `cometFromElements`, or the id, designation or name of one in the set.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns `last` and `next`, in milliseconds since 1970 (UTC), `null` where there is none; `basis`; and `lastObserved`.
 *
 * @example
 * ```ts
 * import { cometPerihelia } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const { last, next, basis } = cometPerihelia("1P", Date.UTC(2026, 10, 11));
 * console.log(new Date(last!).toISOString().slice(0, 10), new Date(next!).toISOString().slice(0, 10), basis);
 * ```
 */
export function cometPerihelia(comet: CometRecord | string, when: When): { last: number | null; next: number | null; basis: "jpl" | "elements" | "estimated"; lastObserved: boolean } {
  const record = resolve(comet);
  const ms = moment(when);
  const jpl = record.perihelion;
  if (jpl !== undefined) {
    const last = utcOfJulianDate(jpl.last);
    const next = utcOfJulianDate(jpl.next);
    if (last <= ms && ms < next) return { last, next, basis: "jpl", lastObserved: jpl.lastObserved };
  }
  const tp = utcOfJulianDate(record.tp);
  if (!(record.e < 1)) {
    const basis = record.spkid === null ? "elements" : "jpl";
    return tp <= ms ? { last: tp, next: null, basis, lastObserved: false } : { last: null, next: tp, basis, lastObserved: false };
  }
  const period = (2 * Math.PI * Math.sqrt((record.q / (1 - record.e)) ** 3)) / GAUSS_K;
  const anchor = jpl === undefined ? record.tp : ms < utcOfJulianDate(jpl.last) ? jpl.last : jpl.next;
  const turns = Math.floor((toTerrestrialTime(ms) / DAY_MS + UNIX_EPOCH_JD - anchor) / period);
  return { last: utcOfJulianDate(anchor + turns * period), next: utcOfJulianDate(anchor + (turns + 1) * period), basis: jpl === undefined && (turns === 0 || turns === -1) ? "elements" : "estimated", lastObserved: false };
}

/**
 * How far a moment is from the comet's epoch, and whether it is inside the year around it that the position was measured against Horizons for (`COMET_ACCURACY.trustedDays`).
 *
 * @param comet - A comet of the set, one from `cometFromElements`, or the id, designation or name of one in the set.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns `epoch` (milliseconds since 1970, UTC), `daysFromEpoch` (negative before it) and `withinYear`.
 *
 * @example
 * ```ts
 * import { cometTrust } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const trust = cometTrust("neowise", Date.UTC(2026, 0, 1));
 * console.log(trust.daysFromEpoch.toFixed(0), "days from the epoch;", trust.withinYear ? "near it" : "far from it: two-body motion drifts");
 * ```
 */
export function cometTrust(comet: CometRecord | string, when: When): { epoch: number; daysFromEpoch: number; withinYear: boolean } {
  const record = resolve(comet);
  const epoch = utcOfJulianDate(record.epoch);
  const daysFromEpoch = (moment(when) - epoch) / DAY_MS;
  return { epoch, daysFromEpoch, withinYear: Math.abs(daysFromEpoch) <= TRUSTED_DAYS };
}

/**
 * What a page gives to add a comet that is not in the set (a newly found one) without a release: the elements as the Minor Planet Center and JPL publish them.
 *
 * @example
 * ```ts
 * import { cometFromElements, type CometElementsInput } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const elements: CometElementsInput = { designation: "C/2099 B1", e: 1, q: 1.2, i: 80, node: 15, w: 200, tp: 2_488_000.5 };
 * console.log(cometFromElements(elements).kind);
 * ```
 */
export interface CometElementsInput {
  /** The designation: `C/2025 X1`. */
  designation: string;
  /** The id, lower case with hyphens; made from the designation when left out. */
  id?: string;
  /** The names; `ja` is left empty when not given. */
  name?: { en: string; ja?: string };
  /** The eccentricity, 0 or more (1 is a parabola). */
  e: number;
  /** The perihelion distance in astronomical units, more than 0. */
  q: number;
  /** The inclination in degrees, 0 to 180. */
  i: number;
  /** The longitude of the ascending node in degrees. */
  node: number;
  /** The argument of perihelion in degrees. */
  w: number;
  /** The time of perihelion as a Julian date in TDB (as JPL gives it). Give this or `perihelion`. */
  tp?: number;
  /** The time of perihelion as a `Date` or milliseconds since 1970 (UTC), where the date is known that way. Give this or `tp`. */
  perihelion?: When;
  /** The epoch of the elements as a Julian date in TDB; the time of perihelion when left out. */
  epoch?: number;
  /** `periodic`, `long-period` or `interstellar`; made from the orbit when left out (a closed orbit under 200 years is periodic, any other is long-period). */
  kind?: CometKind;
}

/**
 * A comet made from elements a page supplies, to use with every function here, so a newly found comet needs no release. The comet is checked (a bad number throws a `TypeError` or a `RangeError` that names it) and the
 * angles are folded into 0 to 360. Fields the elements do not give are `null` or empty.
 *
 * @param input - The elements.
 * @returns The comet.
 *
 * @example
 * ```ts
 * import { cometFromElements, cometPosition } from "@johnmorrisdotca/wakusei-planets/comets";
 *
 * const comet = cometFromElements({ designation: "C/2099 A1", e: 0.99, q: 0.8, i: 45, node: 120, w: 30, perihelion: Date.UTC(2099, 5, 1) });
 * console.log(cometPosition(comet, Date.UTC(2099, 5, 1)).map((v) => v.toFixed(3)).join(" "));
 * ```
 */
export function cometFromElements(input: CometElementsInput): CometRecord {
  if (input === null || typeof input !== "object") throw new TypeError("cometFromElements needs an object of elements");
  const named = (field: string, value: unknown): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number, got ${String(value)}`);
    return value;
  };
  if (typeof input.designation !== "string" || input.designation.trim() === "") throw new TypeError("designation must be a non-empty string");
  const e = named("e", input.e);
  const q = named("q", input.q);
  const inclination = named("i", input.i);
  if (e < 0) throw new RangeError(`e must be 0 or more, got ${e}`);
  if (!(q > 0)) throw new RangeError(`q must be more than 0, got ${q}`);
  if (inclination < 0 || inclination > 180) throw new RangeError(`i must be from 0 to 180 degrees, got ${inclination}`);
  if ((input.tp === undefined) === (input.perihelion === undefined)) throw new TypeError("give the time of perihelion as `tp` (a Julian date in TDB) or as `perihelion` (a Date or milliseconds), one of the two");
  const tp = input.tp !== undefined ? named("tp", input.tp) : (() => {
    const tt = toTerrestrialTime(moment(input.perihelion as When, "perihelion"));
    return tt / DAY_MS + UNIX_EPOCH_JD;
  })();
  const epoch = input.epoch === undefined ? tp : named("epoch", input.epoch);
  const fold = (field: string, value: unknown): number => ((named(field, value) % 360) + 360) % 360;
  const periodYears = e < 1 ? (2 * Math.PI * Math.sqrt((q / (1 - e)) ** 3)) / GAUSS_K / YEAR_DAYS : null;
  const kind = input.kind ?? (periodYears !== null && periodYears < 200 ? "periodic" : "long-period");
  if (kind !== "periodic" && kind !== "long-period" && kind !== "interstellar") throw new RangeError(`kind must be periodic, long-period or interstellar, got ${String(kind)}`);
  const designation = input.designation.trim();
  return {
    id: input.id ?? designation.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    designation,
    fullName: input.name?.en === undefined ? designation : `${designation} (${input.name.en})`,
    name: { en: input.name?.en ?? designation, ja: input.name?.ja ?? "" },
    kind,
    e,
    q,
    i: inclination,
    node: fold("node", input.node),
    w: fold("w", input.w),
    tp,
    epoch,
    a: e < 1 ? q / (1 - e) : null,
    periodYears,
    condition: null,
    observations: null,
    arcDays: null,
    solution: null,
    nucleusKm: null,
    nucleusExtentKm: null,
    showers: [],
    spkid: null,
  };
}
