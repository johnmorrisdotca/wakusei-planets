// A body's interior, with layer radii from the named sources in NOTICE.md. Approximate and uncertain boundaries are marked about.
import type { BodyId } from "./facts.ts";
import { rowsForInterior } from "./interior-profile.ts";

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
  /** This layer can show illustrative flow in an explicit cut. */
  flow?: true;
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
  /** A source model or uncertainty to show with the legend. */
  note?: { en: string; ja: string };
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
    { id: "outer-core", name: { en: "Outer core", ja: "外核" }, madeOf: { en: "iron and nickel, fluid", ja: "鉄とニッケル、液体" }, outerKm: 3485, about: false, colour: "#d4652f", flow: true },
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
    { id: "outer-core", name: { en: "Outer core", ja: "外核" }, madeOf: { en: "iron, liquid", ja: "鉄、液体" }, outerKm: 330, about: false, colour: "#d4652f", flow: true },
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

// NASA's core radius and volumetric mean radius. The convection base is from the corrected GONG Model S profile,
// read 2026-11-27, at the sign change of the Ledoux discriminant (0.712743 of the model’s photospheric radius).
const SUN_RADIUS_KM = 695700;
const SUN: Interior = {
  body: "sun",
  radiusKm: SUN_RADIUS_KM,
  radiusAbout: false,
  source: { page: "https://users-phys.au.dk/jcd/solar_models/", read: "2026-11-27" },
  layers: [
    { id: "core", name: { en: "Core", ja: "中心核" }, madeOf: { en: "hydrogen to helium", ja: "水素が核融合してヘリウムになる" }, outerKm: 138000, about: true, colour: "#e6c36a" },
    { id: "radiative-zone", name: { en: "Radiative zone", ja: "放射層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: 0.7127 * SUN_RADIUS_KM, about: true, colour: "#d4652f" },
    { id: "convective-zone", name: { en: "Convection zone", ja: "対流層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: SUN_RADIUS_KM, about: false, colour: "#a85a3c" },
  ],
  note: { en: "The convection boundary comes from the corrected solar Model S.", ja: "対流層の境界は、修正された太陽モデル S の値です。" },
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
    { id: "metallic", name: { en: "Metallic hydrogen", ja: "金属水素" }, madeOf: { en: "metallic hydrogen", ja: "金属状の水素" }, outerKm: 0.72 * JUPITER_RADIUS_KM, about: false, colour: "#8a3e2a", flow: true },
    { id: "helium-rain", name: { en: "Helium rain", ja: "ヘリウムの雨" }, madeOf: { en: "helium falls as droplets", ja: "ヘリウムが液滴になって沈む" }, outerKm: 0.83 * JUPITER_RADIUS_KM, about: false, colour: "#a85a3c" },
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
    { id: "core", name: { en: "Diffuse core", ja: "境界のぼやけた核" }, madeOf: { en: "ice and rock, mixed", ja: "氷と岩石が混ざっている" }, outerKm: 0.6 * SATURN_RADIUS_KM, about: true, colour: "#e6c36a" },
    { id: "envelope", name: { en: "Envelope", ja: "外層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: SATURN_RADIUS_KM, about: false, colour: "#c9a36b" },
  ],
};

// Margot et al. (2021), two-layer uniform-density model in Methods. They obtain a core radius of 3508 km
// with about 500 km uncertainty from the moment of inertia. Dumoulin et al. (2017) give a model range.
const VENUS_RADIUS_KM = 6051.8;
const VENUS: Interior = {
  body: "venus",
  radiusKm: VENUS_RADIUS_KM,
  radiusAbout: false,
  source: { page: "https://doi.org/10.1038/s41550-021-01339-7", read: "2026-11-27" },
  layers: [
    { id: "core", name: { en: "Core", ja: "核" }, madeOf: { en: "dense material", ja: "密度の高い物質" }, outerKm: 3500, about: true, colour: "#e6c36a" },
    { id: "mantle", name: { en: "Mantle", ja: "マントル" }, madeOf: { en: "rock", ja: "岩石" }, outerKm: VENUS_RADIUS_KM, about: false, colour: "#a85a3c" },
  ],
  note: {
    en: "Margot et al. give a core radius of about 3,500 km, uncertain by about 500 km. Dumoulin et al.’s models give 2,900–3,450 km.",
    ja: "Margot らのモデルでは核の半径は約3,500 kmで、不確かさは約500 kmです。Dumoulin らのモデルでは2,900〜3,450 kmです。",
  },
};

// Nettelmann et al. (2013), Table 2 and Figure 4. Both use the modified shape and rotation data.
// Use each model's mean radius and envelope transition. The core near 0.15 of the radius is read from the figure.
const ICE_GIANT_SOURCE = { page: "https://doi.org/10.1016/j.pss.2012.06.019", read: "2026-11-27" };
const URANUS_MODEL_RADIUS_KM = 25378;
const URANUS: Interior = {
  body: "uranus",
  radiusKm: URANUS_MODEL_RADIUS_KM,
  radiusAbout: false,
  source: ICE_GIANT_SOURCE,
  layers: [
    { id: "rock-core", name: { en: "Rocky core", ja: "岩石の核" }, madeOf: { en: "rock", ja: "岩石" }, outerKm: 0.15 * URANUS_MODEL_RADIUS_KM, about: true, colour: "#c59b71" },
    { id: "inner-envelope", name: { en: "Inner envelope", ja: "内層" }, madeOf: { en: "mostly heavy material", ja: "主に重い成分" }, outerKm: 0.757 * URANUS_MODEL_RADIUS_KM, about: true, colour: "#346d79" },
    { id: "outer-envelope", name: { en: "Outer envelope", ja: "外層" }, madeOf: { en: "mostly hydrogen and helium", ja: "主に水素とヘリウム" }, outerKm: URANUS_MODEL_RADIUS_KM, about: false, colour: "#7bb8b4" },
  ],
  note: { en: "Nettelmann et al.’s U2 model uses water to represent heavy material.", ja: "Nettelmann らの U2 モデルでは、重い成分を水で代表させています。" },
};
const NEPTUNE_MODEL_RADIUS_KM = 24650;
const NEPTUNE: Interior = {
  body: "neptune",
  radiusKm: NEPTUNE_MODEL_RADIUS_KM,
  radiusAbout: false,
  source: ICE_GIANT_SOURCE,
  layers: [
    { id: "rock-core", name: { en: "Rocky core", ja: "岩石の核" }, madeOf: { en: "rock", ja: "岩石" }, outerKm: 0.15 * NEPTUNE_MODEL_RADIUS_KM, about: true, colour: "#c59b71" },
    { id: "inner-envelope", name: { en: "Inner envelope", ja: "内層" }, madeOf: { en: "heavy material", ja: "重い成分" }, outerKm: 0.605 * NEPTUNE_MODEL_RADIUS_KM, about: true, colour: "#365887" },
    { id: "outer-envelope", name: { en: "Outer envelope", ja: "外層" }, madeOf: { en: "hydrogen, helium and heavy material", ja: "水素、ヘリウム、重い成分" }, outerKm: NEPTUNE_MODEL_RADIUS_KM, about: false, colour: "#739dca" },
  ],
  note: { en: "Nettelmann et al.’s N2b model uses water to represent heavy material.", ja: "Nettelmann らの N2b モデルでは、重い成分を水で代表させています。" },
};

const INTERIORS: Partial<Record<BodyId, Interior>> = {
  sun: SUN, mercury: MERCURY, venus: VENUS, earth: EARTH, mars: MARS,
  jupiter: JUPITER, saturn: SATURN, uranus: URANUS, neptune: NEPTUNE, moon: MOON,
};

/**
 * The interior of a body, or `undefined` when this package has no sourced figures for it. The layers run from the centre outward.
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
  return Object.hasOwn(INTERIORS, bodyId) ? INTERIORS[bodyId as BodyId] : undefined;
}

/** The legend's heading: the numbers are depth from the surface, not radius from the centre. */
export function interiorDepthHeading(lang: "en" | "ja"): string {
  return lang === "ja" ? "表面から下へ" : "From the surface down";
}

export type CutSize = "half" | "quarter";

/** Centre angle and angular half-width of the opening, measured from the camera's +Z line. */
export function cutOpening(size: CutSize): readonly [centre: number, halfWidth: number] {
  // Slightly offset the opening so both the faces and the rounded exterior read in depth.
  return size === "half" ? [0.59, Math.PI / 2] : [0.24, Math.PI / 4];
}

/** Whether a point falls in the camera-facing opening. */
export function inCutOpening(point: readonly [number, number, number], size?: CutSize): boolean {
  const [centre, width] = size === undefined ? [0, Math.PI / 4] : cutOpening(size);
  return (point[0] !== 0 || point[2] !== 0) && Math.abs(Math.atan2(point[0], point[2]) - centre) < width;
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
  return interior === undefined ? undefined : rowsForInterior(interior, lang);
}
