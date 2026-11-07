// Frame orientation only (Meeus chapters 12, 21, 22); angles here are radians unless named otherwise.
import type { Vec3 as Vec } from "../vec.ts";

type Matrix = readonly [Vec, Vec, Vec];
const ARCSEC = Math.PI / 648000;
import { meanObliquityArcseconds, nutation } from "../sidereal.ts";
const OBLIQUITY_J2000 = meanObliquityArcseconds(0) * ARCSEC;

const matrixTimes = (a: Matrix, b: Matrix): Matrix => [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!)) as unknown as Matrix;
const apply = (matrix: Matrix, vector: Vec): Vec => matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]) as unknown as Vec;
/** The matrix that re-expresses a vector in axes turned by `a` radians about x, y or z (a frame turn, not a vector turn). */
const frameTurn = (axis: 1 | 2 | 3, a: number): Matrix => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (axis === 1) return [[1, 0, 0], [0, c, s], [0, -s, c]];
  if (axis === 2) return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
  return [[c, s, 0], [-s, c, 0], [0, 0, 1]];
};

/** A J2000 mean-ecliptic vector turned into the true equator and equinox of date: obliquity of J2000, IAU 1976 precession, then nutation. */
export function eclipticJ2000ToTrueEquatorialOfDate(ecliptic: Vec, T: number): Vec {
  const equatorial = apply(frameTurn(1, -OBLIQUITY_J2000), ecliptic);
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * ARCSEC;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * ARCSEC;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * ARCSEC;
  const precession = matrixTimes(frameTurn(3, -z), matrixTimes(frameTurn(2, theta), frameTurn(3, -zeta)));
  const n = nutation(T);
  const nutate = matrixTimes(frameTurn(1, -(n.meanObliquity + n.obliquity)), matrixTimes(frameTurn(3, -n.longitude), frameTurn(1, n.meanObliquity)));
  return apply(nutate, apply(precession, equatorial));
}

