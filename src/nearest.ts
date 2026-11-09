// Which bodies are nearest to a body on a date, and when two bodies come closest over a span: for the Sun, the planets, the dwarf planets and the moons, by the angle between them in the sky of an observer
// or by the distance between them in space. The positions are this package's own (heliocentric, ephemeris.ts): a sky angle is astrometric (the Earth's or the observer's place at the date, the body's place when
// its light left, no aberration or light bending), a distance is the geometry at one instant. Each result carries the accuracy the theories are held to (docs/guides/accuracy.md). Pure: no DOM, no three.js.
import { heliocentric, heliocentricModel, meanSunAu, moonVector } from "./ephemeris.ts";
import { julianCenturies } from "./clock.ts";
import { BODIES, BODY_IDS, type BodyFacts, type BodyId } from "./facts.ts";
import { ORBITS } from "./data/orbits.ts";
import { moonTheoryOf } from "./data/theories.ts";
import { eclipticJ2000ToTrueEquatorialOfDate } from "./sky/frames.ts";
import { observerVector } from "./sky/engine.ts";
import type { Observer } from "./sky/types.ts";
import { cross, DEG, length, scale, sub, type Vec3 } from "./vec.ts";
import { moment, type When } from "./when.ts";

const AU_KM = 149_597_870.7;
const LIGHT_SECONDS_PER_AU = 499.004784;
const DAY_MS = 86_400_000;
const ARCSECONDS_PER_RADIAN = 206_264.806;
const KINDS: readonly BodyFacts["kind"][] = ["star", "planet", "dwarf-planet", "moon"];

/** The worst direction error from the Sun in arc-seconds over 60 dates from 1800 to 2200, as the accuracy guide holds each planet to. */
const PLANET_ARCSECONDS: Readonly<Record<string, number>> = { mercury: 4.5, venus: 2.6, earth: 4, mars: 6, jupiter: 3.6, saturn: 5.7, uranus: 5, neptune: 3.4, pluto: 0.2 };
/** The same for a dwarf planet inside its fitted table's years. */
const DWARF_ARCSECONDS: Readonly<Record<string, number>> = { ceres: 0.3, orcus: 0.1, haumea: 0.1, quaoar: 0.15, makemake: 0.15, gonggong: 0.1, eris: 0.1, sedna: 0.1 };
/** A dwarf planet outside its table's years runs on the osculating elements of one epoch, and Pluto outside 1800 to 2200 on JPL's approximate elements. */
const OSCULATING_ARCSECONDS = 3600;
const APPROXIMATE_ARCSECONDS = 120;
/** The worst direction error from the planet in degrees over 60 dates, for the Moon and each moon; a moon the accuracy guide does not measure is given 5 degrees. */
const MOON_DEGREES: Readonly<Record<string, number>> = {
  moon: 0.0016, phobos: 0.55, deimos: 0.55, io: 0.15, europa: 0.05, ganymede: 0.03, callisto: 0.02,
  mimas: 2.1, enceladus: 0.72, tethys: 0.27, dione: 0.23, rhea: 0.27, titan: 0.06, iapetus: 0.04,
  miranda: 3, ariel: 0.3, umbriel: 0.28, titania: 0.52, oberon: 0.6,
  triton: 0.17, nereid: 6.3, proteus: 0.17, charon: 0.06, nix: 2.6, hydra: 2.1,
};
/** The same for the moons of Jupiter and Saturn when `tables` has not been imported and their fitted orbits answer. */
const FITTED_MOON_DEGREES: Readonly<Record<string, number>> = { io: 0.15, europa: 0.18, ganymede: 0.6, callisto: 0.09, mimas: 7.5, enceladus: 0.72, tethys: 0.45, dione: 0.23, rhea: 0.27, titan: 0.08, iapetus: 0.72 };

/**
 * What kind of body: the Sun is `"star"`.
 *
 * @example
 * ```ts
 * import { nearest, type NearestKind } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const kind: NearestKind = "planet";
 * console.log(nearest("moon", { kind, count: 1, date: Date.UTC(2026, 10, 8) })[0]?.id);
 * ```
 */
export type NearestKind = BodyFacts["kind"];

/**
 * Where the sky is seen from: a body's centre (`"mars"` for the sky of Mars), or a place on the Earth, whose parallax counts (the Moon is up to a degree different from there than from the Earth's centre). The default is the Earth's centre.
 *
 * @example
 * ```ts
 * import { nearest, type Viewpoint } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const vancouver: Viewpoint = { latitude: 49.28, longitude: -123.12 };
 * console.log(nearest("moon", { observer: vancouver, count: 1, date: Date.UTC(2026, 10, 8) })[0]?.id);
 * ```
 */
export type Viewpoint = BodyId | Observer;

/**
 * The options of `nearest`, `within`, `closestApproach` and `conjunctions` that mean the same in each.
 *
 * @example
 * ```ts
 * import { nearest, type NearestOptions } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const options: NearestOptions = { count: 3, kind: "planet", date: Date.UTC(2026, 10, 8) };
 * console.log(nearest("moon", options).map((row) => row.id).join(", "));
 * ```
 */
export interface NearestOptions {
  /** How many to return. Default 5, or all of those inside `within` when `within` is given. */
  count?: number;
  /** Only those this close: degrees for `by: "sky"`, kilometres for `by: "space"`. */
  within?: number;
  /** Only this kind of body, or any of these kinds. */
  kind?: NearestKind | readonly NearestKind[];
  /** Search only these bodies. Default: every body. */
  bodies?: readonly BodyId[];
  /** `"sky"` (default): the angle between the two in the sky of the observer. `"space"`: the distance between their centres. */
  by?: "sky" | "space";
  /** The moment, a `Date` or milliseconds since 1970 (UTC). Default: now. */
  date?: When;
  /** Where the sky is seen from; ignored by `by: "space"`. Default: the Earth's centre. */
  observer?: Viewpoint;
}

/**
 * A body near the target in the sky: its angle from the target in degrees (0 to 180) and how far that angle may be off, in arc-seconds.
 *
 * @example
 * ```ts
 * import { nearest, type SkyNeighbour } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const next: SkyNeighbour | undefined = nearest("moon", { count: 1, date: Date.UTC(2026, 10, 8) })[0];
 * console.log(next?.id, next?.angle.toFixed(1));
 * ```
 */
export interface SkyNeighbour {
  id: BodyId;
  kind: NearestKind;
  /** The angle between the target and this body in the observer's sky, degrees. */
  angle: number;
  /** The accuracy to expect of `angle`, in arc-seconds: the limits the accuracy tests hold the theories to, combined. An expectation, not a bound. */
  uncertaintyArcseconds: number;
}

/**
 * A body near the target in space: the distance between their centres, and how far that may be off.
 *
 * @example
 * ```ts
 * import { nearest, type SpaceNeighbour } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const next: SpaceNeighbour | undefined = nearest("earth", { by: "space", count: 1, date: Date.UTC(2026, 10, 8) })[0];
 * console.log(next?.id, Math.round(next?.distanceKm ?? 0));
 * ```
 */
export interface SpaceNeighbour {
  id: BodyId;
  kind: NearestKind;
  /** The distance between the two centres at the date, kilometres. */
  distanceKm: number;
  /** The same in astronomical units. */
  distanceAu: number;
  /** The accuracy to expect of `distanceKm`, kilometres: the limits the accuracy tests hold the theories to, combined. An expectation, not a bound. */
  uncertaintyKm: number;
}

/**
 * The closest two bodies come in a span: the moment of the minimum and the separation then.
 *
 * @example
 * ```ts
 * import { closestApproach, type Approach } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const found: Approach = closestApproach("jupiter", "saturn", { from: Date.UTC(2020, 11, 1), to: Date.UTC(2021, 0, 1) });
 * console.log(found.time.toISOString(), found.angle?.toFixed(2));
 * ```
 */
export interface Approach {
  a: BodyId;
  b: BodyId;
  /** The moment of the minimum, to about a second of time. */
  time: Date;
  /** Degrees, for `by: "sky"`. */
  angle?: number;
  /** The accuracy to expect of `angle`, arc-seconds, for `by: "sky"`. */
  uncertaintyArcseconds?: number;
  /** Kilometres, for `by: "space"`. */
  distanceKm?: number;
  /** Astronomical units, for `by: "space"`. */
  distanceAu?: number;
  /** The accuracy to expect of `distanceKm`, for `by: "space"`. */
  uncertaintyKm?: number;
  /** How far the moment may be off, in seconds: the position's accuracy over how fast the two move past each other. */
  uncertaintySeconds: number;
  /** True when the smallest separation in the span is at its start or end, not a minimum inside it. */
  atEdge: boolean;
}

/**
 * Where a search looks, and what counts as close.
 *
 * @example
 * ```ts
 * import { closestApproach, type ApproachOptions } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const options: ApproachOptions = { from: Date.UTC(2023, 1, 20), to: Date.UTC(2023, 2, 10) };
 * console.log(closestApproach("venus", "jupiter", options).time.toISOString());
 * ```
 */
export interface ApproachOptions {
  /** The start of the span, a `Date` or milliseconds since 1970 (UTC). */
  from: When;
  /** The end of the span. */
  to: When;
  /** `"sky"` (default) or `"space"`, as in `nearest`. */
  by?: "sky" | "space";
  /** Where the sky is seen from; ignored by `by: "space"`. Default: the Earth's centre. */
  observer?: Viewpoint;
}

/**
 * The options of `conjunctions`.
 *
 * @example
 * ```ts
 * import { conjunctions, type ConjunctionOptions } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const options: ConjunctionOptions = { from: Date.UTC(2020, 11, 1), to: Date.UTC(2021, 0, 1), bodies: ["jupiter", "saturn"], within: 1 };
 * console.log(conjunctions(options).length);
 * ```
 */
export interface ConjunctionOptions extends ApproachOptions {
  /** Only closest approaches this small: degrees for `by: "sky"` (default 5), kilometres for `by: "space"` (default: all). */
  within?: number;
  /** The bodies to pair up. Default: the Sun and Mercury to Neptune, without the Earth's own place. */
  bodies?: readonly BodyId[];
}

interface View {
  body: BodyId;
  place?: Observer;
}

interface Sighting {
  /** A unit direction in the sky, or a position in au in space. */
  v: Vec3;
  /** Kilometres from the observer, for the sky. */
  km: number;
}

const finite = (name: string, value: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${name} must be a finite number, got ${String(value)}`);
  return value;
};

function bodyOf(name: string, value: BodyId): BodyId {
  if (typeof value !== "string" || !(BODY_IDS as readonly string[]).includes(value)) throw new RangeError(`${name} must be a body such as "mars" or "io", got ${JSON.stringify(value)}`);
  return value;
}

function byOf(by: unknown): "sky" | "space" {
  if (by === undefined) return "sky";
  if (by !== "sky" && by !== "space") throw new RangeError(`by must be "sky" or "space", got ${JSON.stringify(by)}`);
  return by;
}

function viewOf(observer: Viewpoint | undefined): View {
  if (observer === undefined) return { body: "earth" };
  if (typeof observer === "string") return { body: bodyOf("observer", observer) };
  if (typeof observer !== "object" || observer === null) throw new TypeError(`observer must be a body name or { latitude, longitude }, got ${String(observer)}`);
  const latitude = finite("observer.latitude", observer.latitude);
  const longitude = finite("observer.longitude", observer.longitude);
  if (latitude < -90 || latitude > 90) throw new RangeError(`observer.latitude must be between -90 and 90, got ${latitude}`);
  return { body: "earth", place: { latitude, longitude, heightM: observer.heightM === undefined ? 0 : finite("observer.heightM", observer.heightM) } };
}

/** A body's centre in the Sun's frame (J2000 ecliptic, au) at an instant. */
function placeAu(id: BodyId, ms: number): Vec3 {
  if (id === "sun") return [0, 0, 0];
  const facts = BODIES[id];
  if (facts.kind !== "moon") return heliocentric(id as Parameters<typeof heliocentric>[0], ms);
  const host = heliocentric(facts.parent ?? "earth", ms);
  const offset = moonVector(id as Parameters<typeof moonVector>[0], ms);
  return [host[0] + offset[0] / AU_KM, host[1] + offset[1] / AU_KM, host[2] + offset[2] / AU_KM];
}

/** The unit direction to a body and its distance in km from a view at an instant, with the light time allowed for. */
function sight(view: View, id: BodyId, ms: number): Sighting {
  const origin = placeAu(view.body, ms);
  let emit = ms;
  let v = sub(placeAu(id, emit), origin);
  for (let i = 0; i < 2; i += 1) {
    emit = ms - length(v) * LIGHT_SECONDS_PER_AU * 1000;
    v = sub(placeAu(id, emit), origin);
  }
  if (view.place !== undefined) {
    const turned = eclipticJ2000ToTrueEquatorialOfDate(scale(v, AU_KM), julianCenturies(ms));
    const topocentric = sub(turned, observerVector(view.place, ms));
    const km = length(topocentric);
    return { v: scale(topocentric, 1 / km), km };
  }
  const km = length(v) * AU_KM;
  return { v: scale(v, 1 / length(v)), km };
}

function sample(by: "sky" | "space", view: View, ids: readonly BodyId[], ms: number): Map<BodyId, Sighting> {
  const at = new Map<BodyId, Sighting>();
  for (const id of ids) at.set(id, by === "sky" ? sight(view, id, ms) : { v: placeAu(id, ms), km: 0 });
  return at;
}

/** Degrees between two unit directions, or kilometres between two positions in au; atan2 keeps it exact near 0 and 180 degrees. */
function separation(by: "sky" | "space", a: Sighting, b: Sighting): number {
  if (by === "space") return length(sub(a.v, b.v)) * AU_KM;
  return Math.atan2(length(cross(a.v, b.v)), a.v[0] * b.v[0] + a.v[1] * b.v[1] + a.v[2] * b.v[2]) * DEG;
}

function hostErrorKm(host: BodyId, ms: number): number {
  const model = heliocentricModel(host as Parameters<typeof heliocentric>[0], ms);
  const arcseconds = model.theory === "vsop87b" ? PLANET_ARCSECONDS[host]! : model.theory === "chebyshev" ? (PLANET_ARCSECONDS[host] ?? DWARF_ARCSECONDS[host]!) : model.theory === "osculating-elements" ? OSCULATING_ARCSECONDS : APPROXIMATE_ARCSECONDS;
  return length(heliocentric(host as Parameters<typeof heliocentric>[0], ms)) * AU_KM * Math.tan(arcseconds / ARCSECONDS_PER_RADIAN);
}

/** The independent parts of how far a body's place may be off, kilometres: the planet it goes round (which its moons share) and its own part. */
function partsOf(id: BodyId, ms: number): Map<string, number> {
  const parts = new Map<string, number>();
  if (id === "sun") return parts;
  const facts = BODIES[id];
  if (facts.kind !== "moon") return parts.set(id, hostErrorKm(id, ms));
  const host = facts.parent ?? "earth";
  const fitted = host === "jupiter" || host === "saturn" ? moonTheoryOf(id) === undefined : false;
  const degrees = (fitted ? FITTED_MOON_DEGREES[id] : undefined) ?? MOON_DEGREES[id] ?? 5;
  parts.set(host, hostErrorKm(host, ms));
  return parts.set(`${id} orbit`, length(moonVector(id as Parameters<typeof moonVector>[0], ms)) * Math.tan((degrees * Math.PI) / 180));
}

/**
 * How far the separation of a and b may be off: each part of the places' errors moves a and b by its size over their distance, in the same direction for a part they share (the planet two moons go round,
 * the Earth's own error seen from the Earth), so a shared part cancels in the difference. The parts add in quadrature; a part is taken as acting across the line of sight, the worst case.
 */
function separationError(a: BodyId, b: BodyId, from: BodyId | undefined, distanceA: number, distanceB: number, ms: number): number {
  const parts = [partsOf(a, ms), partsOf(b, ms), from === undefined ? new Map<string, number>() : partsOf(from, ms)] as const;
  let sum = 0;
  for (const key of new Set(parts.flatMap((part) => [...part.keys()]))) {
    const size = parts.find((part) => part.has(key))!.get(key)!;
    const onA = (parts[0].has(key) ? 1 : 0) - (parts[2].has(key) ? 1 : 0);
    const onB = (parts[1].has(key) ? 1 : 0) - (parts[2].has(key) ? 1 : 0);
    sum += (size * onA / distanceA - size * onB / distanceB) ** 2;
  }
  return Math.sqrt(sum);
}

function skyUncertainty(view: View, a: BodyId, b: BodyId, at: Map<BodyId, Sighting>, ms: number): number {
  return separationError(a, b, view.body, at.get(a)!.km, at.get(b)!.km, ms) * ARCSECONDS_PER_RADIAN;
}

function spaceUncertainty(a: BodyId, b: BodyId, ms: number): number {
  return separationError(a, b, undefined, 1, 1, ms);
}

function kindsOf(kind: NearestOptions["kind"]): readonly NearestKind[] | undefined {
  if (kind === undefined) return undefined;
  const list = typeof kind === "string" ? [kind] : kind;
  for (const one of list) if (!KINDS.includes(one)) throw new RangeError(`kind must be one of ${KINDS.join(", ")}, got ${JSON.stringify(one)}`);
  return list;
}

function lookup(target: BodyId, options: NearestOptions, defaultCount: number | undefined): SkyNeighbour[] | SpaceNeighbour[] {
  bodyOf("target", target);
  const by = byOf(options.by);
  const view = viewOf(options.observer);
  const ms = options.date === undefined ? Date.now() : moment(options.date, "date");
  const kinds = kindsOf(options.kind);
  const radius = options.within === undefined ? Infinity : finite("within", options.within);
  if (radius < 0) throw new RangeError(`within must not be negative, got ${radius}`);
  const count = options.count === undefined ? (options.within === undefined ? defaultCount ?? 5 : Infinity) : finite("count", options.count);
  if (count < 0 || !Number.isInteger(count) && count !== Infinity) throw new RangeError(`count must be a whole number of 0 or more, got ${count}`);
  if (by === "sky" && target === view.body) throw new RangeError(`target ${target} is where the sky is seen from (the observer), so it is not in that sky`);
  const pool = (options.bodies ?? BODY_IDS).map((id) => bodyOf("bodies", id));
  const ids = pool.filter((id) => id !== target && (by === "space" || id !== view.body) && (kinds === undefined || kinds.includes(BODIES[id].kind)));
  const at = sample(by, view, [target, ...ids], ms);
  const here = at.get(target)!;
  const rows = ids.map((id) => ({ id, value: separation(by, here, at.get(id)!) })).filter((row) => row.value <= radius).sort((a, b) => a.value - b.value).slice(0, count);
  if (by === "sky") return rows.map((row): SkyNeighbour => ({ id: row.id, kind: BODIES[row.id].kind, angle: row.value, uncertaintyArcseconds: skyUncertainty(view, target, row.id, at, ms) }));
  return rows.map((row): SpaceNeighbour => ({ id: row.id, kind: BODIES[row.id].kind, distanceKm: row.value, distanceAu: row.value / AU_KM, uncertaintyKm: spaceUncertainty(target, row.id, ms) }));
}

/**
 * The bodies nearest to a body on a date, nearest first: by the angle between them in the sky of an observer, or by the distance between them in space. The Sun, the planets, the dwarf planets and the moons are searched; the target itself, and the body the sky is seen from, are not in the answer.
 *
 * A sky angle is astrometric: the observer's place at the date, each body where it was when its light left (a second and a half for the Moon, hours for Neptune), with no aberration or light bending. It is the angle between two centres, found with an arc tangent so that it is as exact near 0 and 180 degrees as at 90. A distance is the straight line between the two centres at that instant, with no light time. Every result carries the accuracy to expect from the theories (the accuracy guide's limits, combined).
 *
 * @param target - The body to look around.
 * @param options - `count` (default 5; all inside `within` when that is given), `within` (degrees for `by: "sky"`, kilometres for `by: "space"`), `kind`, `bodies` (search only these), `by`, `date` (default now) and `observer` (default the Earth's centre).
 * @returns The bodies, nearest first, as `{ id, kind, angle, uncertaintyArcseconds }` for the sky and `{ id, kind, distanceKm, distanceAu, uncertaintyKm }` for space.
 * @throws RangeError for a target, kind, body, count, radius or observer that is not valid, and for a sky target that is the observer's own body.
 *
 * @example
 * ```ts
 * import { nearest } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const date = Date.UTC(2020, 11, 21, 18);
 * console.log(nearest("jupiter", { count: 2, kind: "planet", date }).map((row) => `${row.id} ${row.angle.toFixed(2)}`).join(", "));
 * console.log(nearest("earth", { by: "space", kind: "planet", count: 2, date }).map((row) => `${row.id} ${row.distanceAu.toFixed(2)} au`).join(", "));
 * ```
 */
export function nearest(target: BodyId, options: NearestOptions & { by: "space" }): SpaceNeighbour[];
export function nearest(target: BodyId, options?: NearestOptions & { by?: "sky" }): SkyNeighbour[];
export function nearest(target: BodyId, options: NearestOptions): SkyNeighbour[] | SpaceNeighbour[];
export function nearest(target: BodyId, options: NearestOptions = {}): SkyNeighbour[] | SpaceNeighbour[] {
  return lookup(target, options, undefined);
}

/**
 * Every body inside a radius of a body on a date, nearest first: `nearest` with no limit on how many. The radius is degrees for `by: "sky"` and kilometres for `by: "space"`.
 *
 * @param target - The body to look around.
 * @param radius - How close, in degrees (the sky) or kilometres (space).
 * @param options - The same as `nearest`, without `count` and `within`.
 * @returns The bodies inside the radius, nearest first.
 *
 * @example
 * ```ts
 * import { within } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const date = Date.UTC(2023, 2, 2, 0);
 * console.log(within("venus", 1, { date }).map((row) => `${row.id} ${row.angle.toFixed(2)}`).join(", "));
 * console.log(within("jupiter", 1_000_000, { by: "space", kind: "moon", date }).map((row) => row.id).join(", "));
 * ```
 */
export function within(target: BodyId, radius: number, options: Omit<NearestOptions, "count" | "within"> & { by: "space" }): SpaceNeighbour[];
export function within(target: BodyId, radius: number, options?: Omit<NearestOptions, "count" | "within"> & { by?: "sky" }): SkyNeighbour[];
export function within(target: BodyId, radius: number, options: Omit<NearestOptions, "count" | "within">): SkyNeighbour[] | SpaceNeighbour[];
export function within(target: BodyId, radius: number, options: Omit<NearestOptions, "count" | "within"> = {}): SkyNeighbour[] | SpaceNeighbour[] {
  return lookup(target, { ...options, within: radius, count: undefined }, undefined);
}

/** Days a body takes to go once round what it goes round (the Earth's own orbit for the Earth). */
function periodDays(id: BodyId): number {
  if (id === "sun") return Infinity;
  const facts = BODIES[id];
  if (facts.kind === "moon") return 360 / Math.abs(ORBITS[id as keyof typeof ORBITS]?.sid ?? 1);
  return 365.25 * Math.pow(meanSunAu(id as Parameters<typeof heliocentric>[0]), 1.5);
}

/** How far apart to look: the fastest body of the pairs goes round forty times in this many steps, never more than two days. */
function stepMs(ids: readonly BodyId[], view: View): number {
  const fastest = Math.min(...ids.map(periodDays), periodDays(view.body));
  return Math.max(60_000, Math.min(2 * DAY_MS, (fastest * DAY_MS) / 40));
}

const GOLDEN = (Math.sqrt(5) - 1) / 2;

/** The moment of the smallest value of a function with one minimum in [low, high], to within `tolerance` ms. */
function golden(f: (ms: number) => number, low: number, high: number, tolerance: number): number {
  let a = low;
  let b = high;
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = f(c);
  let fd = f(d);
  while (b - a > tolerance) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLDEN * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLDEN * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}

interface Minimum {
  a: BodyId;
  b: BodyId;
  ms: number;
  value: number;
}

function valueAt(by: "sky" | "space", view: View, a: BodyId, b: BodyId, ms: number): number {
  const at = sample(by, view, [a, b], ms);
  return separation(by, at.get(a)!, at.get(b)!);
}

/** Every minimum of the separation of each pair inside [from, to] (every maximum, for a sign of -1): a coarse scan, then each bracket narrowed to about a second. */
function minima(pairs: ReadonlyArray<readonly [BodyId, BodyId]>, by: "sky" | "space", view: View, from: number, to: number, sign: 1 | -1 = 1): Minimum[] {
  const ids = [...new Set(pairs.flat())];
  const step = stepMs(ids, view);
  const count = Math.ceil((to - from) / step) + 3;
  const times = Array.from({ length: count }, (_, i) => from - step + i * step);
  const values = pairs.map(() => new Float64Array(count));
  times.forEach((ms, i) => {
    const at = sample(by, view, ids, ms);
    pairs.forEach(([a, b], p) => {
      values[p]![i] = sign * separation(by, at.get(a)!, at.get(b)!);
    });
  });
  const found: Minimum[] = [];
  pairs.forEach(([a, b], p) => {
    const v = values[p]!;
    for (let i = 1; i < count - 1; i += 1) {
      if (!(v[i]! <= v[i - 1]! && v[i]! < v[i + 1]!)) continue;
      const ms = golden((t) => sign * valueAt(by, view, a, b, t), times[i - 1]!, times[i + 1]!, 500);
      if (ms >= from && ms <= to) found.push({ a, b, ms, value: valueAt(by, view, a, b, ms) });
    }
  });
  return found;
}

/** The expected accuracy of a separation and of the moment of its minimum. */
function describe(by: "sky" | "space", view: View, a: BodyId, b: BodyId, ms: number, value: number, atEdge: boolean): Approach {
  const at = sample(by, view, [a, b], ms);
  const half = 30_000;
  const before = sample(by, view, [a, b], ms - half);
  const after = sample(by, view, [a, b], ms + half);
  const chord = (s: Map<BodyId, Sighting>): Vec3 => sub(s.get(b)!.v, s.get(a)!.v);
  const moved = length(sub(chord(after), chord(before))) / (2 * half / 1000);
  const base = { a, b, time: new Date(ms), atEdge };
  if (by === "sky") {
    const uncertaintyArcseconds = skyUncertainty(view, a, b, at, ms);
    return { ...base, angle: value, uncertaintyArcseconds, uncertaintySeconds: moved > 0 ? uncertaintyArcseconds / ARCSECONDS_PER_RADIAN / moved : Infinity };
  }
  const uncertaintyKm = spaceUncertainty(a, b, ms);
  return { ...base, distanceKm: value, distanceAu: value / AU_KM, uncertaintyKm, uncertaintySeconds: moved > 0 ? uncertaintyKm / (moved * AU_KM) : Infinity };
}

function span(options: ApproachOptions): { from: number; to: number; by: "sky" | "space"; view: View } {
  const from = moment(options.from, "from");
  const to = moment(options.to, "to");
  if (to < from) throw new RangeError("to must not be before from");
  return { from, to, by: byOf(options.by), view: viewOf(options.observer) };
}

/**
 * When two bodies come closest in a span, and how close: the span is scanned in coarse steps (the fastest body goes round forty times in the step, at most two days), then the smallest minimum is narrowed to about a second of time by golden-section search. If the separation only falls or only rises through the span, the end that is smaller is returned and `atEdge` says so. With `by: "sky"` the separation is the angle in the sky of the observer and a minimum may be an occultation, the angle falling through 0; with `by: "space"` it is the distance between the centres.
 *
 * The result carries `uncertaintyArcseconds` (or `uncertaintyKm`) for the separation, from the accuracy guide's limits, and `uncertaintySeconds` for the moment: that error over how fast the pair moves past each other.
 *
 * @param a - One body.
 * @param b - The other.
 * @param options - `from` and `to` (the span), `by` and `observer` as in `nearest`.
 * @returns The moment, the separation, and the accuracy to expect.
 * @throws RangeError for bodies, a span or an observer that is not valid, or two bodies that are the same, or one of them the observer.
 *
 * @example
 * ```ts
 * import { closestApproach } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const great = closestApproach("jupiter", "saturn", { from: Date.UTC(2020, 11, 1), to: Date.UTC(2021, 0, 1) });
 * console.log(great.time.toISOString(), great.angle?.toFixed(3), "degrees");
 * ```
 */
export function closestApproach(a: BodyId, b: BodyId, options: ApproachOptions): Approach {
  bodyOf("a", a);
  bodyOf("b", b);
  if (a === b) throw new RangeError(`a and b must be different bodies, got ${a} twice`);
  const { from, to, by, view } = span(options);
  if (by === "sky" && (a === view.body || b === view.body)) throw new RangeError(`${a === view.body ? a : b} is where the sky is seen from (the observer), so it is not in that sky`);
  const inside = minima([[a, b]], by, view, from, to);
  const best = inside.sort((x, y) => x.value - y.value)[0];
  const start = valueAt(by, view, a, b, from);
  const end = valueAt(by, view, a, b, to);
  const edge = start <= end ? { ms: from, value: start } : { ms: to, value: end };
  if (best !== undefined && best.value <= edge.value) return describe(by, view, a, b, best.ms, best.value, false);
  return describe(by, view, a, b, edge.ms, edge.value, true);
}

const DEFAULT_BODIES: readonly BodyId[] = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];

/**
 * The close approaches of every pair of bodies in a span, soonest first: each pair's separation is scanned in coarse steps (the fastest body goes round forty times in the step, at most two days), and every minimum inside the span that is within `within` is narrowed to about a second of time. Each is the same as `closestApproach` would return for that pair and that minimum.
 *
 * @param options - `from` and `to`, `within` (degrees for the sky, default 5; kilometres for space, default all), `bodies` (default the Sun and Mercury to Neptune, less the body the sky is seen from), `by` and `observer`.
 * @returns The approaches, soonest first, each with its moment, separation and the accuracy to expect.
 * @throws RangeError for a span, body or observer that is not valid.
 *
 * @example
 * ```ts
 * import { conjunctions } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const found = conjunctions({ from: Date.UTC(2023, 0, 1), to: Date.UTC(2024, 0, 1), bodies: ["venus", "jupiter"], within: 2 });
 * console.log(found.map((one) => `${one.a}-${one.b} ${one.time.toISOString().slice(0, 10)} ${one.angle?.toFixed(2)}`).join("\n"));
 * ```
 */
export function conjunctions(options: ConjunctionOptions): Approach[] {
  const { from, to, by, view } = span(options);
  const radius = options.within === undefined ? (by === "sky" ? 5 : Infinity) : finite("within", options.within);
  const ids = [...new Set((options.bodies ?? DEFAULT_BODIES).map((id) => bodyOf("bodies", id)))].filter((id) => by === "space" || id !== view.body);
  const pairs: Array<readonly [BodyId, BodyId]> = [];
  ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => pairs.push([a, b])));
  if (pairs.length === 0) return [];
  return minima(pairs, by, view, from, to)
    .filter((found) => found.value <= radius)
    .sort((x, y) => x.ms - y.ms)
    .map((found) => describe(by, view, found.a, found.b, found.ms, found.value, false));
}

/**
 * The distance between two bodies at one instant: their centres, in the Sun's frame, with no light time.
 *
 * @example
 * ```ts
 * import { distance, type Distance } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const found: Distance = distance("earth", "moon", Date.UTC(2026, 10, 8));
 * console.log(Math.round(found.distanceKm), "km");
 * ```
 */
export interface Distance {
  a: BodyId;
  b: BodyId;
  /** The moment, milliseconds since 1970 (UTC). */
  time: number;
  distanceKm: number;
  distanceAu: number;
  /** The accuracy to expect of `distanceKm`, kilometres: the limits the accuracy tests hold the theories to, combined. An expectation, not a bound. */
  uncertaintyKm: number;
}

/**
 * The least or the greatest distance of a pair over a span, and when.
 *
 * @example
 * ```ts
 * import { distanceRange, type DistanceAt } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const least: DistanceAt = distanceRange("earth", "mars", { from: Date.UTC(2003, 0, 1), to: Date.UTC(2004, 0, 1) }).min;
 * console.log(least.time.toISOString().slice(0, 10), least.distanceAu.toFixed(3));
 * ```
 */
export interface DistanceAt {
  /** The moment, to about a second of time. */
  time: Date;
  distanceKm: number;
  distanceAu: number;
  /** The accuracy to expect of `distanceKm`, kilometres. */
  uncertaintyKm: number;
  /** True when this is the span's start or end, not a turning point inside it. */
  atEdge: boolean;
}

/**
 * Where a pair is nearest and farthest over a span.
 *
 * @example
 * ```ts
 * import { distanceRange, type DistanceRange } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const range: DistanceRange = distanceRange("venus", "earth", { from: Date.UTC(2026, 0, 1), to: Date.UTC(2028, 0, 1) });
 * console.log(range.min.distanceAu.toFixed(2), range.max.distanceAu.toFixed(2));
 * ```
 */
export interface DistanceRange {
  a: BodyId;
  b: BodyId;
  min: DistanceAt;
  max: DistanceAt;
}

/**
 * The distance between two bodies on a date: the straight line between their centres at that instant, in kilometres and astronomical units, with no light time. Any two of the Sun, the planets, the dwarf planets and the moons.
 *
 * @param a - One body.
 * @param b - The other.
 * @param date - The moment, a `Date` or milliseconds since 1970 (UTC). Default: now.
 * @returns The distance and the accuracy to expect of it.
 * @throws RangeError for a body or a date that is not valid, or two bodies that are the same.
 *
 * @example
 * ```ts
 * import { distance } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const mars = distance("earth", "mars", Date.UTC(2003, 7, 27, 9));
 * console.log(mars.distanceAu.toFixed(4), Math.round(mars.distanceKm), "km");
 * ```
 */
export function distance(a: BodyId, b: BodyId, date?: When): Distance {
  bodyOf("a", a);
  bodyOf("b", b);
  if (a === b) throw new RangeError(`a and b must be different bodies, got ${a} twice`);
  const ms = date === undefined ? Date.now() : moment(date, "date");
  const km = valueAt("space", viewOf(undefined), a, b, ms);
  return { a, b, time: ms, distanceKm: km, distanceAu: km / AU_KM, uncertaintyKm: spaceUncertainty(a, b, ms) };
}

/**
 * The least and the greatest distance between two bodies over a span, each with its moment: the span is scanned in coarse steps (as `closestApproach` does) and each turning point is narrowed to about a second of time by golden-section search, the greatest on the negated distance. If the distance only falls or only rises through the span, the end that is the extreme is returned and `atEdge` says so.
 *
 * @param a - One body.
 * @param b - The other.
 * @param options - `from` and `to`, the span.
 * @returns `min` and `max`, each `{ time, distanceKm, distanceAu, uncertaintyKm, atEdge }`.
 * @throws RangeError for a body or a span that is not valid, or two bodies that are the same.
 *
 * @example
 * ```ts
 * import { distanceRange } from "@johnmorrisdotca/wakusei-planets/nearest";
 *
 * const { min, max } = distanceRange("earth", "mars", { from: Date.UTC(1990, 0, 1), to: Date.UTC(2020, 0, 1) });
 * console.log(min.time.toISOString().slice(0, 10), min.distanceAu.toFixed(3), "to", max.distanceAu.toFixed(3), "au");
 * ```
 */
export function distanceRange(a: BodyId, b: BodyId, options: Pick<ApproachOptions, "from" | "to">): DistanceRange {
  bodyOf("a", a);
  bodyOf("b", b);
  if (a === b) throw new RangeError(`a and b must be different bodies, got ${a} twice`);
  const { from, to, view } = span({ ...options, by: "space" });
  const start = valueAt("space", view, a, b, from);
  const end = valueAt("space", view, a, b, to);
  const pick = (sign: 1 | -1): DistanceAt => {
    const candidates = [...minima([[a, b]], "space", view, from, to, sign).map((found) => ({ ms: found.ms, value: found.value, atEdge: false })), { ms: from, value: start, atEdge: true }, { ms: to, value: end, atEdge: true }];
    const best = candidates.sort((x, y) => sign * (x.value - y.value) || Number(x.atEdge) - Number(y.atEdge))[0]!;
    return { time: new Date(best.ms), distanceKm: best.value, distanceAu: best.value / AU_KM, uncertaintyKm: spaceUncertainty(a, b, best.ms), atEdge: best.atEdge };
  };
  return { a, b, min: pick(1), max: pick(-1) };
}
