// The moon theories a page has loaded, one table for the whole page on `globalThis` (a CDN's bundler gives each entry point its own copy of a file, and the copies must still share them).
// `@johnmorrisdotca/wakusei-planets/tables` and its parts register theories; `moonVector` uses a moon's theory when one is registered and its fitted orbit otherwise.
import type { Series } from "./vsop.ts";
import type { Vec3 } from "../vec.ts";

/** A moon's position from its planet's centre in the J2000 ecliptic, in kilometres, at a moment in terrestrial time (milliseconds since 1970). */
export type MoonTheory = (terrestrialMs: number) => Vec3;

const KEY = Symbol.for("johnmorrisdotca.wakusei-planets.moon-theories");
const SERIES_KEY = Symbol.for("johnmorrisdotca.wakusei-planets.planet-series");
const planetSeries = ((globalThis as Record<symbol, unknown>)[SERIES_KEY] ??= new Map<string, Series>()) as Map<string, Series>;
const theories = ((globalThis as Record<symbol, unknown>)[KEY] ??= new Map<string, MoonTheory>()) as Map<string, MoonTheory>;

/**
 * Teach `moonVector` a moon's theory. The entry points under `@johnmorrisdotca/wakusei-planets/tables` call this as they load.
 *
 * @param id - The moon's name.
 * @param theory - Its position from the planet's centre at a moment in terrestrial time.
 * @returns The theory, as it was given.
 *
 * @example
 * ```ts
 * import { moonTheoryOf, registerMoonTheory } from "@johnmorrisdotca/wakusei-planets/tables";
 *
 * registerMoonTheory("test-moon", () => [1, 0, 0]);
 * console.log(moonTheoryOf("test-moon")?.(0)[0]);
 * ```
 */
export function registerMoonTheory(id: string, theory: MoonTheory): MoonTheory {
  theories.set(id, theory);
  return theory;
}

/**
 * The theory registered for a moon, or `undefined` when its entry point has not been imported.
 *
 * @param id - The moon's name.
 * @returns The registered theory, or `undefined`.
 *
 * @example
 * ```ts
 * import { moonTheoryOf } from "@johnmorrisdotca/wakusei-planets/tables";
 *
 * console.log(moonTheoryOf("titan") === undefined || typeof moonTheoryOf("titan") === "function");
 * ```
 */
export const moonTheoryOf = (id: string): MoonTheory | undefined => theories.get(id);

/**
 * Teach `heliocentric` a finer VSOP87B series for a planet, used in place of the small one in the package. The entry point `@johnmorrisdotca/wakusei-planets/tables/vsop` calls this for Mercury to Neptune.
 *
 * @param id - The planet's name.
 * @param series - Its longitude, latitude and radius series, as `scripts/make-vsop-data.py fine` writes them.
 * @returns The series, as it was given.
 *
 * @example
 * ```ts
 * import { planetSeriesOf, registerPlanetSeries } from "@johnmorrisdotca/wakusei-planets/tables";
 *
 * registerPlanetSeries("test-planet", [[[[1, 0, 0]]], [[]], [[[1, 0, 0]]]]);
 * console.log(planetSeriesOf("test-planet") !== undefined);
 * ```
 */
export function registerPlanetSeries(id: string, series: Series): Series {
  planetSeries.set(id, series);
  return series;
}

/**
 * The finer series registered for a planet, or `undefined` when `tables/vsop` has not been imported.
 *
 * @param id - The planet's name.
 * @returns The registered series, or `undefined`.
 *
 * @example
 * ```ts
 * import { planetSeriesOf } from "@johnmorrisdotca/wakusei-planets/tables";
 *
 * console.log(planetSeriesOf("earth") === undefined || Array.isArray(planetSeriesOf("earth")));
 * ```
 */
export const planetSeriesOf = (id: string): Series | undefined => planetSeries.get(id);
