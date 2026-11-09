// Where each body of the line-up sits and how the camera moves along it. The bodies stand in a row (or a column) at true relative size, smallest first, with a gap that is a quarter of the bigger neighbour's radius.
// The zoom is one number from 0 to 1 on a logarithmic scale of radius: at 0 the camera is on the smallest body and fills the picture with it, at 1 on the largest, and in between its centre glides from one body to the
// next as the size it frames grows. Pure: numbers only, no DOM, no three.js. All lengths are in solar radii (Suns), x to the right and y up.
import type { LineupBody } from "./data.ts";

/**
 * How the bodies stand: `row` side by side, left to right, or `stack` one above the next, top to bottom, smallest first.
 *
 * @example
 * ```ts
 * import { LINEUP_LAYOUTS, type LineupLayout } from "@johnmorrisdotca/wakusei-planets";
 *
 * const layout: LineupLayout = LINEUP_LAYOUTS[1];
 * console.log(layout);
 * ```
 */
export const LINEUP_LAYOUTS = ["row", "stack"] as const;

/**
 * One of the layouts in `LINEUP_LAYOUTS`.
 *
 * @example
 * ```ts
 * import type { LineupLayout } from "@johnmorrisdotca/wakusei-planets";
 *
 * const layout: LineupLayout = "row";
 * console.log(layout);
 * ```
 */
export type LineupLayout = (typeof LINEUP_LAYOUTS)[number];

/**
 * A body with its place: the centre in Suns and the radius in Suns.
 *
 * @example
 * ```ts
 * import { lineupBodies, placeLineup, type LineupPlace } from "@johnmorrisdotca/wakusei-planets";
 *
 * const second: LineupPlace = placeLineup(lineupBodies({ set: "bright" }), "row")[1]!;
 * console.log(second.body.id, second.x, second.r);
 * ```
 */
export interface LineupPlace {
  body: LineupBody;
  x: number;
  y: number;
  r: number;
}

/**
 * The camera: its centre and the half of the picture's height, in Suns. The picture is `2 * h` Suns tall and `2 * h * aspect` wide.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupView, placeLineup, type LineupView } from "@johnmorrisdotca/wakusei-planets";
 *
 * const view: LineupView = lineupView(placeLineup(lineupBodies(), "row"), 1);
 * console.log(view.h);
 * ```
 */
export interface LineupView {
  x: number;
  y: number;
  h: number;
}

/** The gap between two neighbours, as a share of the bigger one's radius. */
const GAP = 0.25;
/** How many radii of the framed body the picture holds from the middle to the top: 1.45 leaves the body at about two thirds of the picture's height. */
const FRAME = 1.45;

/**
 * Where each body sits. `bodies` is sorted by radius, smallest first, as `lineupBodies` gives it: the first is at the origin and each next one is a quarter of its own radius beyond the edge of the one before,
 * to the right in a `row` and downward in a `stack`.
 *
 * @param bodies - The bodies, smallest first.
 * @param layout - `row` (the default) or `stack`.
 * @returns The places, in the same order.
 *
 * @example
 * ```ts
 * import { lineupBodies, placeLineup } from "@johnmorrisdotca/wakusei-planets";
 *
 * const places = placeLineup(lineupBodies({ set: "bright", planets: true }), "stack");
 * console.log(places.map((place) => place.y.toFixed(2)).join(" "));
 * ```
 */
export function placeLineup(bodies: readonly LineupBody[], layout: LineupLayout = "row"): LineupPlace[] {
  const out: LineupPlace[] = [];
  let along = 0;
  bodies.forEach((body, index) => {
    const r = body.radiusSun;
    if (index > 0) along += bodies[index - 1]!.radiusSun + GAP * r + r;
    out.push({ body, x: layout === "row" ? along : 0, y: layout === "row" ? 0 : -along, r });
  });
  return out;
}

const SMALLEST = (places: readonly LineupPlace[]): number => Math.log(places[0]!.r);
const LARGEST = (places: readonly LineupPlace[]): number => Math.log(places[places.length - 1]!.r);

/**
 * The camera at a zoom from 0 to 1: the size it frames grows from the smallest body's radius to the largest's on a logarithmic scale, and its centre glides from one body to the next, easing in and out, so it rests on each body as the framed size reaches that body's radius. A tall, narrow picture (`aspect` under 1) is zoomed out so the framed body still fits across.
 *
 * @param places - The places, smallest first.
 * @param zoom - 0 (the smallest body fills the picture) to 1 (the largest does). Held to that range.
 * @param aspect - The picture's width over its height, 1.78 by default.
 * @returns The camera.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupView, placeLineup } from "@johnmorrisdotca/wakusei-planets";
 *
 * const places = placeLineup(lineupBodies(), "row");
 * console.log(lineupView(places, 0).h, lineupView(places, 1).h);
 * ```
 */
export function lineupView(places: readonly LineupPlace[], zoom: number, aspect = 16 / 9): LineupView {
  if (places.length === 0) return { x: 0, y: 0, h: 1 };
  const low = SMALLEST(places);
  const span = LARGEST(places) - low;
  const t = Math.min(1, Math.max(0, Number.isFinite(zoom) ? zoom : 0));
  const size = low + span * t;
  let i = 0;
  while (i < places.length - 2 && Math.log(places[i + 1]!.r) < size) i += 1;
  const a = places[i]!;
  const b = places[Math.min(places.length - 1, i + 1)]!;
  const gap = Math.log(b.r) - Math.log(a.r);
  const u = gap > 1e-9 ? Math.min(1, Math.max(0, (size - Math.log(a.r)) / gap)) : 0;
  // the centre eases from one body to the next, so the camera rests on each body as it passes it
  const w = u * u * (3 - 2 * u);
  return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, h: FRAME * Math.exp(size) * Math.max(1, 1 / Math.max(0.05, aspect)) };
}

/**
 * The zoom at which a body fills the picture: where the camera frames its radius. 0 for a lone body.
 *
 * @param places - The places, smallest first.
 * @param id - A body's id.
 * @returns The zoom from 0 to 1, or `undefined` when the id is not in the line-up.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupZoomOf, placeLineup } from "@johnmorrisdotca/wakusei-planets";
 *
 * const places = placeLineup(lineupBodies(), "row");
 * console.log(lineupZoomOf(places, "antares")?.toFixed(3));
 * ```
 */
export function lineupZoomOf(places: readonly LineupPlace[], id: string): number | undefined {
  const place = places.find((one) => one.body.id === id);
  if (place === undefined) return undefined;
  const span = LARGEST(places) - SMALLEST(places);
  return span < 1e-9 ? 0 : (Math.log(place.r) - SMALLEST(places)) / span;
}

/**
 * The zoom at which the camera frames a size: a radius in Suns, held to the line-up's smallest and largest.
 *
 * @param places - The places, smallest first.
 * @param radius - A radius in Suns.
 * @returns The zoom from 0 to 1 (0 for an empty or lone line-up).
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupZoomFor, placeLineup } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(lineupZoomFor(placeLineup(lineupBodies(), "row"), 80).toFixed(3));
 * ```
 */
export function lineupZoomFor(places: readonly LineupPlace[], radius: number): number {
  if (places.length === 0) return 0;
  const span = LARGEST(places) - SMALLEST(places);
  return span < 1e-9 || !(radius > 0) ? 0 : Math.min(1, Math.max(0, (Math.log(radius) - SMALLEST(places)) / span));
}

/**
 * The body whose size the camera frames at a zoom: the nearest in the logarithmic scale of radius.
 *
 * @param places - The places, smallest first.
 * @param zoom - 0 to 1.
 * @returns The place, or `undefined` for an empty line-up.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupFocus, placeLineup } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(lineupFocus(placeLineup(lineupBodies(), "row"), 0.5)?.body.id);
 * ```
 */
export function lineupFocus(places: readonly LineupPlace[], zoom: number): LineupPlace | undefined {
  if (places.length === 0) return undefined;
  const size = SMALLEST(places) + (LARGEST(places) - SMALLEST(places)) * Math.min(1, Math.max(0, zoom));
  return places.reduce((best, one) => (Math.abs(Math.log(one.r) - size) < Math.abs(Math.log(best.r) - size) ? one : best));
}

/**
 * A body on the picture: its centre and radius in CSS pixels.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupProject, lineupView, placeLineup, type LineupDot } from "@johnmorrisdotca/wakusei-planets";
 *
 * const places = placeLineup(lineupBodies(), "row");
 * const dots: LineupDot[] = lineupProject(places, lineupView(places, 0.2), 640, 360);
 * console.log(dots.map((dot) => `${dot.place.body.id} ${dot.r.toFixed(1)}px`).join(", "));
 * ```
 */
export interface LineupDot {
  place: LineupPlace;
  cx: number;
  cy: number;
  r: number;
}

/**
 * Where each body is on a picture `width` by `height` pixels seen by `view`: the sizes are true, so a body smaller than a pixel has a radius under 1.
 *
 * @param places - The places.
 * @param view - The camera.
 * @param width - The picture's width in pixels.
 * @param height - The picture's height in pixels.
 * @returns A dot for each body, in the same order.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupProject, lineupView, placeLineup } from "@johnmorrisdotca/wakusei-planets";
 *
 * const places = placeLineup(lineupBodies({ planets: true }), "row");
 * console.log(lineupProject(places, lineupView(places, 0.3), 800, 450)[0]?.r);
 * ```
 */
export function lineupProject(places: readonly LineupPlace[], view: LineupView, width: number, height: number): LineupDot[] {
  const scale = height / (2 * view.h);
  return places.map((place) => ({ place, cx: width / 2 + (place.x - view.x) * scale, cy: height / 2 - (place.y - view.y) * scale, r: place.r * scale }));
}
