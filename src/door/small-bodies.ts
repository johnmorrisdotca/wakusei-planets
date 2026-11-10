// The small-body record source of the data door: asteroids, comets and the like as a list of orbital elements, drawn as points in `<wakusei-space>`. A source hands in `SmallBody` records (at most 200,000, read once); this
// file checks them, and works out where one is for a date (`smallBodyAt`, the same Kepler orbit the point's shader solves). Pure: no DOM, no three.js.
import { loadRecords, type RecordSource, type RecordsRead } from "../data-door.ts";
import type { Vec3 } from "../vec.ts";
import { RAD } from "../vec.ts";

/**
 * A small body on an orbit round the Sun: its name, and the elements of the orbit at an epoch (as the Minor Planet Center and JPL list them). Distances are in astronomical units, angles in degrees, `epoch` is a Julian date (TT)
 * and `H` is the absolute magnitude. The orbit is an ellipse: `a` above 0 and `e` from 0 to just under 1.
 *
 * @example
 * ```ts
 * import type { SmallBody } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const ceres: SmallBody = { name: "Ceres", a: 2.7656, e: 0.0795, i: 10.588, node: 80.25, peri: 73.3, M0: 291.4, epoch: 2461000.5, H: 3.34 };
 * console.log(ceres.name);
 * ```
 */
export interface SmallBody {
  name: string;
  /** The semi-major axis, in astronomical units. */
  a: number;
  /** The eccentricity: 0 (a circle) to just under 1. */
  e: number;
  /** The inclination to the ecliptic of J2000, in degrees. */
  i: number;
  /** The longitude of the ascending node, in degrees. */
  node: number;
  /** The argument of perihelion, in degrees. */
  peri: number;
  /** The mean anomaly at the epoch, in degrees. */
  M0: number;
  /** The epoch, as a Julian date. */
  epoch: number;
  /** The absolute magnitude. */
  H: number;
}

/**
 * A source of small bodies: a list that fits in memory (at most 200,000 records), read once, when the source is added.
 *
 * @example
 * ```ts
 * import type { SmallBodySource } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const count = async (source: SmallBodySource): Promise<number> => (await source.records(new AbortController().signal)).length;
 * console.log(typeof count);
 * ```
 */
export type SmallBodySource = RecordSource<SmallBody>;

/**
 * The Gaussian gravitational constant: the mean motion, in radians a day, of a body whose semi-major axis is one astronomical unit.
 *
 * @example
 * ```ts
 * import { GAUSS_K } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(((2 * Math.PI) / GAUSS_K).toFixed(2)); // the days of a year at one astronomical unit
 * ```
 */
export const GAUSS_K = 0.01720209895;

/**
 * The numbers of a record that must be finite.
 *
 * @param body - The record.
 * @returns Its eight numbers.
 *
 * @example
 * ```ts
 * import { smallBodyNumbers } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(smallBodyNumbers({ name: "T", a: 2.7, e: 0.1, i: 5, node: 80, peri: 70, M0: 10, epoch: 2461000.5, H: 9 }).length);
 * ```
 */
export const smallBodyNumbers = (body: SmallBody): number[] => [body.a, body.e, body.i, body.node, body.peri, body.M0, body.epoch, body.H];

/**
 * True for a record the package can draw: a name, finite numbers, and an ellipse.
 *
 * @param value - Anything.
 * @returns Whether it is a `SmallBody` that can be drawn.
 *
 * @example
 * ```ts
 * import { isSmallBody } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(isSmallBody({ name: "T", a: 2.7, e: 1.2, i: 5, node: 80, peri: 70, M0: 10, epoch: 2461000.5, H: 9 })); // false: not an ellipse
 * ```
 */
export function isSmallBody(value: unknown): value is SmallBody {
  if (typeof value !== "object" || value === null) return false;
  const one = value as Record<string, unknown>;
  if (typeof one["name"] !== "string") return false;
  for (const field of ["a", "e", "i", "node", "peri", "M0", "epoch", "H"]) if (typeof one[field] !== "number" || !Number.isFinite(one[field])) return false;
  return (one["a"] as number) > 0 && (one["e"] as number) >= 0 && (one["e"] as number) < 1;
}

/**
 * What `readSmallBodies` found: the frozen records that can be drawn, and `skipped`, the records left out for a number that is not finite, a name that is not text, or an orbit that is not an ellipse.
 *
 * @example
 * ```ts
 * import type { SmallBodiesRead } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const say = (read: SmallBodiesRead): string => `${read.status}: ${read.records.length} kept, ${read.skipped} skipped`;
 * console.log(typeof say);
 * ```
 */
export type SmallBodiesRead = RecordsRead<SmallBody>;

/**
 * Reads a small-body source once: the list is frozen, a record that cannot be drawn (see `SmallBody`) is left out and counted, and a list of more than 200,000 is refused whole. It never throws: a source that fails is a
 * failed read, and one the signal aborted is `aborted`.
 *
 * @param source - The source.
 * @param signal - Aborts the read.
 * @returns The records and the count left out.
 *
 * @example
 * ```ts
 * import { readSmallBodies, type SmallBodySource } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * declare const source: SmallBodySource;
 * const read = await readSmallBodies(source, new AbortController().signal);
 * console.log(read.records.length, read.skipped);
 * ```
 */
export async function readSmallBodies(source: SmallBodySource, signal: AbortSignal): Promise<SmallBodiesRead> {
  const read = await loadRecords(source, signal, smallBodyNumbers);
  if (read.status !== "ok") return read;
  const kept = read.records.filter(isSmallBody);
  const skipped = read.skipped + read.records.length - kept.length;
  return { status: "ok", records: Object.freeze(kept), skipped };
}

/**
 * Where a small body is on a date: heliocentric ecliptic coordinates of J2000, in astronomical units, from its elements by Kepler's equation (the orbit is two-body: no planet moves it).
 *
 * @param body - The body.
 * @param jd - The date, as a Julian date (TT).
 * @returns x, y, z in astronomical units from the Sun.
 *
 * @example
 * ```ts
 * import { smallBodyAt } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const [x, y, z] = smallBodyAt({ name: "Test", a: 2.77, e: 0.08, i: 10.6, node: 80.3, peri: 73.6, M0: 0, epoch: 2461000.5, H: 3.3 }, 2461000.5);
 * console.log(Math.hypot(x, y, z).toFixed(2));
 * ```
 */
export function smallBodyAt(body: SmallBody, jd: number): Vec3 {
  const n = GAUSS_K / Math.pow(body.a, 1.5);
  const mean = body.M0 * RAD + n * (jd - body.epoch);
  const m = mean - 2 * Math.PI * Math.floor(mean / (2 * Math.PI) + 0.5);
  let E = body.e < 0.8 ? m : Math.PI;
  for (let k = 0; k < 30; k += 1) {
    const step = (E - body.e * Math.sin(E) - m) / (1 - body.e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-13) break;
  }
  const x = body.a * (Math.cos(E) - body.e);
  const y = body.a * Math.sqrt(1 - body.e * body.e) * Math.sin(E);
  const [cw, sw] = [Math.cos(body.peri * RAD), Math.sin(body.peri * RAD)];
  const [co, so] = [Math.cos(body.node * RAD), Math.sin(body.node * RAD)];
  const [ci, si] = [Math.cos(body.i * RAD), Math.sin(body.i * RAD)];
  const px = cw * x - sw * y;
  const py = sw * x + cw * y;
  return [co * px - so * ci * py, so * px + co * ci * py, si * py];
}

/**
 * The most small bodies drawn, whatever the source holds (the source's own cap is 200,000 records).
 *
 * @example
 * ```ts
 * import { MAX_POINTS } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(MAX_POINTS);
 * ```
 */
export const MAX_POINTS = 200_000;

/**
 * The elements of the bodies packed for the graphics card, eight numbers each: `a`, `e`, `i`, `node`, `peri`, `M0`, the days from the epoch to `jd0`, and `H`, angles in radians. The point's shader moves each one from there
 * with the mean motion, so no work is done on the processor when the date changes.
 *
 * @param bodies - The bodies.
 * @param jd0 - The Julian date the shader counts from.
 * @returns A `Float32Array` of eight numbers a body.
 *
 * @example
 * ```ts
 * import { packSmallBodies } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(packSmallBodies([{ name: "T", a: 2.7, e: 0.1, i: 5, node: 80, peri: 70, M0: 10, epoch: 2461000.5, H: 9 }], 2461000.5).length);
 * ```
 */
export function packSmallBodies(bodies: readonly SmallBody[], jd0: number): Float32Array {
  const count = Math.min(bodies.length, MAX_POINTS);
  const out = new Float32Array(count * 8);
  for (let k = 0; k < count; k += 1) {
    const b = bodies[k]!;
    out.set([b.a, b.e, b.i * RAD, b.node * RAD, b.peri * RAD, b.M0 * RAD, jd0 - b.epoch, b.H], k * 8);
  }
  return out;
}
