// Which names of the space view are shown: no two overlap. The nearer to the middle of things a body is in rank (the Sun, then a planet, then a dwarf planet, then a moon), the surer its name; a name that would cover
// a stronger one is left out. Pure: boxes in, the ids shown out.

/**
 * A name waiting for a place: its box on the screen in CSS pixels and how sure its place is (lower is surer).
 *
 * @example
 * ```ts
 * import type { LabelBox } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const box: LabelBox = { id: "mars", x: 120, y: 80, width: 44, height: 16, rank: 2, size: 6 };
 * console.log(box.id, box.rank);
 * ```
 */
export interface LabelBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0 is the surest: the body looked at, then the Sun, a planet, a dwarf planet, a moon. */
  rank: number;
  /** Breaks a tie of rank: the bigger body on the screen wins. */
  size: number;
}

/**
 * The room kept between two names, in CSS pixels, so they never touch.
 *
 * @example
 * ```ts
 * import { LABEL_GAP } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(LABEL_GAP);
 * ```
 */
export const LABEL_GAP = 3;

const crosses = (a: LabelBox, b: LabelBox, gap: number): boolean => a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;

/**
 * The names to show from those that want a place: the surest first, and each kept only if it does not touch one already kept. A moon gives way to its planet and a planet to the Sun, because their ranks say so.
 *
 * @param boxes - The names with their boxes and ranks.
 * @param gap - The room to keep between two names, in CSS pixels.
 * @returns The ids to show.
 *
 * @example
 * ```ts
 * import { chooseLabels } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const shown = chooseLabels([
 *   { id: "earth", x: 10, y: 10, width: 40, height: 16, rank: 1, size: 20 },
 *   { id: "moon", x: 30, y: 12, width: 40, height: 16, rank: 3, size: 5 },
 * ]);
 * console.log([...shown]);
 * ```
 */
export function chooseLabels(boxes: readonly LabelBox[], gap = LABEL_GAP): Set<string> {
  const order = [...boxes].sort((a, b) => a.rank - b.rank || b.size - a.size || (a.id < b.id ? -1 : 1));
  const kept: LabelBox[] = [];
  for (const box of order) if (!kept.some((other) => crosses(box, other, gap))) kept.push(box);
  return new Set(kept.map((box) => box.id));
}
