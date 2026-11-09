// Your weight and your age on other worlds, for children. The weight comes from the surface gravity, GM / radius squared, using the same GM and radius the package already holds (stops.ts and facts.ts):
// the Sun, Mercury and Venus from NASA's planetary fact sheets, the other planets, Pluto and the moons from JPL's Planetary Satellite Physical Parameters, the radii from the IAU and NASA.
// The age comes from the length of the world's year (the planets' sidereal orbit periods, NASA's planetary fact sheet; a moon goes round the Sun with its planet, so its year is its planet's)
// and of its day (the solar day, from the rotation in facts.ts and that year). Pure: no DOM, no clock; the date is always an argument.
import { BODIES, MOONS_OF, PLANET_IDS, type PlanetId } from "./facts.ts";
import { journeyStop } from "./stops.ts";

/** Nereid has no published mass in the pages read here, so it has no gravity; the other moons of the planets and of Pluto are all here. */
type KidsMoonId = Exclude<(typeof MOONS_OF)["earth" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto"][number], "nereid">;

/**
 * A world a child can stand on in this part: the Sun, the eight planets, Pluto and the moons of the planets and of Pluto (not Nereid, whose mass is not known well enough).
 *
 * @example
 * ```ts
 * import { type WorldId } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * const world: WorldId = "titan";
 * console.log(world);
 * ```
 */
export type WorldId = "sun" | PlanetId | KidsMoonId;

const HOSTS = ["earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;

/**
 * Every world, in order: the Sun, the planets nearest the Sun first, Pluto, then the moons of each planet.
 *
 * @example
 * ```ts
 * import { WORLD_IDS } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * console.log(WORLD_IDS.length, WORLD_IDS[0], WORLD_IDS.includes("moon"));
 * ```
 */
export const WORLD_IDS: readonly WorldId[] = ["sun", ...PLANET_IDS, ...HOSTS.flatMap((host) => MOONS_OF[host].filter((id): id is KidsMoonId => id !== "nereid"))];

const KNOWN = new Set<string>(WORLD_IDS);
const DAY_MS = 86_400_000;

/** The sidereal orbit period of each planet in Earth days: NASA's Planetary Fact Sheet (https://nssdc.gsfc.nasa.gov/planetary/factsheet/). */
const YEAR_DAYS: Readonly<Record<PlanetId, number>> = {
  mercury: 87.969,
  venus: 224.701,
  // The Earth's own year is the calendar's (the Gregorian mean), because a person's age on the Earth is counted by birthdays.
  earth: 365.2425,
  mars: 686.98,
  jupiter: 4332.589,
  saturn: 10759.22,
  uranus: 30685.4,
  neptune: 60189,
  pluto: 90560,
};

const hostOf = (id: WorldId): PlanetId | "sun" => (id === "sun" ? "sun" : ((BODIES[id].parent as PlanetId | undefined) ?? (id as PlanetId)));

function check(id: string): asserts id is WorldId {
  if (!KNOWN.has(id)) throw new RangeError(`no gravity or year for "${id}": use one of WORLD_IDS`);
}

/**
 * How strongly a world pulls you, and where that was measured.
 *
 * @example
 * ```ts
 * import { surfaceGravity, type SurfaceGravity } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * const jupiter: SurfaceGravity = surfaceGravity("jupiter");
 * console.log(jupiter.surface, jupiter.metresPerSecondSquared.toFixed(1));
 * ```
 */
export interface SurfaceGravity {
  /** Metres a second, every second: GM / radius squared at the equator, not counting the world's own turning. */
  metresPerSecondSquared: number;
  /** How many times the Earth's, worked out the same way, so the Earth is exactly 1. */
  relativeToEarth: number;
  /** Where the radius is measured: the planets' and moons' surface, the Sun's visible surface (the photosphere), or a gas giant's cloud tops where the air pressure is 1 bar, the Earth's at sea level. */
  surface: "surface" | "photosphere" | "cloud-tops";
  /** Where the GM and the radius come from, in words. */
  source: string;
}

const SURFACE: Partial<Record<WorldId, SurfaceGravity["surface"]>> = { sun: "photosphere", jupiter: "cloud-tops", saturn: "cloud-tops", uranus: "cloud-tops", neptune: "cloud-tops" };
const FACT_SHEET = new Set<WorldId>(["sun", "mercury", "venus"]);

/** The gravity at a world's surface, in metres a second squared. */
const gravityOf = (id: WorldId): number => {
  const stop = journeyStop(id);
  if (stop.gmKm3s2 === null) throw new RangeError(`no mass for ${id}`);
  return (stop.gmKm3s2 / (stop.radiusKm * stop.radiusKm)) * 1000;
};

const EARTH_GRAVITY = gravityOf("earth");

/**
 * The gravity at a world's surface: in metres a second squared, as a multiple of the Earth's, where it is measured and the source. For Jupiter, Saturn, Uranus and Neptune it is at the cloud tops, where the pressure is 1 bar,
 * because they have no surface to stand on; for the Sun it is the visible surface.
 *
 * @param id - The world.
 * @returns The gravity and where it comes from.
 *
 * @example
 * ```ts
 * import { surfaceGravity } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * const mars = surfaceGravity("mars");
 * console.log(mars.relativeToEarth.toFixed(2), mars.source);
 * ```
 */
export function surfaceGravity(id: WorldId): SurfaceGravity {
  check(id);
  const gravity = gravityOf(id);
  return {
    metresPerSecondSquared: gravity,
    relativeToEarth: gravity / EARTH_GRAVITY,
    surface: SURFACE[id] ?? "surface",
    source: FACT_SHEET.has(id)
      ? "GM from NASA's planetary fact sheet (https://nssdc.gsfc.nasa.gov/planetary/factsheet/), radius from the IAU and NASA"
      : "GM from JPL's Planetary Satellite Physical Parameters (https://ssd.jpl.nasa.gov/sats/phys_par/), radius from the IAU and NASA",
  };
}

/**
 * What you weigh on a world, in the unit you give: kilograms in, kilograms out; pounds in, pounds out. It is the number a bathroom scale on the Earth would show if you stood on that world (your mass does not change; the
 * pull does). For a gas giant it is at the cloud tops, 1 bar.
 *
 * @param id - The world.
 * @param weight - Your weight on the Earth, in any unit.
 * @returns Your weight on that world, in the same unit.
 *
 * @example
 * ```ts
 * import { weightOn } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * console.log(weightOn("moon", 30).toFixed(1), "kg on the Moon");
 * console.log(weightOn("jupiter", 30).toFixed(1), "kg at Jupiter's cloud tops");
 * ```
 */
export function weightOn(id: WorldId, weight: number): number {
  if (!Number.isFinite(weight) || weight < 0) throw new RangeError("a weight is a number of 0 or more");
  return weight * surfaceGravity(id).relativeToEarth;
}

/**
 * A moment, as a `Date` or as milliseconds since 1970. A birthday is a calendar date, so give a birthday and today as midnight UTC of the date: `Date.UTC(2016, 10, 8)`.
 *
 * @example
 * ```ts
 * import { type Instant } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * const born: Instant = Date.UTC(2016, 10, 8);
 * console.log(new Date(born).toISOString());
 * ```
 */
export type Instant = Date | number;

const msOf = (when: Instant): number => {
  const ms = typeof when === "number" ? when : when.getTime();
  if (!Number.isFinite(ms)) throw new RangeError("a date is needed");
  return ms;
};

/** The length of a world's year in Earth days, or null for the Sun. A moon's year is its planet's. */
const yearDaysOf = (id: WorldId): number | null => {
  const host = hostOf(id);
  return host === "sun" ? null : YEAR_DAYS[host];
};

/** The solar day (from one noon to the next) in Earth hours: 1 / (1 / the spin period - 1 / the year), the spin negative when backwards. Nix and Hydra tumble, with no steady spin, so they have none. */
const solarDayHours = (id: WorldId, yearDays: number): number | null => {
  if (id === "earth") return 24;
  const spin = BODIES[id].rotationHours;
  return spin === 0 ? null : Math.abs(1 / (1 / spin - 1 / (yearDays * 24)));
};

/**
 * How old you are on a world.
 *
 * @example
 * ```ts
 * import { type WorldAge } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * const age: WorldAge = { years: 5.2, wholeYears: 5, days: 100, yearDays: 686.98, dayHours: 24.66 };
 * console.log(age.wholeYears);
 * ```
 */
export interface WorldAge {
  /** Your age in that world's years, with the part of the year gone: 1.5 is a year and a half. */
  years: number;
  /** The whole years you have had there: the age a child would say. */
  wholeYears: number;
  /** The days you have lived there, a day being that world's solar day, with the part of the day gone. `null` for Nix and Hydra, which tumble and have no steady day. */
  days: number | null;
  /** How long that world's year is, in Earth days. */
  yearDays: number;
  /** How long that world's solar day is, in Earth hours: Mercury's is 4,223, Venus's 2,802, the Earth's 24. `null` where there is none. */
  dayHours: number | null;
}

const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** The birthday of a birth moment in a calendar year, UTC: the same month, day and time, with 29 February taken as 28 February in a year with no 29th. */
function anniversary(birth: number, year: number): number {
  const d = new Date(birth);
  const day = Math.min(d.getUTCDate(), daysInMonth(year, d.getUTCMonth()));
  return Date.UTC(year, d.getUTCMonth(), day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

/** How many Earth birthdays have passed by `now` (UTC calendar), and the moments of the last one and the next. */
function earthYears(birth: number, now: number): { whole: number; last: number; next: number } {
  const birthYear = new Date(birth).getUTCFullYear();
  let year = new Date(now).getUTCFullYear();
  if (anniversary(birth, year) > now) year -= 1;
  return { whole: year - birthYear, last: anniversary(birth, year), next: anniversary(birth, year + 1) };
}

function order(birth: number, now: number): void {
  if (birth > now) throw new RangeError("the birthday is after today");
}

/**
 * How old you are on a world, in that world's years and days. On the Earth (and on the Moon, which goes round the Sun with the Earth) the years are the calendar's, counted by birthdays, so the whole years are
 * your real age. Elsewhere a year is the world's orbit period, from NASA's planetary fact sheet, and a moon's year is its planet's. A day is the world's solar day. The Sun has no year and no day to count, so it gives `null`.
 *
 * @param id - The world.
 * @param birth - Your birthday, as midnight UTC of the date.
 * @param now - Today, as midnight UTC of the date.
 * @returns Your age there, or `null` for the Sun.
 *
 * @example
 * ```ts
 * import { ageOn } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * const born = Date.UTC(2016, 10, 8);
 * const today = Date.UTC(2026, 10, 8);
 * console.log(ageOn("earth", born, today)?.wholeYears, ageOn("mars", born, today)?.years.toFixed(2), ageOn("jupiter", born, today)?.years.toFixed(2));
 * ```
 */
export function ageOn(id: WorldId, birth: Instant, now: Instant): WorldAge | null {
  check(id);
  const b = msOf(birth);
  const n = msOf(now);
  order(b, n);
  const yearDays = yearDaysOf(id);
  if (yearDays === null) return null;
  const dayHours = solarDayHours(id, yearDays);
  const days = dayHours === null ? null : (n - b) / (dayHours * 3_600_000);
  if (hostOf(id) === "earth") {
    const e = earthYears(b, n);
    return { years: e.whole + (n - e.last) / (e.next - e.last), wholeYears: e.whole, days, yearDays, dayHours };
  }
  const years = (n - b) / (yearDays * DAY_MS);
  return { years, wholeYears: Math.floor(years), days, yearDays, dayHours };
}

/**
 * A birthday on a world.
 *
 * @example
 * ```ts
 * import { type Birthday } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * const next: Birthday = { date: new Date(Date.UTC(2027, 3, 4)), turns: 2, inEarthDays: 148 };
 * console.log(next.turns);
 * ```
 */
export interface Birthday {
  /** The moment your next birthday there comes. */
  date: Date;
  /** The age you turn, in that world's years. */
  turns: number;
  /** How many Earth days away it is: 0 on the day itself. */
  inEarthDays: number;
}

/**
 * Your next birthday on a world: the first moment on or after `now` when that world is back where it was on the day you were born, counting its years from your birth. On the Earth and the Moon that is the calendar birthday
 * (29 February is 28 February in a year with no 29th). The Sun has no birthdays, so it gives `null`.
 *
 * @param id - The world.
 * @param birth - Your birthday, as midnight UTC of the date.
 * @param now - Today, as midnight UTC of the date.
 * @returns The next birthday there, or `null` for the Sun.
 *
 * @example
 * ```ts
 * import { nextBirthdayOn } from "@johnmorrisdotca/wakusei-planets/kids";
 *
 * const next = nextBirthdayOn("mars", Date.UTC(2016, 10, 8), Date.UTC(2026, 10, 8));
 * console.log(next?.date.toISOString().slice(0, 10), next?.turns, next?.inEarthDays.toFixed(0));
 * ```
 */
export function nextBirthdayOn(id: WorldId, birth: Instant, now: Instant): Birthday | null {
  check(id);
  const b = msOf(birth);
  const n = msOf(now);
  order(b, n);
  const yearDays = yearDaysOf(id);
  if (yearDays === null) return null;
  if (hostOf(id) === "earth") {
    const birthYear = new Date(b).getUTCFullYear();
    let year = Math.max(birthYear + 1, new Date(n).getUTCFullYear());
    if (anniversary(b, year) < n) year += 1;
    const at = anniversary(b, year);
    return { date: new Date(at), turns: year - birthYear, inEarthDays: (at - n) / DAY_MS };
  }
  const turns = Math.max(1, Math.ceil((n - b) / (yearDays * DAY_MS)));
  const at = b + turns * yearDays * DAY_MS;
  return { date: new Date(at), turns, inEarthDays: (at - n) / DAY_MS };
}
