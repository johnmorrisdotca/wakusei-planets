// What a small moon's drawn shape and colour rest on, as the line a card says (MODULES-1601). Pure: no DOM, no three.js.
// A moon whose shape was measured by a spacecraft and published as a model is drawn with that shape; with a mission map it is drawn with its surface too, and with none its colour is the one its measured brightness gives.
import type { BodyId } from "./facts.ts";

/**
 * How a moon's picture is known: `shape-and-map` (its shape model and its surface map are from a spacecraft), or `shape` (its shape model is, and its colour is from its measured brightness, as no map of it exists).
 *
 * @example
 * ```ts
 * import { shapeBasis, type ShapeBasis } from "@johnmorrisdotca/wakusei-planets";
 *
 * const basis: ShapeBasis | undefined = shapeBasis("nix");
 * console.log(basis);
 * ```
 */
export type ShapeBasis = "shape-and-map" | "shape" | "craft";

const NOTE = {
  shape: { en: "shape measured; colour from its measured brightness", ja: "形は測定したもの。色は測定した明るさから" },
  "shape-and-map": { en: "shape and surface measured by spacecraft", ja: "形も表面も探査機が測定したもの" },
  craft: { en: "shape measured by spacecraft; colour from its photograph, not a map", ja: "形は探査機が測定したもの。色は写真からで、地面の地図ではない" },
} as const;

// The moons drawn with a measured shape (their looks carry `shape`), and whether a mission map is drawn on them too. test/shape.test.ts holds this table to the looks.
const BASIS: Partial<Record<BodyId, ShapeBasis>> = {
  phobos: "shape-and-map", deimos: "shape-and-map", phoebe: "shape-and-map",
  nix: "shape", hydra: "shape", proteus: "shape", larissa: "shape", amalthea: "shape", thebe: "shape", hyperion: "shape", janus: "shape", epimetheus: "shape", prometheus: "shape", pandora: "shape",
  atlas: "shape", pan: "shape", daphnis: "shape", helene: "shape", telesto: "shape", calypso: "shape",
  bennu: "craft", eros: "craft", arrokoth: "craft",
};

/**
 * How the picture of a body rests on measurement, or `undefined` for a body drawn from its facts alone (a sphere or an ellipsoid).
 *
 * @param id - The body.
 * @returns The basis, or `undefined` for a body drawn from its facts alone.
 *
 * @example
 * ```ts
 * import { shapeBasis } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(shapeBasis("phobos"), shapeBasis("mars"));
 * ```
 */
export function shapeBasis(id: BodyId): ShapeBasis | undefined {
  return BASIS[id];
}

/**
 * The line a card says about how the body is drawn: for a moon drawn with its measured shape, "shape measured; colour from its measured brightness" when it has no map, and "shape and surface measured by spacecraft" when it has one.
 * An empty string for any other body.
 *
 * @param id - The body.
 * @param lang - `en` or `ja`.
 * @returns The line.
 *
 * @example
 * ```ts
 * import { shapeNote } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(shapeNote("hydra", "en"));
 * ```
 */
export function shapeNote(id: BodyId, lang: "en" | "ja"): string {
  const basis = shapeBasis(id);
  return basis === undefined ? "" : NOTE[basis][lang];
}
