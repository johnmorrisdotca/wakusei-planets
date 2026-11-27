// Refined mean orbits and short phase corrections fitted to JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api).
// The 768 fitting dates are independent of the test dates. See the accuracy guide for the measured limits.
import type { OrbitElements } from "./orbits.ts";

export const MOON_REFINEMENT_START = Date.UTC(1800, 0, 1);
export const MOON_REFINEMENT_END = Date.UTC(2200, 0, 1);

export const REFINED_ORBITS: Readonly<Record<string, OrbitElements>> = {
  miranda: { parent: "uranus", frame: "laplace", pole: [77.31506213, 15.17093543], epoch: 946728000000, a: 129825.94, e: 0.00125355, w: 129.85669, m: 97.72427, i: 4.42687, node: 100.85716, sid: 254.690662651, dw: 0.109972779, dn: -0.055413199 },
  nereid: { parent: "neptune", frame: "laplace", pole: [262.94029828, 62.53684645], epoch: 946728000000, a: 5512305.22, e: 0.75062427, w: 14.19452, m: 216.66135, i: 0.02056, node: 248.32822, sid: 0.999630559, dw: -0.075817643, dn: 0.075836065, wave: [0.555, 29462.3, -82.66] },
  nix: { parent: "pluto", frame: "laplace", pole: [133.01061166, -6.22346807], epoch: 946728000000, a: 48687.86, e: 0.00015264, w: 280.92679, m: 180.95848, i: 0.02265, node: -9.76167, sid: 14.484169223, dw: -0.57629393, dn: 0.000272294 },
  hydra: { parent: "pluto", frame: "laplace", pole: [133.00722166, -6.24530605], epoch: 946728000000, a: 64720.7, e: 0.00027642, w: 258.41798, m: 219.62994, i: 0.27858, node: 114.93801, sid: 9.423584108, dw: 3.911225088, dn: -0.070597541 },
};

/** The constant, linear and quadratic phase offsets in seconds, then [cycles/year, cosine seconds, sine seconds] per term. */
type PhaseCorrection = {
  trend: readonly [number, number, number?];
  terms: readonly (readonly [number, number, number])[];
};

export const MEAN_MOON_PHASE: Readonly<Partial<Record<string, PhaseCorrection>>> = {
  miranda: {
    trend: [143.722, 10.96, -431.445],
    terms: [
      [0.08, -311.227, 326.291],
      [0.07875, -57.715, 72.599],
      [0.159375, -60.498, 6.577],
      [0.08125, 45.313, -35.991],
    ],
  },
  nereid: {
    trend: [1076.873, -4230.471],
    terms: [
      [1.001875, 78078.7, -45789.561],
      [0.0125, 35574.288, -4777.232],
      [1.000625, -11229.885, 7769.433],
      [1.015, -6716.955, 1846.33],
    ],
  },
};

export const SATURN_MOON_PHASE: Readonly<Partial<Record<string, PhaseCorrection>>> = {
  mimas: {
    trend: [-47.676, -36.088],
    terms: [
      [0.013125, 114.079, -58.124],
      [0.015, -14.942, 115.918],
      [0.00125, 84.836, -3.153],
      [386.54972948, 25.565, 8.036],
    ],
  },
  enceladus: {
    trend: [12.281, -136.691],
    terms: [
      [0.091875, 7.576, 5.117],
      [0.089375, -24.354, -13.068],
      [0.090625, 23.527, -6.973],
      [0.00062701, -37.353, 27.378],
    ],
  },
};

const YEAR_MS = 365.25 * 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);

/** Correct the orbital phase in the fitted interval and fade back to the original theory outside it. */
export function moonPhaseTime(ms: number, correction: PhaseCorrection | undefined): number {
  if (correction === undefined) return ms;
  const years = (ms - J2000_MS) / YEAR_MS;
  const weight = Math.min(1, (210 - Math.abs(years)) / 10);
  if (weight <= 0) return ms;
  const epoch = years / 200;
  const [constant, linear, quadratic = 0] = correction.trend;
  let seconds = constant + epoch * (linear + epoch * quadratic);
  for (const [frequency, cosine, sine] of correction.terms) {
    const phase = 2 * Math.PI * frequency * years;
    seconds += cosine * Math.cos(phase) + sine * Math.sin(phase);
  }
  return ms + weight * seconds * 1000;
}
