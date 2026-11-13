// The plain shapes the things at a site are drawn with: boxes, cylinders, cones, struts and dishes as triangles (x east or right, y up, z north or forward), each piece with a brightness and a flat colour. Pure: no
// DOM. Everything here is this package's drawing from published sizes; none of it is a scan or a model of the real thing.

/**
 * One piece of an object's shape: triangles with their corners and normals (x east, y up, z north), how bright it is (foil and paint are lighter than dust), a flat colour that tints it (white where it has none), and for
 * the rover which wheel it is (0 to 3: front left, front right, rear left, rear right) so that a wheel can be turned.
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
  colour?: [number, number, number];
  wheel?: number;
}

export type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const make = (tone: number, colour?: V3): Part => (colour === undefined ? { position: [], normal: [], tone } : { position: [], normal: [], tone, colour });

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

/** A box with its centre, its three sizes, a turn about the up axis (radians) and a tilt about its own x axis. */
export function box(centre: V3, size: V3, turn = 0, tone = 1, tilt = 0, colour?: V3): Part {
  const part = make(tone, colour);
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const [c, s, ct, st] = [Math.cos(turn), Math.sin(turn), Math.cos(tilt), Math.sin(tilt)];
  const at = (x: number, y: number, z: number): V3 => {
    const y2 = y * ct - z * st;
    const z2 = y * st + z * ct;
    return [centre[0] + x * c + z2 * s, centre[1] + y2, centre[2] - x * s + z2 * c];
  };
  const p = [at(-hx, -hy, -hz), at(hx, -hy, -hz), at(hx, hy, -hz), at(-hx, hy, -hz), at(-hx, -hy, hz), at(hx, -hy, hz), at(hx, hy, hz), at(-hx, hy, hz)];
  quad(part, p[4]!, p[5]!, p[6]!, p[7]!);
  quad(part, p[1]!, p[0]!, p[3]!, p[2]!);
  quad(part, p[5]!, p[1]!, p[2]!, p[6]!);
  quad(part, p[0]!, p[4]!, p[7]!, p[3]!);
  quad(part, p[7]!, p[6]!, p[2]!, p[3]!);
  quad(part, p[0]!, p[1]!, p[5]!, p[4]!);
  return part;
}

/** A cone or a cylinder standing on its base (axis up) or lying along x (a wheel): radius at the base and at the top, smooth sides, ends closed. */
export function frustum(base: V3, r0: number, r1: number, height: number, sides = 14, tone = 1, lying = false, colour?: V3): Part {
  const part = make(tone, colour);
  const at = (angle: number, h: number, r: number): V3 => (lying ? [base[0] + h, base[1] + Math.cos(angle) * r, base[2] + Math.sin(angle) * r] : [base[0] + Math.cos(angle) * r, base[1] + h, base[2] + Math.sin(angle) * r]);
  const side = (angle: number): V3 => {
    const radial: V3 = lying ? [0, Math.cos(angle), Math.sin(angle)] : [Math.cos(angle), 0, Math.sin(angle)];
    const axis: V3 = lying ? [1, 0, 0] : [0, 1, 0];
    const lean = (r0 - r1) / Math.max(height, 1e-6);
    return norm([radial[0] + axis[0] * lean, radial[1] + axis[1] * lean, radial[2] + axis[2] * lean]);
  };
  const axis: V3 = lying ? [1, 0, 0] : [0, 1, 0];
  const back: V3 = [-axis[0], -axis[1], -axis[2]];
  for (let i = 0; i < sides; i += 1) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const [p0, p1, p2, p3] = [at(a0, 0, r0), at(a1, 0, r0), at(a1, height, r1), at(a0, height, r1)];
    tri(part, p0, p1, p2, [side(a0), side(a1), side(a1)]);
    tri(part, p0, p2, p3, [side(a0), side(a1), side(a0)]);
    tri(part, at(0, height, 0), p3, p2, [axis, axis, axis]);
    tri(part, at(0, 0, 0), p1, p0, [back, back, back]);
  }
  return part;
}

/** A cylinder: a frustum with one radius. */
export const cylinder = (base: V3, radius: number, height: number, sides = 14, tone = 1, lying = false, colour?: V3): Part => frustum(base, radius, radius, height, sides, tone, lying, colour);

/** A strut: a thin box from one point to another. */
export function strut(a: V3, b: V3, thickness: number, tone = 1, colour?: V3): Part {
  const part = make(tone, colour);
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

/** A shallow dish: a cone with its rim a radius out and its middle `depth` back, facing along `facing`. Both sides drawn. */
export function dish(centre: V3, facing: V3, radius: number, depth: number, sides = 14, tone = 1, colour?: V3): Part {
  const part = make(tone, colour);
  const f = norm(facing);
  const right = norm(cross(f, Math.abs(f[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]));
  const up = norm(cross(right, f));
  const rim = (angle: number): V3 => [centre[0] + (right[0] * Math.cos(angle) + up[0] * Math.sin(angle)) * radius, centre[1] + (right[1] * Math.cos(angle) + up[1] * Math.sin(angle)) * radius, centre[2] + (right[2] * Math.cos(angle) + up[2] * Math.sin(angle)) * radius];
  const middle: V3 = [centre[0] - f[0] * depth, centre[1] - f[1] * depth, centre[2] - f[2] * depth];
  for (let i = 0; i < sides; i += 1) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    tri(part, middle, rim(a1), rim(a0));
    tri(part, middle, rim(a0), rim(a1));
  }
  return part;
}

/** Turn and move a part about the up axis (radians, clockwise from north as heading is) and put it at a place: `x, z` of the part's own frame are right and forward. */
export function placePart(part: Part, east: number, base: number, north: number, turn: number): Part {
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  const out: Part = { ...part, position: [], normal: [] };
  for (let i = 0; i < part.position.length; i += 3) {
    const [x, y, z] = [part.position[i]!, part.position[i + 1]!, part.position[i + 2]!];
    out.position.push(east + x * c + z * s, base + y, north - x * s + z * c);
    const [nx, ny, nz] = [part.normal[i]!, part.normal[i + 1]!, part.normal[i + 2]!];
    out.normal.push(nx * c + nz * s, ny, -nx * s + nz * c);
  }
  return out;
}

const GOLD: V3 = [1, 0.74, 0.3];
const SILVER: V3 = [0.86, 0.87, 0.9];
const DARK: V3 = [0.32, 0.33, 0.36];

/**
 * The lunar module's descent stage in its own frame (x right, z forward, the middle of its footprint on the ground at the origin): an octagonal body in a flat gold, a dark deck, the engine's bell under it, four splayed
 * legs each with two braces and a footpad, and the ladder down the forward leg to a porch. Sizes from the published ones (about 4.2 m across the body, the deck 3.2 m up, 4.7 m from the middle to a footpad).
 *
 * @returns The parts.
 *
 * @example
 * ```ts
 * import { landerParts } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(landerParts().length, "parts");
 * ```
 */
export function landerParts(): Part[] {
  const parts: Part[] = [];
  const R = 2.3;
  const [bottom, top] = [0.95, 3.2];
  const ring = (y: number, r = R): V3[] => Array.from({ length: 8 }, (_, i) => [Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * r, y, Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * r] as V3);
  const [a, b] = [ring(bottom), ring(top)];
  const body = make(1.25, GOLD);
  for (let i = 0; i < 8; i += 1) {
    const j = (i + 1) % 8;
    quad(body, a[i]!, a[j]!, b[j]!, b[i]!);
    tri(body, [0, bottom, 0], a[i]!, a[j]!, [[0, -1, 0], [0, -1, 0], [0, -1, 0]]);
  }
  parts.push(body);
  const deck = make(0.7, DARK);
  const d = ring(top + 0.06, R - 0.12);
  for (let i = 0; i < 8; i += 1) {
    const j = (i + 1) % 8;
    tri(deck, [0, top + 0.06, 0], d[j]!, d[i]!, [[0, 1, 0], [0, 1, 0], [0, 1, 0]]);
  }
  parts.push(deck);
  // the equipment bay's door on one flat, and the engine's bell under the body
  parts.push(box([R * Math.cos(Math.PI / 8) + 0.04, 1.9, 0], [0.08, 1.1, 1.3], 0, 0.6, 0, DARK));
  parts.push(frustum([0, 0.28, 0], 0.8, 0.36, 0.7, 14, 0.7, false, DARK));
  for (let k = 0; k < 4; k += 1) {
    const angle = (k * Math.PI) / 2 + Math.PI / 4;
    const [cx, cz] = [Math.cos(angle), Math.sin(angle)];
    const [px, pz] = [-cz, cx];
    const pad: V3 = [cx * 4.7, 0.12, cz * 4.7];
    // the leg and its two braces, which join it a third of the way down from the body's corner
    parts.push(strut([cx * 1.95, 2.5, cz * 1.95], pad, 0.16, 1.2, SILVER));
    for (const side of [-1, 1]) parts.push(strut([cx * 2.1 + px * side * 1.05, 1.3, cz * 2.1 + pz * side * 1.05], [cx * 3.4, 1.35, cz * 3.4], 0.09, 1.1, SILVER));
    parts.push(cylinder([pad[0], 0, pad[2]], 0.46, 0.09, 14, 1.2, false, SILVER));
    if (k === 0) {
      // the forward leg: a porch on the body and a ladder of two rails and rungs from it to the ground
      parts.push(box([cx * 2.75, 1.85, cz * 2.75], [0.95, 0.06, 0.8], Math.atan2(cx, cz), 1.1, 0, SILVER));
      for (const side of [-1, 1]) parts.push(strut([cx * 2.75 + px * side * 0.26, 1.85, cz * 2.75 + pz * side * 0.26], [cx * 4.3 + px * side * 0.26, 0.05, cz * 4.3 + pz * side * 0.26], 0.05, 1.2, SILVER));
      for (let r = 1; r <= 5; r += 1) {
        const t = r / 6;
        parts.push(box([cx * (2.75 + 1.55 * t), 1.85 * (1 - t) + 0.05 * t, cz * (2.75 + 1.55 * t)], [0.54, 0.035, 0.05], Math.atan2(cx, cz) + Math.PI / 2, 1.1, 0, SILVER));
      }
    }
  }
  return parts;
}

/**
 * The lunar rover in its own frame (x right, z forward, the middle of its wheelbase on the ground at the origin): a frame and floor, four wheels (parts 0 to 3: front left, front right, rear left, rear right) with a
 * fender over each, two seats, the console with its handle, the dish on its mast, the television camera on its own mast, a whip antenna and the boxes at both ends. Sizes from the published ones (about 3.05 m long, 2.13 m
 * wide, wheels 0.81 m across, the wheelbase 2.29 m).
 *
 * @returns The parts.
 *
 * @example
 * ```ts
 * import { roverParts } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(roverParts().filter((part) => part.wheel !== undefined).length, "wheels");
 * ```
 */
export function roverParts(): Part[] {
  const parts: Part[] = [];
  const grey: V3 = [0.84, 0.85, 0.88];
  const tan: V3 = [0.82, 0.78, 0.68];
  const seatColour: V3 = [0.74, 0.76, 0.84];
  // the frame: two rails with three cross pieces, the floor between them, the decks at both ends
  for (const x of [-0.55, 0.55]) parts.push(box([x, 0.55, 0], [0.09, 0.09, 3.0], 0, 1.1, 0, grey));
  for (const z of [-1.4, -0.2, 1.3]) parts.push(box([0, 0.55, z], [1.2, 0.07, 0.09], 0, 1.1, 0, grey));
  parts.push(box([0, 0.57, -0.2], [1.1, 0.03, 1.1], 0, 1.0, 0, grey));
  parts.push(box([0, 0.57, 1.0], [1.15, 0.03, 0.7], 0, 1.0, 0, grey));
  parts.push(box([0, 0.57, -1.1], [1.15, 0.03, 0.6], 0, 1.0, 0, grey));
  const wheels: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  wheels.forEach(([sx, sz], index) => {
    const centre: V3 = [sx * 0.95, 0.41, sz * 1.15];
    // a wheel of wire mesh (dark, with a lighter hub), its strut to the frame and its fender over the top
    const wheel = cylinder([-0.115, 0, 0], 0.41, 0.23, 16, 0.55, true, DARK);
    const hub = cylinder([-0.12, 0, 0], 0.16, 0.24, 10, 1.0, true, [0.7, 0.72, 0.76]);
    for (const part of [wheel, hub]) {
      part.wheel = index;
      for (let i = 0; i < part.position.length; i += 3) {
        part.position[i] = part.position[i]! + centre[0];
        part.position[i + 1] = part.position[i + 1]! + centre[1];
        part.position[i + 2] = part.position[i + 2]! + centre[2];
      }
      parts.push(part);
    }
    parts.push(strut([sx * 0.55, 0.55, sz * 1.15], [sx * 0.85, 0.45, sz * 1.15], 0.07, 1.1, grey));
    // the fender: five narrow boards along an arc a hand above the tyre
    for (let s = 0; s < 5; s += 1) {
      const a0 = ((-65 + s * 26) * Math.PI) / 180;
      const a1 = ((-65 + (s + 1) * 26) * Math.PI) / 180;
      const r = 0.52;
      const p0: V3 = [centre[0], centre[1] + Math.cos(a0) * r, centre[2] + Math.sin(a0) * r];
      const p1: V3 = [centre[0], centre[1] + Math.cos(a1) * r, centre[2] + Math.sin(a1) * r];
      parts.push(strut(p0, p1, 0.02, 1.15, tan));
      const wide = box([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2], [0.34, 0.02, Math.hypot(p1[2] - p0[2], p1[1] - p0[1])], 0, 1.15, -Math.atan2(p1[1] - p0[1], p1[2] - p0[2]), tan);
      parts.push(wide);
    }
  });
  for (const x of [-0.42, 0.42]) {
    parts.push(box([x, 0.82, -0.3], [0.44, 0.06, 0.46], 0, 1.15, 0, seatColour));
    parts.push(box([x, 1.1, -0.55], [0.44, 0.5, 0.05], 0, 1.15, 0.12, seatColour));
    parts.push(strut([x, 0.58, -0.1], [x, 0.8, -0.1], 0.04, 1.0, grey));
  }
  // the console with its hand controller, between and in front of the seats
  parts.push(box([0, 0.95, 0.45], [0.46, 0.3, 0.25], 0, 0.9, 0, DARK));
  parts.push(strut([0, 1.1, 0.35], [0, 1.4, 0.3], 0.03, 1.0, DARK));
  parts.push(box([0, 1.42, 0.3], [0.2, 0.04, 0.05], 0, 1.0, 0, DARK));
  // the dish on its mast at the front, turned up and back toward the Earth, and the camera's own mast beside it
  parts.push(strut([0, 0.6, 1.2], [0, 1.65, 1.2], 0.05, 1.2, grey));
  parts.push(dish([0, 1.75, 1.2], [0, 0.55, -0.55], 0.46, 0.14, 14, 1.4, [0.95, 0.95, 0.97]));
  parts.push(strut([-0.38, 0.6, 1.3], [-0.38, 1.4, 1.3], 0.04, 1.2, grey));
  parts.push(box([-0.38, 1.5, 1.3], [0.26, 0.16, 0.18], 0, 1.0, 0, [0.5, 0.52, 0.56]));
  parts.push(strut([0.4, 0.6, 1.05], [0.4, 1.8, 1.05], 0.012, 1.0, DARK));
  // the boxes: the batteries at the front, the tools at the back
  for (const x of [-0.4, 0.4]) parts.push(box([x, 0.76, 0.85], [0.36, 0.26, 0.38], 0, 1.0, 0, SILVER));
  parts.push(box([0, 0.78, -1.15], [0.9, 0.3, 0.5], 0, 1.05, 0, SILVER));
  return parts;
}
