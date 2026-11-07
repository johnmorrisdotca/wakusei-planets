// A moment as the sky functions take it: a `Date` or milliseconds since 1970, which is UTC as JavaScript counts it (leap seconds are not counted). Pure: no DOM, no three.js.

/**
 * A moment: a `Date` or a number of milliseconds since 1970 (UTC, as JavaScript counts).
 *
 * @example
 * ```ts
 * import { toJulianDate, type When } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * const when: When = new Date(Date.UTC(2000, 0, 1, 12));
 * console.log(toJulianDate(when) === toJulianDate(when.getTime()));
 * ```
 */
export type When = Date | number;

/**
 * A moment as milliseconds since 1970. A `Date` is never changed. An invalid `Date`, a number that is not finite or anything else throws, naming the argument and the value.
 */
export function moment(when: When, name = "when"): number {
  if (typeof when !== "number" && typeof (when as Date | undefined)?.getTime !== "function") {
    throw new TypeError(`${name} must be a Date or a number of milliseconds since 1970, got ${typeof when}`);
  }
  const ms = typeof when === "number" ? when : when.getTime();
  if (!Number.isFinite(ms)) throw new RangeError(`${name} must be a valid Date or a finite number of milliseconds since 1970, got ${String(when)}`);
  return ms;
}
