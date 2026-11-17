// Filters and tiers for the belts' bodies (MODULES-558): the status of a body from its name, the part of its belt it is in, a filter by belt, part, size and status, and how many bodies each size tier holds. Everything is worked out from the rows
// the package already carries; nothing is fetched. Pure: no DOM, no three.js.
import { BELT_IDS, BELTS, type BeltBody, type BeltId } from "./index.ts";
import { smallBodyAt } from "../door/small-bodies.ts";

/**
 * How far a small body has come on its way to a name: `provisional` (only a designation such as `2007 OR10`), `numbered` (a number, no name yet: `15760`) or `named` (`588 Achilles`).
 *
 * @example
 * ```ts
 * import type { BeltStatus } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const status: BeltStatus = "named";
 * console.log(status);
 * ```
 */
export type BeltStatus = "provisional" | "numbered" | "named";

/**
 * The status of a body from its name as the Small-Body Database writes it: a number then a name is `named`, a bare number is `numbered`, a designation of a year and letters is `provisional`.
 *
 * @param name - The body's name, such as `588 Achilles`, `15760` or `2007 OR10`.
 * @returns The status.
 *
 * @example
 * ```ts
 * import { beltStatus } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(beltStatus("588 Achilles"), beltStatus("2007 OR10"));
 * ```
 */
export function beltStatus(name: string): BeltStatus {
  const text = name.trim();
  if (/^\d{4} [A-Z]{2}\d*$/.test(text)) return "provisional";
  if (/^\d+$/.test(text)) return "numbered";
  return /^\d+ \S/.test(text) ? "named" : "provisional";
}

/**
 * A part of a belt that the filters know: the main belt's `inner-main` (inside the 3:1 gap, under 2.5 au), `middle-main` (2.5 to 2.82 au) and `outer-main` (beyond the 5:2 gap), the Trojans' two camps `trojan-l4` (ahead of Jupiter)
 * and `trojan-l5` (behind it), the Kuiper belt's `plutino` (the 3:2 resonance with Neptune, 39.0 to 39.9 au) and the `detached` (a scattered body that never comes nearer than 40 au to the Sun, like Sedna).
 *
 * @example
 * ```ts
 * import type { BeltPart } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const part: BeltPart = "plutino";
 * console.log(part);
 * ```
 */
export type BeltPart = "inner-main" | "middle-main" | "outer-main" | "trojan-l4" | "trojan-l5" | "plutino" | "detached";

/**
 * Which part of its belt a body is in, or `undefined` where it is in none of the parts (a Hilda, a Centaur, a classical or other resonant body). A Trojan's camp needs Jupiter's heliocentric ecliptic longitude on the date (from `heliocentric("jupiter", ms)`);
 * without it a Trojan has no part.
 *
 * @param body - The body.
 * @param jd - The date, as a Julian date (TT).
 * @param jupiterLongitude - Jupiter's longitude in degrees on that date, for the Trojans.
 * @returns The part, or `undefined` where the body is in none of them.
 *
 * @example
 * ```ts
 * import { beltPart } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(beltPart({ name: "T", a: 2.7, e: 0.1, i: 5, node: 80, peri: 70, M0: 10, epoch: 2461200.5, H: 9, belt: "main" }, 2461200.5));
 * ```
 */
export function beltPart(body: BeltBody, jd: number, jupiterLongitude?: number): BeltPart | undefined {
  if (body.belt === "main") return body.a < 2.5 ? "inner-main" : body.a <= 2.82 ? "middle-main" : "outer-main";
  if (body.belt === "resonant") return body.a >= 39.0 && body.a <= 39.9 ? "plutino" : undefined;
  if (body.belt === "scattered") return body.a * (1 - body.e) > 40 ? "detached" : undefined;
  if (body.belt === "trojan" && jupiterLongitude !== undefined) {
    const [x, y] = smallBodyAt(body, jd);
    const ahead = ((((Math.atan2(y, x) * 180) / Math.PI - jupiterLongitude + 180) % 360) + 360) % 360 - 180;
    return ahead >= 0 ? "trojan-l4" : "trojan-l5";
  }
  return undefined;
}

/**
 * What to keep: bodies of these `belts`, of at least `hMax` brightness (a body with an absolute magnitude H no greater than `hMax`: smaller H is a bigger body), at most `hMin`, with one of these `status` values, and of this `part` (for
 * which `jd` and, for the Trojans, `jupiterLongitude` are needed).
 *
 * @example
 * ```ts
 * import type { BeltFilter } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const filter: BeltFilter = { belts: ["trojan"], hMax: 10, status: ["named"] };
 * console.log(filter.hMax);
 * ```
 */
export interface BeltFilter {
  belts?: readonly BeltId[];
  /** Keep bodies with an absolute magnitude H of this or less (the bigger ones). */
  hMax?: number;
  /** Keep bodies with an absolute magnitude H of this or more (the smaller ones). */
  hMin?: number;
  status?: readonly BeltStatus[];
  part?: BeltPart;
  /** The date for `part`, as a Julian date (TT). */
  jd?: number;
  /** Jupiter's longitude in degrees on `jd`, for `part` of `trojan-l4` or `trojan-l5`. */
  jupiterLongitude?: number;
}

/**
 * The bodies that pass a filter, in their order.
 *
 * @param bodies - The bodies, from `loadBeltBodies`.
 * @param filter - What to keep; an empty filter keeps every body.
 * @returns The bodies that pass.
 *
 * @example
 * ```ts
 * import { filterBeltBodies, loadBeltBodies } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * const big = filterBeltBodies(await loadBeltBodies(), { belts: ["main"], hMax: 7 });
 * console.log(big.length);
 * ```
 */
export function filterBeltBodies(bodies: readonly BeltBody[], filter: BeltFilter = {}): BeltBody[] {
  return bodies.filter((body) => {
    if (filter.belts !== undefined && !filter.belts.includes(body.belt)) return false;
    if (filter.hMax !== undefined && body.H > filter.hMax) return false;
    if (filter.hMin !== undefined && body.H < filter.hMin) return false;
    if (filter.status !== undefined && !filter.status.includes(beltStatus(body.name))) return false;
    return filter.part === undefined || beltPart(body, filter.jd ?? 0, filter.jupiterLongitude) === filter.part;
  });
}

/**
 * The size tiers: the upper edge of the absolute magnitude H of each (a body of H 10 is about 35 km across in the main belt, with an albedo of 0.06 about 60 km; H does not give a size without the albedo, so the tiers are in H).
 *
 * @example
 * ```ts
 * import { BELT_TIERS } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(BELT_TIERS.join(", "));
 * ```
 */
export const BELT_TIERS = [8, 10, 12, 14, 99] as const;

/**
 * How many bodies this package carries in each size tier of each belt, with the number the database holds for the belt beside it, so a page can say how small a part is drawn. Tier `k` holds the bodies with H above the
 * tier before it and up to `BELT_TIERS[k]`.
 *
 * @param bodies - The bodies, from `loadBeltBodies`.
 * @returns For each belt, the `carried` count of each tier, the total `sample` and the `known` count from `BELTS`.
 *
 * @example
 * ```ts
 * import { beltTiers, loadBeltBodies } from "@johnmorrisdotca/wakusei-planets/belts";
 *
 * console.log(beltTiers(await loadBeltBodies()).main.carried.join(", "));
 * ```
 */
export function beltTiers(bodies: readonly BeltBody[]): Record<BeltId, { carried: number[]; sample: number; known: number }> {
  const out = Object.fromEntries(BELT_IDS.map((id) => [id, { carried: BELT_TIERS.map(() => 0), sample: 0, known: BELTS[id].known }])) as Record<BeltId, { carried: number[]; sample: number; known: number }>;
  for (const body of bodies) {
    const k = BELT_TIERS.findIndex((edge) => body.H <= edge);
    out[body.belt].carried[k]! += 1;
    out[body.belt].sample += 1;
  }
  return out;
}
