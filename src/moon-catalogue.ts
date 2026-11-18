// Every known moon of the planets and the dwarf planets, as a light list: names and designations, who found each and when, the mean orbit, the size where it is known, and where each is on a date from that orbit,
// with how far that position was measured to be from JPL Horizons. The rows (scripts/make-moon-catalogue.py, src/data/moon-catalogue.ts) are imported by this entry point only, so a page that does not import
// `/moon-catalogue` does not carry them. Positions are from the planet's centre, in kilometres, in the J2000 ecliptic frame (the axes `moonVector` gives). Pure: no DOM, no clock reads, no three.js.
import { MOON_CATALOGUE_READ, MOON_CATALOGUE_ROWS, type MoonRow } from "./data/moon-catalogue.ts";
import { MOON_OSCULATING, MOON_OSCULATING_EPOCH_JD as OSCULATING_EPOCH_JD } from "./data/moon-osculating.ts";
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
 * The osculating orbit of an irregular moon on one day: the two-body orbit that fits its place and speed that day (JPL Horizons), in the J2000 ecliptic frame, as `a` (km), `e`, `i`, `node`, `w` (the argument of periapsis)
 * and `m` (the mean anomaly), all angles in degrees, at `epochJd` (a Julian date, TDB). A mean orbit cannot follow the Sun's pull on an irregular moon; this one does, for a few months either side of the day
 * (`MOON_OSCULATING_DAYS`), and `catalogueMoonPosition` uses it there.
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, type MoonOsculating } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const orbit: MoonOsculating | null = findCatalogueMoon("Himalia")!.osculating;
 * console.log(orbit?.epochJd, Math.round(orbit?.a ?? 0), "km");
 * ```
 */
export interface MoonOsculating {
  epochJd: number;
  a: number;
  e: number;
  i: number;
  node: number;
  w: number;
  m: number;
}

/**
 * The Julian date (TDB) of the day the osculating orbits are taken at (2026-12-01).
 *
 * @example
 * ```ts
 * import { MOON_OSCULATING_EPOCH_JD } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log("osculating orbits taken at JD", MOON_OSCULATING_EPOCH_JD);
 * ```
 */
export const MOON_OSCULATING_EPOCH_JD = OSCULATING_EPOCH_JD;

/**
 * The days either side of `MOON_OSCULATING_EPOCH_JD` inside which `catalogueMoonPosition` uses a moon's osculating orbit, and outside which it uses the mean orbit. Measured against Horizons on dates the orbit was not set
 * from, the osculating orbit is within a degree of the moon for 95 moons in 100 and within 0.1 degrees for half of them over the 150 days (the worst, among Jupiter's moons, is about 7 degrees); the mean orbit of an irregular moon is tens of degrees off.
 *
 * @example
 * ```ts
 * import { MOON_OSCULATING_DAYS } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log("irregular moons follow Horizons for", MOON_OSCULATING_DAYS, "days either side");
 * ```
 */
export const MOON_OSCULATING_DAYS = 150;

// the GM of the planet each osculating orbit goes round, km^3/s^2: the planet's system, from JPL's "Planetary Satellite Physical Parameters" (the same numbers the build script took the elements with)
const HOST_GM: Readonly<Partial<Record<HostId, number>>> = { jupiter: 126_686_534.9, saturn: 37_931_207.8, uranus: 5_793_951.3, neptune: 6_835_099.5 };

// the whole numbers of data/moon-osculating.ts go to the irregular moons of the giant planets that have a mean orbit, in the order of the rows (the build script writes them in that order, and a test holds the two to each other)
const OSCULATING = new Map<string, MoonOsculating>();
{
  let at = 0;
  for (const row of MOON_CATALOGUE_ROWS) {
    if (row[9] === null || ["regular", "inner", "major", "none"].includes(row[18]) || HOST_GM[row[4]] === undefined) continue;
    const [a, e, i, node, w, m] = MOON_OSCULATING.slice(at, at + 6) as [number, number, number, number, number, number];
    OSCULATING.set(row[0], { epochJd: OSCULATING_EPOCH_JD, a: a * 100, e: e / 1e4, i: i / 100, node: node / 100, w: w / 100, m: m / 100 });
    at += 6;
  }
}

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
 * moon's magnitude and an albedo: the sheet's albedo where it gives one, else `ASSUMED_ALBEDO`, by D = 10^(3.1236 - 0.5 log10(albedo) - 0.2 V), the formula of NASA/JPL's asteroid size estimator).
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
 * Where a moon's magnitude comes from: `sheet` (the V(1,0) magnitude on its JPL Horizons data sheet) or `wikipedia` (the absolute magnitude of English Wikipedia's table of the moons of its planet, which takes the irregular
 * moons' from the Minor Planet Center's Natural Satellites Ephemeris Service; read on `MOON_MAGNITUDES_READ`, the page is in `MOON_MAGNITUDE_PAGES`). A size worked out from a `wikipedia` magnitude is an estimate: it assumes the
 * albedo `ASSUMED_ALBEDO`, and `radiusFrom` says `derived`.
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, type MoonMagnitudeSource } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const from: MoonMagnitudeSource | null = findCatalogueMoon("Ymir")!.magnitudeFrom;
 * console.log(from);
 * ```
 */
export type MoonMagnitudeSource = "sheet" | "wikipedia";

/**
 * The day the magnitudes marked `wikipedia` were read from English Wikipedia's tables (CC BY-SA 4.0): one request for each of the four pages.
 *
 * @example
 * ```ts
 * import { MOON_MAGNITUDES_READ } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log("Wikipedia read on", MOON_MAGNITUDES_READ);
 * ```
 */
export const MOON_MAGNITUDES_READ = "2026-11-18";

/**
 * The English Wikipedia page each host's `wikipedia` magnitudes were read from.
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, MOON_MAGNITUDE_PAGES } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const moon = findCatalogueMoon("Ymir")!;
 * if (moon.magnitudeFrom === "wikipedia") console.log(MOON_MAGNITUDE_PAGES[moon.host]);
 * ```
 */
export const MOON_MAGNITUDE_PAGES: Readonly<Partial<Record<HostId, string>>> = {
  jupiter: "https://en.wikipedia.org/wiki/Moons_of_Jupiter",
  saturn: "https://en.wikipedia.org/wiki/Moons_of_Saturn",
  uranus: "https://en.wikipedia.org/wiki/Moons_of_Uranus",
  neptune: "https://en.wikipedia.org/wiki/Moons_of_Neptune",
};

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
  /** The osculating orbit on `MOON_OSCULATING_EPOCH_JD`, for an irregular moon of a giant planet; `null` for the others. */
  osculating: MoonOsculating | null;
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
  /** The V(1,0) magnitude (as bright as it would be 1 au from the Sun and from us), where the Horizons sheet gives one, else, for an irregular moon with no size, the absolute magnitude of English Wikipedia's table (see `magnitudeFrom`). */
  magnitude: number | null;
  /** Where `magnitude` comes from; `null` when there is none. */
  magnitudeFrom: MoonMagnitudeSource | null;
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
const MAGNITUDE_FROM = ["sheet", "wikipedia"] as const;

function moonOf(row: MoonRow): CatalogueMoon {
  const [id, name, designation, number, host, code, year, by, reference, o, radius, sigma, from, albedo, magnitude, worstKm, worstDegrees, farDegrees, group, ja, confirmed, drawn, magnitudeSource] = row;
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
    osculating: OSCULATING.get(id) ?? null,
    retrograde: orbit === null ? null : orbit.i > 90,
    group,
    radiusKm,
    radiusSigmaKm: sigma,
    radiusFrom,
    albedo,
    magnitude,
    magnitudeFrom: magnitudeSource === null ? null : MAGNITUDE_FROM[magnitudeSource]!,
    accuracy: worstKm === null || worstDegrees === null ? null : { worstKm, worstDegrees, farDegrees },
    grade,
    full: drawn !== 0,
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

/** A place on an ellipse of semi-major axis `a` (km) and eccentricity `e`, inclination `i`, node and argument of periapsis `w` (degrees), at eccentric anomaly `E` (radians), in the frame of the pole (the J2000 ecliptic for `null`). */
function placedAt(a: number, e: number, i: number, nodeDeg: number, wDeg: number, E: number, pole: readonly [number, number] | null): Vec3 {
  const w = wDeg * RAD;
  const node = nodeDeg * RAD;
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [cw, sw, cn, sn, ci, si] = [Math.cos(w), Math.sin(w), Math.cos(node), Math.sin(node), Math.cos(i * RAD), Math.sin(i * RAD)];
  const px = (cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y;
  const py = (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y;
  const pz = sw * si * x + cw * si * y;
  const [bx, by, bz] = basisOf(pole);
  return [px * bx[0] + py * by[0] + pz * bz[0], px * bx[1] + py * by[1] + pz * bz[1], px * bx[2] + py * by[2] + pz * bz[2]];
}

/** The same at mean anomaly `meanAnomaly` (radians), solved by Kepler's equation. */
function placed(a: number, e: number, i: number, nodeDeg: number, wDeg: number, meanAnomaly: number, pole: readonly [number, number] | null): Vec3 {
  return placedAt(a, e, i, nodeDeg, wDeg, kepler(meanAnomaly, e), pole);
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
  const jd = toTerrestrialTime(moment(when)) / DAY_MS + UNIX_JD;
  const osc = m.osculating;
  if (osc !== null && Math.abs(jd - osc.epochJd) <= MOON_OSCULATING_DAYS) {
    // inside the window an irregular moon follows its osculating orbit: a plain two-body step from the day it was taken
    const meanMotion = Math.sqrt(HOST_GM[m.host]! / osc.a ** 3) * 86_400;
    return placed(osc.a, osc.e, osc.i, osc.node, osc.w, osc.m * RAD + meanMotion * (jd - osc.epochJd), null);
  }
  const [n, dw, dn] = ratesOf(orbit);
  const dt = jd - orbit.epochJd;
  return placed(orbit.a, orbit.e, orbit.i, orbit.node + dn * dt, orbit.w + dw * dt, (orbit.m + n * dt) * RAD, orbit.frame === "ecliptic" ? null : (orbit.pole ?? null));
}

/**
 * The orbit a moon follows at a moment, as a closed line from its planet's centre, in kilometres, in the same frame as `catalogueMoonPosition`: the one that function places the moon on (its osculating orbit within
 * `MOON_OSCULATING_DAYS` of `MOON_OSCULATING_EPOCH_JD`, else its mean orbit turned for the precession of its periapsis and node), sampled evenly in eccentric anomaly so a long ellipse keeps its sharp end. The line
 * closes: its last point is its first. It is the shape at that moment; an irregular moon's orbit turns over years, so draw it again after a month or two of game time, not every frame.
 *
 * @param moon - A moon of the catalogue, or its id, name, designation or code.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param points - How many points round the orbit, 8 to 720 (default 72). The line has one more, the first again.
 * @returns The points, or `undefined` for a moon with no orbit.
 *
 * @example
 * ```ts
 * import { catalogueMoonOrbit } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const ring = catalogueMoonOrbit("Carme", new Date("2026-11-18T00:00:00Z"), 48)!;
 * console.log(ring.length, "points, the first", ring[0]!.map((v) => Math.round(v / 1e6)).join(", "), "million km from Jupiter");
 * ```
 */
export function catalogueMoonOrbit(moon: CatalogueMoon | string | number, when: When, points = 72): Vec3[] | undefined {
  const m = typeof moon === "object" ? moon : findCatalogueMoon(moon);
  if (m === undefined) throw new RangeError(`unknown moon ${JSON.stringify(moon)}; look one up with findCatalogueMoon`);
  const orbit = m.orbit;
  if (orbit === null) return undefined;
  const count = Math.min(720, Math.max(8, Math.round(points)));
  const jd = toTerrestrialTime(moment(when)) / DAY_MS + UNIX_JD;
  const osc = m.osculating;
  let shape: [number, number, number, number, number, readonly [number, number] | null];
  if (osc !== null && Math.abs(jd - osc.epochJd) <= MOON_OSCULATING_DAYS) shape = [osc.a, osc.e, osc.i, osc.node, osc.w, null];
  else {
    const [, dw, dn] = ratesOf(orbit);
    const dt = jd - orbit.epochJd;
    shape = [orbit.a, orbit.e, orbit.i, orbit.node + dn * dt, orbit.w + dw * dt, orbit.frame === "ecliptic" ? null : (orbit.pole ?? null)];
  }
  const out: Vec3[] = [];
  for (let k = 0; k < count; k += 1) out.push(placedAt(shape[0], shape[1], shape[2], shape[3], shape[4], (k / count) * 2 * Math.PI, shape[5]));
  out.push(out[0]!);
  return out;
}

/**
 * A family of moons, as a planet's moons are sorted for a list: Jupiter's `galilean`, `inner`, `himalia`, `ananke`, `carme` and `pasiphae` groups and `other` irregular moons (Themisto, Carpo and Valetudo); Saturn's
 * `inner` (its major and inner moons), `inuit`, `gallic` and `norse`; Uranus's and Neptune's `inner` and `irregular`; and `moons`, the one family of a host with too few to divide (Earth, Mars, Pluto and the dwarf
 * planets). A family is `MoonGroup` regrouped by planet: it is a sorting for lists, not a second rule.
 *
 * @example
 * ```ts
 * import type { MoonFamilyId } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const family: MoonFamilyId = "norse";
 * console.log(family);
 * ```
 */
export type MoonFamilyId = "galilean" | "inner" | "himalia" | "ananke" | "carme" | "pasiphae" | "other" | "inuit" | "gallic" | "norse" | "irregular" | "moons";

/**
 * A name in English and Japanese.
 *
 * @example
 * ```ts
 * import { moonFamilies } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const names = moonFamilies("saturn")[0]!.names;
 * console.log(names.en, names.ja);
 * ```
 */
export interface MoonNames {
  en: string;
  ja: string;
}

/** The families of each host, in the order a list shows them, with the group each takes in, its names and the colour its orbits are drawn in by group. */
const FAMILY_TABLE: Readonly<Record<MoonFamilyId, { names: MoonNames; color: string }>> = {
  galilean: { names: { en: "Galilean moons", ja: "ガリレオ衛星" }, color: "#f2c14e" },
  inner: { names: { en: "Inner and major moons", ja: "内側の衛星と大きな衛星" }, color: "#9bd1ff" },
  himalia: { names: { en: "Himalia group", ja: "ヒマリア群" }, color: "#5fd38d" },
  ananke: { names: { en: "Ananke group", ja: "アナンケ群" }, color: "#ff9f6b" },
  carme: { names: { en: "Carme group", ja: "カルメ群" }, color: "#e0568a" },
  pasiphae: { names: { en: "Pasiphae group", ja: "パシファエ群" }, color: "#b07cff" },
  other: { names: { en: "Other irregular moons", ja: "その他の不規則衛星" }, color: "#c9cdd4" },
  inuit: { names: { en: "Inuit group", ja: "イヌイット群" }, color: "#5fd38d" },
  gallic: { names: { en: "Gallic group", ja: "ガリア群" }, color: "#5aa9ff" },
  norse: { names: { en: "Norse group", ja: "北欧群" }, color: "#e0568a" },
  irregular: { names: { en: "Irregular moons", ja: "不規則衛星" }, color: "#ff9f6b" },
  moons: { names: { en: "Moons", ja: "衛星" }, color: "#c9cdd4" },
};

const FAMILIES_OF: Readonly<Partial<Record<HostId, readonly MoonFamilyId[]>>> = {
  jupiter: ["galilean", "inner", "himalia", "ananke", "carme", "pasiphae", "other"],
  saturn: ["inner", "inuit", "gallic", "norse"],
  uranus: ["inner", "irregular"],
  neptune: ["inner", "irregular"],
};

/** The family a moon is in. */
function familyOf(moon: CatalogueMoon): MoonFamilyId {
  const group = moon.group;
  if (moon.host === "jupiter") {
    if (group === "major") return "galilean";
    if (group === "inner" || group === "regular") return "inner";
    if (group === "himalia" || group === "ananke" || group === "carme" || group === "pasiphae") return group;
    return "other";
  }
  if (moon.host === "saturn") return group === "inuit" || group === "gallic" || group === "norse" ? group : "inner";
  if (moon.host === "uranus" || moon.host === "neptune") return group === "prograde" || group === "retrograde" ? "irregular" : "inner";
  return "moons";
}

/**
 * One moon of a family, with what a list prints.
 *
 * @example
 * ```ts
 * import { moonFamilies, type MoonFamilyMoon } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const first: MoonFamilyMoon = moonFamilies("jupiter")[0]!.moons[0]!;
 * console.log(first.label, first.radiusKm, first.estimate);
 * ```
 */
export interface MoonFamilyMoon {
  /** Its id in the catalogue. */
  id: string;
  /** What to print: the name, else the designation. */
  label: string;
  /** The Japanese name, where one is written down. */
  ja: string | null;
  /** The mean radius in kilometres, or `null` when nothing gives it. */
  radiusKm: number | null;
  /** `true` when `radiusKm` is derived from a magnitude and an assumed albedo rather than measured: an estimate, to be shown as one. */
  estimate: boolean;
  /** Whether it goes round against its planet's turn, or `null` with no orbit. */
  retrograde: boolean | null;
  /** The catalogue's entry. */
  moon: CatalogueMoon;
}

/**
 * A planet's family of moons: how many, how many have a size, the largest and smallest sizes, and the moons nearest first.
 *
 * @example
 * ```ts
 * import { moonFamilies, type MoonFamily } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const norse: MoonFamily = moonFamilies("saturn").find((f) => f.id === "norse")!;
 * console.log(norse.names.en, norse.count, "moons, the largest about", norse.largestKm, "km across its radius", norse.largestIsEstimate ? "(estimated)" : "");
 * ```
 */
export interface MoonFamily {
  id: MoonFamilyId;
  host: HostId;
  names: MoonNames;
  /** The colour (`#rrggbb`) the family's orbits are drawn in when the view colours by group. */
  color: string;
  /** How many moons. */
  count: number;
  /** How many have an IAU name. */
  named: number;
  /** How many have a radius (measured, from a data sheet or estimated). */
  sized: number;
  /** How many of those radii are estimates. */
  estimated: number;
  /** The largest radius in kilometres, or `null` when none has one, and whether that one is an estimate. */
  largestKm: number | null;
  largestIsEstimate: boolean;
  /** The smallest radius in kilometres, or `null`, and whether that one is an estimate. */
  smallestKm: number | null;
  smallestIsEstimate: boolean;
  /** `"prograde"` or `"retrograde"` when every moon with an orbit goes one way, `"mixed"` when they do not, `null` when none has an orbit. */
  direction: "prograde" | "retrograde" | "mixed" | null;
  /** The moons, nearest first (a moon with no orbit last). */
  moons: readonly MoonFamilyMoon[];
}

/**
 * A planet's moons sorted into families for a list or a tab: Jupiter (Galilean, inner, Himalia, Ananke, Carme, Pasiphae, other irregular moons), Saturn (inner and major, Inuit, Gallic, Norse), Uranus and Neptune (inner
 * and major, irregular), and one family `moons` for a host with too few to divide. Every moon of the host is in exactly one family. A size is the catalogue's `radiusKm`; `estimate` is true where it is derived
 * (see `radiusFrom`), and a family says how many of its sizes are estimates, so a page can mark them.
 *
 * @param host - The planet or dwarf planet: "saturn".
 * @returns The families, in the order a list shows them; an empty list for a host with no moon in the catalogue.
 *
 * @example
 * ```ts
 * import { moonFamilies } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * for (const family of moonFamilies("jupiter")) console.log(family.names.en, family.count, family.sized, "with a size,", family.estimated, "of them estimated");
 * ```
 */
export function moonFamilies(host: HostId): readonly MoonFamily[] {
  const own = catalogueMoonsOf(host);
  if (own.length === 0) return [];
  return (FAMILIES_OF[host] ?? (["moons"] as const)).map((id) => {
    const moons: MoonFamilyMoon[] = own
      .filter((m) => familyOf(m) === id)
      .map((m) => ({ id: m.id, label: m.label, ja: m.ja, radiusKm: m.radiusKm, estimate: m.radiusFrom === "derived", retrograde: m.retrograde, moon: m }));
    const sized = moons.filter((m) => m.radiusKm !== null);
    const largest = sized.reduce<MoonFamilyMoon | undefined>((best, m) => (best === undefined || m.radiusKm! > best.radiusKm! ? m : best), undefined);
    const smallest = sized.reduce<MoonFamilyMoon | undefined>((best, m) => (best === undefined || m.radiusKm! < best.radiusKm! ? m : best), undefined);
    const ways = new Set(moons.filter((m) => m.retrograde !== null).map((m) => (m.retrograde ? "retrograde" : "prograde")));
    return {
      id,
      host,
      names: FAMILY_TABLE[id].names,
      color: FAMILY_TABLE[id].color,
      count: moons.length,
      named: moons.filter((m) => m.moon.named).length,
      sized: sized.length,
      estimated: sized.filter((m) => m.estimate).length,
      largestKm: largest?.radiusKm ?? null,
      largestIsEstimate: largest?.estimate ?? false,
      smallestKm: smallest?.radiusKm ?? null,
      smallestIsEstimate: smallest?.estimate ?? false,
      direction: ways.size === 0 ? null : ways.size === 2 ? "mixed" : ways.has("retrograde") ? "retrograde" : "prograde",
      moons,
    };
  });
}

/**
 * What an orbit's colour says: its moon's family (`group`), or the way it goes round (`direction`).
 *
 * @example
 * ```ts
 * import type { MoonColorBy } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const by: MoonColorBy = "direction";
 * console.log(by);
 * ```
 */
export type MoonColorBy = "group" | "direction";

/**
 * One line of a key: what a colour means, in both languages, and how many moons wear it.
 *
 * @example
 * ```ts
 * import { moonOrbitKey, type MoonKeyEntry } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * const entry: MoonKeyEntry = moonOrbitKey("direction")[0]!;
 * console.log(entry.id, entry.color, entry.count);
 * ```
 */
export interface MoonKeyEntry {
  /** A family id (`norse`) when coloured by group, `prograde` or `retrograde` when by direction. */
  id: string;
  names: MoonNames;
  /** `#rrggbb`. */
  color: string;
  /** How many moons of the hosts asked for wear it (only those with an orbit). */
  count: number;
}

const DIRECTION_KEY: Readonly<Record<"prograde" | "retrograde", { names: MoonNames; color: string }>> = {
  prograde: { names: { en: "Prograde (with the planet's turn)", ja: "順行（惑星の自転と同じ向き）" }, color: "#5aa9ff" },
  retrograde: { names: { en: "Retrograde (against it)", ja: "逆行（惑星の自転と逆向き）" }, color: "#ff6b6b" },
};

/**
 * The colour an orbit is drawn in, `#rrggbb`: by `group` the moon's family colour, by `direction` blue for prograde and red for retrograde. A moon with no orbit has none to draw; it gets the neutral grey.
 *
 * @param moon - A moon of the catalogue.
 * @param by - What the colour says.
 * @returns `#rrggbb`.
 *
 * @example
 * ```ts
 * import { findCatalogueMoon, moonOrbitColor } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * console.log(moonOrbitColor(findCatalogueMoon("Carme")!, "direction"));
 * ```
 */
export function moonOrbitColor(moon: CatalogueMoon, by: MoonColorBy): string {
  if (by === "direction") return moon.retrograde === null ? "#c9cdd4" : DIRECTION_KEY[moon.retrograde ? "retrograde" : "prograde"].color;
  return FAMILY_TABLE[familyOf(moon)].color;
}

/**
 * The key to the colours of the orbits drawn for some hosts, as data: one entry per colour in use, with its names (English and Japanese), its `#rrggbb` and how many moons wear it. A page draws it beside the view
 * (the element's `moonKey` gives the key of what it is drawing).
 *
 * @param by - Coloured by `group` (the families) or `direction`.
 * @param hosts - The planets or dwarf planets drawn; every host by default.
 * @returns The entries, in the order the families are listed (prograde, then retrograde).
 *
 * @example
 * ```ts
 * import { moonOrbitKey } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 *
 * for (const entry of moonOrbitKey("group", ["saturn"])) console.log(entry.color, entry.names.en, entry.count);
 * ```
 */
export function moonOrbitKey(by: MoonColorBy, hosts?: readonly HostId[]): readonly MoonKeyEntry[] {
  const moons = MOON_CATALOGUE.filter((m) => m.orbit !== null && (hosts === undefined || hosts.includes(m.host)));
  if (by === "direction") {
    return (["prograde", "retrograde"] as const)
      .map((id) => ({ id, names: DIRECTION_KEY[id].names, color: DIRECTION_KEY[id].color, count: moons.filter((m) => m.retrograde === (id === "retrograde")).length }))
      .filter((entry) => entry.count > 0);
  }
  const out: MoonKeyEntry[] = [];
  for (const m of moons) {
    const id = familyOf(m);
    const seen = out.find((entry) => entry.id === id);
    if (seen === undefined) out.push({ id, names: FAMILY_TABLE[id].names, color: FAMILY_TABLE[id].color, count: 1 });
    else seen.count += 1;
  }
  const order = Object.keys(FAMILY_TABLE);
  return out.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
}
