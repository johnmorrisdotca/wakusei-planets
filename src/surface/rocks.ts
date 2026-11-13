// The rocks and their shadows as geometry: each rock a small faceted stone of one of three shapes, set on the ground, and a quad of shadow laid on the ground away from the Sun. Pure: the
// ground's height is a function handed in. All made, none measured.
import { pcg2d, unit24, type Rock } from "./detail.ts";

/**
 * The arrays of the rocks' mesh, in the site's plane (east, up, north): `ROCK_VERTICES` (240) a rock, and 10 for its shadow.
 *
 * @example
 * ```ts
 * import { rockMesh, type RockMesh } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const mesh: RockMesh = rockMesh([{ x: 2, y: 3, size: 0.5, shape: 0, turn: 0, tone: 1, flat: 0.6 }], () => 0, { azimuth: 95, altitude: 13 });
 * console.log(mesh.count, mesh.position.length / 3, mesh.shadowIndex.length);
 * ```
 */
export interface RockMesh {
  position: Float32Array;
  normal: Float32Array;
  tone: Float32Array;
  count: number;
  shadowPosition: Float32Array;
  shadowUv: Float32Array;
  shadowIndex: Uint32Array;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSAHEDRON: readonly (readonly [number, number, number])[] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map((v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
});
const FACES: readonly (readonly [number, number, number])[] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/** The icosahedron cut once: each edge's middle pushed out to the sphere, so 42 corners and 80 faces, round enough that a rock seen close is not a die. */
const subdivided = ((): { vertices: (readonly [number, number, number])[]; faces: (readonly [number, number, number])[] } => {
  const vertices = [...ICOSAHEDRON];
  const middle = new Map<string, number>();
  const mid = (a: number, b: number): number => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    let at = middle.get(key);
    if (at === undefined) {
      const p = vertices[a]!;
      const q = vertices[b]!;
      const m: [number, number, number] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
      const l = Math.hypot(m[0], m[1], m[2]);
      at = vertices.push([m[0] / l, m[1] / l, m[2] / l]) - 1;
      middle.set(key, at);
    }
    return at;
  };
  const faces: (readonly [number, number, number])[] = [];
  for (const [a, b, c] of FACES) {
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    faces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  return { vertices, faces };
})();

/** Vertices a rock's mesh has: 80 faces of 3. */
export const ROCK_VERTICES = subdivided.faces.length * 3;

/** The three shapes: the cut icosahedron with each corner pulled in or out by a seeded share, in lumps (a corner takes the share of its neighbours too), so each shape is its own and none is a ball. */
export const SHAPES: readonly (readonly (readonly [number, number, number])[])[] = [0, 1, 2].map((shape) => {
  const raw = subdivided.vertices.map((_, i) => 0.78 + 0.42 * unit24(pcg2d(shape * 101 + 5, i * 13 + 9)[0]));
  return subdivided.vertices.map((v, i) => {
    // smoothed over the corner's own face neighbours, so the lumps are broad
    let sum = raw[i]!;
    let n = 1;
    for (const f of subdivided.faces) {
      if (f[0] === i || f[1] === i || f[2] === i) {
        for (const j of f) {
          if (j !== i) {
            sum += raw[j]!;
            n += 1;
          }
        }
      }
    }
    const k = (raw[i]! + sum / n) / 2;
    return [v[0] * k, v[1] * k, v[2] * k] as const;
  });
});

/** How many segments a shadow is cut into along its length, so it follows the ground it lies on. */
const SEGMENTS = 4;

/**
 * The mesh of a list of rocks standing on the ground, and a shadow for each.
 *
 * @param rocks - The rocks, from `rocksAround`.
 * @param ground - The ground's height at a point (metres east and north of the site), the made craters on it and the Moon's curve taken off.
 * @param sun - The Sun's azimuth (degrees clockwise from north) and altitude (degrees).
 * @returns The arrays.
 *
 * @example
 * ```ts
 * import { rockMesh, rocksAround } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const mesh = rockMesh(rocksAround(0, 0, 20, 0.0024), () => 0, { azimuth: 95, altitude: 13 });
 * console.log(mesh.count, "rocks");
 * ```
 */
export function rockMesh(rocks: readonly Rock[], ground: (x: number, y: number) => number, sun: { azimuth: number; altitude: number }): RockMesh {
  const n = rocks.length;
  const per = ROCK_VERTICES;
  const position = new Float32Array(n * per * 3);
  const normal = new Float32Array(n * per * 3);
  const tone = new Float32Array(n * per);
  const shadowPosition = new Float32Array(n * (SEGMENTS + 1) * 2 * 3);
  const shadowUv = new Float32Array(n * (SEGMENTS + 1) * 2 * 2);
  const shadowIndex = new Uint32Array(n * SEGMENTS * 6);
  const away = ((sun.azimuth + 180) * Math.PI) / 180;
  const ax = Math.sin(away);
  const ay = Math.cos(away);
  const tan = Math.tan((Math.max(sun.altitude, 0.8) * Math.PI) / 180);
  let p = 0;
  let q = 0;
  let sp = 0;
  let su = 0;
  let si = 0;
  rocks.forEach((rock) => {
    const base = SHAPES[rock.shape]!;
    const half = rock.size / 2;
    const sx = half;
    const sz = half * (0.55 + 0.45 * ((rock.tone * 7) % 1));
    const sy = half * rock.flat;
    const c = Math.cos(rock.turn);
    const s = Math.sin(rock.turn);
    // half buried: the middle is only a quarter of its height over the ground
    const lift = sy * 0.25;
    const ground0 = ground(rock.x, rock.y);
    const corner = base.map(([vx, vy, vz]) => {
      const lx = vx * sx;
      const lz = vz * sz;
      const ly = vy * sy;
      // the smooth normal of the ellipsoid it is cut from, turned with the rock: a stone with lumps, not a die
      const ex = vx / sx;
      const ey = vy / sy;
      const ez = vz / sz;
      const l = Math.hypot(ex, ey, ez) || 1;
      const nx0 = ex / l;
      const nz0 = ez / l;
      return { pos: [rock.x + lx * c - lz * s, ground0 + lift + ly, rock.y + lx * s + lz * c] as const, normal: [nx0 * c - nz0 * s, ey / l, nx0 * s + nz0 * c] as const };
    });
    for (const [a, b, d] of subdivided.faces) {
      for (const k of [a, b, d]) {
        const v = corner[k]!;
        position[p++] = v.pos[0];
        position[p++] = v.pos[1];
        position[p++] = v.pos[2];
        normal[q++] = v.normal[0];
        normal[q++] = v.normal[1];
        normal[q++] = v.normal[2];
        tone[(p - 3) / 3] = rock.tone;
      }
    }
    // its shadow: along the way the light goes, as long as the rock is high over tan(the Sun's altitude), as wide as the rock
    const length = Math.min(14, (sy * 2 + lift) / tan);
    const width = Math.max(sx, sz) * 0.85;
    const firstVertex = sp / 3;
    for (let k = 0; k <= SEGMENTS; k += 1) {
      const u = k / SEGMENTS;
      const w = width * (1 - 0.45 * u);
      for (const side of [-1, 1] as const) {
        const x = rock.x + ax * length * u - ay * w * side;
        const y = rock.y + ay * length * u + ax * w * side;
        shadowPosition[sp++] = x;
        shadowPosition[sp++] = ground(x, y) + 0.03;
        shadowPosition[sp++] = y;
        shadowUv[su++] = u;
        shadowUv[su++] = side;
      }
    }
    for (let k = 0; k < SEGMENTS; k += 1) {
      const a = firstVertex + k * 2;
      shadowIndex[si++] = a;
      shadowIndex[si++] = a + 1;
      shadowIndex[si++] = a + 2;
      shadowIndex[si++] = a + 1;
      shadowIndex[si++] = a + 3;
      shadowIndex[si++] = a + 2;
    }
  });
  return { position, normal, tone, count: n, shadowPosition, shadowUv, shadowIndex };
}
