// Styled orbits a page asks for: a short list of bodies, each in a named look, and which of those lines a point of the picture is on.
// The looks differ by width and dash as well as colour, so a reader who cannot tell the colours apart can still tell the lines apart. Pure: no DOM, no three.js.
// The names and the fields are the same shape a page already uses for a path on the Earth.
import { ORBITS } from "../data/orbits.ts";
import { orbitSpanMs } from "./frame.ts";

const DAY_MS = 86_400_000;

/**
 * How a path is drawn: its colour, its width in CSS pixels, how opaque it is, and its dashes (a dash and a gap, in CSS pixels, or `null` for a solid line).
 *
 * @example
 * ```ts
 * import type { PathStyle } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const look: PathStyle = { color: "#ffd166", width: 1.75, opacity: 0.85, dash: [3, 4] };
 * console.log(look.dash === null);
 * ```
 */
export interface PathStyle {
  /** Any CSS colour. */
  color: string;
  /** CSS pixels, 0.5 to 8. */
  width: number;
  /** 0 to 1. */
  opacity: number;
  /** `[dash, gap]` in CSS pixels, each 1 to 64, or `null` for a solid line. */
  dash: [number, number] | null;
}

/**
 * One path to draw: a body's name, and its look, as the name of an entry of the style table or as a partial look over the `path` entry.
 *
 * @example
 * ```ts
 * import type { PathRequest } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const path: PathRequest = { id: "mars", style: "favourite" };
 * console.log(path.id);
 * ```
 */
export interface PathRequest {
  id: string;
  style?: string | Partial<PathStyle>;
}

/**
 * A styled path as the screen shows it, for the hit test. `xy` is x, y, x, y in CSS pixels, with NaN where the line is behind the camera.
 *
 * @example
 * ```ts
 * import type { PathScreen } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const line: PathScreen = { id: "mars", style: "favourite", xy: [0, 0, 40, 0] };
 * console.log(line.xy.length);
 * ```
 */
export interface PathScreen {
  id: string;
  style: string;
  xy: ArrayLike<number>;
}

/**
 * The styled path under a point.
 *
 * @example
 * ```ts
 * import type { PathHit } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const hit: PathHit = { id: "mars", style: "favourite", x: 20, y: 1, distancePx: 1 };
 * console.log(hit.id);
 * ```
 */
export interface PathHit {
  id: string;
  style: string;
  /** CSS pixels from the element's left and top: the point on the path nearest the pointer. */
  x: number;
  y: number;
  /** How far, in CSS pixels, the pointer is from that point. */
  distancePx: number;
}

/**
 * The most styled paths drawn at once. A longer list keeps the last of it.
 *
 * @example
 * ```ts
 * import { MAX_PATHS } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(MAX_PATHS);
 * ```
 */
export const MAX_PATHS = 16;

/**
 * How long one drawn trip takes, in milliseconds: a moon's trip round its planet, or a planet's, dwarf planet's or minor body's trip round the Sun. The Sun and any other name have none.
 *
 * @param id - A body's name, already in the package's lower case (`mars`, `io`, `moon`).
 * @returns The span, or `null` when that body has no orbit to draw.
 *
 * @example
 * ```ts
 * import { pathSpanMs } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(pathSpanMs("mars") !== null, pathSpanMs("sun"));
 * ```
 */
export function pathSpanMs(id: string): number | null {
  const moon = ORBITS[id];
  if (moon !== undefined && Math.abs(moon.sid) > 0) return (360 / Math.abs(moon.sid)) * DAY_MS;
  return orbitSpanMs(id);
}

/** The path hit radius in CSS pixels when the page does not say, and its range. A touch is given twice as much, and at least {@link TOUCH_HIT_MIN}. */
export const DEFAULT_PATH_HIT = 8;
export const MAX_PATH_HIT = 40;
export const TOUCH_HIT_MIN = 16;

const MIN_WIDTH = 0.5;
const MAX_WIDTH = 8;

/**
 * The look of each name before a page overrides any. They differ in width and dash, not only in colour.
 *
 * @example
 * ```ts
 * import { BUILT_IN_PATH_STYLES } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(BUILT_IN_PATH_STYLES.selected.dash, BUILT_IN_PATH_STYLES.hovered.dash);
 * ```
 */
export const BUILT_IN_PATH_STYLES: Readonly<Record<string, PathStyle>> = {
  selected: { color: "#ffffff", width: 2, opacity: 0.85, dash: null },
  hovered: { color: "#ffffff", width: 1.5, opacity: 0.6, dash: [6, 4] },
  favourite: { color: "#ffd166", width: 1.75, opacity: 0.85, dash: [3, 4] },
  path: { color: "#ffffff", width: 1.5, opacity: 0.8, dash: null },
};

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/**
 * Take a look a page gave and make a whole one: what is missing or out of range is taken from `base`.
 *
 * @param given - The page's look, any part of it.
 * @param base - The look to fall back on.
 * @returns A look with every part set.
 *
 * @example
 * ```ts
 * import { BUILT_IN_PATH_STYLES, completeStyle } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(completeStyle({ width: 3 }, BUILT_IN_PATH_STYLES.favourite).width);
 * ```
 */
export function completeStyle(given: Partial<PathStyle> | null | undefined, base: PathStyle): PathStyle {
  const out: PathStyle = { ...base, dash: base.dash ? [...base.dash] : null };
  if (!given || typeof given !== "object") return out;
  if (typeof given.color === "string" && given.color.trim() !== "") out.color = given.color.trim();
  if (typeof given.width === "number" && Number.isFinite(given.width)) out.width = clamp(given.width, MIN_WIDTH, MAX_WIDTH);
  if (typeof given.opacity === "number" && Number.isFinite(given.opacity)) out.opacity = clamp(given.opacity, 0, 1);
  if (given.dash === null) out.dash = null;
  else if (Array.isArray(given.dash) && given.dash.length === 2 && given.dash.every((n) => typeof n === "number" && Number.isFinite(n))) out.dash = [clamp(given.dash[0]!, 1, 64), clamp(given.dash[1]!, 1, 64)];
  return out;
}

/**
 * The table of looks in use: the built-in ones with the page's own laid over them. `null` takes a page's entry away.
 *
 * @param overrides - The page's entries.
 * @returns The whole table.
 *
 * @example
 * ```ts
 * import { styleTable } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(styleTable({ favourite: { width: 3 } }).favourite.width);
 * ```
 */
export function styleTable(overrides: Readonly<Record<string, Partial<PathStyle> | null>>): Record<string, PathStyle> {
  const table: Record<string, PathStyle> = {};
  for (const [name, style] of Object.entries(BUILT_IN_PATH_STYLES)) table[name] = completeStyle(null, style);
  for (const [name, given] of Object.entries(overrides)) {
    if (given === null || name === "") continue;
    table[name] = completeStyle(given, table[name] ?? BUILT_IN_PATH_STYLES.path!);
  }
  return table;
}

/** The part of a list that is drawn: the last {@link MAX_PATHS}. */
export function capPaths<T>(list: readonly T[]): { kept: T[]; dropped: number } {
  const dropped = Math.max(0, list.length - MAX_PATHS);
  return { kept: list.slice(dropped), dropped };
}

/** The look of one request: a name in the table, a partial look over `path`, or `path` itself. A name the table does not have is `path`. */
export function styleOf(request: PathRequest, table: Readonly<Record<string, PathStyle>>): { name: string; style: PathStyle } {
  const given = request.style;
  const base = table.path ?? BUILT_IN_PATH_STYLES.path!;
  if (given === undefined) return { name: "path", style: base };
  if (typeof given === "string") return table[given] ? { name: given, style: table[given]! } : { name: "path", style: base };
  return { name: "custom", style: completeStyle(given, base) };
}

/** Read `path-hit`: CSS pixels from 0 to {@link MAX_PATH_HIT}, `off` for 0, and the default for anything else. */
export function readPathHit(value: string | null): number {
  if (value === null || value.trim() === "") return DEFAULT_PATH_HIT;
  const text = value.trim().toLowerCase();
  if (text === "off") return 0;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? Math.min(MAX_PATH_HIT, number) : DEFAULT_PATH_HIT;
}

/** The radius a pointer finds a path within. A touch is given twice the page's radius, and at least {@link TOUCH_HIT_MIN}. `0` is no test. */
export function hitRadius(base: number, pointer: "mouse" | "touch" | "pen"): number {
  if (!(base > 0)) return 0;
  return pointer === "touch" ? Math.max(TOUCH_HIT_MIN, base * 2) : base;
}

/**
 * The styled path nearest a point, within `radius`. A segment is left out where either end is not a number (the line is behind the camera there).
 *
 * @param lines - The paths on the screen.
 * @param pointer - The point, in CSS pixels.
 * @param radius - How far from a line still counts.
 * @returns The nearest path, or `null`.
 *
 * @example
 * ```ts
 * import { nearestPath } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(nearestPath([{ id: "mars", style: "path", xy: [0, 0, 10, 0] }], { x: 5, y: 1 }, 8)?.id);
 * ```
 */
export function nearestPath(lines: readonly PathScreen[], pointer: { x: number; y: number }, radius: number): PathHit | null {
  if (!(radius > 0)) return null;
  let best: PathHit | null = null;
  for (const line of lines) {
    const p = line.xy;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i]!;
      const ay = p[i + 1]!;
      const bx = p[i + 2]!;
      const by = p[i + 3]!;
      if (ax !== ax || bx !== bx || ay !== ay || by !== by) continue;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? clamp(((pointer.x - ax) * dx + (pointer.y - ay) * dy) / len2, 0, 1) : 0;
      const x = ax + dx * t;
      const y = ay + dy * t;
      const distance = Math.hypot(pointer.x - x, pointer.y - y);
      if (distance <= radius && (best === null || distance < best.distancePx)) best = { id: line.id, style: line.style, x, y, distancePx: distance };
    }
  }
  return best;
}
