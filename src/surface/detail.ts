// The made detail: what is smaller than the 5 m grid. Craters by the lunar size-frequency law (many small, few large, soft rims, a depth of a fifth of the diameter when fresh and shallower as they
// age), laid on a seeded grid of cells, so the same place is always the same. It is MADE, not measured, and the page says so. The shader (glsl.ts) holds the same formulas; this is the same
// maths in JS, for the feet (the eyes follow the made ground too), for the rocks (placed on the ground and denser by fresh rims) and for the tests that hold the two together.
// Every random number is an integer hash (PCG, 32 bit) cut to 24 bits, so the two agree exactly.
import { keepAway, type SiteObject } from "./objects.ts";

/** The objects the made ground keeps away from: set for the site being stood on (`setKeepOut`), none until then. */
let keepObjects: readonly SiteObject[] = [];

/**
 * Say which objects the made craters and rocks keep away from (the ones `objectsOf` gives for the site), or none. The shader holds the same list.
 *
 * @param objects - The objects.
 *
 * @example
 * ```ts
 * import { madeGround, objectsOf, setKeepOut } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const [lander] = objectsOf("apollo-17");
 * setKeepOut(objectsOf("apollo-17"));
 * console.log(madeGround(lander!.east, lander!.north, 0.35).h);
 * setKeepOut([]);
 * ```
 */
export function setKeepOut(objects: readonly SiteObject[]): void {
  keepObjects = objects;
}


/** The smallest crater's nominal diameter in metres: each octave doubles it, up to `OCTAVES` octaves (0.5, 1, 2, 4, 8, 16). A crater in an octave is between 1 and 2 times its nominal diameter. */
export const D0 = 0.5;
export const OCTAVES = 6;
/** A cell is this many nominal diameters across, with at most one crater in it. */
export const CELL = 3;
/** The share of a cell, from its edge, within which the craters of the cell over the edge are looked for. */
export const NEAR_EDGE = 0.2;

const mul = (a: number, b: number): number => Math.imul(a, b) >>> 0;

/** The PCG hash of two 32 bit integers, as the shader does it. */
export function pcg2d(x: number, y: number): [number, number] {
  let vx = (mul(x, 1664525) + 1013904223) >>> 0;
  let vy = (mul(y, 1664525) + 1013904223) >>> 0;
  vx = (vx + mul(vy, 1664525)) >>> 0;
  vy = (vy + mul(vx, 1664525)) >>> 0;
  vx = (vx ^ (vx >>> 16)) >>> 0;
  vy = (vy ^ (vy >>> 16)) >>> 0;
  vx = (vx + mul(vy, 1664525)) >>> 0;
  vy = (vy + mul(vx, 1664525)) >>> 0;
  vx = (vx ^ (vx >>> 16)) >>> 0;
  vy = (vy ^ (vy >>> 16)) >>> 0;
  return [vx, vy];
}

/** A hash cut to a number from 0 up to but not including 1, exact in 24 bits. */
export const unit24 = (h: number): number => (h >>> 8) / 16777216;

/**
 * One crater: where its middle is (metres in the site's plane), its radius, how deep and how high its rim, how wide its rim, and how old (0 fresh, 1 worn flat).
 *
 * @example
 * ```ts
 * import { craterProfile, type Crater } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const crater: Crater = { x: 0, y: 0, radius: 4, depth: 0.8, rim: 0.2, rimWidth: 0.3, age: 0.2 };
 * console.log(`${craterProfile(crater, 0, 0).h.toFixed(2)} m at the middle`);
 * ```
 */
export interface Crater {
  x: number;
  y: number;
  radius: number;
  depth: number;
  rim: number;
  rimWidth: number;
  age: number;
}

/** The share of cells that hold a crater in an octave: many small, few large. */
export const occupancy = (octave: number): number => (octave >= 3 ? 0.5 : 1) * 0.36 * Math.pow(2, -0.5 * octave);

/**
 * The crater in a cell of an octave, or `undefined` for an empty cell.
 *
 * @param cx - The cell's column.
 * @param cy - The cell's row.
 * @param octave - 0 for the smallest (0.5 m) up.
 * @returns The crater, or `undefined` when the cell holds none (most cells do not: see `occupancy`).
 *
 * @example
 * ```ts
 * import { craterIn } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(craterIn(4, -2, 3)?.radius.toFixed(2), craterIn(0, 0, 3));
 * ```
 */
export function craterIn(cx: number, cy: number, octave: number): Crater | undefined {
  const [a, b] = pcg2d((cx | 0) >>> 0, ((cy | 0) + octave * 7919) >>> 0);
  if (unit24(a) >= occupancy(octave)) return undefined;
  const [c, d] = pcg2d(((cx | 0) + 104729) >>> 0, ((cy | 0) + octave * 7919 + 15485863) >>> 0);
  const nominal = D0 * 2 ** octave;
  const cell = CELL * nominal;
  const diameter = nominal * (1 + (octave === OCTAVES - 1 ? 0.25 : 1) * unit24(d));
  // most craters are old: of every hundred, about four are fresh (age under 0.15) and three in four are worn (over 0.7): soft, shallow, nearly rimless bowls
  const r = (a & 255) / 255;
  const age = 1 - r * r * r * r;
  const radius = diameter / 2;
  const vary = 0.6 + 0.4 * ((c & 255) / 255);
  return {
    x: (cx + 0.25 + 0.5 * unit24(b)) * cell,
    y: (cy + 0.25 + 0.5 * unit24(c)) * cell,
    radius,
    depth: diameter * (0.2 - 0.17 * age) * vary,
    rim: 0.045 * diameter * (1 - age) ** 1.5,
    rimWidth: 0.22 + 0.5 * age,
    age,
  };
}

/**
 * A crater's height at a point: the bowl, the soft rim. Also the slope along x and y.
 *
 * @param c - The crater.
 * @param px - Metres east of the site.
 * @param py - Metres north of the site.
 * @returns The height in metres (negative in the bowl, positive on the rim) and the slope along east (`gx`) and north (`gy`).
 *
 * @example
 * ```ts
 * import { craterProfile, type Crater } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const crater: Crater = { x: 0, y: 0, radius: 4, depth: 0.8, rim: 0.2, rimWidth: 0.3, age: 0.2 };
 * console.log(craterProfile(crater, 0, 0).h.toFixed(2), craterProfile(crater, 4, 0).h.toFixed(2));
 * ```
 */
export function craterProfile(c: Crater, px: number, py: number): { h: number; gx: number; gy: number } {
  const dx = px - c.x;
  const dy = py - c.y;
  const r = Math.hypot(dx, dy);
  const x = r / c.radius;
  let h = 0;
  let dh = 0;
  if (x < 1) {
    // a fresh bowl is a plain parabola with a sharp edge; a worn one has a flat rim and a slope that dies out at the edge, so no outline shows
    const bowl = 1 - x * x;
    const pw = 1 + c.age;
    h = -c.depth * bowl ** pw;
    dh = 2 * c.depth * pw * x * bowl ** c.age;
  }
  const e = (x - 1) / c.rimWidth;
  const rim = c.rim * Math.exp(-e * e);
  h += rim;
  dh += (-2 * c.rim * e * Math.exp(-e * e)) / c.rimWidth;
  // a long soft apron past the rim: the ejecta, a thin tail
  if (x > 1) {
    const tail = 0.25 * c.rim * Math.pow(1 / x, 3);
    h += tail;
    dh += -0.75 * c.rim * Math.pow(1 / x, 4);
  }
  const k = r > 1e-9 ? dh / (c.radius * r) : 0;
  return { h, gx: k * dx, gy: k * dy };
}

/** How far a crater's reach goes in multiples of its radius, beyond which the apron is too faint to count. */
export const REACH = 4;

/**
 * The made ground's height at a point, and its slope, from every crater of every octave not smaller than `fromDiameter` (a crater is faded in over a factor of two above it, so none
 * pops). The cell the point is in is looked at in each octave, and a neighbouring cell when the point is within a fifth of the edge between them: a crater is kept to the middle of its cell, so its rim and the strong part of its apron reach no further.
 *
 * @param x - Metres east of the site.
 * @param y - Metres north of the site.
 * @param fromDiameter - The smallest nominal diameter to count, in metres: a distance's worth of pixels (craters smaller than a few pixels only shimmer).
 * @returns The height in metres and the slope along east and north.
 *
 * @example
 * ```ts
 * import { madeGround } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(madeGround(12.5, -8, 0.5).h.toFixed(2));
 * ```
 */
export function madeGround(x: number, y: number, fromDiameter: number): { h: number; gx: number; gy: number } {
  let h = 0;
  let gx = 0;
  let gy = 0;
  for (let octave = OCTAVES - 1; octave >= 0; octave -= 1) {
    const nominal = D0 * 2 ** octave;
    const fade = Math.max(0, Math.min(1, (nominal / fromDiameter - 1) * 1));
    if (fade <= 0) break;
    const cell = CELL * nominal;
    const ix = Math.floor(x / cell);
    const iy = Math.floor(y / cell);
    const fx = x / cell - ix;
    const fy = y / cell - iy;
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        // a crater is kept inside the middle half of its cell and no wider than a third of it, so a neighbour's reaches this cell only within a fifth of the cell's edge
        if ((i === -1 && fx > NEAR_EDGE) || (i === 1 && fx < 1 - NEAR_EDGE) || (j === -1 && fy > NEAR_EDGE) || (j === 1 && fy < 1 - NEAR_EDGE)) continue;
        const crater = craterIn(ix + i, iy + j, octave);
        if (crater === undefined) continue;
        const p = craterProfile(crater, x, y);
        h += fade * p.h;
        gx += fade * p.gx;
        gy += fade * p.gy;
      }
    }
  }
  const keep = keepAway(x, y, keepObjects);
  return { h: h * keep, gx: gx * keep, gy: gy * keep };
}

/**
 * One rock: where it lies, how big (its longest side in metres), which of the three shapes, how it is turned, how bright it is, and how flat.
 *
 * @example
 * ```ts
 * import { rocksAround, type Rock } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const rock: Rock | undefined = rocksAround(0, 0, 20, 0.0024)[0];
 * console.log(rock?.size.toFixed(2), rock?.shape);
 * ```
 */
export interface Rock {
  x: number;
  y: number;
  size: number;
  shape: number;
  turn: number;
  tone: number;
  flat: number;
}

/** The rocks of a class are `ROCK_MIN * 2 ** class` metres: 0.05, 0.1, 0.2, 0.4, 0.8, 1.6; a rock of a class is between 1 and 1.4 times that. */
export const ROCK_MIN = 0.05;
export const ROCK_CLASSES = 6;
/** Rocks a square metre is dealt of the smallest class (two and a half times what stays on ground far from a rim: a rock is kept in proportion to how near a young rim it is), and the side of the cells they are laid on, in metres. */
const ROCK_DENSITY = 0.8;
const ROCK_CELL = 6;

/**
 * How much denser the rocks are at a point for fresh crater rims near it: 1 away from any, up to 5 on a young crater's rim.
 *
 * @param x - Metres east of the site.
 * @param y - Metres north of the site.
 * @returns A factor from 1 (no young rim near) up to 5 (on one).
 *
 * @example
 * ```ts
 * import { rimBoost } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(rimBoost(0, 0), rimBoost(51, -19) >= 1);
 * ```
 */
export function rimBoost(x: number, y: number): number {
  let boost = 1;
  for (let octave = 2; octave < OCTAVES; octave += 1) {
    const cell = CELL * D0 * 2 ** octave;
    const ix = Math.floor(x / cell);
    const iy = Math.floor(y / cell);
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        const c = craterIn(ix + i, iy + j, octave);
        if (c === undefined || c.age > 0.35) continue;
        const t = Math.abs(Math.hypot(x - c.x, y - c.y) / c.radius - 1.0);
        if (t < 0.4) boost = Math.max(boost, 1 + 4 * (1 - t / 0.4) * (1 - c.age / 0.35));
      }
    }
  }
  return boost;
}

/**
 * The rocks round a point, within `radius` metres: seeded and fixed to the place. Many small, few large (about a third as many of each class up), denser by fresh rims; a rock too small for a few pixels at its
 * distance is left out, so nothing shimmers. They are made, not measured.
 *
 * @param cx - Metres east of the site.
 * @param cy - Metres north of the site.
 * @param radius - How far round to look, in metres.
 * @param pixel - The angle one pixel takes in radians (a rock smaller than three pixels at its distance is left out).
 * @returns The rocks, nearest first.
 *
 * @example
 * ```ts
 * import { rocksAround } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(rocksAround(0, 0, 20, 0.0024).length > 100);
 * ```
 */
export function rocksAround(cx: number, cy: number, radius: number, pixel: number): Rock[] {
  const out: Rock[] = [];
  const i0 = Math.floor((cx - radius) / ROCK_CELL);
  const i1 = Math.floor((cx + radius) / ROCK_CELL);
  const j0 = Math.floor((cy - radius) / ROCK_CELL);
  const j1 = Math.floor((cy + radius) / ROCK_CELL);
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      for (let k = 0; k < ROCK_CLASSES; k += 1) {
        const [a, b] = pcg2d((i | 0) >>> 0, ((j | 0) + k * 6151 + 1000003) >>> 0);
        const lambda = ROCK_DENSITY * ROCK_CELL * ROCK_CELL * 0.3 ** k;
        let count = Math.floor(lambda);
        if (unit24(a) < lambda - count) count += 1;
        for (let n = 0; n < Math.min(count, 48); n += 1) {
          const [c, d] = pcg2d(((i | 0) + n * 31 + 7) >>> 0, ((j | 0) + k * 6151 + n * 977 + 1000033) >>> 0);
          const x = (i + unit24(c)) * ROCK_CELL;
          const y = (j + unit24(d)) * ROCK_CELL;
          const dist = Math.hypot(x - cx, y - cy);
          if (dist > radius) continue;
          const size = ROCK_MIN * 2 ** k * (1 + 0.4 * unit24(b >>> 0 ^ (c << 3)));
          if (size < 3 * dist * pixel) continue;
          // fewer where the rims are not near: two fifths of what is dealt on the plain, all of it by a young rim
          const boost = rimBoost(x, y);
          if (unit24(pcg2d(c, d)[0]) > 0.3 * boost) continue;
          if (keepAway(x, y, keepObjects) < 0.5) continue;
          const [e, f] = pcg2d(c ^ 0x9e3779b9, d + 17);
          out.push({ x, y, size, shape: e % 3, turn: unit24(f) * Math.PI * 2, tone: 0.75 + 0.5 * unit24(e >>> 3), flat: 0.45 + 0.4 * unit24(f >>> 5) });
        }
      }
    }
  }
  return out.sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
}

/**
 * The nearest place to a point where a person can stand without being in a made crater or on a made rim: the made ground there is level over two metres round. The landing point itself is
 * the first tried, so most of the time a person stands where the lunar module stood.
 *
 * @param x - Metres east of the site.
 * @param y - Metres north of the site.
 * @returns A place within thirty metres of the point.
 *
 * @example
 * ```ts
 * import { standingPlace } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const place = standingPlace(0, 0);
 * console.log(Math.hypot(place.x, place.y) < 30);
 * ```
 */
export function standingPlace(x = 0, y = 0): { x: number; y: number } {
  const level = (px: number, py: number): boolean => {
    const here = madeGround(px, py, 0.35);
    if (Math.hypot(here.gx, here.gy) > 0.05) return false;
    for (let k = 0; k < 8; k += 1) {
      const a = (k * Math.PI) / 4;
      if (Math.abs(madeGround(px + 2.2 * Math.cos(a), py + 2.2 * Math.sin(a), 0.35).h - here.h) > 0.12) return false;
    }
    return true;
  };
  for (let r = 0; r <= 30; r += 2) {
    const n = Math.max(1, Math.round(r * 1.2));
    for (let k = 0; k < n; k += 1) {
      const a = (k / n) * Math.PI * 2;
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      if (level(px, py)) return { x: px, y: py };
    }
  }
  return { x, y };
}
