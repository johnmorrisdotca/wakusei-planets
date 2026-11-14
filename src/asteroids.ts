// Asteroids and distant small bodies: about a hundred from JPL's Small-Body Database, each with its orbit (osculating elements at an epoch), size, spin, colour class, the missions that visited it and the year it was found, and
// where it is on a date from two-body motion. The records (scripts/make-asteroids-data.py, src/data/asteroids.ts) are imported by this entry point only. Positions are heliocentric, in the J2000 ecliptic frame, in kilometres
// (`asteroidPosition`) or astronomical units (`asteroidPositionAu`, the unit `heliocentric` gives the planets in). The Kepler solver is the package's own. Pure: no DOM, no clock reads, no three.js.
import { ASTEROID_FETCHED, ASTEROID_TABLE } from "./data/asteroids.ts";
import { toTerrestrialTime } from "./clock.ts";
import { madeHere } from "./door/own.ts";
import type { SmallBody, SmallBodySource } from "./door/small-bodies.ts";
import { heliocentric, kepler } from "./ephemeris.ts";
import { length, RAD, sub, type Vec3 } from "./vec.ts";
import { moment, type When } from "./when.ts";

export type { When } from "./when.ts";

const AU_KM = 149_597_870.7;
const LIGHT_KM_PER_SECOND = 299_792.458;
const DAY_MS = 86_400_000;
/** The Julian date of 1970-01-01 00:00. */
const UNIX_JD = 2_440_587.5;

/**
 * The five kinds of body in the set. `main-belt` is the asteroid belt between Mars and Jupiter (JPL's classes inner main belt, main belt, outer main belt and Mars-crosser), `near-earth` an orbit that comes within 1.3 au of the Sun
 * (see `AsteroidGroup`), `trojan` a Jupiter trojan, `centaur` a body between Jupiter and Neptune and `trans-neptunian` one beyond Neptune.
 *
 * @example
 * ```ts
 * import { ASTEROID_KINDS, type AsteroidKind } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const kind: AsteroidKind = ASTEROID_KINDS[0];
 * console.log(kind);
 * ```
 */
export type AsteroidKind = "main-belt" | "near-earth" | "trojan" | "centaur" | "trans-neptunian";

/**
 * The kinds, in the order of their distance from the Sun.
 *
 * @example
 * ```ts
 * import { ASTEROID_KINDS } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log(ASTEROID_KINDS.join(", "));
 * ```
 */
export const ASTEROID_KINDS: readonly AsteroidKind[] = ["near-earth", "main-belt", "trojan", "centaur", "trans-neptunian"];

/**
 * The group of a near-Earth asteroid, named for the first asteroid of its kind: `Atira` (an orbit wholly inside the Earth's), `Aten` (a year shorter than the Earth's, crossing it), `Apollo` (longer, crossing it) and `Amor` (outside it,
 * coming within 1.3 au of the Sun).
 *
 * @example
 * ```ts
 * import { asteroidsOfKind, type AsteroidGroup } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const group: AsteroidGroup = "Apollo";
 * console.log(asteroidsOfKind("near-earth", group).length, "Apollo asteroids");
 * ```
 */
export type AsteroidGroup = "Atira" | "Aten" | "Apollo" | "Amor";

/**
 * The names of a body in English and Japanese.
 *
 * @example
 * ```ts
 * import { findAsteroid, type AsteroidName } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const name: AsteroidName = findAsteroid("Eros")!.name;
 * console.log(name.en, name.ja);
 * ```
 */
export interface AsteroidName {
  /** The name in English, or the provisional designation where the body has no name yet. */
  en: string;
  /** The name in Japanese (the usual katakana of the name), or the designation where the body has no name yet. */
  ja: string;
}

/**
 * The osculating orbit of a body about the Sun at an epoch: the ellipse it would follow if only the Sun's pull acted. Ecliptic and equinox J2000.
 *
 * @example
 * ```ts
 * import { findAsteroid, type AsteroidElements } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const orbit: AsteroidElements = findAsteroid("Eros")!.elements;
 * console.log(orbit.a.toFixed(3), "au, eccentricity", orbit.e.toFixed(3));
 * ```
 */
export interface AsteroidElements {
  /** The epoch as a Julian date in TDB (taken as terrestrial time). */
  epochJd: number;
  /** The semi-major axis, in astronomical units. */
  a: number;
  /** The eccentricity: 0 is a circle, and every body here is an ellipse (under 1). */
  e: number;
  /** The inclination to the ecliptic, in degrees. */
  i: number;
  /** The longitude of the ascending node, in degrees. */
  node: number;
  /** The argument of perihelion, in degrees. */
  peri: number;
  /** The mean anomaly at the epoch, in degrees. */
  ma: number;
  /** The mean motion, in degrees a day. */
  n: number;
  /** The perihelion distance, in astronomical units. */
  q: number;
}

/**
 * A spacecraft that visited or will visit a body.
 *
 * @example
 * ```ts
 * import { findAsteroid, type AsteroidMission } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const visit: AsteroidMission = findAsteroid("Bennu")!.missions[0]!;
 * console.log(visit.name, visit.year);
 * ```
 */
export interface AsteroidMission {
  /** The mission. */
  name: string;
  /** The year of the flyby, rendezvous or landing, or, where `planned` is true, the year it is planned for. */
  year: number;
  /** True while the visit is still to come (or was planned and its outcome is not recorded here). */
  planned?: boolean;
}

/**
 * One body: who it is, what kind, its orbit and what is known of it. A number the source does not give is left out.
 *
 * @example
 * ```ts
 * import { findAsteroid, type AsteroidRecord } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const ryugu: AsteroidRecord = findAsteroid("Ryugu")!;
 * console.log(ryugu.name.ja, ryugu.kind, ryugu.group, ryugu.diameterKm, "km, found in", ryugu.discoveryYear);
 * ```
 */
export interface AsteroidRecord {
  /** A slug of the name: "eros", "apophis", "2024-yr4". Unique in the set. */
  id: string;
  /** The minor-planet number, or `undefined` for a body not yet numbered. */
  number?: number;
  /** The provisional designation ("A898 PA", "2004 MN4", "2024 YR4"). */
  designation: string;
  /** The names. */
  name: AsteroidName;
  /** The kind of body. */
  kind: AsteroidKind;
  /** The group of a near-Earth asteroid (`kind` is `near-earth`), else `undefined`. */
  group?: AsteroidGroup;
  /** JPL's three-letter orbit class ("APO", "MBA", "TJN", "CEN", "TNO", "MCA"...), which says more than `kind` does. */
  orbitClass: string;
  /** True where JPL lists the body as a potentially hazardous asteroid (an Earth orbit crossing within 0.05 au and brighter than H = 22), as the source states it. */
  hazardous: boolean;
  /** JPL's SPK-ID, the number Horizons knows the body by. */
  spkid: number;
  /** The orbit. */
  elements: AsteroidElements;
  /** The absolute magnitude H: the brightness at one au from the Sun and from the observer, full phase. */
  H?: number;
  /** The measured diameter in kilometres, where the source gives one. */
  diameterKm?: number;
  /** The geometric albedo, where the source gives one. */
  albedo?: number;
  /** The rotation period in hours, where the source gives one. */
  rotationHours?: number;
  /** The spectral class (SMASS where given, else Tholen): "S", "C", "V", "Xe"... */
  spectral?: string;
  /** The least distance between the body's orbit and the Earth's, in astronomical units. */
  moidAu?: number;
  /** The number of moons known. */
  satellites?: number;
  /** The year of discovery. */
  discoveryYear?: number;
  /** The spacecraft that visited or will visit it, in date order. */
  missions: readonly AsteroidMission[];
  /** A line worth knowing, in English. */
  note?: string;
  /** Where the numbers come from. */
  source: string;
}

/**
 * Every body in the set: about a hundred, in the order of the table (the largest main-belt asteroids, then the spacecraft's visits, the near-Earth asteroids, the trojans, the centaurs and the trans-Neptunian objects). The package's
 * own bodies (Ceres, Pallas, Vesta, Chiron, Pholus, Halley, Pluto and the dwarf planets Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris and Sedna) are not repeated here: they have their own, fuller, tables.
 *
 * @example
 * ```ts
 * import { ASTEROIDS } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log(ASTEROIDS.length, "bodies;", ASTEROIDS.filter((a) => a.missions.length > 0).length, "visited or to be visited");
 * ```
 */
export const ASTEROIDS: readonly AsteroidRecord[] = ASTEROID_TABLE;

/**
 * The day the records were read from the Small-Body Database, "2026-11-11". Orbits are refined as bodies are observed, so a later read gives slightly different elements.
 *
 * @example
 * ```ts
 * import { ASTEROIDS_FETCHED } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log("elements read from JPL on", ASTEROIDS_FETCHED);
 * ```
 */
export const ASTEROIDS_FETCHED: string = ASTEROID_FETCHED;

/**
 * Every body in the set, as `ASTEROIDS`.
 *
 * @returns The records, which must not be changed.
 *
 * @example
 * ```ts
 * import { asteroidList } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log(asteroidList().map((a) => a.name.en).slice(0, 5).join(", "));
 * ```
 */
export function asteroidList(): readonly AsteroidRecord[] {
  return ASTEROIDS;
}

/**
 * The bodies of one kind, and for the near-Earth asteroids, optionally of one group.
 *
 * @param kind - The kind.
 * @param group - A near-Earth group (`Atira`, `Aten`, `Apollo` or `Amor`), to narrow `near-earth`.
 * @returns The records, in table order.
 *
 * @example
 * ```ts
 * import { asteroidsOfKind } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log(asteroidsOfKind("trojan").map((a) => a.name.en).join(", "));
 * ```
 */
export function asteroidsOfKind(kind: AsteroidKind, group?: AsteroidGroup): readonly AsteroidRecord[] {
  return ASTEROIDS.filter((a) => a.kind === kind && (group === undefined || a.group === group));
}

/** A name with its accents, backticks, case and spaces taken out, so "Kamo`oalewa", "kamo‘oalewa" and "KAMOOALEWA" are one. */
function plain(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[`'‘’ʻ\s-]/g, "")
    .toLowerCase();
}

/**
 * Finds a body by its id, minor-planet number, designation or name (English or Japanese, ignoring case, accents and spaces). Nothing matches a string that is not one of them.
 *
 * @param query - "eros", "433", 433, "A898 PA", "2024 YR4", "Šteins" or "エロス".
 * @returns The record, or `undefined`.
 *
 * @example
 * ```ts
 * import { findAsteroid } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log(findAsteroid(99942)?.name.en, findAsteroid("2024 yr4")?.id, findAsteroid("nothing"));
 * ```
 */
export function findAsteroid(query: string | number): AsteroidRecord | undefined {
  if (typeof query === "number") return ASTEROIDS.find((a) => a.number === query);
  const key = plain(query);
  if (key === "") return undefined;
  return ASTEROIDS.find((a) => plain(a.id) === key || plain(a.name.en) === key || a.name.ja === query.trim() || plain(a.designation) === key || (a.number !== undefined && String(a.number) === key));
}

/**
 * What the functions take for a body: its id, number, designation or name, or a record (one of `ASTEROIDS`, or one made with `asteroidFromElements`).
 *
 * @example
 * ```ts
 * import { asteroidPositionAu, findAsteroid, type AsteroidRef } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const refs: AsteroidRef[] = ["Eros", 433, findAsteroid("Eros")!];
 * console.log(refs.map((r) => asteroidPositionAu(r, Date.UTC(2026, 10, 11))[0]!.toFixed(3)).join(" "));
 * ```
 */
export type AsteroidRef = string | number | Pick<AsteroidRecord, "elements"> & Partial<AsteroidRecord>;

function resolve(body: AsteroidRef): Pick<AsteroidRecord, "elements"> & Partial<AsteroidRecord> {
  if (typeof body === "string" || typeof body === "number") {
    const found = findAsteroid(body);
    if (found === undefined) throw new RangeError(`unknown asteroid ${JSON.stringify(body)}; look one up with findAsteroid, or hand in a record made with asteroidFromElements`);
    return found;
  }
  if (typeof body !== "object" || body === null || typeof body.elements?.a !== "number") throw new TypeError("an asteroid must be an id, a number or a record with elements");
  return body;
}

/** The body's position in au at a Julian date (TDB taken as terrestrial time), by Kepler's equation. */
function atJd(el: AsteroidElements, jd: number): Vec3 {
  const mean = (el.ma + el.n * (jd - el.epochJd)) * RAD;
  const E = kepler(mean, el.e);
  const x = el.a * (Math.cos(E) - el.e);
  const y = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const [cw, sw] = [Math.cos(el.peri * RAD), Math.sin(el.peri * RAD)];
  const [co, so] = [Math.cos(el.node * RAD), Math.sin(el.node * RAD)];
  const [ci, si] = [Math.cos(el.i * RAD), Math.sin(el.i * RAD)];
  const px = cw * x - sw * y;
  const py = sw * x + cw * y;
  return [co * px - so * ci * py, so * px + co * ci * py, si * py];
}

const jdOf = (ms: number): number => toTerrestrialTime(ms) / DAY_MS + UNIX_JD;

/**
 * Where a body is at a moment, in astronomical units from the Sun, in the J2000 ecliptic frame (the axes and unit of `heliocentric`), from its elements by Kepler's equation. The motion is two-body: no planet pulls on it, so the
 * answer drifts from the real position the further the date is from the elements' epoch (see `ASTEROID_ACCURACY`).
 *
 * @param body - A body: its id, number, designation or name, or a record.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns x, y, z in astronomical units.
 *
 * @example
 * ```ts
 * import { asteroidPositionAu } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const [x, y, z] = asteroidPositionAu("Eros", new Date("2026-11-11T00:00:00Z"));
 * console.log(Math.hypot(x, y, z).toFixed(3), "au from the Sun");
 * ```
 */
export function asteroidPositionAu(body: AsteroidRef, when: When): Vec3 {
  return atJd(resolve(body).elements, jdOf(moment(when)));
}

/**
 * The same position in kilometres, the unit `spacecraftPosition` and `roadsterPosition` use.
 *
 * @param body - A body: its id, number, designation or name, or a record.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns x, y, z in kilometres.
 *
 * @example
 * ```ts
 * import { asteroidPosition } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log(asteroidPosition(433, Date.UTC(2026, 10, 11)).map((km) => Math.round(km / 1e6)), "million km");
 * ```
 */
export function asteroidPosition(body: AsteroidRef, when: When): Vec3 {
  const [x, y, z] = asteroidPositionAu(body, when);
  return [x * AU_KM, y * AU_KM, z * AU_KM];
}

/**
 * How far a body is from the Sun and from the Earth at a moment. The Earth is the package's own (`heliocentric`), and no distance allows for the light's travel.
 *
 * @example
 * ```ts
 * import { asteroidDistances, type AsteroidDistances } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const d: AsteroidDistances = asteroidDistances("Apophis", Date.UTC(2029, 3, 13, 21, 46));
 * console.log(Math.round(d.earthKm), "km from the Earth");
 * ```
 */
export interface AsteroidDistances {
  /** The distance from the Sun in astronomical units. */
  sunAu: number;
  /** The distance from the Earth's centre in astronomical units. */
  earthAu: number;
  /** The distance from the Earth's centre in kilometres. */
  earthKm: number;
  /** The same in lunar distances (384,400 km). */
  earthLunar: number;
  /** The one-way light time from the Earth, in minutes. */
  lightMinutes: number;
}

/**
 * The distances of a body from the Sun and the Earth at a moment.
 *
 * @param body - A body: its id, number, designation or name, or a record.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The distances.
 *
 * @example
 * ```ts
 * import { asteroidDistances } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const d = asteroidDistances("Bennu", Date.UTC(2026, 10, 11));
 * console.log(d.sunAu.toFixed(2), "au from the Sun,", d.earthAu.toFixed(2), "from the Earth,", d.lightMinutes.toFixed(1), "light minutes");
 * ```
 */
export function asteroidDistances(body: AsteroidRef, when: When): AsteroidDistances {
  const ms = moment(when);
  const au = asteroidPositionAu(body, ms);
  const earthAu = length(sub(au, heliocentric("earth", ms)));
  const earthKm = earthAu * AU_KM;
  return { sunAu: length(au), earthAu, earthKm, earthLunar: earthKm / 384_400, lightMinutes: earthKm / LIGHT_KM_PER_SECOND / 60 };
}

/**
 * Points round a body's whole orbit, to draw its line: the ellipse of its elements, at equal steps of the eccentric anomaly (so the bends of a long orbit get more points), in astronomical units, in the J2000 ecliptic frame.
 * The first point is repeated at the end so the line closes.
 *
 * @param body - A body: its id, number, designation or name, or a record.
 * @param count - How many segments (at least 8; 180 by default).
 * @returns `count + 1` points.
 *
 * @example
 * ```ts
 * import { asteroidOrbitPoints } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const line = asteroidOrbitPoints("Eros", 90);
 * console.log(line.length, "points");
 * ```
 */
export function asteroidOrbitPoints(body: AsteroidRef, count = 180): Vec3[] {
  const el = resolve(body).elements;
  const steps = Math.max(8, Math.floor(count));
  const [cw, sw] = [Math.cos(el.peri * RAD), Math.sin(el.peri * RAD)];
  const [co, so] = [Math.cos(el.node * RAD), Math.sin(el.node * RAD)];
  const [ci, si] = [Math.cos(el.i * RAD), Math.sin(el.i * RAD)];
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  const out: Vec3[] = [];
  for (let k = 0; k <= steps; k += 1) {
    const E = (2 * Math.PI * (k % steps)) / steps;
    const x = el.a * (Math.cos(E) - el.e);
    const y = b * Math.sin(E);
    const px = cw * x - sw * y;
    const py = sw * x + cw * y;
    out.push([co * px - so * ci * py, so * px + co * ci * py, si * py]);
  }
  return out;
}

/**
 * A body's period round the Sun, in days, from its mean motion.
 *
 * @param body - A body: its id, number, designation or name, or a record.
 * @returns The period in days.
 *
 * @example
 * ```ts
 * import { asteroidPeriodDays } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log((asteroidPeriodDays("Eros") / 365.25).toFixed(2), "years");
 * ```
 */
export function asteroidPeriodDays(body: AsteroidRef): number {
  return 360 / resolve(body).elements.n;
}

/**
 * The record of a body that is not in the set, made from its elements (the door for a body of your own): its kind and near-Earth group are worked out from the orbit by JPL's own rules for the classes (an asteroid is
 * `near-earth` when its perihelion is under 1.3 au, `main-belt` under 4.6 au, a `trojan` at 4.6 to 5.5 au with an eccentricity under 0.3, a `centaur` to 30.1 au and `trans-neptunian` beyond). Every function of this entry point takes the record.
 *
 * @param name - The name, or the designation.
 * @param elements - The orbit: `epochJd`, `a`, `e` (under 1), `i`, `node`, `peri`, `ma` and `n` (the mean motion in degrees a day; worked out from `a` when left out), with `q` worked out from `a` and `e`.
 * @returns The record, with `source` set to "elements given by the caller".
 *
 * @example
 * ```ts
 * import { asteroidFromElements, asteroidPositionAu } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const mine = asteroidFromElements("2026 XX", { epochJd: 2461200.5, a: 1.8, e: 0.4, i: 12, node: 80, peri: 120, ma: 10 });
 * console.log(mine.kind, mine.group, asteroidPositionAu(mine, Date.UTC(2026, 10, 11)).map((au) => au.toFixed(2)));
 * ```
 */
export function asteroidFromElements(name: string, elements: Omit<AsteroidElements, "n" | "q"> & Partial<Pick<AsteroidElements, "n" | "q">>): AsteroidRecord {
  const { a, e } = elements;
  if (!(a > 0) || !Number.isFinite(a) || !(e >= 0 && e < 1)) throw new RangeError("the orbit must be an ellipse: a above 0 and e from 0 to just under 1");
  for (const key of ["epochJd", "i", "node", "peri", "ma"] as const) if (!Number.isFinite(elements[key])) throw new RangeError(`the element ${key} must be a finite number`);
  const q = elements.q ?? a * (1 - e);
  const apo = a * (1 + e);
  const n = elements.n ?? 360 / (Math.sqrt(a * a * a) * 365.256_363);
  let kind: AsteroidKind;
  let group: AsteroidGroup | undefined;
  if (q < 1.3) {
    kind = "near-earth";
    group = apo < 0.983 ? "Atira" : a < 1 ? "Aten" : q < 1.017 ? "Apollo" : "Amor";
  } else if (a < 4.6) kind = "main-belt";
  else if (a < 5.5 && e < 0.3) kind = "trojan";
  else if (a < 30.1) kind = "centaur";
  else kind = "trans-neptunian";
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    designation: name,
    name: { en: name, ja: name },
    kind,
    ...(group === undefined ? {} : { group }),
    orbitClass: "",
    hazardous: false,
    spkid: 0,
    elements: { ...elements, n, q },
    missions: [],
    source: "elements given by the caller",
  };
}

/**
 * A body as the data door's small-body record, to draw it with the other points of `<wakusei-space>` (`readSmallBodies` and `smallBodyAt` of `/door` take it): the same orbit, in the door's field names.
 *
 * @param body - A body: its id, number, designation or name, or a record.
 * @returns A `SmallBody` (without `H` where the source has none, 99 stands for "unknown").
 *
 * @example
 * ```ts
 * import { smallBodyAt } from "@johnmorrisdotca/wakusei-planets/door";
 * import { asteroidAsSmallBody, asteroidPositionAu } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * const eros = asteroidAsSmallBody("Eros");
 * const jd = 2461200.5;
 * console.log(smallBodyAt(eros, jd).map((au) => au.toFixed(3)), asteroidPositionAu("Eros", (jd - 2440587.5) * 86400000).map((au) => au.toFixed(3)));
 * ```
 */
export function asteroidAsSmallBody(body: AsteroidRef): SmallBody {
  const record = resolve(body);
  const el = record.elements;
  return { name: record.name?.en ?? record.designation ?? "asteroid", a: el.a, e: el.e, i: el.i, node: el.node, peri: el.peri, M0: el.ma, epoch: el.epochJd, H: record.H ?? 99 };
}

/**
 * How far to trust `asteroidPosition`, stated: the elements are osculating at one epoch each and the motion is two-body, so the error grows with the time from the epoch and with the planets' pull. The worst distances, in
 * astronomical units, between the two-body position and JPL Horizons' own (which includes the planets) at the epoch, half a year and a year either side of it, measured on the bodies of `test/data/asteroids-horizons.json`.
 *
 * @example
 * ```ts
 * import { ASTEROID_ACCURACY } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log(`within ${ASTEROID_ACCURACY.yearAu} au of Horizons a year from the epoch`);
 * ```
 */
export const ASTEROID_ACCURACY = {
  /** The worst distance at the epoch itself, in astronomical units (the elements are exact there; this is rounding). */
  epochAu: 1e-7,
  /** The worst distance within half a year of the epoch, over the 16 bodies measured, in astronomical units (about 150,000 km). */
  halfYearAu: 0.001,
  /** The worst distance within a year of the epoch, over the same bodies, in astronomical units (about 600,000 km): the main-belt asteroids are the worst, the others stay under a quarter of it. */
  yearAu: 0.004,
  /** In words, what the numbers leave out. */
  note: "Two-body motion: the planets' pull is not included, so a body that passes close to the Earth or Jupiter, and every body far from its epoch, drifts further. Positions of near-Earth asteroids a year or more from the epoch are a guide, not an ephemeris.",
} as const;

/**
 * The bodies as a record source of the data door, the way the view draws them as points beside the belts: every body of the set as a `SmallBody`, in the order of `asteroidList()`. `<wakusei-space>` adds it for
 * its attribute `asteroids`; a page can hand it to a view's `sources` too.
 *
 * @returns The source.
 *
 * @example
 * ```ts
 * import { asteroidsSource } from "@johnmorrisdotca/wakusei-planets/asteroids";
 *
 * console.log(asteroidsSource().info.id, asteroidsSource().info.licence.name);
 * ```
 */
export function asteroidsSource(): SmallBodySource {
  return madeHere({
    kind: "records" as const,
    info: {
      id: "wakusei-asteroids",
      name: { en: "Named asteroids and comets of the Small-Body Database", ja: "小天体データベースの名のある小惑星" },
      credit: { en: "Asteroid orbits: NASA/JPL Small-Body Database", ja: "小惑星の軌道：NASA/JPL 小天体データベース" },
      licence: { name: "Public domain (NASA/JPL: not subject to copyright in the United States)", url: "https://www.nasa.gov/nasa-brand-center/images-and-media/" },
      url: "https://ssd-api.jpl.nasa.gov/doc/sbdb.html",
      retrieved: ASTEROID_FETCHED,
    },
    records: (): Promise<SmallBody[]> => Promise.resolve(ASTEROIDS.map((body) => asteroidAsSmallBody(body))),
  });
}
