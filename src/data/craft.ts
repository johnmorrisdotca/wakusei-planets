// The fitted paths of the spacecraft a page has loaded, one registry for the whole page on `globalThis` (a CDN's bundler gives each entry point its own copy of a file, and the copies must still share the paths).
// `loadSpacecraft` in `spacecraft.ts` imports a craft's file from `src/craft/`, which registers its table here.
import type { Vec3 } from "../vec.ts";

/** One craft's path: Chebyshev segments of varying length. */
export interface CraftTable {
  /** Milliseconds since 1970, in terrestrial time, at the start of the first segment. */
  start: number;
  /** The worst error measured against Horizons, in kilometres: on samples held back from the fit and on fresh samples at random times. */
  worst: number;
  /** The edges of the segments, in whole seconds after `start`: one more than there are segments. */
  edges: readonly number[];
  /** By segment, then x, y, z, then the Chebyshev coefficients, in kilometres (a short segment keeps metres). */
  segments: readonly (readonly (readonly number[])[])[];
}

const KEY = Symbol.for("johnmorrisdotca.wakusei-planets.craft");
const tables = ((globalThis as Record<symbol, unknown>)[KEY] ??= new Map<string, CraftTable>()) as Map<string, CraftTable>;

/** Teach `spacecraftPosition` a craft's path. The files in `src/craft/` call this as they load. */
export function registerCraft(id: string, table: CraftTable): CraftTable {
  tables.set(id, table);
  return table;
}

/** The path registered for a craft, or `undefined` when its file has not been loaded. */
export const craftTable = (id: string): CraftTable | undefined => tables.get(id);

/** The first and last instants a table covers, in milliseconds since 1970 in terrestrial time. */
export const craftSpan = (table: CraftTable): [number, number] => [table.start + table.edges[0]! * 1000, table.start + table.edges[table.edges.length - 1]! * 1000];

function clenshaw(c: readonly number[], x: number): number {
  let b1 = 0;
  let b2 = 0;
  for (let k = c.length - 1; k >= 1; k -= 1) {
    const b0 = 2 * x * b1 - b2 + c[k]!;
    b2 = b1;
    b1 = b0;
  }
  return x * b1 - b2 + c[0]!;
}

/** The coefficients of the derivative with respect to x. */
function derivative(c: readonly number[]): number[] {
  const n = c.length;
  const d = new Array<number>(n + 1).fill(0);
  for (let k = n - 1; k >= 1; k -= 1) d[k - 1] = d[k + 1]! + 2 * k * c[k]!;
  d[0] = d[0]! / 2;
  return d.slice(0, Math.max(n - 1, 1));
}

/** Position (km) and velocity (km/s) from a table at a terrestrial time in milliseconds, or `undefined` outside its span. */
export function craftState(table: CraftTable, terrestrialMs: number): { position: Vec3; velocity: Vec3 } | undefined {
  const seconds = (terrestrialMs - table.start) / 1000;
  const edges = table.edges;
  if (!(seconds >= edges[0]! && seconds <= edges[edges.length - 1]!)) return undefined;
  let lo = 0;
  let hi = edges.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (edges[mid]! <= seconds) lo = mid;
    else hi = mid - 1;
  }
  const e0 = edges[lo]!;
  const e1 = edges[lo + 1]!;
  const x = (2 * (seconds - e0)) / (e1 - e0) - 1;
  const axes = table.segments[lo]!;
  const position = axes.map((c) => clenshaw(c, x)) as unknown as Vec3;
  const velocity = axes.map((c) => (clenshaw(derivative(c), x) * 2) / (e1 - e0)) as unknown as Vec3;
  return { position, velocity };
}
