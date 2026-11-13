// Things at a site, drawn by this package at their published places: the lunar module's descent stage, the rover, the flag, the ALSEP station and the electrical-properties transmitter at Apollo 17, in plain shapes
// (boxes, cylinders, struts), with the rover's traverse as a faint line. The positions come from published coordinates (`objects-apollo-17.ts`, made by `scripts/make-apollo17-objects.py`); the shapes, the
// rover's heading and what the line looks like are made here, and the page says so. Pure: no DOM.
import { APOLLO_17_OBJECTS, APOLLO_17_TRAVERSE } from "./objects-apollo-17.ts";
import { box, cylinder, landerParts, placePart, roverParts, strut, type Part } from "./shapes.ts";

/**
 * One thing at a site: where it stands (metres east and north of the site point), what it is, and for the rover the way it points.
 *
 * @example
 * ```ts
 * import { objectsOf } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const lander = objectsOf("apollo-17").find((object) => object.kind === "lander");
 * console.log(lander?.name.en, lander?.east, lander?.north);
 * ```
 */
export interface SiteObject {
  id: string;
  kind: "lander" | "rover" | "flag" | "station" | "instrument";
  name: { en: string; ja: string };
  east: number;
  north: number;
  /** The way a vehicle points, degrees clockwise from north (the rover's, read from the end of its path by this package). */
  heading?: number;
  /** Where the published position is, planetocentric degrees (the rover's is a reading of a line, so it has none). */
  lat?: number;
  lon?: number;
}

/**
 * The things at a site, at their published places; none for a site that has none.
 *
 * @param site - A site's name from `SURFACE_SITES`.
 * @returns The objects.
 *
 * @example
 * ```ts
 * import { objectsOf } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(objectsOf("apollo-17").map((object) => object.id).join(", "), objectsOf("nowhere").length);
 * ```
 */
export function objectsOf(site: string): readonly SiteObject[] {
  return site === "apollo-17" ? APOLLO_17_OBJECTS : [];
}

/**
 * The rover's traverses at a site as lines, each east, north, east, north, ... in metres from the site point (the published path, digitised from the orbiter's images).
 *
 * @param site - A site's name from `SURFACE_SITES`.
 * @returns The lines, or none.
 *
 * @example
 * ```ts
 * import { traverseOf } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const lines = traverseOf("apollo-17");
 * console.log(lines.length, "traverses,", lines.reduce((n, line) => n + line.length / 2, 0), "points");
 * ```
 */
export function traverseOf(site: string): readonly (readonly number[])[] {
  return site === "apollo-17" ? APOLLO_17_TRAVERSE : [];
}

/**
 * How far round an object the made craters and rocks keep away: nothing is made inside `inner` metres of its place, and the ground is all its own again from `outer` metres.
 *
 * @example
 * ```ts
 * import { KEEP_OUT } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(KEEP_OUT.lander.inner, KEEP_OUT.lander.outer);
 * ```
 */
export const KEEP_OUT: Record<SiteObject["kind"], { inner: number; outer: number }> = {
  lander: { inner: 9, outer: 15 },
  rover: { inner: 4, outer: 8 },
  flag: { inner: 2, outer: 5 },
  station: { inner: 4, outer: 8 },
  instrument: { inner: 2, outer: 5 },
};

export type { Part } from "./shapes.ts";

/**
 * The shape of one object as plain parts placed at its site: the lunar module's descent stage (an octagonal gold body on four splayed legs with braces and footpads, a ladder, a bell under it), the rover (a frame
 * on four wheels with fenders, two seats, a console, the dish and the camera on their masts), the flag, the ALSEP station and the transmitter. `base` is the height of the ground at the object's place in metres over
 * the site's ground; the shapes stand on it. All of it is this package's drawing from published sizes: it is no model of the real thing.
 *
 * @param object - The object.
 * @param base - The ground's height at its place.
 * @returns The parts, in the site's plane (x east, y up, z north).
 *
 * @example
 * ```ts
 * import { objectParts, objectsOf } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const lander = objectsOf("apollo-17").find((object) => object.kind === "lander")!;
 * const parts = objectParts(lander, 0);
 * console.log(parts.length, "parts,", parts.reduce((n, part) => n + part.position.length / 9, 0), "triangles");
 * ```
 */
export function objectParts(object: SiteObject, base: number): Part[] {
  const { east: e, north: n } = object;
  const at = (x: number, y: number, z: number): [number, number, number] => [e + x, base + y, n + z];
  switch (object.kind) {
    case "lander":
      return landerParts().map((part) => placePart(part, e, base, n, 0));
    case "rover":
      return roverParts().map((part) => placePart(part, e, base, n, ((object.heading ?? 0) * Math.PI) / 180));
    case "flag":
      return [cylinder(at(0, 0, 0), 0.015, 2.4, 6, 1.3, false, [0.85, 0.85, 0.88]), box(at(0.55, 2.0, 0), [1.1, 0.7, 0.012], 0, 1.7, 0, [0.9, 0.9, 0.95])];
    case "station":
      return [box(at(0, 0.25, 0), [0.7, 0.5, 0.5], 0.4, 1.4, 0, [0.9, 0.78, 0.45]), cylinder(at(1.0, 0, 0.3), 0.18, 0.55, 10, 0.9, false, DARKER), strut(at(-0.1, 0.5, 0), at(-0.1, 1.5, 0), 0.03, 1.3, [0.85, 0.85, 0.88])];
    case "instrument":
      return [box(at(0, 0.15, 0), [0.45, 0.3, 0.35], 0.5, 1.4, 0, [0.85, 0.85, 0.88])];
  }
}

const DARKER: [number, number, number] = [0.35, 0.35, 0.38];

/**
 * The shadows of an object's parts on the ground for a Sun at an azimuth and an altitude: for each part the convex hull of where its corners fall on the plane of its base, as triangles (x east, y up, z north) lifted a
 * hair off the ground. Flat and hard-edged: the Moon has no air.
 *
 * @param parts - The object's parts, as `objectParts` makes them.
 * @param base - The ground's height under it.
 * @param azimuth - The Sun's azimuth, degrees clockwise from north.
 * @param altitude - The Sun's altitude in degrees.
 * @returns The triangles' corners, three numbers each.
 *
 * @example
 * ```ts
 * import { objectParts, objectsOf, partShadows } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const flag = objectsOf("apollo-17").find((object) => object.kind === "flag")!;
 * const shadow = partShadows(objectParts(flag, 0), 0, 95, 13);
 * console.log(shadow.length / 9, "triangles of shadow");
 * ```
 */
export function partShadows(parts: readonly Part[], base: number, azimuth: number, altitude: number): number[] {
  const out: number[] = [];
  if (altitude < 0.5) return out;
  const reach = 1 / Math.tan((Math.min(altitude, 89) * Math.PI) / 180);
  const away: [number, number] = [-Math.sin((azimuth * Math.PI) / 180), -Math.cos((azimuth * Math.PI) / 180)];
  for (const part of parts) {
    const pts: [number, number][] = [];
    for (let i = 0; i < part.position.length; i += 3) {
      const h = Math.max(0, part.position[i + 1]! - base);
      const clamp = Math.min(h * reach, 80);
      pts.push([part.position[i]! + away[0] * clamp, part.position[i + 2]! + away[1] * clamp]);
      pts.push([part.position[i]!, part.position[i + 2]!]);
    }
    const hull = convexHull(pts);
    for (let i = 1; i + 1 < hull.length; i += 1) {
      for (const p of [hull[0]!, hull[i]!, hull[i + 1]!]) out.push(p[0], base + 0.02, p[1]);
    }
  }
  return out;
}

/** The convex hull of points on the plane, counter-clockwise (Andrew's monotone chain). */
function convexHull(points: readonly [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross2 = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross2(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/**
 * How much of the made ground (its craters and rocks) is kept at a point: 0 at an object's place, up to 1 where it is the ground's own again, so that no made crater cuts the lunar module's legs. The smallest over the objects.
 *
 * @param x - Metres east of the site point.
 * @param y - Metres north of the site point.
 * @param objects - The objects of the site.
 * @returns A share from 0 to 1.
 *
 * @example
 * ```ts
 * import { keepAway, objectsOf } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const objects = objectsOf("apollo-17");
 * console.log(keepAway(objects[0]!.east, objects[0]!.north, objects), keepAway(500, 500, objects));
 * ```
 */
export function keepAway(x: number, y: number, objects: readonly SiteObject[]): number {
  let keep = 1;
  for (const o of objects) {
    const { inner, outer } = KEEP_OUT[o.kind];
    const d = Math.hypot(x - o.east, y - o.north);
    const t = Math.min(1, Math.max(0, (d - inner) / (outer - inner)));
    keep = Math.min(keep, t * t * (3 - 2 * t));
  }
  return keep;
}
