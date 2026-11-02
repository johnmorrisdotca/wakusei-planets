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
  /** How much of the map's brightness is also relief. Default 0. */
  relief?: number;
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
  /** How strongly the height shows as relief, 0 to 2. Default 0.6. */
  relief?: number;
  /** How far light wraps round the terminator: 0 is a hard edge (no air), 0.3 a soft one. Default 0.04, or 0.3 with an atmosphere. */
  wrap?: number;
  /** How much of the night side shows (0 to 1). Default 0.04. */
  ambient?: number;
  painted?: PaintedMap;
}

import { looks, waiting } from "./store.ts";

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
