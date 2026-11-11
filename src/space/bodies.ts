// Which bodies the space view can put at the middle of its view, and in what order a reader hops from one to the next. Pure: names in, names out.
import { BODIES, MOONS_OF, type BodyId, type HostId, type MinorId } from "../facts.ts";

/**
 * What a body is: the Sun, one of the eight planets, a dwarf planet (Pluto among them), a moon, or a minor body: an `asteroid` (Vesta, Pallas), a `centaur` (Chiron, Pholus) or a `comet` (Halley).
 *
 * @example
 * ```ts
 * import { bodyKindOf, type SpaceKind } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const kind: SpaceKind = bodyKindOf("titan");
 * console.log(kind);
 * ```
 */
export type SpaceKind = "star" | "planet" | "dwarf-planet" | "moon" | "asteroid" | "centaur" | "comet";

/** Planets, dwarf planets and minor bodies, ordered by the size of their orbits (the semi-major axis), each followed by its moons nearest first. */
const SUN_ORDER: readonly (HostId | MinorId)[] = ["mercury", "venus", "earth", "mars", "vesta", "ceres", "pallas", "jupiter", "saturn", "chiron", "halley", "uranus", "pholus", "neptune", "pluto", "orcus", "haumea", "quaoar", "makemake", "gonggong", "eris", "sedna"];

/**
 * Every body the package knows, in the order a hopper goes: the Sun, then each planet, dwarf planet and minor body from the Sun outwards, each followed by its moons nearest first (Mercury, Venus, the Earth and the
 * Moon, Mars, Phobos and Deimos, Vesta, Ceres, Pallas, Jupiter and its four large moons, and on to Sedna).
 *
 * @example
 * ```ts
 * import { HOP_ORDER } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(HOP_ORDER.slice(0, 7).join(", "));
 * ```
 */
export const HOP_ORDER: readonly BodyId[] = ["sun", ...SUN_ORDER.flatMap((id) => [id, ...((MOONS_OF as Record<string, readonly BodyId[]>)[id] ?? [])])];

/**
 * What kind of body a name is.
 *
 * @param id - A body's name.
 * @returns `star` for the Sun, `planet` for the eight planets, `dwarf-planet` for Pluto and the others, `moon`, or `asteroid`, `centaur` or `comet` for a minor body.
 *
 * @example
 * ```ts
 * import { bodyKindOf } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(bodyKindOf("ceres"), bodyKindOf("moon"), bodyKindOf("halley"));
 * ```
 */
export function bodyKindOf(id: BodyId): SpaceKind {
  return BODIES[id].kind;
}

/**
 * The planet or dwarf planet a moon goes round, or `undefined` for a body that is not a moon.
 *
 * @param id - A body's name.
 * @returns The host's name for a moon, `undefined` for any other body.
 *
 * @example
 * ```ts
 * import { hostOf } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(hostOf("titan"), hostOf("mars"));
 * ```
 */
export function hostOf(id: BodyId): HostId | undefined {
  return BODIES[id].kind === "moon" ? (BODIES[id].parent as HostId | undefined) ?? "earth" : undefined;
}

/**
 * Read a body from what a reader or a page might write: its name in the package's lower case, in English or in Japanese, in any case.
 *
 * @param text - `saturn`, `Saturn`, `土星`.
 * @returns The body's name, or `undefined` when no body has it.
 *
 * @example
 * ```ts
 * import { findBody } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(findBody("Saturn"), findBody("土星"), findBody("nothing"));
 * ```
 */
export function findBody(text: string): BodyId | undefined {
  const wanted = text.trim().toLowerCase();
  for (const id of HOP_ORDER) if (id === wanted || BODIES[id].name.en.toLowerCase() === wanted || BODIES[id].name.ja === text.trim()) return id;
  return undefined;
}

/**
 * The body after `id` in the hopper's order (or before it with a negative `step`), among those `can` accepts, going round from the last to the first.
 *
 * @param id - Where the hopper is.
 * @param step - `1` for the next body, `-1` for the previous one.
 * @param can - Which bodies the view can go to (all of them by default).
 * @returns The next body, or `id` itself when no other is accepted.
 *
 * @example
 * ```ts
 * import { hopFrom } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(hopFrom("earth", 1), hopFrom("earth", -1), hopFrom("sun", -1, (id) => id !== "sedna"));
 * ```
 */
export function hopFrom(id: BodyId, step: 1 | -1, can: (id: BodyId) => boolean = () => true): BodyId {
  const n = HOP_ORDER.length;
  const at = HOP_ORDER.indexOf(id);
  for (let i = 1; i < n; i += 1) {
    const next = HOP_ORDER[(((at + step * i) % n) + n) % n]!;
    if (can(next)) return next;
  }
  return id;
}

/**
 * The system a body belongs to: the body a moon goes round (or the body itself), and that body's moons, nearest first. The Sun's system is the Sun alone, and a body with no moons is a system of one.
 *
 * @param id - A body's name.
 * @returns `host`, the middle of the system, and `moons`, the moons that go round it.
 *
 * @example
 * ```ts
 * import { systemOf } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const { host, moons } = systemOf("titan");
 * console.log(host, moons.join(", "));
 * ```
 */
export function systemOf(id: BodyId): { host: BodyId; moons: BodyId[] } {
  const host = hostOf(id) ?? id;
  return { host, moons: [...((MOONS_OF as Record<string, readonly BodyId[]>)[host] ?? [])] };
}
