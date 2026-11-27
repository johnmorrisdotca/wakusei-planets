import { DAY_MS } from "./clock.ts";
import type { OrbitElements } from "./data/orbits.ts";
import { cross, fromRaDec, RAD, toEcliptic, type Vec3 } from "./vec.ts";

export interface OrbitBasis {
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

/** The ascending intersection of the Laplace plane with the ICRF equator is the longitude origin. */
export function laplaceBasis(pole: readonly [number, number]): OrbitBasis {
  const z = fromRaDec(pole[0], pole[1]);
  const x = fromRaDec(pole[0] + 90, 0);
  return { x: toEcliptic(x), y: toEcliptic(cross(z, x)), z: toEcliptic(z) };
}

/** Solve Kepler's equation for the eccentric anomaly, all in radians. */
export function kepler(meanAnomaly: number, e: number): number {
  let m = meanAnomaly % (2 * Math.PI);
  if (m > Math.PI) m -= 2 * Math.PI;
  if (m < -Math.PI) m += 2 * Math.PI;
  // from the mean anomaly itself for a gentle orbit, and for a long one from a place on the same side of the orbit (Newton's method started at pi goes astray for a negative mean anomaly, which put Sedna's far side in the wrong places)
  let E = e < 0.8 ? m : m + 0.85 * e * Math.sign(Math.sin(m) || 1);
  for (let i = 0; i < 12; i += 1) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Position on a precessing ellipse in the input elements’ time scale, in J2000 ecliptic kilometres. */
export function precessingOrbitVector(orbit: OrbitElements, ms: number, basis: OrbitBasis): Vec3 {
  const dt = (ms - orbit.epoch) / DAY_MS;
  const w = orbit.w + orbit.dw * dt;
  const node = orbit.node + orbit.dn * dt;
  const lambda0 = orbit.w + orbit.node + orbit.m;
  const swing = orbit.wave === undefined ? 0 : orbit.wave[0] * Math.sin((2 * Math.PI * dt) / orbit.wave[1] + orbit.wave[2] * RAD);
  const M = lambda0 + orbit.sid * dt + 0.5 * (orbit.acc ?? 0) * dt * dt + swing - w - node;
  const E = kepler(M * RAD, orbit.e);
  const x = orbit.a * (Math.cos(E) - orbit.e);
  const y = orbit.a * Math.sqrt(1 - orbit.e * orbit.e) * Math.sin(E);
  const cw = Math.cos(w * RAD);
  const sw = Math.sin(w * RAD);
  const cn = Math.cos(node * RAD);
  const sn = Math.sin(node * RAD);
  const ci = Math.cos(orbit.i * RAD);
  const si = Math.sin(orbit.i * RAD);
  const px = (cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y;
  const py = (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y;
  const pz = sw * si * x + cw * si * y;
  return [px * basis.x[0] + py * basis.y[0] + pz * basis.z[0], px * basis.x[1] + py * basis.y[1] + pz * basis.z[1], px * basis.x[2] + py * basis.y[2] + pz * basis.z[2]];
}
