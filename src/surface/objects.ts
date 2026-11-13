// Things at a site, drawn by this package at their published places: the lunar module's descent stage, the rover, the flag, the ALSEP station and the electrical-properties transmitter at Apollo 17, in plain shapes
// (boxes, cylinders, struts), with the rover's traverse as a faint line. The positions come from published coordinates (`objects-apollo-17.ts`, made by `scripts/make-apollo17-objects.py`); the shapes, the
// rover's heading and what the line looks like are made here, and the page says so. Pure: no DOM.
import { APOLLO_17_OBJECTS, APOLLO_17_TRAVERSE } from "./objects-apollo-17.ts";

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

/**
 * One piece of an object's shape: triangles with their corners and normals (x east, y up, z north), and how bright it is (foil and paint are lighter than dust).
 *
 * @example
 * ```ts
 * import { objectParts, objectsOf, type Part } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const flag = objectsOf("apollo-17").find((object) => object.kind === "flag")!;
 * const pole: Part = objectParts(flag, 0)[0]!;
 * console.log(pole.position.length / 9, "triangles, tone", pole.tone);
 * ```
 */
export interface Part {
  position: number[];
  normal: number[];
  tone: number;
}

/** A tiny vector toolkit for building the shapes. */
type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const tri = (part: Part, a: V3, b: V3, c: V3, n?: [V3, V3, V3]): void => {
  const flat = norm(cross(sub(b, a), sub(c, a)));
  const ns = n ?? [flat, flat, flat];
  for (const [p, q] of [[a, ns[0]], [b, ns[1]], [c, ns[2]]] as const) {
    part.position.push(p[0], p[1], p[2]);
    part.normal.push(q[0], q[1], q[2]);
  }
};
const quad = (part: Part, a: V3, b: V3, c: V3, d: V3): void => {
  tri(part, a, b, c);
  tri(part, a, c, d);
};

/** A box with its centre, its three sizes and a turn about the up axis (radians), as a part. */
function box(centre: V3, size: V3, turn = 0, tone = 1, tilt = 0): Part {
  const part: Part = { position: [], normal: [], tone };
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const at = (x: number, y: number, z: number): V3 => {
    // tilt about the box's own x axis, then turn about up, then move
    const y2 = y * ct - z * st;
    const z2 = y * st + z * ct;
    return [centre[0] + x * c + z2 * s, centre[1] + y2, centre[2] - x * s + z2 * c];
  };
  const p = [at(-hx, -hy, -hz), at(hx, -hy, -hz), at(hx, hy, -hz), at(-hx, hy, -hz), at(-hx, -hy, hz), at(hx, -hy, hz), at(hx, hy, hz), at(-hx, hy, hz)];
  quad(part, p[4]!, p[5]!, p[6]!, p[7]!); // +z
  quad(part, p[1]!, p[0]!, p[3]!, p[2]!); // -z
  quad(part, p[5]!, p[1]!, p[2]!, p[6]!); // +x
  quad(part, p[0]!, p[4]!, p[7]!, p[3]!); // -x
  quad(part, p[7]!, p[6]!, p[2]!, p[3]!); // +y
  quad(part, p[0]!, p[1]!, p[5]!, p[4]!); // -y
  return part;
}

/** A cylinder standing on its base at `base` (axis up), or lying along x (a wheel), with smooth sides. */
function cylinder(base: V3, radius: number, height: number, sides = 14, tone = 1, lying = false): Part {
  const part: Part = { position: [], normal: [], tone };
  const at = (angle: number, h: number, r: number): V3 => (lying ? [base[0] + h, base[1] + Math.cos(angle) * r, base[2] + Math.sin(angle) * r] : [base[0] + Math.cos(angle) * r, base[1] + h, base[2] + Math.sin(angle) * r]);
  const out = (angle: number): V3 => (lying ? [0, Math.cos(angle), Math.sin(angle)] : [Math.cos(angle), 0, Math.sin(angle)]);
  const axis: V3 = lying ? [1, 0, 0] : [0, 1, 0];
  for (let i = 0; i < sides; i += 1) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const [p0, p1, p2, p3] = [at(a0, 0, radius), at(a1, 0, radius), at(a1, height, radius), at(a0, height, radius)];
    tri(part, p0, p1, p2, [out(a0), out(a1), out(a1)]);
    tri(part, p0, p2, p3, [out(a0), out(a1), out(a0)]);
    const [c0, c1] = [at(0, 0, 0), at(0, height, 0)];
    tri(part, c1, p3, p2, [axis, axis, axis]); // top
    tri(part, c0, p1, p0, [[-axis[0], -axis[1], -axis[2]], [-axis[0], -axis[1], -axis[2]], [-axis[0], -axis[1], -axis[2]]]);
  }
  return part;
}

/** A strut: a thin box from one point to another. */
function strut(a: V3, b: V3, thickness: number, tone = 1): Part {
  const part: Part = { position: [], normal: [], tone };
  const along = norm(sub(b, a));
  const side = norm(cross(along, Math.abs(along[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]));
  const up = norm(cross(side, along));
  const h = thickness / 2;
  const corner = (p: V3, s: number, u: number): V3 => [p[0] + side[0] * s * h + up[0] * u * h, p[1] + side[1] * s * h + up[1] * u * h, p[2] + side[2] * s * h + up[2] * u * h];
  const ring = (p: V3): V3[] => [corner(p, -1, -1), corner(p, 1, -1), corner(p, 1, 1), corner(p, -1, 1)];
  const [r0, r1] = [ring(a), ring(b)];
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    quad(part, r0[i]!, r0[j]!, r1[j]!, r1[i]!);
  }
  return part;
}

/**
 * The shape of one object as plain parts placed at its site: the lunar module's descent stage (an octagonal body on four legs with a footpad each), the rover (a floor on four wheels, two seats, a console and
 * the dish on its mast), the flag, the ALSEP station and the transmitter. `base` is the height of the ground at the object's place in metres over the site's ground; the shapes stand on it. All of it is this package's
 * drawing from published sizes: it is no model of the real thing.
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
  const at = (x: number, y: number, z: number): V3 => [e + x, base + y, n + z];
  switch (object.kind) {
    case "lander": {
      // the descent stage: an octagon 4.2 m across the flats, 2.3 m deep, its deck 3.2 m up, on legs that reach 4.7 m out to their pads
      const parts: Part[] = [];
      const R = 2.3;
      const top = 3.2;
      const bottom = 0.95;
      const ring = (y: number): V3[] => Array.from({ length: 8 }, (_, i) => at(Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * R, y, Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * R));
      const [a, b] = [ring(bottom), ring(top)];
      const body: Part = { position: [], normal: [], tone: 1.5 };
      for (let i = 0; i < 8; i += 1) {
        const j = (i + 1) % 8;
        quad(body, a[i]!, a[j]!, b[j]!, b[i]!);
        tri(body, at(0, top, 0), b[j]!, b[i]!, [[0, 1, 0], [0, 1, 0], [0, 1, 0]]);
        tri(body, at(0, bottom, 0), a[i]!, a[j]!, [[0, -1, 0], [0, -1, 0], [0, -1, 0]]);
      }
      parts.push(body);
      parts.push(cylinder(at(0, 0.45, 0), 0.62, 0.55, 12, 0.8)); // the engine's bell under it
      for (let i = 0; i < 4; i += 1) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const [cx, cz] = [Math.cos(angle), Math.sin(angle)];
        parts.push(strut(at(cx * 2.0, 2.4, cz * 2.0), at(cx * 4.7, 0.12, cz * 4.7), 0.16, 1.4)); // the leg
        parts.push(strut(at(cx * 2.0, 0.95, cz * 2.0), at(cx * 3.6, 0.9, cz * 3.6), 0.1, 1.2)); // its brace
        parts.push(cylinder(at(cx * 4.7, 0, cz * 4.7), 0.46, 0.1, 12, 1.3)); // the footpad
      }
      return parts;
    }
    case "rover": {
      const turn = (((object.heading ?? 0) * Math.PI) / 180);
      // built facing north (z), turned about the object's place: points are turned the way the vehicle points
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      const place = (x: number, y: number, z: number): V3 => [e + x * c + z * s, base + y, n - x * s + z * c];
      const parts: Part[] = [];
      parts.push(box(place(0, 0.62, 0), [1.7, 0.14, 2.7], turn, 1.15));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(cylinderAt(place(sx * 1.05, 0.41, sz * 0.95), 0.41, 0.23, turn, 0.6));
      for (const sx of [-0.45, 0.45]) {
        parts.push(box(place(sx, 0.86, -0.25), [0.45, 0.12, 0.5], turn, 1.2));
        parts.push(box(place(sx, 1.1, -0.5), [0.45, 0.5, 0.08], turn, 1.2));
      }
      parts.push(box(place(0, 0.95, 0.45), [0.5, 0.35, 0.25], turn, 1.1));
      parts.push(strut(place(0, 0.75, 1.15), place(0, 1.75, 1.15), 0.05, 1.3)); // the mast
      parts.push(box(place(0, 1.85, 1.1), [0.9, 0.04, 0.9], turn, 1.6, -0.5)); // the dish, a flat plate turned up toward the Earth
      return parts;
    }
    case "flag":
      return [cylinder(at(0, 0, 0), 0.015, 2.4, 6, 1.3), box(at(0.55, 2.0, 0), [1.1, 0.7, 0.012], 0, 1.7)];
    case "station":
      return [box(at(0, 0.25, 0), [0.7, 0.5, 0.5], 0.4, 1.5), cylinder(at(1.0, 0, 0.3), 0.18, 0.55, 10, 0.9), strut(at(-0.1, 0.5, 0), at(-0.1, 1.5, 0), 0.03, 1.3)];
    case "instrument":
      return [box(at(0, 0.15, 0), [0.45, 0.3, 0.35], 0.5, 1.4)];
  }
}

/** A wheel: a cylinder lying across the rover, turned with it. */
function cylinderAt(centre: V3, radius: number, width: number, turn: number, tone: number): Part {
  const part = cylinder([0, 0, 0], radius, width, 14, tone, true);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const move = (p: number[], i: number, normal: boolean): void => {
    const [x, y, z] = [p[i]! - (normal ? 0 : width / 2), p[i + 1]!, p[i + 2]!];
    p[i] = (normal ? 0 : centre[0]) + x * c + z * s;
    p[i + 1] = (normal ? 0 : centre[1]) + y;
    p[i + 2] = (normal ? 0 : centre[2]) - x * s + z * c;
  };
  for (let i = 0; i < part.position.length; i += 3) move(part.position, i, false);
  for (let i = 0; i < part.normal.length; i += 3) move(part.normal, i, true);
  return part;
}

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
