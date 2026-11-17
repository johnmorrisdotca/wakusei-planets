// Sky events (seasons, Moon phases, eclipses, rise/set/transit, libration, lunar apsides and nodes, greatest elongation) through astronomy-engine, an OPTIONAL peer dependency: `pnpm add astronomy-engine` (2.1.19 or newer, below 3) beside this package.
// This is the only file under src/ that imports it, so the core, /suncalc and /sky-bodies never reach it (test/sky-events.test.ts holds that). A page that never imports `/sky` never needs the peer.
// A missing peer cannot be caught here: a static import fails before any code runs, with the runtime's own "cannot find package astronomy-engine", which names it. (A top-level await would let this file word its own error, but
// the package's size measure and any ES2020 bundler refuse top-level await; see the CHANGELOG, "default, for John to confirm".) Everything is experimental during 0.x. Pure: no DOM, no clock read, no three.js.
import { ApsisKind, Body, Libration, NextGlobalSolarEclipse, NextLunarApsis, NextLunarEclipse, NextMoonNode, NextMoonQuarter, NodeEventKind, Observer as EngineObserver, SearchGlobalSolarEclipse, SearchHourAngle, SearchLunarApsis, SearchLunarEclipse, SearchMaxElongation, SearchMoonNode, SearchMoonPhase, SearchMoonQuarter, SearchRiseSet, Seasons } from "astronomy-engine";
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

/**
 * One eclipse of the Sun or the Moon: which, what kind, the moment of greatest eclipse (UT, as a `Date`) and, for a solar eclipse that has one, the fraction of the Sun's disc covered at that moment (`obscuration`, 0 to 1).
 * A lunar eclipse is `"penumbral"`, `"partial"` or `"total"`; a solar one `"partial"`, `"annular"` or `"total"` (astronomy-engine calls a hybrid eclipse by the kind at its greatest moment).
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
    found.push({ type: "lunar", kind: lunar.kind as SkyEclipse["kind"], peak: lunar.peak.date, obscuration: undefined });
  }
  for (let solar = SearchGlobalSolarEclipse(new Date(start - DAY_MS)); solar.peak.date.getTime() < end; solar = NextGlobalSolarEclipse(solar.peak)) {
    if (solar.peak.date.getTime() < start) continue;
    found.push({ type: "solar", kind: solar.kind as SkyEclipse["kind"], peak: solar.peak.date, ...(solar.obscuration === undefined ? {} : { obscuration: solar.obscuration }) });
  }
  return found.sort((a, b) => a.peak.getTime() - b.peak.getTime()).map(({ obscuration, ...rest }) => (obscuration === undefined ? rest : { ...rest, obscuration }));
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
