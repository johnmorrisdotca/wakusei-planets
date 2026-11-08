// L1.2, the theory of the motion of Io, Europa, Ganymede and Callisto (Lainey, Duriez and Vienne 2006, Astron. Astrophys. 456, 783; IMCCE), from the terms in data/galilean.ts.
// Each moon's elements (a, mean longitude, z, zeta) are sums of cosines and sines of time plus a Chebyshev polynomial for the slowest swings; they give a position from Jupiter's centre.
import { GALILEAN, GALILEAN_CONSTANTS } from "../data/galilean.ts";
import { toEcliptic, type Vec3 } from "../vec.ts";

const AU_KM = 149_597_870.7;
const DAY = 86_400_000;
const J1970_JD = 2_440_587.5;
const K = GALILEAN_CONSTANTS;

/**
 * A Galilean moon's position from Jupiter's centre in the J2000 ecliptic, in kilometres, at a moment in terrestrial time.
 * @param index - 0 Io, 1 Europa, 2 Ganymede, 3 Callisto.
 * @param terrestrialMs - The moment in milliseconds since 1970 in terrestrial time.
 */
export function galileanPosition(index: number, terrestrialMs: number): Vec3 {
  const moon = GALILEAN[index]!;
  const t = terrestrialMs / DAY + J1970_JD - K.t0;
  const [aTerms, lTerms, zTerms, zetaTerms] = moon.series;
  const x = Math.max(-1, Math.min(1, (t / 365.25 - 0.5 * (K.years[1] + K.years[0])) / (0.5 * (K.years[1] - K.years[0]))));
  const T = [1, x];
  for (let i = 2; i < 9; i += 1) T.push(2 * x * T[i - 1]! - T[i - 2]!);
  const val = [0, 0, 0, 0, 0];
  for (let v = 0; v < 5; v += 1) {
    for (let i = 0; i < 9; i += 1) val[v] = val[v]! + moon.chebyshev[i]![v]! * T[i]!;
    val[v] = val[v]! - 0.5 * moon.chebyshev[0]![v]!;
  }
  let a = 0;
  for (const [amplitude, phase, rate] of aTerms) a += amplitude! * Math.cos(phase! + rate! * t);
  let lambda = moon.l0 + moon.n0 * t + val[0]!;
  for (const [amplitude, phase, rate] of lTerms) lambda += amplitude! * Math.sin(phase! + rate! * t);
  let k = val[1]!;
  let h = val[2]!;
  for (const [amplitude, phase, rate] of zTerms) {
    k += amplitude! * Math.cos(phase! + rate! * t);
    h += amplitude! * Math.sin(phase! + rate! * t);
  }
  let q = val[3]!;
  let p = val[4]!;
  for (const [amplitude, phase, rate] of zetaTerms) {
    q += amplitude! * Math.cos(phase! + rate! * t);
    p += amplitude! * Math.sin(phase! + rate! * t);
  }
  let E = lambda + k * Math.sin(lambda) - h * Math.cos(lambda);
  for (let i = 0; i < 30; i += 1) {
    const ce = Math.cos(E);
    const se = Math.sin(E);
    const d = (lambda - E + k * se - h * ce) / (1 - k * ce - h * se);
    E += d;
    if (Math.abs(d) < 1e-12) break;
  }
  const ce = Math.cos(E);
  const se = Math.sin(E);
  const dle = h * ce - k * se;
  const psi = 1 / (1 + Math.sqrt(1 - k * k - h * h));
  const x1 = a * (ce - k - psi * h * dle);
  const y1 = a * (se - h + psi * k * dle);
  const f2 = 2 * Math.sqrt(1 - q * q - p * p);
  const p2 = 1 - 2 * p * p;
  const q2 = 1 - 2 * q * q;
  const pq = 2 * p * q;
  const px = x1 * p2 + y1 * pq;
  const py = x1 * pq + y1 * q2;
  const pz = (q * y1 - x1 * p) * f2;
  const co = Math.cos(K.node);
  const so = Math.sin(K.node);
  const ci = Math.cos(K.incline);
  const si = Math.sin(K.incline);
  const equatorial: Vec3 = [
    (px * co - py * so * ci + pz * si * so) * AU_KM,
    (px * so + py * co * ci - pz * si * co) * AU_KM,
    (py * si + pz * ci) * AU_KM,
  ];
  return toEcliptic(equatorial);
}
