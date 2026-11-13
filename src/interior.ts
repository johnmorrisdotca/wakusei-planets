// A body's interior, for the cutaway. Every figure is one read from a NASA page on 2026-11-13 (see NOTICE.md). A figure the page
// gives as "about" is marked `about`, and nothing is filled in for a body whose page does not state it.
import type { BodyId } from "./facts.ts";

/** One layer, from the centre outward. `outerKm` is the radius of its outside. */
export interface InteriorLayer {
  id: string;
  name: { en: string; ja: string };
  /** What the source says the layer is made of. */
  madeOf: { en: string; ja: string };
  /** Radius of the outside of the layer, in kilometres. */
  outerKm: number;
  /** The outside radius is the source's "about", not a figure it states exactly. */
  about: boolean;
  /** A flat colour from the cutaway's palette, `#rrggbb`. */
  colour: string;
}

/** The layers of one body, innermost first. `radiusKm` is the volumetric mean radius the depths are measured from. */
export interface Interior {
  body: BodyId;
  radiusKm: number;
  /** True when `radiusKm` is the source's "about". */
  radiusAbout: boolean;
  layers: readonly InteriorLayer[];
  /** Where the figures were read, and on which date. */
  source: { page: string; read: string };
}

/** One row of the legend: the layer's name, its depth from the surface, and what it is made of. */
export interface InteriorRow {
  id: string;
  name: string;
  depth: string;
  madeOf: string;
  colour: string;
}

const EARTH: Interior = {
  body: "earth",
  // NASA Earth fact sheet, volumetric mean radius. The inner-core radius and the land crust's thickness are the science.nasa.gov Earth's "about".
  radiusKm: 6371,
  radiusAbout: false,
  source: { page: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html", read: "2026-11-13" },
  layers: [
    { id: "inner-core", name: { en: "Inner core", ja: "内核" }, madeOf: { en: "iron and nickel, solid", ja: "鉄とニッケル、固体" }, outerKm: 1221, about: true, colour: "#e6c36a" },
    { id: "outer-core", name: { en: "Outer core", ja: "外核" }, madeOf: { en: "iron and nickel, fluid", ja: "鉄とニッケル、流体" }, outerKm: 3485, about: false, colour: "#d4652f" },
    { id: "mantle", name: { en: "Mantle", ja: "マントル" }, madeOf: { en: "rock", ja: "岩石" }, outerKm: 6341, about: true, colour: "#8a3e2a" },
    { id: "crust", name: { en: "Crust", ja: "地殻" }, madeOf: { en: "rock", ja: "岩石" }, outerKm: 6371, about: false, colour: "#c9a36b" },
  ],
};

const MARS: Interior = {
  body: "mars",
  // NASA Mars fact sheet: volumetric mean radius and core radius. The page does not say what either layer is made of, and it does not split the outside of the core.
  radiusKm: 3389.5,
  radiusAbout: false,
  source: { page: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html", read: "2026-11-13" },
  layers: [
    { id: "core", name: { en: "Core", ja: "核" }, madeOf: { en: "not stated", ja: "述べられていない" }, outerKm: 1830, about: false, colour: "#d4652f" },
    { id: "outside-core", name: { en: "Outside the core", ja: "核の外側" }, madeOf: { en: "not stated", ja: "述べられていない" }, outerKm: 3389.5, about: false, colour: "#a85a3c" },
  ],
};

const INTERIORS: Partial<Record<BodyId, Interior>> = { earth: EARTH, mars: MARS };

/**
 * The interior of a body, or `undefined` when this package has no sourced figures for it. The layers run from the centre outward.
 * The Earth and Mars are the bodies with figures; the Moon, Mercury, Venus, the giant planets, and Io, Europa, Ganymede and Titan are left out.
 *
 * @param bodyId - A body's id, such as `"earth"`.
 * @returns The layers, or `undefined`.
 *
 * @example
 * ```ts
 * import { interiorOf } from "@johnmorrisdotca/wakusei-planets";
 *
 * const earth = interiorOf("earth");
 * console.log(earth?.layers.map((layer) => layer.outerKm).join(","));
 * ```
 */
export function interiorOf(bodyId: string): Interior | undefined {
  return INTERIORS[bodyId as BodyId];
}

const km = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

/** A depth, with "about" when the figure it comes from is the source's "about". */
function depthEnd(n: number, about: boolean, lang: "en" | "ja"): string {
  const text = `${km(n)} km`;
  if (!about) return text;
  return lang === "ja" ? `約 ${text}` : `about ${text}`;
}

/**
 * The legend's rows for a body, outermost layer first, or `undefined` when `interiorOf` has nothing for it.
 * A depth is kilometres from the surface down to the layer's outside and then to its inside.
 *
 * @param bodyId - A body's id.
 * @param lang - `en` or `ja`.
 * @returns The rows, or `undefined`.
 *
 * @example
 * ```ts
 * import { interiorLegend } from "@johnmorrisdotca/wakusei-planets";
 *
 * const rows = interiorLegend("earth", "en");
 * console.log(rows?.[0]?.name);
 * ```
 */
export function interiorLegend(bodyId: string, lang: "en" | "ja"): InteriorRow[] | undefined {
  const interior = interiorOf(bodyId);
  if (interior === undefined) return undefined;
  const { radiusKm, layers } = interior;
  const rows: InteriorRow[] = [];
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i]!;
    const innerKm = i === 0 ? 0 : layers[i - 1]!.outerKm;
    const shallow = radiusKm - layer.outerKm;
    const deep = radiusKm - innerKm;
    const shallowAbout = layer.about;
    const deepAbout = i === 0 ? false : layers[i - 1]!.about;
    const from = depthEnd(shallow, shallowAbout, lang);
    const to = depthEnd(deep, deepAbout, lang);
    rows.push({
      id: layer.id,
      name: layer.name[lang],
      depth: lang === "ja" ? `${from} から ${to}` : `${from} to ${to}`,
      madeOf: layer.madeOf[lang],
      colour: layer.colour,
    });
  }
  return rows;
}
