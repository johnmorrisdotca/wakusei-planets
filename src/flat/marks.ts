// The marks a page lays on the flat map: points on the ground with a name, a shape and a colour, in groups the key names. They are the way in for anything a page wants on the map (the moons' sub-points, favourites, orbiters, landers).
// Pure: no DOM.
import { wrapLongitude } from "./geometry.ts";
import type { FlatLang } from "./words.ts";

/**
 * The shapes a mark can have.
 *
 * @example
 * ```ts
 * import { MARK_SHAPES } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(MARK_SHAPES.join(", "));
 * ```
 */
export const MARK_SHAPES = ["dot", "ring", "diamond", "square", "cross", "star"] as const;

/**
 * A mark's shape.
 *
 * @example
 * ```ts
 * import type { MarkShape } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const shape: MarkShape = "star";
 * console.log(shape);
 * ```
 */
export type MarkShape = (typeof MARK_SHAPES)[number];

/**
 * A name in one language or in both.
 *
 * @example
 * ```ts
 * import type { MarkText } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const name: MarkText = { en: "Io", ja: "イオ" };
 * console.log(name.en);
 * ```
 */
export type MarkText = string | { readonly en: string; readonly ja?: string };

/**
 * One mark on the flat map: a place on the ground. The page names it; the map draws it, names it when it is pointed at, pressed or reached by the keyboard, and sends `wakusei-flat-pick` (`kind: "mark"`) when it is chosen.
 *
 * @example
 * ```ts
 * import type { FlatMark } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const olympus: FlatMark = { id: "olympus", lat: 18.65, lon: -133.8, name: { en: "Olympus Mons", ja: "オリンポス山" }, shape: "diamond", colour: "#ffd23f" };
 * console.log(olympus.name);
 * ```
 */
export interface FlatMark {
  /** Names the mark, and no other mark of the element has the same (a later one with the same id replaces the earlier). */
  id: string;
  /** Degrees north (negative south), -90 to 90. */
  lat: number;
  /** Degrees east (negative west). The map wraps, so 190 and -170 are the same place. */
  lon: number;
  /** What it is called: one text for every language, or `{ en, ja }` (a missing `ja` is said in English). */
  name: MarkText;
  /** The group it belongs to, which the key names (`setMarks`'s group is used when this is left out). */
  group?: string;
  /** The shape: `dot` by default. */
  shape?: MarkShape;
  /** A CSS colour: white by default. */
  colour?: string;
  /** The size, as the radius in pixels: 4 by default, between 2 and 12. */
  size?: number;
  /** True to write the name beside the mark, where there is room. The name is always read to a screen reader and shown when the mark is pointed at. */
  labelled?: boolean;
  /** Anything the page wants back in the pick event. */
  data?: unknown;
}

/**
 * A mark the map holds: the page's record with its group, shape and size filled in, and the position wrapped.
 *
 * @example
 * ```ts
 * import { readMarks, type HeldMark } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const held: HeldMark = readMarks("moons", [{ id: "io", lat: 0, lon: 190, name: "Io" }])[0]!;
 * console.log(held.lon, held.shape, held.group);
 * ```
 */
export interface HeldMark extends FlatMark {
  group: string;
  shape: MarkShape;
  size: number;
}

/**
 * Check a list of marks and fill in what is left out: a mark with no finite place or no id or name is dropped, a longitude is wrapped to -180 up to 180, a latitude is held to the poles, a shape the map does not know is a dot, the size is held between 2 and 12 and a later mark with the same id replaces the earlier.
 *
 * @param group - The group a mark with none of its own belongs to.
 * @param marks - The page's marks.
 * @returns The marks the map holds, in the order given.
 *
 * @example
 * ```ts
 * import { readMarks } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const held = readMarks("favourites", [
 *   { id: "a", lat: 95, lon: 200, name: "A" },
 *   { id: "b", lat: Number.NaN, lon: 0, name: "B" },
 * ]);
 * console.log(held.length, held[0]!.lat, held[0]!.lon);
 * ```
 */
export function readMarks(group: string, marks: readonly FlatMark[]): HeldMark[] {
  const out = new Map<string, HeldMark>();
  for (const mark of marks) {
    if (typeof mark?.id !== "string" || mark.id === "" || !Number.isFinite(mark.lat) || !Number.isFinite(mark.lon)) continue;
    if (markName(mark.name, "en") === "") continue;
    const size = Number.isFinite(mark.size) ? Math.min(12, Math.max(2, mark.size as number)) : 4;
    out.delete(mark.id);
    out.set(mark.id, { ...mark, group: mark.group ?? group, shape: (MARK_SHAPES as readonly string[]).includes(mark.shape ?? "dot") ? (mark.shape ?? "dot") : "dot", size, lat: Math.max(-90, Math.min(90, mark.lat)), lon: wrapLongitude(mark.lon) });
  }
  return [...out.values()];
}

/**
 * A mark's name in a language: the text itself, or the language's own and else the English.
 *
 * @param name - A mark's `name`.
 * @param lang - `en` or `ja`.
 * @returns The name.
 *
 * @example
 * ```ts
 * import { markName } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(markName({ en: "Io", ja: "イオ" }, "ja"), markName("Io", "ja"), markName({ en: "Io" }, "ja"));
 * ```
 */
export const markName = (name: MarkText | undefined, lang: FlatLang): string => (name === undefined ? "" : typeof name === "string" ? name : ((lang === "ja" ? name.ja : undefined) ?? name.en ?? ""));
