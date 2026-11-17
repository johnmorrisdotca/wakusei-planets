// Sky events (equinoxes and solstices today; more to come) through astronomy-engine, an OPTIONAL peer dependency: `pnpm add astronomy-engine` (2.1.19 or newer, below 3) beside this package.
// This is the only file under src/ that imports it, so the core, /suncalc and /sky-bodies never reach it (test/sky-events.test.ts holds that). A page that never imports `/sky` never needs the peer.
// A missing peer cannot be caught here: a static import fails before any code runs, with the runtime's own "cannot find package astronomy-engine", which names it. (A top-level await would let this file word its own error, but
// the package's size measure and any ES2020 bundler refuse top-level await; see the CHANGELOG, "default, for John to confirm".) Everything is experimental during 0.x. Pure: no DOM, no clock read, no three.js.
import { Seasons } from "astronomy-engine";

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
