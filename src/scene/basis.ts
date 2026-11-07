import type { Matrix4 } from "three";
import type { Vec3 } from "../vec.ts";

// The axes are already numeric triples; do not allocate Vector3 objects every frame.
export function writeBasis(matrix: Matrix4, x: Vec3, y: Vec3, z: Vec3, sx = 1, sy = 1, sz = 1): Matrix4 {
  return matrix.set(
    x[0] * sx, y[0] * sy, z[0] * sz, 0,
    x[1] * sx, y[1] * sy, z[1] * sz, 0,
    x[2] * sx, y[2] * sy, z[2] * sz, 0,
    0, 0, 0, 1,
  );
}
