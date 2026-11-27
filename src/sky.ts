// Sky events (seasons, Moon phases, eclipses, rise/set/transit, calendar-day rise and set, alignments, peak magnitude, local solar eclipses, libration, lunar apsides and nodes, greatest elongation) through astronomy-engine, an OPTIONAL peer dependency: `pnpm add astronomy-engine` (2.1.19 or newer, below 3) beside this package.
// This is the only file under src/ that imports it, so the core, /suncalc and /sky-bodies never reach it (test/sky-events.test.ts holds that). A page that never imports `/sky` never needs the peer.
// A missing peer cannot be caught here: a static import fails before any code runs, with the runtime's own "cannot find package astronomy-engine", which names it. (A top-level await would let this file word its own error, but
// the package's size measure and any ES2020 bundler refuse top-level await; see the CHANGELOG, "default, for John to confirm".) Everything is experimental during 0.x. Pure: no DOM, no clock read, no three.js.
import { ApsisKind, Body, Equator, GeoMoon, GeoVector, Horizon, Ecliptic, KM_PER_AU, Libration, MakeTime, MoonPhase, NextGlobalSolarEclipse, NextLunarApsis, NextLunarEclipse, NextMoonNode, NextMoonQuarter, NodeEventKind, Observer as EngineObserver, Search, SearchGlobalSolarEclipse, SearchHourAngle, SearchLocalSolarEclipse, SearchLunarApsis, SearchLunarEclipse, SearchMaxElongation, SearchMoonNode, SearchMoonPhase, SearchMoonQuarter, SearchPeakMagnitude, SearchRiseSet, Seasons, type AstroTime, type EclipseEvent, type FlexibleDateTime } from "astronomy-engine";
import type { SkyBodyId } from "./sky-bodies.ts";
import type { Observer } from "./sky/types.ts";
import { moment, type When } from "./when.ts";

const DAY_MS = 86_400_000;

/** The two ends of a search interval as milliseconds, the start included and the end not; an end before the start throws a `RangeError` naming it. */
function interval(from: When, to: When): [number, number] {
  const start = moment(from, "from");
  const end = moment(to, "to");
  if (end < start) throw new RangeError(`to must not be before from, got from ${new Date(start).toISOString()} and to ${new Date(end).toISOString()}`);
  return [start, end];
}

/**
 * The four moments of a year when the Sun's apparent ecliptic longitude is 0, 90, 180 and 270 degrees, as `Date`s (UTC). The seasons of the northern hemisphere start at the March equinox (spring) and the December solstice (winter).
 *
 * @experimental
 * @example
 * ```ts
 * import { seasons, type SkySeasons } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const s: SkySeasons = seasons(2026);
 * console.log(s.marchEquinox instanceof Date, s.marchEquinox < s.juneSolstice);
 * ```
 */
export interface SkySeasons {
  /** The Sun crosses the celestial equator going north: ecliptic longitude 0. */
  marchEquinox: Date;
  /** The Sun is farthest north: ecliptic longitude 90. */
  juneSolstice: Date;
  /** The Sun crosses the celestial equator going south: ecliptic longitude 180. */
  septemberEquinox: Date;
  /** The Sun is farthest south: ecliptic longitude 270. */
  decemberSolstice: Date;
}

/**
 * The equinoxes and solstices of a calendar year (UTC), found by astronomy-engine. The year is an integer; anything else throws a `RangeError` naming it. The times are good to about a minute against the USNO table
 * for 1900 to 2050 (the accuracy guide has the measured figures); the moments are UT, as a `Date` counts them.
 *
 * @param year - A calendar year, an integer (UTC).
 * @returns The four moments, in order.
 * @experimental
 * @example
 * ```ts
 * import { seasons } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const { marchEquinox, decemberSolstice } = seasons(2026);
 * console.log(marchEquinox.toISOString(), decemberSolstice.toISOString());
 * ```
 */
export function seasons(year: number): SkySeasons {
  if (!Number.isInteger(year)) throw new RangeError(`year must be an integer, got ${String(year)}`);
  const found = Seasons(year);
  return { marchEquinox: found.mar_equinox.date, juneSolstice: found.jun_solstice.date, septemberEquinox: found.sep_equinox.date, decemberSolstice: found.dec_solstice.date };
}

/**
 * The four phases of the Moon's cycle: the Moon at ecliptic longitude 0, 90, 180 and 270 degrees from the Sun, seen from Earth.
 *
 * @experimental
 * @example
 * ```ts
 * import { type MoonPhaseName } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const phase: MoonPhaseName = "firstQuarter";
 * console.log(phase);
 * ```
 */
export type MoonPhaseName = "new" | "firstQuarter" | "full" | "lastQuarter";

const PHASES: readonly MoonPhaseName[] = ["new", "firstQuarter", "full", "lastQuarter"];

/**
 * One phase of the Moon at the moment it happens.
 *
 * @experimental
 * @example
 * ```ts
 * import { moonPhases, type MoonPhaseEvent } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const first: MoonPhaseEvent = moonPhases(Date.UTC(2026, 10, 1), Date.UTC(2026, 10, 30))[0]!;
 * console.log(first.phase, first.time.toISOString());
 * ```
 */
export interface MoonPhaseEvent {
  phase: MoonPhaseName;
  time: Date;
}

/**
 * Every new, first quarter, full and last quarter Moon from `from` (included) to `to` (not included), in order, as `Date`s. `from` and `to` are a `Date` or milliseconds; an end before the start throws a `RangeError`.
 *
 * @param from - The start of the interval, included.
 * @param to - The end of the interval, not included.
 * @returns The phases in time order; empty when the interval holds none.
 * @experimental
 * @example
 * ```ts
 * import { moonPhases } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const november = moonPhases(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1));
 * console.log(november.map((event) => `${event.phase} ${event.time.toISOString().slice(0, 10)}`).join(", "));
 * ```
 */
export function moonPhases(from: When, to: When): MoonPhaseEvent[] {
  const [start, end] = interval(from, to);
  const found: MoonPhaseEvent[] = [];
  for (let quarter = SearchMoonQuarter(new Date(start)); quarter.time.date.getTime() < end; quarter = NextMoonQuarter(quarter)) {
    found.push({ phase: PHASES[quarter.quarter]!, time: quarter.time.date });
  }
  return found;
}

/**
 * The next time the Moon is in `phase` at or after `from`, as a `Date`, or `null` when it does not happen within `within.days` (35 days when not given, which always holds one of each phase).
 *
 * @param from - Where to start looking, included.
 * @param options - `phase` is required; `within.days` bounds the search (a positive number).
 * @returns The moment, or `null` when none falls inside the window.
 * @experimental
 * @example
 * ```ts
 * import { nextMoonPhase } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const full = nextMoonPhase(Date.UTC(2026, 10, 7), { phase: "full" });
 * console.log(full?.toISOString());
 * ```
 */
export function nextMoonPhase(from: When, options: { phase: MoonPhaseName; within?: { days: number } }): Date | null {
  const start = moment(from, "from");
  const index = PHASES.indexOf(options.phase);
  if (index < 0) throw new RangeError(`phase must be one of ${PHASES.join(", ")}, got ${String(options.phase)}`);
  const days = options.within?.days ?? 35;
  if (!(days > 0) || !Number.isFinite(days)) throw new RangeError(`within.days must be a positive number, got ${String(days)}`);
  const found = SearchMoonPhase(index * 90, new Date(start), days);
  return found === null || found.date.getTime() >= start + days * DAY_MS ? null : found.date;
}

/** The eight looks of the Moon, in order from new, each one eighth of the cycle and centred on its mark. */
const LOOKS = ["new moon", "waxing crescent", "first quarter", "waxing gibbous", "full moon", "waning gibbous", "last quarter", "waning crescent"] as const;

/**
 * Japanese names from the National Astronomical Observatory's table of how the Moon looks (https://www.nao.ac.jp/faq/a0201.html): 新月, 三日月, 上弦, 満月, 下弦.
 * The same page gives no single name to the fat waxing Moon, the fat waning Moon, or the thin Moon lit on its eastern side (it says that last one has no special name). Those three are `null`, not a name made up here.
 * 十三夜 is one night, not the whole waxing gibbous, so it is not used (the Observatory's calendar wiki).
 */
const LOOKS_JA: readonly (string | null)[] = ["新月", "三日月", "上弦", null, "満月", null, "下弦", null];

/** Which of the eight looks the engine's phase angle falls in: 0 degrees is new, 90 first quarter, 180 full, 270 last quarter, each look 45 degrees wide and centred on its mark. */
function lookOf(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360;
  return Math.floor((wrapped + 22.5) / 45) % 8;
}

/**
 * The Moon's age: days since the previous new moon, 0 at that instant and about 29.5 at the next. The noon age the National Astronomical Observatory prints is this number at noon Japan time (03:00 UTC), rounded to one decimal.
 *
 * @param when - The moment, a `Date` or milliseconds.
 * @returns Days since the previous new moon.
 * @experimental
 * @example
 * ```ts
 * import { moonAge } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const noon = moonAge(Date.UTC(2026, 0, 19, 3, 0));
 * console.log(noon.toFixed(1));
 * ```
 */
export function moonAge(when: When): number {
  const at = moment(when, "when");
  const events = moonPhases(at - 40 * DAY_MS, at + 1);
  let previous = Number.NEGATIVE_INFINITY;
  for (const event of events) if (event.phase === "new" && event.time.getTime() <= at) previous = event.time.getTime();
  if (!Number.isFinite(previous)) throw new RangeError(`no new moon in the 40 days before ${new Date(at).toISOString()}`);
  return (at - previous) / DAY_MS;
}

/**
 * The name of the Moon's look at `when`. English is one of the eight looks (`"new moon"`, `"waxing crescent"`, `"first quarter"`, `"waxing gibbous"`, `"full moon"`, `"waning gibbous"`, `"last quarter"`, `"waning crescent"`).
 * Japanese is the Observatory's name for that look, or `null` when its table gives none. `"ja"` and `"en"` are the only languages.
 *
 * @param when - The moment, a `Date` or milliseconds.
 * @param lang - `"en"` or `"ja"`.
 * @returns The name, or `null` for a Japanese look the Observatory does not name.
 * @experimental
 * @example
 * ```ts
 * import { moonPhaseName } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const name = moonPhaseName(Date.UTC(2026, 0, 19, 3, 0), "ja");
 * console.log(name);
 * ```
 */
export function moonPhaseName(when: When, lang: "en" | "ja"): string | null {
  if (lang !== "en" && lang !== "ja") throw new RangeError(`lang must be en or ja, got ${String(lang)}`);
  const look = lookOf(MoonPhase(new Date(moment(when, "when"))));
  return lang === "en" ? LOOKS[look]! : (LOOKS_JA[look] ?? null);
}

/**
 * One eclipse of the Sun or the Moon: which, what kind, the moment of greatest eclipse (UT, as a `Date`) and, for a solar eclipse that has one, the fraction of the Sun's disc covered at that moment (`obscuration`, 0 to 1).
 * A lunar eclipse is `"penumbral"`, `"partial"` or `"total"` and has its umbral `magnitude`; a solar one `"partial"`, `"annular"` or `"total"` (astronomy-engine calls a hybrid eclipse by the kind at its greatest moment).
 *
 * @experimental
 * @example
 * ```ts
 * import { findEclipses, type SkyEclipse } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const first: SkyEclipse = findEclipses(Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1))[0]!;
 * console.log(first.type, first.kind, first.peak.toISOString());
 * ```
 */
export interface SkyEclipse {
  type: "solar" | "lunar";
  kind: "penumbral" | "partial" | "annular" | "total";
  peak: Date;
  obscuration?: number;
  /**
   * Lunar eclipses only: the umbral magnitude at greatest eclipse, as NASA's tables give it: the fraction of the Moon's diameter inside the Earth's umbra (0 when the Moon's edge only touches the umbra, 1 when the Moon's disc just fits in it, more than 1 for a deep total eclipse),
   * and negative for a penumbral eclipse, where the umbra misses the Moon. The umbra is the engine's: the Earth's radius with 88 km of atmosphere.
   */
  magnitude?: number;
}

/**
 * Every solar and lunar eclipse whose greatest moment falls from `from` (included) to `to` (not included), in time order. A solar eclipse is listed if it is seen anywhere on Earth. An end before the start throws a `RangeError`.
 *
 * @param from - The start of the interval, included.
 * @param to - The end of the interval, not included.
 * @returns The eclipses in time order; empty when the interval holds none.
 * @experimental
 * @example
 * ```ts
 * import { findEclipses } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * for (const eclipse of findEclipses(Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1))) console.log(eclipse.type, eclipse.kind, eclipse.peak.toISOString().slice(0, 10));
 * ```
 */
export function findEclipses(from: When, to: When): SkyEclipse[] {
  const [start, end] = interval(from, to);
  const found: SkyEclipse[] = [];
  // astronomy-engine searches from the full or new Moon after its start, which can fall just before an eclipse that peaks just after it: start a day early and keep what peaks inside the interval.
  for (let lunar = SearchLunarEclipse(new Date(start - DAY_MS)); lunar.peak.date.getTime() < end; lunar = NextLunarEclipse(lunar.peak)) {
    if (lunar.peak.date.getTime() < start) continue;
    found.push({ type: "lunar", kind: lunar.kind as SkyEclipse["kind"], peak: lunar.peak.date, magnitude: umbralMagnitude(lunar.peak) });
  }
  for (let solar = SearchGlobalSolarEclipse(new Date(start - DAY_MS)); solar.peak.date.getTime() < end; solar = NextGlobalSolarEclipse(solar.peak)) {
    if (solar.peak.date.getTime() < start) continue;
    found.push({ type: "solar", kind: solar.kind as SkyEclipse["kind"], peak: solar.peak.date, ...(solar.obscuration === undefined ? {} : { obscuration: solar.obscuration }) });
  }
  return found.sort((a, b) => a.peak.getTime() - b.peak.getTime());
}

// The engine's own shadow geometry (astronomy-engine does not export it): the radii it uses for the Sun, the Moon and the Earth's shadow-making disc (6371 km plus 88 km of atmosphere).
const SUN_RADIUS_KM = 695_700;
const MOON_MEAN_RADIUS_KM = 1737.4;
const EARTH_ECLIPSE_RADIUS_KM = 6371 + 88;

/** The umbral magnitude of a lunar eclipse at its greatest moment: how far into the Earth's umbra the Moon's far edge reaches, in Moon diameters. The umbra's radius at the Moon is `k`, the Moon's centre is `r` from the shadow axis. */
function umbralMagnitude(peak: AstroTime): number {
  const sun = GeoVector(Body.Sun, peak, true);
  const moon = GeoMoon(peak);
  const axis = { x: -sun.x, y: -sun.y, z: -sun.z };
  const u = (axis.x * moon.x + axis.y * moon.y + axis.z * moon.z) / (axis.x ** 2 + axis.y ** 2 + axis.z ** 2);
  const r = KM_PER_AU * Math.hypot(u * axis.x - moon.x, u * axis.y - moon.y, u * axis.z - moon.z);
  const k = SUN_RADIUS_KM - (1 + u) * (SUN_RADIUS_KM - EARTH_ECLIPSE_RADIUS_KM);
  return (k + MOON_MEAN_RADIUS_KM - r) / (2 * MOON_MEAN_RADIUS_KM);
}

const BODIES: Record<SkyBodyId, Body> = { sun: Body.Sun, moon: Body.Moon, mercury: Body.Mercury, venus: Body.Venus, mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn, uranus: Body.Uranus, neptune: Body.Neptune, pluto: Body.Pluto };

/** The engine's body for an id of this package, throwing a `RangeError` that names the ids there are. */
function bodyOf(id: SkyBodyId): Body {
  const body = Object.hasOwn(BODIES, id) ? BODIES[id] : undefined;
  if (body === undefined) throw new RangeError(`body must be one of ${Object.keys(BODIES).join(", ")}, got ${String(id)}`);
  return body;
}

/** The engine's observer for `{ latitude, longitude, heightM }` (degrees north, degrees east, metres above the ellipsoid, 0 when not given), throwing a `RangeError` with the value for anything out of range. */
function observerOf(observer: Observer): EngineObserver {
  if (typeof observer !== "object" || observer === null) throw new TypeError("observer must be { latitude, longitude, heightM }");
  const { latitude, longitude, heightM = 0 } = observer;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError(`latitude must be between -90 and 90 degrees, got ${String(latitude)}`);
  if (!Number.isFinite(longitude)) throw new RangeError(`longitude must be a finite number of degrees, got ${String(longitude)}`);
  if (!Number.isFinite(heightM)) throw new RangeError(`heightM must be a finite number of metres, got ${String(heightM)}`);
  return new EngineObserver(latitude, longitude, heightM);
}

/** The search window of `options.within` in days (2 when not given), throwing a `RangeError` for anything but a positive number. */
function windowDays(within: { days: number } | undefined): number {
  const days = within?.days ?? 2;
  if (!(days > 0) || !Number.isFinite(days)) throw new RangeError(`within.days must be a positive number, got ${String(days)}`);
  return days;
}

/**
 * The options of the rise, set and transit searches: where to stand and how far to look.
 *
 * @experimental
 * @example
 * ```ts
 * import { nextRise, type SkyHorizonOptions } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const options: SkyHorizonOptions = { observer: { latitude: 49.3, longitude: -123.1, heightM: 0 }, within: { days: 1 } };
 * console.log(nextRise("venus", Date.UTC(2026, 10, 8), options) instanceof Date);
 * ```
 */
export interface SkyHorizonOptions {
  /** Degrees north and east, metres above the ellipsoid (0 when not given). */
  observer: Observer;
  /** How far to look from `from`: `{ days }`, 2 when not given. The start is included and the end is not. */
  within?: { days: number };
}

/**
 * The next time a body rises for an observer, at or after `from`, as a `Date`, or `null` when it does not rise within `within.days` (2 when not given; at a pole, or for a body that stays up or down, there is none).
 * The Sun and the Moon rise when their upper limb touches a horizon lowered by 34 arc-minutes of refraction, the planets when their centre does; the height of the observer lowers it further.
 *
 * @param body - A body of this package: the Sun, the Moon or a planet (`"mars"`).
 * @param from - Where to start looking, included (an event within a quarter of a second before it counts as at it: the search settles to about 0.1 s).
 * @param options - The observer, and how far to look.
 * @returns The moment, or `null` when there is none inside the window.
 * @experimental
 * @example
 * ```ts
 * import { nextRise } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const tokyo = { latitude: 35.6895, longitude: 139.6917, heightM: 0 };
 * console.log(nextRise("mars", Date.UTC(2026, 10, 8), { observer: tokyo })?.toISOString());
 * ```
 */
export function nextRise(body: SkyBodyId, from: When, options: SkyHorizonOptions): Date | null {
  return riseOrSet(body, from, options, 1);
}

/**
 * The next time a body sets for an observer, at or after `from`, as a `Date`, or `null` when it does not set within `within.days` (2 when not given). The horizon is the same as for `nextRise`.
 *
 * @param body - A body of this package: the Sun, the Moon or a planet.
 * @param from - Where to start looking, included.
 * @param options - The observer, and how far to look.
 * @returns The moment, or `null` when there is none inside the window.
 * @experimental
 * @example
 * ```ts
 * import { nextSet } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const tokyo = { latitude: 35.6895, longitude: 139.6917, heightM: 0 };
 * console.log(nextSet("venus", Date.UTC(2026, 10, 8), { observer: tokyo })?.toISOString());
 * ```
 */
export function nextSet(body: SkyBodyId, from: When, options: SkyHorizonOptions): Date | null {
  return riseOrSet(body, from, options, -1);
}

function riseOrSet(body: SkyBodyId, from: When, options: SkyHorizonOptions, direction: 1 | -1): Date | null {
  const start = moment(from, "from");
  const engineBody = bodyOf(body);
  const observer = observerOf(options.observer);
  const days = windowDays(options.within);
  const found = atOrAfter(start, (at) => SearchRiseSet(engineBody, observer, direction, at, days + 1 / 86_400)?.date ?? null);
  return found !== null && found.getTime() < start + days * DAY_MS ? found : null;
}

/** The engine's searches settle to within about 0.1 second (measured: a rise of Mars comes out 37 and 91 ms from the same event for two starts), so an event this close before `start` counts as at `start`. */
const SEARCH_SLACK_MS = 250;

/** The first moment of a search at or after `start`: the engine finds events after its start, so look from a second earlier and, if that finds one before `start` by more than the search's slack, look again from `start`. */
function atOrAfter(start: number, find: (from: Date) => Date | null): Date | null {
  const early = find(new Date(start - 1000));
  return early !== null && early.getTime() < start - SEARCH_SLACK_MS ? find(new Date(start)) : early;
}

/**
 * The next time a body crosses the observer's meridian (its highest point in the sky, hour angle 0), at or after `from`, as a `Date`, or `null` when it does not within `within.days` (2 when not given).
 *
 * @param body - A body of this package: the Sun, the Moon or a planet.
 * @param from - Where to start looking, included.
 * @param options - The observer, and how far to look.
 * @returns The moment, or `null` when there is none inside the window.
 * @experimental
 * @example
 * ```ts
 * import { nextTransit } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const tokyo = { latitude: 35.6895, longitude: 139.6917, heightM: 0 };
 * console.log(nextTransit("jupiter", Date.UTC(2026, 10, 8), { observer: tokyo })?.toISOString());
 * ```
 */
export function nextTransit(body: SkyBodyId, from: When, options: SkyHorizonOptions): Date | null {
  const start = moment(from, "from");
  const engineBody = bodyOf(body);
  const observer = observerOf(options.observer);
  const days = windowDays(options.within);
  const found = atOrAfter(start, (at) => SearchHourAngle(engineBody, observer, 0, at).time.date)!;
  return found.getTime() < start + days * DAY_MS ? found : null;
}

/**
 * The Moon's libration: how far the Moon's disc is turned from its mean Earth-facing position, as seen from the centre of the Earth, with the Moon's distance and size. `longitude` is the libration in longitude (positive when the Moon's east limb is turned toward Earth) and `latitude` the libration in latitude (positive
 * when its north pole is tipped toward Earth), both in degrees, as astronomy-engine gives them (optical libration; the physical libration of up to 0.04 degrees is not added).
 *
 * @experimental
 * @example
 * ```ts
 * import { moonLibration, type MoonLibration } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const l: MoonLibration = moonLibration(Date.UTC(2026, 10, 7, 12));
 * console.log(Math.abs(l.longitude) < 8, Math.abs(l.latitude) < 7, l.distanceKm > 356000);
 * ```
 */
export interface MoonLibration {
  longitude: number;
  latitude: number;
  distanceKm: number;
  angularDiameter: number;
}

/**
 * The Moon's libration at a moment, as seen from the centre of the Earth.
 *
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns The libration in longitude and latitude, the Moon's distance in kilometres and its angular diameter in degrees.
 * @experimental
 * @example
 * ```ts
 * import { moonLibration } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const { longitude, latitude } = moonLibration(Date.UTC(2026, 10, 7, 12));
 * console.log(longitude.toFixed(1), latitude.toFixed(1));
 * ```
 */
export function moonLibration(when: When): MoonLibration {
  const found = Libration(new Date(moment(when, "when")));
  return { longitude: found.elon, latitude: found.elat, distanceKm: found.dist_km, angularDiameter: found.diam_deg };
}

/**
 * One closest or farthest point of the Moon's orbit: the kind, the moment and the distance between the centres of the Earth and the Moon.
 *
 * @experimental
 * @example
 * ```ts
 * import { lunarApsides, type LunarApsis } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const first: LunarApsis = lunarApsides(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1))[0]!;
 * console.log(first.kind, Math.round(first.distanceKm));
 * ```
 */
export interface LunarApsis {
  kind: "perigee" | "apogee";
  time: Date;
  distanceKm: number;
}

/**
 * Every perigee and apogee of the Moon from `from` (included; the search settles to about 0.1 s, so one within a quarter of a second before it counts) to `to` (not included), in time order. An end before the start throws a `RangeError`.
 *
 * @param from - The start of the interval, included.
 * @param to - The end of the interval, not included.
 * @returns The apsides in time order; empty when the interval holds none.
 * @experimental
 * @example
 * ```ts
 * import { lunarApsides } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * for (const apsis of lunarApsides(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1))) console.log(apsis.kind, apsis.time.toISOString(), Math.round(apsis.distanceKm));
 * ```
 */
export function lunarApsides(from: When, to: When): LunarApsis[] {
  const [start, end] = interval(from, to);
  const found: LunarApsis[] = [];
  for (let apsis = SearchLunarApsis(new Date(start - DAY_MS)); apsis.time.date.getTime() < end; apsis = NextLunarApsis(apsis)) {
    if (apsis.time.date.getTime() >= start - SEARCH_SLACK_MS) found.push({ kind: apsis.kind === ApsisKind.Pericenter ? "perigee" : "apogee", time: apsis.time.date, distanceKm: apsis.dist_km });
  }
  return found;
}

/**
 * One crossing of the ecliptic by the Moon's centre: going north (`"ascending"`) or south (`"descending"`).
 *
 * @experimental
 * @example
 * ```ts
 * import { lunarNodes, type LunarNode } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const first: LunarNode = lunarNodes(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1))[0]!;
 * console.log(first.kind, first.time.toISOString());
 * ```
 */
export interface LunarNode {
  kind: "ascending" | "descending";
  time: Date;
}

/**
 * Every time the Moon's centre crosses the ecliptic plane from `from` (included; the search settles to about 0.1 s, so one within a quarter of a second before it counts) to `to` (not included), in time order. An end before the start throws a `RangeError`.
 *
 * @param from - The start of the interval, included.
 * @param to - The end of the interval, not included.
 * @returns The crossings in time order; empty when the interval holds none.
 * @experimental
 * @example
 * ```ts
 * import { lunarNodes } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * for (const node of lunarNodes(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1))) console.log(node.kind, node.time.toISOString());
 * ```
 */
export function lunarNodes(from: When, to: When): LunarNode[] {
  const [start, end] = interval(from, to);
  const found: LunarNode[] = [];
  for (let node = SearchMoonNode(new Date(start - DAY_MS)); node.time.date.getTime() < end; node = NextMoonNode(node)) {
    if (node.time.date.getTime() >= start - SEARCH_SLACK_MS) found.push({ kind: node.kind === NodeEventKind.Ascending ? "ascending" : "descending", time: node.time.date });
  }
  return found;
}

/**
 * The greatest elongation of Mercury or Venus: the moment, the angle between the planet and the Sun as seen from Earth in degrees, and which side of the Sun it is on (`"east"`: an evening star, `"west"`: a morning star).
 *
 * @experimental
 * @example
 * ```ts
 * import { nextGreatestElongation, type GreatestElongation } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const e: GreatestElongation = nextGreatestElongation("venus", Date.UTC(2026, 0, 1));
 * console.log(e.side, e.elongation.toFixed(0));
 * ```
 */
export interface GreatestElongation {
  time: Date;
  elongation: number;
  side: "east" | "west";
}

/**
 * The next greatest elongation of Mercury or Venus after `from`. Any other body throws a `RangeError` (a body outside Earth's orbit has no greatest elongation).
 *
 * @param body - `"mercury"` or `"venus"`.
 * @param from - Where to start looking.
 * @returns The moment, the elongation in degrees and the side of the Sun.
 * @experimental
 * @example
 * ```ts
 * import { nextGreatestElongation } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const mercury = nextGreatestElongation("mercury", Date.UTC(2026, 0, 1));
 * console.log(mercury.time.toISOString(), mercury.side);
 * ```
 */
export function nextGreatestElongation(body: "mercury" | "venus", from: When): GreatestElongation {
  const start = moment(from, "from");
  if (body !== "mercury" && body !== "venus") throw new RangeError(`body must be mercury or venus, got ${String(body)}`);
  const found = SearchMaxElongation(bodyOf(body), new Date(start));
  return { time: found.time.date, elongation: found.elongation, side: found.visibility === "evening" ? "east" : "west" };
}

/**
 * The day's rise, transit and set of a body for an observer, over one calendar day of a time zone. `horizon` says what a missing rise or set means: `"crosses"` when the body rises or sets that day, `"above"` when it stays above the horizon all day and `"below"` when it stays below.
 *
 * @experimental
 * @example
 * ```ts
 * import { riseSetTimes, type SkyRiseSet } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const day: SkyRiseSet = riseSetTimes("sun", Date.UTC(2026, 5, 21), { observer: { latitude: 89, longitude: 0 }, timeZone: "UTC" });
 * console.log(day.horizon, day.rise, day.set);
 * ```
 */
export interface SkyRiseSet {
  /** The first rise inside the day, or `null` when there is none. */
  rise: Date | null;
  /** The first meridian crossing inside the day, or `null` when there is none. */
  transit: Date | null;
  /** The first set inside the day, or `null` when there is none. */
  set: Date | null;
  /** `"crosses"` when the body rises or sets inside the day; otherwise `"above"` or `"below"`, by the body's height at the middle of the day. */
  horizon: "crosses" | "above" | "below";
}

/**
 * The options of `riseSetTimes`: where to stand and which time zone's calendar day to take.
 *
 * @experimental
 * @example
 * ```ts
 * import { riseSetTimes, type SkyRiseSetOptions } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const options: SkyRiseSetOptions = { observer: { latitude: 35.6895, longitude: 139.6917 }, timeZone: "Asia/Tokyo" };
 * console.log(riseSetTimes("moon", Date.UTC(2026, 10, 8), options).horizon);
 * ```
 */
export interface SkyRiseSetOptions {
  /** Degrees north and east, metres above the ellipsoid (0 when not given). */
  observer: Observer;
  /** An IANA time zone name (`"Asia/Tokyo"`, `"America/New_York"`, `"UTC"`). Required: a calendar day has no meaning without one. */
  timeZone: string;
}

const ZONE_FORMATS = new Map<string, Intl.DateTimeFormat>();

/** The offset of a time zone from UTC at a moment, in milliseconds (positive east of Greenwich). */
function zoneOffsetMs(timeZone: string, at: number): number {
  let format = ZONE_FORMATS.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    ZONE_FORMATS.set(timeZone, format);
  }
  const parts = format.formatToParts(new Date(at));
  const get = (type: string): number => Number(parts.find((part) => part.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(at / 1000) * 1000;
}

/** The local calendar date of a moment in a zone as one number (year, month, day), to compare days. */
function dayKey(timeZone: string, at: number): number {
  const local = new Date(at + zoneOffsetMs(timeZone, at));
  return local.getUTCFullYear() * 10_000 + (local.getUTCMonth() + 1) * 100 + local.getUTCDate();
}

/** The first moment (to the second) of the local calendar day with key `key` in a zone, found by halving, which also gives the right answer where a clock change skips midnight. `near` is any moment within a day and a half of it. */
function dayStart(timeZone: string, key: number, near: number): number {
  let low = Math.floor(near / 1000) * 1000 - 36 * 3_600_000, high = low + 72 * 3_600_000;
  while (high - low > 1000) {
    const middle = low + Math.floor((high - low) / 2000) * 1000;
    if (dayKey(timeZone, middle) < key) low = middle; else high = middle;
  }
  return high;
}

/** The first moment of the calendar day of a zone that holds `at`, and of the day after it, as milliseconds: 23, 24 or 25 hours apart, and 24 hours apart on all but the days when the clocks change. */
function calendarDay(timeZone: string, at: number): [number, number] {
  const local = new Date(at + zoneOffsetMs(timeZone, at));
  const next = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1));
  const nextKey = next.getUTCFullYear() * 10_000 + (next.getUTCMonth() + 1) * 100 + next.getUTCDate();
  return [dayStart(timeZone, dayKey(timeZone, at), at - 12 * 3_600_000), dayStart(timeZone, nextKey, at + 12 * 3_600_000)];
}

/**
 * The rise, meridian crossing and set of a body over one calendar day of a time zone, for an observer. `date` is any moment of the day wanted (a `Date` or milliseconds); the day is the one in `timeZone` that holds it, from local midnight to the next, so a day
 * when the clocks change is 23 or 25 hours long. `timeZone` is required: a missing, empty or unknown name throws a `RangeError` naming it. The horizon is `nextRise`'s. An event is `null` when it does not happen inside the day (the Moon has no rise on one day in about 29), and
 * `horizon` tells a body that is up all day (`"above"`, the Sun at a pole in midsummer) or down all day (`"below"`) from one that crosses the horizon.
 *
 * @param body - A body of this package: the Sun, the Moon or a planet.
 * @param date - Any moment inside the day wanted.
 * @param options - The observer and the IANA time zone.
 * @returns The three events as `Date`s or `null`, and the horizon state.
 * @experimental
 * @example
 * ```ts
 * import { riseSetTimes } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * // Sunrise and sunset in New York on 1 November 2026, the day the clocks go back (a 25-hour day).
 * const day = riseSetTimes("sun", Date.UTC(2026, 10, 1, 12), { observer: { latitude: 40.7128, longitude: -74.006 }, timeZone: "America/New_York" });
 * console.log(day.rise?.toISOString(), day.set?.toISOString(), day.horizon);
 * ```
 */
export function riseSetTimes(body: SkyBodyId, date: When, options: SkyRiseSetOptions): SkyRiseSet {
  const at = moment(date, "date");
  const engineBody = bodyOf(body);
  const observer = observerOf(options.observer);
  const timeZone = options.timeZone;
  if (typeof timeZone !== "string" || timeZone === "") throw new RangeError(`timeZone is required, an IANA name such as "Asia/Tokyo" or "UTC", got ${String(timeZone)}`);
  try { new Intl.DateTimeFormat("en-US", { timeZone }); } catch { throw new RangeError(`timeZone must be an IANA time zone name such as "Asia/Tokyo", got ${timeZone}`); }
  const [start, end] = calendarDay(timeZone, at);
  const within = { days: (end - start) / DAY_MS };
  const inside = (found: Date | null): Date | null => (found !== null && found.getTime() < end ? found : null);
  const rise = inside(nextRise(body, start, { observer: options.observer, within }));
  const set = inside(nextSet(body, start, { observer: options.observer, within }));
  const transit = inside(nextTransit(body, start, { observer: options.observer, within }));
  if (rise !== null || set !== null) return { rise, transit, set, horizon: "crosses" };
  const middle = new Date((start + end) / 2);
  const equator = Equator(engineBody, middle, observer, true, true);
  return { rise, transit, set, horizon: Horizon(middle, observer, equator.ra, equator.dec, "normal").altitude > 0 ? "above" : "below" };
}

/**
 * Which alignment of a body with the Sun, by ecliptic longitude as seen from the Earth: `"conjunction"` (same longitude), `"opposition"` (180 degrees apart) or `"quadrature"` (90 degrees, east or west). Not the closest approach of two bodies in the sky, which `/nearest` finds.
 *
 * @experimental
 * @example
 * ```ts
 * import { type AlignmentKind } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const kind: AlignmentKind = "opposition";
 * console.log(kind);
 * ```
 */
export type AlignmentKind = "conjunction" | "opposition" | "quadrature";

/**
 * One alignment of a body with the Sun by ecliptic longitude.
 *
 * @experimental
 * @example
 * ```ts
 * import { nextAlignment, type SkyAlignment } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const a: SkyAlignment | null = nextAlignment("mars", Date.UTC(2026, 0, 1), { kind: "opposition" });
 * console.log(a?.time.toISOString(), a?.side, a?.inferior);
 * ```
 */
export interface SkyAlignment {
  time: Date;
  kind: AlignmentKind;
  /** For a quadrature: `"east"` when the body is 90 degrees east of the Sun (an evening sight), `"west"` when 90 degrees west; `null` for the others. */
  side: "east" | "west" | null;
  /** For a conjunction of Mercury or Venus: `true` when the planet passes between the Earth and the Sun (inferior), `false` when it passes behind the Sun (superior); `null` otherwise. */
  inferior: boolean | null;
}

/** How far the longitude of a body is east of the Sun's, as seen from the Earth, from `target` degrees, taken to the interval from -180 up to 180. The longitudes are apparent (light time and aberration included, as the Astronomical Almanac and Horizons give them), which moves an opposition by about 15 minutes from the geometric one. */
function offsetFrom(body: Body, target: number, at: FlexibleDateTime): number {
  const diff = Ecliptic(GeoVector(body, at, true)).elon - Ecliptic(GeoVector(Body.Sun, at, true)).elon - target;
  return diff - 360 * Math.round(diff / 360);
}

/**
 * The next time a body is in conjunction with the Sun, opposite it or at quadrature, by ecliptic longitude as seen from the Earth (the longitudes of the body and the Sun differ by 0, 180 or 90 or 270 degrees, the apparent ones, as the Astronomical Almanac and Horizons give them), at or after `from` (an event within a quarter of a second before it counts as at it), or `null` when none falls inside `within.days`
 * (850 days when not given, enough for the slowest planet's cycle). It is the longitude alignment, which is why it is named so: it is not the closest approach of two bodies in the sky (`/nearest`). A planet at opposition is on the meridian at midnight, and its time is not quite
 * that of its closest approach to the Earth or its brightest moment.
 * Mercury and Venus have conjunctions only (inferior and superior, told apart by `inferior`); asking either for an opposition or a quadrature, or asking for the Sun, throws a `RangeError`, since they never happen. For the Moon, a conjunction is the new Moon, an opposition the full Moon and a quadrature a first or last quarter.
 *
 * @param body - A body of this package except the Sun.
 * @param from - Where to start looking, included.
 * @param options - `kind` is required; `within.days` bounds the search (a positive number).
 * @returns The moment with the kind, or `null` when none falls inside the window.
 * @experimental
 * @example
 * ```ts
 * import { nextAlignment } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const opposition = nextAlignment("jupiter", Date.UTC(2026, 0, 1), { kind: "opposition" });
 * console.log(opposition?.time.toISOString());
 * ```
 */
export function nextAlignment(body: SkyBodyId, from: When, options: { kind: AlignmentKind; within?: { days: number } }): SkyAlignment | null {
  const start = moment(from, "from");
  const engineBody = bodyOf(body);
  const { kind } = options;
  if (kind !== "conjunction" && kind !== "opposition" && kind !== "quadrature") throw new RangeError(`kind must be conjunction, opposition or quadrature, got ${String(kind)}`);
  if (body === "sun") throw new RangeError("body must not be the sun: an alignment is with the Sun");
  const inner = body === "mercury" || body === "venus";
  if (inner && kind !== "conjunction") throw new RangeError(`${body} has no ${kind} (it never gets that far from the Sun); only conjunction`);
  const days = options.within?.days ?? 850;
  if (!(days > 0) || !Number.isFinite(days)) throw new RangeError(`within.days must be a positive number, got ${String(days)}`);
  const targets = kind === "conjunction" ? [0] : kind === "opposition" ? [180] : [90, 270];
  // Walk a day at a time and take the first change of sign of the offset from a target, then settle it with the engine's search (to a second).
  const step = 1;
  const t0 = new Date(start);
  for (const target of targets) if (offsetFrom(engineBody, target, t0) === 0) return alignment(engineBody, kind, target, t0);
  let before = targets.map((target) => offsetFrom(engineBody, target, t0));
  for (let day = step; day <= days + step; day += step) {
    const t = new Date(start + day * DAY_MS);
    const now = targets.map((target) => offsetFrom(engineBody, target, MakeTime(t)));
    for (let i = 0; i < targets.length; i += 1) {
      const a = before[i]!, b = now[i]!;
      if (Math.abs(a) < 90 && Math.abs(b) < 90 && (a < 0) !== (b < 0)) {
        const sign = a < 0 ? 1 : -1;
        const root = Search((time) => sign * offsetFrom(engineBody, targets[i]!, time), MakeTime(new Date(start + (day - step) * DAY_MS)), MakeTime(t), { dt_tolerance_seconds: 0.1 });
        const found = root?.date ?? null;
        return found !== null && found.getTime() < start + days * DAY_MS ? alignment(engineBody, kind, targets[i]!, found) : null;
      }
    }
    before = now;
  }
  return null;
}

function alignment(body: Body, kind: AlignmentKind, target: number, time: Date): SkyAlignment {
  const inner = body === Body.Mercury || body === Body.Venus;
  return { time, kind, side: kind === "quadrature" ? (target === 90 ? "east" : "west") : null, inferior: inner ? GeoVector(body, time, true).Length() < GeoVector(Body.Sun, time, true).Length() : null };
}

/**
 * The brightest the planet gets, and when.
 *
 * @experimental
 * @example
 * ```ts
 * import { nextPeakMagnitude, type PeakMagnitude } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const peak: PeakMagnitude = nextPeakMagnitude("venus", Date.UTC(2026, 0, 1));
 * console.log(peak.time.toISOString(), peak.magnitude.toFixed(2));
 * ```
 */
export interface PeakMagnitude {
  time: Date;
  /** The visual magnitude at that moment (a more negative number is brighter). */
  magnitude: number;
}

/**
 * The next time Venus is at its brightest as seen from the Earth, after `from`: the moment and its magnitude. Only Venus is supported, because astronomy-engine supports only Venus: Mercury's brightest moment is at superior conjunction, when it cannot be seen, and any other body throws a `RangeError`
 * that says where to look. The other planets are brightest very near their opposition (`nextAlignment`), and the Moon near the full Moon (`nextMoonPhase`); their magnitudes at any moment are in `skyBody()`.
 *
 * @param body - `"venus"`.
 * @param from - Where to start looking.
 * @returns The moment and the magnitude.
 * @experimental
 * @example
 * ```ts
 * import { nextPeakMagnitude } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const { time, magnitude } = nextPeakMagnitude("venus", Date.UTC(2026, 0, 1));
 * console.log(time.toISOString(), magnitude.toFixed(2));
 * ```
 */
export function nextPeakMagnitude(body: "venus", from: When): PeakMagnitude {
  const start = moment(from, "from");
  if (body !== "venus") throw new RangeError(`nextPeakMagnitude supports venus only (astronomy-engine finds no other body's peak), got ${String(body)}; the outer planets are brightest near nextAlignment(..., { kind: "opposition" }) and the Moon near nextMoonPhase(..., { phase: "full" })`);
  const found = SearchPeakMagnitude(Body.Venus, new Date(start));
  return { time: found.time.date, magnitude: found.mag };
}

/**
 * One moment of a local solar eclipse: when, and how high the Sun's centre stands then (degrees above the horizon, negative below it; the Sun's centre, with the refraction of the standard atmosphere as astronomy-engine applies it).
 *
 * @experimental
 * @example
 * ```ts
 * import { type EclipseContact } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const contact: EclipseContact = { time: new Date(0), altitude: 12 };
 * console.log(contact.altitude > 0 ? "Sun up" : "Sun down");
 * ```
 */
export interface EclipseContact {
  time: Date;
  altitude: number;
}

/**
 * A solar eclipse as one observer sees it. The contacts are NASA's: `partialBegin` is the first contact (C1), `centralBegin` the second (C2, totality or the ring begins), `peak` the greatest eclipse, `centralEnd` the third (C3) and `partialEnd` the fourth (C4).
 * A partial eclipse has no `centralBegin` or `centralEnd`. Any of them can fall with the Sun below the horizon: read the altitude.
 *
 * @experimental
 * @example
 * ```ts
 * import { localSolarEclipse, type LocalSolarEclipse } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const e: LocalSolarEclipse | null = localSolarEclipse(Date.UTC(2026, 0, 1), { observer: { latitude: 41.7, longitude: -2.5 } });
 * console.log(e?.kind, e?.peak.time.toISOString(), e?.peak.altitude.toFixed(1));
 * ```
 */
export interface LocalSolarEclipse {
  kind: "partial" | "annular" | "total";
  /** The fraction of the Sun's disc covered at the peak, 0 to 1 (exactly 1 for a total eclipse). */
  obscuration: number;
  partialBegin: EclipseContact;
  centralBegin: EclipseContact | null;
  peak: EclipseContact;
  centralEnd: EclipseContact | null;
  partialEnd: EclipseContact;
}

/**
 * The next solar eclipse an observer can see at least partly in the sky's geometry (the Sun may be below the horizon for part of it, or all of it: read the altitudes), at or after `from`, with the times of its contacts and the Sun's altitude at each. `null` when none falls
 * inside `within.days` (1826 days, five years, when not given). The altitude is the Sun's centre with standard refraction, and the contacts are for the observer's height.
 *
 * @param from - Where to start looking, included (an eclipse whose greatest moment is before it is not found).
 * @param options - The observer (degrees north and east, metres), and `within.days`.
 * @returns The eclipse or `null`.
 * @experimental
 * @example
 * ```ts
 * import { localSolarEclipse } from "@johnmorrisdotca/wakusei-planets/sky";
 *
 * const eclipse = localSolarEclipse(Date.UTC(2026, 6, 1), { observer: { latitude: 41.6, longitude: -4.7, heightM: 700 } });
 * console.log(eclipse?.kind, eclipse?.partialBegin.time.toISOString(), eclipse?.partialEnd.time.toISOString());
 * ```
 */
export function localSolarEclipse(from: When, options: { observer: Observer; within?: { days: number } }): LocalSolarEclipse | null {
  const start = moment(from, "from");
  const observer = observerOf(options.observer);
  const days = options.within?.days ?? 1826;
  if (!(days > 0) || !Number.isFinite(days)) throw new RangeError(`within.days must be a positive number, got ${String(days)}`);
  const contact = (event: EclipseEvent | undefined): EclipseContact | null => (event === undefined ? null : { time: event.time.date, altitude: event.altitude });
  // The engine finds the first eclipse whose greatest moment is after its start: look from a day early and drop one that peaked before `from`.
  let found = SearchLocalSolarEclipse(new Date(start - DAY_MS), observer);
  while (found.peak.time.date.getTime() < start) found = SearchLocalSolarEclipse(found.peak.time.AddDays(1), observer);
  if (found.peak.time.date.getTime() >= start + days * DAY_MS) return null;
  return { kind: found.kind as LocalSolarEclipse["kind"], obscuration: found.obscuration, partialBegin: contact(found.partial_begin)!, centralBegin: contact(found.total_begin), peak: contact(found.peak)!, centralEnd: contact(found.total_end), partialEnd: contact(found.partial_end)! };
}
