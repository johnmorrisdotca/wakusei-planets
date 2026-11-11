// A body behind another: which placed bodies are covered by a nearer body's disc on the screen, and where a quiet arrow for them sits just outside that disc's edge. Pure: places in, arrows out.
import type { BodyPlace } from "./scene.ts";

/**
 * A placed body as the covering test sees it: where it is on the screen (CSS pixels), its radius there, and how far it is from the camera (any unit, the same for all).
 *
 * @example
 * ```ts
 * import type { CoverEntry } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const earth: CoverEntry = { id: "earth", x: 300, y: 300, r: 120, distance: 4 };
 * console.log(earth.r);
 * ```
 */
export interface CoverEntry {
  id: string;
  x: number;
  y: number;
  r: number;
  distance: number;
}

/**
 * A disc narrower than this many CSS pixels of radius covers nothing: a dot hides no name.
 *
 * @example
 * ```ts
 * import { COVER_MIN_PX } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(COVER_MIN_PX);
 * ```
 */
export const COVER_MIN_PX = 6;

/**
 * Which body, if any, covers each: the nearest body whose disc on the screen holds the body's place and which is nearer the camera than it is. A body is never covered by itself, nor by a disc
 * narrower than `COVER_MIN_PX`.
 *
 * @param entries - The placed bodies.
 * @returns For each covered body's id, the id of the body covering it.
 *
 * @example
 * ```ts
 * import { coveredBy } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const behind = coveredBy([
 *   { id: "earth", x: 300, y: 300, r: 120, distance: 4 },
 *   { id: "uranus", x: 340, y: 280, r: 1, distance: 60_000 },
 *   { id: "moon", x: 80, y: 300, r: 30, distance: 3 },
 * ]);
 * console.log(JSON.stringify([...behind]));
 * ```
 */
export function coveredBy(entries: readonly CoverEntry[]): Map<string, string> {
  const behind = new Map<string, string>();
  for (const body of entries) {
    let cover: CoverEntry | undefined;
    for (const other of entries) {
      if (other === body || other.r < COVER_MIN_PX || other.distance >= body.distance) continue;
      if (Math.hypot(body.x - other.x, body.y - other.y) >= other.r) continue;
      if (cover === undefined || other.distance < cover.distance) cover = other;
    }
    if (cover !== undefined) behind.set(body.id, cover.id);
  }
  return behind;
}

/**
 * One quiet arrow: outside the covering body's disc, on the side nearest the bodies behind it, pointing in behind it, with the surest of them named and the rest counted.
 *
 * @example
 * ```ts
 * import type { CoverArrow } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const arrow: CoverArrow = { cover: "earth", lead: "uranus", bodies: ["uranus", "ariel"], x: 426, y: 280, angle: 180 };
 * console.log(arrow.bodies.length);
 * ```
 */
export interface CoverArrow {
  /** The body whose disc covers them. */
  cover: string;
  /** The surest of the bodies behind (the lowest rank): the arrow is named for it and a press goes to it. */
  lead: string;
  /** Every body behind, the lead first. */
  bodies: string[];
  /** Where the arrow's tip sits, in CSS pixels in the box: just outside the disc's edge. */
  x: number;
  y: number;
  /** The way the arrow points, in degrees clockwise from pointing right: into the disc, towards the bodies behind it. */
  angle: number;
}

/**
 * How far outside the disc's edge the arrow's tip sits, in CSS pixels.
 *
 * @example
 * ```ts
 * import { COVER_ARROW_GAP } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(COVER_ARROW_GAP);
 * ```
 */
export const COVER_ARROW_GAP = 6;

/**
 * The arrows for the bodies behind others: one for each covering body, placed on its edge on the side nearest the surest body behind it, pointing in. Bodies behind the same disc share the arrow,
 * the lead named and the others counted by the host.
 *
 * @param places - Where each body is on the screen, with `behind` set for a covered one (from `coveredBy`), or `null` for one off the screen.
 * @param rank - How sure a body's name is (lower is surer): the lead of a group.
 * @returns The arrows, in the order of their covering bodies' ids.
 *
 * @example
 * ```ts
 * import { coverArrows } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const arrows = coverArrows({ earth: { x: 300, y: 300, r: 120 }, uranus: { x: 340, y: 280, r: 1, behind: "earth" }, ariel: { x: 342, y: 281, r: 0.1, behind: "earth" } }, (id) => (id === "uranus" ? 2 : 4));
 * console.log(JSON.stringify(arrows.map((a) => [a.lead, a.bodies.length, Math.round(a.x), Math.round(a.y), Math.round(a.angle)])));
 * ```
 */
export function coverArrows(places: Readonly<Record<string, BodyPlace | null>>, rank: (id: string) => number): CoverArrow[] {
  const groups = new Map<string, string[]>();
  for (const [id, at] of Object.entries(places)) {
    if (at === null || at.behind === undefined || places[at.behind] === null || places[at.behind] === undefined) continue;
    const list = groups.get(at.behind) ?? [];
    list.push(id);
    groups.set(at.behind, list);
  }
  const arrows: CoverArrow[] = [];
  for (const cover of [...groups.keys()].sort()) {
    const bodies = groups.get(cover)!.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
    const lead = bodies[0]!;
    const disc = places[cover]!;
    const at = places[lead]!;
    const dx = at.x - disc.x;
    const dy = at.y - disc.y;
    const length = Math.hypot(dx, dy);
    const [ux, uy] = length < 1e-6 ? [1, 0] : [dx / length, dy / length];
    const reach = disc.r + COVER_ARROW_GAP;
    arrows.push({ cover, lead, bodies, x: disc.x + ux * reach, y: disc.y + uy * reach, angle: (Math.atan2(-uy, -ux) * 180) / Math.PI });
  }
  return arrows;
}
