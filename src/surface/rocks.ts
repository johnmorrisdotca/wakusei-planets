// The rocks and their shadows as geometry: each rock a small faceted stone of one of three shapes, set on the ground, and a quad of shadow laid on the ground away from the Sun. Pure: the
// ground's height is a function handed in. All made, none measured.
import { pcg2d, unit24, type Rock } from "./detail.ts";

/** The arrays of the rocks' mesh, in the site's plane (east, up, north): 60 vertices a rock, and 10 for its shadow. */
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

/** The three shapes: the icosahedron with each corner pulled in or out by a seeded share, so a rock is lumpy and each shape is its own. */
export const SHAPES: readonly (readonly (readonly [number, number, number])[])[] = [0, 1, 2].map((shape) =>
  ICOSAHEDRON.map((v, i) => {
    const k = 0.72 + 0.5 * unit24(pcg2d(shape * 101 + 5, i * 13 + 9)[0]);
    return [v[0] * k, v[1] * k, v[2] * k] as const;
  }),
);

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
  const position = new Float32Array(n * 60 * 3);
  const normal = new Float32Array(n * 60 * 3);
  const tone = new Float32Array(n * 60);
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
  rocks.forEach((rock, index) => {
    const base = SHAPES[rock.shape]!;
    const half = rock.size / 2;
    const sx = half;
    const sz = half * (0.55 + 0.45 * ((rock.tone * 7) % 1));
    const sy = half * rock.flat;
    const c = Math.cos(rock.turn);
    const s = Math.sin(rock.turn);
    const lift = sy * 0.55;
    const ground0 = ground(rock.x, rock.y);
    const world = base.map(([vx, vy, vz]) => {
      const lx = vx * sx;
      const lz = vz * sz;
      return [rock.x + lx * c - lz * s, ground0 + lift + vy * sy, rock.y + lx * s + lz * c] as const;
    });
    for (const [a, b, d] of FACES) {
      const A = world[a]!;
      const B = world[b]!;
      const D = world[d]!;
      const ux = B[0] - A[0];
      const uy = B[1] - A[1];
      const uz = B[2] - A[2];
      const vx = D[0] - A[0];
      const vy = D[1] - A[1];
      const vz = D[2] - A[2];
      // (up, north) are the scene's y and z; a face's normal points out of the rock
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const cx = (A[0] + B[0] + D[0]) / 3 - rock.x;
      const cy = (A[1] + B[1] + D[1]) / 3 - (ground0 + lift);
      const cz = (A[2] + B[2] + D[2]) / 3 - rock.y;
      if (nx * cx + ny * cy + nz * cz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      for (const V of [A, B, D]) {
        position[p++] = V[0];
        position[p++] = V[1];
        position[p++] = V[2];
        normal[q++] = nx / l;
        normal[q++] = ny / l;
        normal[q++] = nz / l;
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
    void index;
  });
  return { position, normal, tone, count: n, shadowPosition, shadowUv, shadowIndex };
}
