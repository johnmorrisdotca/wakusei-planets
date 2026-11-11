// The little arrows on an orbit line that show which way the body goes, and the shapes the help mode draws round the body looked at. Pure: lines in, places and directions out; the scene turns them into lines on the screen.
import { add, cross, dot, RAD, scale, unit, type Vec3 } from "../vec.ts";

/**
 * How many arrowheads an orbit line carries by default: two are enough to show which way a body goes round.
 *
 * @example
 * ```ts
 * import { ARROWS_PER_ORBIT } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(ARROWS_PER_ORBIT);
 * ```
 */
export const ARROWS_PER_ORBIT = 2;

/**
 * The most arrowheads an orbit line may carry, whatever a page asks for.
 *
 * @example
 * ```ts
 * import { MAX_ARROWS_PER_ORBIT } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(MAX_ARROWS_PER_ORBIT);
 * ```
 */
export const MAX_ARROWS_PER_ORBIT = 4;

/**
 * Reads the number of arrowheads a page asks for (the attribute `arrows` or the property): a whole number from 0 (none) to `MAX_ARROWS_PER_ORBIT`; more is four, less is none, and anything that is not a number is
 * the default, `ARROWS_PER_ORBIT`.
 *
 * @param value - A number, the text of an attribute, or nothing.
 * @returns How many arrowheads to draw on each orbit line.
 *
 * @example
 * ```ts
 * import { arrowCount } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(arrowCount(undefined), arrowCount("3"), arrowCount(9), arrowCount("-1"), arrowCount("many"));
 * ```
 */
export function arrowCount(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return ARROWS_PER_ORBIT;
  return Math.min(MAX_ARROWS_PER_ORBIT, Math.max(0, Math.round(n)));
}

/**
 * One arrowhead on an orbit line: where its tip is and the way it points, the way the body goes along the line.
 *
 * @example
 * ```ts
 * import type { OrbitArrow } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const arrow: OrbitArrow = { position: [1, 0, 0], direction: [0, 1, 0] };
 * console.log(arrow.direction);
 * ```
 */
export interface OrbitArrow {
  position: Vec3;
  direction: Vec3;
}

/**
 * Where the arrowheads go on an orbit line, and which way each points. The line is the points of `planetOrbit` as the view places them: they run from where the body is now once round in the order the body
 * goes, so the direction of each arrow is the line's own direction there, from the point before to the point after. The arrows are spread evenly round the line and stay clear of the body, which is at its first point.
 * They show the real way the body travels, which is the same whichever way the clock runs.
 *
 * @param line - The orbit line, `count + 1` points whose last is near the first.
 * @param arrows - How many arrowheads (`ARROWS_PER_ORBIT`, two, by default; at most `MAX_ARROWS_PER_ORBIT`).
 * @returns The arrows, each at a point of the line.
 *
 * @example
 * ```ts
 * import { arrowSites } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const circle = Array.from({ length: 97 }, (_, i) => [Math.cos((i / 96) * 2 * Math.PI), 0, Math.sin((i / 96) * 2 * Math.PI)] as const);
 * console.log(arrowSites(circle, 4).map((a) => a.direction.map((n) => n.toFixed(2)).join(",")).join(" | "));
 * ```
 */
export function arrowSites(line: readonly (readonly [number, number, number])[], arrows = ARROWS_PER_ORBIT): OrbitArrow[] {
  const n = line.length - 1;
  const out: OrbitArrow[] = [];
  const count = arrowCount(arrows);
  if (n < 4 || count < 1) return out;
  for (let k = 0; k < count; k += 1) {
    // k + 1/2 of the way round in equal steps: never at the body (the first point) or at the join
    const i = Math.min(n - 1, Math.max(1, Math.round(((k + 0.5) / count) * n)));
    const before = line[i - 1]!;
    const after = line[i + 1]!;
    const direction = unit([after[0] - before[0], after[1] - before[1], after[2] - before[2]]);
    out.push({ position: line[i]!, direction });
  }
  return out;
}

/**
 * The three points of a small arrowhead that is `size` long in the picture: its tip at `position`, and the ends of its two wings, laid in the plane of the picture so it points the way `direction` goes on the screen.
 * A direction straight into or out of the picture has no way on the screen and gives none.
 *
 * @param position - The tip, in the scene's units.
 * @param direction - The way it points in the scene.
 * @param right - The camera's right-hand direction (a unit vector).
 * @param up - The camera's up direction (a unit vector).
 * @param size - The length of a wing, in the scene's units at the tip (pixels times the size of a pixel there).
 * @returns The tip and the two wing ends, or `null`.
 *
 * @example
 * ```ts
 * import { chevron } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * console.log(chevron([0, 0, 0], [1, 0, 0], [1, 0, 0], [0, 1, 0], 2)?.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" "));
 * ```
 */
export function chevron(position: Vec3, direction: Vec3, right: Vec3, up: Vec3, size: number): [Vec3, Vec3, Vec3] | null {
  const dx = dot(direction, right);
  const dy = dot(direction, up);
  const l = Math.hypot(dx, dy);
  if (l < 1e-3) return null;
  const [ux, uy] = [dx / l, dy / l];
  const alpha = 28 * RAD;
  const wing = (sign: number): Vec3 => {
    // the direction on the screen, turned back by `alpha` to one side or the other
    const vx = -(ux * Math.cos(alpha) - sign * uy * Math.sin(alpha));
    const vy = -(uy * Math.cos(alpha) + sign * ux * Math.sin(alpha));
    return add(position, add(scale(right, vx * size), scale(up, vy * size)));
  };
  return [position, wing(1), wing(-1)];
}

/**
 * The curved arrow of the help mode: points on a circle round the axis a body spins about, turning the way it turns (by the right-hand rule about `axis`), as `segments + 1` points from its tail to its head, and the
 * two ends of the head's wings. The circle has radius `radius` and sits `lift` along the axis from `centre`; the arc covers 250 degrees, ending where it started 250 degrees on.
 *
 * @param centre - The body's centre.
 * @param axis - The unit axis it spins about (the right-hand rule: the fingers curl the way it turns).
 * @param radius - The circle's radius, in the scene's units.
 * @param lift - How far along the axis the circle is from the centre.
 * @param segments - How many pieces the arc is cut into.
 * @returns The points of the arc, and the points of the arrowhead's wings (the head is at the arc's last point).
 *
 * @example
 * ```ts
 * import { spinArrow } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const { arc } = spinArrow([0, 0, 0], [0, 1, 0], 1.3, 0.5, 20);
 * console.log(arc.length);
 * ```
 */
export function spinArrow(centre: Vec3, axis: Vec3, radius: number, lift: number, segments = 28): { arc: Vec3[]; head: [Vec3, Vec3] } {
  const k = unit(axis);
  const seed: Vec3 = Math.abs(k[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit(cross(seed, k));
  const e2 = cross(k, e1);
  const span = 250 * RAD;
  const at = (phi: number): Vec3 => add(add(centre, scale(k, lift)), add(scale(e1, radius * Math.cos(phi)), scale(e2, radius * Math.sin(phi))));
  const arc: Vec3[] = [];
  for (let i = 0; i <= segments; i += 1) arc.push(at(-span / 2 + (i / segments) * span));
  // the head: two short strokes back from the tip, in the plane of the circle, either side of the way it goes (the tangent, increasing phi)
  const tip = arc[segments]!;
  const phi = span / 2;
  const tangent: Vec3 = unit(add(scale(e1, -Math.sin(phi)), scale(e2, Math.cos(phi))));
  const outward: Vec3 = unit(add(scale(e1, Math.cos(phi)), scale(e2, Math.sin(phi))));
  const back = 0.16 * radius;
  const head: [Vec3, Vec3] = [add(tip, add(scale(tangent, -back), scale(outward, back * 0.55))), add(tip, add(scale(tangent, -back), scale(outward, -back * 0.55)))];
  return { arc, head };
}
