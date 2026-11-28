import type { Star } from "./stars.ts";
import { J2000_MS, moment, type When } from "./when.ts";

const JULIAN_YEAR_MS = 365.25 * 86_400_000;

/**
 * Where a star is at a moment: its J2000 position carried forward (or back) by its proper motion in a straight line. The frame stays J2000, so precession to the date is not applied: use
 * the result with J2000 coordinates, or convert it to the date with `/coordinates`. A straight line is good to a fraction of an arc-second for centuries for nearly every star here; it is
 * not good for the few with large motion over millennia.
 *
 * @param star - A star.
 * @param when - The moment as a `Date` or milliseconds since 1970 (UTC); J2000 when left out.
 * @returns Right ascension and declination in degrees, J2000 frame, at that moment.
 *
 * @example
 * ```ts
 * import { starByName, starPosition } from "@johnmorrisdotca/wakusei-planets/stars";
 *
 * const now = starPosition(starByName("Arcturus")!, Date.UTC(2026, 10, 7));
 * console.log(now.declination.toFixed(3));
 * ```
 */
export function starPosition(star: Star, when?: When): { rightAscension: number; declination: number } {
  const years = (moment(when ?? J2000_MS) - J2000_MS) / JULIAN_YEAR_MS;
  const declination = star.declination + (star.properMotionDecMas * years) / 3_600_000;
  const cosine = Math.cos((star.declination * Math.PI) / 180);
  // The motion is a true angle on the sky: it stretches by 1 / cos(declination) in right ascension. At the poles the division is kept finite.
  const rightAscension = star.rightAscension + (star.properMotionRaMas * years) / 3_600_000 / Math.max(Math.abs(cosine), 1e-6);
  return { rightAscension: ((rightAscension % 360) + 360) % 360, declination: Math.max(-90, Math.min(90, declination)) };
}
