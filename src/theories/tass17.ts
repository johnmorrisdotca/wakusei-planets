// TASS1.7, the theory of the motion of Mimas, Enceladus, Tethys, Dione, Rhea, Titan and Iapetus (Vienne and Duriez 1995, Astron. Astrophys. 297, 588; IMCCE), from the terms in data/tass17.ts.
// Each moon's elements (a, mean longitude, k, h, q, p) are sums of cosines and sines whose arguments are whole multiples of seven slowly changing longitudes; they give a position from Saturn's centre.
// The arrangement follows Orbiter's conversion of IMCCE's FORTRAN (github.com/orbitersim/orbiter, Src/Celbody/Satsat/Tass17.cpp, MIT, Copyright (c) Martin Schweiger).
import { TASS17, TASS17_CONSTANTS } from "../data/tass17.ts";
import type { Vec3 } from "../vec.ts";

const AU_KM = 149_597_870.7;
const DAY = 86_400_000;
const J1970_JD = 2_440_587.5;
const K = TASS17_CONSTANTS;
const gk1 = (K.gk * 365.25) ** 2 / K.tas;
const RAD = Math.PI / 180;
const incline = K.incline * RAD;
const node = K.node * RAD;

type Terms = readonly (readonly number[])[];

/** The seven perturbations of the mean longitudes (Hyperion, the eighth, is not in the theory here), by moon. */
function longitudes(t: number): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0, 0];
  TASS17.forEach((moon, i) => {
    let s = 0;
    const terms = moon.series[1];
    for (let k = 0; k < moon.longTerms; k += 1) {
      const term = terms[k]!;
      s += term[0]! * Math.sin(term[1]! + t * term[2]!);
    }
    out[i < 6 ? i : 7] = s;
  });
  return out;
}

/** The sum of the terms (from the `from`th) as amplitude x trig(phase + rate x t), the phase carrying whole multiples of the longitudes `dlo`. */
function sum(terms: Terms, from: number, t: number, dlo: readonly number[], trig: (x: number) => number): number {
  let s = 0;
  for (let i = from; i < terms.length; i += 1) {
    const term = terms[i]!;
    let phase = term[1]!;
    for (let j = 0; j < 8; j += 1) phase += term[3 + j]! * dlo[j]!;
    s += term[0]! * trig(phase + t * term[2]!);
  }
  return s;
}

/**
 * A moon of Saturn's position from Saturn's centre in the J2000 ecliptic, in kilometres, at a moment in terrestrial time.
 * @param index - 0 Mimas, 1 Enceladus, 2 Tethys, 3 Dione, 4 Rhea, 5 Titan, 6 Iapetus.
 * @param terrestrialMs - The moment in milliseconds since 1970 in terrestrial time.
 */
export function tass17Position(index: number, terrestrialMs: number): Vec3 {
  const moon = TASS17[index]!;
  const slot = index < 6 ? index : 7;
  const t = (terrestrialMs / DAY + J1970_JD - 2_444_240) / 365.25;
  const dlo = longitudes(t);
  const [a, l, z, zeta] = moon.series;
  const da = sum(a, 0, t, dlo, Math.cos);
  const lambda = dlo[slot]! + moon.l0 + sum(l, moon.longTerms, t, dlo, Math.sin) + moon.n0 * t;
  const k = sum(z, 0, t, dlo, Math.cos);
  const h = sum(z, 0, t, dlo, Math.sin);
  const q = sum(zeta, 0, t, dlo, Math.cos);
  const p = sum(zeta, 0, t, dlo, Math.sin);
  const meanMotion = K.meanMotion[slot]! * 365.25 * (da + 1);
  const mu = gk1 * (1 / K.massRatio[slot]! + 1);
  const size = Math.cbrt(mu / (meanMotion * meanMotion));
  let E = lambda - k * Math.sin(lambda) + h * Math.cos(lambda);
  for (let i = 0; i < 20; i += 1) {
    const cf = Math.cos(E);
    const sf = Math.sin(E);
    const d = (lambda - E + k * sf - h * cf) / (1 - k * cf - h * sf);
    E += d;
    if (Math.abs(d) < 1e-14) break;
  }
  const cf = Math.cos(E);
  const sf = Math.sin(E);
  const dlf = -k * sf + h * cf;
  const psi = 1 / (Math.sqrt(1 - k * k - h * h) + 1);
  const x1 = size * (cf - k - psi * h * dlf);
  const y1 = size * (sf - h + psi * k * dlf);
  const dwho = Math.sqrt(1 - p * p - q * q) * 2;
  const rtp = 1 - p * 2 * p;
  const rtq = 1 - q * 2 * q;
  const rdg = p * 2 * q;
  const x2 = x1 * rtp + y1 * rdg;
  const y2 = x1 * rdg + y1 * rtq;
  const z2 = (-x1 * p + y1 * q) * dwho;
  const ci = Math.cos(incline);
  const si = Math.sin(incline);
  const co = Math.cos(node);
  const so = Math.sin(node);
  return [
    (co * x2 - so * ci * y2 + so * si * z2) * AU_KM,
    (so * x2 + co * ci * y2 - co * si * z2) * AU_KM,
    (si * y2 + ci * z2) * AU_KM,
  ];
}
