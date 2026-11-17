// The bodies the flat map draws and what is particular to each: its mean radius (for how far a craft sees), how soft its sunset is, the colour of its night, where its "centre the map" buttons point, and which orbiters go round it.
// Pure: no DOM.
import { ORBITER_FACTS, ORBITER_IDS, orbiterCentre, type OrbiterId } from "../orbiters.ts";

/**
 * The bodies the flat map draws: the Moon and Mars. They have the painted maps, the landing, rover and crash sites and the spacecraft in orbit that the package holds; the Earth's flat map is chikyu-earth's `<chikyu-flat>`.
 *
 * @example
 * ```ts
 * import { FLAT_BODIES } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(FLAT_BODIES.join(", "));
 * ```
 */
export const FLAT_BODIES = ["moon", "mars"] as const;

/**
 * A body the flat map draws.
 *
 * @example
 * ```ts
 * import type { FlatBodyId } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const body: FlatBodyId = "mars";
 * console.log(body);
 * ```
 */
export type FlatBodyId = (typeof FLAT_BODIES)[number];

/**
 * What is particular to one body on the flat map.
 *
 * @example
 * ```ts
 * import { flatBody, type FlatBodyInfo } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const mars: FlatBodyInfo = flatBody("mars");
 * console.log(mars.radiusKm, mars.twilightDeg);
 * ```
 */
export interface FlatBodyInfo {
  id: FlatBodyId;
  /** The mean radius in kilometres (IAU): the sphere a craft's height is measured above and the footprint is worked out on. */
  radiusKm: number;
  /** How far the Sun is below the horizon, in degrees, when the shading has gone to full night: 1 on the Moon (no air to spread the light), 8 on Mars (its dust lights the sky for a while after sunset). */
  twilightDeg: number;
  /** The colour of the night side as red, green and blue, and how dark it is at most (0 to 1): the map never goes quite black, since the night side still shows its ground. */
  night: readonly [number, number, number, number];
  /** The colour the map shows while its picture is on its way, or when it cannot be loaded. */
  ground: string;
  /** The longitudes the "centre the map on" buttons go to, with the word each is called by (`FLAT_WORDS` keys). */
  centres: readonly { lon: number; say: "nearSide" | "farSide" | "primeMeridian" }[];
  /** The orbiters that go round it, in the package's order. */
  orbiters: readonly OrbiterId[];
}

const orbitersOf = (body: FlatBodyId): readonly OrbiterId[] => ORBITER_IDS.filter((id) => orbiterCentre(id) === body);

const INFO: Readonly<Record<FlatBodyId, FlatBodyInfo>> = {
  moon: {
    id: "moon",
    radiusKm: 1737.4,
    twilightDeg: 1,
    night: [3, 5, 12, 0.78],
    ground: "#4a4945",
    centres: [
      { lon: 0, say: "nearSide" },
      { lon: 180, say: "farSide" },
    ],
    orbiters: orbitersOf("moon"),
  },
  mars: {
    id: "mars",
    radiusKm: 3389.5,
    twilightDeg: 8,
    night: [6, 4, 14, 0.72],
    ground: "#7a3f24",
    centres: [{ lon: 0, say: "primeMeridian" }],
    orbiters: orbitersOf("mars"),
  },
};

/**
 * Whether a text is a body the flat map draws.
 *
 * @param value - Any text, in any case.
 * @returns True for `moon` and `mars`.
 *
 * @example
 * ```ts
 * import { isFlatBody } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(isFlatBody("Mars"), isFlatBody("venus"));
 * ```
 */
export const isFlatBody = (value: string | null | undefined): value is FlatBodyId => value !== null && value !== undefined && (FLAT_BODIES as readonly string[]).includes(value.trim().toLowerCase());

/**
 * What is particular to a body on the flat map.
 *
 * @param id - `moon` or `mars`.
 * @returns Its numbers.
 *
 * @example
 * ```ts
 * import { flatBody } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(flatBody("moon").orbiters.join(", "));
 * ```
 */
export function flatBody(id: string): FlatBodyInfo {
  const key = id.trim().toLowerCase();
  if (!isFlatBody(key)) throw new RangeError(`the flat map draws ${FLAT_BODIES.join(" and ")}, not ${JSON.stringify(id)}`);
  return INFO[key];
}

/**
 * The colour each orbiter is drawn in: colours kept for a dark map, one for each orbiter in the package's order, so an orbiter is the same colour in a list and on the map.
 *
 * @example
 * ```ts
 * import { ORBITER_COLOURS } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(ORBITER_COLOURS.length, ORBITER_COLOURS[0]);
 * ```
 */
export const ORBITER_COLOURS: readonly string[] = ["#ffd23f", "#4cc9f0", "#6ee7a0", "#ff7a59", "#a78bfa", "#ff9ecb", "#f4a261", "#b8e986", "#5eead4", "#7aa2ff", "#e879f9", "#fde68a", "#ffffff"];

/**
 * The colour of one orbiter on the map.
 *
 * @param id - The orbiter.
 * @returns A CSS colour.
 *
 * @example
 * ```ts
 * import { orbiterColour } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(orbiterColour("lro"), orbiterColour("mro"));
 * ```
 */
export function orbiterColour(id: OrbiterId): string {
  const at = ORBITER_IDS.indexOf(id);
  return ORBITER_COLOURS[(at < 0 ? 0 : at) % ORBITER_COLOURS.length]!;
}

/**
 * An orbiter's name, in a language: the craft's own, or its short form for a crowded map.
 *
 * @param id - The orbiter.
 * @param lang - `en` or `ja`.
 * @param short - True for the short name.
 * @returns The name.
 *
 * @example
 * ```ts
 * import { orbiterName } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(orbiterName("lro", "en"), "|", orbiterName("lro", "en", true), "|", orbiterName("hope", "ja", true));
 * ```
 */
export const orbiterName = (id: OrbiterId, lang: "en" | "ja", short = false): string => (short ? ORBITER_FACTS[id].short[lang] : ORBITER_FACTS[id].name[lang]);
