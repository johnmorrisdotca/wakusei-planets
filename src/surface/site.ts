// The sites a person can stand at, one table. Each is a place the package has heights for (a pyramid of tiles made by `scripts/make-moon-terrain.py`).
import type { Look } from "./view.ts";

/**
 * A site's record.
 *
 * @example
 * ```ts
 * import { siteById, type SurfaceSite } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const site: SurfaceSite | undefined = siteById("apollo-17");
 * console.log(site?.name.en, site?.lat, site?.lon);
 * ```
 */
export interface SurfaceSite {
  /** The name in the `site` attribute. */
  id: string;
  /** The body it is on. */
  body: "moon";
  name: { en: string; ja: string };
  /** Planetocentric degrees. */
  lat: number;
  lon: number;
  /** The site's place in the Moon's list of places (`/places`), which the orbit view turns to when it lands here. */
  place: string;
  /** A moment with a low Sun and long shadows, milliseconds since 1970: the landing itself. */
  time: number;
  /** Where to look first: toward the biggest mountain near. */
  look: Look;
}

/**
 * The sites with heights. The Apollo 17 landing site stands in Taurus-Littrow, a valley a few kilometres wide between mountains 2 kilometres high; it is first looked at toward the South Massif,
 * at the moment of the landing, with the Sun 13 degrees up and the Earth above the mountain.
 *
 * @example
 * ```ts
 * import { SURFACE_SITES } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(SURFACE_SITES.map((site) => site.id).join(", "));
 * ```
 */
export const SURFACE_SITES: readonly SurfaceSite[] = [
  {
    id: "apollo-17",
    body: "moon",
    name: { en: "Apollo 17, Taurus-Littrow", ja: "アポロ17号、タウルス・リットロー" },
    lat: 20.1911,
    lon: 30.7723,
    place: "moon/apollo-17-lunar-module",
    time: Date.UTC(1972, 11, 11, 19, 54),
    look: { azimuth: 232, pitch: 13, fov: 74 },
  },
];

/**
 * A site by name, or `undefined`.
 *
 * @param id - The site's name, as in the `site` attribute.
 * @returns The site's record, or `undefined` when there is no such site.
 *
 * @example
 * ```ts
 * import { siteById } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const site = siteById("apollo-17");
 * console.log(site?.name.en, siteById("nowhere"));
 * ```
 */
export const siteById = (id: string): SurfaceSite | undefined => SURFACE_SITES.find((site) => site.id === id);
