// A body's interior, for the cutaway. Every figure is one read of a named page (see NOTICE.md). A figure the page
// gives as "about", or with an uncertainty, is marked `about`, and nothing is filled in where that page states no boundary.
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
    { id: "outer-core", name: { en: "Outer core", ja: "外核" }, madeOf: { en: "iron and nickel, fluid", ja: "鉄とニッケル、液体" }, outerKm: 3485, about: false, colour: "#d4652f" },
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

// NASA Moon Fact Sheet volumetric mean radius. The layer radii are science.nasa.gov/moon/facts/ (read 2026-11-26):
// a solid iron-rich inner core of 240 km, a liquid iron shell 90 km thick (so 330 km), and a near-side crust about 40 km.
// The far side is up to about 60 km and is not the crust drawn here. A partly molten layer is named and given no thickness.
const MOON_RADIUS_KM = 1737.4;
const MOON: Interior = {
  body: "moon",
  radiusKm: MOON_RADIUS_KM,
  radiusAbout: false,
  source: { page: "https://science.nasa.gov/moon/facts/", read: "2026-11-26" },
  layers: [
    { id: "inner-core", name: { en: "Inner core", ja: "内核" }, madeOf: { en: "iron, solid", ja: "鉄、固体" }, outerKm: 240, about: false, colour: "#e6c36a" },
    { id: "outer-core", name: { en: "Outer core", ja: "外核" }, madeOf: { en: "iron, liquid", ja: "鉄、液体" }, outerKm: 330, about: false, colour: "#d4652f" },
    { id: "mantle", name: { en: "Mantle", ja: "マントル" }, madeOf: { en: "olivine and pyroxene", ja: "かんらん石と輝石" }, outerKm: MOON_RADIUS_KM - 40, about: true, colour: "#8a3e2a" },
    { id: "crust", name: { en: "Crust", ja: "地殻" }, madeOf: { en: "rock", ja: "岩石" }, outerKm: MOON_RADIUS_KM, about: false, colour: "#c9a36b" },
  ],
};

// NASA Mercury Fact Sheet volumetric mean radius. science.nasa.gov/mercury/facts/ (read 2026-11-26) says the metallic
// core is about 2,074 km in radius and the mantle and crust together are about 400 km. The cutaway uses the stated
// core radius and the fact-sheet radius, so the shell drawn is 366 km, not that 400.
const MERCURY_RADIUS_KM = 2439.7;
const MERCURY: Interior = {
  body: "mercury",
  radiusKm: MERCURY_RADIUS_KM,
  radiusAbout: false,
  source: { page: "https://science.nasa.gov/mercury/facts/", read: "2026-11-26" },
  layers: [
    { id: "core", name: { en: "Core", ja: "核" }, madeOf: { en: "metal, partly molten", ja: "金属、一部は溶けている" }, outerKm: 2074, about: true, colour: "#e6c36a" },
    { id: "mantle-crust", name: { en: "Mantle and crust", ja: "マントルと地殻" }, madeOf: { en: "rock", ja: "岩石" }, outerKm: MERCURY_RADIUS_KM, about: false, colour: "#8a3e2a" },
  ],
};

// NASA Sun Fact Sheet volumetric mean radius. science.nasa.gov/sun/facts/ (read 2026-11-26) says the core is about
// 138,000 km thick; this cutaway uses that as the core's outside radius. The same page names a radiative zone and a
// convection zone and states no boundary between them, so they are one layer. The photosphere is not drawn.
const SUN_RADIUS_KM = 695700;
const SUN: Interior = {
  body: "sun",
  radiusKm: SUN_RADIUS_KM,
  radiusAbout: false,
  source: { page: "https://science.nasa.gov/sun/facts/", read: "2026-11-26" },
  layers: [
    { id: "core", name: { en: "Core", ja: "中心核" }, madeOf: { en: "hydrogen to helium", ja: "水素がヘリウムになる" }, outerKm: 138000, about: true, colour: "#e6c36a" },
    { id: "outside-core", name: { en: "Radiative and convective zones", ja: "放射層と対流層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: SUN_RADIUS_KM, about: false, colour: "#d4652f" },
  ],
};

// Militzer et al. 2022, Planet. Sci. J. (doi 10.3847/PSJ/ac7ec8), model A, read 2026-11-26. The ensemble gives the
// inner edge of the transition as 0.41 ± 0.03 radii and the outer edge as 0.63 ± 0.01. Model A also places metallic
// hydrogen at 0.63 to 0.72 radii and helium rain at 0.72 to 0.83. The radius is the NASA Jupiter Fact Sheet's
// volumetric mean, 69,911 km.
const JUPITER_RADIUS_KM = 69911;
const JUPITER: Interior = {
  body: "jupiter",
  radiusKm: JUPITER_RADIUS_KM,
  radiusAbout: false,
  source: { page: "https://doi.org/10.3847/PSJ/ac7ec8", read: "2026-11-26" },
  layers: [
    { id: "inner", name: { en: "Inner mix", ja: "均質な内層" }, madeOf: { en: "heavy elements, 18%", ja: "重元素 18%" }, outerKm: 0.41 * JUPITER_RADIUS_KM, about: true, colour: "#e6c36a" },
    { id: "transition", name: { en: "Transition", ja: "遷移層" }, madeOf: { en: "heavy elements, fading", ja: "重元素が減っていく" }, outerKm: 0.63 * JUPITER_RADIUS_KM, about: true, colour: "#d4652f" },
    { id: "metallic", name: { en: "Metallic hydrogen", ja: "金属水素" }, madeOf: { en: "metallic hydrogen", ja: "金属状の水素" }, outerKm: 0.72 * JUPITER_RADIUS_KM, about: false, colour: "#8a3e2a" },
    { id: "helium-rain", name: { en: "Helium rain", ja: "ヘリウムの雨" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: 0.83 * JUPITER_RADIUS_KM, about: false, colour: "#a85a3c" },
    { id: "envelope", name: { en: "Envelope", ja: "外層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: JUPITER_RADIUS_KM, about: false, colour: "#c9a36b" },
  ],
};

// Mankovich and Fuller 2021, Nature Astronomy (doi 10.1038/s41550-021-01448-3), read 2026-11-26: a diffuse core
// extending to approximately 60% of the radius. The radius is the NASA Saturn Fact Sheet's volumetric mean, 58,232 km.
// The envelope's composition is the NASA Saturn facts page (science.nasa.gov/saturn/facts/), hydrogen and helium.
const SATURN_RADIUS_KM = 58232;
const SATURN: Interior = {
  body: "saturn",
  radiusKm: SATURN_RADIUS_KM,
  radiusAbout: false,
  source: { page: "https://doi.org/10.1038/s41550-021-01448-3", read: "2026-11-26" },
  layers: [
    { id: "core", name: { en: "Diffuse core", ja: "境界のぼやけた核" }, madeOf: { en: "ice and rock, mixed", ja: "氷と岩石が混ざる" }, outerKm: 0.6 * SATURN_RADIUS_KM, about: true, colour: "#e6c36a" },
    { id: "envelope", name: { en: "Envelope", ja: "外層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: SATURN_RADIUS_KM, about: false, colour: "#c9a36b" },
  ],
};

const INTERIORS: Partial<Record<BodyId, Interior>> = { sun: SUN, mercury: MERCURY, earth: EARTH, mars: MARS, jupiter: JUPITER, saturn: SATURN, moon: MOON };

/**
 * The interior of a body, or `undefined` when this package has no sourced figures for it. The layers run from the centre outward.
 * Venus, Uranus, Neptune, and Io, Europa, Ganymede and Titan are left out: the pages read for them state no layer boundary.
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
