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

/**
 * Where a floating name goes: beside its body's dot, and kept inside the view (MODULES-1144). It starts to the right of the dot, at `max(4, min(r, 40))` pixels from its middle and 8 pixels above it. A name that would run past the right edge goes to the dot's left side instead (`flipped`); one that fits on neither side is held against the edge, and a name past the top or the bottom is held inside. A body whose dot is itself outside the view keeps its name where it falls, since the view cuts it with the body.
 *
 * @param dot - The body's place on the screen in CSS pixels: its middle and its radius on the screen.
 * @param size - The name's width and height in CSS pixels.
 * @param frame - The view's width and height in CSS pixels.
 * @returns The name's top-left corner, and whether it went to the left of the dot.
 *
 * @example
 * ```ts
 * import { nameSpot } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * // a body 20 pixels from the right edge of a 400 pixel view: its 60 pixel name goes to the left of it
 * const spot = nameSpot({ x: 380, y: 100, r: 10 }, { width: 60, height: 16 }, { width: 400, height: 300 });
 * console.log(spot.flipped, spot.x + 60 <= 380);
 * ```
 */
export function nameSpot(dot: { x: number; y: number; r: number }, size: { width: number; height: number }, frame: { width: number; height: number }): { x: number; y: number; flipped: boolean } {
  const gap = Math.max(4, Math.min(dot.r, 40));
  let x = Math.round(dot.x + gap);
  let y = Math.round(dot.y - 8);
  let flipped = false;
  if (frame.width <= 0 || frame.height <= 0) return { x, y, flipped };
  if (dot.x >= 0 && dot.x <= frame.width) {
    if (x + size.width > frame.width) {
      const left = Math.round(dot.x - gap - size.width);
      if (left >= 0) {
        x = left;
        flipped = true;
      } else x = Math.max(0, frame.width - size.width);
    }
  }
  if (dot.y >= 0 && dot.y <= frame.height) y = Math.max(0, Math.min(y, frame.height - size.height));
  return { x, y, flipped };
}
