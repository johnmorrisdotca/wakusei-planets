// The real shape of a small moon, as three.js draws it: the globe (`SphereGeometry`) with every vertex moved to the moon's radius in its direction, from a table cut out of a published shape model (scripts/make-moon-shapes.py). The moon is
// drawn with its own shader, map and light on this mesh as on a sphere (the shader works from the direction of a point, which is the same on the moved vertex), with normals worked out from the moved mesh. Pure data and geometry: no DOM, no clock.
import type * as THREE from "three";
import type { ThreeParts } from "./body.ts";

/**
 * A moon's shape as a table of radii: `lon` steps of longitude and `lat` steps of latitude round the globe (the vertices of `SphereGeometry(1, lon, lat)`, `(lat + 1) * lon` radii, the seam and the poles shared), each
 * in units of 1 / `unit` kilometre (`unit` is a tenth of a per cent of the moon's mean radius). The radii are whole numbers of those units, each stored as how far it is from the one predicted from its neighbours
 * (the one to the west plus the one to the north less the one to the north-west; the first column from the one to its north; the first row from the one to its west), as 16-bit integers, little-endian, in base64.
 *
 * @example
 * ```ts
 * import { shapeRadii, type ShapeTable } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * const table: ShapeTable = { lon: 2, lat: 1, unit: 2, steps: "BAAAAAAAAAAAAAAAAA==" };
 * console.log(shapeRadii(table));
 * ```
 */
export interface ShapeTable {
  lon: number;
  lat: number;
  unit: number;
  steps: string;
}

/**
 * The radii of a table in kilometres, `lat + 1` rows of `lon`, the first row at the north pole.
 *
 * @param table - The table.
 * @returns The radii.
 *
 * @example
 * ```ts
 * import { shapeRadii } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * console.log(shapeRadii({ lon: 2, lat: 1, unit: 2, steps: "BAAAAAAAAAAAAAAAAA==" }));
 * ```
 */
export function shapeRadii(table: ShapeTable): Float32Array {
  const raw = atob(table.steps);
  const count = table.lon * (table.lat + 1);
  if (raw.length < count * 2) throw new RangeError(`a shape table of ${table.lon} by ${table.lat + 1} needs ${count * 2} bytes, not ${raw.length}`);
  const whole = new Int32Array(count);
  const out = new Float32Array(count);
  for (let row = 0; row < table.lat + 1; row += 1) {
    for (let column = 0; column < table.lon; column += 1) {
      const i = row * table.lon + column;
      let step = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
      if (step >= 0x8000) step -= 0x10000;
      const above = row > 0 ? (whole[i - table.lon] as number) : 0;
      const left = column > 0 ? (whole[i - 1] as number) : 0;
      const aboveLeft = row > 0 && column > 0 ? (whole[i - table.lon - 1] as number) : 0;
      whole[i] = step + (column === 0 ? above : row === 0 ? left : left + above - aboveLeft);
      out[i] = (whole[i] as number) / table.unit;
    }
  }
  return out;
}

/** The steps of longitude and of latitude of the globe a shaped moon is drawn on: no coarser than this, whatever the table's own grid. */
export const SHAPE_GLOBE: { readonly lon: number; readonly lat: number } = { lon: 192, lat: 96 };

// A cubic through four values (Catmull-Rom): the curve passes through the middle two.
const cubic = (a: number, b: number, c: number, d: number, t: number): number => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));

/**
 * The radius of a table in the direction of a vertex of a finer globe, by a cubic through the table's radii (round in longitude, held at the poles).
 * A table of 96 by 48 on a globe of 192 by 96 gives its own radius at every second vertex and the smooth curve between.
 */
function radiusAt(radii: Float32Array, lon: number, lat: number, u: number, v: number): number {
  const x = u * lon;
  const y = v * lat;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const rows: number[] = [];
  for (let dy = -1; dy <= 2; dy += 1) {
    const row = Math.min(lat, Math.max(0, y0 + dy));
    const at = (dx: number): number => radii[row * lon + ((((x0 + dx) % lon) + lon) % lon)] as number;
    rows.push(cubic(at(-1), at(0), at(1), at(2), tx));
  }
  return cubic(rows[0] as number, rows[1] as number, rows[2] as number, rows[3] as number, ty);
}

/**
 * The globe moved to the moon's shape: positions in units of `meanKm` (1 is the moon's mean radius), normals from the moved mesh with the seam and the poles joined. The caller disposes it.
 * The globe is `SHAPE_GLOBE` steps or the table's own, whichever is finer, with the table's radii carried to it by a smooth curve: the shader tips the surface by the difference between neighbouring pixels,
 * which is right across a smooth mesh and draws a lattice along the edges of a coarse one.
 *
 * @param three - The parts of three.js the bodies use.
 * @param table - The moon's table.
 * @param meanKm - The moon's mean radius in kilometres, which the picture takes as 1.
 * @returns The geometry.
 */
export function shapeGeometry(three: Pick<ThreeParts, "SphereGeometry">, table: ShapeTable, meanKm: number): THREE.BufferGeometry {
  const lon = Math.max(table.lon, SHAPE_GLOBE.lon);
  const lat = Math.max(table.lat, SHAPE_GLOBE.lat);
  const geometry = new three.SphereGeometry(1, lon, lat);
  const radii = shapeRadii(table);
  const position = geometry.getAttribute("position");
  const wide = lon + 1;
  for (let row = 0; row <= lat; row += 1) {
    for (let column = 0; column <= lon; column += 1) {
      const i = row * wide + column;
      const r = radiusAt(radii, table.lon, table.lat, (column % lon) / lon, row / lat) / meanKm;
      position.setXYZ(i, position.getX(i) * r, position.getY(i) * r, position.getZ(i) * r);
    }
  }
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  const set = (i: number, x: number, y: number, z: number): void => {
    const length = Math.hypot(x, y, z) || 1;
    normal.setXYZ(i, x / length, y / length, z / length);
  };
  // the seam: the first and the last vertex of a row are one point and take the one normal; a pole is one point, whose vertices take the sum of theirs
  for (let row = 0; row <= lat; row += 1) {
    const a = row * wide;
    const b = a + lon;
    set(a, normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b));
    normal.setXYZ(b, normal.getX(a), normal.getY(a), normal.getZ(a));
  }
  for (const row of [0, lat]) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let column = 0; column < lon; column += 1) {
      const i = row * wide + column;
      x += normal.getX(i);
      y += normal.getY(i);
      z += normal.getZ(i);
    }
    for (let column = 0; column <= lon; column += 1) set(row * wide + column, x, y, z);
  }
  normal.needsUpdate = true;
  return geometry;
}
