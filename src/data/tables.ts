// The fitted position tables a page has loaded, one table for the whole page on `globalThis` (a CDN's bundler gives each entry point its own copy of a file, and the copies must still share the tables).
// `@johnmorrisdotca/wakusei-planets/tables` and its parts register tables; `heliocentric` uses a body's table when one is registered and its approximate elements otherwise.

/** One body's table of Chebyshev segments. */
export interface FittedTable {
  /** Milliseconds since 1970, in terrestrial time, at the start of the first segment. */
  start: number;
  /** The length of a segment in milliseconds. */
  segment: number;
  /** The error on samples held back from the fit, in arc-seconds. */
  worst: number;
  /** By segment, then x, y, z, then the Chebyshev coefficients, in au. */
  segments: readonly (readonly (readonly number[])[])[];
}

const KEY = Symbol.for("johnmorrisdotca.wakusei-planets.tables");
const tables = ((globalThis as Record<symbol, unknown>)[KEY] ??= new Map<string, FittedTable>()) as Map<string, FittedTable>;

/**
 * Teach `heliocentric` a body's fitted table. The entry points `@johnmorrisdotca/wakusei-planets/tables/ceres` and `/tables/dwarfs` call this as they load.
 *
 * @param id - The body's name.
 * @param table - Its Chebyshev segments, as `scripts/make-dwarf-data.py` writes them.
 * @returns The table, as it was given.
 *
 * @example
 * ```ts
 * import { registerTable, tableOf } from "@johnmorrisdotca/wakusei-planets/tables";
 *
 * registerTable("ceres", { start: 0, segment: 1000, worst: 0, segments: [[[0], [0], [0]]] });
 * console.log(tableOf("ceres")?.worst);
 * ```
 */
export function registerTable(id: string, table: FittedTable): FittedTable {
  tables.set(id, table);
  return table;
}

/**
 * The table registered for a body, or `undefined` when its entry point has not been imported.
 *
 * @param id - The body's name.
 * @returns The registered table, or `undefined`.
 *
 * @example
 * ```ts
 * import { tableOf } from "@johnmorrisdotca/wakusei-planets/tables";
 *
 * console.log(tableOf("sedna") === undefined);
 * ```
 */
export const tableOf = (id: string): FittedTable | undefined => tables.get(id);
