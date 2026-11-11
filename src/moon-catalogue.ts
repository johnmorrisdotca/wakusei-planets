// Every known moon of the planets and the dwarf planets, as a light list: names and designations, who found each and when, the mean orbit, the size where it is known, and where each is on a date from that orbit,
// with how far that position was measured to be from JPL Horizons. The rows (scripts/make-moon-catalogue.py, src/data/moon-catalogue.ts) are imported by this entry point only, so a page that does not import
// `/moon-catalogue` does not carry them. Positions are from the planet's centre, in kilometres, in the J2000 ecliptic frame (the axes `moonVector` gives). Pure: no DOM, no clock reads, no three.js.
import { MOON_CATALOGUE_READ, MOON_CATALOGUE_ROWS, type MoonRow } from "./data/moon-catalogue.ts";
import { toTerrestrialTime } from "./clock.ts";
import { kepler } from "./ephemeris.ts";
import type { HostId } from "./facts.ts";
import { cross, fromRaDec, RAD, toEcliptic, type Vec3 } from "./vec.ts";
import { moment, type When } from "./when.ts";

export type { HostId } from "./facts.ts";
export type { When } from "./when.ts";

const DAY_MS = 86_400_000;
const UNIX_JD = 2_440_587.5;
const YEAR_DAYS = 365.25;

/**
 * The dynamical group of a moon, by this package's rule on the mean orbit. A regular moon (close in, near its planet's equator) is `major` (150 km of radius or more: the Moon, the Galilean moons, Titan, Triton, Charon and
 * the like), `inner` (a smaller one inside its planet's innermost major moon, near the rings) or `regular` (the others: Phobos, Deimos, Hyperion, Pluto's small moons). An irregular moon (one whose mean orbit JPL gives about
 * the ecliptic, because the Sun's pull steers it, or one over 100 planet radii out) is in one of Jupiter's groups `themisto`, `himalia`, `carpo`, `valetudo`, `ananke`, `carme` and `pasiphae`, Saturn's `inuit`, `gallic` and
 * `norse`, or, for Uranus and Neptune, `prograde` or `retrograde`. `none` is a moon with no mean orbit in the source. The guide "Every known moon" gives the numbers of the rule.
 *
 * @example
 * ```ts
 * import { MOON_GROUPS, type MoonGroup } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const group: MoonGroup = "carme";
 * console.log(MOON_GROUPS.includes(group));
 * ```
 */
export type MoonGroup = "inner" | "major" | "regular" | "themisto" | "himalia" | "carpo" | "valetudo" | "ananke" | "carme" | "pasiphae" | "inuit" | "gallic" | "norse" | "prograde" | "retrograde" | "none";

/**
 * Every group, in the order the guide lists them.
 *
 * @example
 * ```ts
 * import { MOON_GROUPS } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log(MOON_GROUPS.join(", "));
 * ```
 */
export const MOON_GROUPS: readonly MoonGroup[] = ["inner", "major", "regular", "themisto", "himalia", "carpo", "valetudo", "ananke", "carme", "pasiphae", "inuit", "gallic", "norse", "prograde", "retrograde", "none"];

/**
 * How well the catalogue places a moon, by the worst angle (seen from the planet's centre) between `catalogueMoonPosition` and JPL Horizons on 2025-07-02, 2026-07-02 and 2027-07-02, dates the orbit was not set from:
 * `close` under 1 degree, `rough` under 10 degrees, `loose` 10 degrees or more (the moon is on the right orbit but not at the right place on it), `unmeasured` when Horizons has no position to measure against, and `none`
 * when there is no orbit. Every grade is below the package's own 29 moons (`full`), which the main entry point places within arc-seconds to minutes (see the accuracy guide).
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, type MoonGrade } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const grade: MoonGrade = findCatalogueMoon("Himalia")!.grade;
 * console.log(grade);
 * ```
 */
export type MoonGrade = "close" | "rough" | "loose" | "unmeasured" | "none";

/**
 * A moon's mean orbit: JPL's "Planetary Satellite Mean Elements" (the ellipse, how fast its periapsis and node turn, and the plane it is measured from), carried at those rates to 2026-01-01 and with the mean anomaly set
 * so the moon is where JPL Horizons puts it that day, and its rate along the orbit fitted to where Horizons puts it over the next three months. The shape, the plane and the turning of the periapsis and node are JPL's; the
 * place along the orbit and the rate are from Horizons. Kilometres and degrees; the epoch is a Julian date (TDB).
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, type MoonOrbit } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const orbit: MoonOrbit = findCatalogueMoon("Carme")!.orbit!;
 * console.log(orbit.frame, Math.round(orbit.a), "km,", orbit.periodDays.toFixed(1), "days");
 * ```
 */
export interface MoonOrbit {
  /** The plane the angles are measured from: `ecliptic` (J2000), `equatorial` (the planet's equator) or `laplace` (the plane round which the orbit's pole turns, with its pole in `pole`). */
  frame: "ecliptic" | "equatorial" | "laplace";
  /** The pole of the plane, right ascension and declination in degrees (ICRF): the Laplace plane's as the source gives it, or the planet's pole (the one its moons go round, for Uranus the IAU's south pole) for `equatorial`. Not for `ecliptic`. */
  pole?: readonly [number, number];
  /** The epoch, a Julian date (TDB): 2461041.5 (2026-01-01) for every orbit set from Horizons. */
  epochJd: number;
  /** Semi-major axis, km. */
  a: number;
  /** Eccentricity. */
  e: number;
  /** Argument of periapsis, degrees. */
  w: number;
  /** Mean anomaly at the epoch, degrees (set from JPL Horizons). */
  m: number;
  /** Inclination to the plane, degrees; over 90 is a retrograde orbit. */
  i: number;
  /** Longitude of the ascending node, degrees, from where the plane crosses the ICRF equator (from the equinox for the ecliptic). */
  node: number;
  /** The sidereal period, days: the rate along the orbit as fitted to where JPL Horizons puts the moon on 2026-01-01, -02, 02-01 and 04-01, which this package uses in place of the period JPL's mean elements print. */
  periodDays: number;
  /** How many years the periapsis takes to turn once round, where the source gives it. */
  apsisYears: number | null;
  /** How many years the node takes to turn once round, where the source gives it. */
  nodeYears: number | null;
  /** The JPL satellite ephemeris the mean elements were taken from ("JUP347", "SAT459"). */
  ephemeris: string;
}

/**
 * Who found a moon, when, and where it was announced, as JPL's "Planetary Satellite Discovery Circumstances" lists it (the moons of the dwarf planets besides Pluto: the year and the reference of JPL's Small-Body Satellites
 * service, which names no discoverers). `null` where the source gives nothing (the Moon has no discovery).
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, type MoonDiscovery } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const found: MoonDiscovery = findCatalogueMoon("Io")!.discovery;
 * console.log(found.year, found.by);
 * ```
 */
export interface MoonDiscovery {
  /** The year it was found. */
  year: number | null;
  /** The discoverers, or the spacecraft team, as the source writes them. */
  by: string | null;
  /** Where it was announced: an IAU Circular ("IAUC 8116"), a Minor Planet Electronic Circular ("MPEC 2023-A14"), a CBET, a paper, or "IAU WGPSN" for the long-named moons. */
  reference: string | null;
}

/**
 * Where a moon's size comes from: `measured` (JPL's "Planetary Satellite Physical Parameters", with its uncertainty), `sheet` (the radius on the moon's JPL Horizons data sheet) or `derived` (worked out here from the
 * moon's V(1,0) magnitude and an albedo: the sheet's albedo where it gives one, else `ASSUMED_ALBEDO`, by D = 10^(3.1236 - 0.5 log10(albedo) - 0.2 V), the formula of NASA/JPL's asteroid size estimator).
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, type MoonSizeSource } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const from: MoonSizeSource | null = findCatalogueMoon("Callirrhoe")!.radiusFrom;
 * console.log(from);
 * ```
 */
export type MoonSizeSource = "measured" | "sheet" | "derived";

/**
 * One moon of the catalogue. A number the sources do not give is `null`, never guessed.
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, type CatalogueMoon } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const moon: CatalogueMoon = findCatalogueMoon("S/2003 J 18")!;
 * console.log(moon.label, moon.host, moon.group, moon.retrograde, moon.discovery.year);
 * ```
 */
export interface CatalogueMoon {
  /** A stable id: the name in lower case ("himalia"), or the designation ("s-2003-j-18"). The package's own moons keep their ids ("hiiaka"). */
  id: string;
  /** The IAU name, or `null` for a moon with only a designation. */
  name: string | null;
  /** The Japanese name, only for the moons the package draws in full (checked katakana); `null` for the others. */
  ja: string | null;
  /** The provisional designation, "S/2003 J 18", where it has one. */
  designation: string | null;
  /** What to print: the name, else the designation. */
  label: string;
  /** The IAU number in Roman numerals ("XIX"), where it has one. */
  number: string | null;
  /** The planet or dwarf planet it goes round. */
  host: HostId;
  /** The JPL (NAIF) id, as Horizons knows it (501 for Io), or `null` for a moon Horizons does not have. */
  code: number | null;
  /** Whether it has an IAU name. */
  named: boolean;
  /** `false` only for a moon its source marks as not confirmed. */
  confirmed: boolean;
  /** Who found it and when. */
  discovery: MoonDiscovery;
  /** The mean orbit, or `null` when the source gives none. */
  orbit: MoonOrbit | null;
  /** Whether it goes round against its planet's turn (an inclination over 90 degrees), or `null` with no orbit. */
  retrograde: boolean | null;
  /** The dynamical group. */
  group: MoonGroup;
  /** The mean radius in kilometres, or `null` when nothing gives it. */
  radiusKm: number | null;
  /** The radius's one-sigma uncertainty, km, when `measured`. */
  radiusSigmaKm: number | null;
  /** Where the radius comes from. */
  radiusFrom: MoonSizeSource | null;
  /** The geometric albedo, where the Horizons sheet gives one. */
  albedo: number | null;
  /** The V(1,0) magnitude (as bright as it would be 1 au from the Sun and from us), where the Horizons sheet gives one. */
  magnitude: number | null;
  /**
   * How far `catalogueMoonPosition` was from JPL Horizons: the worst distance (km) and angle seen from the planet (degrees) on 2025-07-02, 2026-07-02 and 2027-07-02 (dates the orbit was not set from), and the worst angle
   * decades away (1990, 2000 and 2040; `null` where Horizons has none of them). `null` when not measured.
   */
  accuracy: { worstKm: number; worstDegrees: number; farDegrees: number | null } | null;
  /** The grade of `accuracy`. */
  grade: MoonGrade;
  /** Whether the package draws it in full (a look, a size, its own fitted orbit or theory): then the main entry point's `moonVector` and `system` place it far better. */
  full: boolean;
}

/**
 * The albedo a `derived` size takes when the Horizons sheet gives none: 0.04, the albedo the sheet gives for Himalia, the largest of the irregular moons. The few other irregular moons with an albedo on their sheets have 0.03
 * (Elara) to 0.081 (Phoebe), and Nereid 0.2; a darker moon is larger than the estimate and a brighter one smaller, so a derived radius is a guide to the size, not a measurement.
 *
 * @example
 * ```ts
 * import { ASSUMED_ALBEDO } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log(ASSUMED_ALBEDO);
 * ```
 */
export const ASSUMED_ALBEDO = 0.04;

const FRAMES = ["ecliptic", "equatorial", "laplace"] as const;
const SIZE_FROM = ["measured", "sheet"] as const;

function moonOf(row: MoonRow): CatalogueMoon {
  const [id, name, designation, number, host, code, year, by, reference, o, radius, sigma, from, albedo, magnitude, worstKm, worstDegrees, farDegrees, group, ja, confirmed] = row;
  const orbit: MoonOrbit | null =
    o === null
      ? null
      : {
          frame: FRAMES[o[0]]!,
          ...(o[12] === undefined ? {} : { pole: [o[12], o[13]!] as const }),
          epochJd: o[1],
          a: o[2],
          e: o[3],
          w: o[4],
          m: o[5],
          i: o[6],
          node: o[7],
          periodDays: o[8],
          apsisYears: o[9],
          nodeYears: o[10],
          ephemeris: o[11],
        };
  let radiusKm = radius;
  let radiusFrom: MoonSizeSource | null = from === null ? null : SIZE_FROM[from]!;
  if (radiusKm === null && magnitude !== null) {
    radiusKm = Math.round(10 ** (3.1236 - 0.5 * Math.log10(albedo ?? ASSUMED_ALBEDO) - 0.2 * magnitude) * 5) / 10;
    radiusFrom = "derived";
  }
  const grade: MoonGrade = orbit === null ? "none" : worstDegrees === null ? "unmeasured" : worstDegrees < 1 ? "close" : worstDegrees < 10 ? "rough" : "loose";
  return {
    id,
    name,
    ja,
    designation,
    label: name ?? designation ?? id,
    number,
    host,
    code,
    named: name !== null,
    confirmed: confirmed !== 0,
    discovery: { year, by, reference },
    orbit,
    retrograde: orbit === null ? null : orbit.i > 90,
    group,
    radiusKm,
    radiusSigmaKm: sigma,
    radiusFrom,
    albedo,
    magnitude,
    accuracy: worstKm === null || worstDegrees === null ? null : { worstKm, worstDegrees, farDegrees },
    grade,
    full: ja !== null,
  };
}

/**
 * Every known moon of the planets and the dwarf planets, as JPL lists them on `MOON_CATALOGUE_FETCHED`, in the order of the planets and, within a planet, of JPL's list (the long-known moons first, then by discovery).
 *
 * @example
 * ```ts
 * import { MOON_CATALOGUE } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log(MOON_CATALOGUE.length, "moons;", MOON_CATALOGUE.filter((m) => m.named).length, "with a name");
 * ```
 */
export const MOON_CATALOGUE: readonly CatalogueMoon[] = MOON_CATALOGUE_ROWS.map(moonOf);

/**
 * The day the catalogue was read from JPL. New moons are announced every year; `scripts/make-moon-catalogue.py --refresh` reads the sources again and prints what changed.
 *
 * @example
 * ```ts
 * import { MOON_CATALOGUE_FETCHED } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log("moons as of", MOON_CATALOGUE_FETCHED);
 * ```
 */
export const MOON_CATALOGUE_FETCHED: string = MOON_CATALOGUE_READ;

/**
 * How many moons a planet or dwarf planet has in the catalogue, and how many of those have a name.
 *
 * @example
 * ```ts
 * import { moonCounts, type MoonCount } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const saturn: MoonCount = moonCounts().saturn!;
 * console.log(saturn.total, "moons of Saturn,", saturn.named, "named");
 * ```
 */
export interface MoonCount {
  /** Every moon. */
  total: number;
  /** The moons with an IAU name. */
  named: number;
  /** The moons with a mean orbit, which `catalogueMoonPosition` can place. */
  placed: number;
}

/**
 * The counts for every planet and dwarf planet that has a moon in the catalogue.
 *
 * @returns A count for each host, in the catalogue's order.
 *
 * @example
 * ```ts
 * import { moonCounts } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * for (const [host, count] of Object.entries(moonCounts())) console.log(host, count.total);
 * ```
 */
export function moonCounts(): Partial<Record<HostId, MoonCount>> {
  const out: Partial<Record<HostId, MoonCount>> = {};
  for (const moon of MOON_CATALOGUE) {
    const count = (out[moon.host] ??= { total: 0, named: 0, placed: 0 });
    count.total += 1;
    if (moon.named) count.named += 1;
    if (moon.orbit !== null) count.placed += 1;
  }
  return out;
}

/**
 * The moons of one planet or dwarf planet, nearest first (by the mean orbit's semi-major axis; a moon with no orbit last), optionally of one group.
 *
 * @param host - The planet or dwarf planet: "jupiter", "eris".
 * @param group - A group, to narrow the list.
 * @returns The moons, which must not be changed.
 *
 * @example
 * ```ts
 * import { catalogueMoonsOf } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log(catalogueMoonsOf("jupiter", "himalia").map((m) => m.label).join(", "));
 * ```
 */
export function catalogueMoonsOf(host: HostId, group?: MoonGroup): readonly CatalogueMoon[] {
  return MOON_CATALOGUE.filter((m) => m.host === host && (group === undefined || m.group === group)).sort((a, b) => (a.orbit?.a ?? Infinity) - (b.orbit?.a ?? Infinity));
}

const plain = (text: string): string => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]/g, "");

/**
 * Finds a moon by its id, name (English, or Japanese for the package's own moons), designation (spaces and slashes do not matter: "S/2003 J 18", "s2003j18") or JPL code (501). Ignores case and accents.
 *
 * @param query - The id, name, designation or code.
 * @returns The moon, or `undefined`.
 *
 * @example
 * ```ts
 * import { findCatalogueMoon } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log(findCatalogueMoon("io")?.code, findCatalogueMoon(506)?.label, findCatalogueMoon("s2003j18")?.host, findCatalogueMoon("nothing"));
 * ```
 */
export function findCatalogueMoon(query: string | number): CatalogueMoon | undefined {
  if (typeof query === "number") return MOON_CATALOGUE.find((m) => m.code === query);
  const q = plain(query);
  if (q === "") return undefined;
  return MOON_CATALOGUE.find((m) => [m.id, m.name, m.ja, m.designation, m.code === null ? null : String(m.code)].some((v) => v !== null && plain(v) === q));
}

const basisCache = new Map<string, readonly [Vec3, Vec3, Vec3]>();

function basisOf(pole: readonly [number, number] | null): readonly [Vec3, Vec3, Vec3] {
  if (pole === null) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const key = pole.join();
  let basis = basisCache.get(key);
  if (basis === undefined) {
    const z = fromRaDec(pole[0], pole[1]);
    const x = fromRaDec(pole[0] + 90, 0);
    basis = [toEcliptic(x), toEcliptic(cross(z, x)), toEcliptic(z)];
    basisCache.set(key, basis);
  }
  return basis;
}

/**
 * The rates a mean orbit turns at, degrees a day: the mean anomaly's from the sidereal period (the mean longitude goes once round in it, so the mean anomaly runs slower by the turning of the other two); the periapsis turning forwards where 5 cos²i - 1 is positive and backwards where it is negative, and the node backwards on a prograde orbit
 * and forwards on a retrograde one, as a planet's flattening and the Sun's pull turn them; each at the speed of the period the source gives (none where it gives none).
 */
function ratesOf(orbit: MoonOrbit): [number, number, number] {
  const ci = Math.cos(orbit.i * RAD);
  const dw = orbit.apsisYears ? (Math.sign(5 * ci * ci - 1) * 360) / (orbit.apsisYears * YEAR_DAYS) : 0;
  const dn = orbit.nodeYears ? (-Math.sign(ci) * 360) / (orbit.nodeYears * YEAR_DAYS) : 0;
  return [360 / orbit.periodDays - dw - dn, dw, dn];
}

/**
 * Where a moon is at a moment, from its planet's centre, in kilometres, in the J2000 ecliptic frame (the axes of `moonVector`): its mean orbit, turned for the precession of its periapsis and node, solved by Kepler's
 * equation. How close that is to the moon's real place near 2026 is the moon's `accuracy` and `grade`; decades away it drifts much further (`accuracy.farDegrees`). A moon the package draws in full is placed far better
 * by the main entry point's `moonVector`.
 *
 * @param moon - A moon of the catalogue, or its id, name, designation or code.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns x, y, z in kilometres, or `undefined` for a moon with no orbit.
 *
 * @example
 * ```ts
 * import { catalogueMoonPosition } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const [x, y, z] = catalogueMoonPosition("Himalia", new Date("2026-11-11T00:00:00Z"))!;
 * console.log(Math.round(Math.hypot(x, y, z) / 1e6), "million km from Jupiter");
 * ```
 */
export function catalogueMoonPosition(moon: CatalogueMoon | string | number, when: When): Vec3 | undefined {
  const m = typeof moon === "object" ? moon : findCatalogueMoon(moon);
  if (m === undefined) throw new RangeError(`unknown moon ${JSON.stringify(moon)}; look one up with findCatalogueMoon`);
  const orbit = m.orbit;
  if (orbit === null) return undefined;
  const [n, dw, dn] = ratesOf(orbit);
  const dt = toTerrestrialTime(moment(when)) / DAY_MS + UNIX_JD - orbit.epochJd;
  const w = (orbit.w + dw * dt) * RAD;
  const node = (orbit.node + dn * dt) * RAD;
  const E = kepler((orbit.m + n * dt) * RAD, orbit.e);
  const x = orbit.a * (Math.cos(E) - orbit.e);
  const y = orbit.a * Math.sqrt(1 - orbit.e * orbit.e) * Math.sin(E);
  const [cw, sw, cn, sn, ci, si] = [Math.cos(w), Math.sin(w), Math.cos(node), Math.sin(node), Math.cos(orbit.i * RAD), Math.sin(orbit.i * RAD)];
  const px = (cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y;
  const py = (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y;
  const pz = sw * si * x + cw * si * y;
  const [bx, by, bz] = basisOf(orbit.frame === "ecliptic" ? null : (orbit.pole ?? null));
  return [px * bx[0] + py * by[0] + pz * bz[0], px * bx[1] + py * by[1] + pz * bz[1], px * bx[2] + py * by[2] + pz * bz[2]];
}
