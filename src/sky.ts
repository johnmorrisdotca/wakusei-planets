// Sky events (equinoxes and solstices today; more to come) through astronomy-engine, an OPTIONAL peer dependency: `pnpm add astronomy-engine` (2.1.19 or newer, below 3) beside this package.
// This is the only file under src/ that imports it, so the core, /suncalc and /sky-bodies never reach it (test/sky-events.test.ts holds that). A page that never imports `/sky` never needs the peer.
// A missing peer cannot be caught here: a static import fails before any code runs, with the runtime's own "cannot find package astronomy-engine", which names it. (A top-level await would let this file word its own error, but
// the package's size measure and any ES2020 bundler refuse top-level await; see the CHANGELOG, "default, for John to confirm".) Everything is experimental during 0.x. Pure: no DOM, no clock read, no three.js.
import { NextMoonQuarter, SearchMoonPhase, SearchMoonQuarter, Seasons } from "astronomy-engine";
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
