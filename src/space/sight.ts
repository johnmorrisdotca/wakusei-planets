// Where a body is from the camera's point of view: inside the picture's frame, or beyond one of its four edges, and where along that edge. Pure: a place and a direction in, a side and a point out.
// The view draws no tabs from it; a page that wants them places its own.

/**
 * An edge of the picture: the one a body out of view lies beyond.
 *
 * @example
 * ```ts
 * import type { SightEdge } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const edge: SightEdge = "left";
 * console.log(edge);
 * ```
 */
export type SightEdge = "top" | "right" | "bottom" | "left";

/**
 * What the camera sees of one body, in CSS pixels in the picture: whether the body is in front of the camera, its place on the screen when it is (it may be off the picture), its radius there, and the way to it on the
 * screen (right and down are positive), which holds for a body behind the camera too.
 *
 * @example
 * ```ts
 * import type { SightInput } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const mars: SightInput = { front: true, x: 900, y: 120, r: 2, dx: 500, dy: -80 };
 * console.log(mars.front);
 * ```
 */
export interface SightInput {
  front: boolean;
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  /** Degrees between the camera's forward direction and the body, 0 to 180, when the caller knows it. */
  offAxis?: number;
  /** How far the body is from the camera, in the view's units (Earth radii), when the caller knows it. */
  distance?: number;
  /** The same distance in kilometres in the true scale, `null` in the compressed one. */
  distanceKm?: number | null;
}

/**
 * Where a body is for the picture: `inView` when its disc is on the picture; otherwise the `edge` it lies beyond, and `x`, `y`, the point on that edge where a line from the middle of the view to the body crosses it, with
 * `along` the same point measured along the edge (from the left for the top and bottom, from the top for the sides). `angle` is the way to the body from the middle of the view in degrees clockwise from the top of the
 * picture (0 up, 90 right), and `behind` is true for a body behind the camera. A body in view has `edge` null and `x`, `y` its own place.
 *
 * @example
 * ```ts
 * import type { Sight } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const sight: Sight = { inView: false, behind: false, edge: "right", x: 640, y: 140, along: 140, angle: 81 };
 * console.log(sight.edge, sight.along);
 * ```
 */
export interface Sight {
  inView: boolean;
  behind: boolean;
  edge: SightEdge | null;
  x: number;
  y: number;
  along: number;
  angle: number;
}

/**
 * Where a body is for a picture `width` by `height`: in view, or beyond which edge and where along it. The line to a body out of view starts at `axis`, the point of the picture straight ahead of the camera (the middle,
 * unless the view is panned), kept inside the picture.
 *
 * @param input - The body as the camera sees it.
 * @param width - The picture's width in CSS pixels.
 * @param height - The picture's height in CSS pixels.
 * @param axis - The point straight ahead of the camera, in CSS pixels; the middle of the picture by default.
 * @returns The body's sight.
 *
 * @example
 * ```ts
 * import { sightOf } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const right = sightOf({ front: true, x: 900, y: 300, r: 3, dx: 580, dy: 0 }, 640, 600);
 * const behind = sightOf({ front: false, x: 0, y: 0, r: 0, dx: 0, dy: 1 }, 640, 600);
 * console.log(right.edge, right.along, behind.edge, behind.behind);
 * ```
 */
export function sightOf(input: SightInput, width: number, height: number, axis: { x: number; y: number } = { x: width / 2, y: height / 2 }): Sight {
  const ox = Math.min(width, Math.max(0, axis.x));
  const oy = Math.min(height, Math.max(0, axis.y));
  const r = Math.max(0, input.r);
  if (input.front && input.x + r >= 0 && input.x - r <= width && input.y + r >= 0 && input.y - r <= height) {
    return { inView: true, behind: false, edge: null, x: input.x, y: input.y, along: 0, angle: angleOf(input.x - ox, input.y - oy) };
  }
  const dx = input.front ? input.x - ox : input.dx;
  let dy = input.front ? input.y - oy : input.dy;
  // straight behind the camera every way is as short: say below
  if (dx === 0 && dy === 0) dy = 1;
  const tx = dx > 0 ? (width - ox) / dx : dx < 0 ? -ox / dx : Number.POSITIVE_INFINITY;
  const ty = dy > 0 ? (height - oy) / dy : dy < 0 ? -oy / dy : Number.POSITIVE_INFINITY;
  const t = Math.min(tx, ty);
  const x = Math.min(width, Math.max(0, ox + dx * t));
  const y = Math.min(height, Math.max(0, oy + dy * t));
  const edge: SightEdge = tx < ty ? (dx > 0 ? "right" : "left") : dy > 0 ? "bottom" : "top";
  return { inView: false, behind: !input.front, edge, x, y, along: edge === "top" || edge === "bottom" ? x : y, angle: angleOf(dx, dy) };
}

const angleOf = (dx: number, dy: number): number => (dx === 0 && dy === 0 ? 0 : ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);

/**
 * Whether a point of the picture is inside it less a margin on every side: `nx` and `ny` are its place from the middle in halves of the picture's width and height (-1 the left or top edge, 1 the right or bottom),
 * and `margin` a fraction of the width for the left and right and of the height for the top and bottom. `turnTo` and a page's own "show" use the same test.
 *
 * @param nx - The place across, -1 to 1.
 * @param ny - The place down, -1 to 1.
 * @param margin - The fraction of each side kept clear, 0 to 0.5.
 * @returns True when the point is inside the picture less the margin.
 *
 * @example
 * ```ts
 * import { withinMargin } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(withinMargin(0.5, 0, 0.15), withinMargin(0.8, 0, 0.15));
 * ```
 */
export function withinMargin(nx: number, ny: number, margin: number): boolean {
  const inner = 1 - 2 * margin;
  return Math.abs(nx) <= inner && Math.abs(ny) <= inner;
}

/**
 * How far, in CSS pixels, a body out of view moves along its edge before the view tells the page again.
 *
 * @example
 * ```ts
 * import { SIGHT_STEP_PX } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(SIGHT_STEP_PX);
 * ```
 */
export const SIGHT_STEP_PX = 8;

/**
 * Whether the page should be told again: a body came into view or left it, went behind the camera or came out, changed edge, moved along its edge by `step` pixels or more since the page was last told, or the bodies
 * themselves changed. A body in view that moves about in it is not a change.
 *
 * @param before - The sights the page was last told, by body.
 * @param now - The sights now, by body.
 * @param step - How far along an edge is a change, in CSS pixels.
 * @returns True when the page should hear of it.
 *
 * @example
 * ```ts
 * import { sightChanged, sightOf } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const at = (x: number) => ({ mars: sightOf({ front: true, x, y: 300, r: 3, dx: x - 320, dy: 0 }, 640, 600) });
 * console.log(sightChanged(at(700), at(702)), sightChanged(at(700), at(300)));
 * ```
 */
export function sightChanged(before: Readonly<Record<string, Sight>>, now: Readonly<Record<string, Sight>>, step = SIGHT_STEP_PX): boolean {
  const ids = Object.keys(now);
  if (ids.length !== Object.keys(before).length) return true;
  for (const id of ids) {
    const a = before[id];
    const b = now[id]!;
    if (!a || a.inView !== b.inView || a.behind !== b.behind || a.edge !== b.edge) return true;
    if (!b.inView && Math.abs(a.along - b.along) >= step) return true;
  }
  return false;
}
