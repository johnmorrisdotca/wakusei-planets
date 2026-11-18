// The real shape of a small moon, as three.js draws it: the globe (`SphereGeometry`) with every vertex moved to the moon's radius in its direction, from a table cut out of a published shape model (scripts/make-moon-shapes.py). The moon is
// drawn with its own shader, map and light on this mesh as on a sphere (the shader works from the direction of a point, which is the same on the moved vertex), with normals worked out from the moved mesh. Pure data and geometry: no DOM, no clock.
import type * as THREE from "three";
import type { ThreeParts } from "./body.ts";

/**
 * A moon's shape as a table of radii: `lon` steps of longitude and `lat` steps of latitude round the globe (the vertices of `SphereGeometry(1, lon, lat)`, `(lat + 1) * lon` radii, the seam and the poles shared), each in units of
 * 1 / `unit` kilometre, as 16-bit integers written as the step from the radius before it along the same line of latitude, little-endian, in base64.
 *
 * @example
 * ```ts
 * import type { ShapeTable } from "@johnmorrisdotca/wakusei-planets/look";
 *
 * const table: ShapeTable = { lon: 2, lat: 2, unit: 1, steps: "AQAAAAEAAAABAAAAAQAAAAEAAAAA" };
 * console.log(table.lon * (table.lat + 1));
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
  const out = new Float32Array(count);
  for (let row = 0; row < table.lat + 1; row += 1) {
    let value = 0;
    for (let column = 0; column < table.lon; column += 1) {
      const at = (row * table.lon + column) * 2;
      let step = raw.charCodeAt(at) | (raw.charCodeAt(at + 1) << 8);
      if (step >= 0x8000) step -= 0x10000;
      value += step;
      out[row * table.lon + column] = value / table.unit;
    }
  }
  return out;
}

/**
 * The globe moved to the moon's shape: positions in units of `meanKm` (1 is the moon's mean radius), normals from the moved mesh with the seam and the poles joined. The caller disposes it.
 *
 * @param three - The parts of three.js the bodies use.
 * @param table - The moon's table.
 * @param meanKm - The moon's mean radius in kilometres, which the picture takes as 1.
 * @returns The geometry.
 */
export function shapeGeometry(three: Pick<ThreeParts, "SphereGeometry">, table: ShapeTable, meanKm: number): THREE.BufferGeometry {
  const geometry = new three.SphereGeometry(1, table.lon, table.lat);
  const radii = shapeRadii(table);
  const position = geometry.getAttribute("position");
  const wide = table.lon + 1;
  for (let row = 0; row <= table.lat; row += 1) {
    for (let column = 0; column <= table.lon; column += 1) {
      const i = row * wide + column;
      const r = (radii[row * table.lon + (column % table.lon)] as number) / meanKm;
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
  for (let row = 0; row <= table.lat; row += 1) {
    const a = row * wide;
    const b = a + table.lon;
    set(a, normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b));
    normal.setXYZ(b, normal.getX(a), normal.getY(a), normal.getZ(a));
  }
  for (const row of [0, table.lat]) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let column = 0; column < table.lon; column += 1) {
      const i = row * wide + column;
      x += normal.getX(i);
      y += normal.getY(i);
      z += normal.getZ(i);
    }
    for (let column = 0; column <= table.lon; column += 1) set(row * wide + column, x, y, z);
  }
  normal.needsUpdate = true;
  return geometry;
}
