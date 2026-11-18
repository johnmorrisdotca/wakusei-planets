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
  /** Other places for the name, tried in this order when `x` and `y` are taken: a craft's name moves round its dot before it gives way. */
  alternates?: readonly { x: number; y: number }[];
}

/**
 * A rectangle of the view the names are kept out of, in the view's own box coordinates in CSS pixels: the page's bar, its notices, its strip. A name that would lie under one is moved, or left out; the dot stays.
 *
 * @example
 * ```ts
 * import type { KeepOut } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const bar: KeepOut = { x: 0, y: 270, w: 400, h: 30 };
 * console.log(bar.y + bar.h);
 * ```
 */
export interface KeepOut {
  x: number;
  y: number;
  w: number;
  h: number;
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

const hits = (box: { x: number; y: number; width: number; height: number }, area: KeepOut, gap: number): boolean => box.x < area.x + area.w + gap && area.x < box.x + box.width + gap && box.y < area.y + area.h + gap && area.y < box.y + box.height + gap;

/**
 * Where each name that gets a place goes: the surest first, and each in the first of its places (its own, then its `alternates`) that touches no name already placed and no rectangle of `keepOut`; a name with no such place is left out.
 * A moon gives way to its planet and a planet to the Sun, because their ranks say so, and a craft's name to every body's.
 *
 * @param boxes - The names with their boxes, ranks and other places to try.
 * @param gap - The room to keep between two names, in CSS pixels.
 * @param keepOut - The rectangles the names are kept out of (the page's bar and notices), in the view's coordinates.
 * @returns The place of each name shown, by id.
 *
 * @example
 * ```ts
 * import { placeLabels } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const placed = placeLabels(
 *   [
 *     { id: "earth", x: 10, y: 10, width: 40, height: 16, rank: 1, size: 20 },
 *     { id: "juice", x: 30, y: 12, width: 40, height: 16, rank: 5, size: 1, alternates: [{ x: 30, y: 40 }] },
 *   ],
 *   3,
 *   [{ x: 0, y: 270, w: 400, h: 30 }],
 * );
 * console.log([...placed]);
 * ```
 */
export function placeLabels(boxes: readonly LabelBox[], gap = LABEL_GAP, keepOut: readonly KeepOut[] = []): Map<string, { x: number; y: number }> {
  const order = [...boxes].sort((a, b) => a.rank - b.rank || b.size - a.size || (a.id < b.id ? -1 : 1));
  const kept: LabelBox[] = [];
  const placed = new Map<string, { x: number; y: number }>();
  for (const box of order) {
    for (const spot of [{ x: box.x, y: box.y }, ...(box.alternates ?? [])]) {
      const at = { ...box, x: spot.x, y: spot.y };
      if (keepOut.some((area) => hits(at, area, 0)) || kept.some((other) => crosses(at, other, gap))) continue;
      kept.push(at);
      placed.set(box.id, spot);
      break;
    }
  }
  return placed;
}

/**
 * The names to show from those that want a place: the surest first, and each kept only if it does not touch one already kept (or a rectangle of `keepOut`). A moon gives way to its planet and a planet to the Sun, because their ranks say so.
 * The same as `placeLabels`, for the ids alone.
 *
 * @param boxes - The names with their boxes and ranks.
 * @param gap - The room to keep between two names, in CSS pixels.
 * @param keepOut - The rectangles the names are kept out of, in the view's coordinates.
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
export function chooseLabels(boxes: readonly LabelBox[], gap = LABEL_GAP, keepOut: readonly KeepOut[] = []): Set<string> {
  return new Set(placeLabels(boxes, gap, keepOut).keys());
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

/**
 * The rank of a craft's name among the names of the space view: after every body's (a moon is 4), so a body's name always wins over a craft's. The craft the view is about (chosen) is surest, then a favourite, then the rest,
 * and among those of one rank the one nearer the body in view wins (`craftSize`).
 *
 * @param craft - Whether the craft is the one chosen (the one the view is on, or pressed), and whether it is a favourite.
 * @returns The rank: 5 for the chosen craft, 6 for a favourite, 7 for any other.
 *
 * @example
 * ```ts
 * import { craftRank } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(craftRank({ chosen: false, favourite: true }), craftRank({ chosen: false, favourite: false }));
 * ```
 */
export function craftRank(craft: { chosen: boolean; favourite: boolean }): number {
  return craft.chosen ? 5 : craft.favourite ? 6 : 7;
}

/**
 * The size that breaks a tie between two craft of one rank: the nearer one, in CSS pixels from the middle of the body in view, is the bigger and its name wins.
 *
 * @param pixels - The craft's distance on the screen from the body in view, in CSS pixels.
 * @returns A number that falls as the craft goes further.
 *
 * @example
 * ```ts
 * import { craftSize } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(craftSize(10) > craftSize(300));
 * ```
 */
export function craftSize(pixels: number): number {
  return 1000 / (1 + Math.max(0, pixels));
}

/**
 * Other places for a craft's name round its dot when the first is taken: to the left, above and below, each inside the view. The first place is `nameSpot`'s.
 *
 * @param dot - The craft's place on the screen in CSS pixels: its middle and its radius.
 * @param size - The name's width and height in CSS pixels.
 * @param frame - The view's width and height in CSS pixels.
 * @returns The places to try after the first, in order.
 *
 * @example
 * ```ts
 * import { nameAlternates } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const others = nameAlternates({ x: 200, y: 150, r: 2 }, { width: 60, height: 16 }, { width: 400, height: 300 });
 * console.log(others.length);
 * ```
 */
export function nameAlternates(dot: { x: number; y: number; r: number }, size: { width: number; height: number }, frame: { width: number; height: number }): { x: number; y: number }[] {
  const gap = Math.max(4, Math.min(dot.r, 40));
  const inside = (x: number, y: number): { x: number; y: number } => ({
    x: frame.width > 0 ? Math.max(0, Math.min(Math.round(x), frame.width - size.width)) : Math.round(x),
    y: frame.height > 0 ? Math.max(0, Math.min(Math.round(y), frame.height - size.height)) : Math.round(y),
  });
  return [
    inside(dot.x - gap - size.width, dot.y - 8),
    inside(dot.x - size.width / 2, dot.y - gap - size.height),
    inside(dot.x - size.width / 2, dot.y + gap),
  ];
}
