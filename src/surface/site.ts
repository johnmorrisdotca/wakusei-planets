// The sites a person can stand at, one table, on the Moon and Mars. A site's ground is either measured (a pyramid of tiles made by `scripts/make-moon-terrain.py`) or, until a height model is added for it, a flat stand-in at the site's datum: never made-up relief.
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
  body: "moon" | "mars";
  /**
   * What the ground is: `measured` (height tiles made from a published height model) or `flat`, a flat stand-in at the site's datum until a model is added. A flat site has no relief, no made craters and no made rocks, and says so in the line the page shows.
   */
  ground: "measured" | "flat";
  /** The body's surface gravity at the site, m/s2: what the driven rover and the thrown dust fall at. */
  gravity: number;
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
 * The Moon's surface gravity, m/s2.
 *
 * @example
 * ```ts
 * import { MOON_GRAVITY } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(`${MOON_GRAVITY} m/s2, a sixth of the Earth's`);
 * ```
 */
export const MOON_GRAVITY = 1.62;
/**
 * Mars's surface gravity, m/s2 (NASA's fact sheet gives 3.73 as the mean and 3.69 at the equator; 3.71 is the figure the standing view uses).
 *
 * @example
 * ```ts
 * import { MARS_GRAVITY, MOON_GRAVITY } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(`Mars pulls ${(MARS_GRAVITY / MOON_GRAVITY).toFixed(1)} times as hard as the Moon`);
 * ```
 */
export const MARS_GRAVITY = 3.71;

/**
 * The sites a person can stand at. Apollo 17 is the one with measured heights: it stands in Taurus-Littrow, a valley a few kilometres wide between mountains 2 kilometres high; it is first looked at toward the South Massif,
 * at the moment of the landing, with the Sun 13 degrees up and the Earth above the mountain. Perseverance (Jezero), Curiosity (Gale), Apollo 15, Apollo 16, Chang'e 3 and Chang'e 4 have the real Sun, sky and gravity of
 * their place and time and a flat stand-in for the ground (`ground: "flat"`) until a height model is added. 
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
    ground: "measured",
    gravity: MOON_GRAVITY,
    name: { en: "Apollo 17, Taurus-Littrow", ja: "アポロ17号、タウルス・リットロー" },
    lat: 20.1911,
    lon: 30.7723,
    place: "moon/apollo-17-lunar-module",
    time: Date.UTC(1972, 11, 11, 19, 54),
    look: { azimuth: 232, pitch: 13, fov: 74 },
  },
  {
    id: "perseverance",
    body: "mars",
    ground: "flat",
    gravity: MARS_GRAVITY,
    name: { en: "Perseverance, Jezero", ja: "パーシビアランス、ジェゼロ" },
    lat: 18.4446,
    lon: 77.4508,
    place: "mars/perseverance",
    time: Date.UTC(2021, 1, 18, 20, 43),
    look: { azimuth: 90, pitch: 4, fov: 74 },
  },
  {
    id: "curiosity",
    body: "mars",
    ground: "flat",
    gravity: MARS_GRAVITY,
    name: { en: "Curiosity, Gale", ja: "キュリオシティ、ゲール" },
    lat: -4.5895,
    lon: 137.4417,
    place: "mars/curiosity",
    time: Date.UTC(2012, 7, 6, 5, 17),
    look: { azimuth: 90, pitch: 4, fov: 74 },
  },
  {
    id: "apollo-15",
    body: "moon",
    ground: "flat",
    gravity: MOON_GRAVITY,
    name: { en: "Apollo 15, Hadley-Apennine", ja: "アポロ15号、ハドリー・アペニン" },
    lat: 26.1324,
    lon: 3.6333,
    place: "moon/apollo-15-lunar-module",
    time: Date.UTC(1971, 6, 30, 22, 16),
    look: { azimuth: 90, pitch: 4, fov: 74 },
  },
  {
    id: "apollo-16",
    body: "moon",
    ground: "flat",
    gravity: MOON_GRAVITY,
    name: { en: "Apollo 16, Descartes", ja: "アポロ16号、デカルト高地" },
    lat: -8.9734,
    lon: 15.5011,
    place: "moon/apollo-16-lunar-module",
    time: Date.UTC(1972, 3, 21, 2, 23),
    look: { azimuth: 90, pitch: 4, fov: 74 },
  },
  {
    id: "chang-e-3",
    body: "moon",
    ground: "flat",
    gravity: MOON_GRAVITY,
    name: { en: "Chang'e 3 and Yutu, Mare Imbrium", ja: "嫦娥3号と玉兎号、雨の海" },
    lat: 44.1214,
    lon: -19.5117,
    place: "moon/chang-e-3",
    time: Date.UTC(2013, 11, 14, 13, 11),
    look: { azimuth: 90, pitch: 4, fov: 74 },
  },
  {
    id: "chang-e-4",
    body: "moon",
    ground: "flat",
    gravity: MOON_GRAVITY,
    name: { en: "Chang'e 4 and Yutu-2, Von Karman", ja: "嫦娥4号と玉兎2号、フォン・カルマン" },
    lat: -45.4561,
    lon: 177.5885,
    place: "moon/chang-e-4",
    time: Date.UTC(2019, 0, 3, 2, 26),
    look: { azimuth: 90, pitch: 4, fov: 74 },
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
