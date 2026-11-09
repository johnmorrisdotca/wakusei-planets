// What a body needs to be drawn with three.js: the surface as shader code, how bright it glows, its atmosphere and its painted map. Each body's own entry point registers its look here;
// the element finds it by name. Pure data and strings, so it imports on a server.
import type { BodyId } from "../facts.ts";

/**
 * A rim of air: the colour it scatters (0 to 1 each), how strong it is and how thin the rim is.
 *
 * @example
 * ```ts
 * import { registerLook, type Atmosphere } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * const air: Atmosphere = { colour: [0.5, 0.7, 1], strength: 0.4 };
 * registerLook({ id: "venus", surface: "vec4 surface(vec3 p) { return vec4(vec3(0.9), 0.0); }", atmosphere: air });
 * console.log(air.strength);
 * ```
 */
export interface Atmosphere {
  colour: readonly [number, number, number];
  strength: number;
  /** How thin the rim is: higher is thinner. Default 3. */
  power?: number;
}

/**
 * The painted look of a body: a surface map in the package's `textures` folder, as widths from the smallest up.
 *
 * @example
 * ```ts
 * import { type PaintedMap } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * const map: PaintedMap = { map: "mars", widths: [512, 1024, 2048] };
 * console.log(map.widths.length);
 * ```
 */
export interface PaintedMap {
  /** The file name before `-<width>.webp`, for example `mars`. */
  map: string;
  /** The widths made, smallest first: the smallest is drawn first and sharper ones are fetched when the view is zoomed in. */
  widths: readonly number[];
  /** The smallest width that is not in the npm package: it is fetched from the repository's own files (see `texture-far-base`). */
  far?: number;
  /** How much of the map's brightness is also relief. Default 0. */
  relief?: number;
  /**
   * Weather drawn on the map so a turn can be seen. `bands` is a wave and a spot that move with longitude.
   * `hexagon` is that wave plus the six-sided storm at the north pole. A map of plain bands shows no turn without it.
   */
  turn?: "bands" | "hexagon";
  /** A picture of the body's rings for this look, one pixel high: colour and opacity from the inner edge to the outer, `width` samples. Used instead of the table's strip when it loads. */
  rings?: { map: string; width: number; from: number; to: number };
  /** The painted pictures' credit line, for the page. */
  credit?: string;
}

/**
 * What a body looks like in three.js: the shader code of its surface, how it glows, its atmosphere and its painted map.
 *
 * @example
 * ```ts
 * import { registerLook, type BodyLook } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * const look: BodyLook = { id: "moon", surface: "vec4 surface(vec3 p) { return vec4(vec3(0.7), 0.0); }", ambient: 0.02 };
 * console.log(registerLook(look).id);
 * ```
 */
export interface BodyLook {
  id: BodyId;
  /** GLSL that defines `vec4 surface(vec3 p)`: `p` is the unit position on the body (x toward longitude 0 on the equator, y toward 90 degrees east, z the north pole); return the colour in `rgb` and the height in `a`. */
  surface: string;
  /** A glowing body (the Sun): no shading from outside light. */
  emissive?: boolean;
  atmosphere?: Atmosphere;
  /** How much the disc darkens toward the limb, 0 to 1. Default 0. */
  limb?: number;
  /** For a glowing body: the colour its edge shifts to as it darkens (0 to 1 each). Default the Sun's, orange. */
  limbTint?: readonly [number, number, number];
  /** For a glowing body: its soft corona. The colour (0 to 1 each), how strong it is and how fast it fades (higher is tighter). Default the Sun's glow. */
  glow?: { colour: readonly [number, number, number]; strength: number; spread: number; /** How bright the thin glowing edge is. Default 0. */ rim?: number; /** How big the prominences and flares on the edge are, 0 to 1. Default 0. */ prominence?: number; /** 0 to 1: where on the edge they are. */ seed?: number };
  /** How strongly the height shows as relief, 0 to 2. Default 0.6. */
  relief?: number;
  /** How far light wraps round the terminator: 0 is a hard edge (no air), 0.3 a soft one. Default 0.04, or 0.3 with an atmosphere. */
  wrap?: number;
  /** How much of the night side shows (0 to 1). Default 0.04. */
  ambient?: number;
  /**
   * The generic fine detail of a close view (noise, not a measured feature): how strong (0 to 1, default 0.32; 0 for none) and how much it is stretched along the lines of latitude (1 is none; a gas giant's streaks 3). A glowing body takes none.
   * Where a map or a shader is enlarged more than about a quarter, octaves of it are added so the body does not go smooth.
   */
  detail?: { amount?: number; stretch?: number };
  painted?: PaintedMap;
  /** Draw the painted map in the realistic look too: for a body with no honest drawing from numbers (the Earth's continents). */
  mapped?: boolean;
}

import type { StarLook, StarNumbers } from "../star.ts";
import { starLook } from "../star.ts";
import { looks, stars, waiting } from "./store.ts";

const SMOOTH: Partial<Record<BodyId, { amount: number; stretch: number }>> = {
  jupiter: { amount: 0.11, stretch: 7 },
  saturn: { amount: 0.06, stretch: 12 },
  uranus: { amount: 0.04, stretch: 8 },
  neptune: { amount: 0.05, stretch: 8 },
  venus: { amount: 0.07, stretch: 4 },
  titan: { amount: 0.06, stretch: 4 },
  earth: { amount: 0.2, stretch: 1 },
};

/**
 * The strength and stretch of a body's generic fine detail: its own `detail`, else the table's for a body that is smooth (the gas giants, Venus, Titan) or the rocky default.
 *
 * @param look - The body's look.
 * @returns How strong it is (0 to 1) and how much it is stretched along the lines of latitude.
 *
 * @example
 * ```ts
 * import { detailOf, lookOf } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * const look = lookOf("mars");
 * console.log(look === undefined ? "no look" : detailOf(look).amount);
 * ```
 */
export function detailOf(look: BodyLook): { amount: number; stretch: number } {
  if (look.emissive === true) return { amount: 0, stretch: 1 };
  const own = SMOOTH[look.id];
  return { amount: look.detail?.amount ?? own?.amount ?? 0.32, stretch: look.detail?.stretch ?? own?.stretch ?? 1 };
}

/**
 * Teach the package how to draw a body in three.js. Each body's entry point (`@johnmorrisdotca/wakusei-planets/jupiter`) calls this once as it loads; call it yourself to add or replace a look.
 *
 * @param look - The body's name and its shader code, atmosphere and map.
 * @returns The look, as it was given.
 *
 * @example
 * ```ts
 * import { registerLook, lookOf } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * registerLook({ id: "moon", surface: "vec4 surface(vec3 p) { return vec4(vec3(0.6), 0.0); }" });
 * console.log(lookOf("moon")?.id);
 * ```
 */
export function registerLook(look: BodyLook): BodyLook {
  looks.set(look.id, look);
  for (const wake of waiting) wake();
  return look;
}

/**
 * The look registered for a body, or `undefined` when its entry point has not been imported.
 *
 * @param id - The body's name.
 * @returns The registered look, or `undefined` for a body with none.
 *
 * @example
 * ```ts
 * import { lookOf } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * console.log(lookOf("jupiter") === undefined);
 * ```
 */
export const lookOf = (id: BodyId): BodyLook | undefined => looks.get(id);

/**
 * Teach the package a star by name, so an element can be told `star="Betelgeuse"` and draw it from these numbers. The package holds no catalogue of stars: this is where a page puts the few it draws.
 * The name is matched without regard to case. Registering a name again replaces it.
 *
 * @param name - What the star is called in the `star` attribute.
 * @param numbers - The star's numbers.
 * @returns The star, ready to draw.
 *
 * @example
 * ```ts
 * import { registerStarLook, starLookOf } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * registerStarLook("Proxima Centauri", { temperatureK: 3042, radiusSun: 0.154, luminosityClass: "V", rotationDays: 83 });
 * console.log(starLookOf("proxima centauri")?.colour);
 * ```
 */
export function registerStarLook(name: string, numbers: StarNumbers): StarLook {
  const made = starLook({ name, ...numbers });
  stars.set(name.trim().toLowerCase(), made);
  for (const wake of waiting) wake();
  return made;
}

/**
 * The star registered under a name, or `undefined`.
 *
 * @param name - The name given to `registerStarLook`, in any case.
 * @returns The star, or `undefined` when none is registered by that name.
 *
 * @example
 * ```ts
 * import { starLookOf } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * console.log(starLookOf("Vega") === undefined);
 * ```
 */
export const starLookOf = (name: string): StarLook | undefined => stars.get(name.trim().toLowerCase());
