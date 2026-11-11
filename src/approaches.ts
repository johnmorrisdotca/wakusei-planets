// Close approaches of near-Earth objects to the Earth: every approach within 0.05 au from 2026-01-01 to 2036-12-31 (predictions) and the notable ones within 0.002 au (about 0.8 lunar distances) since 1900, from JPL's
// close-approach data (scripts/make-approaches-data.py, src/data/approaches.ts), imported by this entry point only. A table of the approaches and pure functions to list, filter and search them. Pure: no DOM, no clock reads
// (a function that needs "now" takes it as a parameter), no three.js.
import { APPROACH_COVERAGE, APPROACH_FETCHED, APPROACH_ROWS } from "./data/approaches.ts";
import { ttMinusUtc } from "./clock.ts";
import { moment, type When } from "./when.ts";

export type { When } from "./when.ts";

const AU_KM = 149_597_870.7;
const LUNAR_KM = 384_400;
const UNIX_JD = 2_440_587.5;
const DAY_MS = 86_400_000;

/**
 * The albedos assumed when a size is worked out from the absolute magnitude H alone: 0.05 (a dark, carbon-rich body, so a larger one) and 0.25 (a bright, stony one, so a smaller one). The range is wide on purpose: for
 * one H the two sizes differ by a factor of 2.2. Where JPL has a measured diameter, it is given as well, and is the better number.
 *
 * @example
 * ```ts
 * import { APPROACH_ALBEDO } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * console.log(`sizes assume an albedo from ${APPROACH_ALBEDO.dark} (dark) to ${APPROACH_ALBEDO.bright} (bright)`);
 * ```
 */
export const APPROACH_ALBEDO = { dark: 0.05, bright: 0.25 } as const;

/**
 * The uncertainty of the moment of an approach, from JPL's 3-sigma figure.
 *
 * @example
 * ```ts
 * import { approachesBetween, type ApproachTimeSigma } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * const sigma: ApproachTimeSigma = approachesBetween(Date.UTC(2029, 3, 13), Date.UTC(2029, 3, 14))[0]!.timeSigma;
 * console.log(sigma.lessThan ? "under" : "about", sigma.minutes, "minutes");
 * ```
 */
export interface ApproachTimeSigma {
  /** The 3-sigma uncertainty of the moment, in minutes. */
  minutes: number;
  /** True where JPL gives only a bound ("< 00:01"): the uncertainty is under `minutes`. */
  lessThan: boolean;
}

/**
 * The size of a body worked out from its absolute magnitude, for the two albedos of `APPROACH_ALBEDO`: the diameter D = 1329 / sqrt(albedo) x 10^(-H / 5) kilometres.
 *
 * @example
 * ```ts
 * import { approachSizeRange, type ApproachSizeRange } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * const range: ApproachSizeRange = approachSizeRange(19.7);
 * console.log(Math.round(range.minKm * 1000), "to", Math.round(range.maxKm * 1000), "metres");
 * ```
 */
export interface ApproachSizeRange {
  /** The diameter in kilometres if the body is bright (albedo 0.25). */
  minKm: number;
  /** The diameter in kilometres if the body is dark (albedo 0.05). */
  maxKm: number;
}

/**
 * One close approach of a near-Earth object to the Earth.
 *
 * @example
 * ```ts
 * import { nextApproach, type Approach } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * const a: Approach = nextApproach("Apophis", Date.UTC(2026, 10, 11))!;
 * console.log(a.fullName, new Date(a.date).toISOString(), a.distanceLunar.toFixed(2), "lunar distances");
 * ```
 */
export interface Approach {
  /** JPL's primary designation: a number ("99942") or a provisional designation ("2001 WN5", "2024 YR4"). */
  designation: string;
  /** The minor-planet number, or `undefined` for a body not yet numbered. */
  number?: number;
  /** The name ("Apophis"), or `undefined` for a body with none. */
  name?: string;
  /** The full name as JPL gives it: "99942 Apophis (2004 MN4)", "(2001 AV43)". */
  fullName: string;
  /** The moment of the approach, in milliseconds since 1970 (UTC), converted from JPL's TDB. */
  date: number;
  /** The same moment as JPL gives it: a Julian date in TDB. */
  jdTdb: number;
  /** The uncertainty of `date` (3-sigma). */
  timeSigma: ApproachTimeSigma;
  /** The nominal distance between the centres of the body and the Earth, in astronomical units. */
  distanceAu: number;
  /** The same in kilometres. */
  distanceKm: number;
  /** The same in lunar distances (384,400 km). */
  distanceLunar: number;
  /** The least distance within the 3-sigma uncertainty, in astronomical units. For an approach of a body whose orbit is well known it is nearly the nominal one. */
  minDistanceAu: number;
  /** The greatest distance within the 3-sigma uncertainty, in astronomical units. */
  maxDistanceAu: number;
  /** The speed relative to the Earth at the approach, in kilometres a second. */
  speedKmS: number;
  /** The absolute magnitude H. */
  H: number;
  /** The size the absolute magnitude implies, for the albedos of `APPROACH_ALBEDO`. */
  sizeRange: ApproachSizeRange;
  /** The measured diameter in kilometres, where JPL has one. */
  diameterKm?: number;
  /** The 1-sigma uncertainty of `diameterKm` in kilometres, where JPL gives one. */
  diameterSigmaKm?: number;
  /** True for an approach after the date the table was fetched: a prediction that changes as the orbit is refined. */
  predicted: boolean;
}

/**
 * Every approach in the table, as one list, oldest first: the approaches within 0.002 au from 1900 to the end of 2025 (`APPROACH_NOTE.coverage.close`), then those within 0.05 au from 2026 to the end of 2036 (`wide`).
 *
 * @returns The approaches, which must not be changed.
 *
 * @example
 * ```ts
 * import { approachList } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * console.log(approachList().length, "approaches in the table");
 * ```
 */
export function approachList(): readonly Approach[] {
  return all();
}

/**
 * The size range of a body from its absolute magnitude.
 *
 * @param H - The absolute magnitude.
 * @returns The diameters in kilometres for the albedos of `APPROACH_ALBEDO`.
 *
 * @example
 * ```ts
 * import { approachSizeRange } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * const { minKm, maxKm } = approachSizeRange(22);
 * console.log(`H 22: ${Math.round(minKm * 1000)} to ${Math.round(maxKm * 1000)} metres`);
 * ```
 */
export function approachSizeRange(H: number): ApproachSizeRange {
  if (!Number.isFinite(H)) throw new RangeError(`H must be a finite number, got ${String(H)}`);
  const scale = 10 ** (-H / 5);
  return { minKm: (1329 / Math.sqrt(APPROACH_ALBEDO.bright)) * scale, maxKm: (1329 / Math.sqrt(APPROACH_ALBEDO.dark)) * scale };
}

/**
 * What the table is and is not: the dates each part covers and how far. A reader of a table of predictions should see this note.
 *
 * @example
 * ```ts
 * import { APPROACH_NOTE } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * console.log(APPROACH_NOTE.text);
 * ```
 */
export const APPROACH_NOTE = {
  /** The day the table was fetched from JPL, "2026-11-11". */
  fetched: APPROACH_FETCHED,
  /** In words: these are predictions, they change as orbits are refined and as new objects are found. */
  text: `These are predictions from the orbits JPL knew on ${APPROACH_FETCHED}. An approach changes as the orbit of the body is refined by new observations, and a body found after that day is not here: nearly all the small ones are found only days before they pass. The distance is between the centres of the body and the Earth; the uncertainty of the moment and the least and greatest distances are JPL's 3-sigma values. A size from the absolute magnitude assumes an albedo between 0.05 and 0.25.`,
  /** The two parts of the table: `wide` (every approach within 0.05 au from 2026-01-01 to 2036-12-31) and `close` (those within 0.002 au from 1900-01-01 to 2025-12-31), each with the dates it covers and the greatest distance it holds in astronomical units. */
  coverage: APPROACH_COVERAGE,
} as const;

/** The jd of a Julian date in TDB (taken as terrestrial time) as UTC milliseconds. */
function utcOfJd(jd: number): number {
  const tt = (jd - UNIX_JD) * DAY_MS;
  return tt - ttMinusUtc(tt) * 1000;
}

let memo: readonly Approach[] | undefined;
function all(): readonly Approach[] {
  if (memo !== undefined) return memo;
  const fetched = Date.parse(`${APPROACH_FETCHED}T00:00:00Z`);
  const out: Approach[] = APPROACH_ROWS.map((row) => {
    const [des, fullName, jd, dist, distMin, distMax, vRel, sigma, H, diameter, sigmaD] = row;
    const date = utcOfJd(jd);
    const name = /^\d+ ([^(]+?)\s*\(/.exec(fullName)?.[1];
    const one: Approach = {
      designation: des,
      ...(/^\d+$/.test(des) ? { number: Number(des) } : {}),
      ...(name === undefined ? {} : { name }),
      fullName,
      date,
      jdTdb: jd,
      timeSigma: { minutes: Math.abs(sigma), lessThan: sigma < 0 },
      distanceAu: dist,
      distanceKm: dist * AU_KM,
      distanceLunar: (dist * AU_KM) / LUNAR_KM,
      minDistanceAu: distMin,
      maxDistanceAu: distMax,
      speedKmS: vRel,
      H,
      sizeRange: approachSizeRange(H),
      ...(diameter === null ? {} : { diameterKm: diameter }),
      ...(sigmaD === null ? {} : { diameterSigmaKm: sigmaD }),
      predicted: date >= fetched,
    };
    return Object.freeze(one);
  });
  memo = Object.freeze(out.sort((a, b) => a.date - b.date));
  return memo;
}

/** A name or number matched to a record: the designation, the number, the name (ignoring case and accents), or the full name. */
function same(a: Approach, query: string | number): boolean {
  if (typeof query === "number") return a.number === query;
  const key = query.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (key === "") return false;
  const norm = (text: string): string => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return norm(a.designation) === key || (a.name !== undefined && norm(a.name) === key) || norm(a.fullName) === key || (a.number !== undefined && String(a.number) === key);
}

/**
 * The approaches between two moments, from the first (included) to the last (excluded), oldest first.
 *
 * @param from - A `Date` or milliseconds since 1970 (UTC).
 * @param to - Another.
 * @returns The approaches.
 *
 * @example
 * ```ts
 * import { approachesBetween } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * for (const a of approachesBetween(Date.UTC(2029, 0, 1), Date.UTC(2030, 0, 1)).slice(0, 3)) console.log(new Date(a.date).toISOString(), a.fullName, a.distanceLunar.toFixed(1), "LD");
 * ```
 */
export function approachesBetween(from: When, to: When): Approach[] {
  const a = moment(from, "from");
  const b = moment(to, "to");
  return all().filter((x) => x.date >= a && x.date < b);
}

/**
 * A filter on the approaches: every field given must hold.
 *
 * @example
 * ```ts
 * import { approachesWhere, type ApproachFilter } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * const filter: ApproachFilter = { from: Date.UTC(2026, 0, 1), maxLunar: 5, minDiameterKm: 0.1 };
 * console.log(approachesWhere(filter).length, "approaches under 5 lunar distances by bodies over 100 m");
 * ```
 */
export interface ApproachFilter {
  /** Not before this moment. */
  from?: When;
  /** Before this moment. */
  to?: When;
  /** No further than this, in astronomical units. */
  maxAu?: number;
  /** No further than this, in lunar distances. */
  maxLunar?: number;
  /** At least this wide, in kilometres: by the measured diameter, else the middle (geometric mean) of the size range. */
  minDiameterKm?: number;
  /** No wider than this, in kilometres, by the same rule. */
  maxDiameterKm?: number;
  /** Only this object: a number, a designation or a name. */
  object?: string | number;
  /** True for the predictions only (after the fetch date), false for the past only. */
  predicted?: boolean;
}

/**
 * The best estimate of a body's width: the measured diameter where JPL has one, else the geometric mean of the sizes the absolute magnitude implies.
 *
 * @param approach - An approach.
 * @returns The diameter in kilometres.
 *
 * @example
 * ```ts
 * import { approachDiameterKm, nextApproach } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * const a = nextApproach("Apophis", Date.UTC(2026, 10, 11))!;
 * console.log(Math.round(approachDiameterKm(a) * 1000), "metres");
 * ```
 */
export function approachDiameterKm(approach: Pick<Approach, "diameterKm" | "sizeRange">): number {
  return approach.diameterKm ?? Math.sqrt(approach.sizeRange.minKm * approach.sizeRange.maxKm);
}

/**
 * The approaches that pass a filter, oldest first: by date, distance, size, object or prediction.
 *
 * @param filter - What must hold.
 * @returns The approaches.
 *
 * @example
 * ```ts
 * import { approachesWhere } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * const close = approachesWhere({ from: Date.UTC(2026, 10, 11), to: Date.UTC(2030, 0, 1), maxLunar: 1 });
 * console.log(close.map((a) => `${a.fullName} ${new Date(a.date).toISOString().slice(0, 10)}`).join("; "));
 * ```
 */
export function approachesWhere(filter: ApproachFilter): Approach[] {
  const from = filter.from === undefined ? -Infinity : moment(filter.from, "from");
  const to = filter.to === undefined ? Infinity : moment(filter.to, "to");
  const limit = Math.min(filter.maxAu ?? Infinity, filter.maxLunar === undefined ? Infinity : (filter.maxLunar * LUNAR_KM) / AU_KM);
  for (const [name, value] of [["maxAu", filter.maxAu], ["maxLunar", filter.maxLunar], ["minDiameterKm", filter.minDiameterKm], ["maxDiameterKm", filter.maxDiameterKm]] as const) {
    if (value !== undefined && !(value >= 0)) throw new RangeError(`${name} must be a number of 0 or more, got ${String(value)}`);
  }
  return all().filter((a) => {
    if (a.date < from || a.date >= to || a.distanceAu > limit) return false;
    if (filter.predicted !== undefined && a.predicted !== filter.predicted) return false;
    if (filter.object !== undefined && !same(a, filter.object)) return false;
    if (filter.minDiameterKm !== undefined || filter.maxDiameterKm !== undefined) {
      const width = approachDiameterKm(a);
      if (filter.minDiameterKm !== undefined && width < filter.minDiameterKm) return false;
      if (filter.maxDiameterKm !== undefined && width > filter.maxDiameterKm) return false;
    }
    return true;
  });
}

/**
 * The closest approaches, nearest first, among those a filter lets through (all of them with no filter).
 *
 * @param count - How many.
 * @param filter - What must hold; the default is everything in the table.
 * @returns At most `count` approaches, in order of distance.
 *
 * @example
 * ```ts
 * import { nearestApproaches } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * for (const a of nearestApproaches(3, { from: Date.UTC(2026, 10, 11) })) console.log(a.fullName, new Date(a.date).toISOString().slice(0, 10), Math.round(a.distanceKm), "km");
 * ```
 */
export function nearestApproaches(count: number, filter: ApproachFilter = {}): Approach[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`count must be a whole number of 0 or more, got ${String(count)}`);
  return approachesWhere(filter)
    .sort((a, b) => a.distanceAu - b.distanceAu || a.date - b.date)
    .slice(0, count);
}

/**
 * The next approach of a named object after a moment (that moment excluded).
 *
 * @param object - A number, a designation or a name ("Apophis", 99942, "2024 YR4").
 * @param after - A `Date` or milliseconds since 1970 (UTC): the module reads no clock, so "now" is yours to give.
 * @returns The approach, or `undefined` when the table holds none after it.
 *
 * @example
 * ```ts
 * import { nextApproach } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * const a = nextApproach("Apophis", Date.UTC(2026, 10, 11));
 * console.log(a === undefined ? "none" : `${new Date(a.date).toISOString()} at ${a.distanceKm.toFixed(0)} km`);
 * ```
 */
export function nextApproach(object: string | number, after: When): Approach | undefined {
  const t = moment(after, "after");
  return all().find((a) => a.date > t && same(a, object));
}

/**
 * Every approach of a named object in the table, oldest first.
 *
 * @param object - A number, a designation or a name.
 * @returns The approaches.
 *
 * @example
 * ```ts
 * import { approachesOf } from "@johnmorrisdotca/wakusei-planets/approaches";
 *
 * console.log(approachesOf("Apophis").map((a) => new Date(a.date).toISOString().slice(0, 10)).join(", "));
 * ```
 */
export function approachesOf(object: string | number): Approach[] {
  return all().filter((a) => same(a, object));
}
