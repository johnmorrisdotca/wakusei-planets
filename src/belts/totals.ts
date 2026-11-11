// Made by scripts/make-belts-data.py from NASA/JPL's Small-Body Database (https://ssd-api.jpl.nasa.gov/sbdb_query.api, read 2026-11-10). NASA/JPL data, not subject to copyright in the United States (credit: NASA/JPL-Caltech). Do not edit by hand.
/**
 * The Julian date (TT) of the elements of every body in `data.ts`: each body's mean anomaly was carried to it with the two-body mean motion.
 *
 * @example
 * ```ts
 * import { BELT_EPOCH } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(BELT_EPOCH);
 * ```
 */
export const BELT_EPOCH = 2461200.5;
/**
 * What the database held on 2026-11-10: all asteroids, the numbered ones, and each group (the three kinds of the Kuiper belt are cut by their elements, see the script).
 *
 * @example
 * ```ts
 * import { BELT_TOTALS } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(BELT_TOTALS.all > 1_500_000);
 * ```
 */
export const BELT_TOTALS = {"all": 1580096, "numbered": 895910, "main": 1429419, "hilda": 7929, "trojan": 16472, "centaur": 1087, "tno": 8338, "classical": 3000, "resonant": 2306, "scattered": 2266} as const;
/** How many bodies of each belt `data.ts` holds: the brightest numbered ones. */
export const BELT_SAMPLE = {"main": 1300, "hilda": 220, "trojan": 520, "centaur": 200, "classical": 300, "resonant": 500, "scattered": 300} as const;
